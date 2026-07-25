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

## Flujo end-to-end

```
Bowl (SenalBowl)
  → POST /leads                      (responde 202 rápido, encola el pipeline)
  → rules_engine (H1–H10)            (pieza existente, no se toca)
  → clustering_client.predecir_cluster  → cluster_id + proyectos_recomendados
  → handoff_card.iniciar_ficha       (ficha inicial, aún sin Dapta)
  → dapta_client.disparar_llamada    (Dapta llama por fuera de nuestro sistema)
  ── Dapta califica por voz/WhatsApp ──
  → POST /webhooks/dapta/resultado   (ResultadoCalificacionDapta)
  → handoff_card.aplicar_resultado_dapta → FichaTraspaso final (campos sensibles)
```

## Puertos de integración (URLs a configurar externamente)

| Puerto | Dirección | Quién lo configura | Dónde |
|---|---|---|---|
| **Webhook de Flow Studio de Dapta** | Saliente (backend → Dapta) | **Juan** | Variable `DAPTA_FLOW_STUDIO_WEBHOOK_URL` (ver `.env.example`), usada en [`dapta_client.py`](backend/integrations/dapta_client.py). |
| **Webhook de resultado** | Entrante (Dapta → backend) | **Juan** | Endpoint `POST /webhooks/dapta/resultado` de este backend. La URL pública de este endpoint se pega en el "webhook de finalización" del agente de voz en el dashboard de Dapta. |

> **Pendiente de seguridad (documentado, no implementado en esta pasada):** el
> webhook de resultado hoy confía en el emisor. Antes de producción hay que
> verificar autenticidad (HMAC / secreto compartido `DAPTA_WEBHOOK_SECRET`),
> restringir CORS al frontend y añadir rate limiting a `/leads`. Ver los TODO en
> [`main.py`](backend/main.py) y `.env.example`.

## Puesta en marcha

```bash
# Backend (local)
pip install -r backend/requirements.txt
cp .env.example .env        # y rellenar (Dapta URL, Supabase, etc.)
uvicorn backend.main:app --reload        # docs interactivas en /docs
```

## Despliegue del backend (Render)

El repo trae un [`render.yaml`](render.yaml) (Blueprint). Pasos:

1. En Render → **New → Web Service** (o **Blueprint** para usar `render.yaml`), conecta este repo.
2. Si no usas el Blueprint: **Build** = `pip install -r backend/requirements.txt`,
   **Start** = `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`, **Health check** = `/health`.
3. Define las **env vars** en el dashboard de Render (las mismas de `.env.example`):
   `DAPTA_FLOW_STUDIO_WEBHOOK_URL`, `SUPABASE_URL`, `SUPABASE_KEY`,
   `DAPTA_WEBHOOK_SECRET` (opcional), `FRONTEND_ORIGIN`.
4. Cuando esté arriba, la URL del **webhook de resultado** para darle a Dapta (Nodo 9) es:
   `https://<tu-app>.onrender.com/webhooks/dapta/resultado`

Ese webhook valida el resultado y lo **escribe en Supabase**, así el dashboard lo
muestra en vivo por Realtime (correlación por `call_id`).

- **Backend:** FastAPI + Pydantic. Endpoints y contratos ya modelados; la lógica interna de cada pieza es stub/mock.
- **Frontend:** Node (recomendado Vite + React). `TODO`: dependencias reales en `frontend/package.json`.
- **Clustering:** Python (scikit-learn). `TODO`: modelo real en `clustering/src/` (el backend ya lo consume vía `clustering_client.py`).

Ver los `TODO` concretos dentro de cada archivo stub.
