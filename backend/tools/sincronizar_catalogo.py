#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Publica el catálogo REAL (frontend/data/proyectos_seed.json) en el esquema que
consume el backend (backend/data/proyectos_seed.json).

    python backend/tools/sincronizar_catalogo.py            # escribe el seed
    python backend/tools/sincronizar_catalogo.py --dry-run  # solo reporta

POR QUÉ EXISTE
--------------
`frontend/tools/generar_seed_backend.py` baja los proyectos de colsubsidio.com y
deja el resultado en `frontend/data/`. Ese archivo nunca se copió a `backend/data/`,
así que el backend quedó recomendando sobre un catálogo con
`amenidades_entorno: []` en los 31 proyectos.

Eso NO es cosmético: `PESO_ENTORNO` son 50 de los 100 puntos del score
(modelo_recomendaciones/recomendaciones.py). Sin amenidades, `puntuar_entorno`
cae siempre al RATIO_ENTORNO_NEUTRO — el mismo valor para todos los inmuebles —
y la mitad del modelo deja de discriminar en silencio. Los empates se rompen por
precio, no por afinidad, y Manuela habla de un proyecto elegido casi al azar.

LAS DOS TRANSFORMACIONES (por las que esto no es un `cp`)
--------------------------------------------------------
El catálogo del frontend trae `localidad` con etiqueta humana ("Antonio Nariño")
y no trae `pisos_disponibles`. El backend necesita:

  zona_interes       <- normalizar_texto(localidad)   "Antonio Nariño" -> "antonio_narino"
  pisos_disponibles  <- [1, 2, 3]

Ambos campos son FILTRO ESTRICTO en `recomendar_inmuebles`: un proyecto cuya
zona no cruce, o cuyos pisos no incluyan el preferido, no entra al ranking. Por
eso se reusa `normalizar_texto` del propio modelo en vez de slugificar a mano:
si el criterio de comparación cambia allá, este script lo sigue sin desviarse.

`pisos_disponibles = [1, 2, 3]` conserva el valor que ya tenían los 31 proyectos
del seed anterior. Es un supuesto heredado, no un dato de la ficha oficial: el
sitio no publica en qué pisos hay unidades disponibles. Al aceptar los tres
niveles, el filtro de piso no descarta a nadie — que es el comportamiento actual
y el prudente, porque descartar por un dato inventado sería peor que no filtrar.

QUÉ NO HACE
-----------
No inventa amenidades ni corrige el catálogo de origen. Si un proyecto viene sin
amenidades desde colsubsidio.com, sale sin amenidades y el reporte lo dice.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
ORIGEN = RAIZ / "frontend" / "data" / "proyectos_seed.json"
DESTINO = RAIZ / "backend" / "data" / "proyectos_seed.json"

# Se reusa el normalizador del modelo: es el mismo que aplica el filtro de zona
# en tiempo de recomendación, así que garantiza el cruce por construcción.
sys.path.insert(0, str(RAIZ / "modelo_recomendaciones"))
from recomendaciones import normalizar_texto  # noqa: E402

# Todos los proyectos del seed anterior traían estos tres niveles. Ver el
# encabezado: es un supuesto heredado que deja el filtro de piso inocuo.
PISOS_POR_DEFECTO = [1, 2, 3]

# Orden de claves del seed que el backend ya sabe leer. Se respeta para que el
# diff contra el archivo anterior sea legible y no un reordenamiento completo.
ORDEN_CLAVES = [
    "id_proyecto", "nombre_proyecto", "tipo_vivienda", "zona_interes",
    "direccion", "precio_desde_cop", "area_construida_m2",
    "habitaciones_ofrecidas", "pisos_disponibles", "amenidades_entorno",
    "aplica_subsidio_caja", "url_ficha",
]


