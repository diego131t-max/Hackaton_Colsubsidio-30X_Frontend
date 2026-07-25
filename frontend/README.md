# Frontend — Reto Vivienda Colsubsidio × 30X

El "bowl": una landing gamificada (quiz de preguntas → construye una casa en
vista de planta → recomienda hasta 3 proyectos reales) que termina haciendo
`POST /leads` al backend con el contrato `SenalBowl`.

## Stack

HTML/CSS/JS **vanilla, sin build step** (no Vite/webpack/framework). El
`package.json` solo trae un script de conveniencia para levantar un servidor
estático:

```bash
npm run dev   # sirve esta carpeta en http://localhost:5500
```

También puedes abrir `index.html` con cualquier servidor estático (Live
Server de VS Code, `python -m http.server`, etc.) — no hay paso de
compilación.

## Configuración (`API_BASE`)

Como no hay build step, no hay `process.env`/`import.meta.env` nativos. La
URL del backend vive centralizada en [`js/config.js`](js/config.js)
(`window.GDF_CONFIG.API_BASE`) — es nuestro equivalente a una variable de
entorno para un sitio estático sin build: un único archivo, cargado antes que
el resto, que se edita a mano según dónde se sirva el frontend:

- **Producción (valor por defecto en el archivo):**
  `https://hackaton-colsubsidio-30x-frontend.onrender.com`
- **Dev local:** cambiar a `http://localhost:8000` mientras el backend corre
  local (`uvicorn backend.main:app --reload`) — hay una línea comentada lista
  para eso en el propio archivo.

## Dónde vive cada cosa

- `js/data.js` — contenido estático (preguntas del bowl, catálogo de
  proyectos).
- `js/matching.js` / `js/qualification.js` — scoring de proyectos y
  calificación de lead (lógica de demo, ilustrativa — el motor de reglas real
  vive en `backend/core/rules_engine.py`).
- `js/scene.js` — construcción visual de la casa (vista de planta).
- `js/state.js` — estado central + acciones (sin librería, objeto mutable
  simple).
- `js/templates.js` — un string de HTML por pantalla; sin virtual DOM.
- `js/leads.js` — arma el objeto **`SenalBowl`** (mismos nombres/tipos que
  [`backend/models/schemas.py`](../backend/models/schemas.py)) y hace el
  `POST /leads`. Maneja 202 (guarda `lead_id`) y 422 (loguea el detalle de
  validación). Fire-and-forget: no bloquea la UI del resultado.
- `js/main.js` — bootstrap y el único listener delegado (`data-action`).

## Regla de oro del contrato

`SenalBowl` (en `js/leads.js`) tiene que coincidir 1:1 con
`backend/models/schemas.py` — **no se toca sin acordarlo con el equipo de
backend primero.** Este PR no modifica el contrato.

Dos cosas pendientes de acordar con el equipo de backend (documentadas en
`js/leads.js`, no resueltas unilateralmente):

- El set exacto de etiquetas de `ingresos_hogar_rango` (hoy usa una
  conversión provisional desde SMMLV a pesos).
- Si se agrega `proyecto_interes` al contrato (el bowl ya deja elegir un
  proyecto puntual en el resultado, pero ese campo no está en `SenalBowl`
  todavía).
