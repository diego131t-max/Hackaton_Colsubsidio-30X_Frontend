/**
 * ActivityLog — registro de actividad NARRADO.
 *
 * Convierte cada evento del pipeline en una frase legible ("Laura Martínez →
 * Clustering: agrupada en VIS-Norte"). Es lo que hace que la operación se
 * ENTIENDA en vez de verse como movimiento aleatorio.
 */

// Tiempo relativo y no `hora`: el registro mezcla eventos de hace minutos con
// otros de hace semanas, y "01:04 a.m." no distingue cuál es cuál.
import { antiguedad } from "../utils";

export interface EntradaLog {
  id: string;
  ts: number;
  texto: string;
  tono: "info" | "ok" | "error";
}

interface Props {
  entradas: EntradaLog[];
}

export function ActivityLog({ entradas }: Props) {
  return (
    <div className="card">
      <div className="card__head">
        <span className="card__title">Registro de actividad</span>
        <span className="card__hint">qué está pasando, en vivo</span>
      </div>

      {entradas.length === 0 ? (
        <p className="empty">Sin actividad todavía…</p>
      ) : (
        <ul className="log">
          {entradas.map((e, i) => {
            // El texto llega como "Nombre: lo que paso". Separarlo permite dar
            // peso al nombre, que es por donde el ojo busca en una lista larga.
            const corte = e.texto.indexOf(": ");
            const quien = corte > 0 ? e.texto.slice(0, corte) : null;
            const que = corte > 0 ? e.texto.slice(corte + 2) : e.texto;
            return (
              <li
                className="log__row"
                key={e.id}
                data-tono={e.tono}
                style={{ ["--orden" as string]: Math.min(i, 12) }}
              >
                <span className="log__time">{antiguedad(e.ts)}</span>
                <span className="log__dot" />
                <span className="log__text">
                  {quien && <b className="log__quien">{quien}</b>}
                  {que}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
