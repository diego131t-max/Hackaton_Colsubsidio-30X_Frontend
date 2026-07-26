"""
Adaptador del backend hacia el MODELO DE RECOMENDACIONES de Santiago.

Pieza del sistema: BACKEND (core) <-> MODELO DE RECOMENDACIONES.

Importa el modelo real (modelo_recomendaciones/recomendaciones.py), carga el
catálogo UNA vez y expone una función async para recomendar el Top N a partir
de un SenalBowl. El catálogo se resuelve en backend/data/proyectos_seed.json.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Any

from backend.models.schemas import SenalBowl

# El modelo vive en <repo>/modelo_recomendaciones. Lo agregamos al path para
# poder importarlo (es un script de stdlib, no un paquete instalado).
_RAIZ = Path(__file__).resolve().parents[2]
_MODELO_DIR = _RAIZ / "modelo_recomendaciones"
if str(_MODELO_DIR) not in sys.path:
    sys.path.insert(0, str(_MODELO_DIR))

from recomendaciones import (  # noqa: E402  (import tras ajustar sys.path)
    recomendar_inmuebles,
    resolver_catalogo,
)

# Catálogo cargado una sola vez (se resuelve en backend/data/proyectos_seed.json).
_catalogo: list[dict[str, Any]] | None = None
_origen: str | None = None


def _cargar_catalogo() -> list[dict[str, Any]]:
    global _catalogo, _origen
    if _catalogo is None:
        _catalogo, ruta = resolver_catalogo(None)
        _origen = ruta.name
    return _catalogo


async def recomendar(senal: SenalBowl, top: int = 6) -> dict[str, Any]:
    """
    Devuelve el Top N de inmuebles para el lead, con match_score.

    Corre el modelo (CPU puro) en un hilo para no bloquear el event loop.
    Estructura de salida: {total_catalogo, origen_catalogo, recomendaciones}.
    """
    catalogo = _cargar_catalogo()
    usuario = senal.model_dump()

    recomendaciones = await asyncio.to_thread(
        recomendar_inmuebles, usuario, catalogo, top=top, con_desglose=True
    )
    return {
        "total_catalogo": len(catalogo),
        "origen_catalogo": _origen,
        "recomendaciones": recomendaciones,
    }
