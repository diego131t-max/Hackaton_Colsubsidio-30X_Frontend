"""
H9 — Ficha de traspaso al asesor humano.

Pieza del sistema: BACKEND (core / motor de reglas).

Combina motor de reglas + clustering + resultado de Dapta para armar la
FichaTraspaso (schemas.py) que recibe el asesor humano (pieza 5).

Flujo en dos tiempos:
  1. `iniciar_ficha(...)`   -> al recibir el bowl + clustering (aún sin Dapta).
  2. `aplicar_resultado_dapta(...)` -> cuando llega el webhook de Dapta, se
     completan calificación y campos SENSIBLES (ahorros, herencia, primas), que
     nunca existen antes de este punto.

IMPORTANTE: la lógica de calificación/probabilidad definida aquí es la fuente
de verdad ÚNICA, compartida con Dapta. No debe existir una segunda definición
en dapta_client.py.
"""

from __future__ import annotations

from uuid import UUID

from backend.models.schemas import (
    FichaTraspaso,
    ResultadoCalificacionDapta,
    ResultadoClustering,
    SenalBowl,
)


def iniciar_ficha(
    lead_id: UUID,
    senal: SenalBowl,
    clustering: ResultadoClustering,
) -> FichaTraspaso:
    """
    Arma la ficha inicial con lo que se sabe ANTES de la llamada de Dapta.

    TODO:
      - [ ] Poblar `beneficios_aplicables` según afiliación + reglas (rules_engine)
            + cruce de subsidio (external_mocks).
    """
    return FichaTraspaso(
        lead_id=lead_id,
        nombre_completo=f"{senal.nombre} {senal.apellido}",
        telefono_movil=senal.telefono_movil,
        cluster_id=clustering.cluster_id,
        proyectos_recomendados=clustering.proyectos_recomendados,
        beneficios_aplicables=[],  # TODO
        resumen="Ficha iniciada; pendiente resultado de calificación de Dapta.",
    )


def aplicar_resultado_dapta(
    ficha: FichaTraspaso,
    resultado: ResultadoCalificacionDapta,
) -> FichaTraspaso:
    """
    Completa la ficha con el resultado de Dapta. Aquí — y solo aquí — entran los
    campos SENSIBLES (ahorros, herencia, primas).

    TODO:
      - [ ] Derivar/validar la calificación final si combinamos reglas + Dapta
            (misma lógica que usa Dapta para "caliente", no inventar otra).
    """
    actualizada = ficha.model_copy(
        update={
            "calificacion_lead": resultado.calificacion_lead,
            "resultado_dapta": resultado,
            "resumen": resultado.resumen_llamada or ficha.resumen,
        }
    )
    return actualizada
