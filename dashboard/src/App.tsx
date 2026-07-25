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
import { PluginsPanel } from "./components/PluginsPanel";
import { ActivityLog, type EntradaLog } from "./components/ActivityLog";
import { LeadDetail } from "./components/LeadDetail";
import { dataSource, fuenteActiva } from "./data";
import type { EstadoPlugin, Lead } from "./types";

const MAX_LOG = 40;

export function App() {
  const [leads, setLeads] = useState<Map<string, Lead>>(new Map());
  const [plugins, setPlugins] = useState<EstadoPlugin[]>([]);
  const [log, setLog] = useState<EntradaLog[]>([]);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // fuerza refresco de los "hace Xs"

  // Suscripción al stream de leads.
  useEffect(() => {
    let n = 0;
    const desuscribir = dataSource.suscribirseALeads((evento) => {
      const lead = evento.lead;
      setLeads((prev) => new Map(prev).set(lead.id, lead));

      if (evento.nota) {
        const tono: EntradaLog["tono"] =
          lead.estadoNodo === "error"
            ? "error"
            : lead.nodoActual === "asesor"
              ? "ok"
              : "info";
        const entrada: EntradaLog = {
          id: `log-${Date.now()}-${n++}`,
          ts: Date.now(),
          texto: evento.nota,
          tono,
        };
        setLog((prev) => [entrada, ...prev].slice(0, MAX_LOG));
      }
    });
    return desuscribir;
  }, []);

  // Polling de plugins + tick de reloj para refrescar tiempos relativos.
  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      const p = await dataSource.obtenerEstadoPlugins();
      if (vivo) setPlugins(p);
      setTick((t) => t + 1);
    };
    cargar();
    const t = setInterval(cargar, 2000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  const lista = [...leads.values()];
  const seleccionado = seleccionadoId ? leads.get(seleccionadoId) ?? null : null;

  // KPIs de la operación.
  const activos = lista.filter((l) => l.nodoActual !== "asesor").length;
  const enDapta = lista.filter((l) => l.nodoActual === "dapta").length;
  const calientes = lista.filter((l) => l.calificacion === "caliente").length;
  const entregados = lista.filter((l) => l.nodoActual === "asesor").length;

  return (
    <div className="app" data-tick={tick}>
      <header className="topbar">
        <div className="brand">
          <div className="brand__mark">CS</div>
          <div>
            <div className="brand__title">Monitor del sistema · Reto Vivienda</div>
            <div className="brand__sub">Colsubsidio × 30X · panel interno</div>
          </div>
        </div>
        <span className="live-pill" title={
          fuenteActiva === "supabase"
            ? "Datos reales desde Supabase (Realtime)"
            : "Datos simulados (sin Supabase configurado)"
        }>
          <span className="live-dot" />
          {fuenteActiva === "supabase" ? "En vivo · Supabase" : "En vivo · simulado"}
        </span>
      </header>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi__num">{activos}</span>
          <span className="kpi__lbl">Leads activos</span>
        </div>
        <div className="kpi">
          <span className="kpi__num">{enDapta}</span>
          <span className="kpi__lbl">En llamada (Dapta)</span>
        </div>
        <div className="kpi">
          <span className="kpi__num" data-cal="caliente">
            {calientes}
          </span>
          <span className="kpi__lbl">Calientes</span>
        </div>
        <div className="kpi">
          <span className="kpi__num">{entregados}</span>
          <span className="kpi__lbl">Fichas entregadas</span>
        </div>
      </div>

      <SystemMap
        leads={lista}
        seleccionadoId={seleccionadoId}
        onSeleccionarLead={setSeleccionadoId}
      />

      <div className="grid">
        <ActivityLog entradas={log} />
        <PluginsPanel plugins={plugins} />
      </div>

      {seleccionado && (
        <LeadDetail lead={seleccionado} onCerrar={() => setSeleccionadoId(null)} />
      )}
    </div>
  );
}
