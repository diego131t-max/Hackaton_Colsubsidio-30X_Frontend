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

import logging
from uuid import UUID, uuid4

from fastapi import BackgroundTasks, FastAPI

from backend.core import clustering_client, handoff_card
from backend.integrations import dapta_client
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

# TODO(infra): reemplazar por un almacén real (Supabase/DB). En memoria solo
# sirve para la demo; se pierde al reiniciar y no es apto para varios procesos.
_fichas_en_proceso: dict[UUID, object] = {}


# --------------------------------------------------------------------------- #
# Orquestación del pipeline (corre en background para no bloquear /leads)
# --------------------------------------------------------------------------- #
async def _procesar_lead(lead_id: UUID, senal: SenalBowl) -> None:
    """Encadena reglas -> clustering -> ficha inicial -> disparo a Dapta."""
    # 1) Motor de reglas (H1-H10). Pieza existente; puede seguir siendo stub.
    try:
        from backend.core import rules_engine  # import local: aún es stub

        # TODO(backend): reconciliar firma real de rules_engine con SenalBowl.
        rules_engine  # noqa: B018  (referencia explícita; sin lógica todavía)
    except NotImplementedError:
        logger.info("rules_engine aún es stub; se omite en el pipeline mock.")

    # 2) Clustering (mock determinístico por ahora).
    clustering = await clustering_client.predecir_cluster(senal)

    # 3) Ficha inicial (sin datos de Dapta todavía).
    ficha = handoff_card.iniciar_ficha(lead_id, senal, clustering)
    _fichas_en_proceso[lead_id] = ficha

    # 4) Disparo a Dapta (mock; no hace la llamada real todavía).
    resultado_disparo = await dapta_client.disparar_llamada(senal, clustering)
    logger.info("Lead %s: disparo a Dapta -> %s", lead_id, resultado_disparo)


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
) -> dict[str, str]:
    """
    Recibe el resultado de calificación de Dapta (voz/WhatsApp) y completa la
    FichaTraspaso final. Pydantic valida el payload contra el contrato.

    TODO(seguridad): verificar autenticidad del emisor antes de confiar en esto.
    TODO(infra): correlacionar `call_id` con el lead_id real (hoy la ficha se
      guarda en memoria por lead_id; falta el mapeo call_id -> lead_id).
    """
    # TODO: recuperar la ficha correcta usando el mapeo call_id -> lead_id.
    # Placeholder: si hubiera exactamente una ficha en proceso, se completa.
    if len(_fichas_en_proceso) == 1:
        (lead_id, ficha), = _fichas_en_proceso.items()
        ficha_final = handoff_card.aplicar_resultado_dapta(ficha, resultado)  # type: ignore[arg-type]
        _fichas_en_proceso[lead_id] = ficha_final

    return {"call_id": resultado.call_id, "status": "recibido"}


@app.get("/health")
async def health() -> dict[str, str]:
    """Liveness simple."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    # TODO(infra): host/puerto por variable de entorno.
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
