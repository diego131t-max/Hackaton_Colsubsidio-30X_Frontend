// Comunicación con el backend real de Colsubsidio × 30X — contrato
// "SenalBowl". Módulo aparte, igual que matching.js/qualification.js: una sola
// responsabilidad, y state.js sigue sin hacer I/O.
//
// FLUJO DE DOS PASOS (verificado contra el OpenAPI del backend desplegado):
//
//   1. Al terminar el quiz  -> POST /recomendaciones  con el SenalBowl.
//      Responde 200 con { lead_id, total_catalogo, origen_catalogo,
//      recomendaciones[] } — el top 6 ya viene ordenado por match_score.
//      El lead_id hay que GUARDARLO: lo pide el paso 2.
//
//   2. Al confirmar         -> POST /leads?lead_id=<uuid>  con el MISMO
//      SenalBowl más `proyecto_elegido`.
//
// OJO con el paso 2: el body es el SenalBowl COMPLETO, no un
// `{ proyecto_elegido }` suelto. Está así en el OpenAPI del servicio
// (GET /openapi.json -> paths./leads.post.requestBody -> $ref SenalBowl), y
// `proyecto_elegido` es un campo opcional más de ese mismo esquema.
(function () {
  'use strict';

  // PROVISIONAL: conversión SMMLV → rango en pesos, calculada a partir de
  // los mismos hints que ya se muestran en la pregunta de ingresos del quiz
  // (ver data.js QUESTIONS id:'ingresos'). El backend lo declara como string
  // libre (sin enum), así que no rebota si nos equivocamos — razón de más para
  // confirmar el set EXACTO con el equipo antes de producción.
  var INGRESOS_HOGAR_RANGO = {
    '≤2 SMMLV': 'Hasta $2.800.000',
    '2–4 SMMLV': '$2.800.000 – $5.700.000',
    '4–8 SMMLV': '$5.700.000 – $11.400.000',
    '8+ SMMLV': 'Más de $11.400.000',
  };

  // El contrato pide un entero: 1 bajo, 2 medio, 3 alto, null sin preferencia.
  var PISO_PREFERIDO = { bajo: 1, medio: 2, alto: 3 };

  // El agente de voz marca este número tal cual, sin re-formatear: solo le
  // anteponemos el indicativo si el usuario no lo escribió ya.
  function formatTelefonoMovil(raw) {
    var trimmed = (raw || '').trim();
    if (trimmed.indexOf('+') === 0) return trimmed;
    return '+57 ' + trimmed;
  }

  // Construye el body EXACTO del contrato SenalBowl a partir del estado del
  // quiz. No inventa datos que no están en el contrato (nada de
  // cuota_estimada/valor_estimado — eso lo calcula el backend) ni datos que el
  // quiz no capturó: los opcionales sin respuesta quedan null.
  function buildSenalBowl(state, proyectoElegido) {
    var a = state.answers;

    // El backend indexa su catálogo por LOCALIDAD de Bogotá, así que va la
    // localidad sola: mandar "Bogotá · Kennedy" no cruza con nada (comprobado,
    // devuelve []). La demo es solo de Bogotá, de modo que `a.zona` siempre
    // trae una localidad.
    var zonaInteres = a.zona || '';

    var body = {
      tipo_vivienda: a.tipo === 'VIS' ? 'vis' : 'no_vis',
      nombre: state.nombre.trim(),
      apellido: state.apellido.trim(),
      correo: state.correo.trim(),
      telefono_movil: formatTelefonoMovil(state.telefono),
      afiliado: a.afiliado === 'Sí',
      ingresos_hogar_rango: INGRESOS_HOGAR_RANGO[a.ingresos] || null,
      edad: parseInt(a.edad, 10),
      personas_a_cargo: a.personas === '4+' ? 4 : parseInt(a.personas || '0', 10),
      zona_interes: zonaInteres,
      piso_preferido: PISO_PREFERIDO[a.piso_preferido] || null,
      tipo_inmueble: a.tipo_inmueble || null,
      // Array de las etiquetas exactas del backend (los `v` de la pregunta
      // 'entorno_deseado'). null si el usuario no marcó ninguna.
      entorno_deseado: a.entorno_deseado && a.entorno_deseado.length ? a.entorno_deseado : null,
    };

    if (proyectoElegido) body.proyecto_elegido = proyectoElegido;
    return body;
  }

  function apiBase() {
    return (window.GDF_CONFIG && window.GDF_CONFIG.API_BASE) || '';
  }

  // Un 422 significa que el body dejó de cumplir el contrato: se registra con
  // todo el detalle porque es un problema que hay que hablar con backend, no
  // algo que el usuario pueda resolver reintentando.
  function explicar422(data, body) {
    console.error('[GDF/leads] 422 — el body no cumple el contrato SenalBowl. Revisar tipos/nombres:', data, body);
  }

  // --- Paso 1: recomendaciones ---------------------------------------------
  // `cb` recibe { estado, leadId, items, totalCatalogo, origenCatalogo, error }
  // con estado 'listo' | 'vacio' | 'error'. "Vacío" NO es un error: el backend
  // respondió bien y no tiene nada para esa zona, y la UI lo dice distinto.
  function pedirRecomendaciones(state, cb) {
    var body = buildSenalBowl(state);
    var base = apiBase();

    if (!base) {
      console.error('[GDF/leads] Falta window.GDF_CONFIG.API_BASE (ver js/config.js).', body);
      cb({ estado: 'error', error: 'API_BASE no configurado' });
      return;
    }

    fetch(base + '/recomendaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        if (res.status === 422) {
          return res.json().then(function (data) {
            explicar422(data, body);
            cb({ estado: 'error', error: 'El formulario no cumple el contrato del backend (422).' });
          });
        }
        if (!res.ok) {
          return res.text().then(function (texto) {
            console.error('[GDF/leads] /recomendaciones respondió ' + res.status + ':', texto);
            cb({ estado: 'error', error: 'El servidor respondió ' + res.status + '.' });
          });
        }
        return res.json().then(function (data) {
          var items = data.recomendaciones || [];
          console.log('[GDF/leads] lead_id:', data.lead_id, '| recomendaciones:', items.length,
            '| catálogo:', data.origen_catalogo, '(' + data.total_catalogo + ')');
          cb({
            estado: items.length ? 'listo' : 'vacio',
            leadId: data.lead_id || null,
            items: items,
            totalCatalogo: data.total_catalogo || null,
            origenCatalogo: data.origen_catalogo || null,
            error: null,
          });
        });
      })
      .catch(function (err) {
        console.error('[GDF/leads] No se pudo contactar /recomendaciones:', err);
        cb({ estado: 'error', error: 'No se pudo conectar con el servidor.' });
      });
  }

  // --- Paso 2: confirmar el proyecto elegido -------------------------------
  // `cb` recibe { estado: 'enviado' | 'error', error }.
  function enviarProyectoElegido(state, leadId, idProyecto, cb) {
    var body = buildSenalBowl(state, idProyecto);
    var base = apiBase();

    if (!base || !leadId) {
      console.error('[GDF/leads] Falta API_BASE o lead_id — no se puede confirmar.', { leadId: leadId });
      cb({ estado: 'error', error: 'Falta el identificador del lead.' });
      return;
    }

    fetch(base + '/leads?lead_id=' + encodeURIComponent(leadId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        if (res.status === 422) {
          return res.json().then(function (data) {
            explicar422(data, body);
            cb({ estado: 'error', error: 'El backend rechazó los datos (422).' });
          });
        }
        if (!res.ok) {
          return res.text().then(function (texto) {
            console.error('[GDF/leads] /leads respondió ' + res.status + ':', texto);
            cb({ estado: 'error', error: 'El servidor respondió ' + res.status + '.' });
          });
        }
        console.log('[GDF/leads] Proyecto elegido enviado:', idProyecto, '| lead:', leadId);
        cb({ estado: 'enviado', error: null });
      })
      .catch(function (err) {
        console.error('[GDF/leads] No se pudo contactar /leads:', err);
        cb({ estado: 'error', error: 'No se pudo conectar con el servidor.' });
      });
  }

  window.GDF = window.GDF || {};
  window.GDF.leads = {
    buildSenalBowl: buildSenalBowl,
    pedirRecomendaciones: pedirRecomendaciones,
    enviarProyectoElegido: enviarProyectoElegido,
  };
})();
