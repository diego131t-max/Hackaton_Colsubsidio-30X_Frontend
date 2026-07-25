// Algoritmo de scoring de proyectos. Port literal de computeMatches desde
// App.jsx — misma fórmula, mismo clamp [51,96], mismo top 3.
(function () {
  'use strict';

  function computeMatches(a) {
    var PROJECTS = window.GDF.data.PROJECTS;
    var NEIGH = window.GDF.data.NEIGH;

    var wantVis = a.tipo === 'VIS';
    var need = a.habitaciones === '3+' ? 3 : parseInt(a.habitaciones || '1', 10);
    var loc = a.ubicacion;
    var band = ({ '≤2 SMMLV': 110, '2–4 SMMLV': 170, '4–8 SMMLV': 320, '8+ SMMLV': 600 })[a.ingresos] || 200;

    return PROJECTS.map(function (p) {
      var s = 38;
      if (p.muni === loc) {
        s += 24;
        if (loc === 'Bogotá' && a.zona && p.zona === a.zona) s += 5;
      } else if ((NEIGH[loc] || []).indexOf(p.muni) > -1 || (p.near || []).indexOf(loc) > -1) {
        s += 11;
      } else {
        s -= 16;
      }
      s += p.vis === wantVis ? 11 : -13;
      s += p.hab === need ? 7 : p.hab > need ? 4 : -7;
      if (p.vis && a.afiliado === 'Sí') s += 4;
      if (p.vis && a.primera === 'Sí') s += 3;
      if (a.ahorro && a.ahorro !== 'Aún no') s += 2;
      if (p.price <= band) s += Math.min(6, Math.round((band - p.price) / (band * 0.06)));
      else s -= Math.min(11, Math.round((p.price - band) / 8));
      s = Math.max(51, Math.min(96, Math.round(s)));

      var out = {};
      Object.keys(p).forEach(function (k) {
        out[k] = p[k];
      });
      out.score = s;
      return out;
    })
      .sort(function (x, y) {
        return y.score - x.score;
      })
      .slice(0, 3);
  }

  window.GDF = window.GDF || {};
  window.GDF.matching = {
    computeMatches: computeMatches,
  };
})();
