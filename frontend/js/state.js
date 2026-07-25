// Estado central + valores derivados + acciones. Equivalente vanilla del
// estado de hooks + "renderVals()" del prototipo React original.
(function () {
  'use strict';

  function createInitial() {
    return {
      screen: 'landing', // landing | splash | escarapela | quiz | result
      landingSlide: 0, // índice del carrusel de landing()
      // Sin pantalla de elegir personaje: 'x' (avatar neutro) por defecto.
      gender: 'x', // 'f' | 'm' | 'x'
      nombre: '',
      apellido: '',
      correo: '',
      telefono: '',
      afiliado: null,
      consent: false,
      qi: 0,
      answers: {},
      matches: [],
      lead: null, // resultado de computeLeadQualification
      chosen: null,
      // Estado del POST a nuestro backend de leads (contrato SenalBowl, ver
      // js/leads.js). Se dispara una sola vez al llegar a 'result'.
      leadSubmit: { status: 'idle', leadId: null, error: null },
    };
  }

  function qListFor(answers) {
    var QUESTIONS = window.GDF.data.QUESTIONS;
    return QUESTIONS.filter(function (q) {
      return q.cond !== 'bogota' || answers.ubicacion === 'Bogotá';
    });
  }

  function computeDerived(state) {
    var scene = window.GDF.scene;
    var qList = qListFor(state.answers);
    var q = qList[state.qi];

    var answeredQs = qList.filter(function (x) {
      return state.answers[x.id] !== undefined;
    });
    var answered = answeredQs.length;
    // 9 preguntas base (tipo, ingresos, personas, edad, ubicacion,
    // habitaciones, tipo_inmueble, piso_preferido, entorno_deseado) + zona
    // solo si eligió Bogotá.
    var stepTotal = 9 + (state.answers.ubicacion === 'Bogotá' ? 1 : 0);

    var revealedIds = [];
    answeredQs.forEach(function (x) {
      scene.revealIds(x.id, state.answers).forEach(function (id) {
        revealedIds.push(id);
      });
    });
    if (state.screen === 'result') {
      if (revealedIds.indexOf('estudio') === -1) revealedIds.push('hall');
      if (revealedIds.indexOf('hab2') === -1) revealedIds.push('deposito');
    }

    var nHab = state.answers.habitaciones === '3+' ? 3 : parseInt(state.answers.habitaciones || '2', 10);
    var nPers = state.answers.personas === '4+' ? 4 : parseInt(state.answers.personas || '0', 10);
    var compat = Math.min(97, Math.round(42 + (answered / stepTotal) * 55));

    var showLote = revealedIds.indexOf('losa') === -1;
    var losaRevealed = revealedIds.indexOf('losa') > -1;
    var rooms = scene.buildRooms(revealedIds, true);
    var tipoBadge = 'Tipo ' + nHab + 'A · ' + (38 + nHab * 13 + nPers * 2) + ' m²';

    var a = state.answers;
    var perfilChips = [];
    if (a.tipo) perfilChips.push({ text: a.tipo, hi: true });
    if (a.ingresos) perfilChips.push({ text: a.ingresos, hi: false });
    if (a.habitaciones) perfilChips.push({ text: a.habitaciones + ' hab', hi: false });
    if (a.ubicacion) perfilChips.push({ text: a.ubicacion + (a.zona ? ' · ' + a.zona : ''), hi: false });
    if (a.afiliado === 'Sí') perfilChips.push({ text: 'Afiliado ✓', hi: true });

    return {
      qList: qList,
      q: q,
      answered: answered,
      stepTotal: stepTotal,
      revealedIds: revealedIds,
      showLote: showLote,
      losaRevealed: losaRevealed,
      rooms: rooms,
      nHab: nHab,
      nPers: nPers,
      compat: compat,
      tipoBadge: tipoBadge,
      perfilChips: perfilChips,
    };
  }

  function applyAction(state, action, ds) {
    switch (action) {
      case 'goSplash':
        state.screen = 'splash';
        break;

      case 'goLanding':
        state.screen = 'landing';
        break;

      case 'goEscarapela':
        state.screen = 'escarapela';
        break;

      case 'setLandingSlide':
        state.landingSlide = parseInt(ds.value, 10) || 0;
        break;

      case 'nextLandingSlide': {
        var n = window.GDF.data.LANDING_SLIDES.length;
        state.landingSlide = (state.landingSlide + 1) % n;
        break;
      }

      case 'setAfiliado':
        state.afiliado = ds.value;
        break;

      case 'toggleConsent':
        state.consent = !state.consent;
        break;

      case 'startQuiz': {
        var isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.correo.trim());
        var canStart = !!(
          state.nombre.trim() &&
          state.apellido.trim() &&
          state.correo.trim() &&
          isValidEmail &&
          state.telefono.trim() &&
          state.consent
        );
        if (!canStart) return false;
        state.answers = { afiliado: state.afiliado };
        state.qi = 0;
        state.screen = 'quiz';
        break;
      }

      case 'selectOption': {
        var qid = ds.qid;
        var value = ds.value;
        var nextAnswers = Object.assign({}, state.answers);
        nextAnswers[qid] = value;
        var list = qListFor(nextAnswers);
        var ni = state.qi + 1;
        state.answers = nextAnswers;
        if (ni >= list.length) {
          state.screen = 'result';
          var matches = window.GDF.matching.computeMatches(nextAnswers);
          state.matches = matches;
          state.lead = window.GDF.qualification.computeLeadQualification(
            nextAnswers,
            matches[0] ? matches[0].score : 0
          );
        } else {
          state.qi = ni;
        }
        break;
      }

      case 'goBack': {
        // En la primera pregunta no hay a dónde retroceder dentro del quiz:
        // regresa a escarapela (el paso anterior en el flujo completo).
        if (state.qi === 0) {
          state.screen = 'escarapela';
          break;
        }
        var qList = qListFor(state.answers);
        var prev = qList[state.qi - 1];
        var nextAnswers2 = Object.assign({}, state.answers);
        delete nextAnswers2[prev.id];
        state.qi = state.qi - 1;
        state.answers = nextAnswers2;
        break;
      }

      case 'chooseProject':
        state.chosen = ds.value;
        break;

      case 'restart': {
        var fresh = createInitial();
        Object.keys(fresh).forEach(function (k) {
          state[k] = fresh[k];
        });
        // "Empezar de nuevo" desde el resultado vuelve al intro del juego,
        // no hasta el home corporativo — el usuario ya cruzó esa puerta.
        state.screen = 'splash';
        break;
      }

      default:
        return false;
    }
    return true;
  }

  window.GDF = window.GDF || {};
  window.GDF.state = {
    createInitial: createInitial,
    computeDerived: computeDerived,
    applyAction: applyAction,
  };
})();
