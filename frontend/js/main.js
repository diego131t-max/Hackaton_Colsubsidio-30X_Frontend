// Bootstrap: estado vivo, listener delegado único y el ciclo de render.
(function () {
  'use strict';

  var state = window.GDF.state.createInitial();
  var root = null;
  var landingTimer = null;
  // Pantalla mostrada en el último render, para distinguir "entré a una
  // pantalla nueva" de "seguimos en la misma pantalla pero cambió algo"
  // (afiliado, consent, proyecto elegido, pregunta del quiz...). Cada
  // render() reconstruye TODO el innerHTML, así que sin este chequeo la
  // animación de entrada .gdf-screen (screenIn) se repetiría en cada click
  // dentro de la misma pantalla — un flash visible cada vez que tocas un
  // botón. Las animaciones internas (cuartos cayendo, progreso, chips) no
  // dependen de esto y siguen disparándose siempre, como debe ser.
  var lastScreen = null;

  function render() {
    var sameScreen = state.screen === lastScreen;
    // Reconstruir TODO el innerHTML también destruye y recrea el nodo que
    // tenía el scroll (p. ej. .gdf-escarapela, que scrollea internamente), así
    // que sin esto cada click en "afiliado" o en el check de consentimiento
    // volvía el scroll a 0 — se sentía como si la página se recargara.
    // Restauramos tanto el scroll interno del propio .gdf-screen como el de
    // la página, para pantallas que scrollean como página normal.
    var prevScrollTop = 0;
    var prevWindowScroll = 0;
    if (sameScreen) {
      var prevScreenEl = root.querySelector('.gdf-screen');
      prevScrollTop = prevScreenEl ? prevScreenEl.scrollTop : 0;
      prevWindowScroll = window.scrollY;
    }
    var derived = window.GDF.state.computeDerived(state);
    root.innerHTML = window.GDF.templates.renderApp(state, derived);
    if (sameScreen) {
      var screenEl = root.querySelector('.gdf-screen');
      if (screenEl) {
        screenEl.style.animation = 'none';
        screenEl.scrollTop = prevScrollTop;
      }
      window.scrollTo(0, prevWindowScroll);
      // Las tarjetas de proyecto entran con floatUp escalonado (hasta 0.44s
      // de delay). Eso está bien la primera vez que se ve la lista, pero al
      // marcar un proyecto se reconstruye el innerHTML y las 6 volvían a
      // animarse: un parpadeo completo de la lista en cada clic.
      var cards = root.querySelectorAll('.gdf-project-card');
      for (var c = 0; c < cards.length; c++) cards[c].style.animation = 'none';
    }
    lastScreen = state.screen;
    attachInputListeners();
    syncLandingAutoplay();
  }

  // El carrusel de landing() avanza solo mientras esa pantalla está activa;
  // se apaga al salir para no seguir despachando acciones en el fondo.
  function syncLandingAutoplay() {
    var shouldRun = state.screen === 'landing';
    if (shouldRun && !landingTimer) {
      landingTimer = setInterval(function () {
        dispatch('nextLandingSlide');
      }, 5000);
    } else if (!shouldRun && landingTimer) {
      clearInterval(landingTimer);
      landingTimer = null;
    }
  }

  // Los inputs de nombre/apellido/correo/teléfono son "no controlados":
  // reconstruir todo el innerHTML en cada tecla perdería el foco y el
  // cursor. En vez de eso, actualizamos el preview del carné directamente
  // por DOM y solo comprometemos el valor a `state` (ya lo hace este mismo
  // listener). También engancha los inputs de preguntas "libres" del quiz
  // (edad numérica, entorno de texto) — ver 'answerQuizNumber'/
  // 'answerQuizText' en onRootClick.
  function attachInputListeners() {
    var nombreInput = document.getElementById('nombreInput');
    var apellidoInput = document.getElementById('apellidoInput');
    var correoInput = document.getElementById('correoInput');
    var telefonoInput = document.getElementById('telefonoInput');

    function refreshCarnetName() {
      var nameEl = document.getElementById('carnetName');
      if (!nameEl) return;
      var fullName = (state.nombre.trim() + ' ' + state.apellido.trim()).trim();
      nameEl.textContent = fullName || 'Tu nombre';
    }

    if (nombreInput) {
      nombreInput.addEventListener('input', function (e) {
        state.nombre = e.target.value;
        refreshCarnetName();
        updateStartButton();
      });
    }
    if (apellidoInput) {
      apellidoInput.addEventListener('input', function (e) {
        state.apellido = e.target.value;
        refreshCarnetName();
        updateStartButton();
      });
    }
    if (correoInput) {
      correoInput.addEventListener('input', function (e) {
        state.correo = e.target.value;
        updateStartButton();
      });
    }
    if (telefonoInput) {
      telefonoInput.addEventListener('input', function (e) {
        state.telefono = e.target.value;
        var phoneEl = document.getElementById('carnetPhone');
        if (phoneEl) phoneEl.textContent = e.target.value.trim() || 'Tu teléfono';
        updateStartButton();
      });
    }

    var quizNumberInput = document.getElementById('quizNumberInput');
    if (quizNumberInput) {
      quizNumberInput.addEventListener('input', updateQuizNumberButton);
      quizNumberInput.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        var btn = document.querySelector('[data-action="answerQuizNumber"]');
        if (btn && btn.classList.contains('enabled')) btn.click();
      });
    }

    // Los <details> se abren/cierran solos (comportamiento nativo, sin JS ni
    // re-render). Lo único que hace falta es ANOTAR si quedaron abiertos,
    // para que un re-render posterior — marcar el proyecto, por ejemplo — los
    // vuelva a pintar como estaban. No se despacha por el listener delegado
    // porque 'toggle' no es un clic.
    //
    // Además funcionan como ACORDEÓN: abrir el plano de un proyecto cierra el
    // del anterior. Con seis desplegables abiertos a la vez (cada uno con sus
    // planos y su simulador) la lista se volvía kilométrica y se perdía la
    // referencia de qué se estaba comparando. Cerrar el otro dispara su propio
    // 'toggle', así que `detalleAbierto` queda al día sin tocarlo aquí.
    var detalles = root.querySelectorAll('.gdf-project-detalle');
    for (var d = 0; d < detalles.length; d++) {
      (function (el) {
        el.addEventListener('toggle', function () {
          state.detalleAbierto[el.dataset.proyecto] = el.open;
          if (!el.open) return;
          for (var o = 0; o < detalles.length; o++) {
            if (detalles[o] !== el && detalles[o].open) detalles[o].open = false;
          }
        });
      })(detalles[d]);
    }
    var sims = root.querySelectorAll('.gdf-sim[data-sim-proyecto]');
    for (var s = 0; s < sims.length; s++) {
      (function (el) {
        el.addEventListener('toggle', function () {
          state.simAbierto[el.dataset.simProyecto] = el.open;
        });
      })(sims[s]);
    }

    var quizTextInput = document.getElementById('quizTextInput');
    if (quizTextInput) {
      quizTextInput.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        var btn = document.querySelector('[data-action="answerQuizText"]');
        if (btn) btn.click();
      });
    }
  }

  function updateStartButton() {
    var btn = document.querySelector('.gdf-btn-primary');
    if (!btn) return;
    var isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.correo.trim());
    var canStart = !!(
      state.nombre.trim() &&
      state.apellido.trim() &&
      state.correo.trim() &&
      isValidEmail &&
      state.telefono.trim() &&
      state.consent
    );
    btn.classList.toggle('enabled', canStart);
  }

  // El botón de la pregunta numérica del quiz (edad) empieza deshabilitado
  // (ver quiz() en templates.js) hasta que el valor tipeado esté dentro de
  // min/max — mismo patrón visual que el botón de escarapela.
  function updateQuizNumberButton() {
    var input = document.getElementById('quizNumberInput');
    var btn = document.querySelector('[data-action="answerQuizNumber"]');
    if (!input || !btn) return;
    var n = Number(input.value);
    var min = input.min !== '' ? Number(input.min) : -Infinity;
    var max = input.max !== '' ? Number(input.max) : Infinity;
    var valid = input.value !== '' && !isNaN(n) && n >= min && n <= max;
    btn.classList.toggle('enabled', valid);
  }

  // El tick del carrusel de landing() dispara cada 5s mientras esa pantalla
  // está activa. Si pasara por render(), reconstruiría TODO el innerHTML de
  // la pantalla (nav, hero, banner azul, bento, banner final) y con eso
  // volverían a dispararse todas las animaciones de entrada (screenIn,
  // heroFadeIn, etc.) — un flash visible cada 5 segundos. En vez de eso,
  // igual que con los inputs no controlados, parcheamos por DOM directo
  // solo la foto/texto/dots del carrusel.
  function dispatch(action, dataset) {
    var prevScreen = state.screen;
    var changed = window.GDF.state.applyAction(state, action, dataset);
    if (!changed) return;
    if (action === 'nextLandingSlide' || action === 'setLandingSlide') {
      updateLandingSlideDOM();
      return;
    }
    // Mismo criterio que el carrusel: son cambios DENTRO de una tarjeta ya
    // pintada. Un render() completo cerraría el <details> abierto y volvería
    // a crear los <img> de los planos (parpadeo). Se parchea el DOM y listo.
    if (action === 'verTipologia') {
      updateTipologiaDOM(dataset);
      return;
    }
    if (action === 'simSet') {
      updateSimuladorDOM(dataset);
      return;
    }
    if (action === 'setDetalleAbierto') return; // el <details> ya se pintó solo
    render();

    // PASO 1 del contrato. El quiz termina y entra a 'result' exactamente una
    // vez por partida (desde selectOption, al contestar la última pregunta):
    // ese es el primer momento en que existen TODOS los campos requeridos.
    if (prevScreen !== 'result' && state.screen === 'result') {
      cargarRecomendaciones();
    }

    // PASO 2 del contrato. Ya no hace falta un botón de "Confirmar": elegir el
    // proyecto y tocar "Continuar" (goConfirmacion) ES la confirmación, así
    // que el POST /leads se dispara solo al entrar a esta pantalla — misma
    // idea que el paso 1 con 'result'. La pantalla solo relata en qué estado
    // va (ver confirmacion() en templates.js).
    if (prevScreen !== 'confirmacion' && state.screen === 'confirmacion') {
      confirmarProyecto();
    }
  }

  // POST /recomendaciones. Se usa igual en la primera carga y al reintentar.
  function cargarRecomendaciones() {
    window.GDF.state.applyAction(state, 'recoCargando', {});
    render();
    window.GDF.recommender.recomendar(state, function (resultado) {
      window.GDF.state.applyAction(state, 'recoResuelta', resultado);
      render();
    });
  }

  // Salida de emergencia cuando el backend no responde: se muestran los
  // proyectos del catálogo local marcados como aproximados. Nunca se hace en
  // silencio — `aproximado: true` pinta un aviso permanente en la lista.
  function usarLocalAproximado() {
    window.GDF.recommender.recomendarLocal(state.answers, function (resultado) {
      window.GDF.state.applyAction(state, 'recoResuelta', resultado);
      render();
    });
  }

  // PASO 2 del contrato: confirmar el proyecto elegido.
  function confirmarProyecto() {
    if (!state.chosen) return;
    window.GDF.state.applyAction(state, 'envioEstado', { estado: 'enviando' });
    render();
    window.GDF.leads.enviarProyectoElegido(state, state.reco.leadId, state.chosen, function (r) {
      window.GDF.state.applyAction(state, 'envioEstado', r);
      render();
    });
  }

  // Busca la tarjeta del proyecto por nombre. Se usa el nombre y no el índice
  // porque el orden de la lista puede cambiar (clustering).
  function cardDe(nombreProyecto) {
    var cards = root.querySelectorAll('.gdf-project-detalle');
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].dataset.proyecto === nombreProyecto) return cards[i];
    }
    return null;
  }

  // Cambio de pestaña Tipo A / Tipo B: solo mueve la clase .active entre los
  // botones y entre los paneles de ESA tarjeta.
  function updateTipologiaDOM(ds) {
    var card = cardDe(ds.proyecto);
    if (!card) return;
    var idx = String(parseInt(ds.idx, 10) || 0);

    var tabs = card.querySelectorAll('.gdf-tipo-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].dataset.idx === idx);
    }
    var panels = card.querySelectorAll('.gdf-tipo-panel');
    for (var j = 0; j < panels.length; j++) {
      panels[j].classList.toggle('active', panels[j].dataset.panel === idx);
    }
  }

  // Recalcula la cuota al mover "cuota inicial" o "plazo". Repinta solo el
  // bloque de resultado; los controles se actualizan moviendo .active.
  function updateSimuladorDOM(ds) {
    var card = cardDe(ds.proyecto);
    if (!card) return;
    // Puede haber un simulador por tipología: se actualiza el del panel
    // visible (o el único que exista, en proyectos sin tipologías).
    var body =
      card.querySelector('.gdf-tipo-panel.active .gdf-sim-body') ||
      card.querySelector('.gdf-sim-body');
    if (!body) return;

    var cfg = state.simConfig[ds.proyecto] || {};
    var S = window.GDF.simulador.SUPUESTOS;
    var inicial = cfg.inicial || S.cuotaInicialDefault;
    var plazo = cfg.plazo || S.plazoDefault;

    var botones = body.querySelectorAll('.gdf-sim-opt');
    for (var i = 0; i < botones.length; i++) {
      var b = botones[i];
      var esperado = b.dataset.campo === 'inicial' ? inicial : plazo;
      b.classList.toggle('active', Number(b.dataset.valor) === esperado);
    }

    var out = body.querySelector('.gdf-sim-out');
    if (out) {
      out.innerHTML = window.GDF.templates.simuladorResultado(
        Number(body.dataset.precio),
        body.dataset.vis === '1',
        inicial,
        plazo,
        state.answers.ingresos
      );
    }
  }

  function updateLandingSlideDOM() {
    var SLIDES = window.GDF.data.LANDING_SLIDES;
    var slide = SLIDES[state.landingSlide] || SLIDES[0];

    var img = document.querySelector('.gdf-landing-hero-photo img');
    if (img) {
      img.src = slide.image;
      img.alt = slide.title;
    }
    var h1 = document.querySelector('.gdf-landing-hero-text h1');
    if (h1) h1.textContent = slide.title;
    var p = document.querySelector('.gdf-landing-hero-text p');
    if (p) p.textContent = slide.desc;

    var dots = document.querySelectorAll('.gdf-landing-dot');
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('active', i === state.landingSlide);
    }
  }

  function findQuestionById(qid) {
    var QUESTIONS = window.GDF.data.QUESTIONS;
    for (var i = 0; i < QUESTIONS.length; i++) {
      if (QUESTIONS[i].id === qid) return QUESTIONS[i];
    }
    return null;
  }

  function onRootClick(e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;

    // Acciones que hacen I/O: no pasan por applyAction/dispatch porque no son
    // un cambio de estado puro, sino el disparo de una llamada de red.
    if (el.dataset.action === 'reintentarReco') {
      cargarRecomendaciones();
      return;
    }
    if (el.dataset.action === 'usarLocalAproximado') {
      usarLocalAproximado();
      return;
    }
    if (el.dataset.action === 'confirmarProyecto') {
      confirmarProyecto();
      return;
    }

    // Las preguntas 'number'/'text' del quiz no tienen data-value estático
    // (dependen de lo que el usuario tipeó): se lee el input al vuelo y se
    // reusa 'selectOption', que ya sabe avanzar/calificar sin cambios.
    if (el.dataset.action === 'answerQuizNumber') {
      var numInput = document.getElementById('quizNumberInput');
      var q = findQuestionById(el.dataset.qid);
      var n = numInput ? Number(numInput.value) : NaN;
      var valid = numInput && numInput.value !== '' && !isNaN(n) && (!q || (n >= q.min && n <= q.max));
      if (!valid) return;
      dispatch('selectOption', { qid: el.dataset.qid, value: String(Math.round(n)) });
      return;
    }
    if (el.dataset.action === 'answerQuizText') {
      var txtInput = document.getElementById('quizTextInput');
      dispatch('selectOption', { qid: el.dataset.qid, value: txtInput ? txtInput.value.trim() : '' });
      return;
    }
    // 'entorno_deseado' es un checklist de casillas (no controladas, igual que
    // los inputs de texto) dentro de un <details> desplegable. Al continuar se
    // leen las marcadas y se guarda un ARRAY con sus `value`, que son las
    // etiquetas exactas que espera el backend (ver data.js). No se aplana a
    // texto ni se traduce al `label`: el contrato pide el array tal cual.
    if (el.dataset.action === 'answerQuizMultiselect') {
      var checked = document.querySelectorAll('#quizMultiselect input[type="checkbox"]:checked');
      var valores = Array.prototype.map.call(checked, function (input) {
        return input.value;
      });
      dispatch('selectOption', { qid: el.dataset.qid, value: valores });
      return;
    }

    dispatch(el.dataset.action, el.dataset);
  }

  function boot() {
    root = document.getElementById('root');
    root.addEventListener('click', onRootClick);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
