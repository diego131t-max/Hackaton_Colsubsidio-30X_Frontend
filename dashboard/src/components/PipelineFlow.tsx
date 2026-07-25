/**
 * PipelineFlow — visualización del flujo de triggers en vivo.
 *
 * Muestra las 6 etapas del pipeline. El estado de cada etapa se DERIVA de los
 * leads actuales: se marca "en_proceso"/"error" si algún lead está ahí ahora,
 * "completado" si alguno ya pasó, "inactivo" si nadie llegó. El nodo hace un
 * "flash" cuando un evento reciente lo tocó (comunica cambio, no decora).
 */

import { useEffect, useRef, useState } from "react";
import type { EstadoEtapa, EtapaId, Lead } from "../types";
import { ETAPAS } from "../types";
import { ICONO_ETAPA } from "../utils";

interface Props {
  leads: Lead[];
  ultimaEtapaTocada: EtapaId | null;
}

function estadoDeEtapa(etapa: EtapaId, leads: Lead[]): EstadoEtapa {
  const orden = ETAPAS.map((e) => e.id);
  const idx = orden.indexOf(etapa);
  let estado: EstadoEtapa = "inactivo";
  for (const lead of leads) {
    const leadIdx = orden.indexOf(lead.etapaActual);
    if (lead.etapaActual === etapa) {
      if (lead.estadoEtapaActual === "error") return "error";
      if (lead.estadoEtapaActual === "en_proceso") estado = "en_proceso";
      else if (estado !== "en_proceso") estado = "completado";
    } else if (leadIdx > idx && estado === "inactivo") {
      estado = "completado";
    }
  }
  return estado;
}

export function PipelineFlow({ leads, ultimaEtapaTocada }: Props) {
  const [flash, setFlash] = useState<EtapaId | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!ultimaEtapaTocada) return;
    setFlash(ultimaEtapaTocada);
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setFlash(null), 450);
    return () => clearTimeout(timeout.current);
  }, [ultimaEtapaTocada, leads]);

  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title">Flujo de triggers</span>
        <span className="card__hint">en vivo · deriva del estado de cada lead</span>
      </div>
      <div className="flow">
        {ETAPAS.map((etapa) => {
          const estado = estadoDeEtapa(etapa.id, leads);
          const enEtapa = leads.filter((l) => l.etapaActual === etapa.id).length;
          return (
            <div
              key={etapa.id}
              className="stage"
              data-estado={estado}
              data-flash={flash === etapa.id ? "1" : "0"}
            >
              <span className="stage__connector" />
              <span className="stage__node">{ICONO_ETAPA[etapa.id]}</span>
              <span className="stage__label">{etapa.nombre}</span>
              <span className="stage__count">
                {enEtapa > 0 ? `${enEtapa} aquí` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
