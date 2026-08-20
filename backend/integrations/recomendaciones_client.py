"""
Adaptador del backend hacia el MODELO DE RECOMENDACIONES de Santiago.

Pieza del sistema: BACKEND (core) <-> MODELO DE RECOMENDACIONES.

MOTOR v2 (modelo_recomendaciones/motor/)
---------------------------------------
Sustituye al scoring por reglas anterior. El pipeline real es:

    primer_filtro   filtro duro (tipo de vivienda, localidad, zonas, alcobas)
                    con ESCALERA DE RELAJACION y expansion por grafo de
                    localidades vecinas hasta reunir 10 candidatos
    modelo          Nearest Neighbors en dos modos: contenido (perfil objetivo
                    de cada proyecto) + colaborativo (vecinos en el historial)
    post_arreglos   normalizacion comercial del score a un porcentaje legible

Este modulo NO reimplementa nada de eso: traduce SenalBowl -> las estructuras
que el motor espera, y su salida -> el contrato que ya consumen main.py, el
formulario y la ficha del asesor.

POR QUE SIGUE VIVO recomendaciones.py (motor v1)
------------------------------------------------
Solo por las REGLAS FINANCIERAS: `Parametros` (SMMLV, topes de subsidio) y
`parsear_ingreso_mensual`. Son las cifras que Manuela dice por telefono, no
tienen nada que ver con el ranking, y estaban probadas. Reescribirlas de paso
habria mezclado dos cambios en uno.
"""

from __future__ import annotations

import asyncio
import sys
import zlib
from pathlib import Path
from typing import Any

from backend.models.schemas import SenalBowl

_RAIZ = Path(__file__).resolve().parents[2]
_MODELO_DIR = _RAIZ / "modelo_recomendaciones"
_MOTOR_DIR = _MODELO_DIR / "motor"
for _ruta in (_MOTOR_DIR, _MODELO_DIR):
    if str(_ruta) not in sys.path:
        sys.path.insert(0, str(_ruta))

from recomendaciones import (  # noqa: E402
    Parametros,
    normalizar_texto,
    parsear_ingreso_mensual,
)

from catalogos import (  # noqa: E402
    codigo_tipo_vivienda,
    indice_localidad,
    mapear_zonas,
)
from modelo import (  # noqa: E402
    ALPHA_HISTORIAL,
    PESOS_SCORE,
    _cargar_proyectos,
    modelo as correr_modelo,
    post_arreglos,
    primer_filtro,
)
from prep import rango_salario  # noqa: E402

class ZonaDesconocida(ValueError):
    """La zona del formulario no corresponde a ninguna localidad de Bogota."""


RATIO_CUOTA_MAX = 0.40

# El motor exige 1..3, donde 3 significa "3 o mas". El formulario ya manda '3+'
# como 3, pero un cliente viejo podria mandar 4: se recorta en vez de reventar.
HABITACIONES_POR_DEFECTO = 2

_catalogo: list[dict[str, Any]] | None = None


def _cargar_catalogo() -> list[dict[str, Any]]:
    """Catalogo enriquecido del motor (proyectos_model.json), cargado una vez."""
    global _catalogo
    if _catalogo is None:
        _catalogo = _cargar_proyectos()
    return _catalogo


def _banda_salario(senal: SenalBowl) -> int:
    """
    Traduce el rango de ingreso del formulario al codigo 1..4 del motor.

    Se reutiliza `rango_salario` de prep.py a proposito: es la MISMA funcion con
    la que se calculo `salario_objetivo` de cada proyecto. Reimplementar las
    bandas aqui las desalinearia del catalogo en cuanto una cambie.
    """
    ingreso = parsear_ingreso_mensual(senal.ingresos_hogar_rango)
    return rango_salario(ingreso / Parametros.SMMLV)


