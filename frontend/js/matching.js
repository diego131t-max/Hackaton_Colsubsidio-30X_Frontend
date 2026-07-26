// Algoritmo de scoring de proyectos. Misma fórmula de siempre (mismo punto de
// partida 38, mismos pesos, mismo clamp [51,96]); lo que se agregó es:
//   1. `limite` configurable — antes estaba fijo en top 3.
//   2. cada proyecto sale con `factores`: qué sumó y qué restó. Eso es lo que
//      alimenta el panel de depuración (#debug) y permite comparar este motor
//      contra el clustering cuando el compañero lo conecte. No cambia el
//      puntaje, solo lo explica.
(function () {
  'use strict';

  function computeMatches(a, limite) {
    var PROJECTS = window.GDF.data.PROJECTS;
    var VECINAS = window.GDF.data.VECINAS;

    var wantVis = a.tipo === 'VIS';
    var need = a.habitaciones === '3+' ? 3 : parseInt(a.habitaciones || '1', 10);
    // La demo es solo de Bogotá: la ubicación que se pide es la LOCALIDAD, no
    // el municipio (esa pregunta ya no existe). `zona` conserva el id viejo
    // para no renombrar la respuesta en todo el flujo.
    var loc = a.zona;
    var band = ({ '≤2 SMMLV': 110, '2–4 SMMLV': 170, '4–8 SMMLV': 320, '8+ SMMLV': 600 })[a.ingresos] || 200;

    return PROJECTS.map(function (p) {
      var s = 38;
      var factores = [];
      function suma(puntos, motivo) {
        s += puntos;
        if (puntos) factores.push({ puntos: puntos, motivo: motivo });
      }

      if (p.localidad === loc) {
        suma(29, 'Está en ' + loc);
      } else if ((VECINAS[loc] || []).indexOf(p.localidad) > -1) {
        // Colindante según los límites oficiales del Distrito.
        suma(11, p.localidad + ' colinda con ' + loc);
      } else {
        suma(-16, p.localidad + ' queda lejos de ' + loc);
      }

      suma(p.vis === wantVis ? 11 : -13, p.vis === wantVis ? 'Coincide ' + (p.vis ? 'VIS' : 'No VIS') : 'No coincide con ' + (wantVis ? 'VIS' : 'No VIS'));

      if (p.hab === need) suma(7, need + ' habitaciones, justo lo pedido');
      else if (p.hab > need) suma(4, 'Tiene ' + p.hab + ' hab (pediste ' + need + ')');
      else suma(-7, 'Solo ' + p.hab + ' hab (pediste ' + need + ')');

      if (p.vis && a.afiliado === 'Sí') suma(4, 'VIS + afiliado a Colsubsidio');
      if (p.vis && a.primera === 'Sí') suma(3, 'VIS + primera vivienda');
      if (a.ahorro && a.ahorro !== 'Aún no') suma(2, 'Ya tiene ahorro');

      if (p.price <= band) {
        suma(Math.min(6, Math.round((band - p.price) / (band * 0.06))), 'Precio ($' + p.price + 'M) cabe en tu presupuesto');
      } else {
        suma(-Math.min(11, Math.round((p.price - band) / 8)), 'Precio ($' + p.price + 'M) por encima de tu rango');
      }

      var bruto = s;
      s = Math.max(51, Math.min(96, Math.round(s)));

      var out = {};
      Object.keys(p).forEach(function (k) {
        out[k] = p[k];
      });
      out.score = s;
      out.factores = factores;
      out.scoreBruto = bruto;
      return out;
    })
      .sort(function (x, y) {
        // Se ordena por el puntaje SIN recortar. El `score` que se muestra está
        // acotado a [51,96] para que ninguna tarjeta se vea humillada, pero eso
        // empata a todos los que caen por debajo de 51 — y ahí se perdía la
        // señal de localidad: pidiendo Usaquén, el único proyecto de Usaquén
        // quedaba fuera del top 6 porque otros ganaban el desempate por
        // transacciones. Ordenar por el bruto conserva el orden real.
        // Entre iguales, primero el que más gente ha comprado (transacciones
        // reales del Excel); los que no tienen el dato no se penalizan.
        return y.scoreBruto - x.scoreBruto || (y.transacciones || 0) - (x.transacciones || 0);
      })
      .slice(0, limite || 3);
  }

  window.GDF = window.GDF || {};
  window.GDF.matching = {
    computeMatches: computeMatches,
  };
})();
