/**
 * Tipos del dashboard — ESPEJO del contrato de datos del backend
 * (backend/models/schemas.py). Si el contrato cambia allá, se actualiza aquí.
 *
 * REGLA DE ORO (igual que en el backend): estos tipos reflejan el contrato
 * acordado; no inventar campos sin avisar al equipo.
 */

// --- Espejo de SenalBowl (Bloque A del contrato) --------------------------- //
export type TipoVivienda = "vis" | "no_vis";
export type TipoInmueble = "apartamento" | "casa" | "sin_preferencia";

export interface SenalBowl {
  tipo_vivienda: TipoVivienda;
  nombre: string;
  apellido: string;
  correo: string;
  telefono_movil: string;
  afiliado: boolean;
  ingresos_hogar_rango: string;
  edad: number;
  personas_a_cargo: number;
  zona_interes: string;
  piso_preferido?: string | null;
  tipo_inmueble?: TipoInmueble | null;
  entorno_deseado?: string | null;
}

// --- Espejo de ResultadoCalificacionDapta (Bloque B) ----------------------- //
export type Calificacion = "caliente" | "tibio" | "frio";

export interface ResultadoCalificacionDapta {
  call_id: string;
  call_status: string;
  calificacion_lead: Calificacion;
  ahorros_cesantias_declarado?: string | null;
  vivienda_nombre_propio_o_herencia?: string | null;
  primas_incluidas_plan_pago?: boolean | null;
  cesantias_futuras_incluidas?: boolean | null;
  disponible_visita?: boolean | null;
  resumen_llamada: string;
}

// --- Etapas del pipeline (el flujo de triggers) ---------------------------- //
export type EtapaId =
  | "bowl_completado"
  | "backend_recibido"
  | "clustering_asignado"
  | "dapta_llamando"
  | "resultado_calificacion"
  | "ficha_traspaso";

export type EstadoEtapa = "inactivo" | "en_proceso" | "completado" | "error";

export const ETAPAS: { id: EtapaId; nombre: string }[] = [
  { id: "bowl_completado", nombre: "Bowl completado" },
  { id: "backend_recibido", nombre: "Backend recibe" },
  { id: "clustering_asignado", nombre: "Clustering asigna" },
  { id: "dapta_llamando", nombre: "Dapta llama" },
  { id: "resultado_calificacion", nombre: "Resultado calificación" },
  { id: "ficha_traspaso", nombre: "Ficha al asesor" },
];

export interface HitoTimeline {
  etapa: EtapaId;
  estado: EstadoEtapa;
  timestamp: number; // epoch ms
}

// --- Lead tal como lo ve el dashboard -------------------------------------- //
export interface Lead {
  id: string;
  senal: SenalBowl;
  canal_origen: string;
  etapaActual: EtapaId;
  estadoEtapaActual: EstadoEtapa;
  calificacion?: Calificacion;
  resultadoDapta?: ResultadoCalificacionDapta;
  timeline: HitoTimeline[];
  updatedAt: number; // epoch ms del último cambio
}

// --- Estado de integraciones ----------------------------------------------- //
export type SaludConexion = "viva" | "caida" | "desconocida";

export interface EstadoIntegraciones {
  supabase: { estado: SaludConexion; detalle: string };
  daptaWebhook: {
    estado: SaludConexion;
    ultimoEventoTs: number | null; // epoch ms del último evento recibido
  };
  backendReglas: { estado: SaludConexion; detalle: string };
}

// --- Eventos que emite el DataSource --------------------------------------- //
export type LeadEvent =
  | { tipo: "nuevo"; lead: Lead }
  | { tipo: "actualizado"; lead: Lead };
