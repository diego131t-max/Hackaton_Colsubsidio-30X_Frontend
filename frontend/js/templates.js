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

  // Casita ilustrada en CSS puro, compartida entre splash() (pantalla de
  // entrada) y la sección "Construye la casa de tus sueños aquí" de
  // landing(). Un poco de detalle (chimenea con humo, banderín, ventanas
  // con parteluz, jardinera, sombra de piso) para que no se vea un cuadrado
  // con un triángulo encima — ver reglas .gdf-hero-illustration en
  // styles.css.
  function houseIllustration() {
    return (
      '<div class="gdf-hero-illustration">' +
      '<div class="glow"></div>' +
      '<div class="ground"></div>' +
      '<div class="house"></div>' +
      '<div class="roof"></div>' +
      '<div class="roof-ridge"></div>' +
      '<div class="flagpole"></div>' +
      '<div class="flag"></div>' +
      '<div class="chimney"></div>' +
      '<div class="chimney-cap"></div>' +
      '<div class="smoke s1"></div>' +
      '<div class="smoke s2"></div>' +
      '<div class="awning"></div>' +
      '<div class="door"></div>' +
      '<div class="door-knob"></div>' +
      '<div class="window window-l"></div>' +
      '<div class="window window-r"></div>' +
      '<div class="flowerbox"></div>' +
      '<div class="flower flower-1"></div>' +
      '<div class="flower flower-2"></div>' +
      '<div class="accent-1"></div>' +
      '<div class="accent-2"></div>' +
      '<div class="accent-3"></div>' +
      '<div class="accent-4"></div>' +
      '</div>'
    );
  }

  function header() {
    return (
      '<div class="gdf-header">' +
      '<img src="assets/Logov2.png" alt="Colsubsidio" />' +
      '</div>'
    );
  }

  // Home corporativo: puerta de entrada a la app. Sigue el layout del mockup
  // "Construye tu casa.dc.html" (nav con CTA, hero con foto + stat card,
  // banner azul "Construye la casa de tus sueños aquí", grid de proyectos
  // tipo bento, banner final) pero con contenido real: el carrusel usa
  // LANDING_SLIDES (texto real extraído de colsubsidio.com/vivienda, ver
  // data.js), los conteos del bento salen de PROJECTS, y todos los CTA
  // "Construir mi casa" despachan goSplash → la pantalla splash() de siempre,
  // que ya encadena hacia character/escarapela/quiz/result.
  function landing(state) {
    var SLIDES = window.GDF.data.LANDING_SLIDES;
    var slide = SLIDES[state.landingSlide] || SLIDES[0];
    var PROJECTS = window.GDF.data.PROJECTS;

    var totalProjects = PROJECTS.length;
    var visCount = PROJECTS.filter(function (p) { return p.vis; }).length;
    var miCasaYaCount = PROJECTS.filter(function (p) { return p.subsidy === 'Mi Casa Ya'; }).length;
    // La demo es solo de Bogotá: en vez de "cuántos hay en Cundinamarca" (que
    // ahora sería siempre 0), se muestra en cuántas localidades hay proyectos.
    var localidadesCount = (function () {
      var vistas = {};
      PROJECTS.forEach(function (p) {
        if (p.localidad) vistas[p.localidad] = true;
      });
      return Object.keys(vistas).length;
    })();

    function findProject(name) {
      for (var i = 0; i < PROJECTS.length; i++) {
        if (PROJECTS[i].name === name) return PROJECTS[i];
      }
      return null;
    }

    var dotsHtml = SLIDES.map(function (s, i) {
      return (
        '<button class="gdf-landing-dot' + (i === state.landingSlide ? ' active' : '') + '" ' +
        'data-action="setLandingSlide" data-value="' + i + '" aria-label="Slide ' + (i + 1) + '"></button>'
      );
    }).join('');

    var navHtml =
      '<nav class="gdf-landing-nav">' +
      '<div class="gdf-landing-nav-left">' +
      '<img class="gdf-hero-logo" src="assets/Logov2.png" alt="Colsubsidio" />' +
      '<div class="gdf-landing-nav-links"><span>Proyectos</span><span>Subsidios</span><span>Financiación</span><span>Ayuda</span></div>' +
      '</div>' +
      '<button class="gdf-landing-nav-cta" data-action="goSplash">Construir mi casa <span>→</span></button>' +
      '</nav>';

    var heroHtml =
      '<section class="gdf-landing-hero">' +
      '<div class="gdf-landing-hero-text">' +
      '<div class="eyebrow">VIVIENDA · NUEVOS PROYECTOS</div>' +
      '<h1>' + esc(slide.title) + '</h1>' +
      '<p>' + esc(slide.desc) + '</p>' +
      '<div class="gdf-landing-hero-actions">' +
      '<button class="gdf-landing-btn-primary" data-action="goSplash">Empezar ahora <span>→</span></button>' +
      '<a class="gdf-landing-btn-secondary" href="#gdf-proyectos">Ver proyectos</a>' +
      '</div>' +
      '<div class="gdf-landing-dots">' + dotsHtml + '</div>' +
      '</div>' +
      '<div class="gdf-landing-hero-image">' +
      '<div class="gdf-landing-hero-corner"></div>' +
      '<div class="gdf-landing-hero-photo"><img src="' + esc(slide.image) + '" alt="' + esc(slide.title) + '" /></div>' +
      '<div class="gdf-landing-stat-card">' +
      '<div class="stat"><div class="num">+' + totalProjects + '</div><div class="label">proyectos activos</div></div>' +
      '<div class="divider"></div>' +
      '<div class="stat"><div class="num">' + visCount + '</div><div class="label">con subsidio VIS</div></div>' +
      '</div>' +
      '</div>' +
      '</section>';

    var construirHtml =
      '<section class="gdf-landing-construir">' +
      '<div class="glow"></div>' +
      '<div class="accent-bar"></div>' +
      '<div class="gdf-landing-construir-grid">' +
      '<div>' +
      '<div class="gdf-landing-construir-pill">✎ Plan a tu medida</div>' +
      '<h2>Construye la casa de tus sueños aquí</h2>' +
      '<p>Entra a la experiencia y arma tu casa paso a paso: al final te mostramos los proyectos reales que más se parecen a ella.</p>' +
      '<button class="gdf-landing-btn-primary big" data-action="goSplash">Construir la casa de mis sueños <span>→</span></button>' +
      '</div>' +
      '<div class="gdf-landing-construir-visual">' +
      houseIllustration() +
      '</div>' +
      '</div>' +
      '</section>';

    function bentoCard(p, tall, ribbon) {
      var loc = p.muni + (p.zona ? ' · ' + p.zona : '');
      var bg = p.image
        ? "background:url('" + p.image + "') center/cover no-repeat, " + p.grad
        : 'background:' + p.grad;
      var ribbonHtml = ribbon
        ? '<div class="ribbon"><span class="dollar">$</span>' + esc(ribbon) + '</div>'
        : '';
      return (
        '<div class="gdf-landing-bento-card' + (tall ? ' tall' : '') + '">' +
        '<div class="img" style="' + bg + '">' + ribbonHtml + '</div>' +
        '<div class="body"><div class="name">' + esc(p.name) + '</div><div class="loc">📍 ' + esc(loc) + '</div></div>' +
        '</div>'
      );
    }

    function statTile(icon, num, label) {
      return (
        '<div class="gdf-landing-bento-stat">' +
        '<div class="icon">' + icon + '</div>' +
        '<div class="num">' + num + '</div>' +
        '<div class="label">' + esc(label) + '</div>' +
        '</div>'
      );
    }

    // Las dos tarjetas grandes muestran proyectos reales con foto (uno VIS,
    // uno no VIS); las 4 del medio son conteos reales calculados sobre
    // PROJECTS, no cifras inventadas.
    var tallLeft = findProject('Los Nogales') || PROJECTS[0];
    var tallRight = findProject('Agrupación De Vivienda Reserva De Guayacán') || PROJECTS[1];

    var bentoHtml =
      '<div class="gdf-landing-bento">' +
      bentoCard(tallLeft, true) +
      statTile('📍', totalProjects, 'proyectos en Bogotá') +
      statTile('🏷️', visCount, 'proyectos VIS') +
      statTile('💰', miCasaYaCount, 'con Mi Casa Ya') +
      statTile('🗺️', localidadesCount, 'localidades') +
      bentoCard(tallRight, true, 'Subsidio VIS') +
      '</div>';

    var projectsHtml =
      '<section id="gdf-proyectos" class="gdf-landing-projects">' +
      '<h2>Nuestros proyectos</h2>' +
      '<div class="gdf-landing-projects-intro">' +
      '<p>Encuentra el hogar perfecto para ti y tu familia en proyectos de vivienda en Bogotá y los principales municipios de Cundinamarca.</p>' +
      '<button class="gdf-landing-btn-secondary" data-action="goSplash">Conoce los proyectos <span>→</span></button>' +
      '</div>' +
      bentoHtml +
      '</section>';

    var finalCtaHtml =
      '<section class="gdf-landing-final-cta">' +
      '<div>' +
      '<div class="title">¿Listo para construirla?</div>' +
      '<div class="sub">Tu plan queda guardado y un asesor lo revisa contigo cuando tú quieras.</div>' +
      '</div>' +
      '<button class="gdf-landing-btn-primary" data-action="goSplash">Construir mi casa <span>→</span></button>' +
      '</section>';

    return (
      '<div class="gdf-screen gdf-landing">' +
      navHtml +
      '<div class="gdf-landing-scroll">' +
      heroHtml +
      construirHtml +
      projectsHtml +
      finalCtaHtml +
      '</div>' +
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
      state.telefono.trim() &&
      state.consent
    );

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
      '<input class="gdf-input" id="telefonoInput" inputmode="tel" placeholder="Ej: 300 123 4567" value="' + esc(state.telefono) + '" />' +
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

  function sceneBlock(state, derived) {
    var showCrane = state.screen === 'quiz';
    var isResult = state.screen === 'result';
    var genderObj = findGender(state.gender);

    var loteHtml = derived.showLote ? '<div class="gdf-lote"><span>Tu lote</span></div>' : '';

    var roomsHtml = '';
    if (derived.losaRevealed) {
      var roomsInner = derived.rooms
        .map(function (room) {
          var itemsHtml = room.items
            .map(function (it) {
              return '<div class="item" style="' + it.styleText + '"></div>';
            })
            .join('');
          return (
            '<div class="gdf-room' + (room.animated ? ' animated' : '') + '" style="' + room.styleText + '">' +
            itemsHtml +
            '<span class="label">' + room.label + '</span>' +
            '</div>'
          );
        })
        .join('');
      roomsHtml = '<div class="gdf-losa">' + roomsInner + '</div>';
    }

    var craneHtml = showCrane
      ? '<div class="gdf-crane-jib"><div class="counterweight"></div></div><div class="gdf-crane-hook-top"></div>'
      : '';

    var badgeHtml = isResult
      ? '<div class="gdf-badge-tipo"><span class="icon">🏠</span><span class="text">' + esc(derived.tipoBadge) + '</span></div>'
      : '';

    var avatarMarker = '<div class="gdf-avatar-marker">' + genderObj.emoji + '</div>';

    return '<div class="gdf-scene">' + loteHtml + roomsHtml + craneHtml + badgeHtml + avatarMarker + '</div>';
  }

  // La mayoría de preguntas son grillas de botones (q.options), pero 'edad'
  // (entero exacto, lo pide el contrato de leads), 'entorno_deseado'
  // (checklist desplegable) necesitan un input real en vez de opciones
  // fijas de un solo valor — ver 'answerQuizNumber'/'answerQuizText'/
  // 'answerQuizMultiselect' en main.js, que leen el input/checkboxes al
  // vuelo y despachan 'selectOption' con el valor armado.
  function quiz(state, derived) {
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
      var checkItems = q.options
        .map(function (o) {
          return (
            '<label class="gdf-multiselect-item">' +
            '<input type="checkbox" value="' + esc(o.v) + '" />' +
            '<span>' + esc(o.label) + '</span>' +
            '</label>'
          );
        })
        .join('');
      answerAreaHtml =
        '<div class="gdf-quiz-freeform">' +
        '<details class="gdf-multiselect-dropdown" id="quizMultiselect">' +
        '<summary>Elige las opciones que apliquen</summary>' +
        '<div class="gdf-multiselect-list">' + checkItems + '</div>' +
        '</details>' +
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
      sceneBlock(state, derived) +
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

  // Zonas comunes del proyecto ("Este proyecto cuenta con:" en la ficha real),
  // con su icono. Las que el usuario pidió en la pregunta de entorno se
  // resaltan y se ponen de primeras: es lo que hace que esa pregunta sirva
  // para algo visible, y no solo para el contrato del backend.
  function amenidadesHtml(amenidades, buscadas) {
    if (!amenidades || !amenidades.length) return '';
    var pedidas = buscadas || [];

    var conMarca = amenidades.map(function (a) {
      return { a: a, coincide: !!a.clave && pedidas.indexOf(a.clave) > -1 };
    });

    // Las coincidencias primero, el resto en su orden original.
    conMarca.sort(function (x, y) {
      return (y.coincide ? 1 : 0) - (x.coincide ? 1 : 0);
    });

    var items = conMarca
      .map(function (x) {
        var ico = x.a.icon
          ? '<img src="' + esc(x.a.icon) + '" alt="" loading="lazy" />'
          : '<span class="gdf-amenity-punto">•</span>';
        return (
          '<div class="gdf-amenity' + (x.coincide ? ' coincide' : '') + '">' +
          ico + '<span class="gdf-amenity-label">' + esc(x.a.label) + '</span>' +
          (x.coincide ? '<span class="gdf-amenity-check" aria-hidden="true">✓</span>' : '') +
          '</div>'
        );
      })
      .join('');

    return (
      '<div class="gdf-project-entorno">' +
      '<div class="gdf-entorno-titulo">Este proyecto cuenta con</div>' +
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
    var tags =
      '<span class="gdf-project-tag">Desde ' + esc(sim.millones(vm.precioCop)) + '</span>' +
      (vm.area ? '<span class="gdf-project-tag">' + vm.area + ' m²</span>' : '') +
      (habLabel ? '<span class="gdf-project-tag">' + habLabel + '</span>' : '') +
      (local.banos ? '<span class="gdf-project-tag">' + local.banos + (local.banos === 1 ? ' baño' : ' baños') + '</span>' : '');

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
      amenidadesHtml(vm.amenidades, state.answers.entorno_deseado) +
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
      areas +
      precioHtml +
      espaciosGrid(t) +
      simuladorBlock(vm, t, state) +
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

  function simuladorBlock(vm, t, state) {
    var sim = window.GDF.simulador;
    var precio = precioParaSimular(vm, t);
    if (!precio) return '';

    var cfg = state.simConfig[vm.id] || {};
    var inicial = cfg.inicial || sim.SUPUESTOS.cuotaInicialDefault;
    var plazo = cfg.plazo || sim.SUPUESTOS.plazoDefault;

    function segmento(campo, valores, actual, sufijo) {
      return valores
        .map(function (v) {
          return (
            '<button class="gdf-sim-opt' + (v === actual ? ' active' : '') + '"' +
            ' data-action="simSet" data-proyecto="' + esc(vm.id) + '"' +
            ' data-campo="' + campo + '" data-valor="' + v + '">' + v + sufijo + '</button>'
          );
        })
        .join('');
    }

    return (
      '<details class="gdf-sim" data-sim-proyecto="' + esc(vm.id) + '"' +
      (state.simAbierto[vm.id] ? ' open' : '') + '>' +
      '<summary><span class="gdf-sim-icon">💰</span>Simular plan de pagos</summary>' +
      '<div class="gdf-sim-body" data-precio="' + precio + '" data-vis="' + (vm.vis ? 1 : 0) + '"' +
      ' data-proyecto="' + esc(vm.id) + '">' +
      '<div class="gdf-sim-campo"><label>Cuota inicial</label>' +
      '<div class="gdf-sim-seg">' + segmento('inicial', sim.SUPUESTOS.cuotaInicialOpciones, inicial, '%') + '</div>' +
      '</div>' +
      '<div class="gdf-sim-campo"><label>Plazo del crédito</label>' +
      '<div class="gdf-sim-seg">' + segmento('plazo', sim.SUPUESTOS.plazoOpciones, plazo, ' años') + '</div>' +
      '</div>' +
      '<div class="gdf-sim-out">' + simuladorResultado(precio, vm.vis, inicial, plazo, state.answers.ingresos) + '</div>' +
      '<p class="gdf-sim-nota">Estimación con tasa ' +
      (vm.vis ? sim.SUPUESTOS.tasaEaVis * 100 : sim.SUPUESTOS.tasaEaNoVis * 100).toFixed(1).replace('.', ',') +
      '% E.A. y SMMLV ' + sim.SUPUESTOS.anioSmmlv + '. No es una cotización ni una aprobación de crédito.</p>' +
      '</div>' +
      '</details>'
    );
  }

  // Se genera aparte porque main.js la vuelve a llamar al mover los
  // controles, y reemplaza SOLO este pedazo por DOM directo (sin re-render
  // completo, que cerraría el desplegable y recargaría las imágenes).
  function simuladorResultado(precio, vis, inicial, plazo, rangoIngresos) {
    var sim = window.GDF.simulador;
    var r = sim.simular({
      precio: precio,
      vis: vis,
      rangoIngresos: rangoIngresos,
      porcentajeInicial: inicial,
      plazoAnios: plazo,
    });

    var filas =
      '<div class="gdf-sim-fila"><span>Valor de la vivienda</span><strong>' + sim.pesos(r.precio) + '</strong></div>' +
      '<div class="gdf-sim-fila"><span>Cuota inicial (' + r.porcentajeInicial + '%)</span><strong>' + sim.pesos(r.cuotaInicial) + '</strong></div>' +
      (r.subsidio
        ? '<div class="gdf-sim-fila subsidio"><span>Subsidio Mi Casa Ya</span><strong>−' + sim.pesos(r.subsidio) + '</strong></div>' +
          '<div class="gdf-sim-fila"><span>Ahorro que debes reunir</span><strong>' + sim.pesos(r.ahorroNecesario) + '</strong></div>'
        : '') +
      '<div class="gdf-sim-fila"><span>Monto a financiar</span><strong>' + sim.pesos(r.montoCredito) + '</strong></div>';

    var alerta = '';
    if (r.holgado === false) {
      alerta =
        '<div class="gdf-sim-alerta">⚠️ La cuota supera el 30% del ingreso típico de tu rango. ' +
        'Sube la cuota inicial, alarga el plazo o mira un proyecto de menor valor.</div>';
    } else if (r.holgado === true) {
      alerta = '<div class="gdf-sim-alerta ok">✅ La cuota cabe dentro del 30% del ingreso típico de tu rango.</div>';
    }

    return (
      '<div class="gdf-sim-cuota">' +
      '<span class="rotulo">Cuota mensual estimada</span>' +
      '<span class="valor">' + sim.pesos(r.cuotaMensual) + '</span>' +
      '<span class="detalle">a ' + r.plazoAnios + ' años</span>' +
      '</div>' +
      '<div class="gdf-sim-filas">' + filas + '</div>' +
      alerta
    );
  }

  function detalleProyecto(vm, state) {
    var local = vm.local || {};
    var tips = local.tipologias || [];
    var abierto = !!state.detalleAbierto[vm.id];
    var fichaHtml = local.url
      ? '<a class="gdf-project-ficha" href="' + esc(local.url) + '" target="_blank" rel="noopener">Ver ficha oficial en colsubsidio.com ↗</a>'
      : '';

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
        '<summary><span class="gdf-detalle-titulo">Simular plan de pagos</span>' +
        '<span class="gdf-detalle-chevron">▾</span></summary>' +
        '<div class="gdf-detalle-body">' +
        '<p class="gdf-detalle-vacio">' + motivo + '</p>' +
        simuladorBlock(vm, null, state) +
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
    var resumen = tips.length === 1 ? 'Ver plano y simular pagos' : 'Ver ' + tips.length + ' ' + grupo + ' y simular pagos';

    return (
      '<details class="gdf-project-detalle"' + (abierto ? ' open' : '') + ' data-action="noop" data-proyecto="' + esc(vm.id) + '">' +
      '<summary><span class="gdf-detalle-titulo">' + esc(resumen) + '</span>' +
      '<span class="gdf-detalle-chevron">▾</span></summary>' +
      '<div class="gdf-detalle-body">' +
      tabsHtml +
      panelesHtml +
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

    if (sinLead || envio.estado === 'enviado') {
      heroClase = 'gdf-confirm-hero--ok';
      heroIcono = '<span class="gdf-confirm-check">✓</span>';
      heroTitulo = '¡Gracias por tu interés, ' + esc(firstName) + '!';
      heroTexto = sinLead
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
    // landing y splash traen su propia nav (misma pieza visual, reutilizada);
    // el resto usa la header() compartida.
    var showHeader = state.screen !== 'splash' && state.screen !== 'landing';
    return '<div class="gdf-shell">' + (showHeader ? header() : '') + screenHtml + '</div>';
  }

  window.GDF = window.GDF || {};
  window.GDF.templates = {
    renderApp: renderApp,
    esc: esc,
    // main.js la usa para repintar SOLO el resultado del simulador cuando se
    // mueven sus controles, sin re-render de toda la pantalla.
    simuladorResultado: simuladorResultado,
  };
})();
