/**
 * Cuenta hasta el valor final cuando el numero cambia.
 *
 * No es adorno: en un panel que se actualiza en vivo, un numero que salta de 26
 * a 27 pasa desapercibido. Contando, el ojo lo persigue. Por eso la duracion es
 * corta y la curva desacelera al final — se nota que cambio sin robar atencion.
 */
import { useEffect, useRef, useState } from "react";

const DURACION = 900;

export function useContador(valor: number): number {
  const [mostrado, setMostrado] = useState(valor);
  const desde = useRef(valor);
  const raf = useRef<number>(0);

  useEffect(() => {
    // Quien pidio menos movimiento ve el numero final directamente.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setMostrado(valor);
      desde.current = valor;
      return;
    }
    const inicio = performance.now();
    const origen = desde.current;
    const delta = valor - origen;
    if (delta === 0) return;

    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / DURACION);
      // easeOutCubic: arranca rapido y frena, que es como se lee un contador.
      const e = 1 - Math.pow(1 - t, 3);
      setMostrado(Math.round(origen + delta * e));
      if (t < 1) raf.current = requestAnimationFrame(paso);
      else desde.current = valor;
    };
    raf.current = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf.current);
  }, [valor]);

  return mostrado;
}
