/**
 * AsesorView — la ficha de traspaso (H9) convertida en interfaz.
 *
 * NO es el mapa del sistema. El monitor responde "¿está funcionando el
 * pipeline?"; esta vista responde otra pregunta, la del asesor humano que va a
 * levantar el teléfono: "¿quién es esta persona, qué ya le preguntamos, y qué
 * NO debo volver a preguntarle?".
 *
 * De ahí las decisiones de diseño:
 *   - El nivel del lead domina la pantalla: es lo que decide a quién llama
 *     primero.
 *   - Los datos financieros sensibles van aparte y colapsados. Salieron a
 *     propósito del formulario para preguntarlos en conversación; mostrarlos
 *     mezclados con la zona y la edad los trataría como un dato más.
 *   - Todo lo que no está capturado se muestra como ausente ("—"), nunca
 *     rellenado con un supuesto: un asesor que confía en un dato inventado
 *     quema el lead.
 */

import { useMemo, useState } from "react";
import type { Calificacion, Lead, RecomendacionDetalle } from "../types";
import { antiguedad, esPasado, fechaHora, pesosCortos } from "../utils";

interface Props {
  leads: Lead[];
}

type Filtro = "todos" | Calificacion | "sin_respuesta";

const ETIQUETA_NIVEL: Record<Calificacion, string> = {
  caliente: "Caliente",
  tibio: "Tibio",
  frio: "Frío",
};

/** Qué debe hacer el asesor con este lead. El badge solo dice el nivel. */
const ACCION_NIVEL: Record<Calificacion, string> = {
  caliente: "Llamar hoy — quiere cerrar",
  tibio: "Dar seguimiento esta semana",
  frio: "Mantener en base, sin prioridad",
};

const PISO_LABEL: Record<number, string> = { 1: "Bajo", 2: "Medio", 3: "Alto" };

function nivelDe(lead: Lead): Filtro {
  return lead.calificacion ?? "sin_respuesta";
}

function nombreDe(lead: Lead): string {
  const s = lead.senal ?? ({} as Lead["senal"]);
  return `${s.nombre ?? ""} ${s.apellido ?? ""}`.trim() || "Sin nombre";
}

function siNo(v?: boolean | null): string {
  if (v == null) return "—";
  return v ? "Sí" : "No";
}

/**
 * ¿Esta recomendación es el proyecto que la persona eligió? Se compara sin
 * tildes ni mayúsculas porque el nombre viaja como texto entre el formulario,
 * el modelo y la base — "Fontibón" y "fontibon" son el mismo proyecto.
 */
function esElElegido(r: RecomendacionDetalle, elegido?: string | null): boolean {
  if (!elegido) return false;
  const canon = (t: string) =>
    t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return canon(r.nombre_proyecto ?? "") === canon(elegido);
}

/** Iniciales para el avatar. Da identidad visual sin necesitar una foto. */
function iniciales(lead: Lead): string {
  const s = lead.senal ?? ({} as Lead["senal"]);
  return `${(s.nombre ?? "")[0] ?? ""}${(s.apellido ?? "")[0] ?? ""}`.toUpperCase() || "?";
}

/** Texto o guion largo — nunca una cadena vacía que parezca un dato borrado. */
function oGuion(v?: string | null): string {
  const t = (v ?? "").trim();
  return t.length ? t : "—";
}

// --------------------------------------------------------------------------- //
// Lista maestra
// --------------------------------------------------------------------------- //
function FilaLead({
  lead,
  activo,
  onClick,
}: {
  lead: Lead;
  activo: boolean;
  onClick: () => void;
}) {
  const nivel = nivelDe(lead);
  const s = lead.senal ?? ({} as Lead["senal"]);
  return (
    <button
      type="button"
      className={`as-fila${activo ? " as-fila--activa" : ""}`}
      onClick={onClick}
      aria-current={activo}
    >
      <span className={`as-punto as-punto--${nivel}`} aria-hidden />
      <span className="as-fila__cuerpo">
        <span className="as-fila__nombre">{nombreDe(lead)}</span>
        <span className="as-fila__meta">
          {oGuion(s.zona_interes)} · {s.tipo_vivienda === "no_vis" ? "No VIS" : "VIS"}
          {s.proyecto_elegido ? ` · ${s.proyecto_elegido}` : ""}
        </span>
      </span>
      <span className="as-fila__derecha">
        <span className={`as-chip as-chip--${nivel}`}>
          {nivel === "sin_respuesta" ? "Sin respuesta" : ETIQUETA_NIVEL[nivel as Calificacion]}
        </span>
        <span className="as-fila__tiempo">{antiguedad(lead.updatedAt)}</span>
      </span>
    </button>
  );
}

