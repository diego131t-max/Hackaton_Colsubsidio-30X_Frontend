/**
 * MockDataSource — implementación de DataSource con datos SIMULADOS.
 *
 * Sirve para que el dashboard funcione y se vea bien en la demo AUNQUE Supabase
 * todavía no exista. Genera eventos realistas: leads que avanzan de etapa cada
 * pocos segundos, sembrados con los perfiles de prueba del equipo.
 *
 * Cuando Supabase esté listo, NO se toca este archivo: se cambia la fuente en
 * src/data/index.ts por SupabaseDataSource.
 */

import type {
  Calificacion,
  EstadoIntegraciones,
  Lead,
  LeadEvent,
  SenalBowl,
} from "../types";
import { ETAPAS } from "../types";
import type { DataSource, Desuscribir } from "./DataSource";

// --- Perfiles de prueba que ya usa el equipo ------------------------------- //
const PERFILES: { senal: SenalBowl; canal: string; califFinal: Calificacion }[] = [
  {
    canal: "pauta_digital",
    califFinal: "caliente",
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

const ORDEN_ETAPAS = ETAPAS.map((e) => e.id);

function crearLead(
  perfil: (typeof PERFILES)[number],
  indice: number,
): Lead {
  const ahora = Date.now();
  return {
    id: `lead-${indice}-${Math.random().toString(36).slice(2, 7)}`,
    senal: perfil.senal,
    canal_origen: perfil.canal,
    etapaActual: "bowl_completado",
    estadoEtapaActual: "completado",
    timeline: [
      { etapa: "bowl_completado", estado: "completado", timestamp: ahora },
    ],
    updatedAt: ahora,
  };
}

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
      const lead = crearLead(perfil, this.contador++);
      this.emitir({ tipo: "nuevo", lead });
    }
  }

  /** Avanza un lead a la siguiente etapa (o lo deja en la última). */
  private avanzar(lead: Lead) {
    const idx = ORDEN_ETAPAS.indexOf(lead.etapaActual);
    if (idx >= ORDEN_ETAPAS.length - 1) return; // ya terminó

    const perfil = PERFILES.find(
      (p) => p.senal.correo === lead.senal.correo,
    );
    const siguiente = ORDEN_ETAPAS[idx + 1];
    const ahora = Date.now();

    // 8% de probabilidad de simular un error en Dapta (para ver el estado error).
    const esError = siguiente === "dapta_llamando" && Math.random() < 0.08;
    const estado = esError ? "error" : "en_proceso";

    const actualizado: Lead = {
      ...lead,
      etapaActual: siguiente,
      estadoEtapaActual: estado,
      timeline: [...lead.timeline, { etapa: siguiente, estado, timestamp: ahora }],
      updatedAt: ahora,
    };

    // Al llegar el resultado de calificación, adjuntamos el ResultadoDapta.
    if (siguiente === "resultado_calificacion" && perfil) {
      this.ultimoEventoDaptaTs = ahora;
      actualizado.calificacion = perfil.califFinal;
      actualizado.resultadoDapta = {
        call_id: `call-${lead.id}`,
        call_status: "completed",
        calificacion_lead: perfil.califFinal,
        ahorros_cesantias_declarado:
          perfil.senal.afiliado ? "$6.000.000 en cesantías" : "No declara",
        vivienda_nombre_propio_o_herencia: "No",
        primas_incluidas_plan_pago: perfil.senal.afiliado,
        cesantias_futuras_incluidas: perfil.senal.afiliado,
        disponible_visita: perfil.califFinal !== "frio",
        resumen_llamada:
          perfil.califFinal === "caliente"
            ? "Muy interesado/a, quiere agendar visita esta semana."
            : "Interés moderado, pidió información por WhatsApp.",
      };
    }

    this.emitir({ tipo: "actualizado", lead: actualizado });

    // Si quedó en_proceso, lo pasamos a completado un momento después para que
    // la animación de "en proceso -> completado" se lea en la demo.
    if (estado === "en_proceso") {
      setTimeout(() => {
        const completado: Lead = {
          ...this.leads.get(actualizado.id)!,
          estadoEtapaActual: "completado",
          updatedAt: Date.now(),
        };
        this.emitir({ tipo: "actualizado", lead: completado });
      }, 1400);
    }
  }

  suscribirseALeads(callback: (evento: LeadEvent) => void): Desuscribir {
    this.suscriptores.add(callback);

    // Primer suscriptor arranca la simulación.
    if (!this.timer) {
      this.sembrar();
      this.timer = setInterval(() => {
        // Escoge un lead que aún no haya terminado y lo avanza.
        const enCurso = [...this.leads.values()].filter(
          (l) => l.etapaActual !== "ficha_traspaso",
        );
        if (enCurso.length > 0) {
          const l = enCurso[Math.floor(Math.random() * enCurso.length)];
          this.avanzar(l);
        } else if (this.leads.size < 9) {
          // Todos terminaron: inyecta un lead nuevo (reusa un perfil de prueba).
          const perfil = PERFILES[this.contador % PERFILES.length];
          this.emitir({ tipo: "nuevo", lead: crearLead(perfil, this.contador++) });
        }
      }, 2600);
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

  async obtenerEstadoIntegraciones(): Promise<EstadoIntegraciones> {
    // Mock: Supabase aún no existe, así que lo reportamos como "desconocida".
    return {
      supabase: {
        estado: "desconocida",
        detalle: "Proyecto Supabase pendiente (se crea mañana).",
      },
      daptaWebhook: {
        estado: this.ultimoEventoDaptaTs ? "viva" : "desconocida",
        ultimoEventoTs: this.ultimoEventoDaptaTs,
      },
      backendReglas: {
        estado: "viva",
        detalle: "Motor de reglas H1–H10 respondiendo (mock).",
      },
    };
  }
}
