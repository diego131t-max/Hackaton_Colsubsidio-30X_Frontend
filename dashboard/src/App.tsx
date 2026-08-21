/**
 * App — dashboard interno de monitoreo (single page): MAPA DEL SISTEMA.
 *
 * Se suscribe al DataSource (hoy mock, mañana Supabase) y mantiene el estado de
 * los leads. De cada evento arma: el mapa en vivo, el registro narrado de
 * actividad y los KPIs. No sabe de dónde vienen los datos: solo habla contra la
 * interfaz DataSource.
 */

import { useEffect, useState } from "react";
import { SystemMap } from "./components/SystemMap";
import { Tablero } from "./components/Tablero";
import { Kpi } from "./components/Kpi";
import { PluginsPanel } from "./components/PluginsPanel";
import { ActivityLog, type EntradaLog } from "./components/ActivityLog";
import { LeadDetail } from "./components/LeadDetail";
import { AsesorView } from "./components/AsesorView";
import { dataSource, fuenteActiva } from "./data";
import type { EstadoPlugin, Lead } from "./types";

const MAX_LOG = 40;

export function App() {
  const [leads, setLeads] = useState<Map<string, Lead>>(new Map());
  const [plugins, setPlugins] = useState<EstadoPlugin[]>([]);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // fuerza refresco de los "hace Xs"
  // Dos vistas sobre los MISMOS datos: "monitor" responde si el pipeline
  // funciona; "asesor" es la ficha de traspaso con la que se trabaja el lead.
  //
  // La vista vive en el hash de la URL (#asesor) para que sea enlazable: el
  // asesor guarda su marcador y entra directo a su bandeja, sin pasar por el
  // panel de operación que no le sirve.
  const [vista, setVista] = useState<"monitor" | "asesor">(() =>
    typeof window !== "undefined" && window.location.hash === "#asesor"
      ? "asesor"
      : "monitor",
  );

  // Suscripción al stream de leads.
  useEffect(() => {
    const desuscribir = dataSource.suscribirseALeads((evento) => {
      const lead = evento.lead;
      setLeads((prev) => new Map(prev).set(lead.id, lead));
    });
    return desuscribir;
  }, []);

  // Tick de reloj: solo refresca los tiempos relativos ("hace 5 min"). Es
  // local, no cuesta red, así que puede ir rápido.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);

  // Estado de los plugins. Cada comprobación son TRES peticiones (dos a
  // Supabase y un ping a /health), así que el intervalo importa: estaba en 2
  // segundos, o sea ~90 peticiones por minuto por pestaña abierta. Eso disparó
  // el rate-limit de Cloudflare delante de Render y dejó la API inalcanzable
  // desde la red que estuviera mirando el panel.
  //
  // 30 segundos basta de sobra: es un semáforo de integraciones, no un dato
  // que cambie por segundo. Los leads siguen llegando en vivo por Realtime,
  // que es una suscripción y no hace polling.
  useEffect(() => {
    let vivo = true;
    let enVuelo = false;
    const cargar = async () => {
      // Sin este guardia, una comprobación lenta se solapa con la siguiente y
      // se acumulan peticiones abortadas — que es justo lo que se veía.
      if (enVuelo) return;
      enVuelo = true;
      try {
        const p = await dataSource.obtenerEstadoPlugins();
        if (vivo) setPlugins(p);
      } finally {
        enVuelo = false;
      }
    };
    cargar();
    const t = setInterval(cargar, 30000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  // Con la pestaña en segundo plano no hay nadie mirando: se deja de sondear.
  // Una pestaña olvidada durante horas era, ella sola, miles de peticiones.
  useEffect(() => {
    const alCambiar = () => {
      if (document.visibilityState === "visible") {
        dataSource.obtenerEstadoPlugins().then(setPlugins).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", alCambiar);
    return () => document.removeEventListener("visibilitychange", alCambiar);
  }, []);

  // El monitor es oscuro y la ficha del asesor clara: se alterna la clase en
  // body para que el fondo de la página acompañe y no quede un borde oscuro
  // alrededor de la vista clara.
  useEffect(() => {
    document.body.classList.toggle("tema-asesor", vista === "asesor");
    return () => document.body.classList.remove("tema-asesor");
  }, [vista]);

  // El hash sigue a la vista (y viceversa: atrás/adelante del navegador
  // funcionan como se espera en vez de dejar la URL desincronizada).
  useEffect(() => {
    const deseado = vista === "asesor" ? "#asesor" : "#monitor";
    if (window.location.hash !== deseado) {
      window.history.replaceState(null, "", deseado);
    }
  }, [vista]);

  useEffect(() => {
    const alCambiar = () =>
      setVista(window.location.hash === "#asesor" ? "asesor" : "monitor");
    window.addEventListener("hashchange", alCambiar);
    return () => window.removeEventListener("hashchange", alCambiar);
  }, []);

  const lista = [...leads.values()];

  // El registro se DERIVA de los timelines, no se acumula solo con lo que pasa
  // mientras la pestaña está abierta. Antes salía vacío en cada recarga aunque
  // hubiera 111 leads con historia: el panel más grande de la pantalla no decía
  // nada. Los eventos en vivo entran por la misma vía, porque actualizan el lead.
  const entradasLog: EntradaLog[] = lista
    .flatMap((lead) => {
      const ultimo = lead.timeline[lead.timeline.length - 1];
      if (!ultimo?.nota) return [];
      const nombre = `${lead.senal?.nombre ?? ""} ${lead.senal?.apellido ?? ""}`.trim();
      return [
        {
          id: `${lead.id}-${lead.timeline.length}`,
          ts: ultimo.timestamp,
          texto: nombre ? `${nombre}: ${ultimo.nota}` : ultimo.nota,
          tono:
            lead.estadoNodo === "error"
              ? ("error" as const)
              : lead.nodoActual === "asesor"
                ? ("ok" as const)
                : ("info" as const),
        },
      ];
    })
    .sort((a, b) => b.ts - a.ts)
    .slice(0, MAX_LOG);
  const seleccionado = seleccionadoId ? leads.get(seleccionadoId) ?? null : null;

  // KPIs del embudo. Se miden cosas que de verdad ocurrieron, no estados
  // instantáneos: "en llamada (Dapta)" contaba los que están parados en el nodo
  // dapta, que en la práctica son los que NO contestaron — justo lo contrario de
  // lo que sugería la etiqueta.
  const captados = lista.length;
  const contactados = lista.filter((l) => l.resultadoDapta != null).length;
  const calientes = lista.filter((l) => l.calificacion === "caliente").length;
  const entregados = lista.filter((l) => l.nodoActual === "asesor").length;
  const pct = (n: number) =>
    captados ? `${Math.round((n / captados) * 100)}% del total` : "—";

  return (
    <div className={`app${vista === "asesor" ? " vista-asesor" : ""}`} data-tick={tick}>
      <header className="topbar">
        <div className="brand">
          <div className="brand__mark">CS</div>
          <div>
            <div className="brand__title">
              {vista === "monitor"
                ? "Monitor del sistema · Reto Vivienda"
                : "Ficha del asesor · Reto Vivienda"}
            </div>
            <div className="brand__sub">Colsubsidio × 30X · panel interno</div>
          </div>
        </div>
        <nav className="vista-switch" aria-label="Cambiar de vista">
          <button
            type="button"
            className={`vista-switch__b${vista === "monitor" ? " vista-switch__b--on" : ""}`}
            aria-pressed={vista === "monitor"}
            onClick={() => setVista("monitor")}
          >
            Monitor
          </button>
          <button
            type="button"
            className={`vista-switch__b${vista === "asesor" ? " vista-switch__b--on" : ""}`}
            aria-pressed={vista === "asesor"}
            onClick={() => setVista("asesor")}
          >
            Ficha del asesor
          </button>
        </nav>
        <span className="live-pill" title={
          fuenteActiva === "supabase"
            ? "Datos reales desde Supabase (Realtime)"
            : "Datos simulados (sin Supabase configurado)"
        }>
          <span className="live-dot" />
          {fuenteActiva === "supabase" ? "En vivo · Supabase" : "En vivo · simulado"}
        </span>
      </header>

      {vista === "asesor" ? (
        <AsesorView leads={lista} />
      ) : (
        <>
        <div className="kpis">
          <Kpi orden={0} valor={captados} etiqueta="Leads captados"
               sub="formulario completado" proporcion={1} />
          <Kpi orden={1} valor={contactados} etiqueta="Contactados por Manuela"
               sub={pct(contactados)} proporcion={captados ? contactados / captados : 0} />
          <Kpi orden={2} valor={calientes} etiqueta="Calientes"
               sub="listos para cerrar" tono="caliente"
               proporcion={captados ? calientes / captados : 0} />
          <Kpi orden={3} valor={entregados} etiqueta="Fichas al asesor"
               sub={pct(entregados)} tono="ok"
               proporcion={captados ? entregados / captados : 0} />
        </div>

        <SystemMap leads={lista} />

        <Tablero
          leads={lista}
          seleccionadoId={seleccionadoId}
          onSeleccionarLead={setSeleccionadoId}
        />

        <div className="grid">
          <ActivityLog entradas={entradasLog} />
          <PluginsPanel plugins={plugins} />
        </div>
        </>
      )}

      {vista === "monitor" && seleccionado && (
        <LeadDetail lead={seleccionado} onCerrar={() => setSeleccionadoId(null)} />
      )}
    </div>
  );
}
