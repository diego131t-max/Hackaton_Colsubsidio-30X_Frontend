// Estado central + valores derivados + acciones. Equivalente vanilla del
// estado de hooks + "renderVals()" del prototipo React original.
(function () {
  'use strict';

  function createInitial() {
    return {
      // landing | splash | escarapela | quiz | result | confirmacion
      // 'result' es la pantalla de SELECCIÓN de proyectos (ya sin la casa) y
      // 'confirmacion' es el cierre. Se conserva el nombre 'result' para no
      // renombrar acciones/CSS que ya funcionan.
      screen: 'landing',
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
      // Selección ÚNICA: guarda el `id` del view-model elegido (id_proyecto si
      // vino del backend). El contrato manda un solo `proyecto_elegido`, así
      // que marcar uno desmarca el anterior.
      chosen: null,

      // Paso 1 del contrato: POST /recomendaciones. Ver js/leads.js.
      // 'vacio' NO es un error: el backend respondió bien y no tiene proyectos
      // para esa zona; la pantalla lo dice distinto que un fallo de red.
      reco: {
        estado: 'idle', // idle | cargando | listo | vacio | error
        leadId: null,
        items: [],
        totalCatalogo: null,
        origenCatalogo: null,
        error: null,
        aproximado: false, // true = las tarjetas salen del motor local
      },

      // Paso 2 del contrato: POST /leads?lead_id=… con proyecto_elegido.
      envio: { estado: 'idle', error: null }, // idle | enviando | enviado | error

      // --- Desplegable de planos de cada tarjeta (ver detalleProyecto en
      // templates.js). Vive en el estado, y no solo en el DOM, porque marcar
      // un proyecto sí re-renderiza toda la lista: sin esto el desplegable se
      // cerraría y se perdería la tipología que el usuario estaba viendo.
      // Todos van indexados por NOMBRE de proyecto (no por posición, que
      // cambia si el clustering reordena la lista).
      detalleAbierto: {}, // nombre -> bool
      simAbierto: {}, // nombre -> bool (el simulador dentro del desplegable)
      tipologiaActiva: {}, // nombre -> índice de la pestaña
      simConfig: {}, // nombre -> { inicial: %, plazo: años }
    };
  }

  // Ya no hay preguntas condicionales: al ser la demo solo de Bogotá se quitó
  // la de municipio, y con ella el "pregunta la zona solo si eligió Bogotá".
  // La función se conserva porque el resto del flujo (avance, atrás, contador)
  // razona sobre esta lista.
  function qListFor() {
    return window.GDF.data.QUESTIONS;
  }

  function computeDerived(state) {
    var scene = window.GDF.scene;
    var qList = qListFor(state.answers);
    var q = qList[state.qi];

    var answeredQs = qList.filter(function (x) {
      return state.answers[x.id] !== undefined;
    });
    var answered = answeredQs.length;
    // Ya no es un número fijo con excepciones: todas las preguntas se hacen
    // siempre (tipo, ingresos, personas, edad, zona/localidad, habitaciones,
    // piso_preferido, entorno_deseado), así que el total es la lista misma.
    var stepTotal = qList.length;

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
    if (a.zona) perfilChips.push({ text: a.zona, hi: false });
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
          // Terminó el quiz -> pantalla de selección de proyectos, en estado
          // 'cargando'. Las recomendaciones ya NO se calculan aquí: las pide
          // main.js al backend (paso 1 del contrato). Ver js/recommender.js.
          state.screen = 'result';
          state.reco = {
            estado: 'cargando', leadId: null, items: [], totalCatalogo: null,
            origenCatalogo: null, error: null, aproximado: false,
          };
          state.chosen = null;
          // La calificación del lead SÍ se calcula ya: es lógica de negocio y
          // no debe depender de una llamada de red. Se apoya en el motor local
          // solo para saber qué tan bien calza el mejor proyecto disponible.
          var mejores = window.GDF.matching.computeMatches(nextAnswers, 1);
          state.lead = window.GDF.qualification.computeLeadQualification(
            nextAnswers,
            mejores[0] ? mejores[0].score : 0
          );
        } else {
          state.qi = ni;
        }
        break;
      }

      // Resultado del paso 1 (POST /recomendaciones). Lo despacha main.js
      // cuando resuelve la promesa; `ds` ES el objeto que arma recommender.js.
      case 'recoResuelta':
        state.reco = {
          estado: ds.estado,
          leadId: ds.leadId || null,
          items: ds.items || [],
          totalCatalogo: ds.totalCatalogo || null,
          origenCatalogo: ds.origenCatalogo || null,
          error: ds.error || null,
          aproximado: !!ds.aproximado,
        };
        // Si la lista cambió, la selección anterior puede ya no existir.
        if (state.chosen && !state.reco.items.some(function (x) { return x.id === state.chosen; })) {
          state.chosen = null;
        }
        break;

      case 'recoCargando':
        state.reco.estado = 'cargando';
        state.reco.error = null;
        break;

      case 'envioEstado':
        state.envio = { estado: ds.estado, error: ds.error || null };
        break;

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

      // Selección ÚNICA: el contrato manda un solo `proyecto_elegido`, así que
      // elegir otro reemplaza al anterior. Volver a tocar el ya elegido lo
      // desmarca, para poder deshacer sin reiniciar.
      case 'chooseProject':
        state.chosen = state.chosen === ds.value ? null : ds.value;
        break;

      // Las 3 acciones del desplegable de planos solo guardan la preferencia:
      // el repintado lo hace main.js por DOM directo (ver dispatch), porque
      // re-renderizar aquí cerraría el <details> y recargaría los planos.
      case 'setDetalleAbierto':
        state.detalleAbierto[ds.proyecto] = ds.valor === '1';
        break;

      case 'verTipologia':
        state.tipologiaActiva[ds.proyecto] = parseInt(ds.idx, 10) || 0;
        break;

      case 'simSet': {
        var cfg = state.simConfig[ds.proyecto] || {};
        cfg[ds.campo] = parseInt(ds.valor, 10);
        state.simConfig[ds.proyecto] = cfg;
        break;
      }

      case 'goConfirmacion':
        // Sin nada marcado no tiene sentido cerrar: el botón está deshabilitado
        // en la UI, pero se valida igual acá por si acaso.
        if (!state.chosen) return false;
        state.screen = 'confirmacion';
        state.envio = { estado: 'idle', error: null };
        break;

      case 'goSeleccion':
        state.screen = 'result';
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
