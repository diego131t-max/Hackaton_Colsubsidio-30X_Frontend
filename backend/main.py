"""
Punto de entrada del BACKEND DE SEÑALES Y REGLAS (pieza 2 del sistema).

Recibe el POST del bowl (frontend), valida con el contrato de datos, aplica el
motor de reglas (H1-H10) y dispara a Dapta / clustering según corresponda.

Base ya existente del MVP anterior — aquí se extiende.

TODOs:
  - [ ] Elegir framework (FastAPI recomendado por el uso de Pydantic).
  - [ ] Implementar endpoint POST /leads que valide con PerfilLead.
  - [ ] Orquestar: afiliado_lookup -> rules_engine -> project_recommender
        -> clustering_client -> dapta_client.disparar_llamada.
  - [ ] Endpoint POST /dapta/webhook -> dapta_client.recibir_resultado_calificacion.
  - [ ] Configuración (env vars, CORS para el frontend).
"""

from __future__ import annotations

from backend.models.schemas import PerfilLead


def procesar_lead(lead: PerfilLead) -> None:
    """
    Orquesta el flujo completo para un lead recién capturado por el bowl.

    TODO: encadenar las piezas del core y disparar Dapta.
    """
    raise NotImplementedError("procesar_lead: orquestación pendiente.")


if __name__ == "__main__":
    # TODO: levantar el servidor (uvicorn/FastAPI) cuando esté implementado.
    raise NotImplementedError("Arranque del servidor pendiente.")
