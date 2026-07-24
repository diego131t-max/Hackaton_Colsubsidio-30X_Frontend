"""
Cliente de clustering — NUEVO.

Pieza del sistema: BACKEND (core) <-> CLUSTERING (Santiago DS).

Puente entre el backend de reglas y el modelo de clustering de Santiago. El
modelo corre offline y expone `predecir_cluster` (clustering/src/predecir_cluster.py);
este cliente lo importa/llama y traduce la salida a algo que el core consuma
(personalización de recomendaciones).

TODOs:
  - [ ] Acordar con Santiago la firma exacta de predecir_cluster (features de
        entrada = subconjunto del contrato de datos).
  - [ ] Decidir integración: import directo del .pkl vs. microservicio.
  - [ ] Cargar el modelo una sola vez (no en cada request).
  - [ ] Manejar el caso "modelo no disponible" con un fallback seguro.
"""

from __future__ import annotations

from backend.models.schemas import PerfilLead


def predecir_cluster(lead: PerfilLead) -> str | None:
    """
    Devuelve el cluster asignado al lead (o None si el modelo no está listo).

    TODO: llamar al modelo real de clustering/src/predecir_cluster.py.
    """
    raise NotImplementedError("predecir_cluster: integración con DS pendiente.")
