# Contexto para Claude Code — Grúa del Futuro (Colsubsidio × 30X)

## Qué es esto

Landing gamificada para el reto de vivienda de Colsubsidio. Quiz de 8
preguntas → construye visualmente una casa (vista de planta) → recomienda 6
proyectos reales → califica al lead (listo para asesor / en maduración) usando
la regla de cupo 90% afiliados / 10% no afiliados.

**La demo es SOLO de Bogotá.** El catálogo son los 31 proyectos de la ciudad
scrapeados de colsubsidio.com, cada uno ubicado en su **localidad** (Kennedy,
Suba, Fontibón…). Ya no se pregunta el municipio: la pregunta de ubicación es
directamente la localidad. Para volver a incluir el resto del país:
`python tools/scrape_proyectos.py --todo-el-pais` y revisar el scoring de
`matching.js`, que hoy razona en localidades.

## Dónde está el código real

**`frontend/`** — y solo `frontend/`. Es HTML/CSS/JS vanilla, sin framework y
**sin build step**: se abre `index.html` con cualquier servidor estático
(`npm run dev` levanta uno en el 5500). No hay bundler ni `node_modules`.

Este documento venía de un checkout suelto del frontend, donde la carpeta se
llamaba de otra forma; las rutas ya están adaptadas a este repo. Todos los
comandos `python tools/…` se corren **desde dentro de `frontend/`**.

## Arquitectura de `frontend/`

- `js/proyectos.js` — **GENERADO, no editar a mano.** El catálogo real: 31
  proyectos de Bogotá con área/habitaciones/baños/precio oficiales, bajados del
  sitio de Colsubsidio. Lo produce `tools/scrape_proyectos.py` (sitemap +
  `__NEXT_DATA__` de cada ficha; no necesita navegador). Para refrescarlo:
  `python tools/scrape_proyectos.py`.
  Exporta además `window.GDF_LOCALIDADES_VECINAS`: qué localidades colindan,
  calculado de los límites oficiales del Distrito (dos localidades son vecinas
  si comparten al menos 2 vértices). Lo usa `matching.js`.

  **Cómo se ubica cada proyecto en su localidad** (esto tiene trampa): se cruza
  la coordenada del mapa de la ficha con los polígonos oficiales de las 20
  localidades. Pero ese mapa es el de la **sala de ventas**, y varias
  constructoras usan una sola para varios proyectos — Acanto, Eskala y Florecer
  comparten punto, y para Eskala está mal (su proyecto está en Puente Aranda).
  Por eso, cuando el texto descriptivo de la ficha nombra una localidad, **ese
  texto gana**. No se usa geocodificación externa: Nominatim falla con la
  nomenclatura bogotana (ubicó "Carrera 15 # 63A-40" en Tunjuelito, a 10 km de
  donde va).
  Cada proyecto trae `tipologias[]` (Tipo A, Tipo B…) con área
  construida/privada, precio **en pesos**, fecha de entrega, los espacios que
  incluye (con ícono) y las imágenes de plano. **Los 31 las tienen** (81
  tipologías, 150 planos).

  Ojo al extraerlas: el CMS arma esa sección de **dos formas distintas**, y una
  versión anterior del scraper solo entendía la primera, dejando 7 proyectos
  sin planos. La segunda mete un nivel extra (`modular_tabs_select` →
  `tabs_select_item`, que es el desplegable "Etapa del proyecto" / "Torre"). Por
  eso `_buscar_specs` baja **recursivamente** hasta el
  `specifications_module_item` en vez de seguir una ruta fija. La etapa se
  arrastra y se antepone al nombre porque hace falta para desambiguar: La
  Arboleda tiene un "Tipo A" en la Etapa 2 y otro distinto en la Etapa 3, con
  precios diferentes.