def a_esquema_backend(proyecto: dict) -> dict:
    """Un proyecto del catálogo del frontend -> el esquema del backend."""
    salida = {
        "id_proyecto": proyecto["id_proyecto"],
        "nombre_proyecto": proyecto["nombre_proyecto"],
        "tipo_vivienda": proyecto["tipo_vivienda"],
        "zona_interes": normalizar_texto(str(proyecto.get("localidad") or "")),
        "direccion": proyecto.get("direccion"),
        "precio_desde_cop": proyecto.get("precio_desde_cop"),
        "area_construida_m2": proyecto.get("area_construida_m2"),
        "habitaciones_ofrecidas": proyecto.get("habitaciones_ofrecidas") or [],
        "pisos_disponibles": list(PISOS_POR_DEFECTO),
        "amenidades_entorno": proyecto.get("amenidades_entorno") or [],
        "aplica_subsidio_caja": bool(proyecto.get("aplica_subsidio_caja")),
        # El modelo devuelve COPIAS del inmueble completo, así que este enlace
        # viaja hasta la respuesta de /recomendaciones: el formulario y la ficha
        # del asesor pueden linkear a la ficha oficial sin otra fuente de datos.
        "url_ficha": proyecto.get("url_ficha"),
    }
    return {k: salida[k] for k in ORDEN_CLAVES if k in salida}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true",
                    help="reporta el resultado sin escribir el archivo")
    args = ap.parse_args()

    if not ORIGEN.exists():
        print("ABORTADO: no existe el catálogo de origen %s" % ORIGEN)
        return 1

    origen = json.loads(ORIGEN.read_text(encoding="utf-8"))
    proyectos = [a_esquema_backend(p) for p in origen]

    # Un proyecto sin zona no cruza NUNCA con el formulario (filtro estricto):
    # es un proyecto invisible. Se aborta en vez de publicar un catálogo mudo.
    sin_zona = [p["nombre_proyecto"] for p in proyectos if not p["zona_interes"]]
    if sin_zona:
        print("ABORTADO: %d proyecto(s) sin zona_interes: %s"
              % (len(sin_zona), ", ".join(sin_zona)))
        return 1

    anterior = (json.loads(DESTINO.read_text(encoding="utf-8"))
                if DESTINO.exists() else [])
    zonas_antes = {p.get("zona_interes") for p in anterior}
    zonas_ahora = {p["zona_interes"] for p in proyectos}

    con_amenidades = sum(1 for p in proyectos if p["amenidades_entorno"])
    media = sum(len(p["amenidades_entorno"]) for p in proyectos) / max(1, len(proyectos))

    print("origen : %s (%d proyectos)" % (ORIGEN.relative_to(RAIZ), len(origen)))
    print("destino: %s (%d proyectos antes)" % (DESTINO.relative_to(RAIZ), len(anterior)))
    print("  con amenidades: %d/%d (media %.1f)" % (con_amenidades, len(proyectos), media))
    print("  zonas: %d" % len(zonas_ahora))
    if zonas_ahora != zonas_antes:
        # Cambiar el set de zonas mueve el filtro estricto: leads que antes
        # cruzaban pueden dejar de hacerlo. Se avisa siempre.
        print("  OJO: el set de zonas cambió respecto al seed anterior")
        print("       nuevas : %s" % (sorted(zonas_ahora - zonas_antes) or "-"))
        print("       perdidas: %s" % (sorted(zonas_antes - zonas_ahora) or "-"))

    sin_amenidades = [p["nombre_proyecto"] for p in proyectos if not p["amenidades_entorno"]]
    if sin_amenidades:
        print("  sin amenidades en el origen (no se inventan): %s"
              % ", ".join(sin_amenidades))

    if args.dry_run:
        print("--dry-run: no se escribió nada.")
        return 0

    DESTINO.write_text(
        json.dumps(proyectos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("escrito %s" % DESTINO.relative_to(RAIZ))
    return 0


if __name__ == "__main__":
    sys.exit(main())