def _a_entrada_motor(senal: SenalBowl) -> tuple[dict, dict]:
    """SenalBowl -> (usuario_modelo, usuario_segmentado)."""
    habitaciones = senal.numero_habitaciones or HABITACIONES_POR_DEFECTO
    habitaciones = min(3, max(1, int(habitaciones)))

    localidad = indice_localidad(senal.zona_interes)
    if localidad is None:
        # El filtro duro no puede anclar la busqueda sin localidad. Se avisa con
        # ZonaDesconocida y NO se inventa una: elegir "la primera con oferta"
        # produciria recomendaciones plausibles pero falsas, que es peor que no
        # recomendar. `recomendar` lo traduce en una lista vacia, y el prompt de
        # Manuela ya sabe manejar un proyecto_recomendado vacio: difiere al asesor.
        raise ZonaDesconocida(str(senal.zona_interes))

    zonas_idx, _ = mapear_zonas(senal.entorno_deseado or [])

    usuario_modelo = {
        "salario": _banda_salario(senal),
        # El motor valida 1..4; el formulario permite 0 (vive solo).
        "personas_a_cargo": min(4, max(1, int(senal.personas_a_cargo or 1))),
        "edad": int(senal.edad),
    }
    usuario_segmentado = {
        "tipo_vivienda": codigo_tipo_vivienda(senal.tipo_vivienda),
        "localidad": localidad,
        "zonas_comunes": zonas_idx,
        "numero_habitaciones": habitaciones,
    }
    return usuario_modelo, usuario_segmentado


def _desglose(proyecto: dict[str, Any], total_mostrado: float) -> dict[str, float]:
    """
    Reparte el porcentaje mostrado entre los componentes REALES del score.

    El motor produce dos numeros distintos: el score crudo (0..1) que ordena, y
    el porcentaje comercial de `post_arreglos` (62..98) que es el que ve la
    persona. La barra de la ficha muestra el segundo, asi que los componentes se
    reescalan para sumar exactamente ese numero. Las PROPORCIONES se conservan
    intactas, que es lo que el asesor necesita leer: de donde sale el match.
    """
    hay_historial = bool(proyecto.get("score_historial"))
    peso_modelo = PESOS_SCORE["modelo"]
    peso_perfil = peso_modelo * ((1 - ALPHA_HISTORIAL) if hay_historial else 1.0)

    crudo = {
        "perfil": peso_perfil * float(proyecto.get("score_afinidad_perfil", 0.0)),
        "historial": (peso_modelo * ALPHA_HISTORIAL
                      * float(proyecto.get("score_historial", 0.0))),
        "zonas": PESOS_SCORE["zonas"] * float(proyecto.get("score_zonas", 0.0)),
        "localidad": PESOS_SCORE["localidad"] * float(proyecto.get("score_localidad", 0.0)),
    }
    suma = sum(crudo.values())
    if suma <= 0:
        return {k: 0.0 for k in crudo}
    factor = total_mostrado / suma
    return {k: round(v * factor, 2) for k, v in crudo.items()}


def _a_salida(proyecto: dict[str, Any]) -> dict[str, Any]:
    """Proyecto del motor -> el contrato que ya consumen main.py y el dashboard."""
    # post_arreglos lo llama porcentaje_compatibilidad; el nombre "compatibilidad"
    # solo aparece en el reporte que arma su main.py.
    score = float(proyecto.get("porcentaje_compatibilidad") or 0.0)
    tipo = str(proyecto.get("tipo_vivienda") or "")
    return {
        **proyecto,
        "nombre_proyecto": proyecto.get("nombre_proyecto"),
        "match_score": score,
        "match_desglose": _desglose(proyecto, score),
        "precio_desde_cop": proyecto.get("precio_desde_cop"),
        # El motor devuelve 'VIS'/'No VIS' y 'Bosa'; el resto del sistema (y las
        # 111 filas que ya estan en Supabase) usan 'vis'/'no_vis' y 'bosa'.
        "tipo_vivienda": "vis" if normalizar_texto(tipo) == "vis" else "no_vis",
        "zona_interes": normalizar_texto(str(proyecto.get("localidad") or "")),
        "url_ficha": proyecto.get("url_ficha"),
    }


