// Envío del lead capturado por el quiz al backend real de Colsubsidio × 30X
// — contrato "SenalBowl" acordado con el equipo de backend. Módulo aparte,
// igual que matching.js/qualification.js: una sola responsabilidad, y
// state.js sigue sin hacer I/O.
(function () {
  'use strict';

  // PROVISIONAL: conversión SMMLV → rango en pesos, calculada a partir de
  // los mismos hints que ya se muestran en la pregunta de ingresos del quiz
  // (ver data.js QUESTIONS id:'ingresos'). El equipo de backend tiene que
  // confirmar el set EXACTO de etiquetas de ingresos_hogar_rango antes de
  // ir a producción — no cambiar estos valores sin avisarles.
  var INGRESOS_HOGAR_RANGO = {
    '≤2 SMMLV': 'Hasta $2.800.000',
    '2–4 SMMLV': '$2.800.000 – $5.700.000',
    '4–8 SMMLV': '$5.700.000 – $11.400.000',
    '8+ SMMLV': 'Más de $11.400.000',
  };

  // El agente de voz marca este número tal cual, sin re-formatear: solo le
  // anteponemos el indicativo si el usuario no lo escribió ya.
  function formatTelefonoMovil(raw) {
    var trimmed = (raw || '').trim();
    if (trimmed.indexOf('+') === 0) return trimmed;
    return '+57 ' + trimmed;
  }

  // Construye el body EXACTO del contrato SenalBowl a partir del estado del
  // quiz. No inventa datos que no están en el contrato (nada de
  // proyecto_recomendado/cuota_estimada/etc. — eso lo calcula el backend) ni
  // datos que el quiz no capturó: los opcionales sin respuesta quedan null.
  function buildSenalBowl(state) {
    var a = state.answers;
    var piso = !a.piso_preferido || a.piso_preferido === 'sin_preferencia' ? null : a.piso_preferido;

    return {
      tipo_vivienda: a.tipo === 'VIS' ? 'vis' : 'no_vis',
      nombre: state.nombre.trim(),
      apellido: state.apellido.trim(),
      correo: state.correo.trim(),
      telefono_movil: formatTelefonoMovil(state.telefono),
      afiliado: a.afiliado === 'Sí',
      ingresos_hogar_rango: INGRESOS_HOGAR_RANGO[a.ingresos] || null,
      edad: parseInt(a.edad, 10),
      personas_a_cargo: a.personas === '4+' ? 4 : parseInt(a.personas || '0', 10),
      zona_interes: a.zona ? a.ubicacion + ' · ' + a.zona : a.ubicacion,
      piso_preferido: piso,
      tipo_inmueble: a.tipo_inmueble || null,
      entorno_deseado: a.entorno_deseado ? a.entorno_deseado.trim() || null : null,
    };
  }

  // Fire-and-forget: el backend responde 202 de inmediato y el resto
  // (llamada, calificación) corre en su pipeline en segundo plano — no hay
  // que esperar nada más para que la UI siga. `onSettled` recibe
  // { status: 'sent', leadId } o { status: 'error', error }.
  function submitLead(state, onSettled) {
    var body = buildSenalBowl(state);
    var apiBase = (window.GDF_CONFIG && window.GDF_CONFIG.API_BASE) || '';

    if (!apiBase) {
      console.error('[GDF/leads] Falta window.GDF_CONFIG.API_BASE (ver js/config.js) — no se envía el lead.', body);
      if (onSettled) onSettled({ status: 'error', error: 'API_BASE no configurado' });
      return;
    }

    fetch(apiBase + '/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(function (res) {
        if (res.status === 202) {
          return res.json().then(function (data) {
            console.log('[GDF/leads] Lead recibido, procesando en segundo plano. lead_id:', data.lead_id);
            if (onSettled) onSettled({ status: 'sent', leadId: data.lead_id, error: null });
          });
        }
        if (res.status === 422) {
          return res.json().then(function (data) {
            console.error('[GDF/leads] 422 — el body no cumple el contrato SenalBowl. Revisar tipos/nombres:', data, body);
            if (onSettled) onSettled({ status: 'error', leadId: null, error: data });
          });
        }
        return res.text().then(function (text) {
          console.error('[GDF/leads] Respuesta inesperada del backend (' + res.status + '):', text);
          if (onSettled) onSettled({ status: 'error', leadId: null, error: text });
        });
      })
      .catch(function (err) {
        console.error('[GDF/leads] No se pudo contactar al backend de leads:', err);
        if (onSettled) onSettled({ status: 'error', leadId: null, error: String(err) });
      });
  }

  window.GDF = window.GDF || {};
  window.GDF.leads = {
    buildSenalBowl: buildSenalBowl,
    submitLead: submitLead,
  };
})();
