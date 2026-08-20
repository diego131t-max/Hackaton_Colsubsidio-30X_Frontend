/**
 * SystemMap — el flujo de la operación EN VIVO.
 *
 * Las 5 piezas del sistema dibujadas como nodos unidos por CABLES, con pulsos
 * viajando por ellos. No es decoración: el cable entre dos piezas lleva el
 * número de leads que realmente hizo ese salto, su grosor es proporcional a ese
 * volumen y la caída se rotula encima. Así la pantalla contesta de un vistazo la
 * pregunta que importa —"¿dónde se me están quedando los leads?"— en vez de
 * mostrar cinco cajas bonitas desconectadas.
 *
 * POR QUÉ LAS COORDENADAS SE MIDEN EN PÍXELES
 * El instinto es dibujar el SVG con viewBox en porcentajes y
 * preserveAspectRatio="none". Se ve bien con líneas, pero deforma: los pulsos
 * dejan de ser círculos y se vuelven elipses estiradas, y las curvas se aplastan
 * al cambiar el ancho. Por eso se mide el contenedor con ResizeObserver y se
 * dibuja en coordenadas reales: los cables y los pulsos quedan correctos a
 * cualquier ancho.
 */

import { useLayoutEffect, useRef, useState } from "react";
import type { EstadoNodo, Lead, PiezaId } from "../types";
import { PIEZAS } from "../types";
import { Icono } from "./Iconos";

interface Props {
  leads: Lead[];
}

// Geometría del riel. Fija a propósito: el alto no depende del contenido, así
// los cables no bailan cuando entra o sale un lead.
const D_CIRCULO = 74; // diámetro del nodo
const Y_CENTRO = 46; // centro vertical del círculo dentro del lienzo
const ALTO_LIENZO = 96;
const DUR_PULSO = 2.8; // segundos que tarda un pulso en cruzar un tramo

/** Índice de la pieza en el pipeline (bowl=0 … asesor=4). */
function indiceDe(pieza: PiezaId): number {
  return PIEZAS.findIndex((p) => p.id === pieza);
}

