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
cp .env.example .env   # y rellenar con las credenciales de Supabase
npm run dev            # http://localhost:5174
```

**Fuente de datos automática:**
- Si `.env` tiene `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` → usa **Supabase real**
  (tabla `reto_vivienda_leads`, vía Realtime). El pill del header dice "Supabase".
- Si no → cae al **`MockDataSource`** (datos simulados), para demo sin base. Pill: "simulado".

### Ver el flujo REAL moverse

Con Supabase configurado, el dashboard muestra las filas reales, pero no se mueven
solas hasta que algo (el backend/bowl) las actualice. Para verlo en vivo hay un
**simulador** que escribe en la base (stand-in del backend):

```bash
node scripts/simular.mjs          # inserta y avanza 1 lead (UPDATEs reales)
node scripts/simular.mjs --loop   # sigue inyectando leads
```

Cada UPDATE dispara Realtime y el dashboard se anima con **datos reales**, no simulados.

## Patrón de datos (adaptador) — lo importante

El dashboard nunca sabe de dónde vienen los datos: habla contra la interfaz
[`DataSource`](src/data/DataSource.ts).

| Implementación | Estado | Archivo |
|---|---|---|
| `SupabaseDataSource` | **Activo** si hay `.env` (datos reales + Realtime) | [src/data/SupabaseDataSource.ts](src/data/SupabaseDataSource.ts) |
| `MockDataSource` | Fallback sin `.env` (demo simulada) | [src/data/MockDataSource.ts](src/data/MockDataSource.ts) |

La selección es automática en [src/data/index.ts](src/data/index.ts) según haya
credenciales o no. Ningún componente sabe de dónde vienen los datos.

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