- `js/simulador.js` — matemática del plan de pagos (amortización francesa) que
  reemplazó al "contacta a un asesor" de la ficha. **Todo lo que no sale del
  catálogo vive en `TASAS` y `SUPUESTOS`**, y cada constante dice si está
  verificada o pendiente:
  - **Verificadas** contra Colsubsidio: hipotecario en UVR al 4,36% E.A.
    categoría A y 5,45% categoría B, y en pesos desde ~10,7% E.A.
  - **Por confirmar** con el área hipotecaria: la tasa del complementario (16%
    E.A., un placeholder — no la publican), la de la **categoría C** en UVR
    (6,5% E.A., otro placeholder: solo publican las preferenciales de A y B, y
    se eligió un valor entre el de B y el de pesos) y el monto del subsidio.
  - Las tres categorías de afiliación viven en `CATEGORIAS`, con el rango de
    ingresos que las define; el control segmentado del simulador y el aviso que
    lo acompaña se generan de ahí, no a mano. Por eso el simulador **no arranca
    en UVR para un hogar categoría C**: se abre en pesos, que es la tasa que sí
    está publicada. La C se puede elegir igual, y donde se muestre su tasa la
    UI la rotula "por confirmar" (`simular()` devuelve
    `tasaEaPorConfirmar` para eso).
  - La tasa en UVR es **real**: la cuota que muestra el simulador es la del
    primer mes en pesos de hoy y sube con la inflación. La UI lo dice en el
    titular, no en la letra chica.
  - `maxLtv` (80% VIS / 70% No VIS) es el tope legal de financiación, y es la
    razón de ser del crédito complementario: con una cuota inicial del 10%
    ningún hipotecario cubre el resto, y ese faltante o se financia con el
    complementario o hay que ahorrarlo.
  - **El subsidio va sin nombre de programa a propósito.** Se rotula "subsidio
    estimado, sujeto a verificación" en toda la app: el esquema está en
    transición y no prometemos uno puntual. Si vuelve a aparecer "Mi Casa Ya"
    en el código, es un retroceso, no una mejora.
  - `planAhorro` convierte el ahorro en cuota mensual usando la fecha de
    entrega REAL de la tipología (`mesesHastaEntrega` parsea los cuatro
    formatos del catálogo: `'2028'`, `'Semestre 1 de 2028'`, `'Segundo
    semestre 2027'`, `'Final de 2029'`). Sin fecha usable cae a 36 meses y
    entonces la UI **no** dice "hasta la entrega".
  - Mover `SUPUESTOS.smmlv` (hoy el de 2026) obliga a rehacer a mano las
    pistas de la pregunta de ingresos en `data.js`.
- `js/data.js` — contenido estático (preguntas del quiz, avatares, amenidades).
  El catálogo sale de `proyectos.js`; los 26 de antes quedaron como
  `PROJECTS_RESPALDO` por si ese archivo no carga. Las opciones de localidad
  del quiz **se derivan del catálogo**, no se escriben a mano.
  Cada proyecto trae además `amenidades[]` — las zonas comunes reales de la
  ficha, con `label`, `icon` (el SVG del propio sitio) y `clave` del
  vocabulario de 26. Esa `clave` es la que cruza con el `entorno_deseado` que
  eligió el usuario para resaltar coincidencias en la tarjeta; las etiquetas
  que no encajan en el vocabulario ("Cuarto de residuos", "Ascensor") se
  muestran igual pero sin `clave`.
- `js/matching.js` — `computeMatches(answers, limite)`: scoring de proyectos.
  Cada resultado trae `factores` (qué sumó y qué restó), que alimenta el panel
  de depuración.
- `js/recommender.js` — capa adaptadora. Normaliza lo que llegue a un
  **view-model único** (`id`, `nombre`, `ubicacion`, `precioCop`, `area`,
  `habitaciones[]`, `vis`, `amenidades[]`, `score`, `origen`, `local`) para que
  `templates.js` no tenga ifs por origen de datos. `local` es el proyecto
  scrapeado equivalente (cruzado por nombre normalizado) y es lo que habilita
  imagen y planos; si no cruza, la tarjeta se pinta solo con lo del backend.
  Antes de llegar a la pantalla todo pasa por `presentar()`, que hace dos cosas
  **de presentación, no de ranking** (el orden lo sigue decidiendo
  `matching.js` o el backend):
  - `aplicarPodio` — los tres primeros SIEMPRE se muestran como **96 / 94 /
    89 %**. Es una decisión de demo: con la fórmula cruda, elegir una localidad
    con poca oferta (Usaquén tiene 1 proyecto) sacaba un "top 1" del 51 % y tres
    tarjetas seguidas con el mismo número, y parecía roto. Del cuarto en
    adelante se respeta el puntaje real, pero forzando un escalón hacia abajo.
    El calculado queda en `scoreReal` y el panel `#debug` muestra los dos.
  - `explicar` — redacta `vm.razon`, la frase de la tarjeta que dice por qué
    quedó en esa posición (localidad, habitaciones, precio contra el rango de
    ingresos, VIS/subsidio y las zonas comunes que marcó el usuario). Ojo al
    tocarla: las frases se unen con `listaNatural` (`a, b y c`), así que van
    **sin comas ni "y" internos**; por eso la de VIS va de última y la del
    entorno se recorta a una sola zona si le toca cerrar la lista.
- `js/config.js` — `API_BASE` y `RECOMMENDER`. Es el equivalente a variables de
  entorno para un sitio sin build step. `RECOMMENDER` vale `hibrido` (default),
  `backend` o `local` — ver abajo.
