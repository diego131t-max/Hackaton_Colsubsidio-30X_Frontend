"""
Puerto de clustering — backend <-> modelo de Santiago DS.

Pieza del sistema: BACKEND (core) <-> CLUSTERING (Santiago DS).

Define el PUERTO (interfaz) que el backend usa para agrupar/personalizar, y una
implementación MOCK determinística para que el pipeline end-to-end corra ya.
Santiago DS reemplaza el cuerpo por el modelo real; la firma y los tipos NO
deben cambiar sin avisar (el backend depende de ellos).

Contrato:
  predecir_cluster(señal: SenalBowl) -> ResultadoClustering
"""

from __future__ import annotations

from typing import Protocol

from backend.models.schemas import ResultadoClustering, SenalBowl


# --------------------------------------------------------------------------- #
# Puerto (interfaz) — permite intercambiar mock <-> modelo real sin tocar
# el código que lo llama (adaptabilidad / hexagonal).
# --------------------------------------------------------------------------- #
class ClusteringPort(Protocol):
    async def predecir(self, senal: SenalBowl) -> ResultadoClustering: ...


# --------------------------------------------------------------------------- #
# Adaptador MOCK — determinístico, para desarrollo y demo.
# --------------------------------------------------------------------------- #
class MockClustering:
    """
    Mock determinístico basado en tipo_vivienda + zona_interes.

    TODO (Santiago DS): reemplazar por la carga del modelo real
    (clustering/modelos/kmeans_v1.pkl vía clustering/src/predecir_cluster.py).
    Mantener EXACTAMENTE la firma `predecir(senal) -> ResultadoClustering`.
    """

    async def predecir(self, senal: SenalBowl) -> ResultadoClustering:
        cluster_id = f"{senal.tipo_vivienda}::{senal.zona_interes.strip().lower()}"
        # Recomendaciones mock según tipo de vivienda (placeholder).
        if senal.tipo_vivienda == "vis":
            proyectos = ["Ciudadela VIS Norte", "Torres del Parque VIS"]
        else:
            proyectos = ["Nuva Park", "Reserva del Bosque"]
        return ResultadoClustering(
            cluster_id=cluster_id, proyectos_recomendados=proyectos
        )


# Instancia por defecto que usa el backend. Para cambiar de adaptador, se
# sustituye esta referencia (inyección de dependencia sencilla).
_clustering: ClusteringPort = MockClustering()


async def predecir_cluster(senal: SenalBowl) -> ResultadoClustering:
    """Punto de entrada estable que consume `main.py`. Delegado al puerto."""
    return await _clustering.predecir(senal)
