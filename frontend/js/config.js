// Configuración de entorno para este front vanilla (sin build step, sin
// bundler => sin process.env ni import.meta.env nativos). Este archivo es
// el único lugar donde vive API_BASE; se edita a mano según dónde se sirva
// este frontend:
//   - Producción (default): el backend real ya desplegado en Render.
//   - Dev local: cambia el valor de abajo a http://localhost:8000 mientras
//     corres el backend con `uvicorn backend.main:app --reload`.
// Se carga ANTES que js/leads.js en index.html.
window.GDF_CONFIG = {
  API_BASE: 'https://hackaton-colsubsidio-30x-frontend.onrender.com',
  // API_BASE: 'http://localhost:8000', // <- dev local: descomenta esta línea y comenta la de arriba

  // De dónde salen los proyectos recomendados (ver js/recommender.js):
  //   'hibrido' -> las tarjetas son los 31 proyectos REALES de Bogotá (con
  //                foto, planos y tipologías) y el lead se registra igual en el
  //                backend para obtener el lead_id. Es el modo de la demo.
  //   'backend' -> las tarjetas las elige el backend. Hoy su catálogo es
  //                sintético y sin imágenes; sirve cuando adopten
  //                data/proyectos_seed.json.
  //   'local'   -> solo el motor local, sin tocar la red.
  // El servicio de Render es de plan gratuito y se duerme: la PRIMERA llamada
  // después de un rato puede tardar ~25 s en responder. Eso no es un error y la
  // pantalla de carga lo explica sola a partir de los 8 s.
  RECOMMENDER: 'hibrido',
};