- **`data/proyectos_seed.json`** — nuestros 66 proyectos reales en el esquema
  que consume el backend, para que pueda reemplazar su catálogo de prueba. Lo
  genera `tools/generar_seed_backend.py`. **No editar a mano.**
- `js/qualification.js` — `computeLeadQualification(answers, bestScore)`:
  la pieza de negocio central. Implementa la regla 90/10 de afiliados,
  capacidad financiera y elegibilidad al subsidio de cuota inicial. Umbral
  ready/nurture en la constante `READY_THRESHOLD` (actualmente 60).
  Ojo: las reglas de `answers.ahorro` y `answers.primera` están escritas pero
  **dormidas** — el quiz ya no pregunta eso, así que nunca les llega dato.
- **El quiz arma el PLANO REAL de un apartamento, por partes.** No un esquema
  dibujado: la imagen que publica la ficha de Colsubsidio, con muebles
  renderizados, texturas y muros gruesos. Cada pieza que cae de la grúa es un
  recorte de esa imagen; cuando están todas, el conjunto es la imagen entera.

  **El apartamento es ILUSTRATIVO y ANÓNIMO**: en la escena **no se dice de qué
  proyecto es**.

  Cambia **una sola vez**: al contestar cuántas alcobas quiere
  (`ajustarPlantaAHabitaciones` en `state.js`), el plano pasa a ser uno que de
  verdad las tenga. Enseñar un apartaestudio a quien acaba de pedir tres alcobas
  era la incoherencia más visible que podía tener la escena. El cambio se ve
  bien porque **todas las plantas del sorteo se trocean igual** (12 celdas,
  `c0..c11`): cada pieza pintada encuentra su equivalente, se desplaza con la
  transición CSS y cruza a la imagen nueva (`reacomodarPlano` en `main.js`), en
  vez de morir y renacer.

  **La animación se dispara SIEMPRE que se contesta esa pregunta, cambie el
  plano o no** (`planta.ajustada`, que `updatePlantaDOM` lee). El plano
  provisional a veces ya tenía las alcobas pedidas —con 10 planos en el sorteo,
  1 de cada 3 veces— y entonces contestar no producía ninguna reacción: la misma
  acción unas veces movía el plano y otras se quedaba muerta. Lo que la
  animación dice es "tu plano quedó ajustado a lo que pediste", y eso es cierto
  en los dos casos. Ojo: `ajustada` reemplazó a `cambio`, que se escribía en
  tres sitios y **no lo leía nadie**.

  Sirve para enseñar
  cómo se construye una vivienda, nada más — la recomendación de verdad la
  calcula `matching.js` y sale en la pantalla de resultados. Por eso se quitaron
  el rótulo azul que lo nombraba y la marca de agua con la localidad: ponerle
  nombre invita a leerlo como la recomendación (que suele ser otro proyecto), y
  la localidad además chocaba con la que el usuario acababa de elegir en la
  pregunta de zona. Si vuelve a aparecer un nombre de proyecto sobre la escena,
  es un retroceso.

  - `tools/analizar_planos.py` → **`js/planos.js` (GENERADO, no editar)** —
    calcula por dónde cortar cada plano. Tres pasos, y los tres tienen trampa:
    1. **Recuadro de contenido por COMPONENTE CONEXA MAYOR**, no por
       `getbbox()`: varios planos traen un inserto suelto (Calia Tipo 2 tiene
       un recuadro punteado con una distribución alternativa) y el bbox se lo
       traga, dejando celdas de puro blanco.
    2. **Muros por perfil de proyección** (píxeles < 90 por columna y fila, 3
       picos verticales y 2 horizontales). Verificado: en Acanto Tipo C el corte
       al 84 % es la pared antes de "Cocina-Ropas". **No afinar esto con más
       heurística** — un mueble oscuro puede ganarle a un muro; para eso está
       `VETADOS`.

       Pero elegir los muros MÁS FUERTES no basta: no mira qué celdas produce, y
       como casi ninguna huella llena del todo su recuadro, dejaba celdas de
       papel casi en blanco que al armarse el plano **se leen como piezas que
       faltan** (Nogales A11 tenía dos, al 34 % y al 26 %; se veía roto). Por eso
       `elegir_cortes` sigue dando la razón a los muros más marcados, y **solo
       cuando dejan una celda por debajo de `UMBRAL_CELDA_MINIMA` (0,55) prueba
       otras combinaciones de muros**. Entre las que llegan al umbral gana la de
       muros más fuertes, **no la de celdas más llenas**: maximizar densidad a
       secas empujaba los cortes lejos de las paredes (123 de 150 láminas
       cambiaban, cortando por mitad de un mueble). Con esto Nogales pasó de
       26 % a 72 %, y el sorteo de 5 planos a 10.
    3. **Orden por ADYACENCIA** desde el centro de masa hacia afuera, para que
       el plano a medias sea siempre una mancha conexa. Por área descendente
       salen piezas flotando en el aire, que es el peor fallo visual posible.

    Y emite `vis[8]`: cuántas piezas se ven tras cada pregunta, repartidas por
    ÁREA de tinta y no por conteo. **El plano se cierra en la 7.ª pregunta**
    (`cierran=7`): así el apartamento queda TERMINADO justo al pintarse la
    última pregunta, que es la pantalla en la que se ve completo. En la 8.ª no
    se puede, porque al contestarla se salta a resultados, que ya no tiene
    escena, y lo que revelara esa respuesta no lo vería nadie. Se probó cerrar
    en la 6.ª para que el plano completo acompañara las dos últimas preguntas y
    se descartó: el remate tiene que caer con la última respuesta que todavía
    añade piezas.

    De los 150 planos quedan **36 aptos**: se descartan los que no son
    "decorado", los de ratio extremo, los que tienen insertos, y a mano los
    renders **isométricos** — como imagen fija se ven muy bien, pero el
    apartamento es un rombo dentro de un recuadro y la silueta gris prometería
    una forma que no es— y los que llevan **rótulos impresos** (`Alcoba 2 · 2.35
    x 2.25`, `Cocina-Ropas`). Esos últimos se vetaron porque la gracia es que el
    apartamento se lea como un espacio que se arma, no que venga con las
    respuestas escritas encima; y al trocearlo los rótulos quedaban partidos por
    las costuras. **No se intenta borrarlos de la imagen**: no hay forma de
    rellenar el suelo de madera de debajo sin que se note el parche.

    Y de esos 36, el quiz solo usa los **10 RECTANGULARES**
    (`GDF_PLANOS_RECTOS`): aquellos cuyas 12 celdas superan `UMBRAL_RECT`, que
    es exactamente `UMBRAL_CELDA_MINIMA` (0,55). O sea: **ninguna celda del
    sorteo se ve como papel en blanco**. Así la silueta es un rectángulo limpio
    y el plano se ve armarse entero, sin mordiscos en las esquinas.
    `GDF_PLANOS_APTOS` se conserva como respaldo por si esa lista se quedara
    vacía al regenerar.

    `UMBRAL_RECT` = `UMBRAL_CELDA_MINIMA` y hoy vale **0,70**, medido a ojo
    sobre la pantalla y no por estadística. Subirlo más rompe la cobertura de 1
    alcoba. Ojo: **ese umbral NO resuelve por sí solo el papel en blanco** —solo
    lo encoge—; lo que lo resuelve es el `multiply` de las piezas (ver la
    sección de `templates.js`).

    **Ojo al tocar los filtros**: el sorteo tiene que seguir cubriendo 1, 2 y 3
    alcobas (hoy: 2 / 5 / 3), porque de ahí sale el ajuste a lo que pide el
    usuario. Si un cambio de umbral deja alguna cifra sin planos,
    `elegirApartamento` cae al pool entero y vuelven las plantas con esquinas
    vacías.

    **Y todo el que entre al sorteo hay que mirarlo por ROTULOS IMPRESOS** —no
    hay detección automática, es curación a ojo en `VETADOS`—. Al ampliarse el sorteo se auditaron los planos nuevos y aparecieron dos rotulados (Centriko
    Tipo A, Urbania Terra Tipo 1). Los de La Arboleda llevan al pie un
    "*Sugerencia de distribución y acabados" y **no hace falta vetarlos**: ese
    texto va suelto, debajo del contorno, así que la componente conexa mayor lo
    deja fuera del recuadro y no cae en ninguna celda (ocupa las filas 463-476 y
    el recuadro termina en la 434).
  - `js/planta.js` — `elegirApartamento(state)` sortea uno con un hash FNV del
    nombre y apellido (misma persona → mismo plano; dos personas seguidas en un
    stand → planos distintos), y `geometriaCeldas` convierte los cortes en
    piezas con su CSS ya serializado.
  - `js/espacios.js` — sigue igual y **no se toca**: de aquí salen las alcobas
    y los m² del rótulo. Normaliza el `espacios[]` del catálogo (534 etiquetas
    escritas a mano) con reglas ORDENADAS. **El orden de la tabla ES el
    diseño**: `'Habitación principal con baño'` tiene que casar antes que la
    regla genérica de baño, y el número solo cuenta al PRINCIPIO de la etiqueta
    (`'3 habitaciones'` son 3; `'Habitación 2'` es 1). `GDF.espacios.auditar()`
    desde la consola audita las 81 tipologías. **Manda `espacios[]` sobre
    `p.hab`**: 25 de 81 discrepan y los casos son inequívocos (Infinitum
    Zentral Tipo H son 31,9 m² con una alcoba y `p.hab` dice 2), porque `hab`
    es dato de PROYECTO y la planta es de TIPOLOGÍA.
  - `js/scene.js` — cuántas piezas se ven ya. Cuenta RESPUESTAS PRESENTES, no
    `state.qi`: es lo que hace que retroceder funcione solo.

  **Cómo se recorta cada pieza** (`geometriaCeldas`): la pieza es una caja con
  `overflow:hidden` y dentro un `<i class="lienzo">` que lleva la imagen
  COMPLETA, dimensionado a `10000/W %` y desplazado a `−(L/W)·100 %`. Esas dos
  fórmulas dan siempre el tamaño de la losa **independientemente de W**, y de
  ahí sale la sangría gratis: agrandar la celda 0,4 puntos no estira ni
  desalinea nada, solo hace que solape con la vecina — que es lo que mata las
  costuras de subpíxel. Verificado poniendo la losa en magenta: no asoma ni una
  línea.

  La losa lleva `--ratio` (el del recuadro de contenido) y `--wmax` (su ancho
  real en píxeles, para no ampliarla y que se vea borrosa), y se mide con
  unidades de contenedor (`100cqh`): es la única forma en CSS de que un ancho
  dependa del ALTO del padre.

  `state.planta` **no es un valor derivado**: el parcheo de DOM necesita
  comparar lo que hay pintado contra lo que toca ahora.
