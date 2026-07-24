"""
H10 — Tracker de cupos (regla 90/10).

Pieza del sistema: BACKEND (core / motor de reglas).

Controla la disponibilidad de cupos por proyecto aplicando la regla 90/10
(reservar/priorizar según la política definida). Evita recomendar o traspasar
leads a proyectos sin cupo real.

TODOs:
  - [ ] Precisar la semántica exacta de la regla 90/10 con negocio.
  - [ ] Definir la fuente de cupos (base de datos / servicio de inventario).
  - [ ] Exponer consulta de disponibilidad para project_recommender.py.
  - [ ] Manejar concurrencia si varios leads compiten por el mismo cupo.
"""

from __future__ import annotations


def hay_cupo(proyecto: str) -> bool:
    """
    Indica si el proyecto tiene cupo disponible bajo la regla 90/10.

    TODO: implementar consulta real de inventario.
    """
    raise NotImplementedError("hay_cupo: tracker de cupos pendiente.")