// --------------------------------------------------------------------------- //
// Bloques del detalle
// --------------------------------------------------------------------------- //
// Componentes del score del motor v2 (modelo_recomendaciones/motor/modelo.py).
// Los valores ya vienen reescalados por el backend para sumar el match_score,
// asi que cada tramo se dibuja a su ancho real.
const DIMENSIONES_V2 = [
  { clave: "perfil", etiqueta: "Perfil" },
  { clave: "historial", etiqueta: "Historial" },
  { clave: "zonas", etiqueta: "Amenidades" },
  { clave: "localidad", etiqueta: "Localidad" },
] as const;

// Motor v1, por reglas. Se conserva porque los leads capturados ANTES del
// cambio de motor tienen este desglose guardado en Supabase: borrarlo dejaria
// sus fichas con la barra vacia y sin explicacion del match.
const DIMENSIONES_V1 = [
  { clave: "entorno", etiqueta: "Entorno" },
  { clave: "capacidad", etiqueta: "Capacidad" },
  { clave: "asequibilidad", etiqueta: "Asequibilidad" },
  { clave: "beneficio_caja", etiqueta: "Beneficio caja" },
] as const;

/** Elige el juego de dimensiones segun las claves que traiga la fila. */
function dimensionesDe(d: Record<string, number | undefined>) {
  return DIMENSIONES_V2.some((dim) => d[dim.clave] != null)
    ? DIMENSIONES_V2
    : DIMENSIONES_V1;
}

function BarraMatch({
  r,
  mejor,
  elegido,
}: {
  r: RecomendacionDetalle;
  mejor: boolean;
  elegido: boolean;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(r.match_score ?? 0)));
  const d = (r.match_desglose ?? {}) as Record<string, number | undefined>;
  // Barra SEGMENTADA, no una sola barra de relleno. Como las 4 dimensiones suman
  // exactamente 100, cada tramo se dibuja a su ancho real y el asesor ve de
  // dónde sale el número: dos proyectos con el mismo 72 pueden tenerlo por
  // motivos opuestos, y eso cambia lo que le dice al cliente.
  const segmentos = dimensionesDe(d).map((dim) => ({
    ...dim,
    valor: Math.max(0, Number(d[dim.clave] ?? 0)),
  }));

  return (
    <li className={`as-rec${mejor ? " as-rec--top" : ""}${elegido ? " as-rec--elegido" : ""}`}>
      <div className="as-rec__cab">
        <span className="as-rec__nombre">
          {r.url_ficha ? (
            <a href={r.url_ficha} target="_blank" rel="noreferrer">
              {r.nombre_proyecto}
            </a>
          ) : (
            r.nombre_proyecto
          )}
          {elegido && <span className="as-rec__elegido">elegido</span>}
        </span>
        <span className="as-rec__precio">{pesosCortos(r.precio_desde_cop)}</span>
        <span className="as-rec__score">{pct}</span>
      </div>

      <div
        className="as-rec__barra"
        role="img"
        aria-label={`Coincidencia ${pct} de 100: ${segmentos
          .map((x) => `${x.etiqueta} aporta ${Math.round(x.valor)} puntos`)
          .join(", ")}`}
      >
        {segmentos.map((x) => (
          <span
            key={x.clave}
            className={`as-seg as-seg--${x.clave}`}
            style={{ width: `${x.valor}%` }}
            title={`${x.etiqueta}: ${Math.round(x.valor)} puntos de ${pct}`}
          />
        ))}
      </div>

      <div className="as-rec__leyenda">
        {segmentos.map((x) => (
          <span key={x.clave} className="as-leyenda">
            <i className={`as-seg as-seg--${x.clave}`} />
            {x.etiqueta} <b>{Math.round(x.valor)}</b>
          </span>
        ))}
      </div>
    </li>
  );
}