- `js/state.js` — estado central (`createInitial`, `computeDerived`,
  `applyAction`). Sin librería de estado, es un objeto mutable simple.
- **`js/portada.js`** — **GENERADO, no editar a mano.** La portada de la app es
  el **clon literal** de `colsubsidio.com/vivienda/proyectos`: las tres barras
  de cabecera, Ciudadela Maiporé, Proyectos propios, Ciudades, Nuestros
  aliados, Más opciones para ti, el footer de pestañas y la pestaña rosada de
  encuesta, con SUS textos, SUS degradados y SUS imágenes (en
  `assets/portada/`, ~60 archivos, 3,4 MB). Lo produce
  `python tools/clonar_portada.py`.

  **La única franja que no es de ellos es el hero.** Ahí el original lleva el
  buscador (¿Dónde quieres vivir? / Elige zona o municipio / Nombre del
  proyecto + Buscar + el aviso azul); aquí se sustituye entero por
  **"Construye la casa de tus sueños"**, que es la puerta al quiz. Se conserva
  su marco —mismo degradado `linear-gradient(83deg,#F6F7FC,#A1D6EF)`, misma
  casa 3D amarilla, mismo cuerpo de título— para que el CTA se lea como parte
  del diseño y no como un injerto. **Si vuelven a aparecer los tres
  desplegables, es un retroceso: la portada se quedaría sin puerta.**

  El scraper tiene **dos pases** porque no todo está en el `__NEXT_DATA__`:
  menús, textos, degradados e imágenes sí (igual que `scrape_proyectos.py`),
  pero las tarjetas de *Proyectos propios* y los contadores de *Ciudades* son
  vistas de Drupal (`view--view`) que se resuelven en cliente, así que hay un
  pase con Playwright. **Los navegadores propios de Playwright no están
  bajados en esta máquina**: se lanza con `channel='msedge'`. Si ese pase
  falla, el script **conserva** esas dos franjas del archivo anterior en vez
  de dejarlas vacías.

  Su CSS **no se importa** (sus bundles de Next suman >250 KB de reglas
  globales que romperían el quiz). El aspecto se reescribe en `styles.css`
  bajo `.gdf-portada`, pero con los estilos **medidos** de la página real:
  `python tools/clonar_portada.py --medir` los vuelca a
  `tools/.estilos_portada.json`. Los tres anchos de contenedor
  (`.pt-ancho` / `-md` / `-xl`) son distintos a propósito: cada módulo del CMS
  trae el suyo y a 1440 px dan los x=205 / 100 / 37 reales.

  Tres trampas que costaron:
  - `.gdf-portada a { color: inherit }` le ganaba por especificidad a
    `.pt-mega-item` y dejaba la barra grafito con texto #333 sobre fondo #333
    (va con `:where()`, especificidad cero).
  - **El visor de los carruseles necesita `min-width: 0`**, y los tracks de
    grid que lo contienen, `minmax(0, 1fr)` en vez de `1fr`. Con el
    `min-width:auto` por defecto de grid/flex la pista crece con su contenido
    y el `flex-basis` en % de las tarjetas se resuelve contra un ancho
    indefinido: salía **una** tarjeta gigante en vez de tres. Pasó dos veces
    —en escritorio y luego otra vez en el media query de móvil—, así que es el
    primer sitio donde mirar si una franja se desborda.
  - **Cuántas tarjetas entran por página lo manda el CSS, no el JS.** Vive en
    `--por-pagina` de cada `.pt-pista` y cambia por breakpoint (3/2/1 en
    Proyectos propios). `porPaginaDe()` en `templates.js` lo lee con
    `getComputedStyle`, y `sincronizarPortada()` en `main.js` rehace los
    guiones tras cada render y al redimensionar. La tabla
    `PORTADA_CARRUSELES` es solo el valor de arranque, para el primer render
    en el que la pista aún no existe. **Si el conteo volviera a vivir solo en
    JS, en el teléfono se pintarían los 4 guiones del escritorio y las 6
    últimas tarjetas serían inalcanzables** — que es exactamente el fallo que
    tenía.

  En móvil, además: la barra de categorías pasa a ser una tira que se desliza
  con el dedo, la tarjeta de precios de Maiporé apila sus dos valores (en una
  línea, `$149.182.800` a 36 px no cabe), Más opciones pierde el "asomo" de
  las tarjetas vecinas (`--ancho`/`--paso`/`--sangria` a 100/100/0), los
  guiones se encogen y envuelven (14 ciudades = 14 páginas, y a tamaño de
  escritorio empujaban las flechas fuera de la pantalla) y los dos sellos de
  vigilancia se reparten la fila con `flex: 1 1 0`.
