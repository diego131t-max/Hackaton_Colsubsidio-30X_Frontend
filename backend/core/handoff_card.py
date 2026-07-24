"""
H9 — Ficha de traspaso al asesor humano.

Pieza del sistema: BACKEND (core / motor de reglas).

Combina motor de reglas + recomendador + clustering + resultado de Dapta para
armar la FichaTraspaso (schemas.py) que recibe el asesor humano (pieza 5):
probabilidad de cierre, proyecto recomendado, beneficios y resumen.

IMPORTANTE: la lógica de `probabilidad_cierre` definida aquí es la MISMA que
usa Dapta para decidir cuándo un lead está "caliente". No debe existir una
segunda definición en dapta_client.py — ambos consumen esta.

TODOs:
  - [ ] Definir el cálculo de probabilidad_cierre (features + umbral).
  - [ ] Mapear beneficios aplicables según afiliación y reglas.
  - [ ] Generar el resumen de calificación legible para el asesor.
"""

from __future__ import annotations

from backend.models.schemas import FichaTraspaso, PerfilLead


def calcular_probabilidad_cierre(lead: PerfilLead, resultado_reglas: dict) -> float:
    """
    Probabilidad [0, 1] de cierre. Fuente de verdad única, compartida con Dapta.

    TODO: definir features y umbral junto con el equipo.
    """
    raise NotImplementedError("calcular_probabilidad_cierre: pendiente.")


def construir_ficha(
    lead: PerfilLead,
    resultado_reglas: dict,
    proyectos_recomendados: list[str],
    cluster: str | None = None,
) -> FichaTraspaso:
    """
    Ensambla la FichaTraspaso final para el asesor humano.

    TODO: completar con probabilidad, beneficios y resumen reales.
    """
    raise NotImplementedError("construir_ficha: ensamblaje pendiente.")
