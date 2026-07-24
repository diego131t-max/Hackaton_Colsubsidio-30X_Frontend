"""
Entrenamiento del modelo de clustering.

Pieza del sistema: CLUSTERING (Santiago DS).

Entrena el modelo (p. ej. KMeans) sobre la base histórica y lo serializa en
clustering/modelos/ (kmeans_v1.pkl). Es la pieza más AISLADA del sistema:
arranca con la base histórica y no bloquea a nadie.

TODOs:
  - [ ] Cargar y limpiar la base histórica.
  - [ ] Seleccionar features (subconjunto del contrato de datos, sección 4).
  - [ ] Elegir k y validar (silueta / codo).
  - [ ] Serializar el modelo a clustering/modelos/kmeans_v1.pkl.
  - [ ] Versionar el modelo (v1, v2, ...) para trazabilidad.
"""

from __future__ import annotations


def entrenar() -> None:
    """Entrena y serializa el modelo de clustering. TODO: implementar."""
    raise NotImplementedError("entrenar: pipeline de entrenamiento pendiente.")


if __name__ == "__main__":
    entrenar()