- `js/templates.js` — un string de HTML por pantalla. El flujo es
  portada → splash → escarapela → quiz → **result** (selección de proyectos,
  ya SIN la casa, con selección múltiple) → **confirmacion** (cierre). Ojo: la
  pantalla se sigue llamando `'landing'` en `state.screen` y la función
  `landing()`, para no renombrar acciones y CSS que ya funcionan. Sin
  virtual DOM: `main.js` reconstruye todo el `innerHTML` en cada cambio.
  `quiz()` está partido en `sceneBlock` + `quizPanel` justamente para que
  `main.js` pueda repintar solo el panel (ver el parcheo dirigido más abajo).
  `sceneBlock` pinta dos capas: `.gdf-silueta` (un hueco gris por celda con
  contenido, presente desde ANTES de la primera respuesta) y encima las piezas
  reveladas.

  **EL PAPEL BLANCO DEL PLANO NO SE VE.** Lo que se trocea es el rectángulo que
  encierra al plano, pero casi ningún apartamento es un rectángulo: en las
  esquinas donde no llega queda papel en blanco, y con el plano ya armado esos
  blancos **se leen como piezas que faltan**. Se intentó por dos vías que no
  bastan y conviene no repetir: elegir mejor los cortes y exigir plantas más
  llenas (`UMBRAL_CELDA_MINIMA`) los encoge pero nunca los elimina — pedir "3
  alcobas" y "recuadro lleno" a la vez es **imposible** en este catálogo, porque
  los planos de 3 alcobas o son en L o llevan rótulos.
  Lo resuelve `mix-blend-mode: multiply` en `.gdf-room`: el blanco puro deja
  pasar el fondo tal cual y el papel desaparece. Tres detalles que costaron:
  - va en `.gdf-room`, no en el `.lienzo`;
  - `.gdf-losa` **no puede llevar `filter`** (tenía un `drop-shadow`): un filtro
    aísla la mezcla de sus descendientes y el papel volvía a taparlo todo. La
    sombra es ahora `box-shadow`, que no aísla;
  - la losa se centra con `transform`, que crea contexto de apilamiento, así que
    la mezcla **nunca** llega hasta la escena. Por eso la losa lleva
    `background-color: inherit`: toma el color de `.gdf-scene` (incluidos los
    cambios de la pregunta del piso) y blanco × fondo = fondo.
  Y por eso `apagarHueco` (`main.js`) apaga el hueco gris en cuanto su pieza
  cae encima: si siguiera debajo, la pieza se multiplicaría contra él y el plano
  entero saldría entintado de gris. La silueta hace tres cosas a la vez: enseña la forma real del
  apartamento, da un sitio donde caer a cada pieza en vez de que aparezca
  flotando, y —al existir la losa desde el primer render— **elimina el único
  caso en que la escena tenía que reconstruirse por `innerHTML` a mitad del
  quiz**.
  Con `#debug` en la URL aparece un panel que explica el puntaje de cada
  proyecto — útil para comparar contra el clustering.
  Cada tarjeta de proyecto trae un `<details>` con los planos por tipología.
  Ese `<details>` lleva `data-action="noop"` a propósito: sin eso, cualquier
  clic ahí adentro burbujearía hasta el `chooseProject` de la tarjeta y
  marcaría el proyecto sin querer.

  **El simulador es un overlay de dos pasos** (`simuladorOverlay`), no un
  bloque dentro de la tarjeta: ahí solo queda el botón que lo abre
  (`simuladorBoton`, que pasa la tipología abierta para que se simule el
  precio que el usuario está viendo). Paso 1 = elegir producto viendo ya la
  cuota de cada uno; elegir **no cierra**, avanza al paso 2, que es el
  simulador completo (encabezado del proyecto, controles a la izquierda,
  recibo en vivo a la derecha). El overlay se pinta como último hijo de
  `.gdf-shell` para que su `position:fixed` sea contra el viewport y no
  contra una tarjeta con `overflow:hidden`.

  En móvil el recibo lleva `order: -1`: en una sola columna, dejarlo después
  de los seis controles hacía que abrieras el simulador sin ver la cuota.

  Antes esto era un `<details class="gdf-sim">` dentro de la tarjeta más un
  modal aparte. **No vuelvas a meter el simulador en un `<details>`**: pintar
  `<details open>` con `innerHTML` dispara un evento `toggle` asíncrono, y
  como el toggle abría el modal y el modal re-renderizaba el `<details>`
  abierto, el resultado era un bucle infinito de renders (el modal titilaba y
  no se podía cerrar).
