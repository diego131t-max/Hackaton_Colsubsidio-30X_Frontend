// Plantillas: una función por pantalla que devuelve un string HTML.
// Nada de virtual DOM — cada render() reconstruye el innerHTML del root
// completo, lo que hace que las animaciones CSS se disparen solas en cada
// cambio de pantalla/pregunta (son nodos DOM nuevos).
(function () {
  'use strict';

  function esc(str) {
    if (str == null) return '';
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function findGender(v) {
    var GENDERS = window.GDF.data.GENDERS;
    for (var i = 0; i < GENDERS.length; i++) {
      if (GENDERS[i].v === v) return GENDERS[i];
    }
    return GENDERS[GENDERS.length - 1];
  }

  /**
   * La casita ilustrada. Hoy solo la usa splash(): la portada dejó de tener
   * bloque propio al pasar a ser el clon de la página de Colsubsidio, cuyo
   * hero lleva la casa 3D amarilla de ellos.
   *
   * Es UN SVG y no veinte <div> absolutos, y esa es la corrección de fondo:
   * antes cada pieza (muro, tejado, chimenea, puerta, ventanas…) llevaba su
   * propia copia de la animación de flotación, que incluía un `rotate(-3deg)`.
   * Como cada elemento gira sobre SU centro y todos estaban en sitios
   * distintos, en cuanto arrancaba la animación la casa se descuadraba: el
   * tejado se salía de los muros, la chimenea quedaba flotando en el aire y la
   * puerta se desbordaba por abajo. Se veía torcida.
   *
   * Con un solo `<g class="casa">` que flota, las piezas comparten origen y
   * ya no pueden separarse — la casa se mueve entera. Y al ser coordenadas de
   * un `viewBox`, la geometría es exacta: el tejado apoya en los muros, la
   * chimenea nace DENTRO del faldón (se dibuja antes que el tejado, que le
   * tapa la base) y la puerta se apoya en la línea del suelo.
   */
  function houseIllustration() {
    return (
      '<div class="gdf-hero-illustration">' +
      '<div class="glow"></div>' +
      '<svg class="gdf-casa" viewBox="0 0 320 240" role="img" aria-label="Ilustración de una casa">' +
      // La sombra NO flota: se queda en el suelo y por eso la casa se lee
      // como que se despega de él.
      '<ellipse class="suelo" cx="160" cy="186" rx="76" ry="10" />' +
      '<g class="casa">' +
      // Chimenea primero: el tejado se pinta encima y le esconde la base.
      '<rect x="190" y="44" width="16" height="46" fill="#575756" />' +
      // Muros. El trazo va por dentro para que el ancho declarado sea el real.
      '<rect x="104" y="100" width="112" height="76" rx="9"' +
      ' fill="#fdfefe" stroke="#0067b1" stroke-width="5" />' +
      // Tejado: base exactamente sobre la línea de los muros (y=100), con
      // alero de 14 a cada lado.
      '<path d="M160 50 L232 102 L88 102 Z" fill="#ffd000" />' +
      '<rect x="86" y="98" width="148" height="9" rx="4.5" fill="#e6bd00" />' +
      // Remate de la chimenea, ya por encima del tejado.
      '<rect x="186" y="38" width="24" height="7" rx="3" fill="#33322f" />' +
      '<circle class="humo h1" cx="198" cy="32" r="5" />' +
      '<circle class="humo h2" cx="201" cy="28" r="4" />' +
      // Asta y bandera, apoyadas en la cumbrera.
      '<rect x="158.5" y="16" width="3" height="36" rx="1.5" fill="#8a8a89" />' +
      '<path class="bandera" d="M161.5 20 L186 27 L161.5 34 Z" fill="#ffd000" />' +
      // Puerta en arco, apoyada en el suelo del muro.
      '<path d="M145 173.5 V143 a15 15 0 0 1 30 0 V173.5 Z" fill="#ffd000" />' +
      '<circle cx="168" cy="158" r="2.6" fill="#fff" />' +
      // Ventanas, dentro de los muros y a la misma altura.
      ventanaSvg(120, 118) + ventanaSvg(178, 118) +
      // Jardinera bajo la ventana izquierda.
      '<rect x="116" y="138" width="28" height="9" rx="2" fill="#7a5b3a" />' +
      '<circle cx="124" cy="136" r="3.2" fill="#ff8fab" />' +
      '<circle cx="134" cy="135" r="3.2" fill="#ffd000" />' +
      '</g>' +
      '</svg>' +
      '<div class="accent-1"></div>' +
      '<div class="accent-2"></div>' +
      '<div class="accent-3"></div>' +
      '<div class="accent-4"></div>' +
      '</div>'
    );
  }

  // Ventana de 22x20 con sus cruces, para no repetir el bloque dos veces.
  function ventanaSvg(x, y) {
    return (
      '<g>' +
      '<rect x="' + x + '" y="' + y + '" width="22" height="20" rx="3" fill="#0067b1" />' +
      '<rect x="' + (x + 10) + '" y="' + y + '" width="2" height="20" fill="#fff" />' +
      '<rect x="' + x + '" y="' + (y + 9) + '" width="22" height="2" fill="#fff" />' +
      '</g>'
    );
  }

  function header() {
    return (
      '<div class="gdf-header">' +
      '<img src="assets/Logov2.png" alt="Colsubsidio" />' +
      '</div>'
    );
  }

  // ======================= PORTADA =======================================
  // Reproduce https://www.colsubsidio.com/vivienda/proyectos tal cual: las
  // tres barras de cabecera, el hero, Ciudadela Maiporé, Proyectos propios,
  // Ciudades, Nuestros aliados, Más opciones para ti y el footer de pestañas.
  //
  // Todo el contenido (textos, menús, degradados, imágenes) sale de
  // `window.GDF_PORTADA`, que genera tools/clonar_portada.py del sitio real.
  // Aquí NO se escribe a mano ni un texto de ellos.
  //
  // LA ÚNICA FRANJA QUE NO ES SUYA ES EL HERO. En el original ahí va el
  // buscador (¿Dónde quieres vivir? / Elige zona o municipio / Nombre del
  // proyecto + Buscar + el aviso azul); aquí se sustituye entero por la
  // entrada a la Grúa del Futuro. Se conserva su marco —el mismo degradado,
  // la misma casa 3D amarilla, el mismo tamaño de título— para que el cambio
  // se lea como parte del diseño y no como un injerto. Si alguna vez vuelven
  // los tres desplegables, es un retroceso: la portada dejaría de tener puerta.
  //
  // Los enlaces de ellos NO navegan (son `href="#"` con data-action="noop"):
  // esto es una demo, no un espejo del portal. Lo único que actúa es el CTA.

  // Cuántas tarjetas entran por página en cada carrusel. De aquí salen el
  // desplazamiento de la pista y cuántos guiones lleva el indicador, así que
  // es el único sitio donde tocar si cambia el número de tarjetas visibles.
  //
  // OJO: esta tabla es solo el VALOR DE ARRANQUE. La verdad la tiene el CSS,
  // en la variable `--por-pagina` de cada pista, porque el reparto cambia con
  // el ancho de pantalla (en móvil entra UNA tarjeta donde en escritorio
  // entran tres). Si el conteo viviera solo aquí, en el teléfono se pintarían
  // los 4 guiones del escritorio y las 6 últimas tarjetas de "Proyectos
  // propios" serían inalcanzables.
  var PORTADA_CARRUSELES = {
    propios: 3,
    ciudades: 5,
    aliados: 6,
    opciones: 1,
  };

  // Cuántas tarjetas se ven a la vez AHORA MISMO. Lee la variable CSS de la
  // pista ya pintada; si todavía no existe (primer render), cae a la tabla.
  function porPaginaDe(clave) {
    var pista = document.querySelector('.pt-pista[data-pista="' + clave + '"]');
    if (pista) {
      var v = parseInt(getComputedStyle(pista).getPropertyValue('--por-pagina'), 10);
      if (v > 0) return v;
    }
    return PORTADA_CARRUSELES[clave] || 1;
  }

  function portadaPaginas(clave, total) {
    return Math.max(1, Math.ceil(total / porPaginaDe(clave)));
  }

  function itemsDe(clave) {
    var P = window.GDF_PORTADA || {};
    return ({
      propios: (P.propios || {}).tarjetas,
      ciudades: (P.ciudades || {}).items,
      aliados: (P.aliados || {}).logos,
      opciones: (P.opciones || {}).tarjetas,
    }[clave]) || [];
  }

  // Cuántas páginas tiene un carrusel, mirando el catálogo. Lo usa state.js
  // para que "siguiente" dé la vuelta en la última, y main.js para rehacer los
  // guiones cuando cambia el ancho de la ventana.
  function paginasPortada(clave) {
    return portadaPaginas(clave, itemsDe(clave).length);
  }

  function guionesHtml(clave, n, actual) {
    var html = '';
    for (var i = 0; i < n; i++) {
      html +=
        '<button class="pt-guion' + (i === actual ? ' activo' : '') + '"' +
        ' data-action="setPortadaSlide" data-carrusel="' + clave + '"' +
        ' data-value="' + i + '" aria-label="Página ' + (i + 1) + '"></button>';
    }
    return html;
  }

  // Los enlaces del portal se pintan pero no llevan a ningún sitio. `noop` ya
  // existe para el <details> de las tarjetas de proyecto: frena el burbujeo
  // sin que el listener delegado tenga que conocer cada caso.
  function pInerte(clase, texto, extra) {
    return (
      '<a class="' + clase + '" href="#" data-action="noop"' + (extra || '') + '>' +
      texto + '</a>'
    );
  }

  // Los tres iconos que no son texto. Van inline (no como archivo) porque son
  // trazos de cuatro líneas y así no suman peticiones ni assets al repo.
  function portadaIcono(cual) {
    var svg = {
      lupa: '<circle cx="7" cy="7" r="5.4"/><path d="M11 11l3.4 3.4"/>',
      flecha: '<path d="M3 8h10M9.5 4.5L13 8l-3.5 3.5"/>',
      edificio: '<path d="M3 14V3h7v11M6 14V9h7v5M5 5.5h2M5 7.5h2M8.5 11h2"/>',
    }[cual];
    return (
      '<svg class="pt-ico pt-ico-' + cual + '" viewBox="0 0 16 16" aria-hidden="true"' +
      ' fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"' +
      ' stroke-linejoin="round">' + svg + '</svg>'
    );
  }

  function portadaChevron() {
    return (
      '<svg class="pt-chev" width="10" height="6" viewBox="0 0 10 6" aria-hidden="true">' +
      '<path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6"' +
      ' stroke-linecap="round" stroke-linejoin="round"/></svg>'
    );
  }

  // --- cabecera: las tres barras ------------------------------------------
  function portadaCabecera(P) {
    var clientes = (P.clientes || []).map(function (c, i) {
      // "Personas" va resaltado en amarillo: es la sección en la que estamos.
      return pInerte('pt-cliente' + (i === 0 ? ' activo' : ''), esc(c.texto));
    }).join('');

    // Estos cuatro no vienen del CMS: los pinta su propia aplicación, así que
    // son el único texto de la cabecera escrito a mano.
    var herramientas = [
      ['✎', 'Personalizar', true],
      ['A+', 'Accesibilidad', true],
      ['🗎', 'Transparencia', false],
    ].map(function (h) {
      return (
        '<span class="pt-util-item"><i class="pt-util-ico">' + h[0] + '</i>' +
        esc(h[1]) + (h[2] ? portadaChevron() : '') + '</span>'
      );
    }).join('');

    var globales = (P['global'] || []).map(function (g, i, arr) {
      // El último ("Colsubsidio virtual") es la pastilla amarilla.
      var ultimo = i === arr.length - 1;
      return pInerte(
        ultimo ? 'pt-cv' : 'pt-glob',
        esc(g.texto) + (ultimo ? portadaChevron() : '')
      );
    }).join('');

    var mega = (P.mega || []).map(function (m) {
      return pInerte('pt-mega-item', esc(m.texto) + portadaChevron());
    }).join('');

    return (
      '<header class="pt-head">' +
      '<div class="pt-utility"><div class="pt-ancho-md pt-utility-in">' +
      '<div class="pt-clientes">' + clientes + '</div>' +
      '<div class="pt-util-der">' + herramientas +
      '<span class="pt-util-item">Buscar' + portadaIcono('lupa') + '</span>' +
      '</div></div></div>' +
      '<div class="pt-global"><div class="pt-ancho-xl pt-global-in">' +
      // El logo va a color: assets/Logov2.png es la versión BLANCA (para la
      // nav azul de la app) y sobre esta barra blanca no se vería.
      '<img class="pt-logo" src="' + esc(P.logo || 'assets/Logov2.png') +
      '" alt="Colsubsidio" />' +
      '<nav class="pt-global-nav">' + globales + '</nav>' +
      '</div></div>' +
      '<nav class="pt-mega"><div class="pt-mega-in">' + mega + '</div></nav>' +
      '</header>'
    );
  }

  // --- hero: lo nuestro dentro de su marco --------------------------------
  function portadaHero(P) {
    var h = P.hero || {};
    var img = h.imagen
      ? '<img class="pt-hero-img" src="' + esc(h.imagen) + '" alt="" />'
      : '';
    return (
      '<section class="pt-hero"' +
      (h.gradiente ? ' style="background-image:' + esc(h.gradiente) + '"' : '') + '>' +
      '<div class="pt-ancho pt-hero-in">' +
      '<nav class="pt-migaja">' +
      pInerte('', 'Inicio') + '<span>/</span><span class="pt-migaja-mas">···</span>' +
      '<span>/</span><b>Construye la casa de tus sueños</b>' +
      '</nav>' +
      '<div class="pt-hero-grid">' +
      '<div class="pt-hero-txt">' +
      '<h1>Construye la casa de tus sueños</h1>' +
      '<p>Respondes ocho preguntas, vas viendo cómo se arma tu apartamento y al ' +
      'final te mostramos los proyectos reales que más se parecen a él.</p>' +
      '<button class="pt-btn-negro grande" data-action="goSplash">' +
      'Construir mi casa' + portadaIcono('flecha') + '</button>' +
      '<p class="pt-hero-nota">Toma 2 minutos · sin compromiso</p>' +
      '</div>' + img +
      '</div></div></section>'
    );
  }

  // --- Ciudadela Maiporé --------------------------------------------------
  function portadaMaipore(P) {
    var m = P.maipore || {};
    var valores = (m.valores || []).map(function (v) {
      return (
        '<div class="pt-valor"><span>' + esc(v.etiqueta) + '</span>' +
        '<b>' + esc(v.valor) + '</b></div>'
      );
    }).join('');
    return (
      '<section class="pt-maipore"' +
      (m.gradiente ? ' style="background-image:' + esc(m.gradiente) + '"' : '') + '>' +
      '<div class="pt-ancho-md pt-maipore-in">' +
      '<div class="pt-maipore-txt">' +
      '<h2>' + esc(m.titulo) + '</h2>' +
      '<p>' + esc(m.texto) + '</p>' +
      (valores ? '<div class="pt-precios">' + valores + '</div>' : '') +
      (m.cta ? pInerte('pt-btn-negro', esc(m.cta.texto)) : '') +
      '</div>' +
      (m.imagen ? '<img class="pt-maipore-img" src="' + esc(m.imagen) + '" alt="" />' : '') +
      '</div></section>'
    );
  }

  // --- controles de carrusel (flechas + guiones) --------------------------
  function portadaControles(clave, total, actual) {
    var n = portadaPaginas(clave, total);
    if (n < 2) return '';
    var guiones = guionesHtml(clave, n, actual);
    return (
      '<div class="pt-nav" data-nav="' + clave + '">' +
      '<button class="pt-redonda" data-action="prevPortadaSlide" data-carrusel="' + clave +
      '" aria-label="Anterior">‹</button>' +
      '<div class="pt-guiones">' + guiones + '</div>' +
      '<button class="pt-redonda" data-action="nextPortadaSlide" data-carrusel="' + clave +
      '" aria-label="Siguiente">›</button>' +
      '</div>'
    );
  }

  function portadaPista(clave, actual, contenido) {
    // Solo se emite el ÍNDICE de página; el desplazamiento lo calcula el CSS
    // con --paso y --sangria. Así el "asomo" de las tarjetas vecinas de Más
    // opciones (una tarjeta ancha centrada, con las de al lado sobresaliendo)
    // se define junto al resto de su geometría y no hay dos sitios —aquí y en
    // main.js— que tengan que ponerse de acuerdo en la misma fórmula.
    return (
      '<div class="pt-visor"><div class="pt-pista" data-pista="' + clave + '"' +
      ' style="--i:' + actual + '">' + contenido + '</div></div>'
    );
  }

  // --- Proyectos propios ---------------------------------------------------
  function portadaPropios(P, state) {
    var p = P.propios || {};
    var cards = p.tarjetas || [];
    var actual = portadaSlide(state, 'propios', cards.length);
    var html = cards.map(function (c) {
      return (
        '<article class="pt-card">' +
        '<div class="pt-card-foto">' +
        (c.imagen ? '<img src="' + esc(c.imagen) + '" alt="' + esc(c.alt || c.nombre) + '" />' : '') +
        (c.etiqueta ? '<span class="pt-vis"><i>$</i>' + esc(c.etiqueta) + '</span>' : '') +
        '</div>' +
        '<h3>' + esc(c.nombre) + '</h3>' +
        '<div class="pt-card-loc">' + esc(c.ubicacion || '') + '</div>' +
        '<div class="pt-card-datos">' +
        '<div><span>Precio desde</span><b>' + esc(c.precio || '') + '</b></div>' +
        '<div><span>Área desde</span><b>' + esc(c.area || '') + '</b></div>' +
        '</div></article>'
      );
    }).join('');

    return (
      '<section class="pt-propios"><div class="pt-ancho-xl pt-propios-in">' +
      '<div class="pt-propios-txt"><h2>' + esc(p.titulo) + '</h2>' +
      '<p>' + esc(p.texto) + '</p></div>' +
      '<div class="pt-propios-car">' +
      portadaPista('propios', actual, html) +
      portadaControles('propios', cards.length, actual) +
      '</div></div></section>'
    );
  }

  // --- Ciudades ------------------------------------------------------------
  function portadaCiudades(P, state) {
    var c = P.ciudades || {};
    var items = c.items || [];
    var actual = portadaSlide(state, 'ciudades', items.length);
    var html = items.map(function (x) {
      return (
        '<article class="pt-ciudad">' +
        '<div class="pt-ciudad-foto">' +
        (x.imagen ? '<img src="' + esc(x.imagen) + '" alt="' + esc(x.alt || x.nombre) + '" />' : '') +
        '<span class="pt-tag">' + portadaIcono('edificio') + esc(x.proyectos || '') + '</span>' +
        '</div><h3>' + esc(x.nombre) + '</h3></article>'
      );
    }).join('');

    return (
      '<section class="pt-ciudades"><div class="pt-ancho-xl">' +
      '<h2 class="pt-h2-xl">' + esc(c.titulo) + '</h2>' +
      portadaPista('ciudades', actual, html) +
      portadaControles('ciudades', items.length, actual) +
      '</div></section>'
    );
  }

  // --- Nuestros aliados ----------------------------------------------------
  function portadaAliados(P, state) {
    var a = P.aliados || {};
    var logos = a.logos || [];
    var actual = portadaSlide(state, 'aliados', logos.length);
    var html = logos.map(function (l) {
      return (
        '<div class="pt-aliado"><img src="' + esc(l.imagen) + '" alt="' +
        esc(l.alt || '') + '" /></div>'
      );
    }).join('');

    return (
      '<section class="pt-aliados"><div class="pt-ancho-xl">' +
      '<h2>' + esc(a.titulo) + '</h2>' +
      '<p class="pt-aliados-p">' + esc(a.texto) + '</p>' +
      portadaPista('aliados', actual, html) +
      portadaControles('aliados', logos.length, actual) +
      '</div></section>'
    );
  }

  // --- Más opciones para ti ------------------------------------------------
  function portadaOpciones(P, state) {
    var o = P.opciones || {};
    var items = o.tarjetas || [];
    var actual = portadaSlide(state, 'opciones', items.length);
    var html = items.map(function (t) {
      return (
        '<article class="pt-opcion">' +
        '<div class="pt-opcion-txt"><h3>' + esc(t.titulo) + '</h3>' +
        '<p>' + esc(t.texto) + '</p>' +
        pInerte('pt-btn-blanco', esc((t.cta || {}).texto || 'Conoce más')) +
        '</div>' +
        (t.imagen ? '<img src="' + esc(t.imagen) + '" alt="" />' : '') +
        '</article>'
      );
    }).join('');

    return (
      '<section class="pt-opciones"><div class="pt-ancho-xl">' +
      '<div class="pt-opciones-cab">' +
      '<h2 class="pt-h2-xl">' + esc(o.titulo) + '</h2>' +
      '<p>' + esc(o.texto) + '</p></div>' +
      portadaPista('opciones', actual, html) +
      portadaControles('opciones', items.length, actual) +
      '</div></section>'
    );
  }

  // --- footer --------------------------------------------------------------
  function portadaFooter(P, state) {
    var f = P.footer || {};
    var pestanas = f.pestanas || [];
    var activa = Math.min(state.portadaFooterTab || 0, Math.max(0, pestanas.length - 1));

    var tabs = pestanas.map(function (t, i) {
      return (
        '<button class="pt-tab' + (i === activa ? ' activo' : '') + '"' +
        ' data-action="setPortadaFooterTab" data-value="' + i + '">' +
        esc(t.titulo) + '</button>'
      );
    }).join('');

    var links = ((pestanas[activa] || {}).links || []).map(function (l) {
      // Los rótulos del bloque de contacto ("En Bogotá:") no llevan enlace.
      return l.url
        ? pInerte('pt-flink', esc(l.texto))
        : '<span class="pt-flink pt-flabel">' + esc(l.texto) + '</span>';
    }).join('');

    var redes = (f.redes || []).map(function (r) {
      return pInerte('pt-red',
        (r.imagen ? '<img src="' + esc(r.imagen) + '" alt="" />' : '') + esc(r.texto));
    }).join('');

    var vigilancia = (f.vigilancia || []).map(function (v) {
      return '<img class="pt-vigilado" src="' + esc(v.imagen) + '" alt="' + esc(v.texto) + '" />';
    }).join('');

    return (
      '<footer class="pt-footer">' +
      '<div class="pt-tabs"><div class="pt-ancho-md pt-tabs-in">' + tabs + '</div></div>' +
      '<div class="pt-ancho-md pt-flinks">' + links + '</div>' +
      '<div class="pt-dark"><div class="pt-ancho-md pt-dark-in">' +
      '<span class="pt-redes-tit">Síguenos en redes sociales</span>' +
      '<div class="pt-redes">' + redes + '</div>' +
      '<div class="pt-vigilados">' + vigilancia + '</div>' +
      '</div></div>' +
      '<div class="pt-copy">' + esc(f.copyright || '') + '</div>' +
      '</footer>'
    );
  }

  // Índice de página válido: si el catálogo se regenera con menos tarjetas, el
  // índice guardado puede quedar fuera de rango y la pista se iría a un hueco.
  function portadaSlide(state, clave, total) {
    var n = portadaPaginas(clave, total);
    var i = (state.portadaSlides || {})[clave] || 0;
    return Math.min(Math.max(i, 0), n - 1);
  }

  function landing(state) {
    var P = window.GDF_PORTADA;
    if (!P) {
      // js/portada.js es generado; si falta, al menos queda la puerta al quiz.
      return (
        '<div class="gdf-screen gdf-portada"><div class="pt-fallback">' +
        '<h1>Construye la casa de tus sueños</h1>' +
        '<button class="pt-btn-negro grande" data-action="goSplash">Construir mi casa</button>' +
        '</div></div>'
      );
    }
    return (
      '<div class="gdf-screen gdf-portada">' +
      // Scroll INTERNO, no de página: en escritorio styles.css pone
      // body{overflow:hidden} y .gdf-shell{height:100vh}, así que una portada
      // que scrollease la página no dejaría ver nada por debajo del hero.
      '<div class="gdf-portada-scroll">' +
      portadaCabecera(P) +
      portadaHero(P) +
      portadaMaipore(P) +
      portadaPropios(P, state) +
      portadaCiudades(P, state) +
      portadaAliados(P, state) +
      portadaOpciones(P, state) +
      portadaFooter(P, state) +
      '</div>' +
      (P.opinion ? pInerte('pt-opinion', esc(P.opinion.texto)) : '') +
      '</div>'
    );
  }

  // Pantalla de entrada: sigue el spec visual de
  // design/landing-hero-handoff/ (nav azul con logo, pastilla de campaña,
  // casa ilustrada con CSS, un solo badge). Trae su propia nav en vez de la
  // compartida `header()` — ver `showHeader` en renderApp(). El CTA salta
  // directo a escarapela: ya no hay pantalla de elegir personaje.
  function splash() {
    return (
      '<div class="gdf-screen gdf-hero">' +
      '<nav class="gdf-hero-nav">' +
      '<img class="gdf-hero-logo" src="assets/Logov2.png" alt="Colsubsidio" />' +
      '</nav>' +
      '<main class="gdf-hero-main">' +
      '<button class="gdf-back-btn" data-action="goLanding">← Atrás</button>' +
      '<div class="gdf-hero-pill"><span class="dot"></span>Grúa del Futuro</div>' +
      houseIllustration() +
      '<h1>Construye tu sueño</h1>' +
      '<p class="gdf-hero-lead">Responde jugando y encuentra tu vivienda ideal con <strong>Colsubsidio</strong>.</p>' +
      '<p class="gdf-hero-quote">&ldquo;Tú pones el sueño. Nosotros la grúa.&rdquo;</p>' +
      '<button class="gdf-hero-cta" data-action="goEscarapela">¡Construir mi casa!</button>' +
      '<div class="gdf-hero-badges">' +
      '<span class="gdf-hero-badge"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0067B1" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l3 2"></path><path d="M9 2h6"></path></svg>2 minutos</span>' +
      '</div>' +
      '</main>' +
      '</div>'
    );
  }

  // nombre/apellido/correo separados (no un solo "nombre completo"): el
  // backend de leads (contrato SenalBowl) los requiere como campos
  // independientes — ver js/leads.js.
  function isValidEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  }

  function escarapela(state) {
    var genderObj = findGender(state.gender);
    var canStart = !!(
      state.nombre.trim() &&
      state.apellido.trim() &&
      state.correo.trim() &&
      isValidEmail(state.correo.trim()) &&
      window.GDF.leads.esMovilColombiano(state.telefono) &&
      state.consent
    );

    var telMal = !!state.telefono.trim() && !window.GDF.leads.esMovilColombiano(state.telefono);

    var affiliateBadge =
      state.afiliado !== null
        ? '<span class="affiliate-badge">' + (state.afiliado === 'Sí' ? 'Afiliado ✓' : 'No afiliado') + '</span>'
        : '';

    var fullName = (state.nombre.trim() + ' ' + state.apellido.trim()).trim();

    return (
      '<div class="gdf-screen gdf-escarapela">' +
      '<button class="gdf-back-btn" data-action="goSplash">← Atrás</button>' +
      '<div class="kicker"><div class="eyebrow">TU CARNÉ DE CONSTRUCTOR</div><h2>Primero, preséntate</h2></div>' +
      '<div class="gdf-carnet">' +
      '<div class="clip"></div>' +
      '<div class="band"><img src="assets/mark-yellow.png" alt="" /><span>CARNÉ DE CONSTRUCTOR</span></div>' +
      '<div class="body">' +
      '<div class="avatar" id="carnetAvatar">' + genderObj.emoji + '</div>' +
      '<div class="name" id="carnetName">' + (esc(fullName) || 'Tu nombre') + '</div>' +
      '<div class="phone" id="carnetPhone">' + (esc(state.telefono.trim()) || 'Tu teléfono') + '</div>' +
      '<div class="badge-wrap" id="carnetBadgeWrap">' + affiliateBadge + '</div>' +
      '</div>' +
      '</div>' +
      '<label class="gdf-field-label">Nombres</label>' +
      '<input class="gdf-input" id="nombreInput" placeholder="Ej: Ana" value="' + esc(state.nombre) + '" />' +
      '<label class="gdf-field-label">Apellidos</label>' +
      '<input class="gdf-input" id="apellidoInput" placeholder="Ej: Ruiz Gómez" value="' + esc(state.apellido) + '" />' +
      '<label class="gdf-field-label">Correo electrónico</label>' +
      '<input class="gdf-input" id="correoInput" type="email" placeholder="Ej: ana.ruiz@correo.com" value="' + esc(state.correo) + '" />' +
      '<label class="gdf-field-label">Teléfono (WhatsApp)</label>' +
      '<input class="gdf-input' + (telMal ? ' gdf-input--error' : '') + '" id="telefonoInput" inputmode="tel" placeholder="Ej: 300 123 4567" value="' + esc(state.telefono) + '" />' +
      // El aviso solo aparece cuando YA escribió algo y está mal: si saltara
      // con el campo vacío, regañaría a quien todavía no ha empezado.
      (telMal ? '<p class="gdf-field-error">Debe ser un móvil colombiano: 10 dígitos que empiezan por 3.</p>' : '') +
      '<label class="gdf-field-label">¿Estás afiliado a Colsubsidio?</label>' +
      '<div class="gdf-affiliate-row">' +
      '<button class="gdf-affiliate-btn' + (state.afiliado === 'Sí' ? ' selected' : '') + '" data-action="setAfiliado" data-value="Sí">Sí, afiliado</button>' +
      '<button class="gdf-affiliate-btn' + (state.afiliado === 'No' ? ' selected' : '') + '" data-action="setAfiliado" data-value="No">No lo soy</button>' +
      '</div>' +
      '<label class="gdf-consent" data-action="toggleConsent">' +
      '<span class="box' + (state.consent ? ' checked' : '') + '">' + (state.consent ? '✓' : '') + '</span>' +
      '<span class="text">Autorizo el tratamiento de mis datos personales para recibir información de vivienda de Colsubsidio (Habeas Data).</span>' +
      '</label>' +
      '<button class="gdf-btn-primary' + (canStart ? ' enabled' : '') + '" data-action="startQuiz">Empezar a construir →</button>' +
      '<p class="gdf-hint">Completa nombres, apellidos, correo, teléfono y consentimiento para continuar.</p>' +
      '</div>'
    );
  }

  // Una sola fuente del HTML de un cuarto: la usan sceneBlock (render completo)
  // y updatePlantaDOM en main.js (para insertar las piezas nuevas). Si diverge,
  // las piezas que caen de la grúa dejarían de parecerse a las que ya estaban.
  // Una pieza del plano: una caja que recorta, y dentro un lienzo con la imagen
  // COMPLETA del plano, dimensionado y desplazado para que por el recorte
  // asome exactamente su trozo. Cuando están todas las piezas, el conjunto es
  // la imagen entera y sin costuras.
  //
  // Es la única fuente del HTML de una pieza: la usan sceneBlock (pintado
  // completo) y updatePlantaDOM en main.js (para insertar las que caen). Si
  // divergen, las piezas nuevas dejan de parecerse a las que ya estaban.
  function cuartoHtml(room, animado) {
    return (
      '<div class="gdf-room' + (animado ? ' animated' : '') + '"' +
      ' data-room="' + esc(room.id) + '" style="' + room.styleText + '">' +
      '<i class="lienzo" style="' + room.lienzoStyle + '"></i>' +
      '</div>'
    );
  }

  // La silueta: la forma real del apartamento, en gris, desde antes de la
  // primera respuesta. Sirve para que las piezas caigan DENTRO de algo en vez
  // de aparecer flotando, y para que al retroceder quede el hueco a la vista.
  function siluetaHtml(huecos, rooms) {
    if (!huecos || !huecos.length) return '';
    // Qué celdas ya tienen pieza encima: su hueco nace apagado.
    var ocupados = {};
    (rooms || []).forEach(function (r) { ocupados[r.id] = true; });
    return (
      '<div class="gdf-silueta">' +
      huecos
        .map(function (h) {
          // El id permite apagar el hueco en cuanto su pieza cae encima. Hace
          // falta porque las piezas van en `mix-blend-mode: multiply` para que
          // el papel blanco del plano no tape la escena: si el hueco gris
          // siguiera debajo, la pieza se multiplicaría contra él y el plano
          // entero saldría entintado de gris.
          return '<i class="gdf-hueco" data-hueco="' + esc(h.id) + '"' +
            (ocupados[h.id] ? ' style="opacity:0;' + h.styleText + '"' : ' style="' + h.styleText + '"') +
            '></i>';
        })
        .join('') +
      '</div>'
    );
  }

  // NOTA: aquí estaba `rotuloHtml`, la pastilla azul que nombraba el proyecto y
  // la tipología del plano que se estaba armando. Se quitó a propósito: el
  // apartamento es un EJEMPLO y ponerle nombre solo invitaba a leerlo como la
  // recomendación, que se calcula al final y suele ser otro proyecto.

  // Las zonas comunes REALES del proyecto líder, alrededor de la losa. Las que
  // el usuario pidió en 'entorno_deseado' van resaltadas. El cruce es directo
  // porque `amenidades[].clave` ya viene normalizada del scraper al mismo
  // vocabulario que usan los valores de esa pregunta.
  function haloAmenidadesHtml(planta, answers) {
    if (!planta || !planta.amenidades || !planta.amenidades.length) return '';
    var pedidas = answers.entorno_deseado || [];
    var lista = planta.amenidades.slice();
    // Primero las que coinciden con lo que pidió: son las que quiere ver.
    lista.sort(function (a, b) {
      return (pedidas.indexOf(b.clave) > -1) - (pedidas.indexOf(a.clave) > -1);
    });
    var chips = lista
      .slice(0, 6)
      .map(function (am) {
        var coincide = am.clave && pedidas.indexOf(am.clave) > -1;
        var icono = am.icon
          ? '<img src="' + esc(am.icon) + '" alt="" loading="lazy" />'
          : '<span class="punto">•</span>';
        return (
          '<span class="gdf-halo-chip' + (coincide ? ' coincide' : '') + '"' +
          ' title="' + esc(am.label) + '">' + icono + '</span>'
        );
      })
      .join('');
    return '<div class="gdf-halo">' + chips + '</div>';
  }

  function sceneBlock(state, derived, animarTodo) {
    var showCrane = state.screen === 'quiz';
    var genderObj = findGender(state.gender);
    var planta = derived.planta;
    var answers = state.answers || {};

    var loteHtml = derived.showLote ? '<div class="gdf-lote"><span>Tu lote</span></div>' : '';

    var roomsHtml = '';
    if (derived.losaRevealed) {
      var roomsInner = derived.rooms
        .map(function (room) {
          return cuartoHtml(room, !!animarTodo);
        })
        .join('');
      // --ratio le da a la losa la forma real del apartamento (sin él, el mismo
      // plano se ve apaisado en móvil y cuadrado en escritorio) y --wmax impide
      // ampliar la imagen por encima de 1:1 en pantallas anchas.
      roomsHtml =
        '<div class="gdf-losa" data-sello="' + esc(planta ? planta.sello : '') + '"' +
        ' style="--ratio:' + (planta ? planta.ratio : 1.4) +
        ';--wmax:' + (planta ? planta.wmax : 700) + 'px">' +
        siluetaHtml(derived.huecos, derived.rooms) +
        roomsInner +
        '</div>';
    }

    var craneHtml = showCrane
      ? '<div class="gdf-crane-jib"><div class="counterweight"></div></div><div class="gdf-crane-hook-top"></div>'
      : '';

    var avatarMarker = '<div class="gdf-avatar-marker">' + genderObj.emoji + '</div>';

    // La pregunta del piso no añade piezas: cambia lo que se ve DEBAJO del
    // apartamento (a qué altura está) y la sombra que proyecta. Es data-* para
    // que main.js lo actualice sin tocar el resto de la escena.
    var piso = answers.piso_preferido ? ' data-piso="' + esc(answers.piso_preferido) + '"' : '';
    var haloHtml = answers.entorno_deseado ? haloAmenidadesHtml(planta, answers) : '';

    // Sin rótulo ni marca de localidad: el apartamento es un EJEMPLO para
    // enseñar cómo se arma una vivienda, y nombrarlo solo invita a creer que es
    // la recomendación. La recomendación sale al final, calculada con las
    // respuestas. Además el nombre de la localidad chocaba con la que el
    // usuario acababa de elegir en la pregunta 5.
    return (
      '<div class="gdf-scene"' + piso + '>' +
      loteHtml + roomsHtml + haloHtml + craneHtml + avatarMarker +
      '</div>'
    );
  }

  // La mayoría de preguntas son grillas de botones (q.options), pero 'edad'
  // (entero exacto, lo pide el contrato de leads), 'entorno_deseado'
  // (buscador con chips sobre las 25 opciones fijas) necesitan un input real
  // en vez de opciones fijas de un solo valor — ver 'answerQuizNumber'/
  // 'answerQuizText'/'answerQuizMultiselect' en main.js, que leen el
  // input/la selección en curso al vuelo y despachan 'selectOption' con el
  // valor armado.
  function quiz(state, derived) {
    // La escena se pinta entera solo aquí (primera vez que se entra al quiz, o
    // un F5): por eso animarTodo=true, que ahí sí todo es nuevo de verdad. Al
    // responder una pregunta NO se pasa por aquí — main.js parchea el DOM para
    // que solo caiga de la grúa la pieza nueva. Ver updateQuizDOM.
    return sceneBlock(state, derived, true) + quizPanel(state, derived);
  }

  function quizPanel(state, derived) {
    var q = derived.q;
    var answerAreaHtml = '';

    if (q && q.type === 'number') {
      answerAreaHtml =
        '<div class="gdf-quiz-freeform">' +
        '<input class="gdf-input" id="quizNumberInput" type="number" inputmode="numeric"' +
        (q.min != null ? ' min="' + q.min + '"' : '') +
        (q.max != null ? ' max="' + q.max + '"' : '') +
        ' placeholder="' + esc(q.placeholder || '') + '" />' +
        '<button class="gdf-btn-primary" data-action="answerQuizNumber" data-qid="' + q.id + '">Continuar →</button>' +
        '</div>';
    } else if (q && q.type === 'text') {
      answerAreaHtml =
        '<div class="gdf-quiz-freeform">' +
        '<input class="gdf-input" id="quizTextInput" type="text" placeholder="' + esc(q.placeholder || '') + '" />' +
        '<button class="gdf-btn-primary enabled" data-action="answerQuizText" data-qid="' + q.id + '">Continuar →</button>' +
        '</div>';
    } else if (q && q.type === 'multiselect') {
      // Buscador puro: la lista NO es un bloque aparte ni se puede "explorar
      // todo" — solo aparece, filtrada, mientras hay texto con coincidencias
      // (ver main.js). Flota pegado al buscador (position:absolute sobre
      // '.gdf-entorno-combo', ver CSS), por eso no es un <details> nativo:
      // ahí no hay forma de decidir por JS cuándo mostrarlo. Debajo, en su
      // propio lugar: chips de lo elegido y Continuar al final.
      var multiOpts = q.options
        .map(function (o) {
          return (
            '<button type="button" class="gdf-multi-opt" data-action="toggleEntorno" data-value="' + esc(o.v) + '">' +
            esc(o.label) +
            '</button>'
          );
        })
        .join('');
      answerAreaHtml =
        '<div class="gdf-quiz-freeform">' +
        '<div class="gdf-entorno-combo">' +
        '<input class="gdf-input" id="entornoSearch" type="text" placeholder="Busca (ej. piscina, bbq)…" autocomplete="off" />' +
        '<div class="gdf-multi-opt-list" id="entornoOpciones">' + multiOpts + '</div>' +
        '</div>' +
        '<div class="gdf-entorno-chips" id="entornoChips"></div>' +
        '<button class="gdf-btn-primary enabled" data-action="answerQuizMultiselect" data-qid="' + q.id + '">Continuar →</button>' +
        '</div>';
    } else if (q) {
      var cols = q.cols || 1;
      var options = q.options
        .map(function (o) {
          var hasHint = !!o.hint;
          return (
            '<button class="gdf-opt-btn' + (hasHint ? ' has-hint' : '') + '" data-action="selectOption" data-qid="' + q.id + '" data-value="' + esc(o.v) + '">' +
            '<span class="label">' + esc(o.label) + '</span>' +
            (hasHint ? '<span class="hint">' + esc(o.hint) + '</span>' : '') +
            '</button>'
          );
        })
        .join('');
      answerAreaHtml = '<div class="gdf-options cols-' + cols + '">' + options + '</div>';
    }

    // Siempre visible: en la primera pregunta (qi===0) goBack regresa a
    // escarapela en vez de no hacer nada (ver applyAction en state.js).
    var backBtn = '<button class="gdf-back-btn" data-action="goBack">← Atrás</button>';

    return (
      '<div class="gdf-screen gdf-quiz">' +
      '<div class="gdf-compat">' +
      '<div class="gdf-compat-row"><span>Compatibilidad con proyectos</span><span>' + derived.compat + '%</span></div>' +
      '<div class="gdf-progress-track"><div class="gdf-progress-fill" style="width:' + derived.compat + '%"></div></div>' +
      '</div>' +
      '<div class="gdf-step-count">Pregunta ' + Math.min(derived.answered + 1, derived.stepTotal) + ' de ' + derived.stepTotal + '</div>' +
      '<div class="gdf-question"><h2>' + (q ? esc(q.title) : '') + '</h2><p>' + (q ? esc(q.sub) : '') + '</p></div>' +
      answerAreaHtml +
      backBtn +
      '</div>'
    );
  }

  function result(state, derived) {
    var lead = state.lead;

    var chipsHtml = derived.perfilChips
      .map(function (c) {
        return '<span class="gdf-chip' + (c.hi ? ' hi' : '') + '">' + esc(c.text) + '</span>';
      })
      .join('');

    var notesHtml = lead.notes
      .map(function (n) {
        return '<span class="gdf-lead-note">' + esc(n) + '</span>';
      })
      .join('');

    var leadTitle = lead.status === 'ready' ? '¡Listo para hablar con un asesor!' : 'Vamos construyendo tu camino';
    var leadSub =
      lead.status === 'ready'
        ? 'Tu perfil y tu financiación están listos. Un asesor te contacta muy pronto.'
        : 'Ya tienes un plano. Sigamos afinando tu compra ideal — te acompañamos con información y seguimiento.';

    var leadBadgeHtml =
      '<div class="gdf-lead-badge ' + lead.status + '">' +
      '<span class="icon">' + lead.icon + '</span>' +
      '<div class="title">' + leadTitle + '</div>' +
      '<div class="subcopy">' + leadSub + '</div>' +
      '<div class="gdf-lead-notes">' + notesHtml + '</div>' +
      '</div>';

    var firstName = state.nombre.trim().split(' ')[0] || 'constructor';
    var reco = state.reco;

    // El cuerpo cambia según en qué punto va el paso 1 del contrato. Solo el
    // estado 'listo' pinta tarjetas y CTA; los demás explican qué pasó.
    var cuerpoHtml;
    if (reco.estado === 'cargando') cuerpoHtml = recoCargando();
    else if (reco.estado === 'vacio') cuerpoHtml = recoVacio(state);
    else if (reco.estado === 'error') cuerpoHtml = recoError(reco);
    else cuerpoHtml = recoLista(state, reco);

    return (
      '<div class="gdf-screen gdf-result">' +
      '<div class="gdf-result-head">' +
      '<div class="eyebrow">TUS PROYECTOS RECOMENDADOS ✦</div>' +
      '<h2>Esto es lo que encaja contigo,<br>' + esc(firstName) + '</h2>' +
      '</div>' +
      '<div class="gdf-chips">' + chipsHtml + '</div>' +
      cuerpoHtml +
      '<button class="gdf-restart-btn" data-action="restart">↺ Empezar de nuevo</button>' +
      '<p class="gdf-disclaimer">Datos de área, habitaciones, baños y precio tomados de las fichas oficiales de cada proyecto en colsubsidio.com. La recomendación es una demostración del reto.</p>' +
      '</div>'
    );
  }

  // --- Los cuatro estados de la pantalla de selección ----------------------

  // Esqueleto de carga. El aviso del servidor dormido aparece solo a los 8s
  // (lo activa una clase por CSS, sin temporizadores en JS): el plan gratuito
  // de Render tarda ~25s en despertar y sin explicación parece que se colgó.
  function recoCargando() {
    var tarjetas = '';
    for (var i = 0; i < 6; i++) {
      tarjetas +=
        '<div class="gdf-skeleton-card">' +
        '<div class="gdf-skeleton-header"></div>' +
        '<div class="gdf-skeleton-body">' +
        '<div class="gdf-skeleton-linea ancha"></div>' +
        '<div class="gdf-skeleton-linea media"></div>' +
        '<div class="gdf-skeleton-tags"><span></span><span></span><span></span></div>' +
        '</div></div>';
    }
    return (
      '<p class="gdf-match-count">Buscando proyectos para ti…</p>' +
      '<p class="gdf-reco-lento">El servidor puede tardar unos segundos en despertar la primera vez.</p>' +
      '<div class="gdf-projects">' + tarjetas + '</div>'
    );
  }

  // 200 con lista vacía: el backend respondió bien, simplemente no tiene nada
  // en esa zona. No es un fallo y no se ofrece "reintentar" — reintentar daría
  // exactamente lo mismo. Lo accionable es cambiar la zona.
  function recoVacio(state) {
    var zona = state.answers.zona || 'tu localidad';
    return (
      '<div class="gdf-reco-aviso vacio">' +
      '<div class="icono">🔍</div>' +
      '<h3>Sin resultados para ' + esc(zona) + '</h3>' +
      '<p>No encontramos proyectos disponibles ahí con lo que nos contaste. ' +
      'Prueba con otra zona o ajusta el presupuesto.</p>' +
      '<div class="acciones">' +
      '<button class="gdf-btn-primary enabled" data-action="goBack">← Cambiar mis respuestas</button>' +
      '<button class="gdf-btn-secundario" data-action="usarLocalAproximado">Ver proyectos parecidos</button>' +
      '</div>' +
      '</div>'
    );
  }

  // Fallo de red o del servidor. Se distingue a propósito del caso vacío: acá
  // sí tiene sentido reintentar, y se ofrece la salida por el motor local.
  function recoError(reco) {
    return (
      '<div class="gdf-reco-aviso error">' +
      '<div class="icono">⚠️</div>' +
      '<h3>No pudimos traer tus recomendaciones</h3>' +
      '<p>' + esc(reco.error || 'Hubo un problema de conexión.') + '</p>' +
      '<div class="acciones">' +
      '<button class="gdf-btn-primary enabled" data-action="reintentarReco">Reintentar</button>' +
      '<button class="gdf-btn-secundario" data-action="usarLocalAproximado">Ver recomendaciones aproximadas</button>' +
      '</div>' +
      '</div>'
    );
  }

  function recoLista(state, reco) {
    var projectsHtml = reco.items
      .map(function (vm, i) {
        return projectCard(vm, state, i);
      })
      .join('');

    var elegido = state.chosen;
    var ctaLabel = elegido ? 'Continuar →' : 'Elige un proyecto para continuar';

    // Cuando las tarjetas salen del motor local hay que decirlo, siempre. Que
    // el backend esté caído no puede parecer un resultado del modelo.
    var avisoAprox = reco.aproximado
      ? '<div class="gdf-reco-banner">Estos proyectos salen de nuestro catálogo local, no del modelo de recomendación. ' +
        'Son reales, pero el orden es aproximado.</div>'
      : '';

    return (
      avisoAprox +
      '<p class="gdf-match-count">Ordenados por afinidad con tu perfil. Elige el que más te interese.</p>' +
      debugPanel(state) +
      '<div class="gdf-projects">' + projectsHtml + '</div>' +
      '<div class="gdf-seleccion-cta">' +
      '<button class="gdf-btn-primary' + (elegido ? ' enabled' : '') + '" data-action="goConfirmacion">' + ctaLabel + '</button>' +
      '</div>'
    );
  }

  // "1 hab" · "2 hab" · "1–3 hab" — el backend manda un array de tipologías.
  function etiquetaHabitaciones(habitaciones) {
    if (!habitaciones || !habitaciones.length) return null;
    var min = Math.min.apply(null, habitaciones);
    var max = Math.max.apply(null, habitaciones);
    return (min === max ? min : min + '–' + max) + ' hab';
  }

  // Zonas comunes del proyecto ("Este proyecto cuenta con:" en la ficha real).
  // Las que el usuario pidió en la pregunta de entorno se separan en dos
  // grupos en vez de un solo grid con las coincidencias ordenadas primero:
  //   - amenidadesCoincidenHtml(): SIEMPRE visible en la tarjeta, sin abrir
  //     nada — es el efecto psicológico de "esto sí tiene lo que pediste",
  //     que se pierde si queda mezclado con el resto del catálogo.
  //   - amenidadesRestoHtml(): lo que NO coincide (o, si el usuario no marcó
  //     nada, el catálogo completo) va al pliego (`detalleProyecto`), visible
  //     igual pero sin competir por atención con el match.
  function amenidadItem(a, coincide, idx) {
    var ico = a.icon
      ? '<img src="' + esc(a.icon) + '" alt="" loading="lazy" />'
      : '<span class="gdf-amenity-punto">•</span>';
    var delay = coincide ? ' style="animation-delay:' + idx * 70 + 'ms"' : '';
    return (
      '<div class="gdf-amenity' + (coincide ? ' coincide' : '') + '"' + delay + '>' +
      ico + '<span class="gdf-amenity-label">' + esc(a.label) + '</span>' +
      (coincide ? '<span class="gdf-amenity-check" aria-hidden="true">✓</span>' : '') +
      '</div>'
    );
  }

  function amenidadesCoincidenHtml(amenidades, buscadas) {
    if (!amenidades || !amenidades.length || !buscadas || !buscadas.length) return '';
    var coinciden = amenidades.filter(function (a) {
      return !!a.clave && buscadas.indexOf(a.clave) > -1;
    });
    if (!coinciden.length) return '';

    var items = coinciden.map(function (a, idx) { return amenidadItem(a, true, idx); }).join('');

    return (
      '<div class="gdf-project-entorno destacado">' +
      '<div class="gdf-entorno-titulo">Tiene lo que buscas ✓</div>' +
      '<div class="gdf-project-amenities">' + items + '</div>' +
      '</div>'
    );
  }

  function amenidadesRestoHtml(amenidades, buscadas) {
    if (!amenidades || !amenidades.length) return '';
    var pedidas = buscadas || [];
    var resto = amenidades.filter(function (a) {
      return !(a.clave && pedidas.indexOf(a.clave) > -1);
    });
    // Si nada coincidió (o no se pidió nada), el pliego muestra el catálogo
    // completo — ninguna amenidad se pierde por falta de match.
    if (!resto.length) resto = amenidades;

    var items = resto.map(function (a) { return amenidadItem(a, false, 0); }).join('');

    return (
      '<div class="gdf-detalle-amenidades">' +
      '<div class="gdf-detalle-amenidades-titulo">Todo lo que incluye este proyecto</div>' +
      '<div class="gdf-project-amenities">' + items + '</div>' +
      '</div>'
    );
  }

  // Tarjeta de proyecto de la pantalla de selección. Recibe el VIEW-MODEL que
  // arma js/recommender.js, no un proyecto del catálogo: así da igual si la
  // recomendación vino del backend o del motor local. `vm.local` es el proyecto
  // scrapeado equivalente (o null) y es lo que habilita imagen y planos.
  // Selección ÚNICA — ver 'chooseProject' en state.js.
  function projectCard(vm, state, i) {
    var chosen = state.chosen === vm.id;
    var local = vm.local || {};
    var sim = window.GDF.simulador;

    var headerStyle = local.image
      ? "background:url('" + local.image + "') center/cover no-repeat, " + (local.grad || '')
      : 'background:' + (local.grad || 'linear-gradient(135deg,#0067b1,#4a94cc)');
    var emojiHtml = local.image ? '' : '<span class="emoji">' + (local.emoji || '🏢') + '</span>';

    // El backend puntúa (match_score); si algún día no lo mandara, se muestra
    // la posición en vez de un "% match" inventado.
    var badge =
      vm.score != null
        ? '<span class="gdf-project-badge">' + vm.score + '% match</span>'
        : '<span class="gdf-project-badge">#' + (i + 1) + '</span>';

    var habLabel = etiquetaHabitaciones(vm.habitaciones);
    // Apto para subsidio es una propiedad del INMUEBLE (VIS y bajo el techo de
    // valor), así que el chip se muestra siempre que el proyecto califique. El
    // monto, en cambio, depende del hogar: solo se añade si sus ingresos están
    // dentro del escalón. Sin esa distinción el chip prometería plata a quien
    // no la puede recibir.
    var montoSubsidio = sim.subsidioEstimado(state.answers.ingresos);
    var chipSubsidio = sim.aptoParaSubsidio(vm.vis, vm.precioCop)
      ? '<span class="gdf-project-tag subsidio">Apto para subsidio' +
        (montoSubsidio ? ' · hasta ' + esc(sim.millones(montoSubsidio)) : '') + '</span>'
      : '';

    var tags =
      '<span class="gdf-project-tag">Desde ' + esc(sim.millones(vm.precioCop)) + '</span>' +
      (vm.area ? '<span class="gdf-project-tag">' + vm.area + ' m²</span>' : '') +
      (habLabel ? '<span class="gdf-project-tag">' + habLabel + '</span>' : '') +
      (local.banos ? '<span class="gdf-project-tag">' + local.banos + (local.banos === 1 ? ' baño' : ' baños') + '</span>' : '') +
      chipSubsidio;

    return (
      '<div class="gdf-project-card' + (chosen ? ' chosen' : '') + '" data-action="chooseProject" data-value="' + esc(vm.id) + '">' +
      '<div class="gdf-project-header" style="' + headerStyle + '">' +
      emojiHtml +
      badge +
      '<span class="gdf-project-check" aria-hidden="true">' + (chosen ? '✓' : '') + '</span>' +
      '</div>' +
      '<div class="gdf-project-body">' +
      '<div class="gdf-project-name">' + esc(vm.nombre) + '</div>' +
      (vm.ubicacion ? '<div class="gdf-project-loc">📍 ' + esc(vm.ubicacion) + '</div>' : '') +
      '<div class="gdf-project-tags">' + tags + '</div>' +
      // Por qué quedó en esta posición. Lo redacta js/recommender.js con los
      // mismos criterios del scoring, para que el % del badge no sea un número
      // que aparece sin explicación.
      (vm.razon ? '<p class="gdf-project-razon">' + esc(vm.razon) + '</p>' : '') +
      amenidadesCoincidenHtml(vm.amenidades, state.answers.entorno_deseado) +
      detalleProyecto(vm, state) +
      // Atajo para no obligar a bajar hasta el botón fijo de abajo: solo
      // aparece en la tarjeta ya elegida. Lleva su propio data-action, así
      // que `onRootClick` (main.js) lo resuelve con `closest()` y NUNCA
      // llega a burbujear hasta el `chooseProject` del div contenedor.
      (chosen
        ? '<button class="gdf-btn-primary enabled gdf-project-continuar" data-action="goConfirmacion">Continuar →</button>'
        : '') +
      '</div>' +
      '</div>'
    );
  }

  // ---------------------------------------------------------------------
  // Desplegable de planos + simulador de pagos (reemplaza al viejo enlace
  // "Ver ficha oficial" suelto en la tarjeta).
  //
  // Todo lo interactivo de acá adentro va con data-action propio; el
  // <details> lleva data-action="noop" para que un clic dentro NO burbujee
  // hasta el data-action="chooseProject" de la tarjeta y termine
  // marcando/desmarcando el proyecto sin querer (applyAction devuelve false
  // para 'noop', así que tampoco re-renderiza).
  // ---------------------------------------------------------------------

  function numeroEs(v) {
    // 50.6 -> "50,6"  ·  46 -> "46"
    if (v == null) return '—';
    return String(v).replace('.', ',');
  }

  function metrica(rotulo, valor) {
    return '<div class="gdf-tipo-metrica"><span>' + esc(rotulo) + '</span><strong>' + esc(valor) + '</strong></div>';
  }

  function planosStrip(t) {
    if (!t.planos || !t.planos.length) return '';
    var total = t.planos.length;
    var laminas = t.planos
      .map(function (pl, i) {
        // Abre el archivo original en otra pestaña: es el equivalente al
        // botón "Ampliar" de la ficha real, sin montar un visor propio.
        var contador = total > 1
          ? '<span class="gdf-plano-num">' + (i + 1) + ' / ' + total + '</span>'
          : '';
        return (
          '<a class="gdf-plano" href="' + esc(pl.src) + '" target="_blank" rel="noopener">' +
          '<span class="gdf-plano-lienzo">' +
          '<img src="' + esc(pl.src) + '" alt="' + esc(pl.alt || pl.desc || 'Plano') + '" loading="lazy" />' +
          contador +
          '<span class="gdf-plano-zoom">Ampliar ⤢</span>' +
          '</span>' +
          (pl.desc ? '<span class="gdf-plano-desc">' + esc(pl.desc) + '</span>' : '') +
          '</a>'
        );
      })
      .join('');
    return (
      '<div class="gdf-planos">' +
      '<div class="gdf-planos-strip">' + laminas + '</div>' +
      (total > 1 ? '<div class="gdf-planos-pista">Desliza para ver los ' + total + ' planos</div>' : '') +
      '</div>'
    );
  }

  // Recorrido virtual 360° (Matterport, Bolívar360, Shape...): viene de
  // tools/scrape_proyectos.py (`extraer_recorridos_360`), es un link externo
  // real de la ficha, no algo montado por la app. Mismo `<a target="_blank">`
  // que `planosStrip`, en su propio botón para que se note que es interactivo
  // y no una imagen más.
  function tour360Html(url, etiqueta) {
    if (!url) return '';
    return (
      '<a class="gdf-tour360" href="' + esc(url) + '" target="_blank" rel="noopener">' +
      '<span class="gdf-tour360-icon">🧭</span>' +
      '<span class="gdf-tour360-texto">' + esc(etiqueta) + '</span>' +
      '<span class="gdf-tour360-flecha">↗</span>' +
      '</a>'
    );
  }

  function espaciosGrid(t) {
    if (!t.espacios || !t.espacios.length) return '';
    var items = t.espacios
      .map(function (e) {
        var ico = e.icon
          ? '<img src="' + esc(e.icon) + '" alt="" loading="lazy" />'
          : '<span class="gdf-espacio-punto">•</span>';
        return '<div class="gdf-espacio">' + ico + '<span>' + esc(e.label) + '</span></div>';
      })
      .join('');
    return (
      '<div class="gdf-tipo-subtitulo">Esta tipología cuenta con:</div>' +
      '<div class="gdf-espacios">' + items + '</div>'
    );
  }

  function tipologiaPanel(vm, t, idx, activo, state) {
    var sim = window.GDF.simulador;

    // Las dos áreas van lado a lado; el precio va aparte y destacado, porque
    // es el número que la gente busca primero (y el que alimenta el simulador).
    var areas =
      '<div class="gdf-tipo-metricas">' +
      metrica('Área construida', t.area ? numeroEs(t.area) + ' m²' : '—') +
      metrica('Área privada', t.areaPrivada ? numeroEs(t.areaPrivada) + ' m²' : '—') +
      '</div>';

    var precioHtml = t.precio
      ? '<div class="gdf-tipo-precio">' +
        '<span class="rotulo">Precio desde</span>' +
        '<span class="valor">' + esc(sim.millones(t.precio)) + '</span>' +
        (t.entrega ? '<span class="entrega">Entrega ' + esc(t.entrega) + '</span>' : '') +
        '</div>'
      : '';

    return (
      '<div class="gdf-tipo-panel' + (activo ? ' active' : '') + '" data-panel="' + idx + '">' +
      planosStrip(t) +
      tour360Html(t.tour360, 'Recorrido virtual 360° de este apartamento') +
      areas +
      precioHtml +
      espaciosGrid(t) +
      simuladorBoton(vm, t, idx) +
      '</div>'
    );
  }

  // Precio a simular: el de la tipología si la ficha la publica (97 de 106 lo
  // hacen); si no, el del view-model, que SIEMPRE viene en pesos —también
  // cuando la recomendación es del backend y no cruza con el catálogo local.
  function precioParaSimular(vm, t) {
    if (t && t.precio) return t.precio;
    return vm.precioCop || 0;
  }

  // El simulador ya NO vive dentro de la tarjeta: es un overlay a pantalla
  // casi completa (ver simuladorOverlay). Acá queda solo la puerta de
  // entrada, que además recuerda la tipología abierta para que el overlay
  // simule el precio que el usuario está viendo y no otro.
  function simuladorBoton(vm, t, idx) {
    var sim = window.GDF.simulador;
    var precio = precioParaSimular(vm, t);
    if (!precio) return '';
    return (
      '<button class="gdf-sim-abrir" data-action="abrirSimulador"' +
      ' data-proyecto="' + esc(vm.id) + '" data-tipologia="' + (idx || 0) + '">' +
      '<span class="gdf-sim-icon">💰</span>' +
      '<span class="gdf-sim-abrir-texto">Simular plan de pagos' +
      '<em>Desde ' + esc(sim.millones(precio)) + ' · cuota inicial, plazo y subsidio</em></span>' +
      '<span class="gdf-sim-abrir-flecha">→</span>' +
      '</button>'
    );
  }

  // ---------------------------------------------------------------------
  // SIMULADOR DE PAGOS — overlay de dos pasos.
  //
  // Paso 1: elegir el producto de crédito viendo ya la cuota que daría cada
  // uno. Paso 2: el simulador completo (encabezado del proyecto, controles a
  // la izquierda, recibo en vivo a la derecha). Elegir producto NO cierra el
  // overlay: avanza al paso 2, que es el destino del flujo — es el momento de
  // mayor intención de compra de toda la demo y no puede terminar en un
  // bloque diminuto dentro de una tarjeta.
  //
  // Se pinta como último hijo de .gdf-shell (ver renderApp) para que su
  // position:fixed sea contra el viewport y no contra una tarjeta con
  // overflow:hidden.
  // ---------------------------------------------------------------------

  // Qué proyecto/tipología/precio está simulando el overlay ahora mismo.
  // Devuelve null si el proyecto ya no está en la lista (p. ej. si el backend
  // respondió de nuevo con otras recomendaciones mientras estaba abierto).
  function contextoSimulador(state) {
    if (!state.simulador) return null;
    var vm = (state.reco.items || []).filter(function (x) {
      return x.id === state.simulador.proyecto;
    })[0];
    if (!vm) return null;

    var tips = (vm.local && vm.local.tipologias) || [];
    var idx = state.simulador.tipologia || 0;
    if (idx >= tips.length) idx = 0;
    var t = tips[idx] || null;
    var precio = precioParaSimular(vm, t);
    if (!precio) return null;

    var sim = window.GDF.simulador;
    var cfg = state.simConfig[vm.id] || {};
    return {
      vm: vm,
      tipologia: t,
      precio: precio,
      cfg: {
        inicial: cfg.inicial || sim.SUPUESTOS.cuotaInicialDefault,
        plazo: cfg.plazo || sim.SUPUESTOS.plazoDefault,
        modalidad: cfg.modalidad === 'pesos' ? 'pesos' : 'uvr',
        categoria: sim.normalizarCategoria(cfg.categoria),
        complementario: !!cfg.complementario,
        ingreso: cfg.ingreso || Math.round(sim.ingresoMedioDe(state.answers.ingresos)),
      },
    };
  }

  // Corre `simular` con la configuración vigente del overlay. Lo usan tanto el
  // render inicial como el parcheo de DOM de main.js, para que no haya dos
  // formas distintas de armar los mismos argumentos.
  function simularContexto(ctx, rangoIngresos) {
    return window.GDF.simulador.simular({
      precio: ctx.precio,
      vis: ctx.vm.vis,
      rangoIngresos: rangoIngresos,
      porcentajeInicial: ctx.cfg.inicial,
      plazoAnios: ctx.cfg.plazo,
      modalidad: ctx.cfg.modalidad,
      categoria: ctx.cfg.categoria,
      complementario: ctx.cfg.complementario,
      ingresoMensual: ctx.cfg.ingreso,
    });
  }

  // Paso 1: los dos productos, cada uno con la cuota que implicaría. La idea
  // es elegir viendo el número, no a ciegas.
  function simuladorPaso1(ctx, state) {
    var sim = window.GDF.simulador;
    var esAfiliado = state.answers.afiliado === 'Sí';

    var opcionesHtml = sim.SUPUESTOS.productos
      .map(function (pr) {
        var r = simularContexto(
          {
            vm: ctx.vm,
            precio: ctx.precio,
            cfg: Object.assign({}, ctx.cfg, { complementario: pr.v === 'complementario' }),
          },
          state.answers.ingresos
        );
        // El complementario solo tiene sentido si de verdad falta plata: con
        // una inicial que ya cubre el tope no hay nada que complementar, y
        // ofrecerlo igual sería vender un crédito que no se necesita.
        var cuotaHtml =
          pr.v === 'complementario' && !r.usaComplementario
            ? '<span class="gdf-credito-cuota"><em>No lo necesitas con una cuota inicial del ' +
              ctx.cfg.inicial + '%</em></span>'
            : '<span class="gdf-credito-cuota">' + sim.pesos(r.cuotaMensual) +
              '<em>/mes · ' + sim.porcentaje(pr.v === 'complementario' ? r.tasaEaComplementario : r.tasaEa) +
              '% E.A.' +
              // La del complementario nunca está confirmada; la del
              // hipotecario, solo cuando es la de UVR categoría C.
              ((pr.v === 'complementario' || r.tasaEaPorConfirmar) ? ' (por confirmar)' : '') +
              '</em></span>';
        // Solo se advierte a quien dijo que no está afiliado: para un afiliado
        // la condición ya está cumplida y repetírsela sobraría.
        var nota = !esAfiliado
          ? '<span class="gdf-credito-req">Requiere estar afiliado a Colsubsidio</span>'
          : '';
        return (
          '<button class="gdf-credito-opcion' + (pr.v === 'hipotecario' ? ' recomendada' : '') + '"' +
          ' data-action="elegirProducto" data-valor="' + esc(pr.v) + '">' +
          (pr.v === 'hipotecario' ? '<span class="gdf-credito-tag">Tu crédito base</span>' : '') +
          '<span class="gdf-credito-nombre">' + esc(pr.label) + '</span>' +
          '<span class="gdf-credito-blurb">' + esc(pr.blurb) + ' · ' + esc(pr.detalle) + '</span>' +
          nota +
          cuotaHtml +
          '</button>'
        );
      })
      .join('');

    return (
      '<h3>Elige tu tipo de crédito</h3>' +
      '<p class="gdf-credito-sub">Para ' + esc(ctx.vm.nombre) + ', con cuota inicial ' +
      ctx.cfg.inicial + '% a ' + ctx.cfg.plazo + ' años. En el siguiente paso lo ajustas todo.</p>' +
      '<div class="gdf-credito-opciones">' + opcionesHtml + '</div>' +
      '<p class="gdf-sim-nota">Estimación, no es una cotización ni una aprobación de crédito. ' +
      'Confirma las condiciones exactas con Colsubsidio.</p>'
    );
  }

  // Un grupo de botones segmentados de los controles (izquierda del paso 2).
  function simSegmento(proyecto, campo, opciones, actual) {
    return opciones
      .map(function (o) {
        return (
          '<button class="gdf-simc-opt' + (String(o.v) === String(actual) ? ' active' : '') + '"' +
          ' data-action="simSet" data-proyecto="' + esc(proyecto) + '"' +
          ' data-campo="' + campo + '" data-valor="' + esc(String(o.v)) + '">' +
          esc(o.label) + '</button>'
        );
      })
      .join('');
  }

  // Columna izquierda del paso 2. No se repinta al mover los controles (solo
  // se les mueve la clase .active desde main.js), así que acá no puede haber
  // nada que dependa del resultado del cálculo.
  function simuladorControles(ctx, state) {
    var sim = window.GDF.simulador;
    var S = sim.SUPUESTOS;
    var id = ctx.vm.id;
    var esAfiliado = state.answers.afiliado === 'Sí';

    // Este aviso NO se repinta al mover los controles, así que tiene que ser
    // texto estable: describe las tres categorías en vez de hablar de la que
    // esté seleccionada. Que la tasa de la C esté por confirmar se marca en el
    // recibo, que sí se repinta.
    var avisoCategoria =
      '<p class="gdf-simc-aviso">' +
      (esAfiliado ? '' : 'Las tasas preferenciales requieren estar afiliado a Colsubsidio. ') +
      S.categorias
        .map(function (c) {
          return c.label + ': ' + c.rango;
        })
        .join(' · ') +
      '. Preseleccionamos la que corresponde a tus ingresos.</p>';

    return (
      '<div class="gdf-simc">' +
      '<div class="gdf-simc-campo">' +
      '<label>Tipo de crédito</label>' +
      '<div class="gdf-simc-productos">' +
      '<div class="gdf-simc-producto fijo"><strong>Hipotecario</strong>' +
      '<em>Hasta ' + Math.round((ctx.vm.vis ? S.maxLtv.vis : S.maxLtv.noVis) * 100) + '% del valor' +
      (ctx.vm.vis ? ' (VIS)' : ' (No VIS)') + '</em></div>' +
      '<button class="gdf-simc-producto' + (ctx.cfg.complementario ? ' on' : '') + '"' +
      ' data-action="simSet" data-proyecto="' + esc(id) + '" data-campo="complementario"' +
      ' data-valor="' + (ctx.cfg.complementario ? '0' : '1') + '">' +
      '<strong>Complementario <span class="gdf-simc-switch"></span></strong>' +
      '<em>Cubre el faltante de la cuota inicial, escrituración y acabados</em></button>' +
      '</div>' +
      '</div>' +

      '<div class="gdf-simc-campo"><label>Modalidad</label>' +
      '<div class="gdf-simc-seg">' +
      simSegmento(id, 'modalidad', [{ v: 'uvr', label: 'UVR' }, { v: 'pesos', label: 'Pesos' }], ctx.cfg.modalidad) +
      '</div></div>' +

      '<div class="gdf-simc-campo"><label>Categoría de afiliación</label>' +
      '<div class="gdf-simc-seg">' +
      simSegmento(id, 'categoria', S.categorias, ctx.cfg.categoria) +
      '</div>' + avisoCategoria + '</div>' +

      '<div class="gdf-simc-campo"><label>Cuota inicial</label>' +
      '<div class="gdf-simc-seg">' +
      simSegmento(
        id,
        'inicial',
        S.cuotaInicialOpciones.map(function (v) {
          return { v: v, label: v + '%' };
        }),
        ctx.cfg.inicial
      ) +
      '</div></div>' +

      '<div class="gdf-simc-campo">' +
      '<label>Plazo del crédito <span class="gdf-simc-valor" id="simPlazoValor">' + ctx.cfg.plazo + ' años</span></label>' +
      '<input class="gdf-simc-slider" id="simPlazo" type="range" min="' + S.plazoMin + '" max="' + S.plazoMax + '"' +
      ' step="1" value="' + ctx.cfg.plazo + '" data-proyecto="' + esc(id) + '" />' +
      '<div class="gdf-simc-slider-rango"><span>' + S.plazoMin + ' años</span><span>' + S.plazoMax + ' años</span></div>' +
      '</div>' +

      '<div class="gdf-simc-campo"><label>Ingreso mensual del hogar</label>' +
      '<input class="gdf-simc-input" id="simIngreso" type="text" inputmode="numeric"' +
      ' value="' + sim.pesos(ctx.cfg.ingreso) + '" data-proyecto="' + esc(id) + '" />' +
      '<p class="gdf-simc-aviso">Lo usamos solo para avisarte si la cuota se sale del 30% recomendado.</p>' +
      '</div>' +
      '</div>'
    );
  }

  // Columna derecha del paso 2 — el recibo en vivo. Se genera aparte porque
  // main.js la vuelve a llamar al mover cada control y reemplaza SOLO este
  // pedazo por DOM directo, sin re-render (que perdería el foco del input de
  // ingreso y reiniciaría las animaciones).
  function simuladorResultado(ctx, rangoIngresos) {
    var sim = window.GDF.simulador;
    var r = simularContexto(ctx, rangoIngresos);
    var esUvr = r.modalidad === 'uvr';

    // Desglose de la cuota cuando hay dos créditos: sin esto el titular
    // parecería el de un solo producto más caro de lo que es.
    var desglose = r.usaComplementario
      ? '<span class="detalle">hipotecario ' + sim.pesos(r.cuotaHipotecario) +
        ' + complementario ' + sim.pesos(r.cuotaComplementario) + '</span>'
      : '<span class="detalle">a ' + r.plazoAnios + ' años</span>';

    // La cuota en UVR es la del PRIMER mes en pesos de hoy: la tasa es real y
    // el saldo se indexa al IPC, así que en la vida real la cuota sube. Se
    // dice acá arriba, no en la letra chica.
    var notaUvr = esUvr
      ? '<span class="gdf-sim-uvr">En UVR: es la cuota de hoy, sube cada año con la inflación</span>'
      : '';

    var planHtml = '';
    if (r.ahorroNecesario > 0) {
      var plan = sim.planAhorro(r.ahorroNecesario, ctx.tipologia && ctx.tipologia.entrega);
      planHtml =
        '<div class="gdf-sim-plan">' +
        '<span class="rotulo">Ahorrando</span>' +
        '<strong>' + sim.pesos(plan.mensual) + '/mes</strong>' +
        '<span class="detalle">durante ' + plan.meses + ' meses' +
        (plan.desdeEntrega ? ', hasta la entrega en ' + esc(plan.anioEntrega) : '') + '</span>' +
        '</div>';
    }

    var filas =
      '<div class="gdf-sim-fila"><span>Valor de la vivienda</span><strong>' + sim.pesos(r.precio) + '</strong></div>' +
      '<div class="gdf-sim-fila"><span>Cuota inicial (' + r.porcentajeInicial + '%)</span><strong>−' + sim.pesos(r.cuotaInicial) + '</strong></div>' +
      (r.subsidio
        ? '<div class="gdf-sim-fila subsidio"><span>Subsidio estimado <em>sujeto a verificación</em></span>' +
          '<strong>−' + sim.pesos(r.subsidio) + '</strong></div>'
        : '') +
      '<div class="gdf-sim-fila"><span>Ahorro que debes reunir</span><strong>' + sim.pesos(r.ahorroNecesario) + '</strong></div>' +
      '<div class="gdf-sim-fila"><span>Monto a financiar</span><strong>' + sim.pesos(r.montoCredito) + '</strong></div>' +
      (r.usaComplementario
        ? '<div class="gdf-sim-fila sub"><span>· Hipotecario (' + Math.round(r.maxLtv * 100) + '% del valor)</span>' +
          '<strong>' + sim.pesos(r.montoHipotecario) + '</strong></div>' +
          '<div class="gdf-sim-fila sub"><span>· Complementario a ' + r.plazoComplementario + ' años · ' +
          sim.porcentaje(r.tasaEaComplementario, 0) + '% E.A. <em>por confirmar</em></span>' +
          '<strong>' + sim.pesos(r.montoComplementario) + '</strong></div>'
        : '') +
      '<div class="gdf-sim-fila"><span>Tasa y plazo' +
      (r.tasaEaPorConfirmar ? ' <em>por confirmar</em>' : '') + '</span><strong>' +
      sim.porcentaje(r.tasaEa) + '% E.A. ' +
      (esUvr ? 'en UVR (cat. ' + r.categoria + ')' : 'en pesos') + ' · ' + r.plazoAnios + ' años</strong></div>';

    // El faltante sin complementario no es un detalle: es plata que hay que
    // poner de bolsillo, y conviene decirlo donde se ve el ahorro.
    var avisoFaltante =
      r.faltante > 0 && !r.usaComplementario
        ? '<div class="gdf-sim-alerta info">Con una cuota inicial del ' + r.porcentajeInicial +
          '% el hipotecario solo cubre el ' + Math.round(r.maxLtv * 100) + '% del valor: faltan ' +
          sim.pesos(r.faltante) + '. Enciende el crédito complementario o sube la cuota inicial.</div>'
        : '';

    var alerta = '';
    if (r.holgado === false) {
      alerta =
        '<div class="gdf-sim-alerta">⚠️ La cuota es el ' + Math.round(r.porcentajeDelIngreso * 100) +
        '% de tu ingreso, por encima del 30% recomendado. ' +
        'Sube la cuota inicial, alarga el plazo o mira un proyecto de menor valor.</div>';
    } else if (r.holgado === true) {
      alerta =
        '<div class="gdf-sim-alerta ok">✅ La cuota es el ' + Math.round(r.porcentajeDelIngreso * 100) +
        '% de tu ingreso: cabe dentro del 30% recomendado.</div>';
    }

    return (
      '<div class="gdf-sim-cuota">' +
      '<span class="rotulo">Cuota mensual estimada</span>' +
      '<span class="valor">' + sim.pesos(r.cuotaMensual) + '</span>' +
      desglose +
      notaUvr +
      '</div>' +
      planHtml +
      '<div class="gdf-sim-filas">' + filas + '</div>' +
      avisoFaltante +
      alerta
    );
  }

  function simuladorPaso2(ctx, state) {
    var sim = window.GDF.simulador;
    return (
      '<div class="gdf-sim-grid">' +
      simuladorControles(ctx, state) +
      '<div class="gdf-sim-out" id="simResultado">' + simuladorResultado(ctx, state.answers.ingresos) + '</div>' +
      '</div>' +
      '<p class="gdf-sim-nota">Estimación con SMMLV ' + sim.SUPUESTOS.anioSmmlv +
      '. Las tasas del crédito hipotecario en UVR categorías A y B y en pesos son las ' +
      'publicadas por Colsubsidio; la de la categoría C, la del complementario y el monto ' +
      'del subsidio están sujetos a verificación. No es una cotización ni una aprobación ' +
      'de crédito.</p>'
    );
  }

  function simuladorOverlay(state) {
    var ctx = contextoSimulador(state);
    if (!ctx) return '';
    var paso = state.simulador.paso === 2 ? 2 : 1;

    // Encabezado que recuerda qué se está simulando: sin esto, a los tres
    // controles movidos ya no se sabe de cuál de los seis proyectos era.
    var subtitulo = [ctx.vm.ubicacion, ctx.tipologia && ctx.tipologia.nombre]
      .filter(Boolean)
      .map(esc)
      .join(' · ');
    var encabezado =
      '<div class="gdf-sim-head">' +
      (paso === 2
        ? '<button class="gdf-sim-volver" data-action="simPaso" data-valor="1">← Tipo de crédito</button>'
        : '<span class="gdf-sim-head-paso">Paso 1 de 2</span>') +
      '<div class="gdf-sim-head-proyecto"><strong>' + esc(ctx.vm.nombre) + '</strong>' +
      (subtitulo ? '<span>' + subtitulo + '</span>' : '') + '</div>' +
      '<button class="gdf-credito-cerrar" data-action="cerrarSimulador" aria-label="Cerrar">×</button>' +
      '</div>';

    return (
      '<div class="gdf-credito-backdrop" data-action="cerrarSimulador">' +
      // data-action="noop" para que un clic DENTRO del panel no burbujee
      // hasta el backdrop y lo cierre sin querer (mismo truco que el
      // <details> de cada tarjeta de proyecto).
      '<div class="gdf-credito-modal' + (paso === 2 ? ' ancho' : '') + '" data-action="noop">' +
      encabezado +
      (paso === 2 ? simuladorPaso2(ctx, state) : simuladorPaso1(ctx, state)) +
      '</div>' +
      '</div>'
    );
  }

  function detalleProyecto(vm, state) {
    var local = vm.local || {};
    var tips = local.tipologias || [];
    var abierto = !!state.detalleAbierto[vm.id];
    var fichaHtml = local.url
      ? '<a class="gdf-project-ficha" href="' + esc(local.url) + '" target="_blank" rel="noopener">Ver ficha oficial en colsubsidio.com ↗</a>'
      : '';
    // Recorrido del EDIFICIO (zonas comunes, fachada...), distinto del que
    // pueda traer cada tipología (ese es de un apartamento puntual). Los dos
    // pueden coexistir y no se excluyen.
    var tour360ProyectoHtml = tour360Html(local.tour360, 'Recorrido virtual 360° del proyecto');
    // El pliego: amenidades que NO quedaron arriba en "Tiene lo que buscas"
    // (o el catálogo completo, si nada coincidió) — ver amenidadesRestoHtml.
    var restoAmenidadesHtml = amenidadesRestoHtml(vm.amenidades, state.answers.entorno_deseado);

    // Dos motivos distintos para no tener planos, y conviene no confundirlos:
    //   - el proyecto SÍ está en nuestro catálogo pero su ficha no publica
    //     tipologías (20 de los 66);
    //   - el proyecto viene del catálogo del backend y no lo tenemos scrapeado,
    //     así que no hay de dónde sacar los planos.
    // En ambos casos el simulador funciona igual, porque el precio siempre está.
    if (!tips.length) {
      var motivo = vm.local
        ? 'Este proyecto todavía no publica planos por tipología en su ficha oficial.'
        : 'Aún no tenemos los planos de este proyecto: no está en el catálogo que bajamos de colsubsidio.com.';
      return (
        '<details class="gdf-project-detalle"' + (abierto ? ' open' : '') + ' data-action="noop" data-proyecto="' + esc(vm.id) + '">' +
        '<summary><span class="gdf-detalle-titulo">Ver todo lo que incluye y simular pagos</span>' +
        '<span class="gdf-detalle-chevron">▾</span></summary>' +
        '<div class="gdf-detalle-body">' +
        restoAmenidadesHtml +
        '<p class="gdf-detalle-vacio">' + motivo + '</p>' +
        simuladorBoton(vm, null, 0) +
        tour360ProyectoHtml +
        fichaHtml +
        '</div>' +
        '</details>'
      );
    }

    var activa = state.tipologiaActiva[vm.id] || 0;
    if (activa >= tips.length) activa = 0;

    // Con hasta 11 tipologías (Nuva Park) la fila scrollea; el envoltorio le
    // pone un degradado al borde derecho para que se note que hay más.
    var tabsHtml =
      tips.length > 1
        ? '<div class="gdf-tipo-tabs-wrap">' +
          '<div class="gdf-tipo-tabs" role="tablist">' +
          tips
            .map(function (t, idx) {
              return (
                '<button class="gdf-tipo-tab' + (idx === activa ? ' active' : '') + '"' +
                ' data-action="verTipologia" data-proyecto="' + esc(vm.id) + '" data-idx="' + idx + '">' +
                esc(t.nombre) + '</button>'
              );
            })
            .join('') +
          '</div></div>'
        : '<div class="gdf-tipo-unica">' + esc(tips[0].nombre) + '</div>';

    var panelesHtml = tips
      .map(function (t, idx) {
        return tipologiaPanel(vm, t, idx, idx === activa, state);
      })
      .join('');

    var grupo = tips[0].grupo ? esc(tips[0].grupo.toLowerCase()) : 'tipologías';
    var resumen =
      'Ver todo lo que incluye' +
      (tips.length === 1 ? ', el plano' : ', ' + tips.length + ' ' + grupo) +
      ' y simular pagos';

    return (
      '<details class="gdf-project-detalle"' + (abierto ? ' open' : '') + ' data-action="noop" data-proyecto="' + esc(vm.id) + '">' +
      '<summary><span class="gdf-detalle-titulo">' + esc(resumen) + '</span>' +
      '<span class="gdf-detalle-chevron">▾</span></summary>' +
      '<div class="gdf-detalle-body">' +
      restoAmenidadesHtml +
      tabsHtml +
      panelesHtml +
      tour360ProyectoHtml +
      fichaHtml +
      '</div>' +
      '</details>'
    );
  }

  // Panel de depuración: se activa poniendo #debug en la URL. Sirve para ver
  // POR QUÉ el motor ordenó así, y para comparar contra el clustering cuando
  // se conecte. No se muestra nunca en el flujo normal.
  function debugPanel(state) {
    if (typeof location === 'undefined' || location.hash.indexOf('debug') === -1) return '';
    var reco = state.reco;
    var filas = reco.items
      .map(function (vm, i) {
        // Solo el motor local explica su puntaje. El backend manda match_score
        // sin desglose, así que se dice eso en vez de fingir factores.
        var detalle = (vm.factores || []).length
          ? '<ul>' +
            vm.factores
              .slice()
              .sort(function (a, b) {
                return Math.abs(b.puntos) - Math.abs(a.puntos);
              })
              .map(function (f) {
                return (
                  '<li class="' + (f.puntos >= 0 ? 'pos' : 'neg') + '">' +
                  '<b>' + (f.puntos > 0 ? '+' : '') + f.puntos + '</b> ' + esc(f.motivo) +
                  '</li>'
                );
              })
              .join('') +
            '</ul>'
          : '<ul><li>El backend no desglosa su match_score.</li>' +
            (vm.local ? '' : '<li class="neg">Sin equivalente en el catálogo local: no hay planos.</li>') +
            '</ul>';
        return (
          '<div class="gdf-debug-row">' +
          '<div class="gdf-debug-head">#' + (i + 1) + ' ' + esc(vm.nombre) +
          // Se muestran los dos: el que ve el usuario (podio fijo 96/94/89) y
          // el que salió de la fórmula. Si solo se mostrara el primero, el
          // desglose de factores de abajo parecería no cuadrar.
          ' <span>' + (vm.score != null ? vm.score + '%' : 'sin puntaje') +
          (vm.scoreReal != null && vm.scoreReal !== vm.score ? ' <em>(real ' + vm.scoreReal + '%)</em>' : '') +
          '</span></div>' +
          detalle +
          '</div>'
        );
      })
      .join('');

    var cruzados = reco.items.filter(function (vm) {
      return !!vm.local;
    }).length;

    return (
      '<div class="gdf-debug">' +
      '<div class="gdf-debug-title">🔍 Depuración del motor de recomendación</div>' +
      '<div class="gdf-debug-meta">' +
      'origen: <b>' + esc(reco.items[0] ? reco.items[0].origen : '—') +
      (reco.aproximado ? ' (aproximado)' : '') + '</b>' +
      (reco.origenCatalogo ? ' · catálogo: <b>' + esc(reco.origenCatalogo) + '</b>' : '') +
      (reco.totalCatalogo ? ' (' + reco.totalCatalogo + ')' : '') +
      (reco.leadId ? ' · lead: <b>' + esc(reco.leadId) + '</b>' : '') +
      ' · cruzados con el catálogo local: <b>' + cruzados + '/' + reco.items.length + '</b>' +
      '</div>' +
      filas +
      '</div>'
    );
  }

  // "Qué sigue": el trámite real que le espera al lead, no solo un mensaje de
  // gracias. El paso 2 cambia de redacción según cómo quedó calificado
  // (`lead.status`, de qualification.js): a uno "ready" se le promete una
  // llamada de agendamiento; a uno "nurture" se le explica que primero hay
  // una conversación de acompañamiento — mentir con el mismo texto para los
  // dos casos sería lo contrario de auténtico.
  function pasosSiguientesHtml(lead) {
    var paso2 =
      lead.status === 'ready'
        ? 'Te llama para agendar la visita y resolver dudas de financiación.'
        : 'Te llama primero para acompañarte con información — sin apuro a cerrar.';
    var pasos = [
      { t: 'Revisamos tu perfil', d: 'Afiliación, capacidad de compra y el proyecto que elegiste.' },
      { t: 'Un asesor te contacta', d: paso2 },
      { t: 'Agendamos tu visita', d: 'Conoces el proyecto en sitio y resuelves todo en persona.' },
    ];
    var itemsHtml = pasos
      .map(function (p, i) {
        return (
          '<div class="gdf-paso">' +
          '<div class="gdf-paso-num">' + (i + 1) + '</div>' +
          '<div class="gdf-paso-texto"><b>' + esc(p.t) + '</b><span>' + esc(p.d) + '</span></div>' +
          '</div>'
        );
      })
      .join('');
    return '<div class="gdf-confirm-pasos"><h3>Qué sigue</h3>' + itemsHtml + '</div>';
  }

  // Cierre del flujo. El envío del PASO 2 (POST /leads?lead_id=…) ya no espera
  // un clic de "Confirmar": main.js lo dispara solo al entrar a esta pantalla
  // (mismo patrón que cargarRecomendaciones al entrar a 'result'), así que acá
  // solo queda RELATAR en qué estado va — nunca pedir una acción para lograr
  // lo que el usuario ya pidió al elegir el proyecto.
  function confirmacion(state, derived) {
    var lead = state.lead;
    var firstName = state.nombre.trim().split(' ')[0] || 'constructor';

    var sim = window.GDF.simulador;
    var elegido = null;
    state.reco.items.forEach(function (vm) {
      if (vm.id === state.chosen) elegido = vm;
    });
    var nombreProyecto = elegido ? elegido.nombre : state.chosen || '';
    var local = (elegido && elegido.local) || {};

    var proyectoHtml =
      '<div class="gdf-confirm-proyecto">' +
      (local.image ? '<div class="gdf-confirm-foto" style="background-image:url(\'' + esc(local.image) + '\')"></div>' : '') +
      '<div class="gdf-confirm-proyecto-info">' +
      '<div class="gdf-confirm-proyecto-nombre">' + esc(nombreProyecto) + '</div>' +
      (elegido && elegido.ubicacion ? '<div class="gdf-confirm-proyecto-loc">📍 ' + esc(elegido.ubicacion) + '</div>' : '') +
      (elegido
        ? '<div class="gdf-confirm-proyecto-precio">Desde ' + esc(sim.millones(elegido.precioCop)) +
          (elegido.area ? ' · ' + elegido.area + ' m²' : '') + '</div>'
        : '') +
      '</div>' +
      '</div>';

    var chipsHtml = derived.perfilChips
      .map(function (c) {
        return '<span class="gdf-chip' + (c.hi ? ' hi' : '') + '">' + esc(c.text) + '</span>';
      })
      .join('');

    var notesHtml = lead.notes
      .map(function (n) {
        return '<span class="gdf-lead-note">' + esc(n) + '</span>';
      })
      .join('');

    var leadTitle = lead.status === 'ready' ? '¡Listo para hablar con un asesor!' : 'Vamos construyendo tu camino';
    var leadSub =
      lead.status === 'ready'
        ? 'Tu perfil y tu financiación están listos. Un asesor te contacta muy pronto.'
        : 'Sigamos afinando tu compra ideal — te acompañamos con información y seguimiento.';
    var leadBloqueHtml =
      '<div class="gdf-lead-badge ' + lead.status + '">' +
      '<span class="icon">' + lead.icon + '</span>' +
      '<div class="title">' + leadTitle + '</div>' +
      '<div class="subcopy">' + leadSub + '</div>' +
      '<div class="gdf-lead-notes">' + notesHtml + '</div>' +
      '</div>';

    var telefono = esc(state.telefono.trim());
    var envio = state.envio || { estado: 'idle' };
    // Sin lead_id no hay a qué lead asociar la elección: pasa cuando las
    // recomendaciones salieron del motor local porque el backend no respondió.
    // Se trata como una variante "buena": el asesor igual contacta, solo que
    // el registro automático no llegó.
    var sinLead = !state.reco.leadId;

    var heroClase, heroIcono, heroTitulo, heroTexto, extra;

    // Tarjeta de contacto: el detalle "auténtico" es nombrar el CANAL real
    // (una llamada, no un genérico "te contactamos") y el número exacto al
    // que le va a sonar el teléfono.
    var contactoHtml =
      '<div class="gdf-confirm-contacto">' +
      '<div class="gdf-confirm-contacto-avatar">📞</div>' +
      '<div class="gdf-confirm-contacto-info">' +
      '<div class="gdf-confirm-contacto-titulo">Te contactamos por llamada</div>' +
      '<div class="gdf-confirm-contacto-tel">' + telefono + '</div>' +
      '</div>' +
      '</div>';

    // Demo sin red (SIN_BACKEND, ver js/config.js): el recorrido se cierra en
    // el navegador y NO se registra el lead. Se dice tal cual en vez de
    // afirmar "quedó registrada", que sería mentira en esa versión.
    var demoSinRed = !!(window.GDF_CONFIG || {}).SIN_BACKEND;

    if (sinLead || envio.estado === 'enviado') {
      heroClase = 'gdf-confirm-hero--ok';
      heroIcono = '<span class="gdf-confirm-check">✓</span>';
      heroTitulo = '¡Gracias por tu interés, ' + esc(firstName) + '!';
      heroTexto = demoSinRed
        ? 'Así terminaría tu recorrido con <strong>' + esc(nombreProyecto) + '</strong>. Esta es una <strong>demostración</strong>: tus datos no se enviaron a ninguna parte.'
        : sinLead
        ? 'Tu elección para <strong>' + esc(nombreProyecto) + '</strong> quedó registrada. Un asesor de vivienda de Colsubsidio te acompaña desde acá.'
        : 'Tu solicitud para <strong>' + esc(nombreProyecto) + '</strong> ya está en manos de un asesor de vivienda de Colsubsidio.';
      extra = '';
    } else if (envio.estado === 'error') {
      heroClase = 'gdf-confirm-hero--error';
      heroIcono = '<span class="gdf-confirm-check err">!</span>';
      heroTitulo = 'No pudimos enviar tu solicitud';
      heroTexto = esc(envio.error || 'Hubo un problema de conexión.') + ' Tu selección no se perdió, puedes reintentar.';
      extra = '<button class="gdf-btn-primary enabled gdf-confirm-retry" data-action="confirmarProyecto">Reintentar envío →</button>';
    } else {
      // 'idle' o 'enviando': mismo instante, apenas se disparó el POST.
      heroClase = 'gdf-confirm-hero--cargando';
      heroIcono = '<span class="gdf-confirm-spinner" aria-hidden="true"></span>';
      heroTitulo = 'Enviando tu solicitud…';
      heroTexto = 'Un momento, estamos registrando tu interés en este proyecto.';
      extra = '';
    }

    // heroTitulo/heroTexto ya llevan cualquier dato dinámico pasado por esc()
    // en el punto en que se armaron arriba; el resto es texto fijo del propio
    // código. Se insertan tal cual, sin volver a escapar.
    return (
      '<div class="gdf-screen gdf-confirmacion">' +
      '<div class="gdf-confirm-hero ' + heroClase + '">' +
      '<div class="gdf-confirm-icon">' + heroIcono + '</div>' +
      '<h2>' + heroTitulo + '</h2>' +
      '<p>' + heroTexto + '</p>' +
      extra +
      '</div>' +
      (heroClase === 'gdf-confirm-hero--ok' ? contactoHtml + pasosSiguientesHtml(lead) : '') +
      proyectoHtml +
      (heroClase === 'gdf-confirm-hero--ok' ? leadBloqueHtml : '') +
      '<div class="gdf-confirm-bloque">' +
      '<h3>Tu perfil</h3>' +
      '<div class="gdf-chips">' + chipsHtml + '</div>' +
      '</div>' +
      '<button class="gdf-back-btn" data-action="goSeleccion">← Cambiar mi selección</button>' +
      '<button class="gdf-restart-btn" data-action="restart">↺ Empezar de nuevo</button>' +
      '</div>'
    );
  }

  function renderApp(state, derived) {
    var screenHtml;
    switch (state.screen) {
      case 'landing':
        screenHtml = landing(state);
        break;
      case 'splash':
        screenHtml = splash();
        break;
      case 'escarapela':
        screenHtml = escarapela(state);
        break;
      case 'quiz':
        screenHtml = quiz(state, derived);
        break;
      case 'result':
        screenHtml = result(state, derived);
        break;
      case 'confirmacion':
        screenHtml = confirmacion(state, derived);
        break;
      default:
        screenHtml = landing(state);
    }
    // La portada (screen 'landing') trae las tres barras de cabecera clonadas
    // de Colsubsidio y splash la suya; el resto usa la header() compartida.
    var showHeader = state.screen !== 'splash' && state.screen !== 'landing';
    // El modal va de último y fuera de screenHtml a propósito: así su
    // position:fixed es contra el viewport, sin quedar dentro de la tarjeta
    // (que tiene overflow:hidden) ni de ningún ancestro que lo recorte.
    return (
      '<div class="gdf-shell">' + (showHeader ? header() : '') + screenHtml +
      simuladorOverlay(state) + '</div>'
    );
  }

  window.GDF = window.GDF || {};
  window.GDF.templates = {
    renderApp: renderApp,
    esc: esc,
    // Las dos que usa main.js para repintar SOLO el recibo del simulador
    // cuando se mueven sus controles, sin re-render de toda la pantalla:
    // `contextoSimulador` arma los argumentos desde el estado y
    // `simuladorResultado` devuelve el HTML del recibo.
    contextoSimulador: contextoSimulador,
    simuladorResultado: simuladorResultado,
    // Las que usa main.js para actualizar el quiz sin re-render completo:
    // `quizPanel` repinta la pregunta (la escena no se toca), `cuartoHtml`
    // inserta las piezas del plano que acaban de caer y `haloAmenidadesHtml`
    // rehace las zonas comunes de la última pregunta.
    // Carruseles de la portada: state.js pregunta cuántas páginas hay (para
    // que 'siguiente' dé la vuelta) y main.js rehace los guiones cuando cambia
    // el ancho de la ventana y con él el reparto por página.
    paginasPortada: paginasPortada,
    guionesHtml: guionesHtml,
    quizPanel: quizPanel,
    cuartoHtml: cuartoHtml,
    siluetaHtml: siluetaHtml,
    haloAmenidadesHtml: haloAmenidadesHtml,
  };
})();
