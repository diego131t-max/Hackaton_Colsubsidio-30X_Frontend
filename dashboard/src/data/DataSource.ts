/**
 * Interfaz DataSource — el corazón del patrón adaptador.
 *
 * El dashboard NO sabe de dónde vienen los datos. Habla siempre contra esta
 * interfaz. Hoy la implementa MockDataSource (datos simulados para la demo);
 * mañana la implementará SupabaseDataSource (Realtime) sin tocar los
 * componentes. Se cambia la fuente en UN SOLO punto: src/data/index.ts.
 */

import type { EstadoPlugin, Lead, LeadEvent } from "../types";

export type Desuscribir = () => void;

export interface DataSource {
  /**
   * Se suscribe al stream de leads. El callback recibe un evento por cada lead
   * nuevo o actualizado. Devuelve una función para desuscribirse.
   */
  suscribirseALeads(callback: (evento: LeadEvent) => void): Desuscribir;

  /** Devuelve la ficha completa de un lead (para el panel de detalle). */
  obtenerLeadPorId(id: string): Promise<Lead | null>;

  /** Estado actual de los plugins/integraciones (Supabase, Dapta, backend…). */
  obtenerEstadoPlugins(): Promise<EstadoPlugin[]>;
}