- `js/main.js` — bootstrap, listener delegado por `data-action`, y los casos
  que **no** pasan por un re-render completo, porque reconstruir el
  `innerHTML` perdería algo:
  - inputs de nombre/teléfono → perderían el foco en cada tecla;
  - los cuatro carruseles y el footer de pestañas de la portada → un
    re-render redispararía las animaciones de entrada de toda la portada y,
    peor, cortaría la transición CSS de la pista, con lo que el carrusel
    saltaría de página en vez de deslizarse. `updatePortadaSlideDOM` solo
    escribe `--i` en la pista: **el desplazamiento lo calcula el CSS** con
    `--paso`/`--sangria`, para que el "asomo" de las tarjetas vecinas de *Más
    opciones* viva junto al resto de su geometría y no haya dos sitios que
    tengan que ponerse de acuerdo en la misma fórmula. Los carruseles **no
    avanzan solos**, igual que en la página real;
  - pestañas de tipología → cerrarían el `<details>` y recargarían las
    imágenes de los planos;
  - controles del simulador (`simSet`, más el slider de plazo y el input de
    ingreso) → `updateSimuladorDOM` repinta SOLO `#simResultado` y mueve la
    clase `.active` de los botones. Un re-render completo perdería el foco
    del input de ingreso y cortaría el arrastre del slider.
  - **avanzar o retroceder dentro del quiz** → `updateQuizDOM`: repinta el
    panel de la pregunta (que no tiene nada que preservar) y parchea la escena
    pieza a pieza casándolas por `data-room`. Reconstruir el `innerHTML`
    destruiría los nodos, y entonces cada respuesta rehace el plano entero en
    vez de añadirle una pieza. Quién cae de la grúa lo decide el patcher
    comparando contra el DOM, que es la única fuente de verdad de "esto es
    nuevo" — por eso `buildRooms` devuelve `animated: false` siempre.
    Ojo: `updateQuizDOM` **tiene que volver a llamar a `attachInputListeners()`**
    o mueren el input de `edad` y el buscador de `entorno_deseado`, y el fallo
    es silencioso hasta que alguien llega a esas preguntas.
  Cuando el re-render **sí** ocurre (marcar un proyecto), el estado del
  desplegable se restaura desde `state` (`detalleAbierto`, `tipologiaActiva`,
  `simConfig`), y `render()` suprime las animaciones de entrada de
  `.gdf-screen` y `.gdf-project-card` y restaura el scroll — si no, se ve como
  si la página se recargara.

