/**
 * Simulador de operación — escribe en Supabase para ver el flujo REAL moverse.
 *
 * Inserta un lead y lo avanza etapa por etapa haciendo UPDATE en la tabla
 * `reto_vivienda_leads`. Cada UPDATE dispara Realtime y el dashboard se mueve
 * con datos REALES de la base (no simulados en el cliente). Es un stand-in del
 * backend/bowl mientras esos no existen.
 *
 * Uso:
 *   cd dashboard
 *   node scripts/simular.mjs            # inserta y avanza 1 lead
 *   node scripts/simular.mjs --loop     # sigue inyectando leads cada ~12s
 *
 * Lee las credenciales de .env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// --- Carga simple de .env (sin dependencias) -------------------------------
const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, "..", ".env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const client = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const TABLA = "reto_vivienda_leads";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PERFILES = [
  {
    canal: "pauta_digital",
    cluster: "VIS-Norte-familias",
    proyectos: ["Ciudadela VIS Norte", "Torres del Parque VIS"],
    calif: "caliente",
    senal: { tipo_vivienda: "vis", nombre: "Camila", apellido: "Rojas", correo: "camila.rojas@example.com", telefono_movil: "+57 300 222 3344", afiliado: true, ingresos_hogar_rango: "$2.000.000 – $3.500.000", edad: 29, personas_a_cargo: 1, zona_interes: "Suba", tipo_inmueble: "apartamento", entorno_deseado: "cerca a colegio" },
  },
  {
    canal: "instagram",
    cluster: "NoVIS-inversionista",
    proyectos: ["Nuva Park", "Reserva del Bosque"],
    calif: "tibio",
    senal: { tipo_vivienda: "no_vis", nombre: "Sebastián", apellido: "Díaz", correo: "sebastian.diaz@example.com", telefono_movil: "+57 301 555 6677", afiliado: false, ingresos_hogar_rango: "$7.115.001 – $10.000.000", edad: 45, personas_a_cargo: 0, zona_interes: "Chía", tipo_inmueble: "casa", entorno_deseado: "zona verde" },
  },
];

const PASOS = [
  { nodo: "backend", nota: "backend aplicó reglas H1–H10" },
  { nodo: "clustering", nota: "agrupada/o en clúster" },
  { nodo: "dapta", nota: "Dapta inició la llamada" },
  { nodo: "asesor", nota: "calificado → ficha enviada al asesor" },
];

async function procesarUnLead(perfil) {
  const timeline = [{ pieza: "bowl", estado: "completado", nota: "Completó el bowl" }];
  const { data, error } = await client
    .from(TABLA)
    .insert({ canal_origen: perfil.canal, nodo_actual: "bowl", estado_nodo: "completado", senal: perfil.senal, timeline })
    .select("id")
    .single();
  if (error) return console.error("insert:", error.message);
  const id = data.id;
  console.log(`+ lead ${perfil.senal.nombre} (${id})`);

  for (const paso of PASOS) {
    await sleep(2500);
    timeline.push({ pieza: paso.nodo, estado: "en_proceso", nota: `${perfil.senal.nombre}: ${paso.nota}` });
    const update = { nodo_actual: paso.nodo, estado_nodo: "en_proceso", timeline: [...timeline] };
    if (paso.nodo === "clustering") {
      update.cluster_id = perfil.cluster;
      update.proyectos_recomendados = perfil.proyectos;
    }
    if (paso.nodo === "asesor") {
      update.estado_nodo = "completado";
      update.calificacion = perfil.calif;
      update.resultado_dapta = { call_id: `call-${id}`, call_status: "completed", calificacion_lead: perfil.calif, resumen_llamada: "Lead procesado por el simulador." };
    }
    await client.from(TABLA).update(update).eq("id", id);
    console.log(`  → ${paso.nodo}`);
  }
}

const loop = process.argv.includes("--loop");
let i = 0;
do {
  await procesarUnLead(PERFILES[i++ % PERFILES.length]);
  if (loop) await sleep(9000);
} while (loop);
console.log("Listo.");
