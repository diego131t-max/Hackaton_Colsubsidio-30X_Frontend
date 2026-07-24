# Reto Vivienda Colsubsidio x 30X

Sistema para capturar señales de leads de vivienda (bowl), aplicar un motor de
reglas, contactar y calificar automáticamente con Dapta AI, personalizar
recomendaciones con clustering, y entregar una ficha de traspaso al asesor humano.

> Monorepo: por ahora frontend + backend + clustering + integración Dapta viven
> en este mismo repositorio.

## Arquitectura (las 5 piezas)

```
Frontend (bowl)  ──POST /leads──►  Backend de señales y reglas (H1–H10)
                                        │            │
                                    dispara       batch/offline
                                        ▼            ▼
                                  Dapta AI      Clustering
                                        │            │
                                        └────► Asesor humano (ficha de traspaso)
```

## Organización del repo — quién es dueño de qué

| Carpeta | Dueño | Contenido |
|---|---|---|
| [`frontend/`](frontend/) | **Carlos** | El bowl: captura de señales y POST al backend. |
| [`backend/`](backend/) | **Backend de reglas** (base existente) | Valida el contrato, motor de reglas H1–H10, orquesta Dapta y clustering. |
| [`backend/integrations/dapta_client.py`](backend/integrations/dapta_client.py) | **Juan** | Disparo de llamada y webhook de retorno de Dapta. |
| [`clustering/`](clustering/) | **Santiago DS** | Entrenamiento y predicción de clusters (offline). |
| [`docs/`](docs/) | Equipo | Contrato de datos, integración Dapta, diagnóstico. |

**Lo único verdaderamente bloqueante es el contrato de datos.** Todo lo demás se
construye en paralelo si ese contrato está fijo desde el inicio.

## Contrato de datos (resumen de 3 líneas)

El frontend arma un objeto `PerfilLead` (lead_id, identificación, afiliación,
financiero, preferencias y señales de comportamiento) y lo hace POST al backend.
Está validado con Pydantic en [`backend/models/schemas.py`](backend/models/schemas.py)
y documentado en [`docs/contrato-de-datos.md`](docs/contrato-de-datos.md).
**Regla de oro:** nadie agrega un campo al contrato sin avisar al grupo primero.

## Puesta en marcha (pendiente)

- **Backend:** Python + Pydantic (framework recomendado: FastAPI). `TODO`: `requirements.txt` / entorno.
- **Frontend:** Node (recomendado Vite + React). `TODO`: dependencias reales en `frontend/package.json`.
- **Clustering:** Python (scikit-learn). `TODO`: pipeline en `clustering/src/entrenar.py`.

Ver los `TODO` concretos dentro de cada archivo stub.
