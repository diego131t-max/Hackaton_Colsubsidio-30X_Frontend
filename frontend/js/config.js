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
};
