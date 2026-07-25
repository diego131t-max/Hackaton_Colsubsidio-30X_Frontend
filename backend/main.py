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
from uuid import UUID, uuid4

from fastapi import BackgroundTasks, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from backend import config
from backend.core import clustering_client, handoff_card
from backend.integrations import dapta_client, supabase_client
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
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
        {"pieza": "bowl", "estado": "completado", "nota": "Completó el formulario"},
        {"pieza": "backend", "estado": "en_proceso", "nota": "Reglas H1–H10"},
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
        {"pieza": "clustering", "estado": "completado",
         "nota": f'Agrupado en "{clustering.cluster_id}"'}
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
        {"pieza": "dapta", "estado": "en_proceso", "nota": "En llamada con Manuela"}
    )
    await supabase_client.actualizar_lead(
        lead_id,
        {"nodo_actual": "dapta", "estado_nodo": "en_proceso", "timeline": timeline},
    )

    # 4) Disparo REAL a Dapta solo si está activado (evita llamadas de prueba).
    if config.DAPTA_LLAMADAS_ACTIVAS:
        try:
            disparo = await dapta_client.disparar_llamada(
                senal, clustering, external_lead_id=call_id
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
@app.post("/leads", status_code=202)
async def crear_lead(
    senal: SenalBowl, background: BackgroundTasks
) -> dict[str, str]:
    """
    Recibe la señal del bowl, la valida (Pydantic la valida automáticamente y
    devuelve 422 con detalle si no matchea el contrato) y encola el pipeline.
    Responde de inmediato con el lead_id.
    """
    lead_id = uuid4()
    background.add_task(_procesar_lead, lead_id, senal)
    return {"lead_id": str(lead_id), "status": "procesando"}


# --------------------------------------------------------------------------- #
# PUERTO DE ENTRADA 2 — Dapta llama de vuelta con el resultado
# --------------------------------------------------------------------------- #
@app.post("/webhooks/dapta/resultado")
async def webhook_dapta_resultado(
    resultado: ResultadoCalificacionDapta,
    x_dapta_secret: str | None = Header(default=None),
) -> dict[str, str]:
    """
    Recibe el resultado de calificación de Dapta (voz/WhatsApp), lo valida contra
    el contrato y lo persiste en Supabase (la fila del lead con ese `call_id`)
    para que el dashboard lo muestre en vivo.

    Seguridad: si DAPTA_WEBHOOK_SECRET está configurado, exige el header
    X-Dapta-Secret. Si no está configurado, acepta (con TODO de cerrarlo).
    """
    # Verificación de autenticidad (opcional hasta configurar el secreto).
    if config.DAPTA_WEBHOOK_SECRET:
        if x_dapta_secret != config.DAPTA_WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Firma de webhook inválida")

    # Persistir en Supabase -> el dashboard lo refleja por Realtime.
    resultado_persistencia = await supabase_client.guardar_resultado(resultado)

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
