"""
Mocks de fuentes externas (cruces de datos) — H2.

Pieza del sistema: BACKEND (core).

En vez de PREGUNTARLE al usuario cosas que el Estado ya sabe (ej. si recibió
subsidios antes), el sistema las CONSULTA. Este módulo simula esos cruces
mientras no hay integración real. Es justo el problema que el reto busca
corregir: no repreguntar lo que ya se puede consultar (ver Bloque C en
backend/models/schemas.py).

TODOs:
  - [ ] Reemplazar por la integración real con Ministerio de Vivienda / SISBEN
        cuando esté disponible.
  - [ ] Definir la clave de cruce (numero_identificacion) y el manejo de "no
        encontrado".
"""

from __future__ import annotations


async def consulto_subsidio_previo(numero_identificacion: str) -> bool:
    """
    MOCK: indica si la persona ya recibió un subsidio de vivienda antes.

    TODO: cruce real con Ministerio de Vivienda. Por ahora, mock determinístico.
    """
    # Mock inofensivo: nadie tiene subsidio previo hasta integrar la fuente real.
    return False
