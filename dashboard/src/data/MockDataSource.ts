/**
 * MockDataSource — implementación de DataSource con datos SIMULADOS.
 *
 * Sirve para que el dashboard funcione y se vea bien AUNQUE Supabase todavía no
 * exista. El flujo es DELIBERADO (no ruido aleatorio): en cada tick avanza el
 * lead que lleva más tiempo sin moverse, así se lee como una cola que progresa.
 * Cada movimiento emite una NOTA en lenguaje natural para el registro de
 * actividad, para que se entienda qué está pasando.
 *
 * Cuando Supabase esté listo, NO se toca este archivo: se cambia la fuente en
 * src/data/index.ts por SupabaseDataSource.
 */

import type {
  Calificacion,
  EstadoPlugin,
  Lead,
  LeadEvent,
  PiezaId,
  SenalBowl,
} from "../types";
import { PIEZAS } from "../types";
import type { DataSource, Desuscribir } from "./DataSource";

// --- Perfiles de prueba que ya usa el equipo ------------------------------- //
const PERFILES: {
  senal: SenalBowl;
  canal: string;
  califFinal: Calificacion;
  cluster: string;
  proyectos: string[];
}[] = [
  {
    canal: "pauta_digital",
    califFinal: "caliente",
    cluster: "VIS-Norte-familias",
    proyectos: ["Ciudadela VIS Norte", "Torres del Parque VIS"],
    senal: {
      tipo_vivienda: "vis",
      nombre: "Laura",
      apellido: "Martínez",
      correo: "laura.martinez@example.com",
      telefono_movil: "+57 300 111 2233",
      afiliado: true,
      ingresos_hogar_rango: "$2.000.000 – $3.500.000",
      edad: 31,
      personas_a_cargo: 2,
      zona_interes: "Suba",
      tipo_inmueble: "apartamento",
      entorno_deseado: "cerca a colegio",
    },
  },
  {
    canal: "instagram",
    califFinal: "tibio",
    cluster: "NoVIS-inversionista",
    proyectos: ["Nuva Park", "Reserva del Bosque"],
    senal: {
      tipo_vivienda: "no_vis",
      nombre: "Andrés",
      apellido: "Gómez",
      correo: "andres.gomez@example.com",
      telefono_movil: "+57 301 444 5566",
      afiliado: false,
      ingresos_hogar_rango: "$7.115.001 – $10.000.000",
      edad: 42,
      personas_a_cargo: 0,
      zona_interes: "Chía",
      tipo_inmueble: "casa",
      entorno_deseado: "zona verde",
    },
  },
  {
    canal: "referido",
    califFinal: "caliente",
    cluster: "VIS-Sur-numerosa",
    proyectos: ["Ciudadela VIS Norte", "Altos de Soacha"],
    senal: {
      tipo_vivienda: "vis",
      nombre: "Juan",
      apellido: "López",
      correo: "juan.lopez@example.com",
      telefono_movil: "+57 302 777 8899",
      afiliado: true,
      ingresos_hogar_rango: "$3.500.001 – $5.000.000",
      edad: 38,
      personas_a_cargo: 4,
      zona_interes: "Soacha",
      tipo_inmueble: "apartamento",
      entorno_deseado: "cerca al trabajo",
    },
  },
];

const ORDEN: PiezaId[] = PIEZAS.map((p) => p.id);

function perfilDe(correo: string) {
  return PERFILES.find((p) => p.senal.correo === correo)!;
}

function crearLead(perfil: (typeof PERFILES)[number], idx: number): Lead {
  const ahora = Date.now();
  return {
    id: `lead-${idx}-${Math.random().toString(36).slice(2, 6)}`,
    senal: perfil.senal,
    canal_origen: perfil.canal,
    nodoActual: "bowl",
    estadoNodo: "completado",
    timeline: [
      {
        pieza: "bowl",
        estado: "completado",
        timestamp: ahora,
        timestampReal: true,
        nota: "Completó el bowl",
      },
    ],
    createdAt: ahora,
    updatedAt: ahora,
  };
}

const NOMBRE_PIEZA: Record<PiezaId, string> = Object.fromEntries(
  PIEZAS.map((p) => [p.id, p.nombre]),
) as Record<PiezaId, string>;

export class MockDataSource implements DataSource {
  private leads = new Map<string, Lead>();
  private suscriptores = new Set<(e: LeadEvent) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private ultimoEventoDaptaTs: number | null = null;
  private contador = 0;

  private emitir(evento: LeadEvent) {
    this.leads.set(evento.lead.id, evento.lead);
    for (const cb of this.suscriptores) cb(evento);
  }

  private sembrar() {
    for (const perfil of PERFILES) {
      this.emitir({
        tipo: "nuevo",
        lead: crearLead(perfil, this.contador++),
        nota: `Nuevo lead entró por ${perfil.canal}`,
      });
    }
  }

