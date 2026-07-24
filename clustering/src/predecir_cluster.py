"""
Predicción de cluster para un lead.

Pieza del sistema: CLUSTERING (Santiago DS).

Función que el BACKEND importa/llama (vía backend/core/clustering_client.py)
para asignar un cluster a un lead y personalizar recomendaciones.

TODOs:
  - [ ] Cargar el modelo entrenado (clustering/modelos/kmeans_v1.pkl) una sola vez.
  - [ ] Definir el contrato de entrada con el backend: qué features exactas
        (subconjunto del contrato de datos, sección 4) y en qué orden/escala.
  - [ ] Devolver un identificador de cluster estable y documentado.
"""

from __future__ import annotations

from typing import Any


def predecir_cluster(features: dict[str, Any]) -> str:
    """
    Asigna un cluster a partir de las features del lead.

    TODO: cargar el .pkl y predecir de verdad.
    """
    raise NotImplementedError("predecir_cluster: modelo real pendiente.")