def _semilla_estable(usuario_modelo: dict, usuario_segmentado: dict) -> int:
    """
    Semilla determinista derivada del perfil del lead.

    `post_arreglos` sortea el porcentaje del primer proyecto entre 85 y 98. Sin
    fijar la semilla, el MISMO lead veria un match distinto cada vez que se
    recalcula: el formulario diria 91%, la ficha del asesor 86%, y el asesor
    quedaria explicando un numero que se mueve solo. Con el perfil como semilla
    el porcentaje es estable para esa persona y sigue variando entre personas.
    """
    firma = (
        usuario_modelo["salario"], usuario_modelo["personas_a_cargo"],
        usuario_modelo["edad"], usuario_segmentado["tipo_vivienda"],
        usuario_segmentado["localidad"], usuario_segmentado["numero_habitaciones"],
        tuple(usuario_segmentado["zonas_comunes"]),
    )
    return zlib.crc32(repr(firma).encode())


def _recomendar_sync(senal: SenalBowl, top: int) -> list[dict[str, Any]]:
    usuario_modelo, usuario_segmentado = _a_entrada_motor(senal)
    preseleccionados = primer_filtro(usuario_segmentado)
    seleccionados = correr_modelo(preseleccionados, usuario_modelo, top_n=top)
    # ruta_salida=None: post_arreglos escribe un JSON de reporte que aqui no
    # queremos (el backend no debe tocar disco en cada request).
    llamativos = post_arreglos(
        seleccionados,
        semilla=_semilla_estable(usuario_modelo, usuario_segmentado),
        ruta_salida=None,
    )
    return [_a_salida(p) for p in llamativos]


async def recomendar(senal: SenalBowl, top: int = 6) -> dict[str, Any]:
    """
    Devuelve el Top N de inmuebles para el lead, con match_score.

    Corre el motor (CPU puro, sklearn) en un hilo para no bloquear el event loop.
    Estructura de salida: {total_catalogo, origen_catalogo, recomendaciones}.
    """
    try:
        recomendaciones = await asyncio.to_thread(_recomendar_sync, senal, top)
        motivo = None
    except ZonaDesconocida as e:
        # Capturar el lead vale mas que recomendarle algo: se sigue adelante sin
        # recomendaciones en vez de devolver un 500 y perder la persona.
        recomendaciones, motivo = [], f"zona no reconocida: {e}"

    return {
        "total_catalogo": len(_cargar_catalogo()),
        "origen_catalogo": "proyectos_model.json",
        "recomendaciones": recomendaciones,
        "sin_recomendaciones_motivo": motivo,
    }


def buscar_proyecto(nombre: str | None) -> dict[str, Any] | None:
    """Busca un proyecto del catalogo por nombre (tolerante a tildes/mayusculas)."""
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
    proyectos subsidiables y personas afiliadas; el no afiliado va a recuperacion
    y su monto lo valida el asesor segun el camino de afiliacion.
    """
    if not proyecto or not proyecto.get("aplica_subsidio_caja"):
        return 0
    if senal.afiliado is not True:
        return 0
    tope = Parametros.SMMLV * Parametros.TOPE_SMMLV_SUBSIDIO
    return int(Parametros.SMMLV * (30 if ingreso <= tope else 20))


def estimar_finanzas(senal: SenalBowl, proyecto: dict[str, Any] | None) -> dict[str, int | None]:
    """
    Cifras REALES que Manuela comunica en la llamada, derivadas del proyecto
    elegido y del ingreso declarado:
      - valor_estimado_vivienda: precio real del proyecto (del catalogo).
      - cuota_estimada_mensual: 40% del ingreso del hogar (regla Colsubsidio).
      - subsidio_estimado: estimado segun elegibilidad (0 si no aplica/no afiliado).
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
