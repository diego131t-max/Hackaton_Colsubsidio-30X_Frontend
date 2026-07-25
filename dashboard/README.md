# Dashboard interno de monitoreo

Panel de control **interno** del sistema (para el equipo y la demo al jurado).
**No** es la interfaz del cliente final — esa es el bowl en [`../frontend/`](../frontend/).

Es un **mapa de la operación en vivo**: las 5 piezas del sistema como nodos
conectados, y los leads como fichas que se deslizan de un nodo al siguiente
(el flujo de datos). Incluye un registro de actividad narrado, el estado de los
plugins y el detalle de cada lead.

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
    ├── SystemMap.tsx         # mapa de piezas + fichas de leads que fluyen
    ├── ActivityLog.tsx       # registro de actividad narrado
    ├── PluginsPanel.tsx      # estado de plugins/integraciones (solo estado)
    └── LeadDetail.tsx        # ficha completa de un lead
```
