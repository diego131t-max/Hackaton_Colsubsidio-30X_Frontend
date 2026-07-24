/**
 * BowlStep — un "ingrediente" del bowl.
 *
 * Pieza del sistema: FRONTEND (Carlos).
 *
 * Cada paso del bowl captura una señal del contrato de datos (sección 4).
 * El conjunto de pasos completados arma el PerfilLead que se envía al backend.
 *
 * TODOs:
 *  - [ ] Definir props tipadas por tipo de señal (selección, rango, texto).
 *  - [ ] Emitir el valor capturado al estado global del bowl.
 *  - [ ] Registrar señales de comportamiento (tiempo en el paso, abandono).
 */

// TODO(Carlos): implementar el componente. Este stub solo fija el contrato visual.
export interface BowlStepProps {
  /** Id del paso, alineado a un campo del contrato de datos (sección 4). */
  stepId: string;
  titulo: string;
  onCompletar: (valor: unknown) => void;
}

export function BowlStep(_props: BowlStepProps) {
  // TODO(Carlos): render real del ingrediente del bowl.
  throw new Error("BowlStep: pendiente de implementar.");
}
