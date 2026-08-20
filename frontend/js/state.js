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
      // La portada clona la página real de Colsubsidio, que tiene CUATRO
      // carruseles independientes; cada clave guarda su página actual. El
      // número de páginas lo decide templates.js (PORTADA_CARRUSELES), que es
      // quien sabe cuántas tarjetas entran a la vez.
      portadaSlides: { propios: 0, ciudades: 0, aliados: 0, opciones: 0 },
      portadaFooterTab: 0, // pestaña abierta del footer (Acerca de nosotros)
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
      tipologiaActiva: {}, // nombre -> índice de la pestaña
      // nombre -> { inicial: %, plazo: años, modalidad: 'uvr'|'pesos',
      //             categoria: 'A'|'B'|'C', complementario: bool, ingreso: pesos }
      // Se conserva por proyecto para que volver a abrir el simulador de una
      // tarjeta que ya se tocó no pierda lo que el usuario había ajustado.
      simConfig: {},

      // Simulador de pagos: overlay de dos pasos (1 = elegir producto,
      // 2 = el simulador completo). Ver simuladorOverlay en templates.js.
      // Uno solo a la vez en toda la app —no hace falta un mapa por proyecto
      // como los de arriba— porque solo se puede simular un proyecto a la vez.
      simulador: null, // null | { proyecto: nombre, tipologia: idx, paso: 1|2 }

      // El apartamento REAL que arma el quiz: qué plano oficial se está
      // montando y la geometría de sus piezas. Lo elige js/planta.js al
      // empezar (elegirApartamento) y NO cambia durante la partida: es un
      // ejemplo para enseñar cómo se construye una vivienda, no la
      // recomendación —esa la calcula matching.js al final.
      //
      // No es un valor derivado a propósito: el parcheo de DOM de main.js
      // necesita comparar lo que hay pintado contra lo que toca ahora.
      planta: null, // null | ver elegirApartamento() en js/planta.js
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

    var nHab = state.answers.habitaciones === '3+' ? 3 : parseInt(state.answers.habitaciones || '2', 10);
    var nPers = state.answers.personas === '4+' ? 4 : parseInt(state.answers.personas || '0', 10);
    var compat = Math.min(97, Math.round(42 + (answered / stepTotal) * 55));

    // El plano REAL que se está armando (ver js/planta.js); aquí solo se
    // decide cuántas de sus piezas se ven ya. La silueta y la losa existen
    // desde antes de la primera respuesta.
    var planta = state.planta;
    var showLote = !planta;
    var losaRevealed = !!planta;
    var rooms = scene.buildRooms(planta, scene.celdasVisibles(state.answers, qList, planta));
    var huecos = scene.buildHuecos(planta);

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
      showLote: showLote,
      losaRevealed: losaRevealed,
      rooms: rooms,
      huecos: huecos,
      // El apartamento que se está armando: de aquí salen el rótulo y la
      // relación de aspecto de la losa.
      planta: planta,
      nHab: nHab,
      nPers: nPers,
      compat: compat,
      perfilChips: perfilChips,
    };
  }

  /**
   * Cambia el plano por uno con las alcobas que el usuario acaba de pedir, si
   * el que estaba puesto no las tiene.
   *
   * `ajustada` queda en true SIEMPRE que se conteste esta pregunta, cambie el
   * plano o no, y main.js lo lee para animar el ajuste. Es a propósito: el
   * plano provisional a veces ya tenía las alcobas pedidas —con 25 planos en
   * el sorteo pasa aproximadamente 1 de cada 8 veces— y entonces contestar no
   * producía ninguna reacción visible, así que la misma acción unas veces
   * movía el plano y otras no. Lo que la animación comunica es "tu plano
   * quedó ajustado a lo que pediste", y eso es cierto en los dos casos.
   *
   * La pregunta de alcobas va de sexta (ver js/data.js), así que para cuando
   * se contesta suele haber varias piezas ya pintadas del apartamento
   * provisional. `reacomodarPlano` (main.js) las desplaza a su sitio en el
   * plano nuevo y cruza a la imagen nueva, en vez de destruirlas y volver a
   * empezar.
   */
  function ajustarPlantaAHabitaciones(state) {
    var pedidas = window.GDF.matching.habitacionesPedidas(state.answers);
    var actual = state.planta;
    if (actual && actual.habitaciones === pedidas) {
      actual.ajustada = true;
      return;
    }
    var nueva = window.GDF.planta.elegirApartamento(state, pedidas);
    // Si no hubo con qué reemplazarlo, se queda el que estaba: mejor un plano
    // que no cuadra que una escena vacía a mitad del quiz.
    if (!nueva) {
      if (actual) actual.ajustada = true;
      return;
    }
    nueva.ajustada = true;
    state.planta = nueva;
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

      // --- carruseles de la portada ---
      // El número de páginas no vive aquí sino en templates.js, que es quien
      // sabe cuántas tarjetas caben por página: `paginasPortada` se lo
      // pregunta. Sin eso, "siguiente" en la última página no volvería al
      // principio y el carrusel se quedaría clavado.
      case 'setPortadaSlide':
        state.portadaSlides[ds.carrusel] = parseInt(ds.value, 10) || 0;
        break;

      case 'nextPortadaSlide':
      case 'prevPortadaSlide': {
        var clave = ds.carrusel;
        var total = window.GDF.templates.paginasPortada(clave);
        var paso = action === 'nextPortadaSlide' ? 1 : -1;
        state.portadaSlides[clave] =
          ((state.portadaSlides[clave] || 0) + paso + total) % total;
        break;
      }

      case 'setPortadaFooterTab':
        state.portadaFooterTab = parseInt(ds.value, 10) || 0;
        break;

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
          window.GDF.leads.esMovilColombiano(state.telefono) &&
          state.consent
        );
        if (!canStart) return false;
        state.answers = { afiliado: state.afiliado };
        state.qi = 0;
        state.screen = 'quiz';
        // El apartamento se elige AQUÍ y ya no cambia. Sale del nombre y el
        // apellido que se acaban de escribir, así que la misma persona ve
        // siempre el mismo plano y dos personas seguidas en un stand ven
        // planos distintos.
        state.planta = window.GDF.planta.elegirApartamento(state);
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
        // El apartamento se fija al empezar, con UNA excepción: al contestar
        // cuántas alcobas quiere, el plano pasa a ser uno que de verdad las
        // tenga. Enseñar un apartaestudio a quien acaba de pedir tres alcobas
        // es la incoherencia más visible que puede tener la escena.
        //
        // El cambio es barato de ver porque todas las plantas del sorteo son
        // rectangulares y se trocean igual (12 celdas, c0..c11): las piezas ya
        // puestas no mueren, se reacomodan y cambian de imagen.
        if (qid === 'habitaciones') ajustarPlantaAHabitaciones(state);
        else if (state.planta) state.planta.ajustada = false;
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
        // El apartamento NO se pierde al retroceder, ni siquiera hasta la
        // primera pregunta: se queda sin piezas y en pantalla sigue la silueta.
        // Eso es lo que evita tener que reconstruir la escena por innerHTML.
        if (state.planta) state.planta.ajustada = false;
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
        // 'modalidad' y 'categoria' son strings; 'complementario' es un
        // interruptor; el resto (inicial, plazo, ingreso) son numéricos.
        if (ds.campo === 'modalidad' || ds.campo === 'categoria') {
          cfg[ds.campo] = ds.valor;
        } else if (ds.campo === 'complementario') {
          cfg.complementario = ds.valor === '1';
        } else {
          cfg[ds.campo] = parseInt(ds.valor, 10) || 0;
        }
        state.simConfig[ds.proyecto] = cfg;
        break;
      }

      // Acciones del overlay del simulador. Van por el dispatch/render normal,
      // a diferencia de 'simSet': abrir, avanzar de paso o cerrar son acciones
      // discretas, no inputs continuos, así que no hace falta el atajo de
      // parcheo de DOM — y un re-render completo es seguro acá porque ya
      // restaura detalleAbierto/tipologiaActiva/simConfig solo.
      case 'abrirSimulador': {
        var idx = parseInt(ds.tipologia, 10) || 0;
        state.simulador = { proyecto: ds.proyecto, tipologia: idx, paso: 1 };
        // Sembrar los valores por defecto que dependen de las respuestas del
        // quiz. Solo la primera vez: si el usuario ya movió los controles de
        // este proyecto, se respeta lo que dejó.
        if (!state.simConfig[ds.proyecto]) {
          var sim = window.GDF.simulador;
          var cat = sim.categoriaSugerida(state.answers.ingresos);
          state.simConfig[ds.proyecto] = {
            inicial: sim.SUPUESTOS.cuotaInicialDefault,
            plazo: sim.SUPUESTOS.plazoDefault,
            // Se arranca en UVR solo si la tasa de esa categoría está
            // publicada (A y B). Para la C, cuya tasa en UVR es todavía un
            // placeholder, se abre en pesos: es la que sí está verificada.
            modalidad: cat && !sim.tasaUvrPorConfirmar(cat) ? 'uvr' : 'pesos',
            categoria: cat || 'B',
            complementario: false,
            ingreso: Math.round(sim.ingresoMedioDe(state.answers.ingresos)),
          };
        }
        break;
      }

      case 'simPaso':
        if (!state.simulador) return false;
        state.simulador.paso = parseInt(ds.valor, 10) || 1;
        break;

      case 'cerrarSimulador':
        state.simulador = null;
        break;

      // Elegir producto en el paso 1 NO cierra el overlay: avanza al paso 2,
      // que es el simulador completo. El hipotecario es la base siempre; el
      // complementario se enciende sobre él (ver `simular` en simulador.js).
      case 'elegirProducto': {
        if (!state.simulador) return false;
        var cfgProd = state.simConfig[state.simulador.proyecto] || {};
        cfgProd.complementario = ds.valor === 'complementario';
        state.simConfig[state.simulador.proyecto] = cfgProd;
        state.simulador.paso = 2;
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
