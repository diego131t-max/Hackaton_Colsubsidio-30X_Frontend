/**
 * ActivityLog — registro de actividad NARRADO.
 *
 * Convierte cada evento del pipeline en una frase legible ("Laura Martínez →
 * Clustering: agrupada en VIS-Norte"). Es lo que hace que la operación se
 * ENTIENDA en vez de verse como movimiento aleatorio.
 */

import { hora } from "../utils";

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
          {entradas.map((e) => (
            <li className="log__row" key={e.id} data-tono={e.tono}>
              <span className="log__time">{hora(e.ts)}</span>
              <span className="log__dot" />
              <span className="log__text">{e.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
