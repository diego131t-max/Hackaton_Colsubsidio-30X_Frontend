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
    var bogotaCount = PROJECTS.filter(function (p) { return p.muni === 'Bogotá'; }).length;
    var visCount = PROJECTS.filter(function (p) { return p.vis; }).length;
    var miCasaYaCount = PROJECTS.filter(function (p) { return p.subsidy === 'Mi Casa Ya'; }).length;
    var cundinamarcaCount = totalProjects - bogotaCount;

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
      statTile('📍', bogotaCount, 'proyectos en Bogotá') +
      statTile('🏷️', visCount, 'proyectos VIS') +
      statTile('💰', miCasaYaCount, 'con Mi Casa Ya') +
      statTile('🌄', cundinamarcaCount, 'en Cundinamarca') +
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
  // (entero exacto, lo pide el contrato de leads) y 'entorno_deseado' (texto
  // libre) necesitan un input real en vez de opciones fijas — ver
  // 'answerQuizNumber'/'answerQuizText' en main.js, que leen el input al
  // vuelo y despachan 'selectOption' con el valor tipeado.
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

    var projectsHtml = state.matches
      .map(function (p) {
        var chosen = state.chosen === p.name;
        var ctaLabel = chosen ? '✓ ¡Listo! Vamos a contactarte' : 'Me interesa este';
        var confirmHtml = chosen
          ? '<p class="gdf-project-confirm">Guardamos tu perfil y este proyecto. Un asesor de vivienda te escribe al <strong>' + esc(state.telefono) + '</strong>.</p>'
          : '';
        var locLabel = p.muni + (p.zona ? ' · ' + p.zona : '');
        var habLabel = p.hab + (p.hab >= 3 ? '+ hab' : ' hab');
        var visTagClass = p.vis ? 'vis' : 'novis';
        // Con foto/plano real (20 de 26 proyectos) la imagen manda y se
        // quita el emoji decorativo; sin imagen, cae al gradiente + emoji
        // de siempre. Ver docs/proyectos-imagenes.md.
        var headerStyle = p.image
          ? "background:url('" + p.image + "') center/cover no-repeat, " + p.grad
          : 'background:' + p.grad;
        var emojiHtml = p.image ? '' : '<span class="emoji">' + p.emoji + '</span>';
        // Amenidades reales (20 de 26 proyectos, ver docs/proyectos-amenidades.md).
        // Sin dato → sin fila, no se inventa nada para los otros 6.
        var amenitiesHtml =
          p.amenities && p.amenities.length
            ? '<div class="gdf-project-amenities">' +
              p.amenities
                .map(function (key) {
                  var a = window.GDF.data.AMENITIES[key];
                  return '<div class="gdf-amenity">' + a.icon + '<span>' + esc(a.label) + '</span></div>';
                })
                .join('') +
              '</div>'
            : '';

        return (
          '<div class="gdf-project-card' + (chosen ? ' chosen' : '') + '">' +
          '<div class="gdf-project-header" style="' + headerStyle + '">' +
          emojiHtml +
          '<span class="gdf-project-badge">' + p.score + '% match</span>' +
          '</div>' +
          '<div class="gdf-project-body">' +
          '<div class="gdf-project-name">' + esc(p.name) + '</div>' +
          '<div class="gdf-project-loc">📍 ' + esc(locLabel) + '</div>' +
          '<div class="gdf-project-tags">' +
          '<span class="gdf-project-tag">Desde $' + p.price + 'M</span>' +
          '<span class="gdf-project-tag">' + p.area + ' m²</span>' +
          '<span class="gdf-project-tag">' + habLabel + '</span>' +
          '<span class="gdf-project-tag ' + visTagClass + '">' + esc(p.subsidy) + '</span>' +
          '</div>' +
          amenitiesHtml +
          '<button class="gdf-project-cta' + (chosen ? ' chosen' : '') + '" data-action="chooseProject" data-value="' + esc(p.name) + '">' + ctaLabel + '</button>' +
          confirmHtml +
          '</div>' +
          '</div>'
        );
      })
      .join('');

    var firstName = state.nombre.trim().split(' ')[0] || 'constructor';

    // Estado del POST real a nuestro backend de leads (contrato SenalBowl,
    // ver js/leads.js) — disparado una sola vez al entrar a result() desde
    // main.js/dispatch(). No bloquea nada de lo anterior (fire-and-forget).
    var submit = state.leadSubmit || { status: 'idle' };
    var submitHtml = '';
    if (submit.status === 'sending') {
      submitHtml = '<p class="gdf-lead-submit sending">Enviando tu información a Colsubsidio…</p>';
    } else if (submit.status === 'sent') {
      submitHtml = '<p class="gdf-lead-submit sent">✓ Recibido — tu asesor ya puede verlo.</p>';
    } else if (submit.status === 'error') {
      submitHtml = '<p class="gdf-lead-submit error">No pudimos enviar tu información automáticamente, pero tu carné queda guardado — un asesor te contacta igual.</p>';
    }

    return (
      sceneBlock(state, derived) +
      '<div class="gdf-screen gdf-result">' +
      '<div class="gdf-result-head"><div class="eyebrow">¡TU PLANO ESTÁ LISTO! ✦</div><h2>Tenemos tu hogar,<br>' + esc(firstName) + '</h2></div>' +
      leadBadgeHtml +
      submitHtml +
      '<div class="gdf-chips">' + chipsHtml + '</div>' +
      '<p class="gdf-match-count">' + state.matches.length + ' proyectos coinciden con tu perfil</p>' +
      '<div class="gdf-projects">' + projectsHtml + '</div>' +
      '<button class="gdf-restart-btn" data-action="restart">↺ Empezar de nuevo</button>' +
      '<p class="gdf-disclaimer">Proyectos ilustrativos para demostración. En producción se conectan al catálogo real de vivienda de Colsubsidio y el botón abre WhatsApp con el lead prellenado para el asesor.</p>' +
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
  };
})();