## El contrato con el backend (dos pasos)

Está desplegado en Render y su OpenAPI (`{API_BASE}/openapi.json`) es la fuente
de verdad — consúltalo antes de asumir nada.

1. Al terminar el quiz: `POST /recomendaciones` con el SenalBowl → `200` con
   `{ lead_id, total_catalogo, origen_catalogo, recomendaciones[] }`, top 6 ya
   ordenado por `match_score`.
2. Al confirmar: `POST /leads?lead_id=…` con el **SenalBowl completo** más
   `proyecto_elegido`. No es un `{proyecto_elegido}` suelto. Se dispara SOLO
   al entrar a la pantalla de cierre (`main.js`, mismo patrón que el paso 1 al
   entrar a `result`) — elegir el proyecto y tocar "Continuar" ya es la
   confirmación, no hay un botón aparte que decir "sí, confirmar". Esa
   pantalla (`confirmacion()` en `templates.js`) solo relata en qué estado va
   el envío: spinner mientras viaja, un check grande de cierre si llegó, o
   error con reintento si no. Cuando llega bien, además muestra una tarjeta de
   contacto (**solo llamada** — nada de WhatsApp, así lo pidió el negocio) con
   el número exacto, y una línea de tiempo "Qué sigue" de 3 pasos
   (`pasosSiguientesHtml`), cuyo segundo paso cambia de redacción según
   `lead.status`: a un lead "ready" se le promete agendar visita, a uno
   "nurture" primero una llamada de acompañamiento — prometerle lo mismo a los
   dos sería la parte menos auténtica de la pantalla. Toda la pantalla usa la
   paleta oficial de marca (azul `#0067B1`, amarillo `#FFD000`, grafito
   `#575756` — ver `design/landing-hero-handoff/README.md` → Design Tokens),
   incluido su propio degradado de fondo (lo lleva escrito en `styles.css`, no
   lo hereda de la portada, que hoy usa el de Colsubsidio); el único
   color fuera de esa paleta es el naranja del estado de error, a propósito
   (un error tiene que leerse como error, no como un momento de marca).

