/** Utilidades del dashboard. */

/** "hace 5s", "hace 3m", "hace 1h" — para el registro y los plugins. */
export function haceCuanto(ts: number | null | undefined): string {
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

/**
 * "hace 5m", "hace 3h", "hace 2 días" — versión para la ficha del asesor, que
 * trabaja leads de días, no de segundos. `haceCuanto` se queda como está porque
 * el monitor sí razona en segundos y cambiarlo alteraría esa vista.
 */
export function antiguedad(ts: number | null | undefined): string {
  if (ts == null) return "—";
  const m = Math.max(0, Math.floor((Date.now() - ts) / 60000));
  if (m < 1) return "hace un momento";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

/** Fecha y hora legibles en zona Bogotá — para citas agendadas. */
export function fechaHora(ts: number | null | undefined): string {
  if (ts == null) return "—";
  return new Date(ts).toLocaleString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Bogota",
  });
}

/**
 * Pesos colombianos abreviados: 240780000 -> "$240,8 M".
 * El asesor compara precios de un vistazo; la cifra exacta al peso es ruido y
 * además es un "precio desde" que el asesor confirma, no un valor cerrado.
 */
export function pesosCortos(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1).replace(".", ",")} MM`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1).replace(".", ",")} M`;
  return `$${v.toLocaleString("es-CO")}`;
}

/** ¿La cita ya pasó? Una cita vencida se señala, no se muestra como pendiente. */
export function esPasado(ts: number | null | undefined): boolean {
  return ts != null && ts < Date.now();
}
