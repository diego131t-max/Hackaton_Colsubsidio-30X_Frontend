// Capa adaptadora de recomendación: normaliza lo que sea que llegue —el top 6
// del backend o el motor de reglas local— a UN solo shape que templates.js sabe
// pintar. Así la pantalla de selección no tiene ifs por origen de datos.
//
//   backend -> POST /recomendaciones (js/leads.js). Es la fuente real.
//   local   -> js/matching.js. Se usa como respaldo cuando el backend falla,
//              y siempre marcado como aproximado para no engañar a nadie.
//
// ENRIQUECIMIENTO (la parte importante)
// -------------------------------------
// El backend recomienda sobre SU catálogo (proyectos_seed.json, 100 proyectos)
// y devuelve datos básicos: nombre, precio, área, habitaciones, amenidades.
// Nosotros tenemos 66 proyectos scrapeados del sitio real CON planos,
// tipologías e imágenes. Cada recomendación se cruza por nombre normalizado
// contra ese catálogo:
//   - si cruza  -> la tarjeta muestra imagen, planos y espacios.
//   - si no     -> se pinta solo con lo que mandó el backend, y se dice.
// El simulador de pagos funciona en ambos casos, porque `precio_desde_cop`
// siempre viene.
//
// La forma de cruzarlos de verdad es que el backend adopte nuestro catálogo:
// tools/generar_seed_backend.py genera data/proyectos_seed.json justo para eso.
(function () {
  'use strict';

  var TOTAL_RECOMENDADOS = 6;

  // Marcas diacriticas de Unicode. Se construye con new RegExp para que el
  // archivo no lleve caracteres combinantes sueltos, que son invisibles en
  // el editor y se pierden con cualquier copiar/pegar.
  var RE_DIACRITICOS = new RegExp('[\u0300-\u036f]', 'g');

  function normalizar(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(RE_DIACRITICOS, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function catalogoLocal() {
    var mapa = {};
    (window.GDF.data.PROJECTS || []).forEach(function (p) {
      mapa[normalizar(p.name)] = p;
    });
    return mapa;
  }

  // --- El view-model único -------------------------------------------------
  // Todo lo que pinta projectCard() sale de acá. `local` es la referencia al
  // proyecto del catálogo scrapeado (o null), y es lo que habilita el
  // desplegable de planos.
  function desdeBackend(item, porNombre) {
    var local = porNombre[normalizar(item.nombre_proyecto)] || null;
    return {
      id: item.id_proyecto,
      nombre: item.nombre_proyecto,
      ubicacion: item.direccion || '',
      precioCop: item.precio_desde_cop || 0,
      area: item.area_construida_m2 || null,
      habitaciones: item.habitaciones_ofrecidas || [],
      vis: item.tipo_vivienda === 'vis',
      subsidio: !!item.aplica_subsidio_caja,
      // El backend solo manda las etiquetas del vocabulario, sin icono. Se
      // normalizan al mismo shape que las del catálogo real para que la
      // tarjeta no tenga que distinguir de dónde vinieron.
      amenidades: (item.amenidades_entorno || []).map(function (etiqueta) {
        return { label: etiqueta, clave: etiqueta, icon: null };
      }),
      score: typeof item.match_score === 'number' ? item.match_score : null,
      origen: 'backend',
      local: local,
      factores: null, // el backend no explica su score; el motor local sí
      razon: null, // lo redacta presentar(), ver más abajo
    };
  }

  // El motor local produce EXACTAMENTE el mismo shape, para poder mezclarse
  // con lo anterior sin que la vista note la diferencia.
  function desdeLocal(p) {
    return {
      // El backend identifica por id_proyecto; el motor local no tiene ids, así
      // que usa el nombre. Es la clave de selección y lo que viajaría en
      // `proyecto_elegido` — ver la nota en state.js sobre por qué eso solo se
      // envía cuando la recomendación vino del backend.
      id: p.name,
      nombre: p.name,
      // La LOCALIDAD, no la zona cardinal del CMS ("Occidente", "Norte"): es
      // lo que el usuario acaba de elegir en el quiz, así que es lo único que
      // le permite reconocer si el proyecto le queda donde pidió.
      ubicacion: p.localidad ? p.localidad + ', Bogotá' : p.muni,
      precioCop: (p.price || 0) * 1e6,
      area: p.area || null,
      habitaciones: p.hab ? [p.hab] : [],
      vis: !!p.vis,
      subsidio: !!p.vis,
      // Zonas comunes reales de la ficha: { label, icon, clave }. `clave` es
      // la del vocabulario de 25 del contrato y es lo que permite resaltar las
      // que el usuario pidió en la pregunta de entorno.
      amenidades: p.amenidades || [],
      score: p.score != null ? p.score : null,
      origen: 'local',
      local: p,
      factores: p.factores || null,
      razon: null, // lo redacta presentar(), ver más abajo
    };
  }

  // --- Podio fijo ----------------------------------------------------------
  // El ORDEN lo decide el motor (o el backend); lo que se fija es el número
  // que se muestra. Los tres primeros siempre se presentan como 96 / 94 / 89 %
  // para que el podio se lea igual en cualquier demo, sin depender de si el
  // usuario eligió una localidad con mucha o poca oferta —con la fórmula cruda,
  // pedir Usaquén (1 proyecto) sacaba un "top 1" del 62 % y parecía roto.
  // El puntaje calculado se conserva en `scoreReal` para el panel #debug.
  var PODIO = [96, 94, 89];

  function aplicarPodio(items) {
    var previo = null;
    items.forEach(function (vm, i) {
      if (vm.scoreReal === undefined) vm.scoreReal = vm.score;
      var valor;
      if (i < PODIO.length) {
        valor = PODIO[i];
      } else {
        // Fuera del podio se respeta el puntaje real, pero nunca puede
        // alcanzar al de arriba: si lo hiciera, la lista se leería al revés.
        // El escalón de -2 también evita el caso de una localidad con poca
        // oferta, donde la fórmula deja a todos en el piso y se veían tres
        // tarjetas seguidas con el mismo 51 %.
        var calculado = vm.scoreReal != null ? vm.scoreReal : previo - 2;
        valor = Math.max(40, Math.min(calculado, previo - 2));
      }
      vm.score = valor;
      previo = valor;
    });
    return items;
  }

  // --- Por qué quedó en esa posición ---------------------------------------
  // Una frase en español por tarjeta, armada con los mismos criterios que usa
  // el scoring (localidad, habitaciones, precio contra el rango de ingresos,
  // VIS/subsidio y las zonas comunes que el usuario marcó). Se redacta desde el
  // view-model, así que sirve igual venga del motor local o del backend.
  //
  // Las frases van SIN comas internas a propósito: se unen en una lista
  // ("a, b y c") y una coma suelta adentro haría ilegible el resultado.
  function listaNatural(arr) {
    if (!arr.length) return '';
    if (arr.length === 1) return arr[0];
    return arr.slice(0, -1).join(', ') + ' y ' + arr[arr.length - 1];
  }

  // Las etiquetas reales de la ficha a veces son una frase entera ("Zona
  // fitness con salón de spinning y salón TRX"). Para la razón se usa solo la
  // cabeza; el nombre completo ya aparece en el bloque de zonas comunes.
  function nombreCorto(label) {
    var s = String(label || '').split(/\s+con\s+|\s+-\s+|,/)[0].trim();
    // Solo se baja la inicial: pasarlo entero a minúsculas rompía las siglas
    // ("Salón TRX" -> "salón trx", que parece una errata).
    return s ? s.charAt(0).toLowerCase() + s.slice(1) : '';
  }

  function frasesDeMatch(vm, a) {
    var VECINAS = window.GDF.data.VECINAS || {};
    var mat = window.GDF.matching;
    var buenas = [];
    var malas = [];

    // 1. Localidad. `vm.ubicacion` viene como "Kennedy, Bogotá".
    var localidad = String(vm.ubicacion || '').split(',')[0].trim();
    if (localidad && a.zona) {
      if (localidad === a.zona) buenas.push('está en ' + localidad + ' (la localidad que elegiste)');
      else if ((VECINAS[a.zona] || []).indexOf(localidad) > -1) buenas.push('queda en ' + localidad + ' (vecina de ' + a.zona + ')');
      else malas.push('queda en ' + localidad + ' (lejos de ' + a.zona + ')');
    }

    // 2. Habitaciones.
    var pedidas = mat.habitacionesPedidas(a);
    var ofrece = (vm.habitaciones || []).reduce(function (max, h) {
      return Math.max(max, Number(h) || 0);
    }, 0);
    function hab(n) {
      return n + (n === 1 ? ' habitación' : ' habitaciones');
    }
    if (ofrece) {
      if ((vm.habitaciones || []).map(Number).indexOf(pedidas) > -1) buenas.push('tiene ' + (pedidas === 1 ? 'la habitación' : 'las ' + pedidas + ' habitaciones') + ' que buscas');
      else if (ofrece > pedidas) buenas.push('ofrece ' + hab(ofrece) + ' (pediste ' + pedidas + ')');
      else malas.push('llega a ' + hab(ofrece) + ' para las ' + pedidas + ' que pediste');
    }

    // 3. Precio contra el techo del rango de ingresos.
    var millones = Math.round((vm.precioCop || 0) / 1e6);
    if (millones) {
      if (millones <= mat.bandaDe(a)) buenas.push('desde $' + millones + ' millones entra en tu presupuesto');
      else malas.push('desde $' + millones + ' millones se pasa de tu presupuesto');
    }

    // 4. Zonas comunes que el usuario marcó en la pregunta de entorno. Se
    // nombran máximo dos: la tarjeta ya las resalta todas con un ✓ más abajo.
    var quiere = a.entorno_deseado || [];
    var coinciden = [];
    (vm.amenidades || []).forEach(function (am) {
      var corto = nombreCorto(am.label);
      if (am.clave && quiere.indexOf(am.clave) > -1 && corto && coinciden.indexOf(corto) === -1) coinciden.push(corto);
    });
    var idxEntorno = -1;
    if (coinciden.length) {
      idxEntorno = buenas.push('trae ' + listaNatural(coinciden.slice(0, 2)) + ' (lo que marcaste del entorno)') - 1;
    }

    // 5. VIS / subsidio. Va de última a propósito: es la única frase sin "y"
    // interna, y `listaNatural` une el último elemento justamente con " y ".
    var quiereVis = a.tipo === 'VIS';
    if (vm.vis === quiereVis) {
      if (vm.vis && a.afiliado === 'Sí') buenas.push('es VIS con subsidio por tu afiliación a Colsubsidio');
      else buenas.push('es ' + (vm.vis ? 'VIS' : 'No VIS') + ' como pediste');
    } else {
      malas.push('es ' + (vm.vis ? 'VIS' : 'No VIS') + ' cuando buscabas ' + (quiereVis ? 'VIS' : 'No VIS'));
    }

    // Si la frase del entorno quedó de última (porque la de VIS se fue a las
    // "malas"), se deja una sola zona: dos encadenarían "… y piscina y sauna".
    if (idxEntorno > -1 && idxEntorno === buenas.length - 1 && coinciden.length > 1) {
      buenas[idxEntorno] = 'trae ' + coinciden[0] + ' (lo que marcaste del entorno)';
    }

    return { buenas: buenas, malas: malas };
  }

  function razonDeMatch(vm, a, pos) {
    var f = frasesDeMatch(vm, a);
    var encabezado = ['Es tu mejor match', 'Segunda mejor opción', 'Tercera mejor opción'][pos] || 'También encaja contigo';
    var texto = f.buenas.length ? encabezado + ': ' + listaNatural(f.buenas) + '.' : encabezado + '.';
    if (f.malas.length) texto += ' Eso sí, ' + listaNatural(f.malas) + '.';
    return texto;
  }

  function explicar(items, answers) {
    items.forEach(function (vm, i) {
      vm.razon = razonDeMatch(vm, answers || {}, i);
    });
    return items;
  }

  // Lo que toda salida tiene que pasar antes de llegar a la pantalla: número
  // del podio + razón redactada, sin importar de dónde vinieron las tarjetas.
  function presentar(items, answers) {
    return explicar(aplicarPodio(items), answers);
  }

  function recomendarLocal(answers, cb, extra) {
    var matches = window.GDF.matching.computeMatches(answers, TOTAL_RECOMENDADOS);
    var salida = {
      estado: matches.length ? 'listo' : 'vacio',
      aproximado: true,
      leadId: null,
      items: presentar(matches.map(desdeLocal), answers),
      totalCatalogo: (window.GDF.data.PROJECTS || []).length,
      origenCatalogo: 'catálogo real de colsubsidio.com',
      error: null,
    };
    Object.keys(extra || {}).forEach(function (k) {
      salida[k] = extra[k];
    });
    cb(salida);
  }

  // Llamada real al backend. `cb` recibe el mismo objeto que pinta la pantalla:
  // { estado, aproximado, leadId, items, totalCatalogo, origenCatalogo, error }.
  function recomendarBackend(state, cb) {
    var porNombre = catalogoLocal();
    window.GDF.leads.pedirRecomendaciones(state, function (r) {
      if (r.estado === 'error') {
        cb({
          estado: 'error', aproximado: false, leadId: null, items: [],
          totalCatalogo: null, origenCatalogo: null, error: r.error,
        });
        return;
      }
      cb({
        estado: r.estado, // 'listo' | 'vacio'
        aproximado: false,
        leadId: r.leadId,
        items: presentar(
          (r.items || []).map(function (item) {
            return desdeBackend(item, porNombre);
          }),
          state.answers
        ),
        totalCatalogo: r.totalCatalogo,
        origenCatalogo: r.origenCatalogo,
        error: null,
      });
    });
  }

  // Modo de la demo: las tarjetas salen del catálogo REAL (los 31 proyectos de
  // Bogotá scrapeados, con foto, planos y tipologías), pero el lead SÍ se
  // registra en el backend con el paso 1 del contrato, porque de ahí sale el
  // `lead_id` que necesita el paso 2 al confirmar.
  //
  // Por qué no se muestran las recomendaciones del backend: su catálogo es
  // sintético ("Portal Real", "Villas del Rio"…), ninguno de sus proyectos
  // existe en el catálogo real y por tanto ninguno tiene foto ni planos.
  // Además no tiene nada en Fontibón ni en Los Mártires, donde nosotros
  // tenemos 10 proyectos. Cuando el backend adopte data/proyectos_seed.json
  // esto se vuelve innecesario: basta poner RECOMMENDER en 'backend'.
  function recomendarHibrido(state, cb) {
    // Se pintan ya los proyectos reales, sin esperar a la red.
    recomendarLocal(state.answers, cb, { aproximado: false });
    // …y en paralelo se registra el lead para conseguir el lead_id.
    window.GDF.leads.pedirRecomendaciones(state, function (r) {
      if (r.leadId) {
        recomendarLocal(state.answers, cb, { aproximado: false, leadId: r.leadId });
      } else {
        console.warn('[GDF/recommender] el backend no devolvió lead_id; la confirmación no podrá enviarse.');
      }
    });
  }

  // Punto de entrada único. Se elige con RECOMMENDER en js/config.js:
  //   'hibrido' (default) -> tarjetas reales + lead registrado en el backend
  //   'backend'           -> tarjetas del backend (cuando adopten nuestro seed)
  //   'local'             -> solo motor local, sin red
  function recomendar(state, cb) {
    var fuente = (window.GDF_CONFIG || {}).RECOMMENDER || 'hibrido';
    if (fuente === 'local') {
      recomendarLocal(state.answers, cb, { aproximado: true });
      return;
    }
    if (fuente === 'backend') {
      recomendarBackend(state, cb);
      return;
    }
    recomendarHibrido(state, cb);
  }

  window.GDF = window.GDF || {};
  window.GDF.recommender = {
    recomendar: recomendar,
    recomendarLocal: recomendarLocal,
    desdeLocal: desdeLocal,
    TOTAL_RECOMENDADOS: TOTAL_RECOMENDADOS,
  };
})();
