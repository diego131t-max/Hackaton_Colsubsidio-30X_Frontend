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
    };
  }

  function recomendarLocal(answers, cb, extra) {
    var matches = window.GDF.matching.computeMatches(answers, TOTAL_RECOMENDADOS);
    var salida = {
      estado: matches.length ? 'listo' : 'vacio',
      aproximado: true,
      leadId: null,
      items: matches.map(desdeLocal),
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
        items: (r.items || []).map(function (item) {
          return desdeBackend(item, porNombre);
        }),
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
