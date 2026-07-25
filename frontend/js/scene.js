// Lógica de la vista superior (lote → losa → habitaciones). Port literal de
// revealIds/buildRooms desde App.jsx, adaptado para producir cadenas de estilo
// inline (styleText) en vez de objetos de estilo de React.
(function () {
  'use strict';

  function revealIds(qid, answers) {
    if (qid === 'tipo') return ['losa'];
    if (qid === 'ingresos') return ['sala'];
    if (qid === 'personas') return ['comedor'];
    if (qid === 'edad') return ['cocina'];
    if (qid === 'ubicacion') return ['balcon'];
    if (qid === 'zona') return ['estudio'];
    if (qid === 'tipo_inmueble') return ['vestier'];
    if (qid === 'habitaciones') {
      // El baño lo revelaba la pregunta de ahorro, que ya no existe; va aquí
      // para que la planta no quede sin baño. El vestier se dejó de mostrar
      // junto con la pregunta de primera vivienda.
      var h = answers.habitaciones;
      var habs = h === '1' ? ['hab1'] : h === '2' ? ['hab1', 'hab2'] : ['hab1', 'hab2', 'hab3'];
      return habs.concat(['bano']);
    }
    return [];
  }

  function buildRooms(ids, animar) {
    var ROOM_GEO = window.GDF.data.ROOM_GEO;
    var FURN = window.GDF.data.FURN;
    var has3 = ids.indexOf('hab3') > -1;

    return ids
      .filter(function (id) {
        return id !== 'losa';
      })
      .map(function (id) {
        var g = Object.assign({}, ROOM_GEO[id]);
        if (id === 'hab2' && has3) g.H = 25;

        var roomStyle =
          'position:absolute;left:' + g.L + '%;top:' + g.T + '%;width:' + g.W + '%;height:' + g.H + '%;' +
          'box-sizing:border-box;background:' + g.floor + ';overflow:hidden;';

        var items = (FURN[id] || []).map(function (f) {
          var radius = typeof f[5] === 'string' ? f[5] : f[5] + 'px';
          return {
            styleText:
              'left:' + f[0] + '%;top:' + f[1] + '%;width:' + f[2] + '%;height:' + f[3] + '%;' +
              'background:' + f[4] + ';border-radius:' + radius + ';',
          };
        });

        return {
          id: id,
          label: g.label,
          animated: !!animar,
          styleText: roomStyle,
          items: items,
        };
      });
  }

  window.GDF = window.GDF || {};
  window.GDF.scene = {
    revealIds: revealIds,
    buildRooms: buildRooms,
  };
})();
