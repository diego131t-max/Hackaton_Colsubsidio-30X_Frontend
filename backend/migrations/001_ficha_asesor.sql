-- Migración aplicada el 2026-08-18 sobre el proyecto Supabase COLSUBSIDIO-leads
-- (ref hignsutxlgbzyisqqgpy), tabla public.reto_vivienda_leads.
--
-- Se deja aquí para que el cambio de esquema quede en el repo: se aplicó desde
-- el dashboard de Supabase y sin este archivo sería invisible para el resto del
-- equipo (no hay migraciones versionadas en el proyecto todavía).
--
-- Es idempotente: se puede volver a correr sin romper nada.

-- recomendaciones_detalle: `proyectos_recomendados` guarda solo NOMBRES, así que
-- el match_score que ya calcula el modelo se perdía al persistir y el asesor no
-- podía ver por qué se recomendó cada proyecto. Se agrega una columna NUEVA en
-- vez de cambiar la existente a propósito: el dashboard de monitoreo ya lee
-- `proyectos_recomendados` como array de strings y las 111 filas históricas
-- tienen ese formato. Cambiarlo de tipo rompería ambos.
alter table public.reto_vivienda_leads
  add column if not exists recomendaciones_detalle jsonb not null default '[]'::jsonb;

comment on column public.reto_vivienda_leads.recomendaciones_detalle is
  'Top N del modelo con match_score y desglose: [{nombre_proyecto, match_score, match_desglose, precio_desde_cop, url_ficha}]. Espejo enriquecido de proyectos_recomendados, que se conserva como array de nombres por compatibilidad.';

-- agendado_para: Manuela agenda asesorías (virtual/presencial, 8am-4pm hábiles)
-- pero no había dónde guardar la fecha. Va como columna propia —y no solo dentro
-- del jsonb resultado_dapta— porque el asesor necesita ORDENAR y filtrar por
-- "quién tiene cita más próxima", y eso sobre jsonb es lento y frágil.
alter table public.reto_vivienda_leads
  add column if not exists agendado_para timestamptz;

comment on column public.reto_vivienda_leads.agendado_para is
  'Fecha/hora acordada en la llamada. Null = sin cita. La modalidad y el resto del detalle viven en resultado_dapta.';

-- El asesor abre la lista ordenada por cita más próxima; sin índice es un scan.
create index if not exists reto_vivienda_leads_agendado_para_idx
  on public.reto_vivienda_leads (agendado_para desc nulls last);

-- La vista del asesor filtra por calificación y ordena por actualización.
create index if not exists reto_vivienda_leads_calificacion_idx
  on public.reto_vivienda_leads (calificacion, updated_at desc);
