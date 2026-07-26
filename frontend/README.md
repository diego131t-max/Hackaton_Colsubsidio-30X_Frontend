# Frontend — Reto Vivienda Colsubsidio × 30X

El "bowl": una landing gamificada (quiz de 8 preguntas → construye una casa en
vista de planta → recomienda proyectos reales de Bogotá, con planos y
simulador de pagos) que termina haciendo `POST /recomendaciones` y, al
confirmar, `POST /leads?lead_id=…` — el flujo de dos pasos del contrato
`SenalBowl`.

**La demo es solo de Bogotá.** El catálogo son 31 proyectos reales scrapeados
de colsubsidio.com, cada uno ubicado en su localidad (Kennedy, Suba,
Fontibón…) — no en municipios ni en las zonas cardinales que usa el CMS.

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

## Configuración (`API_BASE` / `RECOMMENDER`)

Como no hay build step, no hay `process.env`/`import.meta.env` nativos.
[`js/config.js`](js/config.js) (`window.GDF_CONFIG`) es nuestro equivalente a
variables de entorno para un sitio estático sin build:

- `API_BASE` — producción por defecto:
  `https://hackaton-colsubsidio-30x-frontend.onrender.com`. Dev local: cambiar
  a `http://localhost:8000` (línea comentada lista en el archivo).
- `RECOMMENDER` — de dónde salen las tarjetas (ver `js/recommender.js`):
  - `'hibrido'` (default): las tarjetas son los 31 proyectos reales (con foto,
    planos y tipologías); el lead se registra igual en el backend vía
    `POST /recomendaciones` para obtener el `lead_id`. Es el modo de la demo,
    porque el catálogo que hoy recomienda el backend es sintético (100
    proyectos de prueba, sin imágenes) y no tiene nada en Fontibón ni Los
    Mártires, donde el catálogo real sí tiene 10 proyectos.
  - `'backend'`: las tarjetas las elige el backend tal cual responda. Útil
    cuando adopten el catálogo real (ver más abajo).
  - `'local'`: solo el motor de reglas, sin tocar la red.

## Dónde vive cada cosa

- `js/proyectos.js` — **generado, no editar a mano.** Los 31 proyectos reales
  de Bogotá (nombre, localidad, precio, área, tipologías con planos e
  imágenes, amenidades reales con ícono). Lo produce
  `tools/scrape_proyectos.py` desde colsubsidio.com — ver el docstring del
  script para el detalle de cómo extrae cada campo y las trampas que evita
  (el mapa de la ficha suele ser el de la sala de ventas, no el del proyecto).
- `js/data.js` — preguntas del quiz (las opciones de localidad se derivan del
  catálogo, no están escritas a mano) y geometría de la casa.
- `js/matching.js` — motor de reglas local (scoring por localidad + cercanía
  entre localidades vecinas, calculada de los límites oficiales de Bogotá).
- `js/recommender.js` — adaptador que normaliza la respuesta del backend y la
  del motor local al mismo shape, para que la tarjeta no distinga el origen.
- `js/simulador.js` — plan de pagos (amortización francesa) por tipología.
  Todos los supuestos que no salen del catálogo (tasa, SMMLV) están en una
  sola constante `SUPUESTOS`, documentados como ilustrativos.
- `js/qualification.js` — calificación de lead (regla 90/10 afiliados, Mi Casa
  Ya) — lógica de demo, ilustrativa.
- `js/scene.js` — construcción visual de la casa (vista de planta).
- `js/state.js` — estado central + acciones (sin librería, objeto mutable).
- `js/templates.js` — un string de HTML por pantalla; sin virtual DOM.
- `js/leads.js` — arma el `SenalBowl` y hace `POST /recomendaciones` (paso 1)
  y `POST /leads?lead_id=…` (paso 2, con `proyecto_elegido`). Maneja 422
  (loguea el detalle de validación) y errores de red con reintento.
- `js/main.js` — bootstrap y el único listener delegado (`data-action`).
- `tools/scrape_proyectos.py` — el scraper del catálogo (sitemap +
  `__NEXT_DATA__` de cada ficha, sin navegador). `python tools/scrape_proyectos.py`
  para refrescarlo.
- `tools/generar_seed_backend.py` — genera `data/proyectos_seed.json`: el
  mismo catálogo real, en el esquema exacto que ya consume el backend
  (`id_proyecto`, `localidad`, `precio_desde_cop`, `amenidades_entorno`…).
  Pensado para que el equipo de backend pueda reemplazar su catálogo sintético
  por este sin tocar su código.

## Regla de oro del contrato

`SenalBowl` (en `js/leads.js`) tiene que coincidir 1:1 con el `openapi.json`
del backend desplegado — **no se toca sin acordarlo con el equipo de backend
primero.** Este PR no modifica el contrato; se ajustó para seguirlo
(`entorno_deseado` como array de 25 etiquetas exactas, `piso_preferido` como
entero 1/2/3), que es lo que el backend ya espera según su propio esquema.

Pendiente de acordar con el equipo de backend:

- El set exacto de etiquetas de `ingresos_hogar_rango` (hoy usa una
  conversión provisional desde SMMLV a pesos).
- Si conviene adoptar `data/proyectos_seed.json` como catálogo real del
  backend — hoy recomienda sobre 100 proyectos sintéticos sin imágenes.
