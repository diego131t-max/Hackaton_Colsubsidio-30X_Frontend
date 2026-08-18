#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera el bloque de catálogo que va dentro del prompt de Manuela.

    python dapta/tools/generar_catalogo_prompt.py > dapta/nucleo/catalogo-proyectos.md

POR QUÉ EXISTE
--------------
El catálogo de 31 proyectos estaba transcrito A MANO dentro del prompt. Eso
garantiza divergencia: en cuanto cambie un precio en backend/data/proyectos_seed.json
—o entre un proyecto nuevo— el agente sigue diciendo la cifra vieja por teléfono,
y nadie se entera hasta que un cliente lo reclama.

Aquí se genera desde la MISMA fuente que usa el modelo de recomendaciones, así
que lo que Manuela dice y lo que el sistema recomienda no pueden contradecirse.

Si el seed cambia, se vuelve a correr esto y se actualiza el prompt del agente.
"""

from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
SEED = RAIZ / "backend" / "data" / "proyectos_seed.json"

# El seed guarda la zona como slug ("antonio_narino"); en voz debe sonar humano.
ZONAS = {
    "antonio_narino": "Antonio Nariño", "barrios_unidos": "Barrios Unidos",
    "bosa": "Bosa", "chapinero": "Chapinero", "engativa": "Engativá",
    "fontibon": "Fontibón", "los_martires": "Los Mártires",
    "puente_aranda": "Puente Aranda", "san_cristobal": "San Cristóbal",
    "santa_fe": "Santa Fe", "suba": "Suba", "usaquen": "Usaquén", "usme": "Usme",
}


def pesos(valor: int | None) -> str:
    if not valor:
        return "precio por confirmar con el asesor"
    return "$" + f"{int(valor):,}".replace(",", ".")


def habitaciones(lista: list[int]) -> str:
    if not lista:
        return "número de habitaciones por confirmar"
    if len(lista) == 1:
        return f"{lista[0]} habitación" if lista[0] == 1 else f"{lista[0]} habitaciones"
    return " o ".join(str(x) for x in lista) + " habitaciones"


def main() -> int:
    proyectos = json.loads(SEED.read_text(encoding="utf-8"))
    # Orden alfabético SIN tildes: con el orden por defecto "Álamo" cae después
    # de "Vibo" (la Á tiene un code point mayor que la Z) y la lista se lee rara.
    def sin_tildes(t: str) -> str:
        return "".join(
            c for c in unicodedata.normalize("NFD", t)
            if unicodedata.category(c) != "Mn"
        ).lower()

    proyectos.sort(key=lambda p: sin_tildes(p["nombre_proyecto"]))

    print("<!-- GENERADO por dapta/tools/generar_catalogo_prompt.py — no editar a mano. -->")
    print("<!-- Fuente: backend/data/proyectos_seed.json (la misma que usa el modelo). -->")
    print()
    print("Catálogo real de Colsubsidio. Precios \"desde\". Guíate por")
    print("{{proyecto_recomendado}}; usa la lista para dar detalles o si preguntan por")
    print("un proyecto puntual.")
    print()

    for p in proyectos:
        zona = ZONAS.get(p.get("zona_interes", ""), p.get("zona_interes", "Bogotá"))
        area = p.get("area_construida_m2")
        subsidio = "con subsidio de caja" if p.get("aplica_subsidio_caja") else "sin subsidio de caja"
        amenidades = ", ".join(p.get("amenidades_entorno") or []) or "sin amenidades publicadas"
        linea = (
            f"- {p['nombre_proyecto']} ({zona}): desde {pesos(p.get('precio_desde_cop'))}, "
            f"{area} metros cuadrados, {habitaciones(p.get('habitaciones_ofrecidas') or [])}, "
            f"{subsidio}. Amenidades: {amenidades}."
        )
        print(linea)

    print()
    print("Si te preguntan por un proyecto que no está en esta lista, no lo afirmes: di")
    print("que el asesor tiene el detalle completo de la oferta disponible. Menciona")
    print("amenidades solo del proyecto por el que te preguntan o del recomendado; no las")
    print("mezcles entre proyectos.")

    print(f"\n<!-- {len(proyectos)} proyectos -->", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
