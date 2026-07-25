# Dashboard interno de monitoreo

Panel de control **interno** del sistema (para el equipo y la demo al jurado).
**No** es la interfaz del cliente final — esa es el bowl en [`../frontend/`](../frontend/).

Muestra en tiempo real: el flujo de triggers del pipeline, el feed de leads, el
estado de las integraciones y el detalle de cada lead.

## Correr

```bash
cd dashboard
npm install
npm run dev        # http://localhost:5174
```

Funciona **sin backend ni Supabase**: usa un `MockDataSource` que simula leads
avanzando por el pipeline.

## Patrón de datos (adaptador) — lo importante

El dashboard nunca sabe de dónde vienen los datos: habla contra la interfaz
[`DataSource`](src/data/DataSource.ts).

| Implementación | Estado | Archivo |
|---|---|---|
| `MockDataSource` | **Activo** (demo) | [src/data/MockDataSource.ts](src/data/MockDataSource.ts) |
| `SupabaseDataSource` | Stub con TODOs | [src/data/SupabaseDataSource.ts](src/data/SupabaseDataSource.ts) |

**Para pasar a Supabase mañana:** llenar `SupabaseDataSource` (URL, canal
Realtime de la tabla `leads`, mapeo de filas) y cambiar **una línea** en
[src/data/index.ts](src/data/index.ts). Ningún componente se toca.

## Estructura

```
src/
├── types.ts                 # espejo del contrato del backend (SenalBowl, etc.)
├── data/
│   ├── DataSource.ts        # interfaz (el puerto)
│   ├── MockDataSource.ts    # demo: eventos simulados
│   ├── SupabaseDataSource.ts# stub Realtime (TODO)
│   └── index.ts             # punto único para elegir la fuente
└── components/
    ├── PipelineFlow.tsx      # flujo de triggers en vivo
    ├── LeadsFeed.tsx         # feed de leads
    ├── IntegrationsPanel.tsx # salud de integraciones
    └── LeadDetail.tsx        # ficha completa de un lead
```
