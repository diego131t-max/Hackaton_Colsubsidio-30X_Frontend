/**
 * Punto ÚNICO de selección de la fuente de datos.
 *
 * Si hay credenciales de Supabase en el entorno (.env con VITE_SUPABASE_*),
 * usa datos REALES (SupabaseDataSource). Si no, cae al MockDataSource para que
 * el dashboard siga funcionando en la demo sin backend ni base.
 *
 * Para forzar el mock aunque haya .env, comenta la rama de Supabase.
 */

import type { DataSource } from "./DataSource";
import { MockDataSource } from "./MockDataSource";
import { SupabaseDataSource } from "./SupabaseDataSource";

const haySupabase =
  !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;

export const dataSource: DataSource = haySupabase
  ? new SupabaseDataSource()
  : new MockDataSource();

// Útil para mostrar en la UI de dónde vienen los datos.
export const fuenteActiva: "supabase" | "mock" = haySupabase ? "supabase" : "mock";

export type { DataSource } from "./DataSource";
