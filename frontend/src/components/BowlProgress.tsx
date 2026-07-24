/**
 * BowlProgress — indicador de progreso del bowl.
 *
 * Pieza del sistema: FRONTEND (Carlos).
 *
 * Muestra cuántos ingredientes (pasos) lleva el usuario. Alimenta la señal
 * `pasos_completados` del contrato de datos (sección 4).
 *
 * TODOs:
 *  - [ ] Recibir paso actual y total de pasos.
 *  - [ ] Reflejar visualmente el avance (barra / ingredientes servidos).
 */

// TODO(Carlos): implementar el componente.
export interface BowlProgressProps {
  pasoActual: number;
  totalPasos: number;
}

export function BowlProgress(_props: BowlProgressProps) {
  throw new Error("BowlProgress: pendiente de implementar.");
}
