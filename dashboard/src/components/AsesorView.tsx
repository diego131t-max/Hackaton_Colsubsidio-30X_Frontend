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
  const d = r.match_desglose ?? {};
  // El desglose explica el número: sin él, "72" es una cifra que el asesor no
  // puede defender si el cliente pregunta "¿por qué este proyecto?".
  const partes = [
    ["Entorno", d.entorno, 50],
    ["Capacidad", d.capacidad, 20],
    ["Asequibilidad", d.asequibilidad, 18],
    ["Beneficio caja", d.beneficio_caja, 12],
  ] as const;

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
        <span className="as-rec__score">{pct}</span>
      </div>
      <div className="as-rec__barra" role="img" aria-label={`Coincidencia ${pct} de 100`}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="as-rec__pie">
        <span>{pesosCortos(r.precio_desde_cop)}</span>
        <span className="as-rec__desglose">
          {partes
            .filter(([, v]) => v != null)
            .map(([etiqueta, v, tope]) => `${etiqueta} ${Math.round(v as number)}/${tope}`)
            .join(" · ") || "sin desglose"}
        </span>
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

function Detalle({ lead }: { lead: Lead }) {
  const s = lead.senal ?? ({} as Lead["senal"]);
  const d = lead.resultadoDapta;
  const nivel = nivelDe(lead);
  const recs = (lead.recomendacionesDetalle ?? []).slice(0, 4);
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

      {/* Justificación del nivel: una línea, pegada al badge */}
      <p className="as-justificacion">
        {oGuion(d?.justificacion_calificacion) === "—" && nivel === "sin_respuesta"
          ? `La llamada no conectó (${oGuion(d?.disconnection_reason)}).`
          : oGuion(d?.justificacion_calificacion)}
      </p>

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

      {/* 3 — resumen ejecutivo de la llamada */}
      <section className="as-bloque">
        <h3 className="as-h3">Resumen de la llamada</h3>
        {d?.resumen_llamada ? (
          <p className="as-resumen">{d.resumen_llamada}</p>
        ) : (
          <p className="as-vacio">
            Todavía no hay resumen: la llamada no se ha completado.
          </p>
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
