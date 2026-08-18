/**
 * Tipos del dashboard — ESPEJO del contrato del backend
 * (backend/models/schemas.py), adaptado a la vista de MAPA DEL SISTEMA.
 *
 * El monitor muestra las 5 PIEZAS del sistema como nodos y a los leads
 * viajando entre ellas. (El backend maneja etapas más finas internamente;
 * aquí las agrupamos por pieza para que la operación se lea de un vistazo.)
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
  piso_preferido?: number | string | null; // 1=bajo, 2=medio, 3=alto
  tipo_inmueble?: TipoInmueble | null;
  entorno_deseado?: string[] | string | null; // lista de amenidades
  /**
   * Proyecto que la persona ELIGIÓ tras ver las recomendaciones. Existe en el
   * contrato del backend desde el flujo de 2 pasos; faltaba en este espejo.
   * Es de lo primero que mira el asesor: es el proyecto del que habló Manuela.
   */
  proyecto_elegido?: string | null;
}

// --- Espejo de ResultadoCalificacionDapta (Bloque B) ----------------------- //
export type Calificacion = "caliente" | "tibio" | "frio";

export interface ResultadoCalificacionDapta {
  call_id: string;
  call_status: string;
  // Opcional a propósito: una llamada sin contestar llega SIN calificación.
  // Tiparlo como obligatorio hacía que la vista asumiera que siempre hay nivel.
  calificacion_lead?: Calificacion | null;
  ahorros_cesantias_declarado?: string | null;
  vivienda_nombre_propio_o_herencia?: string | null;
  primas_incluidas_plan_pago?: boolean | null;
  cesantias_futuras_incluidas?: boolean | null;
  disponible_visita?: boolean | null;
  resumen_llamada?: string | null;
  // Por qué quedó en ese nivel (lo razona Manuela al calificar).
  justificacion_calificacion?: string | null;
  // Cita: texto libre tal como se acordó + modalidad. La versión normalizada y
  // ordenable vive en Lead.agendadoPara (columna agendado_para).
  fecha_hora_agendada?: string | null;
  modalidad_agendada?: string | null;
  disconnection_reason?: string | null;
  // Bandera de los datos generados para poblar la demo. Si es true, la ficha lo
  // dice en pantalla: un asesor jamás debe creer que leyó una llamada real.
  _simulado?: boolean | null;
}

/**
 * Un proyecto recomendado CON su score, tal como lo devolvió el modelo.
 * Espejo de la columna `recomendaciones_detalle`.
 */
export interface RecomendacionDetalle {
  nombre_proyecto: string;
  match_score: number;
  match_desglose?: {
    entorno?: number;
    capacidad?: number;
    asequibilidad?: number;
    beneficio_caja?: number;
  } | null;
  precio_desde_cop?: number | null;
  tipo_vivienda?: TipoVivienda | null;
  zona_interes?: string | null;
  url_ficha?: string | null;
}

// --- Piezas del sistema (los nodos del mapa) ------------------------------- //
export type PiezaId = "bowl" | "backend" | "clustering" | "dapta" | "asesor";

export type EstadoNodo = "inactivo" | "en_proceso" | "completado" | "error";

export interface Pieza {
  id: PiezaId;
  nombre: string;
  icono: string;
  descripcion: string; // qué hace, en una línea
}

export const PIEZAS: Pieza[] = [
  { id: "bowl", nombre: "Bowl", icono: "🥗", descripcion: "Captura señales del cliente" },
  { id: "backend", nombre: "Backend", icono: "🖥️", descripcion: "Reglas H1–H10 + orquesta" },
  { id: "clustering", nombre: "Clustering", icono: "🧩", descripcion: "Asigna perfil y recomienda" },
  { id: "dapta", nombre: "Dapta", icono: "📞", descripcion: "Llama y califica el lead" },
  { id: "asesor", nombre: "Asesor", icono: "📄", descripcion: "Recibe la ficha de traspaso" },
];

export interface HitoTimeline {
  pieza: PiezaId;
  estado: EstadoNodo;
  timestamp: number; // epoch ms
  /**
   * false = el evento NO traía marca de tiempo (eventos anteriores a que el
   * backend las escribiera) y `timestamp` es una inferencia a partir de la fila.
   * La vista lo señala en vez de presentar una hora inventada como exacta.
   */
  timestampReal: boolean;
  nota?: string; // narración de qué pasó
}

// --- Lead tal como lo ve el dashboard -------------------------------------- //
export interface Lead {
  id: string;
  senal: SenalBowl;
  canal_origen: string;
  nodoActual: PiezaId;
  estadoNodo: EstadoNodo;
  clusterId?: string;
  proyectosRecomendados?: string[];
  /** Mismos proyectos que arriba, con match_score y desglose. */
  recomendacionesDetalle?: RecomendacionDetalle[];
  calificacion?: Calificacion;
  resultadoDapta?: ResultadoCalificacionDapta;
  timeline: HitoTimeline[];
  createdAt: number; // epoch ms de entrada del lead
  updatedAt: number; // epoch ms del último cambio
  /** Cita acordada (epoch ms) o null si no dejó ninguna. */
  agendadoPara?: number | null;
}

// --- Plugins / integraciones ----------------------------------------------- //
export type SaludConexion = "viva" | "caida" | "sin_datos";

export interface EstadoPlugin {
  id: string;
  nombre: string;
  icono: string;
  estado: SaludConexion;
  detalle: string;
  ultimoEventoTs?: number | null;
}

// --- Eventos que emite el DataSource --------------------------------------- //
export type LeadEvent = {
  tipo: "nuevo" | "actualizado";
  lead: Lead;
  nota?: string; // frase para el registro de actividad
};