function estadoDePieza(pieza: PiezaId, leads: Lead[]): EstadoNodo {
  const idx = indiceDe(pieza);
  let estado: EstadoNodo = "inactivo";
  for (const lead of leads) {
    const li = indiceDe(lead.nodoActual);
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

// --------------------------------------------------------------------------- //
export function SystemMap({ leads }: Props) {
  const lienzo = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);

  // ResizeObserver en vez de window.resize: el panel también cambia de ancho
  // cuando aparece la barra de scroll o cambia el layout, y esos casos no
  // disparan resize de ventana.
  useLayoutEffect(() => {
    const el = lienzo.current;
    if (!el) return;
    const medir = () => setAncho(el.clientWidth);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cuántos leads ALCANZARON cada etapa (acumulado), no cuántos están ahí ahora.
  // Es lo que convierte el riel en un embudo legible.
  const alcanzaron = PIEZAS.map(
    (_, i) => leads.filter((l) => indiceDe(l.nodoActual) >= i).length,
  );
  const aquiAhora = PIEZAS.map(
    (p) => leads.filter((l) => l.nodoActual === p.id).length,
  );
  const maxFlujo = Math.max(1, ...alcanzaron);

  const centros = PIEZAS.map((_, i) => (ancho * (i + 0.5)) / PIEZAS.length);
  const r = D_CIRCULO / 2;

  return (
    <div className="card flujo-card">
      <div className="card__head">
        <span className="card__title">Flujo de la operación</span>
        <span className="card__hint">
          el grosor del cable es el volumen que pasa por él
        </span>
      </div>

      <div className="flujo" ref={lienzo}>
        {/* --- Cables --- */}
        <svg
          className="flujo__cables"
          width={ancho || 1}
          height={ALTO_LIENZO}
          aria-hidden
        >
          <defs>
            <linearGradient id="cableGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0067b1" />
              <stop offset="100%" stopColor="#3fa2e0" />
            </linearGradient>
          </defs>

          {centros.slice(0, -1).map((x, i) => {
            const x1 = x + r + 4;
            const x2 = centros[i + 1] - r - 4;
            if (!(x2 > x1)) return null;
            // Los que llegaron a la etapa SIGUIENTE son los que cruzaron
            // este cable. Un cable por el que no pasa nadie se dibuja apagado.
            const pasan = alcanzaron[i + 1];
            const grosor = 3 + (pasan / maxFlujo) * 9;
            const medio = (x1 + x2) / 2;
            const d = `M ${x1} ${Y_CENTRO} C ${medio} ${Y_CENTRO}, ${medio} ${Y_CENTRO}, ${x2} ${Y_CENTRO}`;
            const idCable = `cable-${i}`;
            // Densidad de pulsos según volumen: un cable con mucho tráfico se ve
            // ocupado, uno con poco apenas parpadea.
            const pulsos = pasan === 0 ? 0 : Math.min(4, 1 + Math.floor((pasan / maxFlujo) * 3));

            return (
              <g key={idCable} className={pasan === 0 ? "cable cable--mudo" : "cable"}>
                <path
                  id={idCable}
                  d={d}
                  className="cable__conducto"
                  strokeWidth={grosor + 6}
                />
                <path d={d} className="cable__vivo" strokeWidth={grosor} />
                {Array.from({ length: pulsos }).map((_, k) => (
                  <circle key={k} r={3.2} className="cable__pulso">
                    {/* Misma duración para todos y arranques repartidos por
                        igual: con duraciones distintas los pulsos se alcanzaban
                        entre sí y se veían como una mancha alargada en vez de
                        gotas separadas recorriendo el cable. */}
                    <animateMotion
                      dur={`${DUR_PULSO}s`}
                      begin={`${(k * DUR_PULSO) / pulsos}s`}
                      repeatCount="indefinite"
                      keyPoints="0;1"
                      keyTimes="0;1"
                      calcMode="linear"
                    >
                      <mpath href={`#${idCable}`} />
                    </animateMotion>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>

        {/* --- Rótulos de caudal sobre cada cable --- */}
        {ancho > 0 &&
          centros.slice(0, -1).map((x, i) => {
            const medio = (x + centros[i + 1]) / 2;
            const entran = alcanzaron[i];
            const pasan = alcanzaron[i + 1];
            const cae = entran > 0 ? Math.round(((entran - pasan) / entran) * 100) : 0;
            return (
              <div
                key={`rot-${i}`}
                className="flujo__caudal"
                style={{ left: medio, top: Y_CENTRO - 34 }}
              >
                <span className="flujo__caudal-n">{pasan}</span>
                {cae > 0 && <span className="flujo__caudal-caida">−{cae}%</span>}
              </div>
            );
          })}

        {/* --- Nodos --- */}
        <div className="flujo__nodos">
          {PIEZAS.map((pieza, i) => {
            const estado = estadoDePieza(pieza.id, leads);
            return (
              <div className="nodo" key={pieza.id} data-estado={estado}>
                <div className="nodo__circulo">
                  <Icono nombre={pieza.id} />
                  {aquiAhora[i] > 0 && (
                    <span className="nodo__badge">{aquiAhora[i]}</span>
                  )}
                </div>
                <div className="nodo__nombre">{pieza.nombre}</div>
                <div className="nodo__desc">{pieza.descripcion}</div>

              </div>
            );
          })}
        </div>
      </div>

      {/* --- Supabase, colgando del riel como almacén --- */}
      <div className="almacen">
        <span className="almacen__cable" />
        <div className="almacen__caja">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
            <path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13" />
            <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
          </svg>
          <strong>Supabase</strong>
          <span className="almacen__tag">
            cada paso se escribe aquí · el tablero lo lee en vivo
          </span>
        </div>
      </div>
    </div>
  );
}
