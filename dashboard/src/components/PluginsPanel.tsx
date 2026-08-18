/**
 * PluginsPanel — "¿todo está conectado ahora mismo?" de un vistazo.
 *
 * Solo MUESTRA estado (vivo / caído / sin datos) por plugin; no hay formularios
 * de conexión. Los datos vienen del DataSource (hoy mock); cuando exista
 * Supabase, la misma interfaz devuelve el estado real.
 */

import type { EstadoPlugin } from "../types";
import { haceCuanto } from "../utils";
import { Icono } from "./Iconos";

interface Props {
  plugins: EstadoPlugin[];
}

const LABEL: Record<string, string> = {
  viva: "Conectado",
  caida: "Caído",
  sin_datos: "Sin datos",
};

export function PluginsPanel({ plugins }: Props) {
  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title">Plugins</span>
        <span className="card__hint">estado de integraciones</span>
      </div>

      {plugins.length === 0 ? (
        <p className="empty">Cargando…</p>
      ) : (
        <div className="plugins">
          {plugins.map((p) => (
            <div className="plugin" key={p.id} data-estado={p.estado}>
              <span className="plugin__icon">
                <Icono nombre={p.icono} tamano={19} />
              </span>
              <div className="plugin__body">
                <div className="plugin__name">{p.nombre}</div>
                <div className="plugin__detail">
                  {p.detalle}
                  {p.ultimoEventoTs !== undefined && (
                    <> · último: {haceCuanto(p.ultimoEventoTs)}</>
                  )}
                </div>
              </div>
              <span className="plugin__status">
                <span className="status-dot" data-estado={p.estado} />
                {LABEL[p.estado]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
