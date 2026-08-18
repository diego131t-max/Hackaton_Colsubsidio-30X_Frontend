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
  SaludConexion,
} from "../types";
import type { DataSource, Desuscribir } from "./DataSource";

const TABLA = "reto_vivienda_leads";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
// Se comprueba de verdad contra /health. Configurable por si cambia el host.
const BACKEND_URL =
  (import.meta.env.VITE_BACKEND_URL as string) ||
  "https://hackaton-colsubsidio-30x-frontend.onrender.com";

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
    recomendacionesDetalle: f.recomendaciones_detalle ?? [],
    calificacion: (f.calificacion ?? undefined) as Calificacion | undefined,
    resultadoDapta: f.resultado_dapta ?? undefined,
    timeline: (f.timeline ?? []).map((h: any): HitoTimeline => {
      // `ts` lo escribe el backend desde que se añadió la marca de tiempo. Los
      // eventos anteriores no lo traen: en vez de inventarles una hora se cae a
      // created_at y se marca timestampReal=false para que la vista lo diga.
      const crudo = h.ts ?? h.timestamp ?? null;
      const real = crudo != null && !Number.isNaN(new Date(crudo).getTime());
      return {
        pieza: h.pieza,
        estado: h.estado,
        timestamp: real
          ? new Date(crudo).getTime()
          : new Date(f.created_at ?? f.updated_at ?? Date.now()).getTime(),
        timestampReal: real,
        nota: h.nota,
      };
    }),
    createdAt: new Date(f.created_at ?? f.updated_at ?? Date.now()).getTime(),
    updatedAt: new Date(f.updated_at ?? f.created_at ?? Date.now()).getTime(),
    agendadoPara: f.agendado_para ? new Date(f.agendado_para).getTime() : null,
  };
}

export class SupabaseDataSource implements DataSource {
  private client: SupabaseClient;

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
    // Todo lo de aquí se COMPRUEBA. La versión anterior traía textos fijos que
    // envejecieron mal ("backend aún no desplegado", "modelo pendiente") y
    // acabaron afirmando en pantalla lo contrario de lo que pasaba. Un panel de
    // estado que miente es peor que no tenerlo: se deja de mirar.
    let supabaseViva = true;
    let totalLeads: number | null = null;
    try {
      const { error, count } = await this.client
        .from(TABLA)
        .select("id", { count: "exact", head: true });
      supabaseViva = !error;
      totalLeads = count ?? null;
    } catch {
      supabaseViva = false;
    }

    // Último resultado real de Dapta: dice si el webhook sigue llegando.
    let ultimoDapta: number | null = null;
    let calificados = 0;
    try {
      const { data } = await this.client
        .from(TABLA)
        .select("updated_at")
        .not("resultado_dapta", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (data?.length) ultimoDapta = new Date(data[0].updated_at).getTime();
      const { count } = await this.client
        .from(TABLA)
        .select("id", { count: "exact", head: true })
        .not("calificacion", "is", null);
      calificados = count ?? 0;
    } catch {
      /* se queda sin dato; no es motivo para tumbar el panel */
    }

    // Ping real al backend. Es una llamada de red que puede tardar (Render
    // free duerme el servicio), así que se acota con AbortController para no
    // dejar el panel colgado esperando.
    let backend: SaludConexion = "sin_datos";
    if (BACKEND_URL) {
      try {
        const corte = new AbortController();
        const t = setTimeout(() => corte.abort(), 4000);
        const r = await fetch(`${BACKEND_URL}/health`, { signal: corte.signal });
        clearTimeout(t);
        backend = r.ok ? "viva" : "caida";
      } catch {
        // Puede ser que esté caído o simplemente despertando: no se afirma
        // "caído" con certeza, se dice que no respondió.
        backend = "sin_datos";
      }
    }

    return [
      {
        id: "supabase",
        nombre: "Supabase",
        icono: "supabase",
        estado: supabaseViva ? "viva" : "caida",
        detalle: supabaseViva
          ? `${TABLA} · ${totalLeads ?? "?"} leads · Realtime`
          : "sin respuesta",
      },
      {
        id: "backend",
        nombre: "Backend de reglas",
        icono: "backend",
        estado: backend,
        detalle:
          backend === "viva"
            ? "FastAPI en Render · /health OK"
            : backend === "caida"
              ? "responde con error"
              : "sin respuesta (puede estar despertando)",
      },
      {
        id: "dapta",
        nombre: "Dapta · Manuela",
        icono: "dapta",
        estado: ultimoDapta ? "viva" : "sin_datos",
        detalle: ultimoDapta
          ? `webhook post-call · ${calificados} leads calificados`
          : "sin resultados de llamada todavía",
        ultimoEventoTs: ultimoDapta,
      },
      {
        id: "modelo",
        nombre: "Modelo de recomendaciones",
        icono: "modelo",
        estado: totalLeads ? "viva" : "sin_datos",
        detalle: "31 proyectos reales · match_score por lead",
      },
    ];
  }
}
