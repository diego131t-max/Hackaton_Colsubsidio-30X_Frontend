/**
 * TABLERO DE ETAPAS — la vista principal del monitor.
 *
 * Sustituye a las fichas recortadas del mapa. Antes cada nodo mostraba 3 leads
 * y un "+9": el numero decia cuantos faltaban pero no DE QUIEN se trataba, que
 * es justo lo que el operador necesita cuando algo se atasca. Aqui estan todos,
 * la columna crece a peticion, y una tarjeta que cambia de etapa se ve viajar.
 */
import { useMemo, useRef, useState } from "react";
import type { EstadoNodo, Lead, PiezaId } from "../types";
import { PIEZAS } from "../types";
import { Icono } from "./Iconos";
import { useFlip } from "../useFlip";
import { antiguedad } from "../utils";

interface Props {
  leads: Lead[];
  seleccionadoId: string | null;
  onSeleccionarLead: (id: string) => void;
}

/** Cuantas tarjetas se ven antes de pedir "ver todas". */
const VISIBLES = 6;

function indiceDe(pieza: PiezaId) {
  return PIEZAS.findIndex((p) => p.id === pieza);
}

/** Estado agregado de la etapa, para el color del acento. */
function estadoDeEtapa(pieza: PiezaId, leads: Lead[]): EstadoNodo {
  const idx = indiceDe(pieza);
  let estado: EstadoNodo = "inactivo";
  for (const l of leads) {
    if (l.nodoActual === pieza) {
      if (l.estadoNodo === "error") return "error";
      if (l.estadoNodo === "en_proceso") estado = "en_proceso";
      else if (estado !== "en_proceso") estado = "completado";
    } else if (indiceDe(l.nodoActual) > idx && estado === "inactivo") {
      estado = "completado";
    }
  }
  return estado;
}

/** Etiqueta corta del estado de UN lead, la que el operador lee de un vistazo. */
function etiquetaEstado(l: Lead): string {
  if (l.estadoNodo === "error") return "Error";
  if (l.calificacion) return l.calificacion;
  if (l.estadoNodo === "en_proceso") return "En curso";
  return "Listo";
}

function Tarjeta({
  lead,
  seleccionado,
  onClick,
}: {
  lead: Lead;
  seleccionado: boolean;
  onClick: () => void;
}) {
  const nombre = `${lead.senal?.nombre ?? ""} ${lead.senal?.apellido ?? ""}`.trim();
  const iniciales =
    ((lead.senal?.nombre ?? "")[0] ?? "") + ((lead.senal?.apellido ?? "")[0] ?? "");
  const ultimo = lead.timeline[lead.timeline.length - 1];

  return (
    <button
      type="button"
      data-flip-id={lead.id}
      className={`tarjeta${seleccionado ? " tarjeta--sel" : ""}`}
      data-cal={lead.calificacion ?? ""}
      data-estado={lead.estadoNodo}
      onClick={onClick}
      title={nombre}
    >
      <span className="tarjeta__avatar" aria-hidden="true">
        {iniciales.toUpperCase() || "··"}
      </span>
      <span className="tarjeta__cuerpo">
        <span className="tarjeta__nombre">{nombre || "Sin nombre"}</span>
        <span className="tarjeta__meta">
          {lead.senal?.zona_interes ?? "—"}
          {ultimo ? ` · ${antiguedad(ultimo.timestamp)}` : ""}
        </span>
      </span>
      <span className="tarjeta__estado">{etiquetaEstado(lead)}</span>
    </button>
  );
}

