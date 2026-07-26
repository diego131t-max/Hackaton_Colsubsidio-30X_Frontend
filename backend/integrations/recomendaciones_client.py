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
    Parametros,
    normalizar_texto,
    parsear_ingreso_mensual,
    recomendar_inmuebles,
    resolver_catalogo,
)

# Regla de asequibilidad Colsubsidio: la cuota mensual no debe superar el 40% del
# ingreso del hogar. Es la cifra que Manuela comunica como "cuota estimada".
RATIO_CUOTA_MAX = 0.40

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


def buscar_proyecto(nombre: str | None) -> dict[str, Any] | None:
    """Busca un proyecto del catálogo por nombre (tolerante a tildes/mayúsculas)."""
    if not nombre:
        return None
    objetivo = normalizar_texto(str(nombre))
    for proyecto in _cargar_catalogo():
        if normalizar_texto(str(proyecto.get("nombre_proyecto") or "")) == objetivo:
            return proyecto
    return None


def _estimar_subsidio(senal: SenalBowl, proyecto: dict[str, Any] | None, ingreso: float) -> int:
    """
    Estima el subsidio (el asesor confirma el monto exacto). Solo aplica a
    proyectos subsidiables y personas afiliadas; el no afiliado va a recuperación
    y su monto lo valida el asesor según el camino de afiliación.
    """
    if not proyecto or not proyecto.get("aplica_subsidio_caja"):
        return 0
    if senal.afiliado is not True:
        return 0
    tope = Parametros.SMMLV * Parametros.TOPE_SMMLV_SUBSIDIO  # 4 SMMLV
    # Estimado prudente en SMMLV; pleno bajo el tope de ingresos, parcial encima.
    return int(Parametros.SMMLV * (30 if ingreso <= tope else 20))


def estimar_finanzas(senal: SenalBowl, proyecto: dict[str, Any] | None) -> dict[str, int | None]:
    """
    Cifras REALES que Manuela comunica en la llamada, derivadas del proyecto
    elegido y del ingreso declarado:
      - valor_estimado_vivienda: precio real del proyecto (del catálogo).
      - cuota_estimada_mensual: 40% del ingreso del hogar (regla Colsubsidio).
      - subsidio_estimado: estimado según elegibilidad (0 si no aplica/no afiliado).
    Si no hay proyecto (p. ej. no afiliado sin cupo), valor/subsidio quedan None/0
    y Manuela difiere esas cifras al asesor.
    """
    ingreso = parsear_ingreso_mensual(senal.ingresos_hogar_rango)
    precio = int(proyecto["precio_desde_cop"]) if proyecto and proyecto.get("precio_desde_cop") else None
    return {
        "valor_estimado_vivienda": precio,
        "cuota_estimada_mensual": int(round(ingreso * RATIO_CUOTA_MAX)),
        "subsidio_estimado": _estimar_subsidio(senal, proyecto, ingreso),
    }
