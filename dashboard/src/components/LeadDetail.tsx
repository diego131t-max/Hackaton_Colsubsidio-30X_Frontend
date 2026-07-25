/**
 * LeadDetail — panel (drawer) con la ficha completa de un lead.
 *
 * Al hacer clic en una ficha del mapa, muestra: datos de SenalBowl, el
 * ResultadoCalificacionDapta si ya llegó (con los campos sensibles, que solo
 * existen en este punto del flujo), y la línea de tiempo de su recorrido por
 * las piezas del sistema.
 */

import type { Lead, PiezaId } from "../types";
import { PIEZAS } from "../types";
import { hora } from "../utils";

interface Props {
  lead: Lead;
  onCerrar: () => void;
}

const NOMBRE_PIEZA = Object.fromEntries(
  PIEZAS.map((p) => [p.id, p.nombre]),
) as Record<PiezaId, string>;

function siNo(v?: boolean | null): string {
  if (v == null) return "—";
  return v ? "Sí" : "No";
}

export function LeadDetail({ lead, onCerrar }: Props) {
  const s = lead.senal;
  const d = lead.resultadoDapta;

  return (
    <>
      <div className="drawer-backdrop" onClick={onCerrar} />
      <aside className="drawer" role="dialog" aria-label="Detalle del lead">
        <div className="drawer__top">
          <div>
            <div className="drawer__name">
              {s.nombre} {s.apellido}
            </div>
            <div className="drawer__meta">
              {lead.canal_origen} ·{" "}
              {lead.calificacion ? (
                <span className="badge" data-cal={lead.calificacion}>
                  {lead.calificacion}
                </span>
              ) : (
                "sin calificar"
              )}
            </div>
          </div>
          <button className="drawer__close" onClick={onCerrar} aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="detail-section">
          <div className="detail-section__title">Señal del bowl</div>
          <dl className="kv">
            <dt>Tipo vivienda</dt>
            <dd>{s.tipo_vivienda.toUpperCase()}</dd>
            <dt>Afiliado</dt>
            <dd>{siNo(s.afiliado)}</dd>
            <dt>Ingresos hogar</dt>
            <dd>{s.ingresos_hogar_rango}</dd>
            <dt>Edad</dt>
            <dd>{s.edad}</dd>
            <dt>Personas a cargo</dt>
            <dd>{s.personas_a_cargo}</dd>
            <dt>Zona de interés</dt>
            <dd>{s.zona_interes}</dd>
            <dt>Tipo inmueble</dt>
            <dd>{s.tipo_inmueble ?? "—"}</dd>
            <dt>Entorno deseado</dt>
            <dd>{s.entorno_deseado ?? "—"}</dd>
            <dt>Teléfono</dt>
            <dd>{s.telefono_movil}</dd>
            <dt>Correo</dt>
            <dd>{s.correo}</dd>
          </dl>
        </div>

        {(lead.clusterId || lead.proyectosRecomendados) && (
          <div className="detail-section">
            <div className="detail-section__title">Clustering</div>
            <dl className="kv">
              <dt>Clúster</dt>
              <dd>{lead.clusterId ?? "—"}</dd>
              <dt>Proyectos</dt>
              <dd>{lead.proyectosRecomendados?.join(", ") ?? "—"}</dd>
            </dl>
          </div>
        )}

        <div className="detail-section">
          <div className="detail-section__title">Resultado de Dapta</div>
          {d ? (
            <dl className="kv">
              <dt>Calificación</dt>
              <dd>{d.calificacion_lead}</dd>
              <dt>Estado llamada</dt>
              <dd>{d.call_status}</dd>
              <dt>Ahorros / cesantías</dt>
              <dd>{d.ahorros_cesantias_declarado ?? "—"}</dd>
              <dt>Vivienda propia/herencia</dt>
              <dd>{d.vivienda_nombre_propio_o_herencia ?? "—"}</dd>
              <dt>Primas en plan de pago</dt>
              <dd>{siNo(d.primas_incluidas_plan_pago)}</dd>
              <dt>Cesantías futuras</dt>
              <dd>{siNo(d.cesantias_futuras_incluidas)}</dd>
              <dt>Disponible a visita</dt>
              <dd>{siNo(d.disponible_visita)}</dd>
              <dt>Resumen</dt>
              <dd>{d.resumen_llamada}</dd>
            </dl>
          ) : (
            <p className="empty" style={{ padding: "4px" }}>
              Aún no llega el resultado de la llamada.
            </p>
          )}
        </div>

        <div className="detail-section">
          <div className="detail-section__title">Recorrido</div>
          <ol className="timeline">
            {lead.timeline.map((h, i) => (
              <li key={i} data-estado={h.estado}>
                <div className="t-etapa">
                  {NOMBRE_PIEZA[h.pieza]} {h.estado === "error" ? "· error" : ""}
                </div>
                {h.nota && <div className="t-nota">{h.nota}</div>}
                <div className="t-time">{hora(h.timestamp)}</div>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </>
  );
}
