/**
 * LeadsFeed — lista en vivo de los leads más recientes.
 *
 * Cada fila: nombre, etapa actual (con dot de estado), canal, calificación (si
 * ya la tiene) y hace cuánto se actualizó. Anima suavemente la fila que acaba
 * de cambiar (data-just-updated) en vez de refrescar toda la tabla.
 */

import type { Calificacion, EtapaId, Lead } from "../types";
import { ETAPAS } from "../types";
import { haceCuanto } from "../utils";

interface Props {
  leads: Lead[];
  seleccionadoId: string | null;
  recienActualizadoId: string | null;
  onSeleccionar: (id: string) => void;
}

const NOMBRE_ETAPA: Record<EtapaId, string> = Object.fromEntries(
  ETAPAS.map((e) => [e.id, e.nombre]),
) as Record<EtapaId, string>;

function BadgeCalificacion({ cal }: { cal?: Calificacion }) {
  if (!cal) return <span className="badge badge--ghost">sin calificar</span>;
  return (
    <span className="badge" data-cal={cal}>
      {cal}
    </span>
  );
}

export function LeadsFeed({
  leads,
  seleccionadoId,
  recienActualizadoId,
  onSeleccionar,
}: Props) {
  const ordenados = [...leads].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title">Leads en vivo</span>
        <span className="card__hint">{leads.length} activos</span>
      </div>

      {ordenados.length === 0 ? (
        <p className="empty">Esperando leads…</p>
      ) : (
        <div className="feed">
          {ordenados.map((lead) => (
            <div
              key={lead.id}
              className={`lead-row${lead.id === seleccionadoId ? " is-selected" : ""}`}
              data-just-updated={lead.id === recienActualizadoId ? "1" : "0"}
              onClick={() => onSeleccionar(lead.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onSeleccionar(lead.id)}
            >
              <div>
                <div className="lead-name">
                  {lead.senal.nombre} {lead.senal.apellido}
                </div>
                <div className="lead-meta">
                  {lead.senal.afiliado ? "Afiliado" : "No afiliado"} ·{" "}
                  {lead.senal.tipo_vivienda.toUpperCase()} · {lead.canal_origen}
                </div>
              </div>

              <div className="lead-stage">
                <span className="mini-dot" data-estado={lead.estadoEtapaActual} />
                {NOMBRE_ETAPA[lead.etapaActual]}
              </div>

              <BadgeCalificacion cal={lead.calificacion} />

              <div className="lead-updated">{haceCuanto(lead.updatedAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
