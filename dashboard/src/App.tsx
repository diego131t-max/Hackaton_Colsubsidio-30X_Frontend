/**
 * App — dashboard interno de monitoreo (single page).
 *
 * Se suscribe al DataSource (hoy mock, mañana Supabase) y mantiene el estado de
 * los leads. Deriva de cada evento: qué lead se actualizó (para animar su fila)
 * y qué etapa se tocó (para el flash del pipeline). No sabe de dónde vienen los
 * datos: solo habla contra la interfaz DataSource.
 */

import { useEffect, useRef, useState } from "react";
import { PipelineFlow } from "./components/PipelineFlow";
import { LeadsFeed } from "./components/LeadsFeed";
import { IntegrationsPanel } from "./components/IntegrationsPanel";
import { LeadDetail } from "./components/LeadDetail";
import { dataSource } from "./data";
import type { EstadoIntegraciones, EtapaId, Lead } from "./types";

export function App() {
  const [leads, setLeads] = useState<Map<string, Lead>>(new Map());
  const [integraciones, setIntegraciones] = useState<EstadoIntegraciones | null>(
    null,
  );
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [recienActualizadoId, setRecienActualizadoId] = useState<string | null>(
    null,
  );
  const [ultimaEtapaTocada, setUltimaEtapaTocada] = useState<EtapaId | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>();

  // Suscripción al stream de leads.
  useEffect(() => {
    const desuscribir = dataSource.suscribirseALeads((evento) => {
      const lead = evento.lead;
      setLeads((prev) => new Map(prev).set(lead.id, lead));
      setRecienActualizadoId(lead.id);
      setUltimaEtapaTocada(lead.etapaActual);

      clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setRecienActualizadoId(null), 1100);
    });
    return () => {
      desuscribir();
      clearTimeout(flashTimer.current);
    };
  }, []);

  // Polling del estado de integraciones + "tick" para refrescar los "hace Xs".
  useEffect(() => {
    let vivo = true;
    const cargar = async () => {
      const e = await dataSource.obtenerEstadoIntegraciones();
      if (vivo) setIntegraciones(e);
    };
    cargar();
    const t = setInterval(cargar, 2000);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);

  const listaLeads = [...leads.values()];
  const seleccionado = seleccionadoId ? leads.get(seleccionadoId) ?? null : null;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand__mark">CS</div>
          <div>
            <div className="brand__title">Monitor del sistema · Reto Vivienda</div>
            <div className="brand__sub">Colsubsidio × 30X · panel interno</div>
          </div>
        </div>
        <span className="live-pill">
          <span className="live-dot" />
          En vivo
        </span>
      </header>

      <PipelineFlow leads={listaLeads} ultimaEtapaTocada={ultimaEtapaTocada} />

      <div className="grid" style={{ marginTop: 18 }}>
        <LeadsFeed
          leads={listaLeads}
          seleccionadoId={seleccionadoId}
          recienActualizadoId={recienActualizadoId}
          onSeleccionar={setSeleccionadoId}
        />
        <IntegrationsPanel estado={integraciones} />
      </div>

      {seleccionado && (
        <LeadDetail lead={seleccionado} onCerrar={() => setSeleccionadoId(null)} />
      )}
    </div>
  );
}
