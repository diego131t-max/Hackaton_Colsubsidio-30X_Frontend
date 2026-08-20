/**
 * FLIP para las tarjetas del tablero.
 *
 * POR QUE NO BASTA UNA TRANSICION CSS
 * Cuando un lead pasa de una etapa a otra, React lo desmonta de una columna y
 * lo monta en otra. Para el navegador son dos elementos distintos: no hay nada
 * que interpolar y la tarjeta "salta". Eso es justo el momento que el asesor
 * necesita ver — es la unica señal de que el sistema esta vivo.
 *
 * FLIP resuelve el salto midiendo la posicion ANTES del cambio (First),
 * dejando que React pinte la nueva (Last), calculando la diferencia (Invert) y
 * animando desde ahi hasta cero (Play).
 */
import { useLayoutEffect, useRef } from "react";

const DURACION = 620;
const CURVA = "cubic-bezier(0.22, 0.9, 0.28, 1)";

/**
 * @param contenedor  raiz donde viven los elementos con [data-flip-id]
 * @param dependencia valor que cambia cuando el tablero se reordena
 */
export function useFlip(
  contenedor: React.RefObject<HTMLElement | null>,
  dependencia: string,
) {
  const previas = useRef(new Map<string, DOMRect>());

  useLayoutEffect(() => {
    const raiz = contenedor.current;
    if (!raiz) return;

    // Respetar a quien pidio menos movimiento: la animacion es decorativa y
    // puede provocar mareo. La informacion se ve igual sin ella.
    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const nodos = Array.from(
      raiz.querySelectorAll<HTMLElement>("[data-flip-id]"),
    );
    const actuales = new Map<string, DOMRect>();

    for (const nodo of nodos) {
      const id = nodo.dataset.flipId!;
      const rect = nodo.getBoundingClientRect();
      actuales.set(id, rect);

      const antes = previas.current.get(id);
      if (!antes || sinMovimiento) continue;

      const dx = antes.left - rect.left;
      const dy = antes.top - rect.top;
      // Un pixel de diferencia no es un movimiento: es el layout respirando.
      if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;

      nodo.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.85 },
          { transform: "translate(0, 0)", opacity: 1 },
        ],
        { duration: DURACION, easing: CURVA },
      );
      // Marca visual del salto: el borde se enciende mientras viaja.
      nodo.classList.add("tarjeta--viajando");
      window.setTimeout(() => nodo.classList.remove("tarjeta--viajando"), DURACION);
    }

    previas.current = actuales;
  }, [contenedor, dependencia]);
}
