// Datos estáticos: preguntas del quiz, geometría del plano, catálogo de
// proyectos y avatares. Portado literalmente desde grua-del-futuro/src/App.jsx
// (mismos campos, mismo orden, mismas opciones) — la única pieza nueva es GENDERS.
(function () {
  'use strict';

  // Contenido real del carrusel principal de colsubsidio.com/vivienda —
  // título, descripción e imagen extraídos del __NEXT_DATA__ (JSON de Drupal)
  // embebido en el HTML servido de esa página, no inventados. El degradado
  // de fondo también es el real (`field_background_color` de cada slide).
  var LANDING_SLIDES = [
    {
      title: 'Vivienda Colsubsidio',
      desc: 'Construye tu futuro y el de tu familia con nuestros proyectos de vivienda VIS o VIP. Estrena, mejora o edifica tu hogar y proyecto de vida.',
      image: 'assets/landing/hero-1.webp',
    },
    {
      title: 'Tu historia comienza en la Ciudadela Maiporé',
      desc: 'Descubre la variedad de opciones para adquirir tu propio hogar en Soacha con el respaldo de Colsubsidio.',
      image: 'assets/landing/hero-2.webp',
    },
    {
      title: 'Vivienda VIS Colsubsidio: donde nace tu hogar',
      desc: 'Habita espacios diseñados para tus sueños en Bogotá y Cundinamarca.',
      image: 'assets/landing/hero-3.webp',
    },
  ];

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
        { v: '≤2 SMMLV', label: 'Hasta 2 SMMLV', hint: '≈ hasta $2.8M al mes' },
        { v: '2–4 SMMLV', label: '2 a 4 SMMLV', hint: '≈ $2.8M – $5.7M' },
        { v: '4–8 SMMLV', label: '4 a 8 SMMLV', hint: '≈ $5.7M – $11.4M' },
        { v: '8+ SMMLV', label: 'Más de 8 SMMLV', hint: '≈ más de $11.4M' },
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
      // Entero exacto (no rango): el contrato de leads con el backend
      // (SenalBowl, ver js/leads.js) pide `edad` como number, no un bucket.
      // quiz() en templates.js renderiza un input numérico para q.type
      // === 'number' en vez de la grilla de botones de siempre.
      id: 'edad',
      color: '#575756',
      w: 72,
      title: '¿Cuántos años tienes?',
      sub: 'Algunos proyectos tienen condiciones especiales según tu edad.',
      type: 'number',
      min: 18,
      max: 99,
      placeholder: 'Ej: 31',
    },
    {
      id: 'ubicacion',
      color: '#0067b1',
      w: 68,
      title: '¿Dónde te gustaría vivir?',
      sub: 'Elige el lugar; si es Bogotá te preguntamos la zona.',
      cols: 2,
      options: [
        { v: 'Bogotá', label: 'Bogotá' },
        { v: 'Chía', label: 'Chía' },
        { v: 'Girardot', label: 'Girardot' },
        { v: 'Ricaurte', label: 'Ricaurte' },
        { v: 'Soacha', label: 'Soacha' },
        { v: 'Tocancipá', label: 'Tocancipá' },
        { v: 'Ubaté', label: 'Ubaté' },
        { v: 'La Mesa', label: 'La Mesa' },
      ],
    },
    {
      id: 'zona',
      color: '#4a94cc',
      w: 64,
      cond: 'bogota',
      title: '¿En qué zona de Bogotá?',
      sub: 'Nos ayuda a acercarte proyectos en tu área.',
      cols: 2,
      options: [
        { v: 'Norte', label: 'Norte' },
        { v: 'Occidente', label: 'Occidente' },
        { v: 'Sur', label: 'Sur' },
        { v: 'Centro', label: 'Centro' },
      ],
    },
    {
      id: 'habitaciones',
      color: '#ffd000',
      w: 60,
      title: '¿Cuántas habitaciones necesitas?',
      sub: 'Así ajustamos el tamaño de tu hogar.',
      cols: 3,
      options: [
        { v: '1', label: '1' },
        { v: '2', label: '2' },
        { v: '3+', label: '3+' },
      ],
    },
    // Las 3 preguntas de acá abajo son nuevas: existen solo para llenar
    // campos OPCIONALES del contrato de leads (tipo_inmueble, piso_preferido,
    // entorno_deseado — ver js/leads.js). Los ids coinciden 1:1 con los
    // nombres del contrato a propósito, para que el mapeo en leads.js sea
    // casi un passthrough directo.
    {
      id: 'tipo_inmueble',
      color: '#0067b1',
      w: 56,
      title: '¿Apartamento o casa?',
      sub: 'Nos ayuda a afinar tu recomendación.',
      cols: 3,
      options: [
        { v: 'apartamento', label: 'Apartamento' },
        { v: 'casa', label: 'Casa' },
        { v: 'sin_preferencia', label: 'Sin preferencia' },
      ],
    },
    {
      id: 'piso_preferido',
      color: '#4a94cc',
      w: 52,
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
      w: 48,
      title: '¿Buscas algo en particular del entorno?',
      sub: 'Opcional — por ejemplo "cerca a colegio" o "zona verde". Puedes dejarlo en blanco.',
      type: 'text',
      placeholder: 'Ej: cerca a colegio, zona verde, cerca al trabajo…',
    },
  ];

  // geometría de la planta (% dentro de la losa)
  var ROOM_GEO = {
    balcon: { L: 0, T: 0, W: 13, H: 100, label: 'Balcón', floor: 'repeating-linear-gradient(0deg,#8d9c76 0 5px,#849371 5px 6px)' },
    sala: { L: 13, T: 0, W: 31, H: 50, label: 'Sala', floor: 'repeating-linear-gradient(90deg,#c99b6a 0 7px,#c19260 7px 8px)' },
    comedor: { L: 44, T: 0, W: 22, H: 50, label: 'Comedor', floor: 'repeating-linear-gradient(90deg,#c99b6a 0 7px,#c19260 7px 8px)' },
    hab1: { L: 66, T: 0, W: 23, H: 50, label: 'Hab. principal', floor: 'repeating-linear-gradient(90deg,#c4926d 0 7px,#bc8a63 7px 8px)' },
    vestier: { L: 89, T: 0, W: 11, H: 50, label: 'Vestier', floor: 'repeating-linear-gradient(90deg,#bd8d5f 0 6px,#b48557 6px 7px)' },
    cocina: { L: 13, T: 50, W: 31, H: 50, label: 'Cocina', floor: 'repeating-linear-gradient(45deg,#dcd8d1 0 8px,#d3cfc7 8px 9px)' },
    estudio: { L: 44, T: 50, W: 22, H: 50, label: 'Estudio', floor: 'repeating-linear-gradient(90deg,#cba070 0 7px,#c39868 7px 8px)' },
    bano: { L: 66, T: 50, W: 16, H: 50, label: 'Baño', floor: 'repeating-linear-gradient(0deg,#cfd8dc 0 7px,#c6d0d5 7px 8px)' },
    hab2: { L: 82, T: 50, W: 18, H: 50, label: 'Hab. 2', floor: 'repeating-linear-gradient(90deg,#c4926d 0 7px,#bc8a63 7px 8px)' },
    hab3: { L: 82, T: 75, W: 18, H: 25, label: 'Hab. 3', floor: 'repeating-linear-gradient(90deg,#c4926d 0 7px,#bc8a63 7px 8px)' },
    hall: { L: 44, T: 50, W: 22, H: 50, label: 'Hall', floor: 'repeating-linear-gradient(90deg,#cfc3b2 0 7px,#c8bcaa 7px 8px)' },
    deposito: { L: 82, T: 50, W: 18, H: 50, label: 'Depósito', floor: 'repeating-linear-gradient(45deg,#d3cfc7 0 8px,#cbc7bf 8px 9px)' },
  };

  // [left, top, width, height, color, radius] en % del cuarto
  var FURN = {
    sala: [[8, 10, 60, 20, '#a8a5a0', 3], [14, 40, 62, 44, '#b6c1a6', 2], [36, 54, 24, 16, '#8b6a46', 3], [88, 32, 8, 34, '#3a3733', 1]],
    comedor: [[22, 28, 56, 40, '#a97e52', '50%'], [10, 34, 8, 14, '#8a8580', 2], [82, 34, 8, 14, '#8a8580', 2], [36, 12, 22, 8, '#8a8580', 2], [36, 80, 22, 8, '#8a8580', 2]],
    cocina: [[4, 74, 92, 16, '#d5d8da', 2], [22, 36, 54, 18, '#e6e0d5', 2], [10, 76, 18, 12, '#4a4744', 2], [80, 12, 16, 24, '#cfd3d6', 2]],
    hab1: [[24, 16, 52, 62, '#f4f1eb', 3], [29, 20, 42, 12, '#ddd7cc', 2], [4, 18, 14, 16, '#8b6a46', 2]],
    hab2: [[18, 20, 58, 54, '#f4f1eb', 3], [24, 24, 46, 12, '#ddd7cc', 2]],
    hab3: [[18, 18, 58, 50, '#f4f1eb', 3], [24, 22, 46, 12, '#ddd7cc', 2]],
    bano: [[6, 8, 38, 36, '#dbe4e8', 2], [56, 14, 30, 20, '#fdfdfc', 3], [56, 58, 30, 16, '#f0f2f3', 2]],
    balcon: [[20, 8, 58, 13, '#6f8f5f', '50%'], [18, 40, 60, 13, '#6f8f5f', '50%'], [22, 72, 54, 13, '#6f8f5f', '50%']],
    estudio: [[10, 20, 74, 18, '#a97e52', 2], [40, 46, 20, 16, '#8a8580', '50%'], [10, 78, 74, 10, '#b09070', 2]],
    vestier: [[14, 12, 72, 6, '#8a8580', 2], [18, 22, 64, 26, '#c9c4bc', 2], [14, 62, 72, 10, '#b09070', 2]],
  };

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
  var PROJECTS = [
    { name: 'Agrupación De Vivienda Monguí', muni: 'Soacha', vis: true, price: 181, area: 47, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏢', grad: 'linear-gradient(135deg,#0067b1,#4a94cc)', image: 'assets/proyectos/agrupacion-de-vivienda-mongui.webp', amenities: ['porteria', 'salon', 'infantil', 'biosaludable', 'recreativa', 'parqueadero'] },
    { name: 'Agrupación De Vivienda La Macarena', muni: 'Soacha', vis: true, price: 151, area: 33, hab: 1, subsidy: 'Mi Casa Ya', emoji: '🏘️', grad: 'linear-gradient(135deg,#3a7bb0,#7ec0ec)', image: 'assets/proyectos/agrupacion-de-vivienda-la-macarena.webp', amenities: ['porteria', 'cancha', 'recreativa', 'biosaludable', 'infantil', 'parqueadero', 'gimnasio', 'salon'] },
    { name: 'Verde Esperanza El Dorado', muni: 'Ubaté', vis: true, price: 169, area: 50, hab: 3, subsidy: 'Mi Casa Ya', emoji: '🏡', grad: 'linear-gradient(135deg,#004c85,#0067b1)', image: 'assets/proyectos/verde-esperanza-el-dorado.webp', amenities: ['recreativa', 'salon', 'biosaludable', 'infantil', 'porteria', 'parqueadero'] },
    { name: 'La Arboleda', muni: 'Bogotá', zona: 'Sur', vis: true, price: 197, area: 48, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏙️', grad: 'linear-gradient(135deg,#2f6a9c,#5aa0d0)', image: 'assets/proyectos/la-arboleda.png', amenities: ['porteria', 'salon', 'infantil', 'gimnasio', 'recreativa'] },
    { name: 'INARI', muni: 'Chía', vis: true, price: 269, area: 43, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏢', grad: 'linear-gradient(135deg,#575756,#8a8a89)', image: 'assets/proyectos/inari.webp', amenities: ['porteria', 'gimnasio', 'biosaludable', 'infantil', 'salon'] },
    { name: 'Agrupación De Vivienda Pamplona I', muni: 'Soacha', vis: true, price: 218, area: 48, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏘️', grad: 'linear-gradient(135deg,#0067b1,#7ec0ec)', image: 'assets/proyectos/agrupacion-de-vivienda-pamplona-i.webp', amenities: ['porteria', 'gimnasio', 'cancha', 'infantil', 'recreativa', 'biosaludable'] },
    { name: 'Los Nogales', muni: 'Bogotá', zona: 'Occidente', vis: false, price: 604, area: 85, hab: 3, subsidy: 'Crédito hipotecario', emoji: '🏡', grad: 'linear-gradient(135deg,#33322f,#5f5e5b)', image: 'assets/proyectos/los-nogales.webp', amenities: ['recreativa', 'salon', 'gimnasio', 'parqueadero', 'cancha', 'infantil'] },
    { name: 'Agrupación De Vivienda Bosque De Arrayán', muni: 'Tocancipá', vis: true, price: 200, area: 52, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏙️', grad: 'linear-gradient(135deg,#4a94cc,#0067b1)', image: 'assets/proyectos/agrupacion-de-vivienda-bosque-de-arrayan.webp', amenities: ['porteria', 'infantil', 'cancha', 'recreativa', 'salon', 'biosaludable', 'gimnasio', 'parqueadero'] },
    { name: 'Agrupación De Vivienda Bosque De Turpial', muni: 'Tocancipá', vis: true, price: 236, area: 58, hab: 3, subsidy: 'Mi Casa Ya', emoji: '🏢', grad: 'linear-gradient(135deg,#575756,#33322f)', image: 'assets/proyectos/agrupacion-de-vivienda-bosque-de-turpial.webp', amenities: ['porteria', 'salon', 'infantil', 'recreativa', 'gimnasio', 'cancha', 'biosaludable', 'parqueadero'] },
    { name: 'Versalles', muni: 'Soacha', vis: true, price: 211, area: 40, hab: 1, subsidy: 'Mi Casa Ya', emoji: '🏘️', grad: 'linear-gradient(135deg,#0067b1,#4a94cc)', image: 'assets/proyectos/versalles.webp', amenities: ['porteria', 'salon', 'cancha', 'infantil', 'recreativa', 'biosaludable'] },
    { name: 'Villa Mercedes El Dorado', muni: 'La Mesa', vis: true, price: 172, area: 48, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏡', grad: 'linear-gradient(135deg,#3a7bb0,#7ec0ec)', image: 'assets/proyectos/villa-mercedes-el-dorado.jpg' },
    { name: 'Agrupación De Vivienda Payandé', muni: 'Ricaurte', vis: true, price: 177, area: 48, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏙️', grad: 'linear-gradient(135deg,#004c85,#0067b1)', image: 'assets/proyectos/agrupacion-de-vivienda-payande.webp', amenities: ['salon', 'recreativa', 'parqueadero'] },
    { name: 'Agrupación De Vivienda Reserva De Guayacán', muni: 'Girardot', vis: true, price: 229, area: 50, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏢', grad: 'linear-gradient(135deg,#2f6a9c,#5aa0d0)', image: 'assets/proyectos/agrupacion-de-vivienda-reserva-de-guayacan.webp', amenities: ['salon', 'piscina', 'recreativa', 'infantil', 'parqueadero'] },
    { name: 'Agrupación De Vivienda Samán', muni: 'Ricaurte', vis: true, price: 254, area: 48, hab: 3, subsidy: 'Mi Casa Ya', emoji: '🏘️', grad: 'linear-gradient(135deg,#575756,#8a8a89)', image: 'assets/proyectos/agrupacion-de-vivienda-saman.webp', amenities: ['porteria', 'salon', 'piscina', 'infantil', 'recreativa', 'gimnasio', 'parqueadero'] },
    { name: 'Proyecto Karakalí', muni: 'Bogotá', zona: 'Norte', vis: true, price: 241, area: 28, hab: 1, subsidy: 'Mi Casa Ya', emoji: '🏙️', grad: 'linear-gradient(135deg,#0067b1,#7ec0ec)', image: 'assets/proyectos/proyecto-karakali.webp', amenities: ['gimnasio', 'recreativa', 'porteria', 'biosaludable', 'salon'] },
    { name: 'ARAUCARIA', muni: 'Bogotá', zona: 'Occidente', vis: false, price: 650, area: 90, hab: 3, subsidy: 'Crédito hipotecario', emoji: '🏡', grad: 'linear-gradient(135deg,#33322f,#5f5e5b)', image: 'assets/proyectos/araucaria.webp', amenities: ['porteria', 'salon', 'gimnasio', 'recreativa', 'infantil', 'cancha'] },
    { name: 'Villa Fiorita', muni: 'Bogotá', zona: 'Occidente', vis: true, price: 208, area: 48, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏢', grad: 'linear-gradient(135deg,#4a94cc,#0067b1)' },
    { name: 'Agrupación De Vivienda Fuentevida', muni: 'Tocancipá', vis: true, price: 122, area: 45, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏘️', grad: 'linear-gradient(135deg,#575756,#33322f)' },
    { name: 'Conjunto Residencial Campo Alegre El Dorado', muni: 'Ricaurte', vis: true, price: 114, area: 49, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏙️', grad: 'linear-gradient(135deg,#0067b1,#4a94cc)' },
    { name: 'Conjunto Residencial Vibo Once', muni: 'Bogotá', zona: 'Centro', vis: true, price: 283, area: 48, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏢', grad: 'linear-gradient(135deg,#3a7bb0,#7ec0ec)', image: 'assets/proyectos/conjunto-residencial-vibo-once.webp', amenities: ['porteria', 'salon', 'gimnasio', 'recreativa', 'infantil'] },
    { name: 'Abeto', muni: 'Bogotá', zona: 'Occidente', vis: false, price: 372, area: 55, hab: 2, subsidy: 'Crédito hipotecario', emoji: '🏡', grad: 'linear-gradient(135deg,#004c85,#0067b1)', amenities: ['porteria', 'salon', 'gimnasio', 'recreativa'] },
    { name: 'Reserva Del Nogal', muni: 'Bogotá', zona: 'Sur', vis: true, price: 168, area: 48, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏘️', grad: 'linear-gradient(135deg,#2f6a9c,#5aa0d0)', image: 'assets/proyectos/reserva-del-nogal.webp', amenities: ['salon', 'porteria', 'parqueadero'] },
    { name: 'Mirador Del Virrey II', muni: 'Bogotá', zona: 'Sur', vis: true, price: 170, area: 48, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏙️', grad: 'linear-gradient(135deg,#575756,#8a8a89)', image: 'assets/proyectos/mirador-del-virrey-ii.webp', amenities: ['salon', 'parqueadero'] },
    { name: 'Zarzal', muni: 'Soacha', vis: true, price: 225, area: 45, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏢', grad: 'linear-gradient(135deg,#0067b1,#7ec0ec)', image: 'assets/proyectos/zarzal.webp', amenities: ['porteria', 'salon', 'infantil', 'gimnasio', 'parqueadero', 'recreativa'] },
    { name: 'Agrupación De Vivienda Jardín', muni: 'Soacha', vis: true, price: 153, area: 47, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏘️', grad: 'linear-gradient(135deg,#33322f,#5f5e5b)' },
    { name: 'Agrupación Mompós-Ciudadela Colsubsidio Maiporé', muni: 'Soacha', vis: true, price: 150, area: 47, hab: 2, subsidy: 'Mi Casa Ya', emoji: '🏡', grad: 'linear-gradient(135deg,#4a94cc,#0067b1)' },
  ];

  var NEIGH = {
    'Bogotá': ['Soacha', 'Chía', 'Tocancipá'],
    'Soacha': ['Bogotá'],
    'Chía': ['Bogotá', 'Tocancipá'],
    'Tocancipá': ['Bogotá', 'Chía'],
    'Girardot': ['Ricaurte'],
    'Ricaurte': ['Girardot'],
  };

  // Selección de personaje: puramente cosmético (carné + marcador en la
  // escena). No entra en computeLeadQualification — el PDF del hackathon
  // marca el género como variable opcional de bajo valor de negocio.
  var GENDERS = [
    { v: 'f', label: 'Constructora', emoji: '👷‍♀️' },
    { v: 'm', label: 'Constructor', emoji: '👷‍♂️' },
    { v: 'x', label: 'Sin especificar', emoji: '👷' },
  ];

  window.GDF = window.GDF || {};
  window.GDF.data = {
    LANDING_SLIDES: LANDING_SLIDES,
    QUESTIONS: QUESTIONS,
    ROOM_GEO: ROOM_GEO,
    FURN: FURN,
    PROJECTS: PROJECTS,
    AMENITIES: AMENITIES,
    NEIGH: NEIGH,
    GENDERS: GENDERS,
  };
})();
