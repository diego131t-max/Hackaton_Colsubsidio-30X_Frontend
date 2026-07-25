/**
 * SupabaseDataSource — implementación REAL de DataSource contra Supabase.
 *
 * Lee la tabla `public.reto_vivienda_leads` del proyecto COLSUBSIDIO-leads:
 *   - carga inicial de los leads existentes,
 *   - se suscribe a Realtime (INSERT/UPDATE) para reflejar cambios en vivo,
 *   - mapea cada fila al tipo Lead del dashboard.
 *
 * Config por variables de entorno (VITE_*), NUNCA hardcodeada. Ver .env.example.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Calificacion,
  EstadoNodo,
  EstadoPlugin,
  HitoTimeline,
  Lead,
  LeadEvent,
  PiezaId,
} from "../types";
import type { DataSource, Desuscribir } from "./DataSource";

const TABLA = "reto_vivienda_leads";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

/** Mapea una fila de la tabla al tipo Lead del dashboard. */
function mapFila(f: Record<string, any>): Lead {
  return {
    id: f.id,
    senal: f.senal ?? {},
    canal_origen: f.canal_origen ?? "desconocido",
    nodoActual: (f.nodo_actual ?? "bowl") as PiezaId,
    estadoNodo: (f.estado_nodo ?? "completado") as EstadoNodo,
    clusterId: f.cluster_id ?? undefined,
    proyectosRecomendados: f.proyectos_recomendados ?? [],
    calificacion: (f.calificacion ?? undefined) as Calificacion | undefined,
    resultadoDapta: f.resultado_dapta ?? undefined,
    timeline: (f.timeline ?? []).map(
      (h: any): HitoTimeline => ({
        pieza: h.pieza,
        estado: h.estado,
        // el timeline en DB no guarda epoch; usamos updated_at como referencia
        timestamp: h.timestamp ?? new Date(f.updated_at ?? Date.now()).getTime(),
        nota: h.nota,
      }),
    ),
    updatedAt: new Date(f.updated_at ?? f.created_at ?? Date.now()).getTime(),
  };
}

export class SupabaseDataSource implements DataSource {
  private client: SupabaseClient;
  private ultimoEventoTs: number | null = null;

  constructor() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      throw new Error(
        "Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (ver .env.example).",
      );
    }
    this.client = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  suscribirseALeads(callback: (evento: LeadEvent) => void): Desuscribir {
    // 1) Carga inicial de lo que ya existe.
    this.client
      .from(TABLA)
      .select("*")
      .order("updated_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Supabase carga inicial:", error.message);
          return;
        }
        for (const fila of data ?? []) {
          callback({ tipo: "nuevo", lead: mapFila(fila) });
        }
      });

    // 2) Realtime: INSERT y UPDATE de la tabla.
    const canal = this.client
      .channel("reto-vivienda-monitor")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: TABLA },
        (payload) => {
          this.ultimoEventoTs = Date.now();
          const lead = mapFila(payload.new as Record<string, any>);
          callback({
            tipo: "nuevo",
            lead,
            nota: `Nuevo lead entró por ${lead.canal_origen}`,
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: TABLA },
        (payload) => {
          this.ultimoEventoTs = Date.now();
          const lead = mapFila(payload.new as Record<string, any>);
          const ultimo = lead.timeline[lead.timeline.length - 1];
          callback({ tipo: "actualizado", lead, nota: ultimo?.nota });
        },
      )
      .subscribe();

    return () => {
      this.client.removeChannel(canal);
    };
  }

  async obtenerLeadPorId(id: string): Promise<Lead | null> {
    const { data, error } = await this.client
      .from(TABLA)
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) return null;
    return mapFila(data);
  }

  async obtenerEstadoPlugins(): Promise<EstadoPlugin[]> {
    // La salud de Supabase se infiere de poder consultar la tabla.
    let supabaseViva = true;
    try {
      const { error } = await this.client
        .from(TABLA)
        .select("id", { count: "exact", head: true });
      supabaseViva = !error;
    } catch {
      supabaseViva = false;
    }

    return [
      {
        id: "supabase",
        nombre: "Supabase",
        icono: "🗄️",
        estado: supabaseViva ? "viva" : "caida",
        detalle: `Tabla ${TABLA} · Realtime`,
      },
      {
        id: "dapta",
        nombre: "Dapta",
        icono: "📞",
        estado: this.ultimoEventoTs ? "viva" : "sin_datos",
        detalle: "Webhook de voz/WhatsApp (pendiente backend)",
        ultimoEventoTs: this.ultimoEventoTs,
      },
      {
        id: "backend",
        nombre: "Backend de reglas",
        icono: "🖥️",
        estado: "sin_datos",
        detalle: "Aún no desplegado (H1–H10 en stub)",
      },
      {
        id: "clustering",
        nombre: "Clustering",
        icono: "🧩",
        estado: "sin_datos",
        detalle: "Modelo pendiente (Santiago DS)",
      },
    ];
  }
}