Detalles que costaron descubrir y conviene no volver a tropezar:

- **`zona_interes` se cruza contra LOCALIDADES de Bogotá** (Kennedy, Suba,
  Bosa…). Las zonas cardinales que publica el CMS de Colsubsidio (Occidente,
  Norte…) y los municipios (Soacha, Chía…) devuelven `[]`.
- **El modo por defecto es `hibrido`**: las tarjetas son los 31 proyectos
  REALES (con foto, planos y tipologías) y el lead se registra igual en el
  backend, porque de `POST /recomendaciones` sale el `lead_id` que necesita la
  confirmación. No se muestran las recomendaciones del backend porque su
  catálogo es sintético ("Portal Real", "Villas del Rio"…), ninguno de sus
  proyectos tiene foto y no tiene nada en Fontibón ni Los Mártires, donde
  nosotros tenemos 10. Cuando adopten `data/proyectos_seed.json`, basta poner
  `RECOMMENDER: 'backend'`.
- **`entorno_deseado` es un array de 26 etiquetas exactas**, con erratas
  incluidas (`gymnasio`, `cancha e padel`, `zona de lavanderia`, `zona kid`).
  La lista está duplicada en `data.js` y en `tools/generar_seed_backend.py`.
- `recomendaciones: []` **no es un error**: el backend respondió bien y no
  tiene nada en esa zona. La UI lo distingue de un fallo de red porque
  reintentar no lo arregla.
- El plan gratuito de Render **duerme**: la primera llamada puede tardar ~25 s.

## Convenciones

- Todo el código y comentarios en español, consistente con lo ya escrito.
- Sin build step. No introduzcas bundlers, TypeScript, ni un framework sin
  que el usuario lo pida explícitamente — la app funciona hoy tal cual.
- Los datos del catálogo de proyectos y las reglas de calificación son
  ilustrativos para la demo (ver el disclaimer en `templates.js` → `result`);
  no hay integración real con el catálogo de Colsubsidio ni con WhatsApp.
- **La portada usa contenido e imágenes de Colsubsidio tal cual.** Es una demo
  para ellos, así que está bien; pero conviene saberlo si esto se publica en un
  dominio propio. Lo que se clona es la **cáscara**: los desplegables del
  mega-menú no abren panel, el widget de accesibilidad no hace nada y ninguno
  de sus enlaces navega (van con `data-action="noop"`, que además corta la
  navegación del `href="#"` para que no salte el scroll). Lo único que actúa
  en toda la portada es el CTA "Construir mi casa".

## Otros lugares relacionados (fuera de esta carpeta)

- **`frontend/design/landing-hero-handoff/`** — spec
  visual de la pantalla de entrada (colores exactos, tipografía, timings de
  animación). Es referencia de diseño, no código para copiar tal cual.
- **`frontend/docs/claude-design-projects.md`** — links a proyectos relacionados en
  claude.ai/design (herramienta de diseño en la nube, requiere
  `/design consent` en Claude Code para poder leerlos). Contienen prototipos
  interactivos anteriores con lógica parecida pero no idéntica a `frontend/` — no
  asumas que están sincronizados con este código.
