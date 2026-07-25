/**
 * IntegrationsPanel — "¿todo está conectado ahora mismo?" de un vistazo.
 *
 * Muestra Supabase, el webhook de Dapta (con hace cuánto llegó el último
 * evento) y la salud del backend de reglas. Los datos vienen del DataSource
 * (hoy mock); cuando exista Supabase, la misma interfaz devuelve datos reales.
 */

import type { EstadoIntegraciones } from "../types";
import { haceCuanto } from "../utils";

interface Props {
  estado: EstadoIntegraciones | null;
}

const LABEL: Record<string, string> = {
  viva: "Viva",
  caida: "Caída",
  desconocida: "Sin datos",
};

export function IntegrationsPanel({ estado }: Props) {
  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title">Estado de integraciones</span>
        <span className="card__hint">salud en tiempo real</span>
      </div>

      {!estado ? (
        <p className="empty">Cargando…</p>
      ) : (
        <div className="integ">
          <div className="integ-row">
            <div className="integ-row__left">
              <span className="status-dot" data-estado={estado.supabase.estado} />
              <div>
                <div className="integ-name">Supabase</div>
                <div className="integ-detail">{estado.supabase.detalle}</div>
              </div>
            </div>
            <span className="status-label">{LABEL[estado.supabase.estado]}</span>
          </div>

          <div className="integ-row">
            <div className="integ-row__left">
              <span
                className="status-dot"
                data-estado={estado.daptaWebhook.estado}
              />
              <div>
                <div className="integ-name">Webhook de Dapta</div>
                <div className="integ-detail">
                  Último evento: {haceCuanto(estado.daptaWebhook.ultimoEventoTs)}
                </div>
              </div>
            </div>
            <span className="status-label">
              {LABEL[estado.daptaWebhook.estado]}
            </span>
          </div>

          <div className="integ-row">
            <div className="integ-row__left">
              <span
                className="status-dot"
                data-estado={estado.backendReglas.estado}
              />
              <div>
                <div className="integ-name">Backend de reglas (H1–H10)</div>
                <div className="integ-detail">{estado.backendReglas.detalle}</div>
              </div>
            </div>
            <span className="status-label">
              {LABEL[estado.backendReglas.estado]}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
