"""
Punto de entrada del BACKEND DE SEÑALES Y REGLAS (pieza 2 del sistema).

App FastAPI (async) que expone los puertos de integración del sistema:

  - POST /leads                     (entrada: SenalBowl desde el bowl/frontend)
  - POST /webhooks/dapta/resultado  (entrada: ResultadoCalificacionDapta de Dapta)

`POST /leads` responde RÁPIDO (202) y dispara el pipeline en background para no
hacer esperar al frontend:

    SenalBowl
      -> rules_engine (H1-H10, ya existe, no se toca)
      -> clustering_client.predecir_cluster
      -> handoff_card.iniciar_ficha
      -> dapta_client.disparar_llamada  (Dapta llama por fuera de nuestro sistema)

Cuando Dapta termina, hace POST a /webhooks/dapta/resultado y se completa la
FichaTraspaso final vía handoff_card.aplicar_resultado_dapta.

NOTA: la implementación interna de cada pieza sigue siendo stub/mock. Este
archivo deja los PUERTOS y tipos definidos; cada dueño llena el cuerpo.

TODOs de seguridad (fuera del alcance de esta pasada — dejar explícitos):
  - [ ] Autenticar /webhooks/dapta/resultado (firma HMAC o header secreto
        compartido con Dapta). HOY el endpoint confía en el emisor.
  - [ ] Restringir CORS al origen del frontend.
  - [ ] Rate limiting + límite de tamaño de payload en /leads (superficie pública).
  - [ ] Consentimiento (Habeas Data, Ley 1581) capturado en el bowl.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any
from uuid import UUID, uuid4

from pydantic import ValidationError
from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend import config
from backend.core import clustering_client, handoff_card
from backend.integrations import dapta_client, recomendaciones_client, supabase_client
from backend.models.schemas import (
    ResultadoCalificacionDapta,
    SenalBowl,
)

logger = logging.getLogger("reto_vivienda")

app = FastAPI(
    title="Reto Vivienda Colsubsidio x 30X — Backend",
    description="Puertos de integración del sistema (modelado end-to-end).",
    version="0.2.0",
)

# CORS — el formulario corre en OTRO origen (localhost:5500 en dev, o el dominio
# del frontend en prod) y el navegador exige estas cabeceras para permitir el POST.
# Sin esto, el browser bloquea la petición y el lead nunca llega.
if config.FRONTEND_ORIGIN.strip() in ("", "*"):
    _origins = ["*"]  # abierto para el hackathon; TODO(seguridad): restringir en prod
else:
    _origins = [
        config.FRONTEND_ORIGIN.strip(),
        "http://localhost:5500",
        "http://localhost:5173",
        "http://localhost:5174",
    ]
# Además de los orígenes explícitos, permitimos cualquier subdominio *.vercel.app
# (producción y previews). Vercel genera una URL nueva por deploy/preview, así que
# fijar una sola rompería en el siguiente push; el regex las cubre todas.
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

# TODO(infra): reemplazar por un almacén real (Supabase/DB). En memoria solo
# sirve para la demo; se pierde al reiniciar y no es apto para varios procesos.
_fichas_en_proceso: dict[UUID, object] = {}


# --------------------------------------------------------------------------- #
# Orquestación del pipeline (corre en background para no bloquear /leads)
# --------------------------------------------------------------------------- #
async def _procesar_lead(lead_id: UUID, senal: SenalBowl) -> None:
    """
    Persiste el lead en Supabase y lo mueve por las piezas del pipeline
    (backend -> clustering -> dapta) para que el dashboard lo muestre en vivo.
    Usa el lead_id como call_id para poder correlacionar el resultado de Dapta.
    """
    call_id = str(lead_id)
    timeline: list[dict] = [
        supabase_client.evento("bowl", "completado", "Completó el formulario"),
        supabase_client.evento("backend", "en_proceso", "Reglas H1–H10"),
    ]

    # 1) Persistir en Supabase (etapa backend). El dashboard lo ve al instante.
    try:
        await supabase_client.crear_lead(lead_id, senal, call_id)
    except Exception:  # noqa: BLE001 - no queremos tumbar el pipeline por I/O
        logger.exception("No se pudo crear el lead %s en Supabase", lead_id)

    # (Motor de reglas H1-H10: aún stub; aquí iría su cálculo real.)
    await asyncio.sleep(0.8)  # pequeño delay para que el flujo se vea en el dashboard

    # 2) Clustering.
    clustering = await clustering_client.predecir_cluster(senal)
    timeline.append(
        supabase_client.evento(
            "clustering", "completado", f'Agrupado en "{clustering.cluster_id}"'
        )
    )
    await supabase_client.actualizar_lead(
        lead_id,
        {
            "nodo_actual": "clustering",
            "estado_nodo": "completado",
            "cluster_id": clustering.cluster_id,
            "proyectos_recomendados": clustering.proyectos_recomendados,
            "timeline": timeline,
        },
    )
    _fichas_en_proceso[lead_id] = handoff_card.iniciar_ficha(lead_id, senal, clustering)

    # 3) Etapa Dapta.
    await asyncio.sleep(0.8)
    timeline.append(
        supabase_client.evento("dapta", "en_proceso", "En llamada con Manuela")
    )
    await supabase_client.actualizar_lead(
        lead_id,
        {"nodo_actual": "dapta", "estado_nodo": "en_proceso", "timeline": timeline},
    )

    # 4) Disparo REAL a Dapta solo si está activado (evita llamadas de prueba).
    #    Dapta habla del proyecto ELEGIDO por la persona (o el top recomendado).
    proyecto = senal.proyecto_elegido or (
        clustering.proyectos_recomendados[0]
        if clustering.proyectos_recomendados
        else None
    )
    if config.DAPTA_LLAMADAS_ACTIVAS:
        try:
            finanzas = recomendaciones_client.estimar_finanzas(
                senal, recomendaciones_client.buscar_proyecto(proyecto)
            )
            disparo = await dapta_client.disparar_llamada(
                senal, clustering, external_lead_id=call_id, proyecto_interes=proyecto,
                **finanzas,
            )
            logger.info("Lead %s: disparo a Dapta -> %s", lead_id, disparo.get("status"))
        except Exception:  # noqa: BLE001
            logger.exception("Fallo al disparar la llamada de Dapta para %s", lead_id)
    else:
        logger.info(
            "Lead %s en etapa 'dapta' (DAPTA_LLAMADAS_ACTIVAS=false, no se llama).",
            lead_id,
        )


# --------------------------------------------------------------------------- #
# PUERTO DE ENTRADA 1 — el frontend hace POST del bowl
# --------------------------------------------------------------------------- #
@app.post("/recomendaciones")
async def recomendaciones(senal: SenalBowl) -> dict:
    """
    Paso 1: recibe el SenalBowl (parte del formulario), CREA el registro temporal
    del lead en Supabase (el dashboard lo ve entrar), corre el modelo y devuelve
    `lead_id` + el Top 6 con match_score para que el formulario los muestre.

    El `lead_id` que devuelve se manda luego a `POST /leads?lead_id=...` al
    confirmar, para completar ESE MISMO registro (no crear uno nuevo).
    """
    lead_id = uuid4()
    resultado = await recomendaciones_client.recomendar(senal, top=6)
    proyectos = [r.get("nombre_proyecto", "") for r in resultado["recomendaciones"]]
    zona = (senal.zona_interes or "").strip().lower()
    cluster_id = f"{senal.tipo_vivienda}::{zona}" if zona else senal.tipo_vivienda

    # El modelo ya calculó match_score y su desglose; se persisten para que la
    # ficha del asesor pueda explicar POR QUÉ se recomendó cada proyecto. Se
    # guarda un subconjunto acotado, no la recomendación entera: el catálogo
    # completo (planos, amenidades) no aporta nada en la ficha y engorda la fila.
    detalle = [
        {
            "nombre_proyecto": r.get("nombre_proyecto"),
            "match_score": r.get("match_score"),
            "match_desglose": r.get("match_desglose"),
            "precio_desde_cop": r.get("precio_desde_cop"),
            "tipo_vivienda": r.get("tipo_vivienda"),
            "zona_interes": r.get("zona_interes"),
            "url_ficha": r.get("url_ficha"),
        }
        for r in resultado["recomendaciones"]
    ]

    try:
        await supabase_client.crear_lead_recomendaciones(
            lead_id, senal, cluster_id, proyectos, recomendaciones_detalle=detalle
        )
    except Exception:  # noqa: BLE001 - no romper la respuesta por un fallo de I/O
        logger.exception("No se pudo crear el lead temporal %s en Supabase", lead_id)

    return {"lead_id": str(lead_id), **resultado}


@app.post("/leads", status_code=202)
async def crear_lead(
    senal: SenalBowl, background: BackgroundTasks, lead_id: str | None = None
) -> dict[str, str]:
    """
    Paso final (confirmación). Dos modos:
      - Con `?lead_id=...` (viene de /recomendaciones): COMPLETA ese registro
        temporal con el proyecto elegido y lo manda a Dapta.
      - Sin lead_id (compat): crea el lead desde cero y corre el pipeline entero.
    """
    if lead_id:
        try:
            lid = UUID(lead_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="lead_id inválido")
        background.add_task(_finalizar_lead, lid, senal)
        return {"lead_id": lead_id, "status": "confirmando"}

    lid = uuid4()
    background.add_task(_procesar_lead, lid, senal)
    return {"lead_id": str(lid), "status": "procesando"}


async def _finalizar_lead(lead_id: UUID, senal: SenalBowl) -> None:
    """
    Completa un lead temporal ya existente (creado en /recomendaciones): guarda el
    proyecto elegido, lo mueve a 'dapta' y dispara la llamada si está activo.
    """
    call_id = str(lead_id)
    clustering = await clustering_client.predecir_cluster(senal)
    proyecto = senal.proyecto_elegido or (
        clustering.proyectos_recomendados[0]
        if clustering.proyectos_recomendados
        else None
    )
    timeline = [
        supabase_client.evento("bowl", "completado", "Completó el formulario"),
        supabase_client.evento("backend", "completado", "Reglas H1–H10"),
        supabase_client.evento("clustering", "completado", "Recomendaciones generadas"),
        supabase_client.evento(
            "dapta",
            "en_proceso",
            f"Eligió {proyecto}; en contacto con Manuela" if proyecto
            else "En llamada con Manuela",
        ),
    ]
    await supabase_client.actualizar_lead(
        lead_id,
        {
            "senal": senal.model_dump(),
            "nodo_actual": "dapta",
            "estado_nodo": "en_proceso",
            "timeline": timeline,
        },
    )

    if config.DAPTA_LLAMADAS_ACTIVAS:
        try:
            finanzas = recomendaciones_client.estimar_finanzas(
                senal, recomendaciones_client.buscar_proyecto(proyecto)
            )
            await dapta_client.disparar_llamada(
                senal, clustering, external_lead_id=call_id, proyecto_interes=proyecto,
                **finanzas,
            )
        except Exception:  # noqa: BLE001
            logger.exception("Fallo al disparar Dapta para %s", lead_id)
    else:
        logger.info("Lead %s confirmado en 'dapta' (llamadas desactivadas).", lead_id)


# --------------------------------------------------------------------------- #
# PUERTO DE ENTRADA 2 — Dapta llama de vuelta con el resultado
# --------------------------------------------------------------------------- #
@app.post("/webhooks/dapta/resultado")
async def webhook_dapta_resultado(
    payload: dict[str, Any],
    background: BackgroundTasks,
    x_dapta_secret: str | None = Header(default=None),
) -> dict[str, str]:
    """
    Recibe el resultado de calificación de Dapta (voz/WhatsApp), lo valida contra
    el contrato y lo persiste en Supabase (la fila del lead con ese `call_id`)
    para que el dashboard lo muestre en vivo.

    Seguridad: si DAPTA_WEBHOOK_SECRET está configurado, exige el header
    X-Dapta-Secret. Si no está configurado, acepta (con TODO de cerrarlo).
    """
    # El cuerpo entra como dict y NO como el modelo: Dapta manda la forma nativa
    # `{"call": {...}}` y tiparlo directo devolvia 422 antes de llegar aqui. Ver
    # ResultadoCalificacionDapta.desde_webhook.
    try:
        resultado = ResultadoCalificacionDapta.desde_webhook(payload)
    except ValidationError as e:
        # Un 422 aqui hace que Dapta de la entrega por fallida y el lead se
        # queda sin ficha, asi que se registra con el cuerpo para poder
        # reprocesarlo en vez de perderlo en silencio.
        logger.error("Webhook de Dapta no parseable: %s | cuerpo=%s",
                     e, str(payload)[:1200])
        raise HTTPException(status_code=422, detail="Cuerpo del webhook no reconocido")

    # Verificación de autenticidad (opcional hasta configurar el secreto).
    if config.DAPTA_WEBHOOK_SECRET:
        if x_dapta_secret != config.DAPTA_WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Firma de webhook inválida")

    # Persistir en Supabase -> el dashboard lo refleja por Realtime.
    resultado_persistencia = await supabase_client.guardar_resultado(resultado)

    # Si NO contestó (sin calificación), dispara el seguimiento por WhatsApp.
    # GATED: enviar_whatsapp_seguimiento es no-op si WhatsApp no está activo/
    # configurado, así que esto no afecta el flujo actual mientras no haya línea.
    if resultado.calificacion_lead is None:
        background.add_task(
            dapta_client.enviar_whatsapp_seguimiento, resultado.telefono_correlacion
        )
        logger.info("Lead sin contestar (%s): encolado seguimiento WhatsApp (gated).",
                    resultado.telefono_correlacion)

    # Compatibilidad: si había una ficha en memoria, también se completa.
    if len(_fichas_en_proceso) == 1:
        (lead_id, ficha), = _fichas_en_proceso.items()
        _fichas_en_proceso[lead_id] = handoff_card.aplicar_resultado_dapta(
            ficha, resultado  # type: ignore[arg-type]
        )

    return {
        "call_id": resultado.call_id,
        "status": "recibido",
        "persistencia": resultado_persistencia.get("estado", "?"),
    }


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness simple."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    # TODO(infra): host/puerto por variable de entorno.
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
