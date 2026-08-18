/**
 * Iconos del tablero — SVG inline, trazo heredado del color del contenedor.
 *
 * POR QUÉ NO EMOJI
 * El emoji lo dibuja la fuente del sistema operativo: cambia de forma entre
 * macOS, Windows y Android, no hereda el color de marca y en una proyección se
 * ve de juguete. Estos son de trazo, usan `currentColor` y por eso se tiñen
 * solos según el estado del nodo o del plugin.
 *
 * Viven en un módulo aparte porque los usan tanto el flujo (piezas del sistema)
 * como el panel de integraciones; tenerlos duplicados en los dos garantizaba
 * que tarde o temprano dejaran de parecerse entre sí.
 */

export type NombreIcono =
  | "bowl"
  | "backend"
  | "clustering"
  | "dapta"
  | "asesor"
  | "supabase"
  | "modelo";

interface Props {
  nombre: string;
  tamano?: number;
}

export function Icono({ nombre, tamano = 26 }: Props) {
  const comun = {
    width: tamano,
    height: tamano,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (nombre) {
    case "bowl": // formulario: la captura de la señal
      return (
        <svg {...comun}>
          <path d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
          <path d="M14 3v5h5M8 13h8M8 17h5" />
        </svg>
      );
    case "backend": // reglas H1–H10
      return (
        <svg {...comun}>
          <rect x="3" y="4" width="18" height="7" rx="1.5" />
          <rect x="3" y="13" width="18" height="7" rx="1.5" />
          <path d="M7 7.5h.01M7 16.5h.01" />
        </svg>
      );
    case "clustering": // agrupa y recomienda
    case "modelo":
      return (
        <svg {...comun}>
          <circle cx="6" cy="7" r="2.4" />
          <circle cx="17.5" cy="5.5" r="2.2" />
          <circle cx="12" cy="17" r="2.6" />
          <path d="M8.2 8.4 10.4 15M15.8 7.3 13.3 14.8M8.3 6.3l6.9-.6" />
        </svg>
      );
    case "dapta": // la llamada de voz
      return (
        <svg {...comun}>
          <path d="M4.5 4.8h3.2l1.6 4-2 1.2a11 11 0 0 0 5.1 5.1l1.2-2 4 1.6v3.2a1.2 1.2 0 0 1-1.3 1.2A15.6 15.6 0 0 1 3.3 6.1 1.2 1.2 0 0 1 4.5 4.8Z" />
          <path d="M15 4.2a5.4 5.4 0 0 1 4.5 4.5" />
        </svg>
      );
    case "supabase": // el almacén
      return (
        <svg {...comun}>
          <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
          <path d="M4.5 5.5v13c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-13" />
          <path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3" />
        </svg>
      );
    default: // asesor: la persona que recibe la ficha
      return (
        <svg {...comun}>
          <circle cx="12" cy="7.5" r="3.2" />
          <path d="M4.8 20.2a7.4 7.4 0 0 1 14.4 0" />
        </svg>
      );
  }
}
