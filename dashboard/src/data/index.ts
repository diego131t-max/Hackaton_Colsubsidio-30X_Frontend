/**
 * Punto ÚNICO de selección de la fuente de datos.
 *
 * Para pasar de la demo (mock) a Supabase real, cambia SOLO estas líneas:
 * comenta MockDataSource, descomenta SupabaseDataSource. Nada más en el
 * dashboard necesita cambiar.
 */

import type { DataSource } from "./DataSource";
import { MockDataSource } from "./MockDataSource";
// import { SupabaseDataSource } from "./SupabaseDataSource";

export const dataSource: DataSource = new MockDataSource();
// export const dataSource: DataSource = new SupabaseDataSource(); // TODO: activar mañana

export type { DataSource } from "./DataSource";
