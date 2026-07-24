"""
H5 — Recomendador de proyectos.

Pieza del sistema: BACKEND (core / motor de reglas).

A partir del resultado del motor de reglas (banda de precio elegible) y las
preferencias del lead (zona, personas a cargo), sugiere proyectos de vivienda
compatibles. Puede enriquecerse con las recomendaciones del clustering.

TODOs:
  - [ ] Cargar el catálogo de proyectos (VIS / No VIS) y sus atributos.
  - [ ] Filtrar por banda de precio elegible (viene de rules_engine).
  - [ ] Ordenar por afinidad con preferencias (zona_interes, personas_a_cargo).
  - [ ] Combinar con la salida de clustering_client para personalizar.
"""

from __future__ import annotations

from backend.models.schemas import PerfilLead


def recomendar_proyectos(lead: PerfilLead, resultado_reglas: dict) -> list[str]:
    """
    Devuelve una lista ordenada de proyectos recomendados para el lead.

    TODO: implementar el filtrado y ranking real.
    """
    raise NotImplementedError("recomendar_proyectos: lógica pendiente.")
