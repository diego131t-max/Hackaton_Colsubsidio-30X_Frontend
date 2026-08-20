// Elige el apartamento que arma el quiz y calcula la geometría de sus piezas.
//
// QUÉ SE ARMA
// -----------
// El PLANO REAL de una tipología del catálogo: la imagen que publica la ficha
// de Colsubsidio, con muebles renderizados, texturas y muros gruesos. No un
// esquema dibujado a mano — eso se probó antes y se veía justamente como lo que
// era. Cada pieza que cae de la grúa es un recorte de esa imagen, y cuando
// están todas el conjunto es la imagen entera, sin costuras.
//
// Por dónde se corta lo calcula tools/analizar_planos.py y viene en
// js/planos.js: los cortes caen sobre los MUROS del plano, no sobre una rejilla
// ciega.
//
// EL APARTAMENTO ES ILUSTRATIVO
// -----------------------------
// Sirve para enseñar cómo se arma una vivienda, nada más: la recomendación de
// verdad la calcula matching.js con las respuestas y sale en la pantalla de
// resultados. Por eso en la escena no se dice de qué proyecto es.
//
// Se sortea uno provisional al empezar el quiz y queda fijado al contestar
// cuántas alcobas se quieren (la 6.ª pregunta): ahí se reemplaza por uno que
// de verdad las tenga, reacomodando las piezas ya puestas en vez de
// destruirlas. De ahí no vuelve a cambiar.
//
// NINGUNO DE LOS PLANOS DEL SORTEO LLEVA ROTULOS IMPRESOS (esos "Alcoba 2 ·
// 2.35 x 2.25" que estampan algunas constructoras sobre el plano). Los que los
// llevan están vetados en tools/analizar_planos.py: la gracia es que el
// apartamento se lea como un espacio que se arma, no que venga con las
// respuestas escritas encima, y al trocearlo los rótulos quedaban partidos por
// las costuras.
(function () {
  'use strict';

  // Sangría, en puntos porcentuales de la losa. Cada pieza se dibuja un pelo
  // más grande que su celda para que se solape con la vecina y no queden
  // costuras de subpíxel.
  //
  // Es gratis: como el `.lienzo` se dimensiona y se desplaza en función de W y
  // H de la propia pieza, las dos fórmulas se cancelan y el resultado es
  // idéntico con o sin sangría. Lo único que cambia es que la pieza enseña un
  // píxel de más del vecino, superpuesto. NO estira ni desalinea nada.
  var SANGRIA = 0.4;

  // Por debajo de esta densidad la celda es casi todo papel: no se dibuja ni
  // como pieza ni como hueco. Tiene que coincidir con UMBRAL_CELDA de
  // tools/analizar_planos.py, que es quien decide el orden y el reparto.
  var UMBRAL_CELDA = 30;

  function redondear(n) {
    return Math.round(n * 1000) / 1000;
  }

  /**
   * FNV-1a de 32 bits. Se usa para que el mismo nombre saque siempre el mismo
   * apartamento (se lee como "este es tu plano") y dos personas seguidas en un
   * stand saquen planos distintos. Mismo criterio que la variante 3D del
   * proyecto, que hashea nombre+apellido para variar su planta.
   */
  function hashFnv(txt) {
    var h = 0x811c9dc5;
    var s = String(txt || '');
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
    }
    return h >>> 0;
  }

  // src del plano -> a qué proyecto y tipología pertenece. Se construye una vez
  // recorriendo el catálogo en vez de guardarlo en planos.js: una sola fuente
  // de verdad, y así regenerar uno de los dos archivos no desincroniza el otro.
  var _indice = null;
  function indicePlanos() {
    if (_indice) return _indice;
    _indice = {};
    var proyectos = (window.GDF.data && window.GDF.data.PROJECTS) || [];
    proyectos.forEach(function (p) {
      (p.tipologias || []).forEach(function (t) {
        (t.planos || []).forEach(function (pl) {
          if (pl.src && !_indice[pl.src]) _indice[pl.src] = { proyecto: p, tipologia: t };
        });
      });
    });
    return _indice;
  }

  /**
   * De los cortes que trae planos.js a las piezas con su CSS ya serializado.
   *
   * `datos` es la fila de GDF_PLANOS:
   *   [Wi, Hi, bx, by, bw, bh, cortesX‰, cortesY‰, densidades, orden, vis]
   */
  function geometriaCeldas(src, datos) {
    var Wi = datos[0], Hi = datos[1];
    var bx = datos[2], by = datos[3], bw = datos[4], bh = datos[5];
    var cortesX = datos[6], cortesY = datos[7], dens = datos[8], orden = datos[9];

    // Constantes del plano: hacen que el RECUADRO DE CONTENIDO llene una caja
    // del tamaño de la losa. Son iguales para las doce piezas.
    var bgW = redondear((100 * Wi) / bw);
    var bgH = redondear((100 * Hi) / bh);
    // Guarda: si la imagen no tiene margen blanco, la división es 0/0.
    var posX = Wi === bw ? 0 : redondear((100 * bx) / (Wi - bw));
    var posY = Hi === bh ? 0 : redondear((100 * by) / (Hi - bh));
    var fondo =
      "background-image:url('" + src + "');" +
      'background-size:' + bgW + '% ' + bgH + '%;' +
      'background-position:' + posX + '% ' + posY + '%;' +
      'background-repeat:no-repeat;';

    // Los cortes vienen en milésimas del recuadro; se redondean los CORTES y el
    // tamaño sale de la diferencia. Al revés (redondear posición y tamaño por
    // separado) el borde de una celda no coincide con el de la siguiente.
    var xs = [0];
    cortesX.forEach(function (v) { xs.push(v / 10); });
    xs.push(100);
    var ys = [0];
    cortesY.forEach(function (v) { ys.push(v / 10); });
    ys.push(100);

    var celdas = [];
    for (var a = 0; a < ys.length - 1; a++) {
      for (var b = 0; b < xs.length - 1; b++) {
        var i = celdas.length;
        var L = xs[b], T = ys[a];
        var W = redondear(xs[b + 1] - L + SANGRIA);
        var H = redondear(ys[a + 1] - T + SANGRIA);
        celdas.push({
          id: 'c' + i,
          dens: dens[i],
          L: L, T: T, W: W, H: H,
          styleText: 'left:' + L + '%;top:' + T + '%;width:' + W + '%;height:' + H + '%;',
          lienzoStyle:
            'left:' + redondear(-(L / W) * 100) + '%;' +
            'top:' + redondear(-(T / H) * 100) + '%;' +
            'width:' + redondear(10000 / W) + '%;' +
            'height:' + redondear(10000 / H) + '%;' +
            fondo,
        });
      }
    }

    // Las útiles, en el orden en que deben aparecer (lo decide el script de
    // Python por adyacencia, para que el plano a medias sea siempre una mancha
    // conexa y no piezas flotando en el aire).
    var enOrden = orden.map(function (i) { return celdas[i]; }).filter(Boolean);
    var huecos = celdas.filter(function (c) { return c.dens > UMBRAL_CELDA; });

    return { celdas: enOrden, huecos: huecos, ratio: redondear(bw / bh), wmax: bw };
  }

  // Cuántas alcobas tiene el apartamento de cada plano. Se calcula una vez
  // cruzando el índice con espacios.resumenTipologia.
  var _porHabitaciones = null;
  function poolDisponible() {
    // Solo plantas RECTANGULARES: su huella llena el recuadro, así que la
    // silueta es un rectángulo limpio y el plano se ve armarse entero, sin
    // mordiscos en las esquinas. Si al regenerar el catálogo esa lista se
    // quedara vacía, se cae a todos los aptos antes que dejar el quiz sin
    // apartamento.
    var rectos = window.GDF_PLANOS_RECTOS || [];
    return rectos.length ? rectos : window.GDF_PLANOS_APTOS || [];
  }

  function habitacionesDe(src) {
    var ref = indicePlanos()[src];
    if (!ref) return null;
    return window.GDF.espacios.resumenTipologia(ref.tipologia, ref.proyecto).habitaciones;
  }

  function porHabitaciones() {
    if (_porHabitaciones) return _porHabitaciones;
    _porHabitaciones = {};
    poolDisponible().forEach(function (src) {
      var h = habitacionesDe(src);
      if (!h) return;
      if (!_porHabitaciones[h]) _porHabitaciones[h] = [];
      _porHabitaciones[h].push(src);
    });
    return _porHabitaciones;
  }

  /**
   * El apartamento que se va a armar.
   *
   * Determinista a partir del nombre, para que la misma persona vea siempre el
   * mismo y dos personas seguidas no. `habitaciones` acota el sorteo a los
   * planos que REALMENTE tienen esas alcobas: se pasa cuando el usuario ya
   * contestó esa pregunta, para que el plano no siga enseñando un apartaestudio
   * a quien acaba de pedir tres alcobas.
   */
  function elegirApartamento(state, habitaciones) {
    var tabla = window.GDF_PLANOS || {};
    var pool = poolDisponible();
    if (habitaciones) {
      var acotado = porHabitaciones()[habitaciones];
      // Si el catálogo no tiene ninguna planta rectangular con ese número de
      // alcobas, mejor seguir con el pool entero que quedarse sin apartamento.
      if (acotado && acotado.length) pool = acotado;
    }
    if (!pool.length) return null;

    var semilla = String(state.nombre || '') + '|' + String(state.apellido || '');
    var src = pool[hashFnv(semilla.toLowerCase().trim()) % pool.length];
    var datos = tabla[src];
    if (!datos) return null;

    var ref = indicePlanos()[src];
    var geo = geometriaCeldas(src, datos);
    var resumen = ref
      ? window.GDF.espacios.resumenTipologia(ref.tipologia, ref.proyecto)
      : null;

    return {
      sello: src,
      plano: src,
      proyecto: ref ? ref.proyecto.name : null,
      localidad: ref ? ref.proyecto.localidad : null,
      vis: ref ? !!ref.proyecto.vis : false,
      tipologia: ref ? ref.tipologia.nombre : null,
      area: ref ? ref.tipologia.area : null,
      areaPrivada: resumen ? resumen.areaPrivada : null,
      habitaciones: resumen ? resumen.habitaciones : null,
      precio: ref ? ref.tipologia.precio || null : null,
      amenidades: ref ? ref.proyecto.amenidades || [] : [],
      resumen: resumen,
      celdas: geo.celdas,
      huecos: geo.huecos,
      // Cuántas piezas se ven tras cada una de las 8 preguntas. Viene
      // precalculado por área de tinta, no por conteo: repartiendo por conteo
      // la primera pregunta se llevaba el 30 % de la superficie y las últimas
      // solo añadían lascas.
      vis: datos[10],
      ratio: geo.ratio,
      wmax: geo.wmax,
      cambio: true,
    };
  }

  // -------------------------------------------------------------------------
  // Planos reales de la ficha
  // -------------------------------------------------------------------------

  /**
   * 'Plano del apartamento. Obra gris.' -> 'gris'
   *
   * El orden es JERÁRQUICO y no es negociable: la frase "Sugerencia de
   * distribución y acabados" es la etiqueta estándar del plano decorado, pero
   * también aparece en descripciones que terminan en "Se entrega en obra
   * gris". Si "acabados" se evalúa primero, 8 planos grises se clasifican como
   * decorados.
   *
   * DUPLICADO en tools/analizar_planos.py (clasificar_plano). Si cambia una,
   * cambia la otra: es el filtro que decide qué planos entran al sorteo.
   */
  function clasificarPlano(desc) {
    var t = String(desc || '').toLowerCase();
    if (!t) return 'otro';
    if (/axonometr/.test(t)) return 'axo';
    if (/obra gris|sin acabados/.test(t)) return 'gris';
    if (/acabados/.test(t)) return 'decorado';
    return 'otro';
  }

  /**
   * El plano que mejor representa una tipología: primero el decorado (se lee
   * como un hogar), luego el de obra gris, y la axonometría de última porque es
   * una vista 3D, no una planta. Lo usa la tarjeta de resultados.
   */
  function planoDeTipologia(tipologia) {
    var planos = (tipologia && tipologia.planos) || [];
    if (!planos.length) return null;
    var porTipo = { decorado: null, gris: null, otro: null, axo: null };
    planos.forEach(function (pl) {
      var tipo = clasificarPlano(pl.desc);
      if (!porTipo[tipo]) porTipo[tipo] = { src: pl.src, alt: pl.alt || pl.desc || 'Plano', tipo: tipo };
    });
    return porTipo.decorado || porTipo.gris || porTipo.otro || porTipo.axo;
  }

  window.GDF = window.GDF || {};
  window.GDF.planta = {
    elegirApartamento: elegirApartamento,
    porHabitaciones: porHabitaciones,
    geometriaCeldas: geometriaCeldas,
    indicePlanos: indicePlanos,
    hashFnv: hashFnv,
    planoDeTipologia: planoDeTipologia,
    clasificarPlano: clasificarPlano,
    SANGRIA: SANGRIA,
  };
})();
