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
    if (derived.planta && losa.dataset.sello !== derived.planta.sello) {
      reacomodarPlano(losa, derived);
    } else if (derived.planta && derived.planta.ajustada) {
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
  function reacomodarPlano(losa, derived) {
    var planta = derived.planta;
    losa.dataset.sello = planta.sello;
    losa.style.setProperty('--ratio', planta.ratio);
    losa.style.setProperty('--wmax', planta.wmax + 'px');

    var silueta = losa.querySelector('.gdf-silueta');
    if (silueta) silueta.outerHTML = window.GDF.templates.siluetaHtml(derived.huecos, derived.rooms);

    var porId = {};
    derived.rooms.forEach(function (r) { porId[r.id] = r; });

    var pintadas = losa.querySelectorAll('.gdf-room');
    for (var i = 0; i < pintadas.length; i++) {
      var el = pintadas[i];
      var room = porId[el.dataset.room];
      // Las que ya no tocan las retira el bucle de sobrantes de updatePlantaDOM.
      if (!room) continue;
      el.classList.remove('animated');
      el.style.cssText = room.styleText;
      var lienzo = el.querySelector('.lienzo');
      if (lienzo) lienzo.style.cssText = room.lienzoStyle;
      marcarReacomodo(el);
    }
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