  /** Construye la nota + campos según a qué pieza llega el lead. */
  private avanzar(lead: Lead) {
    const idx = ORDEN.indexOf(lead.nodoActual);
    if (idx >= ORDEN.length - 1) return; // ya llegó al asesor

    const perfil = perfilDe(lead.senal.correo);
    const siguiente = ORDEN[idx + 1];
    const ahora = Date.now();

    // Error raro y realista: a veces Dapta no logra contactar.
    const esError = siguiente === "dapta" && Math.random() < 0.06;
    const estado = esError ? "error" : "en_proceso";

    let nota = "";
    const extra: Partial<Lead> = {};

    switch (siguiente) {
      case "backend":
        nota = `${lead.senal.nombre}: backend aplicó reglas H1–H10`;
        break;
      case "clustering":
        nota = `${lead.senal.nombre}: agrupada/o en clúster "${perfil.cluster}"`;
        extra.clusterId = perfil.cluster;
        extra.proyectosRecomendados = perfil.proyectos;
        break;
      case "dapta":
        nota = esError
          ? `${lead.senal.nombre}: Dapta no logró contactar (se reintenta)`
          : `${lead.senal.nombre}: Dapta inició la llamada`;
        break;
      case "asesor":
        this.ultimoEventoDaptaTs = ahora;
        extra.calificacion = perfil.califFinal;
        extra.resultadoDapta = {
          call_id: `call-${lead.id}`,
          call_status: "completed",
          calificacion_lead: perfil.califFinal,
          ahorros_cesantias_declarado: perfil.senal.afiliado
            ? "$6.000.000 en cesantías"
            : "No declara",
          vivienda_nombre_propio_o_herencia: "No",
          primas_incluidas_plan_pago: perfil.senal.afiliado,
          cesantias_futuras_incluidas: perfil.senal.afiliado,
          disponible_visita: perfil.califFinal !== "frio",
          resumen_llamada:
            perfil.califFinal === "caliente"
              ? "Muy interesado/a, quiere agendar visita esta semana."
              : "Interés moderado, pidió información por WhatsApp.",
        };
        nota = `${lead.senal.nombre}: calificado ${perfil.califFinal.toUpperCase()} → ficha enviada al asesor`;
        break;
    }

    const actualizado: Lead = {
      ...lead,
      ...extra,
      nodoActual: siguiente,
      estadoNodo: estado,
      timeline: [
        ...lead.timeline,
        { pieza: siguiente, estado, timestamp: ahora, timestampReal: true, nota },
      ],
      updatedAt: ahora,
    };

    this.emitir({ tipo: "actualizado", lead: actualizado, nota });

    // Un momento después, "en_proceso" -> "completado" (o el error se resuelve
    // y reintenta), para que la transición de estado se lea en la demo.
    if (estado === "en_proceso") {
      setTimeout(() => {
        const actual = this.leads.get(actualizado.id);
        if (!actual) return;
        this.emitir({
          tipo: "actualizado",
          lead: { ...actual, estadoNodo: "completado", updatedAt: Date.now() },
        });
      }, 1200);
    } else if (estado === "error") {
      // Se recupera: vuelve a "en_proceso" en Dapta tras el reintento.
      setTimeout(() => {
        const actual = this.leads.get(actualizado.id);
        if (!actual) return;
        this.emitir({
          tipo: "actualizado",
          lead: { ...actual, estadoNodo: "en_proceso", updatedAt: Date.now() },
          nota: `${lead.senal.nombre}: Dapta contactó en el reintento`,
        });
      }, 1600);
    }
  }

  suscribirseALeads(callback: (evento: LeadEvent) => void): Desuscribir {
    this.suscriptores.add(callback);

    if (!this.timer) {
      this.sembrar();
      this.timer = setInterval(() => {
        const enCurso = [...this.leads.values()].filter(
          (l) => l.nodoActual !== "asesor",
        );
        if (enCurso.length > 0) {
          // Avanza el que lleva más tiempo sin moverse (cola que progresa).
          enCurso.sort((a, b) => a.updatedAt - b.updatedAt);
          this.avanzar(enCurso[0]);
        } else if (this.leads.size < 8) {
          const perfil = PERFILES[this.contador % PERFILES.length];
          this.emitir({
            tipo: "nuevo",
            lead: crearLead(perfil, this.contador++),
            nota: `Nuevo lead entró por ${perfil.canal}`,
          });
        }
      }, 2800);
    }

    return () => {
      this.suscriptores.delete(callback);
      if (this.suscriptores.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  }

  async obtenerLeadPorId(id: string): Promise<Lead | null> {
    return this.leads.get(id) ?? null;
  }

  async obtenerEstadoPlugins(): Promise<EstadoPlugin[]> {
    const enDapta = [...this.leads.values()].some((l) => l.nodoActual === "dapta");
    return [
      {
        id: "supabase",
        nombre: "Supabase",
        icono: "🗄️",
        estado: "sin_datos",
        detalle: "Proyecto pendiente (se crea mañana)",
      },
      {
        id: "dapta",
        nombre: "Dapta",
        icono: "📞",
        estado: this.ultimoEventoDaptaTs ? "viva" : enDapta ? "viva" : "sin_datos",
        detalle: "Webhook de voz/WhatsApp",
        ultimoEventoTs: this.ultimoEventoDaptaTs,
      },
      {
        id: "backend",
        nombre: "Backend de reglas",
        icono: "🖥️",
        estado: "viva",
        detalle: "H1–H10 respondiendo (mock)",
      },
      {
        id: "clustering",
        nombre: "Clustering",
        icono: "🧩",
        estado: "viva",
        detalle: "Modelo mock (Santiago DS lo reemplaza)",
      },
    ];
  }

  // Expuesto solo por conveniencia para narración en UI.
  nombrePieza(id: PiezaId) {
    return NOMBRE_PIEZA[id];
  }
}
