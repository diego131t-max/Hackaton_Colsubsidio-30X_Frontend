// Simulador del plan de pagos de una vivienda. Reemplaza al "contacta a un
// asesor" de la ficha oficial: en vez de mandar al usuario a un formulario,
// le mostramos de una qué cuota mensual implicaría el proyecto que está
// mirando.
//
// ⚠️ SUPUESTOS, NO COTIZACIÓN. Todo lo que no viene del catálogo real está
// en SUPUESTOS acá abajo, en un solo lugar, para que se pueda corregir sin
// tocar la fórmula. La UI muestra un disclaimer explícito (ver
// simuladorBlock en js/templates.js). Antes de usar esto con clientes reales
// hay que confirmar tasas y valor del subsidio con el área hipotecaria.
(function () {
  'use strict';

  var SUPUESTOS = {
    // Salario mínimo. Es el de 2025; el quiz ya calcula sus pistas de rango
    // de ingresos con este mismo valor ("hasta 2 SMMLV ≈ $2.8M"), así que
    // moverlo acá exige revisar también las pistas en js/data.js.
    smmlv: 1423500,
    anioSmmlv: 2025,

    // Tasa efectiva anual del crédito hipotecario. Valor ILUSTRATIVO: la
    // tasa real depende del banco, del perfil de riesgo y de si el crédito
    // es en pesos o en UVR. VIS suele conseguir tasa más baja que No VIS.
    tasaEaVis: 0.125,
    tasaEaNoVis: 0.135,

    // Mi Casa Ya: subsidio a la cuota inicial para vivienda VIS, escalonado
    // por ingresos del hogar. Los montos van en SMMLV, que es como los
    // define el programa. Solo aplica a VIS.
    subsidioSmmlv: { '≤2 SMMLV': 30, '2–4 SMMLV': 20 },

    // Cuota inicial mínima habitual y opciones que ofrece el simulador.
    cuotaInicialOpciones: [10, 20, 30],
    cuotaInicialDefault: 20,

    plazoOpciones: [10, 15, 20],
    plazoDefault: 20,

    // Regla de oro de originación hipotecaria: la cuota no debería pasar de
    // ~30% del ingreso del hogar. Se usa solo para dar una señal de alerta.
    maxCuotaSobreIngreso: 0.3,
  };

  // Punto medio del rango declarado en el quiz, en pesos. Sirve para decir
  // "esta cuota se te saldría del presupuesto" sin pedir el ingreso exacto.
  // '8+ SMMLV' no tiene techo: se toma 8 como piso conservador.
  var INGRESO_MEDIO_SMMLV = { '≤2 SMMLV': 1.5, '2–4 SMMLV': 3, '4–8 SMMLV': 6, '8+ SMMLV': 8 };

  function subsidioDe(vis, rangoIngresos) {
    if (!vis) return 0;
    var enSmmlv = SUPUESTOS.subsidioSmmlv[rangoIngresos] || 0;
    return enSmmlv * SUPUESTOS.smmlv;
  }

  // Amortización francesa (cuota fija). La tasa del crédito se cotiza
  // efectiva anual, así que hay que convertirla a efectiva mensual —
  // dividir entre 12 daría una cuota más baja de la real.
  function cuotaMensual(monto, tasaEa, anios) {
    if (monto <= 0) return 0;
    var i = Math.pow(1 + tasaEa, 1 / 12) - 1;
    var n = anios * 12;
    return (monto * i) / (1 - Math.pow(1 + i, -n));
  }

  /**
   * @param {object} opciones
   *   precio          {number}  valor de la vivienda en PESOS
   *   vis             {boolean} define tasa y elegibilidad al subsidio
   *   rangoIngresos   {string}  respuesta del quiz ('2–4 SMMLV'...)
   *   porcentajeInicial {number} % de cuota inicial (10/20/30)
   *   plazoAnios      {number}
   */
  function simular(opciones) {
    var precio = opciones.precio || 0;
    var pctInicial = opciones.porcentajeInicial || SUPUESTOS.cuotaInicialDefault;
    var plazo = opciones.plazoAnios || SUPUESTOS.plazoDefault;
    var vis = !!opciones.vis;

    var cuotaInicial = precio * (pctInicial / 100);
    var subsidio = subsidioDe(vis, opciones.rangoIngresos);
    // El subsidio se abona a la cuota inicial: baja lo que hay que ahorrar,
    // no lo que se financia. Si supera la inicial, el excedente sí reduce el
    // crédito (por eso el Math.max de abajo no deja el ahorro en negativo).
    var ahorroNecesario = Math.max(0, cuotaInicial - subsidio);
    var excedenteSubsidio = Math.max(0, subsidio - cuotaInicial);
    var montoCredito = Math.max(0, precio - cuotaInicial - excedenteSubsidio);

    var tasaEa = vis ? SUPUESTOS.tasaEaVis : SUPUESTOS.tasaEaNoVis;
    var cuota = cuotaMensual(montoCredito, tasaEa, plazo);

    var ingresoMedio = (INGRESO_MEDIO_SMMLV[opciones.rangoIngresos] || 0) * SUPUESTOS.smmlv;
    var pctIngreso = ingresoMedio ? cuota / ingresoMedio : null;

    return {
      precio: precio,
      cuotaInicial: cuotaInicial,
      subsidio: subsidio,
      ahorroNecesario: ahorroNecesario,
      montoCredito: montoCredito,
      cuotaMensual: cuota,
      tasaEa: tasaEa,
      plazoAnios: plazo,
      porcentajeInicial: pctInicial,
      totalPagado: cuota * plazo * 12 + cuotaInicial,
      // null cuando no sabemos el ingreso: no es lo mismo que "sí cabe".
      porcentajeDelIngreso: pctIngreso,
      holgado: pctIngreso === null ? null : pctIngreso <= SUPUESTOS.maxCuotaSobreIngreso,
    };
  }

  // "$1.234.567" — formato colombiano, sin decimales (a esta escala sobran).
  function pesos(v) {
    if (v == null || isNaN(v)) return '—';
    return '$' + Math.round(v).toLocaleString('es-CO');
  }

  // "$240,8M" para los titulares, donde el peso exacto estorba.
  function millones(v) {
    if (!v) return '—';
    return '$' + (v / 1e6).toFixed(1).replace('.', ',') + 'M';
  }

  window.GDF = window.GDF || {};
  window.GDF.simulador = {
    simular: simular,
    pesos: pesos,
    millones: millones,
    SUPUESTOS: SUPUESTOS,
  };
})();
