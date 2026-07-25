/** Utilidades del dashboard. */

import type { EtapaId } from "./types";

/** "hace 5s", "hace 3m", "hace 1h" — para el feed y el estado de integraciones. */
export function haceCuanto(ts: number | null): string {
  if (ts == null) return "—";
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  return `hace ${h}h`;
}

export function hora(ts: number): string {
  return new Date(ts).toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Ícono (emoji) por etapa — comunica de qué trata cada nodo de un vistazo. */
export const ICONO_ETAPA: Record<EtapaId, string> = {
  bowl_completado: "🥗",
  backend_recibido: "🖥️",
  clustering_asignado: "🧩",
  dapta_llamando: "📞",
  resultado_calificacion: "🎯",
  ficha_traspaso: "📄",
};
