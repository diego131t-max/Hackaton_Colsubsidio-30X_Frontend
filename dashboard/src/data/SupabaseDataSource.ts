/**
 * SupabaseDataSource — STUB. Implementa DataSource contra Supabase Realtime.
 *
 * Pieza del sistema: DASHBOARD <-> SUPABASE (se crea mañana).
 *
 * NO está activo todavía. Cuando exista el proyecto de Supabase, se llena esta
 * clase y se cambia UNA línea en src/data/index.ts para instanciarla en vez de
 * MockDataSource. El resto del dashboard NO se toca.
 *
 * Instalar cuando se active:  npm i @supabase/supabase-js
 */

import type { EstadoPlugin, Lead, LeadEvent } from "../types";
import type { DataSource, Desuscribir } from "./DataSource";

// TODO(equipo): mover a variables de entorno (dashboard usa VITE_*), NUNCA
// hardcodear la anon key en el repo.
//   const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
//   const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export class SupabaseDataSource implements DataSource {
  // TODO: private client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  suscribirseALeads(_callback: (evento: LeadEvent) => void): Desuscribir {
    // TODO(equipo): suscribirse al canal Realtime de la tabla `leads`.
    //
    //   const channel = this.client
    //     .channel("leads-monitor")
    //     .on("postgres_changes",
    //       { event: "INSERT", schema: "public", table: "leads" },
    //       (p) => _callback({ tipo: "nuevo", lead: mapFila(p.new) }))
    //     .on("postgres_changes",
    //       { event: "UPDATE", schema: "public", table: "leads" },
    //       (p) => _callback({ tipo: "actualizado", lead: mapFila(p.new) }))
    //     .subscribe();
    //   return () => this.client.removeChannel(channel);
    //
    // Cada cambio de pieza en el backend debe hacer UPDATE de la fila del lead
    // (columna nodo_actual / estado) para que ese UPDATE dispare este callback.
    throw new Error("SupabaseDataSource: pendiente (se activa cuando exista el proyecto).");
  }

  async obtenerLeadPorId(_id: string): Promise<Lead | null> {
    // TODO: const { data } = await this.client.from("leads").select("*").eq("id", _id).single();
    //       return data ? mapFila(data) : null;
    throw new Error("SupabaseDataSource.obtenerLeadPorId: pendiente.");
  }

  async obtenerEstadoPlugins(): Promise<EstadoPlugin[]> {
    // TODO: derivar salud real:
    //   - supabase: ping/heartbeat a la conexión Realtime.
    //   - dapta: SELECT max(created_at) de una tabla de eventos de Dapta.
    //   - backend: fetch a GET /health del backend (ver backend/main.py).
    throw new Error("SupabaseDataSource.obtenerEstadoPlugins: pendiente.");
  }
}

// TODO(equipo): función que mapea una fila de la tabla `leads` de Supabase al
// tipo Lead del dashboard (ajustar nombres de columna al esquema real).
// function mapFila(fila: Record<string, unknown>): Lead { ... }
