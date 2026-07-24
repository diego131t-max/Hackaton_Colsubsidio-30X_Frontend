"""
H1 — Lookup de afiliación.

Pieza del sistema: BACKEND (core / motor de reglas).

Determina la categoría de afiliación del lead. NOVEDAD respecto al MVP anterior:
ahora son 3 categorías, no 2 (ver TipoAfiliacion en schemas.py):
  - afiliado_trabajador
  - beneficiario
  - no_afiliado

El objetivo de H1 es NO repreguntar lo que ya sabemos: si el lead ya es
afiliado, ni el backend ni Dapta deben volver a preguntarlo.

TODOs:
  - [ ] Definir la fuente de verdad de afiliación (base histórica / servicio
        de Colsubsidio). ¿Consulta por numero_identificacion?
  - [ ] Manejar el caso "declara ser afiliado pero no aparece en la base".
  - [ ] Cachear resultados para no consultar la fuente en cada paso del bowl.
"""

from __future__ import annotations

from backend.models.schemas import PerfilLead, TipoAfiliacion


def resolver_afiliacion(lead: PerfilLead) -> TipoAfiliacion:
    """
    Devuelve la categoría de afiliación confirmada del lead.

    TODO: reemplazar el eco del valor declarado por una consulta real a la
    fuente de verdad de Colsubsidio.
    """
    raise NotImplementedError("resolver_afiliacion: lookup real pendiente.")
