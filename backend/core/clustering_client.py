"""
Puerto de recomendaciones — backend <-> modelo de Santiago DS.

Pieza del sistema: BACKEND (core) <-> MODELO DE RECOMENDACIONES.

Envuelve el modelo real (backend/integrations/recomendaciones_client.py) y lo
expone con la interfaz que ya consume el pipeline: `predecir_cluster(señal) ->
ResultadoClustering`. El "cluster_id" se deriva del proyecto top y la zona; los
`proyectos_recomendados` son los nombres del Top N real.
"""

from __future__ import annotations

from backend.integrations import recomendaciones_client
from backend.models.schemas import ResultadoClustering, SenalBowl


async def predecir_cluster(senal: SenalBowl) -> ResultadoClustering:
    """
    Corre el modelo real y adapta su salida a ResultadoClustering.

    - proyectos_recomendados: nombres del Top N (orden por match_score).
    - cluster_id: etiqueta derivada (tipo::zona) para trazabilidad en el dashboard.
    """
    resultado = await recomendaciones_client.recomendar(senal, top=6)
    recomendaciones = resultado["recomendaciones"]

    proyectos = [r.get("nombre_proyecto", "") for r in recomendaciones]
    zona = (senal.zona_interes or "").strip().lower()
    cluster_id = f"{senal.tipo_vivienda}::{zona}" if zona else senal.tipo_vivienda

    return ResultadoClustering(cluster_id=cluster_id, proyectos_recomendados=proyectos)
