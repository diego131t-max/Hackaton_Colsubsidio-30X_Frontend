/**
 * enviarSenales — POST del bowl al backend.
 *
 * Pieza del sistema: FRONTEND (Carlos).
 *
 * Envía el PerfilLead armado por el bowl al backend de señales y reglas.
 * El objeto DEBE cumplir el contrato de datos (sección 4 / docs/contrato-de-datos.md).
 * REGLA DE ORO: no agregar campos aquí que no estén acordados en el contrato.
 *
 * TODOs:
 *  - [ ] Tipar `PerfilLead` en el frontend espejando backend/models/schemas.py.
 *  - [ ] Leer la URL del backend desde variable de entorno (VITE_API_URL / .env).
 *  - [ ] Generar lead_id (uuid) y timestamp en el cliente.
 *  - [ ] Manejar errores de red y validación (4xx del backend).
 */

// TODO(Carlos): reemplazar por el tipo real espejo del contrato (sección 4).
export type PerfilLead = Record<string, unknown>;

const API_URL = /* TODO: import.meta.env.VITE_API_URL */ "";

export async function enviarSenales(lead: PerfilLead): Promise<unknown> {
  // TODO(Carlos): implementar el POST real, validar respuesta y tipar el retorno.
  const respuesta = await fetch(`${API_URL}/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
  if (!respuesta.ok) {
    throw new Error(`Backend respondió ${respuesta.status}`);
  }
  return respuesta.json();
}