export function Tablero({ leads, seleccionadoId, onSeleccionarLead }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const [abiertas, setAbiertas] = useState<Set<PiezaId>>(new Set());

  // Agrupa una sola vez por render. Los mas recientes arriba: lo que acaba de
  // entrar es lo que se esta mirando.
  const porEtapa = useMemo(() => {
    const mapa = new Map<PiezaId, Lead[]>(PIEZAS.map((p) => [p.id, []]));
    for (const l of leads) mapa.get(l.nodoActual)?.push(l);
    for (const arr of mapa.values()) {
      arr.sort((a, b) => {
        const ta = a.timeline[a.timeline.length - 1]?.timestamp ?? 0;
        const tb = b.timeline[b.timeline.length - 1]?.timestamp ?? 0;
        return tb - ta;
      });
    }
    return mapa;
  }, [leads]);

  // Firma del reparto: cambia solo cuando un lead cambia de columna, que es
  // cuando hay algo que animar. Sin esto el FLIP se dispararia en cada tick.
  const firma = useMemo(
    () => leads.map((l) => `${l.id}:${l.nodoActual}`).sort().join("|"),
    [leads],
  );
  useFlip(raiz, firma);

  // Acumulado que llega a cada etapa, para el embudo del riel.
  const alcanzaron = PIEZAS.map((_, i) =>
    leads.filter((l) => indiceDe(l.nodoActual) >= i).length,
  );
  const total = leads.length || 1;

  return (
    <section className="tablero" ref={raiz} aria-label="Tablero de etapas">
      <header className="tablero__cab">
        <h2 className="tablero__titulo">Leads por etapa</h2>
        <p className="tablero__hint">
          cada tarjeta es una persona · clic para ver su ficha
        </p>
      </header>

      <div className="columnas">
        {PIEZAS.map((pieza, i) => {
          const enEsta = porEtapa.get(pieza.id) ?? [];
          const abierta = abiertas.has(pieza.id);
          const visibles = abierta ? enEsta : enEsta.slice(0, VISIBLES);
          const ocultas = enEsta.length - visibles.length;
          const caida =
            i > 0 && alcanzaron[i - 1] > 0
              ? Math.round((1 - alcanzaron[i] / alcanzaron[i - 1]) * 100)
              : 0;

          return (
            <article
              className="columna"
              key={pieza.id}
              data-etapa={pieza.id}
              data-estado={estadoDeEtapa(pieza.id, leads)}
            >
              <header className="columna__cab">
                <span className="columna__icono">
                  <Icono nombre={pieza.id} />
                </span>
                <div className="columna__titulos">
                  <h3 className="columna__nombre">{pieza.nombre}</h3>
                  <p className="columna__desc">{pieza.descripcion}</p>
                </div>
                <span className="columna__conteo">{enEsta.length}</span>
              </header>

              <div className="columna__barra" aria-hidden="true">
                <span
                  className="columna__barra-fill"
                  style={{ width: `${(alcanzaron[i] / total) * 100}%` }}
                />
              </div>
              <p className="columna__caudal">
                <b>{alcanzaron[i]}</b> llegaron aquí
                {caida > 0 && <span className="columna__caida">−{caida}%</span>}
              </p>

              <div className={`columna__lista${abierta ? " columna__lista--abierta" : ""}`}>
                {enEsta.length === 0 && (
                  <p className="columna__vacia">Nadie en esta etapa</p>
                )}
                {visibles.map((l) => (
                  <Tarjeta
                    key={l.id}
                    lead={l}
                    seleccionado={l.id === seleccionadoId}
                    onClick={() => onSeleccionarLead(l.id)}
                  />
                ))}
              </div>

              {enEsta.length > VISIBLES && (
                <button
                  type="button"
                  className="columna__ver"
                  aria-expanded={abierta}
                  onClick={() =>
                    setAbiertas((prev) => {
                      const s = new Set(prev);
                      s.has(pieza.id) ? s.delete(pieza.id) : s.add(pieza.id);
                      return s;
                    })
                  }
                >
                  {abierta ? "Ver menos" : `Ver los ${enEsta.length}`}
                  <span className="columna__ver-chevron">{abierta ? "▴" : "▾"}</span>
                  {!abierta && ocultas > 0 && (
                    <span className="columna__ver-resto">{ocultas} más</span>
                  )}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
