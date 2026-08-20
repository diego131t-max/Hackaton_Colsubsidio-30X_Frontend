#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Regenera modelo_recomendaciones/motor/proyectos_model.json.

    python modelo_recomendaciones/tools/regenerar_modelo.py

POR QUE EXISTE ESTE SCRIPT
--------------------------
prep.py toma por defecto un `proyectos_seed.json` que viva junto a el. Dejar esa
copia dentro de motor/ crearia un TERCER catalogo (frontend, backend y motor) y
ya sabemos como termina eso: la vez pasada el backend se quedo sin amenidades
durante semanas sin que nada fallara, solo recomendaba peor.

Aqui la fuente es una sola: frontend/data/proyectos_seed.json, el scrapeo real.
Hay que correrlo cada vez que cambie ese archivo.
"""

from __future__ import annotations

import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
MOTOR = RAIZ / "modelo_recomendaciones" / "motor"
SEED = RAIZ / "frontend" / "data" / "proyectos_seed.json"
SALIDA = MOTOR / "proyectos_model.json"

sys.path.insert(0, str(MOTOR))
from prep import preparar  # noqa: E402


def main() -> int:
    if not SEED.exists():
        print(f"ABORTADO: no existe el seed {SEED}")
        return 1
    print(f"seed  : {SEED.relative_to(RAIZ)}")
    print(f"salida: {SALIDA.relative_to(RAIZ)}\n")
    preparar(ruta_seed=str(SEED), ruta_salida=str(SALIDA), verbose=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
