/**
 * BowlSummary — resumen final del bowl antes de enviar.
 *
 * Pieza del sistema: FRONTEND (Carlos).
 *
 * Muestra al usuario el "bowl armado" (todas las señales capturadas) y dispara
 * el envío al backend vía api/enviarSenales.ts.
 *
 * TODOs:
 *  - [ ] Renderizar el resumen de las señales capturadas.
 *  - [ ] Construir el objeto PerfilLead conforme al contrato de datos (sección 4).
 *  - [ ] Llamar a enviarSenales() y manejar estados de carga/éxito/error.
 */

// TODO(Carlos): implementar el componente.
export interface BowlSummaryProps {
  onEnviar: () => void;
}

export function BowlSummary(_props: BowlSummaryProps) {
  throw new Error("BowlSummary: pendiente de implementar.");
}
