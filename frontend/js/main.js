// Bootstrap: estado vivo, listener delegado único y el ciclo de render.
(function () {
  'use strict';

  var state = window.GDF.state.createInitial();
  var root = null;

  // Pantalla mostrada en el último render, para distinguir "entré a una
  // pantalla nueva" de "seguimos en la misma pantalla pero cambió algo"
  // (afiliado, consent, proyecto elegido, pregunta del quiz...). Cada
  // render() reconstruye TODO el innerHTML, así que sin este chequeo la
  // animación de entrada .gdf-screen (screenIn) se repetiría en cada click
  // dentro de la misma pantalla — un flash visible cada vez que tocas un
  // botón. Las animaciones internas (cuartos cayendo, progreso, chips) no
  // dependen de esto y siguen disparándose siempre, como debe ser.
  var lastScreen = null;

  // Selección en curso de la pregunta 'entorno_deseado' (buscador con chips).
  // Vive fuera de `state` a propósito, igual que los inputs no controlados:
  // cada tecla en el buscador o cada clic en una opción actualizaría
  // `state.answers` y forzaría un re-render completo de la pantalla, que
  // perdería el foco del buscador. Se compromete a `state` recién al pulsar
  // "Continuar" (ver 'answerQuizMultiselect' en onRootClick). Se reinicia
  // sola cada vez que se entra de nuevo a esta pregunta, porque
  // attachInputListeners() solo encuentra '#entornoSearch' en el DOM justo
  // después de un render que aterriza en ella.
  var entornoSeleccion = [];

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
    // El reparto por página de los carruseles lo fija el CSS y solo se puede
    // leer con el DOM ya pintado, así que va después del innerHTML.
    sincronizarPortada();
  }

  // Los carruseles de la portada NO avanzan solos, igual que en la página real
  // de Colsubsidio: se mueven con sus flechas y sus guiones. Antes había un
  // temporizador de 5 s para el carrusel del landing anterior; con cuatro
  // carruseles a la vez habría sido un baile constante detrás del CTA.

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
          // Mismo eco del re-render que en el simulador (ver abajo): acá no
          // causaba bucle, pero sí una pasada inútil del acordeón en cada
          // render. Cerrar otro <details> por código sí contradice el estado,
          // así que el acordeón sigue funcionando.
          if (state.detalleAbierto[el.dataset.proyecto] === el.open) return;
          state.detalleAbierto[el.dataset.proyecto] = el.open;
          if (!el.open) return;
          for (var o = 0; o < detalles.length; o++) {
            if (detalles[o] !== el && detalles[o].open) detalles[o].open = false;
          }
        });
      })(detalles[d]);
    }
    // Los dos controles CONTINUOS del simulador (paso 2 del overlay). No van
    // por el listener delegado de clics: un re-render en cada arrastre del
    // slider o en cada tecla del ingreso perdería el foco del input y
    // reiniciaría las animaciones del panel. Igual que los inputs de la
    // escarapela, se parchea solo el recibo por DOM directo.
    var simPlazo = document.getElementById('simPlazo');
    if (simPlazo) {
      simPlazo.addEventListener('input', function () {
        var etiqueta = document.getElementById('simPlazoValor');
        if (etiqueta) etiqueta.textContent = simPlazo.value + ' años';
        dispatch('simSet', {
          proyecto: simPlazo.dataset.proyecto, campo: 'plazo', valor: simPlazo.value,
        });
      });
    }

    var simIngreso = document.getElementById('simIngreso');
    if (simIngreso) {
      simIngreso.addEventListener('input', function () {
        // Se escribe con separadores de miles ("$4.500.000"), así que hay que
        // quedarse solo con los dígitos antes de mandarlo al estado.
        var digitos = simIngreso.value.replace(/\D/g, '');
        dispatch('simSet', {
          proyecto: simIngreso.dataset.proyecto, campo: 'ingreso', valor: digitos,
        });
      });
      // El formato bonito se aplica al salir del campo: hacerlo en cada tecla
      // movería el cursor a un lugar impredecible mientras se escribe.
      simIngreso.addEventListener('blur', function () {
        var digitos = parseInt(simIngreso.value.replace(/\D/g, ''), 10);
        simIngreso.value = digitos ? window.GDF.simulador.pesos(digitos) : '';
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

    var entornoSearch = document.getElementById('entornoSearch');
    if (entornoSearch) {
      entornoSeleccion = [];
      renderEntornoChips();
      var entornoLista = document.getElementById('entornoOpciones');
      // No hay "modo explorar todo": el panel solo aparece cuando hay algo
      // escrito y ese algo tiene coincidencias — enfocar el input vacío no
      // muestra nada, para que sea de verdad un buscador y no un desplegable
      // disfrazado. Flota pegado al input (ver '.gdf-multi-opt-list' en CSS);
      // el cierre por "clic afuera" vive en boot() (ver 'cerrarEntornoSiTocaAfuera').
      entornoSearch.addEventListener('input', function () {
        var termino = normalizarTexto(entornoSearch.value);
        var botones = document.querySelectorAll('#entornoOpciones .gdf-multi-opt');
        var hayCoincidencias = false;
        for (var i = 0; i < botones.length; i++) {
          var visible = termino !== '' && normalizarTexto(botones[i].textContent).indexOf(termino) > -1;
          botones[i].classList.toggle('oculto', !visible);
          if (visible) hayCoincidencias = true;
        }
        if (entornoLista) entornoLista.classList.toggle('abierto', hayCoincidencias);
      });
    }
  }

  // Sin tildes ni mayúsculas, para que "bano" encuentre "Baño" al buscar.
  function normalizarTexto(s) {
    return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // Agrega o quita `valor` de la selección en curso de 'entorno_deseado' y
  // repinta tanto el botón de la opción como la fila de chips — sin pasar
  // por dispatch()/render() (ver comentario de `entornoSeleccion`).
  function toggleEntornoValor(valor) {
    var idx = entornoSeleccion.indexOf(valor);
    if (idx > -1) entornoSeleccion.splice(idx, 1);
    else entornoSeleccion.push(valor);
    var botones = document.querySelectorAll('#entornoOpciones .gdf-multi-opt');
    for (var i = 0; i < botones.length; i++) {
      if (botones[i].dataset.value === valor) {
        botones[i].classList.toggle('selected', entornoSeleccion.indexOf(valor) > -1);
      }
    }
    renderEntornoChips();
    // Cierra el panel de resultados apenas se elige algo: la confirmación
    // visual es el chip nuevo abajo, no dejar la lista abierta encima tapando
    // la fila de chips que se acaba de actualizar.
    var lista = document.getElementById('entornoOpciones');
    if (lista) lista.classList.remove('abierto');
  }

  function renderEntornoChips() {
    var cont = document.getElementById('entornoChips');
    if (!cont) return;
    var q = findQuestionById('entorno_deseado');
    cont.innerHTML = entornoSeleccion
      .map(function (valor) {
        var opt = q && q.options.filter(function (o) { return o.v === valor; })[0];
        var label = opt ? opt.label : valor;
        return (
          '<span class="gdf-entorno-chip">' + label +
          '<button type="button" class="gdf-entorno-chip-x" data-action="quitarEntorno" data-value="' + valor + '" aria-label="Quitar ' + label + '">×</button>' +
          '</span>'
        );
      })
      .join('');
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

  // Los carruseles de la portada (y el tick que los avanza solos) no pasan por
  // render(): reconstruir el innerHTML de la portada entera redispararía sus
  // animaciones de entrada —un flash cada 5 segundos— y además cortaría la
  // transición CSS de la pista, con lo que el carrusel saltaría de página en
  // vez de deslizarse. Se parchea el DOM, igual que con los inputs no
  // controlados.
  function dispatch(action, dataset) {
    var prevScreen = state.screen;
    var changed = window.GDF.state.applyAction(state, action, dataset);
    if (!changed) return;
    if (action === 'setPortadaSlide' || action === 'nextPortadaSlide' ||
        action === 'prevPortadaSlide') {
      updatePortadaSlideDOM((dataset || {}).carrusel);
      return;
    }
    if (action === 'setPortadaFooterTab') {
      updatePortadaFooterDOM();
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
      updateSimuladorDOM();
      return;
    }
    if (action === 'setDetalleAbierto') return; // el <details> ya se pintó solo
    // Se acaba de elegir el apartamento: se pide su plano ya, para que la
    // primera pieza que caiga no lo haga contra un hueco en blanco.
    if (action === 'startQuiz') precargarPlano();
    // Avanzar o retroceder DENTRO del quiz: la escena no se puede reconstruir
    // por innerHTML. Si se destruyen y recrean los .gdf-room no hay nodos que
    // persistan, y entonces cada respuesta rehace el plano entero en vez de
    // añadirle una pieza.
    if ((action === 'selectOption' || action === 'goBack') &&
        prevScreen === 'quiz' && state.screen === 'quiz') {
      updateQuizDOM();
      return;
    }
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

  // -------------------------------------------------------------------------
  // Quiz: avanzar de pregunta sin reconstruir la escena
  // -------------------------------------------------------------------------

  /**
   * El panel de la pregunta SÍ se repinta entero (no tiene nada que preservar);
   * la escena se parchea nodo a nodo para que las piezas ya pintadas se muevan
   * en vez de volver a caer.
   */
  function updateQuizDOM() {
    var derived = window.GDF.state.computeDerived(state);
    var panel = root.querySelector('.gdf-quiz');
    // La losa y la silueta existen desde antes de la primera respuesta y no se
    // van ni retrocediendo hasta el principio, así que a mitad del quiz nunca
    // hace falta reconstruir la escena por innerHTML.
    if (!panel) return render();
    panel.outerHTML = window.GDF.templates.quizPanel(state, derived);
    // IMPRESCINDIBLE: el panel nuevo trae nodos nuevos. Sin volver a enganchar,
    // mueren el input numérico de 'edad' (pregunta 4) y el buscador con chips
    // de 'entorno_deseado' (la 8), y el fallo es silencioso hasta que alguien
    // llega hasta ahí.
    attachInputListeners();
    updatePlantaDOM(derived);
    updateEscenaExtrasDOM(derived);
  }

  /**
   * Lo que rodea a la planta y tampoco puede repintarse por innerHTML sin
   * matar la escena: la altura según el piso, el nombre de la localidad y el
   * halo con las zonas comunes reales del proyecto.
   */
  function updateEscenaExtrasDOM(derived) {
    var escena = root.querySelector('.gdf-scene');
    if (!escena) return;
    var planta = derived.planta;
    var a = state.answers || {};

    if (a.piso_preferido) escena.dataset.piso = a.piso_preferido;
    else delete escena.dataset.piso;

    // El halo solo existe una vez contestada la pregunta de entorno.
    var halo = escena.querySelector('.gdf-halo');
    var htmlHalo = a.entorno_deseado ? window.GDF.templates.haloAmenidadesHtml(planta, a) : '';
    if (halo && halo.parentNode) halo.parentNode.removeChild(halo);
    if (htmlHalo) {
      var losa = escena.querySelector('.gdf-losa');
      if (losa) losa.insertAdjacentHTML('afterend', htmlHalo);
      else escena.insertAdjacentHTML('beforeend', htmlHalo);
    }
  }

  /**
   * Casa las piezas pintadas con las que toca mostrar, por `data-room`:
   *   - la que no existía -> cae de la grúa (.animated)
   *   - la que ya estaba  -> se deja quieta (solo se le quita .animated)
   *   - la que sobra      -> se la lleva la grúa (.saliendo) y queda el hueco
   */
  function updatePlantaDOM(derived) {
    var losa = root.querySelector('.gdf-losa');
    if (!losa) return;

    // El apartamento cambió (pasa una sola vez: al contestar cuántas alcobas
    // quiere). Las piezas ya puestas NO se destruyen — se reacomodan y cambian
    // de imagen, que es lo que hace que se lea como "el plano se ajusta a lo
    // que pediste" y no como un parpadeo.
    // Mientras la bola esta derribando el plano anterior no se toca nada: la
    // reconstruccion la hace `reconstruirPlano` al terminar, releyendo el
    // estado de ese momento. Si el usuario contesta otra vez durante la
    // demolicion, lo que se levanta es el plano que toca ENTONCES, no el que
    // tocaba cuando empezo el derribo.
    if (losa.dataset.demoliendo) return;
    // Mientras se arma el plano nuevo, lo unico que puede interrumpir es otro
    // CAMBIO de plano (que derriba y vuelve a empezar). El resto —altas y bajas
    // de piezas— lo lleva el propio armado.
    if (losa.dataset.construyendo && derived.planta &&
        losa.dataset.sello === derived.planta.sello) return;

    if (derived.planta && losa.dataset.sello !== derived.planta.sello) {
      // Solo se salta el derribo si no hay NADA que romper (losa vacia).
      if (losa.querySelectorAll('.gdf-room').length < MIN_PIEZAS_DERRIBO) {
        reconstruirPlano(losa);
        return;
      }
      golpeDeBola(losa);
      demolerYReconstruir(losa);
      return;
    }
    if (derived.planta && derived.planta.ajustada) {
      // Se contestó lo de las alcobas y el plano provisional YA las tenía, así
      // que no hay nada que reacomodar. Se anima igual: si no, la misma
      // respuesta unas veces mueve el plano y otras no hace nada, y se lee
      // como que la app se quedó colgada. Ver `ajustarPlantaAHabitaciones`.
      var puestas = losa.querySelectorAll('.gdf-room');
      for (var k = 0; k < puestas.length; k++) marcarReacomodo(puestas[k]);
    }

    var vivos = {};
    var nuevas = 0;
    derived.rooms.forEach(function (room) {
      vivos[room.id] = true;
      apagarHueco(losa, room.id, true);
      var el = losa.querySelector('[data-room="' + room.id + '"]');
      if (el) {
        // Ya estaba: se le quita .animated para que NO vuelva a caer de la
        // grúa. Su geometría no cambia nunca —el apartamento es fijo—, así que
        // no hay nada más que tocarle.
        el.classList.remove('animated');
        return;
      }
      losa.insertAdjacentHTML('beforeend', window.GDF.templates.cuartoHtml(room, true));
      // Escalonadas: cuando una respuesta destapa varias piezas caen una
      // detrás de otra en vez de todas de golpe.
      losa.lastElementChild.style.animationDelay = nuevas * 0.12 + 's';
      nuevas++;
    });

    var todos = losa.querySelectorAll('.gdf-room');
    for (var i = 0; i < todos.length; i++) {
      if (vivos[todos[i].dataset.room]) continue;
      retirarPieza(todos[i]);
      apagarHueco(losa, todos[i].dataset.room, false);
    }
  }

  /**
   * Enciende o apaga el hueco gris que hay DEBAJO de una pieza.
   *
   * Las piezas van en `mix-blend-mode: multiply` para que el papel blanco del
   * plano desaparezca contra el fondo de la escena (si no, las esquinas donde
   * el apartamento no llega se ven como bloques blancos, o sea como piezas que
   * faltan). Multiplicar contra el gris del hueco entintaría el plano entero,
   * así que el hueco se apaga en cuanto su pieza está puesta y se vuelve a
   * encender si la grúa se la lleva.
   */
  function apagarHueco(losa, id, apagar) {
    var hueco = losa.querySelector('.gdf-hueco[data-hueco="' + id + '"]');
    if (hueco) hueco.style.opacity = apagar ? '0' : '';
  }

  // Los planos pesan ~78 KB de media y hasta 240 KB. Se pide en cuanto se
  // elige el apartamento (al empezar el quiz) para que la primera pieza que
  // cae ya tenga la imagen decodificada y no aparezca en blanco.
  var planoPrecargado = null;
  function precargarPlano() {
    var src = state.planta && state.planta.plano;
    if (!src || src === planoPrecargado) return;
    planoPrecargado = src;
    var img = new Image();
    img.src = src;
  }

  /**
   * Cambia el plano de debajo sin tirar lo construido. Funciona porque todas
   * las plantas del sorteo se trocean igual (12 celdas, c0..c11): cada pieza
   * pintada encuentra su equivalente en el plano nuevo, se desplaza a su sitio
   * con la transición CSS y cruza a la imagen nueva.
   */
  /**
   * La bola entra, golpea y se va. Solo el gesto: quien de verdad recoloca las
   * piezas es `demolerYReconstruir`, que se llama justo después: marca las
   * piezas para que se rompan y programa el levantamiento del plano nuevo.
   *
   * `.esperando-golpe` sincroniza el momento — la losa acusa el impacto justo
   * cuando la bola llega, no antes.
   */
  var golpeTimer = null;
  function golpeDeBola(losa) {
    var bola = root.querySelector('.gdf-bola');
    var escena = losa.closest('.gdf-scene');
    if (!bola) return;

    clearTimeout(golpeTimer);
    bola.classList.remove('golpea');
    if (escena) escena.classList.remove('esperando-golpe');
    // Forzar reflow: sin esto, quitar y volver a poner la clase en el mismo
    // frame no reinicia la animación y la bola no se movería si el plano
    // cambia dos preguntas seguidas.
    void bola.offsetWidth;
    bola.classList.add('golpea');
    if (escena) escena.classList.add('esperando-golpe');

    golpeTimer = setTimeout(function () {
      bola.classList.remove('golpea');
      if (escena) escena.classList.remove('esperando-golpe');
    }, 1100);
  }

  // Cuanto tarda el derribo desde que se pulsa. Es la SUMA de lo que dice el
  // CSS de `.gdf-room.demolida`, no un numero a ojo:
  //   340 ms  el impacto de la bola (ver bolaGolpe)
  // + 220 ms  la onda expansiva: lo que tarda en llegar a la pieza mas lejana
  //           del punto de impacto (MS_ONDA)
  // + 780 ms  la caida del pedazo
  //   = 1340 -> 1360
  // Si se toca cualquiera de los tres en el CSS hay que rehacer esta cuenta, o
  // el plano nuevo se levanta encima de pedazos que todavia estan cayendo.
  var MS_DEMOLICION = 1360;
  // Lo que tarda la rotura en propagarse del punto de impacto a la esquina mas
  // lejana. Es lo que hace que se lea como un GOLPE y no como un desvanecido
  // programado: las piezas de al lado de la bola revientan primero.
  var MS_ONDA = 220;
  // A media caida se vuelven a encender los huecos grises: el apartamento se
  // queda en su huella mientras se derrumba, en vez de dejar un vacio. No se
  // pueden encender antes — las piezas van en `mix-blend-mode: multiply` y se
  // multiplicarian contra el gris, entintando el plano entero (el mismo motivo
  // por el que existe `apagarHueco`). A 560 ms ya estan por debajo del 20 % de
  // opacidad y no tinen nada.
  var MS_HUELLA = 560;
  // El derribo se aplica en TODOS los cambios de plano. El umbral es 1 porque
  // lo unico que no tiene sentido es romper cuando no hay NADA pintado (el
  // cambio que cae en la primera respuesta, con la losa aun vacia): ahi la bola
  // golpearia el aire.
  //
  // Estuvo en 5 y era demasiado: medido sobre 4 quices, 7 de los 11 cambios de
  // plano se quedaban sin animacion, o sea el 64 %. La sensacion era que el
  // derribo aparecia de vez en cuando y sin motivo aparente.
  var MIN_PIEZAS_DERRIBO = 1;

  // En cuantos pedazos se rompe cada celda. En pantallas estrechas se baja: son
  // nodos con imagen, `multiply`, `clip-path` y transform animandose a la vez, y
  // 12 celdas x 8 son 96 a la vez.
  //
  // OJO CON EL TOPE: si se queda por debajo de `celdas * ESQUIRLAS_ANCHO`, el
  // reparto de mas abajo BAJA los pedazos por celda en silencio y el derribo se
  // ve mas pobre de lo que dice la constante. Con 8 en escritorio el tope tiene
  // que ser 96 o mayor.
  var ESQUIRLAS_ANCHO = 8;
  var ESQUIRLAS_ESTRECHO = 3;
  var TOPE_ESQUIRLAS = 96;

  var demolicionTimer = null;
  var huellaTimer = null;
  var construccionTimers = [];

  /**
   * El plano cambio: se DERRIBA el anterior y se levanta el nuevo.
   *
   * Antes esto deslizaba cada pieza a su sitio en el plano nuevo
   * (`reacomodarPlano`, ya borrado). Se cambio a peticion: lo que tiene que
   * leerse es que la bola DESTRUYE lo que ya no encaja y el apartamento se
   * vuelve a levantar, no que los muebles se deslizan solos.
   *
   * OJO: derribar es la TRANSICION, no una resta. El numero de piezas al
   * terminar nunca es menor que antes — lo garantiza el suelo de
   * `scene.celdasVisibles`. Se destruye y se reconstruye igual o mas.
   */
  /**
   * Donde golpea la bola, en coordenadas de la escena.
   *
   * Se calcula, no se mide: la bola esta a mitad de su animacion cuando esto
   * corre, asi que su rect no sirve. El gancho esta en (26,26), el cable mide
   * `min(52% del alto, 320px)` y el fotograma del impacto es rotate(-40deg)
   * — los mismos numeros que el CSS de .gdf-bola. Si alli cambian, aqui
   * tambien.
   */
  function puntoDeImpacto(escena) {
    // ESTOS NUMEROS SON UNA COPIA DEL CSS. Van a mano porque cuando esto corre
    // la bola esta a mitad de su animacion y su rect no sirve de nada. Si en
    // `.gdf-bola` cambian `left`, `top` o `--largo`, o si cambia el angulo del
    // fotograma del impacto en `bolaGolpe`, hay que cambiarlos aqui tambien o
    // el polvo y la onda expansiva salen del sitio equivocado.
    //
    //   pivote  left: 45%   top: -14cqh   (cqh = 1% del alto de la escena)
    //   cable   min(70cqh, 560px)
    //   impacto rotate(-8deg)
    var px = escena.clientWidth * 0.45;
    var py = escena.clientHeight * -0.14;
    var largo = Math.min(escena.clientHeight * 0.7, 560);
    // Formula con SIGNO: en CSS, con el cable apuntando a +Y, una rotacion
    // positiva manda la bola a la IZQUIERDA (x' = -L*sin0). El angulo del
    // impacto es negativo, asi que la bola cae a la derecha del pivote.
    var rad = (-8 * Math.PI) / 180;
    return { x: px - Math.sin(rad) * largo, y: py + Math.cos(rad) * largo };
  }

  // Ruido determinista por pieza: mismo id -> mismo cascote, siempre. Sin esto
  // habria que usar Math.random() y el derribo no seria reproducible, que es
  // justo lo que hace imposible verificarlo.
  function jitter(id, sal) {
    var h = 2166136261;
    var s = String(id) + '|' + sal;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return (h % 1000) / 1000; // 0..1
  }

  /**
   * Trocea una celda en pedazos irregulares que TESELAN su rectangulo.
   *
   * Se toma un centro desplazado y un punto intermedio jitterado en cada lado;
   * de ahi salen cuatro cuadrilateros que cubren la celda entera sin huecos ni
   * solapes — el patron de un cristal agrietado. Con 2 pedazos se parte por la
   * diagonal jitterada.
   *
   * Los polignos se CRECEN un pelo desde su centro: en el borde compartido las
   * dos esquirlas pintan cobertura parcial y, con `multiply`, eso sale mas
   * oscuro que una pasada entera — se veia la cuadricula de cortes en el primer
   * fotograma. Es el mismo problema que la SANGRIA de geometriaCeldas, y la
   * misma solucion: solapar.
   */
  // Las esquirlas se SOLAPAN un pelo para tapar el antialiasing del corte. Ojo:
  // esto solo es seguro porque van dentro de `.gdf-cascotes`, que aisla la
  // mezcla. Con el `multiply` en cada esquirla, solapar multiplicaba dos veces
  // esa banda y la costura salia MAS oscura — mas solape, peor.
  var CRECE = 1.2;

  function poligono(pts) {
    // Centro del pedazo, para crecerlo hacia afuera desde ahi.
    var cx = 0, cy = 0;
    pts.forEach(function (q) { cx += q[0]; cy += q[1]; });
    cx /= pts.length;
    cy /= pts.length;
    return 'polygon(' + pts.map(function (q) {
      var vx = q[0] - cx, vy = q[1] - cy;
      var m = Math.sqrt(vx * vx + vy * vy) || 1;
      return (q[0] + (vx / m) * CRECE).toFixed(2) + '% ' + (q[1] + (vy / m) * CRECE).toFixed(2) + '%';
    }).join(', ') + ')';
  }

  function trocear(id, n) {
    var j = function (s) { return jitter(id, s); };
    if (n <= 2) {
      // Diagonal jitterada: dos mitades.
      var a = 30 + j('d1') * 40;
      var b = 30 + j('d2') * 40;
      return [
        poligono([[0, 0], [a, 0], [b, 100], [0, 100]]),
        poligono([[a, 0], [100, 0], [100, 100], [b, 100]]),
      ];
    }

    // Centro desplazado + un punto jitterado en cada arista: cuatro
    // cuadrilateros que TESELAN la celda entera. El patron de un cristal
    // agrietado.
    var cx = 50 + (j('cx') - 0.5) * 36;
    var cy = 50 + (j('cy') - 0.5) * 36;
    var tx = 30 + j('t') * 40;
    var ry = 30 + j('r2') * 40;
    var bx = 30 + j('b') * 40;
    var ly = 30 + j('l') * 40;
    var cuatro = [
      [[0, 0], [tx, 0], [cx, cy], [0, ly]],
      [[tx, 0], [100, 0], [100, ry], [cx, cy]],
      [[cx, cy], [100, ry], [100, 100], [bx, 100]],
      [[0, ly], [cx, cy], [bx, 100], [0, 100]],
    ];
    // Con 3 hay que FUSIONAR dos cuadrilateros contiguos, no devolver cuatro:
    // comparten la arista [tx,0]-[cx,cy], asi que su union sigue teselando la
    // celda exacta. Antes el 3 caia en la rama del 4 y se pedian 3 pedazos pero
    // salian 4 — en movil eso era un tercio mas de nodos de los previstos.
    if (n === 3) {
      return [
        poligono([[0, 0], [100, 0], [100, ry], [cx, cy], [0, ly]]),
        poligono(cuatro[2]),
        poligono(cuatro[3]),
      ];
    }
    if (n <= 4) return cuatro.map(poligono);

    // Para 5 o 6 se parten en dos los cuadrilateros mas grandes, por una
    // diagonal jitterada. Mas pedazos = se lee mas como algo que revienta,
    // pero hay que seguir teselando: por eso se PARTE uno existente en vez de
    // inventar geometria nueva.
    var area = function (q) {
      var s = 0;
      for (var i = 0; i < q.length; i++) {
        var a2 = q[i], b2 = q[(i + 1) % q.length];
        s += a2[0] * b2[1] - b2[0] * a2[1];
      }
      return Math.abs(s) / 2;
    };
    var orden = cuatro.slice().sort(function (a2, b2) { return area(b2) - area(a2); });
    var extra = n - 4;
    var salida = [];
    cuatro.forEach(function (q, k) {
      var idx = orden.indexOf(q);
      if (idx >= extra) {
        salida.push(poligono(q));
        return;
      }
      // Corte por la diagonal entre dos vertices opuestos, movida un poco.
      var f = 0.35 + j('p' + k) * 0.3;
      var m1 = [q[0][0] + (q[1][0] - q[0][0]) * f, q[0][1] + (q[1][1] - q[0][1]) * f];
      var m2 = [q[2][0] + (q[3][0] - q[2][0]) * f, q[2][1] + (q[3][1] - q[2][1]) * f];
      salida.push(poligono([q[0], m1, m2, q[3]]));
      salida.push(poligono([m1, q[1], q[2], m2]));
    });
    return salida;
  }

  /**
   * Sustituye una celda por sus esquirlas. Cada una es un CLON del room con un
   * `clip-path` distinto: hereda su posicion y su `.lienzo` tal cual, asi que no
   * hay que recalcular ni un offset de la imagen.
   *
   * Comprobado que `clip-path` NO rompe el `mix-blend-mode: multiply` — que era
   * el riesgo de todo esto, porque si lo rompiera volveria a verse el papel
   * blanco del plano (ver la seccion de templates.js en CLAUDE.md).
   */
  function esquirlasDe(room, n, bolsa) {
    var out = [];
    trocear(room.dataset.room, n).forEach(function (poly, k) {
      var c = room.cloneNode(true);
      c.classList.remove('animated', 'reacomodo');
      c.classList.add('esquirla');
      c.dataset.esquirla = k;
      c.style.clipPath = poly;
      c.style.webkitClipPath = poly;
      bolsa.appendChild(c);
      out.push(c);
    });
    room.remove();
    return out;
  }

  /**
   * La bolsa donde vuelan los cascotes.
   *
   * Existe por el `mix-blend-mode: multiply`. Si cada esquirla se mezclara por
   * su cuenta, las bandas donde dos se solapan se multiplicarian DOS veces y
   * saldria una costura oscura marcando cada corte. Metiendolas en un
   * contenedor con `isolation: isolate` + `multiply`, entre ellas componen
   * normal y el grupo entero se multiplica UNA vez contra la losa — que es lo
   * que sigue haciendo desaparecer el papel blanco del plano.
   *
   * Va con `inset: 0`, asi que es del tamano de la losa y los % de posicion de
   * las esquirlas siguen resolviendo igual.
   */
  function bolsaDeCascotes(losa) {
    var vieja = losa.querySelector('.gdf-cascotes');
    if (vieja) vieja.remove();
    var bolsa = document.createElement('div');
    bolsa.className = 'gdf-cascotes';
    losa.appendChild(bolsa);
    return bolsa;
  }

  function demolerYReconstruir(losa) {
    // Un armado a medias se cancela: sus temporizadores meterian piezas del
    // plano viejo encima del derribo.
    construccionTimers.forEach(clearTimeout);
    construccionTimers = [];
    delete losa.dataset.construyendo;

    losa.dataset.demoliendo = '1';
    var escena = losa.closest('.gdf-scene');
    var piezas = [].slice.call(losa.querySelectorAll('.gdf-room'));
    var ids = piezas.map(function (el) { return el.dataset.room; });

    var cajaLosa = losa.getBoundingClientRect();
    var cajaEsc = escena ? escena.getBoundingClientRect() : cajaLosa;
    var golpe = escena ? puntoDeImpacto(escena) : { x: 0, y: 0 };
    // El impacto, pasado a coordenadas de la losa.
    var gx = cajaEsc.left + golpe.x - cajaLosa.left;
    var gy = cajaEsc.top + golpe.y - cajaLosa.top;
    var diagonal = Math.sqrt(cajaLosa.width * cajaLosa.width + cajaLosa.height * cajaLosa.height) || 1;

    polvoDeImpacto(escena, golpe);

    // En cuantos pedazos se rompe cada celda. En pantallas estrechas menos, y
    // con un tope global: son nodos con imagen, `multiply`, `clip-path` y
    // transform animandose a la vez.
    var estrecha = escena && escena.clientWidth < 520;
    var porCelda = estrecha ? ESQUIRLAS_ESTRECHO : ESQUIRLAS_ANCHO;
    if (piezas.length * porCelda > TOPE_ESQUIRLAS) {
      porCelda = Math.max(2, Math.floor(TOPE_ESQUIRLAS / piezas.length));
    }

    // Primero se trocean todas y luego se anima: si se hiciera pieza a pieza,
    // cada `remove()` invalidaria los rects de las siguientes.
    var bolsa = bolsaDeCascotes(losa);
    var cascotes = [];
    piezas.forEach(function (el) {
      cascotes = cascotes.concat(esquirlasDe(el, porCelda, bolsa));
    });

    cascotes.forEach(function (el) {
      var sal = el.dataset.room + '#' + el.dataset.esquirla;

      // Vector del impacto a la ESQUIRLA (no a la celda): es lo que hace que
      // dos pedazos de la misma celda salgan en direcciones distintas, o sea
      // que la celda se rompa en vez de moverse en bloque.
      var r = el.getBoundingClientRect();
      var cx = r.left + r.width / 2 - cajaLosa.left;
      var cy = r.top + r.height / 2 - cajaLosa.top;
      var dx = cx - gx;
      var dy = cy - gy;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var cerca = Math.min(1, d / diagonal); // 0 = pegada al golpe

      // La onda tarda en llegar: ese retardo ES el efecto de golpe.
      el.style.setProperty('--retardo', (cerca * (MS_ONDA / 1000)).toFixed(3) + 's');

      // Sale en la direccion del golpe, con un empujon extra si estaba cerca.
      var fuerza = 110 + (1 - cerca) * 150;
      var jx = (jitter(sal, 'x') - 0.5) * 90;
      var jy = jitter(sal, 'y') * 110;
      el.style.setProperty('--dx', Math.round((dx / d) * fuerza + jx) + 'px');
      // Siempre acaba cayendo: la gravedad manda por encima de la direccion.
      el.style.setProperty('--dy', Math.round((dy / d) * fuerza * 0.45 + 190 + jy) + 'px');
      // El SENTIDO del giro es propio del pedazo, no del lado hacia el que sale
      // despedido: atarlo a `dx` hacia que todos los del mismo lado del golpe
      // voltearan igual y el derrumbe se leyera como un bloque moviendose.
      // Volar es radial; voltear, no.
      var giro = jitter(sal, 'rs') < 0.5 ? -1 : 1;
      el.style.setProperty('--rot', Math.round(giro * (40 + jitter(sal, 'r') * 110)) + 'deg');
      el.style.setProperty('--esc', (0.3 + jitter(sal, 's') * 0.25).toFixed(2));

      el.classList.add('demolida');
    });

    clearTimeout(huellaTimer);
    huellaTimer = setTimeout(function () {
      ids.forEach(function (id) { apagarHueco(losa, id, false); });
    }, MS_HUELLA);

    clearTimeout(demolicionTimer);
    demolicionTimer = setTimeout(function () {
      delete losa.dataset.demoliendo;
      reconstruirPlano(losa);
    }, MS_DEMOLICION);
  }

  /**
   * La nube de polvo del impacto. Va en la ESCENA, no en la losa: la losa tiene
   * `overflow:hidden` y se la comeria, y ademas sus hijos van en
   * `mix-blend-mode: multiply`, que tenirian el polvo.
   *
   * Se crea y se destruye sola. Es decoracion pura: si no llega a pintarse, el
   * derribo funciona igual.
   */
  function polvoDeImpacto(escena, golpe) {
    if (!escena) return;
    var vieja = escena.querySelector('.gdf-polvo');
    if (vieja) vieja.remove();

    var nube = document.createElement('div');
    nube.className = 'gdf-polvo';
    nube.style.left = golpe.x + 'px';
    nube.style.top = golpe.y + 'px';
    // Tres bocanadas con tamanos y retardos distintos, para que no se lea como
    // un solo circulo creciendo.
    nube.innerHTML =
      '<i style="--t:1.5;--rx:0px;--ry:0px"></i>' +
      '<i style="--t:1.05;--rx:-46px;--ry:14px"></i>' +
      '<i style="--t:0.9;--rx:42px;--ry:-12px"></i>' +
      '<i style="--t:0.75;--rx:-18px;--ry:-34px"></i>' +
      '<i style="--t:0.7;--rx:26px;--ry:34px"></i>';
    escena.appendChild(nube);
    setTimeout(function () {
      if (nube.parentNode) nube.parentNode.removeChild(nube);
    }, 1000);
  }

  // Cuanto se espera entre pieza y pieza al levantar el plano nuevo. Con 0.06 s
  // las 12 caian en 0.7 s y se leia como que aparecian todas de golpe; con 0.13
  // el armado dura 1.6 s y se ve pieza por pieza.
  var MS_ENTRE_PIEZAS = 130;
  // Lo que tarda una pieza en ARMARSE desde sus pedazos. Tiene que cuadrar con
  // `roomEnsambla` en el CSS.
  var MS_ENSAMBLA = 700;
  // En cuantos pedazos llega cada pieza. Menos que al romperse: al construir
  // solo hay una pieza armandose a la vez, pero el gesto tiene que leerse sin
  // llenar la escena de nodos.
  var ESQUIRLAS_ENSAMBLA = 6;

  /**
   * Una pieza del plano nuevo llega EN PEDAZOS y se arma sola.
   *
   * Es el gesto inverso del derribo, y por eso usa la misma maquinaria:
   * `trocear` + `esquirlasDe`. Los pedazos aparecen dispersos —cada uno con su
   * `--dx/--dy/--rot` de PARTIDA, no de llegada— y convergen a su sitio. Al
   * terminar se retiran y entra la pieza entera: mantener 12 celdas x 4
   * pedazos vivos el resto del quiz seria tirar nodos a la basura, y ademas el
   * derribo siguiente tiene que poder trocear una pieza, no un puzzle ya roto.
   */
  function ensamblarPieza(losa, room, estrecha) {
    var bolsa = losa.querySelector('.gdf-cascotes') || bolsaDeCascotes(losa);

    // Pieza de partida solo para clonarla en pedazos; `esquirlasDe` la retira.
    var tmp = document.createElement('div');
    tmp.innerHTML = window.GDF.templates.cuartoHtml(room, false);
    var base = tmp.firstElementChild;
    bolsa.appendChild(base);

    var trozos = esquirlasDe(base, estrecha ? 2 : ESQUIRLAS_ENSAMBLA, bolsa);
    trozos.forEach(function (el, k) {
      var sal = room.id + '@' + k;
      // De donde VIENE cada pedazo: repartidos alrededor, no todos del mismo
      // sitio, para que se lea como que se juntan.
      var ang = (k / trozos.length) * Math.PI * 2 + jitter(sal, 'a') * 1.4;
      var dist = 90 + jitter(sal, 'd') * 70;
      el.style.setProperty('--dx', Math.round(Math.cos(ang) * dist) + 'px');
      el.style.setProperty('--dy', Math.round(Math.sin(ang) * dist - 60) + 'px');
      el.style.setProperty('--rot', Math.round((jitter(sal, 'r') - 0.5) * 90) + 'deg');
      el.classList.add('ensamblando');
    });

    construccionTimers.push(setTimeout(function () {
      trozos.forEach(function (el) { el.remove(); });
      if (!losa.isConnected) return;
      // Si la pieza ya esta puesta no se duplica. Puede pasar si algo repinto
      // la escena mientras esta se armaba.
      if (!losa.querySelector('.gdf-room[data-room="' + room.id + '"]:not(.esquirla)')) {
        losa.insertAdjacentHTML('beforeend', window.GDF.templates.cuartoHtml(room, false));
      }
      apagarHueco(losa, room.id, true);
    }, MS_ENSAMBLA));
  }

  /**
   * Levanta el plano nuevo de cero, UNA PIEZA A LA VEZ y cada una armandose
   * desde sus pedazos.
   *
   * Relee el estado AHORA (no el `derived` de cuando empezo el derribo) para
   * que contestar durante la animacion no levante un plano ya caducado.
   *
   * OJO CON LA SILUETA: `siluetaHtml(huecos, rooms)` apaga de golpe el hueco
   * gris de TODAS las piezas del plano nuevo. Con las piezas llegando
   * escalonadas eso dejaba, durante mas de un segundo, celdas sin hueco y sin
   * pieza — o sea agujeros. Por eso aqui la silueta se pinta ENTERA (sin
   * `rooms`) y cada hueco se apaga cuando SU pieza acaba de armarse.
   */
  function reconstruirPlano(losa) {
    var derived = window.GDF.state.computeDerived(state);
    if (!derived.planta || !losa.isConnected) return;

    construccionTimers.forEach(clearTimeout);
    construccionTimers = [];

    losa.dataset.sello = derived.planta.sello;
    losa.style.setProperty('--ratio', derived.planta.ratio);
    losa.style.setProperty('--wmax', derived.planta.wmax + 'px');

    var escena = losa.closest('.gdf-scene');
    var estrecha = !!(escena && escena.clientWidth < 520);

    // Solo la silueta: las piezas entran despues, cada una a su hora.
    losa.innerHTML = window.GDF.templates.siluetaHtml(derived.huecos, []);

    // Mientras dura el armado, `updatePlantaDOM` no puede meter piezas por su
    // cuenta: veria la losa medio vacia, insertaria las que faltan y luego el
    // temporizador del armado insertaria LAS MISMAS otra vez. Se vieron 16
    // piezas en un plano de 12.
    losa.dataset.construyendo = '1';

    derived.rooms.forEach(function (room, i) {
      construccionTimers.push(setTimeout(function () {
        if (losa.isConnected) ensamblarPieza(losa, room, estrecha);
      }, i * MS_ENTRE_PIEZAS));
    });
    construccionTimers.push(setTimeout(function () {
      delete losa.dataset.construyendo;
    }, (derived.rooms.length - 1) * MS_ENTRE_PIEZAS + MS_ENSAMBLA + 40));
  }

  // La clase se quita al terminar para que la animación pueda volver a
  // dispararse si el plano cambiara otra vez.
  function marcarReacomodo(el) {
    el.classList.remove('reacomodo');
    void el.offsetWidth;
    el.classList.add('reacomodo');
    setTimeout(function () {
      el.classList.remove('reacomodo');
    }, 700);
  }

  function retirarPieza(el) {
    el.classList.remove('animated');
    el.classList.add('saliendo');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
  }

  // Recalcula el recibo al mover cualquier control del paso 2 del simulador.
  // Repinta SOLO '#simResultado'; los botones segmentados se actualizan
  // moviéndoles la clase .active, sin tocar el resto del panel — así el
  // slider no pierde el arrastre ni el input de ingreso el foco.
  function updateSimuladorDOM() {
    var ctx = window.GDF.templates.contextoSimulador(state);
    if (!ctx) return;

    var panel = document.querySelector('.gdf-credito-modal');
    if (!panel) return;

    var botones = panel.querySelectorAll('.gdf-simc-opt');
    for (var i = 0; i < botones.length; i++) {
      var b = botones[i];
      // Todos los valores se comparan como STRING: los campos del simulador
      // mezclan números (inicial) con etiquetas ('uvr', 'A'), y normalizar en
      // un solo sentido evita una comparación distinta por campo.
      b.classList.toggle('active', b.dataset.valor === String(ctx.cfg[b.dataset.campo]));
    }

    // El interruptor del complementario no es un segmento: alterna, así que
    // su data-valor tiene que quedar apuntando a la acción CONTRARIA.
    var swProducto = panel.querySelector('.gdf-simc-producto[data-campo="complementario"]');
    if (swProducto) {
      swProducto.classList.toggle('on', ctx.cfg.complementario);
      swProducto.dataset.valor = ctx.cfg.complementario ? '0' : '1';
    }

    var out = document.getElementById('simResultado');
    if (out) {
      out.innerHTML = window.GDF.templates.simuladorResultado(ctx, state.answers.ingresos);
    }
  }

  // Mueve UNA pista de la portada y su fila de guiones. No pasa por render()
  // por dos motivos: reconstruir el innerHTML redispararía las animaciones de
  // entrada de toda la portada (se vería como una recarga) y, sobre todo,
  // cortaría la transición CSS de la pista — el carrusel saltaría de página en
  // vez de deslizarse.
  function updatePortadaSlideDOM(clave) {
    if (!clave) return;
    var i = state.portadaSlides[clave] || 0;

    // Solo el índice: el desplazamiento lo calcula el CSS (--paso/--sangria).
    var pista = document.querySelector('.pt-pista[data-pista="' + clave + '"]');
    if (pista) pista.style.setProperty('--i', i);

    var guiones = document.querySelectorAll(
      '.pt-guion[data-carrusel="' + clave + '"]'
    );
    for (var k = 0; k < guiones.length; k++) {
      guiones[k].classList.toggle('activo', k === i);
    }
  }

  var CARRUSELES_PORTADA = ['propios', 'ciudades', 'aliados', 'opciones'];

  // Cuántas tarjetas entran por página lo decide el CSS y cambia con el ancho
  // de la ventana: en el teléfono entra UNA donde en escritorio entran tres.
  // Eso mueve el número de páginas, así que hay que rehacer los guiones y
  // recolocar la página actual. Sin esto, en móvil se pintaban los 4 guiones
  // del escritorio y las 6 últimas tarjetas de "Proyectos propios" no había
  // forma de alcanzarlas.
  function sincronizarPortada() {
    if (!document.querySelector('.gdf-portada')) return;
    CARRUSELES_PORTADA.forEach(function (clave) {
      var n = window.GDF.templates.paginasPortada(clave);
      var i = Math.min(state.portadaSlides[clave] || 0, n - 1);
      state.portadaSlides[clave] = i;

      var caja = document.querySelector('.pt-nav[data-nav="' + clave + '"] .pt-guiones');
      if (caja && caja.children.length !== n) {
        caja.innerHTML = window.GDF.templates.guionesHtml(clave, n, i);
      }
      updatePortadaSlideDOM(clave);
    });
  }

  // El footer de pestañas sí cambia de CONTENIDO, no solo de posición, así que
  // se repinta la lista de enlaces entera; es un bloque pequeño y sin estado
  // que preservar (ningún input, ningún scroll propio).
  function updatePortadaFooterDOM() {
    var P = window.GDF_PORTADA;
    if (!P) return;
    var pestanas = (P.footer || {}).pestanas || [];
    var activa = state.portadaFooterTab || 0;

    var tabs = document.querySelectorAll('.pt-tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('activo', i === activa);

    var caja = document.querySelector('.pt-flinks');
    if (!caja) return;
    caja.innerHTML = ((pestanas[activa] || {}).links || []).map(function (l) {
      var txt = window.GDF.templates.esc(l.texto);
      return l.url
        ? '<a class="pt-flink" href="#" data-action="noop">' + txt + '</a>'
        : '<span class="pt-flink pt-flabel">' + txt + '</span>';
    }).join('');
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

    // 'noop' es el freno del burbujeo (el <details> de las tarjetas, el panel
    // del simulador, y todos los enlaces clonados del portal de Colsubsidio en
    // la portada). Esos van en <a href="#">, así que además hay que cortar la
    // navegación: sin esto, cada clic en un enlace decorativo mete un '#' en la
    // URL y salta el scroll al principio de la portada.
    if (el.dataset.action === 'noop') {
      if (el.tagName === 'A') e.preventDefault();
      return;
    }

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
    // 'entorno_deseado' se responde con el buscador con chips de arriba
    // (selección no controlada, igual que los inputs de texto — ver
    // `entornoSeleccion`). Al continuar se despacha ese arreglo tal cual: son
    // las etiquetas `v` exactas que espera el backend (ver data.js), no se
    // aplanan a texto ni se traducen al `label`.
    if (el.dataset.action === 'answerQuizMultiselect') {
      dispatch('selectOption', { qid: el.dataset.qid, value: entornoSeleccion.slice() });
      return;
    }
    if (el.dataset.action === 'toggleEntorno' || el.dataset.action === 'quitarEntorno') {
      toggleEntornoValor(el.dataset.value);
      return;
    }

    dispatch(el.dataset.action, el.dataset);
  }

  // Cierra el panel de opciones de 'entorno_deseado' al tocar fuera de él
  // (patrón típico de combobox). Registrado UNA sola vez a nivel de
  // documento — si viviera en attachInputListeners() se duplicaría en cada
  // render y se acumularían listeners fantasma. Comprueba los IDs en cada
  // clic porque el <input>/panel solo existen mientras esa pregunta está en
  // pantalla; en cualquier otra pantalla no hace nada.
  function cerrarEntornoSiTocaAfuera(e) {
    var combo = document.querySelector('.gdf-entorno-combo');
    var lista = document.getElementById('entornoOpciones');
    if (!combo || !lista) return;
    if (!combo.contains(e.target)) lista.classList.remove('abierto');
  }

  // Escape cierra el simulador. Mismo criterio que el listener de arriba: se
  // registra una sola vez en boot(), no por render.
  function cerrarModalConEscape(e) {
    if (e.key !== 'Escape' || !state.simulador) return;
    dispatch('cerrarSimulador', {});
  }

  function boot() {
    root = document.getElementById('root');
    root.addEventListener('click', onRootClick);
    document.addEventListener('click', cerrarEntornoSiTocaAfuera);
    document.addEventListener('keydown', cerrarModalConEscape);
    // Girar el teléfono o cambiar el tamaño de la ventana cruza los breakpoints
    // de la portada y con ellos el reparto por página de los carruseles. Va
    // con un pequeño retardo porque 'resize' dispara decenas de veces por
    // arrastre y rehacer los guiones en cada una es trabajo tirado.
    var reajuste = null;
    window.addEventListener('resize', function () {
      clearTimeout(reajuste);
      reajuste = setTimeout(sincronizarPortada, 150);
    });
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
