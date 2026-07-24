"""
Contrato de datos único del sistema — Reto Vivienda Colsubsidio x 30X.

Pieza del sistema: BACKEND (modelos compartidos).

Este es el CORAZÓN de todo. Es el contrato acordado por las 3 personas que
construyen en paralelo (Carlos/frontend, backend de reglas, Juan/Dapta).

REGLA DE ORO: nadie agrega un campo nuevo a estos modelos sin avisar en el
grupo. Si el frontend necesita capturar algo nuevo en el bowl, primero se
agrega aquí, luego se implementa — nunca al revés.

Fuente: sección 4 del esquema del sistema (docs/contrato-de-datos.md).

TODOs:
  - [ ] Confirmar catálogo cerrado de `tipo_identificacion` con Colsubsidio.
  - [ ] Validar formato de `telefono` con indicativo (Dapta necesita marcar
        sin normalizar de nuevo). Ver E.164.
  - [ ] Añadir validador que derive `ingreso_estimado_numerico` desde
        `ingreso_rango_declarado` si el frontend no lo envía.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# --------------------------------------------------------------------------- #
# Enums / catálogos cerrados
# --------------------------------------------------------------------------- #
class TipoProyecto(str, Enum):
    VIS = "vis"
    NO_VIS = "no_vis"


class TipoAfiliacion(str, Enum):
    """H1 — ahora con 3 categorías, no 2."""

    AFILIADO_TRABAJADOR = "afiliado_trabajador"
    BENEFICIARIO = "beneficiario"
    NO_AFILIADO = "no_afiliado"


class Urgencia(str, Enum):
    ALTA = "alta"
    MEDIA = "media"
    BAJA = "baja"


# --------------------------------------------------------------------------- #
# Sub-modelos del contrato (sección 4)
# --------------------------------------------------------------------------- #
class Identificacion(BaseModel):
    nombre: str
    apellidos: str
    tipo_identificacion: str = Field(
        ..., description="CC | TI | CE | NUIP | ...  (TODO: cerrar catálogo)"
    )
    numero_identificacion: str
    correo: EmailStr
    telefono: str = Field(
        ...,
        description="Con indicativo, listo para que Dapta marque sin re-normalizar.",
    )


class Afiliacion(BaseModel):
    tipo: TipoAfiliacion


class Financiero(BaseModel):
    ingreso_rango_declarado: str = Field(
        ..., description="Ej. '$7.115.001 - $10.000.000'"
    )
    ingreso_estimado_numerico: float = Field(
        ..., description="Para que el motor de reglas calcule (regla 40%)."
    )


class Preferencias(BaseModel):
    zona_interes: str
    urgencia: Urgencia
    personas_a_cargo: int = Field(..., ge=0)


class SenalesComportamiento(BaseModel):
    tiempo_total_bowl_segundos: float = Field(..., ge=0)
    pasos_completados: int = Field(..., ge=0)
    abandono_en_paso: Optional[str] = None


# --------------------------------------------------------------------------- #
# Modelo raíz — lo que el frontend hace POST al backend
# --------------------------------------------------------------------------- #
class PerfilLead(BaseModel):
    """Payload completo que viaja del bowl (frontend) al backend de reglas."""

    lead_id: UUID = Field(..., description="uuid generado por el frontend")
    timestamp: datetime = Field(..., description="ISO-8601")
    canal_origen: str = Field(..., description="Ej. 'pauta_digital'")
    proyecto_interes: str = Field(..., description="Ej. 'Nuva Park'")
    tipo_proyecto: TipoProyecto

    identificacion: Identificacion
    afiliacion: Afiliacion
    financiero: Financiero
    preferencias: Preferencias
    senales_comportamiento: SenalesComportamiento = Field(
        ...,
        alias="señales_comportamiento",
        description="Alias 'señales_comportamiento' para respetar el JSON del contrato.",
    )

    model_config = {
        "populate_by_name": True,  # acepta tanto 'senales_' como 'señales_'
        "use_enum_values": True,
    }


# --------------------------------------------------------------------------- #
# Ficha de traspaso al asesor humano (H9) — la produce el backend
# --------------------------------------------------------------------------- #
class FichaTraspaso(BaseModel):
    """
    Resultado final que recibe el ASESOR HUMANO (pieza 5 del sistema).

    La arma `core/handoff_card.py` combinando el motor de reglas, el
    clustering y el resultado de calificación de Dapta.

    TODO:
      - [ ] Definir escala/umbral de `probabilidad_cierre` junto con
            handoff_card.py (misma lógica que usa Dapta, no inventar otra).
    """

    lead_id: UUID
    nombre_completo: str
    probabilidad_cierre: float = Field(..., ge=0, le=1)
    proyecto_recomendado: str
    beneficios_aplicables: list[str] = Field(default_factory=list)
    resumen_calificacion: str
    cluster_asignado: Optional[str] = None
