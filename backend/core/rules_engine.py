"""
H2 — Motor de reglas.

Pieza del sistema: BACKEND (core / motor de reglas).

Aplica las reglas de negocio sobre el perfil del lead:
  - Regla del 40% (cuota vs. ingreso).
  - Bandas de precio según ingreso_estimado_numerico.

TODOs:
  - [ ] Implementar regla 40%: cuota mensual estimada <= 40% del ingreso.
  - [ ] Definir bandas de precio y mapearlas a rangos de ingreso.
  - [ ] Devolver un resultado estructurado (elegible / rango de precio / motivo)
        que consuman project_recommender.py y handoff_card.py.
"""

from __future__ import annotations

from backend.models.schemas import PerfilLead


def evaluar_reglas(lead: PerfilLead) -> dict:
    """
    Evalúa el perfil contra las reglas de negocio y devuelve el resultado.

    TODO: implementar regla 40% y bandas de precio.
    """
    raise NotImplementedError("evaluar_reglas: lógica de reglas pendiente.")
