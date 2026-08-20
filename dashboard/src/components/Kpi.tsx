/**
 * Tarjeta de KPI.
 *
 * Antes eran cuatro rectangulos planos con un numero. Ahora cada una lleva su
 * acento de color, una barra que muestra la proporcion sobre el total y el
 * numero contando: la vista de arriba tiene que leerse en dos segundos, y para
 * eso el color y la proporcion hacen mas que el texto.
 */
import { useContador } from "../useContador";

interface Props {
  valor: number;
  etiqueta: string;
  sub: string;
  /** Proporcion 0..1 sobre el total, para la barra. null = no aplica. */
  proporcion?: number | null;
  tono?: "neutro" | "caliente" | "ok";
  /** Retraso de entrada, para que las cuatro no aparezcan a la vez. */
  orden?: number;
}

export function Kpi({ valor, etiqueta, sub, proporcion, tono = "neutro", orden = 0 }: Props) {
  const n = useContador(valor);
  return (
    <article
      className="kpi"
      data-tono={tono}
      style={{ ["--orden" as string]: orden }}
    >
      <span className="kpi__num">{n.toLocaleString("es-CO")}</span>
      <span className="kpi__lbl">{etiqueta}</span>
      <span className="kpi__sub">{sub}</span>
      {proporcion != null && (
        <span className="kpi__barra" aria-hidden="true">
          <span
            className="kpi__barra-fill"
            style={{ width: `${Math.max(2, Math.min(100, proporcion * 100))}%` }}
          />
        </span>
      )}
    </article>
  );
}
