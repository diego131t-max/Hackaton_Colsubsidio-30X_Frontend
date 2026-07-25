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
    var derived = window.GDF.state.computeDerived(state);
    root.innerHTML = window.GDF.templates.renderApp(state, derived);
    if (sameScreen) {
      var screenEl = root.querySelector('.gdf-screen');
      if (screenEl) screenEl.style.animation = 'none';
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
    render();

    // El quiz termina y entra a 'result' exactamente una vez por partida
    // (desde selectOption, cuando ya se contestó la última pregunta). Ese es
    // el primer momento en que existen TODOS los campos requeridos por el
    // contrato de leads — dispara el POST real aquí, una sola vez.
    if (prevScreen !== 'result' && state.screen === 'result') {
      state.leadSubmit = { status: 'sending', leadId: null, error: null };
      render();
      window.GDF.leads.submitLead(state, function (result) {
        state.leadSubmit = result;
        render();
      });
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
