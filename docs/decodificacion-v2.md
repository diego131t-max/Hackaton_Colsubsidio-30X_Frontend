# Decodificación v2 — base real `hackathon_VIVIENDAv2.xlsx`

Fuente de verdad: `hackathon_VIVIENDAv2.xlsx`, hoja `CV_SSS_VIV_PENETRACION_PERFIL_C`,
**4.142 filas × 16 columnas**. Reemplaza los datos mock calibrados a mano del MVP.

## Conteos de SEGMENTO_POBLACIONAL (verificados contra el brief)

| Código | Etiqueta documentada | Registros |
|---|---|---|
| KAPPA | Básico | 1.440 |
| SIGMA | Medio | 871 |
| NU | Joven | 708 |
| IOTA | Alto | 1 |
| **PI** | **sin identificar** | **1.122 (27%)** |

Total = 4.142 ✓ (calza exacto con las cifras documentadas).

---

## Hallazgo principal: qué es PI

**PI NO es un segmento poblacional demográfico como los otros cuatro. Es el
grupo de registros SIN perfil de afiliación** (con toda probabilidad, **no
afiliados** a Colsubsidio). Nivel de confianza: **ALTO**.

### Evidencia (conteos y proporciones, no supuestos)

**1. PI equivale exactamente a dos códigos "propios" en otras columnas:**
- `PI` ⟺ `CATEGORIA = CHI` (correspondencia 1:1 perfecta: 1.122 = 1.122)
- `PI` ⟺ `PIRAMIDE_NUEVA = XI` (correspondencia 1:1 perfecta: 1.122 = 1.122)
- CHI y XI **no aparecen en ningún otro segmento**. Es decir, KAPPA/SIGMA/NU/IOTA
  nunca son CHI ni XI. PI vive en un "carril" separado de la taxonomía.

**2. PI tiene 100% de nulos en TODAS las variables demográficas y de afiliación:**

| Columna | KAPPA | SIGMA | NU | **PI** | IOTA |
|---|---|---|---|---|---|
| RANGO_EDAD (nulo %) | 0 | 0 | 0 | **100** | 0 |
| NO_GRUPO_FAMILAR (nulo %) | 32 | 20 | 98* | **100** | 0 |
| NO_BENEFICIARIOS_CUOTA (nulo %) | 47 | 44 | 98* | **100** | 100 |
| **PERIODO_AFILIADO (nulo %)** | **0** | **0** | **0** | **100** | **0** |
| EMPRESA_FOCO (nulo %) | 90 | 80 | 74 | **100** | 100 |

La fila clave es **PERIODO_AFILIADO**: KAPPA/SIGMA/NU/IOTA tienen **afiliación en
el 100%** de sus registros; **PI no tiene afiliación en ninguno**. Ese es el
indicador directo de que PI = registros sin vínculo de afiliación.
(*) NU no reporta grupo familiar/beneficiarios, pero sí tiene afiliación y edad.

**3. Pero PI SÍ se comporta como comprador real (no es basura ni registros vacíos):**
- Tiene `VLR_VIVIENDA` en el 100% de los casos (0% nulo) — son transacciones reales.
- Su distribución de `MEDIO` (canal/financiación) es prácticamente igual a la de
  los otros segmentos (p. ej. "Banderas y/o señalización" ~44%, Ferias, Referido…).
- Compra los mismos proyectos top de la base (Verde Esperanza El Dorado, Los
  Nogales, Monguí, La Arboleda, INARI, La Macarena…).

### Interpretación

Los códigos **KAPPA/SIGMA/NU/IOTA son segmentos poblacionales de AFILIADOS**
(Básico/Medio/Joven/Alto): solo un afiliado recibe una clasificación poblacional.
**PI (=CHI=XI) es el cubo de los que NO tienen ese perfil** — compradores/leads
sin afiliación cargada. Que sea el **27% de la base** es coherente: una porción
grande de los compradores de vivienda no son afiliados a la Caja.

Esto conecta directamente con **H1** del sistema (`afiliacion.tipo`): PI ≈ la
población `no_afiliado`.

### Decisión de tratamiento (honesta para el pitch)

- Se trata a **PI como un quinto grupo separado y explícito**: `"PI — no
  poblacional (sin perfil de afiliación / no afiliado)"`. **No** se fuerza dentro
  de Básico/Medio/Joven/Alto.
- **No se imputan** demografía ni edad a PI (no existen): cualquier
  personalización de PI debe apoyarse en variables comerciales (proyecto, valor,
  canal), **no** en demografía.
- Para clustering y bandas de precio, PI se calcula como **grupo propio** a partir
  de `VLR_VIVIENDA` y variables comerciales, nunca mezclado con otro segmento.

### Lo que NO afirmamos (límites del hallazgo)

- No confirmamos la etiqueta exacta "no afiliado" vs "afiliado sin perfil
  poblacional cargado". La evidencia (100% sin PERIODO_AFILIADO) apunta fuerte a
  no afiliado, pero para el sistema el tratamiento es el mismo: bucket sin perfil.
- `CATEGORIA` y `PIRAMIDE_NUEVA` siguen **sin decodificar** en sus otros valores
  (solo confirmamos CHI/XI ⟺ PI). No usar sus demás códigos como si estuvieran
  validados.

---

## Pendientes de calidad de datos (para los pasos siguientes)

- **VLR_VIVIENDA**: formato con ceros de más (crudo ~0,75–10 billones). Falta la
  función de limpieza validada contra valores conocidos (VIS típico 150–250 M).
  Se resuelve en el paso de clustering/bandas de precio. NO usar la columna cruda.
- **FECHA_DESISTIMIENTO**: está llena en el 100% (hay un centinela); `notna()` no
  sirve para la tasa de desistimiento. La tasa real (~13,3% del brief) se calcula
  con el criterio correcto en el paso de conocimiento de Manuela.