function BloqueSensible({ lead }: { lead: Lead }) {
  // Colapsado por defecto: que ver estos datos sea un acto deliberado del
  // asesor y no algo que ocurre por tener la pantalla abierta al lado de otra
  // persona. No es seguridad real (el dato ya está en el cliente), es higiene.
  const [abierto, setAbierto] = useState(false);
  const d = lead.resultadoDapta;
  if (!d) return null;

  const campos: Array<[string, string]> = [
    ["Ahorros y cesantías declarados", oGuion(d.ahorros_cesantias_declarado)],
    ["Vivienda a nombre propio o herencia", oGuion(d.vivienda_nombre_propio_o_herencia)],
    ["Incluye primas en el plan de pago", siNo(d.primas_incluidas_plan_pago)],
    ["Incluye cesantías futuras", siNo(d.cesantias_futuras_incluidas)],
  ];
  const hayAlgo = campos.some(([, v]) => v !== "—");

  return (
    <section className="as-sensible">
      <button
        type="button"
        className="as-sensible__cab"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
      >
        <span className="as-sensible__candado" aria-hidden>
          &#128274;
        </span>
        <span className="as-sensible__titulo">
          Información financiera sensible
          <span className="as-sensible__nota">
            Declarada en conversación · trátala con reserva
          </span>
        </span>
        <span className="as-sensible__toggle">{abierto ? "Ocultar" : "Mostrar"}</span>
      </button>
      {abierto && (
        <div className="as-sensible__cuerpo">
          {hayAlgo ? (
            <dl className="as-dl as-dl--sensible">
              {campos.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="as-vacio">No se capturaron datos financieros en esta llamada.</p>
          )}
        </div>
      )}
    </section>
  );
}

function Timeline({ lead }: { lead: Lead }) {
  const hitos = lead.timeline ?? [];
  if (!hitos.length) return <p className="as-vacio">Sin eventos registrados.</p>;
  return (
    <ol className="as-timeline">
      {hitos.map((h, i) => (
        <li key={`${h.pieza}-${i}`} className={`as-timeline__item as-timeline__item--${h.estado}`}>
          <div className="as-timeline__marca" aria-hidden />
          <div>
            <div className="as-timeline__nota">{h.nota ?? h.pieza}</div>
            <div className="as-timeline__ts">
              {antiguedad(h.timestamp)}
              {/* Los eventos viejos no traen hora propia. Decirlo evita que el
                  asesor lea como exacta una hora que en realidad es la de la fila. */}
              {!h.timestampReal && <span className="as-timeline__aprox"> · hora aproximada</span>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}


/**
 * Qué tiene que hacer el asesor con ESTE lead, ahora.
 *
 * El nivel (caliente/tibio/frío) dice cuánta prioridad tiene, no qué hacer. Un
 * tibio con cita el lunes y un tibio que no dejó fecha necesitan acciones
 * opuestas, y hasta ahora la ficha los mostraba igual: el asesor tenía que
 * reconstruirlo leyendo cuatro bloques distintos.
 */
function accionConcreta(lead: Lead): { titulo: string; detalle: string; urgencia: "alta" | "media" | "baja" } {
  const d = lead.resultadoDapta;
  const nivel = nivelDe(lead);

  if (nivel === "sin_respuesta") {
    return {
      titulo: "No contestó — vuelve a intentarlo",
      detalle: `La llamada no conectó (${oGuion(d?.disconnection_reason)}). Reintenta por teléfono o escríbele por WhatsApp.`,
      urgencia: "media",
    };
  }
  if (lead.agendadoPara && esPasado(lead.agendadoPara)) {
    return {
      titulo: "La cita ya pasó — reagenda",
      detalle: `Estaba para ${fechaHora(lead.agendadoPara)}${d?.modalidad_agendada ? ` (${d.modalidad_agendada})` : ""}. Llama para reprogramar antes de que se enfríe.`,
      urgencia: "alta",
    };
  }
  if (lead.agendadoPara) {
    return {
      titulo: "Confirma la cita",
      detalle: `${fechaHora(lead.agendadoPara)}${d?.modalidad_agendada ? ` · ${d.modalidad_agendada}` : ""}. Confírmala y prepara el proyecto del que habló con Manuela.`,
      urgencia: "alta",
    };
  }
  if (d?.disponible_visita) {
    return {
      titulo: "Aceptó asesoría, pero no quedó fecha",
      detalle: "Dijo que sí a un siguiente paso y la llamada terminó sin agendar. Es el caso más fácil de cerrar: solo falta poner día y hora.",
      urgencia: "alta",
    };
  }
  const porNivel: Record<Calificacion, { titulo: string; detalle: string; urgencia: "alta" | "media" | "baja" }> = {
    caliente: { titulo: "Llámalo hoy", detalle: "Tiene intención y respaldo. Cuanto antes lo llames, mejor.", urgencia: "alta" },
    tibio: { titulo: "Dale seguimiento esta semana", detalle: "Hay interés pero falta resolver algo. Mira abajo qué fue.", urgencia: "media" },
    frio: { titulo: "Baja prioridad", detalle: "No mostró intención real de avanzar ahora. Vale para una campaña más adelante.", urgencia: "baja" },
  };
  return porNivel[nivel as Calificacion];
}

function Detalle({ lead }: { lead: Lead }) {
  const s = lead.senal ?? ({} as Lead["senal"]);
  const d = lead.resultadoDapta;
  const nivel = nivelDe(lead);
  const accion = accionConcreta(lead);
  // El proyecto que la persona ELIGIÓ va primero aunque no sea el mejor
  // puntuado: es del que habló con Manuela y del que va a hablar el asesor.
  // Verlo en tercera posición obligaba a buscarlo en la lista.
  const recs = [...(lead.recomendacionesDetalle ?? [])]
    .sort((a, b) => {
      const ea = esElElegido(a, lead.senal?.proyecto_elegido) ? 1 : 0;
      const eb = esElElegido(b, lead.senal?.proyecto_elegido) ? 1 : 0;
      if (ea !== eb) return eb - ea;
      return (b.match_score ?? 0) - (a.match_score ?? 0);
    })
    .slice(0, 4);
  const entorno = Array.isArray(s.entorno_deseado)
    ? s.entorno_deseado
    : s.entorno_deseado
      ? [s.entorno_deseado]
      : [];

  return (
    <div className="as-detalle">
      {d?._simulado && (
        <div className="as-aviso">
          Esta conversación fue <strong>generada para la demo</strong>, no es una llamada real.
        </div>
      )}

      {/* 1 + 2 — identidad y nivel, lo primero que se lee */}
      <header className="as-cab">
        <div className="as-cab__izq">
          <div className={`as-avatar as-avatar--${nivel}`} aria-hidden>
            {iniciales(lead)}
          </div>
          <div>
            <h2 className="as-cab__nombre">{nombreDe(lead)}</h2>
            <div className="as-cab__contacto">
              <a href={`tel:${s.telefono_movil ?? ""}`}>{oGuion(s.telefono_movil)}</a>
              <span aria-hidden>·</span>
              <a href={`mailto:${s.correo ?? ""}`}>{oGuion(s.correo)}</a>
            </div>
            <div className="as-cab__origen">
              Entró {antiguedad(lead.createdAt)} por {oGuion(lead.canal_origen)}
            </div>
          </div>
        </div>
        <div className="as-cab__der">
          <div className={`as-badge as-badge--${nivel}`}>
            {nivel === "sin_respuesta" ? "Sin respuesta" : ETIQUETA_NIVEL[nivel as Calificacion]}
          </div>
          <div className="as-badge__accion">
            {nivel === "sin_respuesta"
              ? "No contestó — reintentar o WhatsApp"
              : ACCION_NIVEL[nivel as Calificacion]}
          </div>
        </div>
      </header>

      {/* Acciones directas: el asesor abre esta ficha para HACER algo, y lo que
          hace es llamar. Tenerlo a un clic evita el copiar-pegar del número,
          que es donde se cuelan los errores de digitación. */}
      <div className="as-acciones">
        <a className="as-btn as-btn--primario" href={`tel:${s.telefono_movil ?? ""}`}>
          Llamar
        </a>
        <a
          className="as-btn"
          href={`https://wa.me/${(s.telefono_movil ?? "").replace(/\D/g, "")}`}
          target="_blank"
          rel="noreferrer"
        >
          WhatsApp
        </a>
        <a className="as-btn" href={`mailto:${s.correo ?? ""}`}>
          Correo
        </a>
        {lead.agendadoPara && (
          <span className={`as-cita${esPasado(lead.agendadoPara) ? " as-cita--vencida" : ""}`}>
            {esPasado(lead.agendadoPara) ? "Cita vencida:" : "Cita:"}{" "}
            {fechaHora(lead.agendadoPara)}
          </span>
        )}
      </div>

      {/* BRIEF — lo que el asesor necesita ANTES de marcar, en un solo sitio y
          en el orden en que se lo pregunta: qué hago, por qué, qué dijo, de qué
          proyecto hablaron. Antes estaba repartido en cuatro bloques. */}
      <section className="as-brief" data-urgencia={accion.urgencia}>
        <header className="as-brief__cab">
          <span className="as-brief__kicker">Brief</span>
          <h3 className="as-brief__titulo">{accion.titulo}</h3>
          <p className="as-brief__detalle">{accion.detalle}</p>
        </header>

        <div className="as-brief__grid">
          <div className="as-brief__item">
            <span className="as-brief__lbl">Por qué quedó en {nivel === "sin_respuesta" ? "sin respuesta" : ETIQUETA_NIVEL[nivel as Calificacion].toLowerCase()}</span>
            <p className="as-brief__txt">
              {oGuion(d?.justificacion_calificacion) === "—" && nivel === "sin_respuesta"
                ? `La llamada no conectó (${oGuion(d?.disconnection_reason)}).`
                : oGuion(d?.justificacion_calificacion)}
            </p>
          </div>

          <div className="as-brief__item">
            <span className="as-brief__lbl">Qué dijo en la llamada</span>
            <p className="as-brief__txt">{oGuion(d?.resumen_llamada)}</p>
          </div>

          {s.proyecto_elegido && (
            <div className="as-brief__item as-brief__item--proyecto">
              <span className="as-brief__lbl">El proyecto del que hablaron</span>
              <p className="as-brief__txt as-brief__txt--fuerte">{s.proyecto_elegido}</p>
            </div>
          )}
        </div>
      </section>

      {/* 1 — perfil */}
      <section className="as-bloque">
        <h3 className="as-h3">Perfil</h3>
        <dl className="as-dl">
          <div>
            <dt>Edad</dt>
            <dd>{s.edad != null ? `${s.edad} años` : "—"}</dd>
          </div>
          <div>
            <dt>Personas a cargo</dt>
            <dd>{s.personas_a_cargo ?? "—"}</dd>
          </div>
          <div>
            <dt>Zona de interés</dt>
            <dd>{oGuion(s.zona_interes)}</dd>
          </div>
          <div>
            <dt>Tipo de vivienda</dt>
            <dd>{s.tipo_vivienda === "no_vis" ? "No VIS" : "VIS"}</dd>
          </div>
          <div>
            <dt>Afiliado</dt>
            <dd>{siNo(s.afiliado)}</dd>
          </div>
          <div>
            <dt>Ingresos del hogar</dt>
            <dd>{oGuion(s.ingresos_hogar_rango)}</dd>
          </div>
          <div>
            <dt>Piso preferido</dt>
            <dd>{typeof s.piso_preferido === "number" ? PISO_LABEL[s.piso_preferido] : "—"}</dd>
          </div>
          <div>
            <dt>Proyecto elegido</dt>
            <dd>{oGuion(s.proyecto_elegido)}</dd>
          </div>
        </dl>
        {entorno.length > 0 && (
          <div className="as-tags">
            {entorno.map((e) => (
              <span key={e} className="as-tag">
                {e}
              </span>
            ))}
          </div>
        )}
      </section>


      {/* 6 — disponibilidad */}
      <section className="as-bloque">
        <h3 className="as-h3">Disponibilidad</h3>
        <dl className="as-dl">
          <div>
            <dt>Aceptó visita o asesoría</dt>
            <dd>{siNo(d?.disponible_visita)}</dd>
          </div>
          <div>
            <dt>Modalidad</dt>
            <dd>{oGuion(d?.modalidad_agendada)}</dd>
          </div>
          <div className="as-dl__ancho">
            <dt>Cita acordada</dt>
            <dd>
              {lead.agendadoPara ? (
                <>
                  {fechaHora(lead.agendadoPara)}
                  {esPasado(lead.agendadoPara) && <span className="as-vencida"> · ya pasó</span>}
                </>
              ) : (
                // Puede haber acuerdo verbal sin fecha interpretable: se muestra
                // el texto crudo antes que decir "sin cita" y perder el dato.
                oGuion(d?.fecha_hora_agendada)
              )}
            </dd>
          </div>
        </dl>
      </section>

      {/* 4 — sensibles, aparte y colapsado */}
      <BloqueSensible lead={lead} />

      {/* 5 — recomendaciones con score */}
      <section className="as-bloque">
        <h3 className="as-h3">
          Proyectos recomendados
          <span className="as-h3__nota">coincidencia sobre 100</span>
        </h3>
        {recs.length ? (
          <>
            <ul className="as-recs">
              {recs.map((r, i) => (
                <BarraMatch
                  key={r.nombre_proyecto}
                  r={r}
                  mejor={i === 0}
                  elegido={esElElegido(r, s.proyecto_elegido)}
                />
              ))}
            </ul>
            {/* Que la persona elija algo fuera del top no es un fallo del
                modelo: es información. El asesor debe saber que va a hablar de
                un proyecto que el sistema no habría propuesto primero. */}
            {s.proyecto_elegido &&
              !recs.some((r) => esElElegido(r, s.proyecto_elegido)) && (
                <p className="as-nota-elegido">
                  Eligió <strong>{s.proyecto_elegido}</strong>, que no está entre
                  los mejores puntuados para su perfil.
                </p>
              )}
          </>
        ) : (
          <p className="as-vacio">Sin recomendaciones calculadas para este lead.</p>
        )}
      </section>

      {/* 7 — recorrido */}
      <section className="as-bloque">
        <h3 className="as-h3">Recorrido del lead</h3>
        <Timeline lead={lead} />
      </section>
    </div>
  );
}

// --------------------------------------------------------------------------- //
export function AsesorView({ leads }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionId, setSeleccionId] = useState<string | null>(null);

  // Solo leads que ya pasaron por Dapta: un lead que aún llena el formulario no
  // es trabajo del asesor y lo único que haría es diluir su bandeja.
  const contactados = useMemo(
    () => leads.filter((l) => l.resultadoDapta != null),
    [leads],
  );

  const conteos = useMemo(() => {
    const c: Record<Filtro, number> = {
      todos: contactados.length,
      caliente: 0,
      tibio: 0,
      frio: 0,
      sin_respuesta: 0,
    };
    for (const l of contactados) c[nivelDe(l)] += 1;
    return c;
  }, [contactados]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return contactados
      .filter((l) => (filtro === "todos" ? true : nivelDe(l) === filtro))
      .filter((l) => {
        if (!q) return true;
        const s = l.senal ?? ({} as Lead["senal"]);
        return [nombreDe(l), s.telefono_movil, s.zona_interes, s.proyecto_elegido]
          .filter(Boolean)
          .some((campo) => String(campo).toLowerCase().includes(q));
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [contactados, filtro, busqueda]);

  // La selección se resuelve contra la lista viva: si el lead seleccionado deja
  // de estar visible (cambió el filtro), se cae al primero en vez de dejar el
  // panel en blanco.
  const seleccionado =
    visibles.find((l) => l.id === seleccionId) ?? visibles[0] ?? null;

  const FILTROS: Array<[Filtro, string]> = [
    ["todos", "Todos"],
    ["caliente", "Calientes"],
    ["tibio", "Tibios"],
    ["frio", "Fríos"],
    ["sin_respuesta", "Sin respuesta"],
  ];

  return (
    <div className="as-wrap">
      <aside className="as-lista">
        <div className="as-lista__cab">
          {/* Reparto del embudo: dice de un vistazo cómo va la cosecha del día
              antes de entrar a ningún lead en concreto. */}
          <div className="as-embudo">
            {(["caliente", "tibio", "frio", "sin_respuesta"] as const).map((n) => (
              <div key={n} className="as-embudo__celda">
                <span className={`as-embudo__n as-embudo__n--${n}`}>{conteos[n]}</span>
                <span className="as-embudo__lbl">
                  {n === "sin_respuesta" ? "s/resp." : ETIQUETA_NIVEL[n]}
                </span>
              </div>
            ))}
          </div>
          <input
            className="as-buscar"
            type="search"
            placeholder="Buscar por nombre, teléfono, zona…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar leads"
          />
          <div className="as-filtros" role="tablist">
            {FILTROS.map(([id, etiqueta]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filtro === id}
                className={`as-filtro${filtro === id ? " as-filtro--on" : ""}`}
                onClick={() => setFiltro(id)}
              >
                {etiqueta}
                <span className="as-filtro__n">{conteos[id]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="as-lista__scroll">
          {visibles.length ? (
            visibles.map((l) => (
              <FilaLead
                key={l.id}
                lead={l}
                activo={seleccionado?.id === l.id}
                onClick={() => setSeleccionId(l.id)}
              />
            ))
          ) : (
            <p className="as-vacio as-vacio--lista">
              {contactados.length
                ? "Ningún lead coincide con este filtro."
                : "Todavía no hay leads contactados por Manuela."}
            </p>
          )}
        </div>
      </aside>

      <main className="as-panel">
        {seleccionado ? (
          <Detalle key={seleccionado.id} lead={seleccionado} />
        ) : (
          <div className="as-panel__vacio">
            <p>Selecciona un lead para ver su ficha de traspaso.</p>
          </div>
        )}
      </main>
    </div>
  );
}
