/**
 * SystemMap — el mapa de la operación EN VIVO (la vista principal).
 *
 * Dibuja las 5 piezas del sistema como nodos conectados en un riel. Cada lead
 * es una ficha que se DESLIZA por el riel de un nodo al siguiente (transición
 * CSS sobre `left`), así se ve literalmente el flujo de datos. Debajo del riel,
 * Supabase aparece como el almacén conectado al backend.
 *
 * Click en un nodo -> resalta esa pieza; click en una ficha -> abre el detalle.
 */

import type { EstadoNodo, Lead, PiezaId } from "../types";
import { PIEZAS } from "../types";

interface Props {
  leads: Lead[];
  onSeleccionarLead: (id: string) => void;
  seleccionadoId: string | null;
}

// Centro horizontal (%) del nodo i, con nodos de ancho igual.
function centroNodo(i: number): number {
  return ((i + 0.5) / PIEZAS.length) * 100;
}

function estadoDePieza(pieza: PiezaId, leads: Lead[]): EstadoNodo {
  const idx = PIEZAS.findIndex((p) => p.id === pieza);
  let estado: EstadoNodo = "inactivo";
  for (const lead of leads) {
    const li = PIEZAS.findIndex((p) => p.id === lead.nodoActual);
    if (lead.nodoActual === pieza) {
      if (lead.estadoNodo === "error") return "error";
      if (lead.estadoNodo === "en_proceso") estado = "en_proceso";
      else if (estado !== "en_proceso") estado = "completado";
    } else if (li > idx && estado === "inactivo") {
      estado = "completado";
    }
  }
  return estado;
}

export function SystemMap({ leads, onSeleccionarLead, seleccionadoId }: Props) {
  // Ordena las fichas de forma estable (por id) para que las lanes no salten.
  const fichas = [...leads].sort((a, b) => a.id.localeCompare(b.id)).slice(0, 8);

  return (
    <div className="card map-card">
      <div className="card__head">
        <span className="card__title">Operación en vivo</span>
        <span className="card__hint">
          cada ficha es un lead viajando por el flujo de datos
        </span>
      </div>

      {/* Riel con los nodos */}
      <div className="rail">
        {PIEZAS.map((pieza, i) => {
          const estado = estadoDePieza(pieza.id, leads);
          const aqui = leads.filter((l) => l.nodoActual === pieza.id).length;
          return (
            <div className="node" key={pieza.id} data-estado={estado}>
              {i < PIEZAS.length - 1 && <span className="node__edge" />}
              <span className="node__icon">{pieza.icono}</span>
              <span className="node__name">{pieza.nombre}</span>
              <span className="node__desc">{pieza.descripcion}</span>
              <span className="node__count">{aqui > 0 ? aqui : ""}</span>
            </div>
          );
        })}
      </div>

      {/* Lanes: una por lead; la ficha se desliza a la posición de su nodo */}
      <div className="lanes">
        {fichas.length === 0 && <p className="empty">Esperando leads…</p>}
        {fichas.map((lead) => {
          const i = PIEZAS.findIndex((p) => p.id === lead.nodoActual);
          return (
            <div className="lane" key={lead.id}>
              <button
                className={`chip${lead.id === seleccionadoId ? " chip--sel" : ""}`}
                style={{ left: `${centroNodo(i)}%` }}
                data-estado={lead.estadoNodo}
                data-cal={lead.calificacion ?? ""}
                onClick={() => onSeleccionarLead(lead.id)}
                title={`${lead.senal.nombre} ${lead.senal.apellido}`}
              >
                <span className="chip__dot" />
                {lead.senal.nombre} {lead.senal.apellido[0]}.
              </button>
            </div>
          );
        })}
      </div>

      {/* Supabase como almacén conectado al backend */}
      <div className="store">
        <span className="store__link" />
        <div className="store__box">
          🗄️ <strong>Supabase</strong>
          <span className="store__tag">almacén · pendiente</span>
        </div>
      </div>
    </div>
  );
}
