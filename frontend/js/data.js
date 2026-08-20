// Datos estáticos: preguntas del quiz, geometría del plano, catálogo de
// proyectos y avatares. Portado literalmente desde grua-del-futuro/src/App.jsx
// (mismos campos, mismo orden, mismas opciones) — la única pieza nueva es GENDERS.
(function () {
  'use strict';

  // EL ORDEN NO ES ARBITRARIO. Va de lo que mas define la recomendacion a lo
  // que menos: capacidad de compra (tipo, ingresos) -> necesidad (personas,
  // habitaciones) -> ubicacion (zona) -> preferencias (piso, entorno) -> edad.
  //
  // El motivo es la ESCENA. El plano se cierra al contestar la 7.a pregunta
  // (`cierran=7` en tools/analizar_planos.py) porque la 8.a salta a resultados
  // y lo que revelara no lo veria nadie. Asi que la ultima pregunta tiene que
  // ser la que MENOS mueva el plano, o se veria cambiar la recomendacion sin
  // tiempo de redibujarla. Medido sobre 600 quices al azar, cuanto mueve el
  // plano cada una: ingresos 69 %, habitaciones 66 %, tipo 51 %, zona 45 %,
  // personas 16 %, entorno 7 %, edad 3 %, piso 0 %. Por eso `edad` va de
  // ultima y las dos de mas peso van de primeras.
  var QUESTIONS = [
    {
      id: 'tipo',
      color: '#0067b1',
      w: 92,
      title: '¿Qué tipo de vivienda buscas?',
      sub: 'Esto define a qué proyectos y subsidios puedes acceder.',
      cols: 1,
      options: [
        { v: 'VIS', label: 'VIS', hint: 'Vivienda de interés social · aplica subsidio' },
        { v: 'No VIS', label: 'No VIS', hint: 'Financiación flexible · sin subsidio' },
      ],
    },
    {
      id: 'ingresos',
      color: '#ffd000',
      w: 84,
      title: '¿Cuánto suman los ingresos de tu hogar?',
      sub: 'Esto define a qué proyectos y subsidios puedes acceder.',
      cols: 1,
      options: [
        // Las cifras salen del SMMLV que usa js/simulador.js (SUPUESTOS.smmlv,
        // 2026): moverlo allá obliga a rehacer estas pistas.
        { v: '≤2 SMMLV', label: 'Hasta 2 SMMLV', hint: '≈ hasta $3.5M al mes' },
        { v: '2–4 SMMLV', label: '2 a 4 SMMLV', hint: '≈ $3.5M – $7.0M' },
        { v: '4–8 SMMLV', label: '4 a 8 SMMLV', hint: '≈ $7.0M – $14.0M' },
        { v: '8+ SMMLV', label: 'Más de 8 SMMLV', hint: '≈ más de $14.0M' },
      ],
    },
    {
      id: 'personas',
      color: '#4a94cc',
      w: 78,
      title: '¿Cuántas personas tienes a cargo?',
      sub: 'Cuenta a quienes dependen económicamente de ti.',
      cols: 5,
      options: [
        { v: '0', label: '0' },
        { v: '1', label: '1' },
        { v: '2', label: '2' },
        { v: '3', label: '3' },
        { v: '4+', label: '4+' },
      ],
    },
    {
      id: 'habitaciones',
      color: '#ffd000',
      w: 72,
      title: '¿Cuántas habitaciones necesitas?',
      sub: 'Así ajustamos el tamaño de tu hogar.',
      cols: 3,
      options: [
        { v: '1', label: '1' },
        { v: '2', label: '2' },
        { v: '3+', label: '3+' },
      ],
    },
    {
      // Ya no se pregunta el municipio: la demo es SOLO de Bogotá (los 31
      // proyectos del catálogo son de la ciudad). Esta pregunta reemplazó a la
      // de "¿Dónde te gustaría vivir?", que ofrecía 17 municipios.
      // Las opciones se derivan del catálogo, así que solo aparecen localidades
      // donde de verdad hay proyectos — ver opcionesPorFrecuencia más abajo.
      id: 'zona',
      color: '#0067b1',
      w: 68,
      title: '¿En qué localidad de Bogotá te gustaría vivir?',
      sub: 'Te mostramos proyectos ahí y en las localidades vecinas.',
      cols: 2,
      options: [],
    },
    // Estas 2 preguntas (piso_preferido y entorno_deseado) existen solo para
    // llenar campos OPCIONALES del contrato de leads (ver js/leads.js). Los ids coinciden 1:1 con los
    // nombres del contrato a propósito, para que el mapeo en leads.js sea
    // casi un passthrough directo. (tipo_inmueble se quitó del quiz: sigue
    // siendo un campo válido del contrato, leads.js lo manda como null.)
    {
      id: 'piso_preferido',
      color: '#4a94cc',
      w: 60,
      title: '¿Qué piso prefieres?',
      sub: 'Si no te importa, elige "Sin preferencia".',
      cols: 4,
      options: [
        { v: 'bajo', label: 'Bajo' },
        { v: 'medio', label: 'Medio' },
        { v: 'alto', label: 'Alto' },
        { v: 'sin_preferencia', label: 'Sin preferencia' },
      ],
    },
    {
      id: 'entorno_deseado',
      color: '#8a8a89',
      w: 52,
      title: '¿Buscas algo en particular del entorno?',
      sub: 'Opcional — elige todas las que apliquen.',
      type: 'multiselect',
      // ⚠️ Los `v` son las etiquetas EXACTAS que espera el backend y viajan tal
      // cual en `entorno_deseado` (ver js/leads.js). No son slugs nuestros: se
      // respetan sus erratas a propósito — "gymnasio" con y, "cancha e padel"
      // (no "de"), "zona de lavanderia" sin tilde, "zona kid" en singular. Una
      // letra distinta y el backend deja de cruzarlas, en silencio.
      // Esta misma lista está DUPLICADA en tools/scrape_proyectos.py
      // (VOCABULARIO, que tools/generar_seed_backend.py reusa); si cambia una,
      // cambia la otra. "cancha multiple" se sumó tras revisar los 31
      // proyectos reales: "Cancha múltiple", "Cancha fútbol 5" y "Zona sport
      // con cancha múltiple" no encajaban en ninguna de las 25 claves
      // originales (la única cancha del vocabulario era "cancha e padel",
      // específica de pádel).
      // El `label` sí es libre: es solo lo que ve el usuario.
      options: [
        { v: 'lobby', label: 'Lobby' },
        { v: 'piscina', label: 'Piscina' },
        { v: 'zona de lavanderia', label: 'Zona de lavandería' },
        { v: 'zona bbq', label: 'Zona BBQ' },
        { v: 'zona pet', label: 'Zona pet' },
        { v: 'zona kid', label: 'Zona kids' },
        { v: 'locales comerciales', label: 'Locales comerciales' },
        { v: 'zona fitness', label: 'Zona fitness' },
        { v: 'salon social', label: 'Salón social' },
        { v: 'spa mascotas', label: 'Spa mascotas' },
        { v: 'zona cool', label: 'Zona cool' },
        { v: 'zona cine', label: 'Zona cine' },
        { v: 'coworking', label: 'Coworking' },
        { v: 'sala vip', label: 'Sala VIP' },
        { v: 'zona cafe', label: 'Zona café' },
        { v: 'gymnasio', label: 'Gimnasio' },
        { v: 'parqueadero', label: 'Parqueadero' },
        { v: 'zona verde', label: 'Zona verde' },
        { v: 'parque', label: 'Parque' },
        { v: 'sala de juegos', label: 'Sala de juegos' },
        { v: 'pista de trote', label: 'Pista de trote' },
        { v: 'voleibol playa', label: 'Voleibol playa' },
        { v: 'cancha e padel', label: 'Cancha de pádel' },
        { v: 'taller de bicicletas', label: 'Taller de bicicletas' },
        { v: 'sauna', label: 'Sauna' },
        { v: 'cancha multiple', label: 'Cancha múltiple' },
      ],
    },
    {
      // VA DE ULTIMA A PROPOSITO: es la pregunta que menos mueve el plano
      // (3 % de las veces) y la que menos pesa en el match — `FACTOR_EDAD` en
      // matching.js solo corre el techo de precio, y es un SUPUESTO sin
      // verificar. Contestarla salta a resultados, asi que cualquier pregunta
      // de mas peso aqui cambiaria la recomendacion sin que la escena llegue
      // a redibujar el plano.
      //
      // Entero exacto (no rango): el contrato de leads con el backend
      // (SenalBowl, ver js/leads.js) pide `edad` como number, no un bucket.
      // quiz() en templates.js renderiza un input numérico para q.type
      // === 'number' en vez de la grilla de botones de siempre.
      id: 'edad',
      color: '#575756',
      w: 48,
      title: '¿Cuántos años tienes?',
      sub: 'Algunos proyectos tienen condiciones especiales según tu edad.',
      type: 'number',
      min: 18,
      max: 99,
      placeholder: 'Ej: 31',
    },
  ];

  // NOTA: aquí vivían ROOM_GEO (geometría fija de la planta) y FURN (muebles).
  // Se fueron cuando el quiz pasó a armar el PLANO REAL de un apartamento del
  // catálogo: ya no se dibujan cuartos ni muebles, se recortan piezas de la
  // imagen que publica la ficha. Ver js/planta.js y js/planos.js.

  // Vocabulario fijo de amenidades/zonas comunales — icono (SVG inline,
  // 24x24, stroke=currentColor) + etiqueta por categoría. `PROJECTS[].amenities`
  // solo usa estas 9 claves (ver docs/proyectos-amenidades.md para el mapeo
  // desde el texto real de cada página de proyecto a estas categorías).
  var AMENITIES = {
    porteria: { label: 'Portería con lobby', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V9l8-6 8 6v12"/><path d="M9 21v-6h6v6"/></svg>' },
    cancha: { label: 'Cancha múltiple', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6c3 3 3 9.8 0 12.8M18.4 5.6c-3 3-3 9.8 0 12.8"/></svg>' },
    recreativa: { label: 'Zona recreativa', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 7 9h3l-4 6h4v7h4v-7h4l-4-6h3z"/></svg>' },
    biosaludable: { label: 'Parque biosaludable', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 6.5l11 11"/><rect x="2" y="9" width="4" height="6" rx="1"/><rect x="18" y="9" width="4" height="6" rx="1"/><path d="M6 12h2M16 12h2"/></svg>' },
    infantil: { label: 'Parque infantil', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16M20 4v16M4 4h16"/><path d="M9 8v6"/><circle cx="9" cy="15.4" r="1.4" fill="currentColor" stroke="none"/><path d="M15 8v8"/><circle cx="15" cy="17.4" r="1.4" fill="currentColor" stroke="none"/></svg>' },
    salon: { label: 'Salón social', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2"/><circle cx="17.5" cy="9" r="2.3"/><path d="M15.8 21v-1.6a3.3 3.3 0 0 1 4.9 0V21"/></svg>' },
    gimnasio: { label: 'Gimnasio', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8v8M20 8v8M2 10.5v3M22 10.5v3M6 12h12"/></svg>' },
    piscina: { label: 'Piscina', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8c1.5 1.5 3 1.5 4.5 0S9.5 6.5 11 8s3 1.5 4.5 0 3-1.5 4.5 0"/><path d="M2 14c1.5 1.5 3 1.5 4.5 0s3-1.5 4.5 0 3 1.5 4.5 0 3-1.5 4.5 0"/><path d="M2 20c1.5 1.5 3 1.5 4.5 0s3-1.5 4.5 0 3 1.5 4.5 0 3-1.5 4.5 0"/></svg>' },
    parqueadero: { label: 'Parqueadero visitantes', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 16V8h4a3 3 0 0 1 0 6H9"/></svg>' },
  };

  // Catálogo real: los 26 proyectos que aparecen en
  // hackathon_VIVIENDAv2.xlsx (4.142 opciones de compra reales,
  // 2024-01 a 2026-07). `price` es el promedio real de VLR_VIVIENDA por
  // proyecto (el archivo trae el precio ×10.000, ya corregido aquí).
  // Ciudad/zona y VIS/No VIS vienen de investigación web (páginas oficiales
  // de Colsubsidio, sitios municipales) — ver
  // docs/proyectos-reales-investigacion.md para el detalle y el nivel de
  // confianza de cada dato. `area` y `hab` NO tienen fuente oficial para la
  // mayoría de estos proyectos (Colsubsidio no publica ficha técnica
  // completa) — son estimaciones a partir de los rangos parciales
  // encontrados o de tamaños típicos VIS/No VIS, no datos verificados.
  // `image` (20 de 26 proyectos): plano/planta o foto de fachada real,
  // descargada de cms.colsubsidio.com — ver docs/proyectos-imagenes.md.
  // Los 6 sin `image` (sin microsite propio activo) usan el fallback de
  // gradiente + emoji en templates.js/result().
  // `amenities` (20 de 26 proyectos): claves del vocabulario fijo de
  // AMENITIES arriba, extraídas literalmente del texto de zonas comunales
  // de cada página — ver docs/proyectos-amenidades.md. Mismos 6 proyectos
  // sin `image` quedan también sin `amenities` (misma causa: sin ficha
  // propia en colsubsidio.com).
  // NOTA: esta lista de 26 quedó como RESPALDO. El catálogo que usa la app es
  // el de js/proyectos.js (66 proyectos con área/habitaciones/baños/precio
  // OFICIALES de cada ficha, no estimados) — ver PROJECTS al final del archivo.
  // Esta copia solo entra si proyectos.js no cargó.
  var PROJECTS_RESPALDO = [
    { name: 'Agrupación De Vivienda Monguí', muni: 'Soacha', vis: true, price: 181, area: 47, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏢', grad: 'linear-gradient(135deg,#0067b1,#4a94cc)', image: 'assets/proyectos/agrupacion-de-vivienda-mongui.webp', amenities: ['porteria', 'salon', 'infantil', 'biosaludable', 'recreativa', 'parqueadero'] },
    { name: 'Agrupación De Vivienda La Macarena', muni: 'Soacha', vis: true, price: 151, area: 33, hab: 1, subsidy: 'Subsidio VIS', emoji: '🏘️', grad: 'linear-gradient(135deg,#3a7bb0,#7ec0ec)', image: 'assets/proyectos/agrupacion-de-vivienda-la-macarena.webp', amenities: ['porteria', 'cancha', 'recreativa', 'biosaludable', 'infantil', 'parqueadero', 'gimnasio', 'salon'] },
    { name: 'Verde Esperanza El Dorado', muni: 'Ubaté', vis: true, price: 169, area: 50, hab: 3, subsidy: 'Subsidio VIS', emoji: '🏡', grad: 'linear-gradient(135deg,#004c85,#0067b1)', image: 'assets/proyectos/verde-esperanza-el-dorado.webp', amenities: ['recreativa', 'salon', 'biosaludable', 'infantil', 'porteria', 'parqueadero'] },
    { name: 'La Arboleda', muni: 'Bogotá', zona: 'Sur', vis: true, price: 197, area: 48, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏙️', grad: 'linear-gradient(135deg,#2f6a9c,#5aa0d0)', image: 'assets/proyectos/la-arboleda.png', amenities: ['porteria', 'salon', 'infantil', 'gimnasio', 'recreativa'] },
    { name: 'INARI', muni: 'Chía', vis: true, price: 269, area: 43, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏢', grad: 'linear-gradient(135deg,#575756,#8a8a89)', image: 'assets/proyectos/inari.webp', amenities: ['porteria', 'gimnasio', 'biosaludable', 'infantil', 'salon'] },
    { name: 'Agrupación De Vivienda Pamplona I', muni: 'Soacha', vis: true, price: 218, area: 48, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏘️', grad: 'linear-gradient(135deg,#0067b1,#7ec0ec)', image: 'assets/proyectos/agrupacion-de-vivienda-pamplona-i.webp', amenities: ['porteria', 'gimnasio', 'cancha', 'infantil', 'recreativa', 'biosaludable'] },
    { name: 'Los Nogales', muni: 'Bogotá', zona: 'Occidente', vis: false, price: 604, area: 85, hab: 3, subsidy: 'Crédito hipotecario', emoji: '🏡', grad: 'linear-gradient(135deg,#33322f,#5f5e5b)', image: 'assets/proyectos/los-nogales.webp', amenities: ['recreativa', 'salon', 'gimnasio', 'parqueadero', 'cancha', 'infantil'] },
    { name: 'Agrupación De Vivienda Bosque De Arrayán', muni: 'Tocancipá', vis: true, price: 200, area: 52, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏙️', grad: 'linear-gradient(135deg,#4a94cc,#0067b1)', image: 'assets/proyectos/agrupacion-de-vivienda-bosque-de-arrayan.webp', amenities: ['porteria', 'infantil', 'cancha', 'recreativa', 'salon', 'biosaludable', 'gimnasio', 'parqueadero'] },
    { name: 'Agrupación De Vivienda Bosque De Turpial', muni: 'Tocancipá', vis: true, price: 236, area: 58, hab: 3, subsidy: 'Subsidio VIS', emoji: '🏢', grad: 'linear-gradient(135deg,#575756,#33322f)', image: 'assets/proyectos/agrupacion-de-vivienda-bosque-de-turpial.webp', amenities: ['porteria', 'salon', 'infantil', 'recreativa', 'gimnasio', 'cancha', 'biosaludable', 'parqueadero'] },
    { name: 'Versalles', muni: 'Soacha', vis: true, price: 211, area: 40, hab: 1, subsidy: 'Subsidio VIS', emoji: '🏘️', grad: 'linear-gradient(135deg,#0067b1,#4a94cc)', image: 'assets/proyectos/versalles.webp', amenities: ['porteria', 'salon', 'cancha', 'infantil', 'recreativa', 'biosaludable'] },
    { name: 'Villa Mercedes El Dorado', muni: 'La Mesa', vis: true, price: 172, area: 48, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏡', grad: 'linear-gradient(135deg,#3a7bb0,#7ec0ec)', image: 'assets/proyectos/villa-mercedes-el-dorado.jpg' },
    { name: 'Agrupación De Vivienda Payandé', muni: 'Ricaurte', vis: true, price: 177, area: 48, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏙️', grad: 'linear-gradient(135deg,#004c85,#0067b1)', image: 'assets/proyectos/agrupacion-de-vivienda-payande.webp', amenities: ['salon', 'recreativa', 'parqueadero'] },
    { name: 'Agrupación De Vivienda Reserva De Guayacán', muni: 'Girardot', vis: true, price: 229, area: 50, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏢', grad: 'linear-gradient(135deg,#2f6a9c,#5aa0d0)', image: 'assets/proyectos/agrupacion-de-vivienda-reserva-de-guayacan.webp', amenities: ['salon', 'piscina', 'recreativa', 'infantil', 'parqueadero'] },
    { name: 'Agrupación De Vivienda Samán', muni: 'Ricaurte', vis: true, price: 254, area: 48, hab: 3, subsidy: 'Subsidio VIS', emoji: '🏘️', grad: 'linear-gradient(135deg,#575756,#8a8a89)', image: 'assets/proyectos/agrupacion-de-vivienda-saman.webp', amenities: ['porteria', 'salon', 'piscina', 'infantil', 'recreativa', 'gimnasio', 'parqueadero'] },
    { name: 'Proyecto Karakalí', muni: 'Bogotá', zona: 'Norte', vis: true, price: 241, area: 28, hab: 1, subsidy: 'Subsidio VIS', emoji: '🏙️', grad: 'linear-gradient(135deg,#0067b1,#7ec0ec)', image: 'assets/proyectos/proyecto-karakali.webp', amenities: ['gimnasio', 'recreativa', 'porteria', 'biosaludable', 'salon'] },
    { name: 'ARAUCARIA', muni: 'Bogotá', zona: 'Occidente', vis: false, price: 650, area: 90, hab: 3, subsidy: 'Crédito hipotecario', emoji: '🏡', grad: 'linear-gradient(135deg,#33322f,#5f5e5b)', image: 'assets/proyectos/araucaria.webp', amenities: ['porteria', 'salon', 'gimnasio', 'recreativa', 'infantil', 'cancha'] },
    { name: 'Villa Fiorita', muni: 'Bogotá', zona: 'Occidente', vis: true, price: 208, area: 48, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏢', grad: 'linear-gradient(135deg,#4a94cc,#0067b1)' },
    { name: 'Agrupación De Vivienda Fuentevida', muni: 'Tocancipá', vis: true, price: 122, area: 45, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏘️', grad: 'linear-gradient(135deg,#575756,#33322f)' },
    { name: 'Conjunto Residencial Campo Alegre El Dorado', muni: 'Ricaurte', vis: true, price: 114, area: 49, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏙️', grad: 'linear-gradient(135deg,#0067b1,#4a94cc)' },
    { name: 'Conjunto Residencial Vibo Once', muni: 'Bogotá', zona: 'Centro', vis: true, price: 283, area: 48, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏢', grad: 'linear-gradient(135deg,#3a7bb0,#7ec0ec)', image: 'assets/proyectos/conjunto-residencial-vibo-once.webp', amenities: ['porteria', 'salon', 'gimnasio', 'recreativa', 'infantil'] },
    { name: 'Abeto', muni: 'Bogotá', zona: 'Occidente', vis: false, price: 372, area: 55, hab: 2, subsidy: 'Crédito hipotecario', emoji: '🏡', grad: 'linear-gradient(135deg,#004c85,#0067b1)', amenities: ['porteria', 'salon', 'gimnasio', 'recreativa'] },
    { name: 'Reserva Del Nogal', muni: 'Bogotá', zona: 'Sur', vis: true, price: 168, area: 48, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏘️', grad: 'linear-gradient(135deg,#2f6a9c,#5aa0d0)', image: 'assets/proyectos/reserva-del-nogal.webp', amenities: ['salon', 'porteria', 'parqueadero'] },
    { name: 'Mirador Del Virrey II', muni: 'Bogotá', zona: 'Sur', vis: true, price: 170, area: 48, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏙️', grad: 'linear-gradient(135deg,#575756,#8a8a89)', image: 'assets/proyectos/mirador-del-virrey-ii.webp', amenities: ['salon', 'parqueadero'] },
    { name: 'Zarzal', muni: 'Soacha', vis: true, price: 225, area: 45, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏢', grad: 'linear-gradient(135deg,#0067b1,#7ec0ec)', image: 'assets/proyectos/zarzal.webp', amenities: ['porteria', 'salon', 'infantil', 'gimnasio', 'parqueadero', 'recreativa'] },
    { name: 'Agrupación De Vivienda Jardín', muni: 'Soacha', vis: true, price: 153, area: 47, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏘️', grad: 'linear-gradient(135deg,#33322f,#5f5e5b)' },
    { name: 'Agrupación Mompós-Ciudadela Colsubsidio Maiporé', muni: 'Soacha', vis: true, price: 150, area: 47, hab: 2, subsidy: 'Subsidio VIS', emoji: '🏡', grad: 'linear-gradient(135deg,#4a94cc,#0067b1)' },
  ];

  // (La tabla de cercanía entre MUNICIPIOS se eliminó: la demo es solo de
  // Bogotá y la cercanía que importa ahora es entre LOCALIDADES, que llega
  // ya calculada de los límites oficiales en GDF_LOCALIDADES_VECINAS.)

  // Selección de personaje: puramente cosmético (carné + marcador en la
  // escena). No entra en computeLeadQualification — el PDF del hackathon
  // marca el género como variable opcional de bajo valor de negocio.
  var GENDERS = [
    { v: 'f', label: 'Constructora', emoji: '👷‍♀️' },
    { v: 'm', label: 'Constructor', emoji: '👷‍♂️' },
    { v: 'x', label: 'Sin especificar', emoji: '👷' },
  ];

  // El catálogo real lo genera tools/scrape_proyectos.py en js/proyectos.js
  // (se carga antes que este archivo). Si por lo que sea no está, la app
  // sigue viva con los 26 de respaldo de arriba en vez de quedarse en blanco.
  var PROJECTS = window.GDF_PROYECTOS && window.GDF_PROYECTOS.length
    ? window.GDF_PROYECTOS
    : PROJECTS_RESPALDO;

  // Opciones de ubicación/zona derivadas del catálogo: solo se ofrecen lugares
  // donde SÍ hay proyectos, ordenados por cuántos hay. Evita el problema que
  // tenía la lista escrita a mano (ofrecía La Mesa, que ya no tiene ninguno).
  function opcionesPorFrecuencia(valores) {
    var conteo = {};
    valores.forEach(function (v) {
      if (v) conteo[v] = (conteo[v] || 0) + 1;
    });
    return Object.keys(conteo)
      .sort(function (a, b) {
        return conteo[b] - conteo[a] || a.localeCompare(b, 'es');
      })
      .map(function (v) {
        return { v: v, label: v };
      });
  }

  function preguntaPorId(id) {
    for (var i = 0; i < QUESTIONS.length; i++) {
      if (QUESTIONS[i].id === id) return QUESTIONS[i];
    }
    return null;
  }

  // Las localidades que SÍ tienen proyectos en el catálogo, ordenadas por
  // cuántos hay. Al regenerar proyectos.js la lista se actualiza sola: nunca
  // se ofrece una localidad vacía (que sería un callejón sin salida) ni se
  // queda por fuera una nueva.
  preguntaPorId('zona').options = opcionesPorFrecuencia(
    PROJECTS.map(function (p) {
      return p.localidad;
    })
  );

  // Localidades que colindan, calculadas de los límites oficiales del Distrito
  // por tools/scrape_proyectos.py (ver GDF_LOCALIDADES_VECINAS en
  // js/proyectos.js). matching.js las usa para no castigar a un proyecto que
  // queda en la localidad de al lado. Si el archivo generado no cargó, queda
  // un objeto vacío y el scoring simplemente trata todo como "lejos".
  var VECINAS = window.GDF_LOCALIDADES_VECINAS || {};

  window.GDF = window.GDF || {};
  window.GDF.data = {
    QUESTIONS: QUESTIONS,
    PROJECTS: PROJECTS,
    AMENITIES: AMENITIES,
    VECINAS: VECINAS,
    GENDERS: GENDERS,
  };
})();
