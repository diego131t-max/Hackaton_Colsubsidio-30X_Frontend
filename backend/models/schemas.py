"""
Contrato de datos único del sistema — Reto Vivienda Colsubsidio x 30X.

Pieza del sistema: BACKEND (modelos compartidos).

Este es el CORAZÓN de todo. Es el contrato acordado por el equipo que
construye en paralelo (Carlos/frontend, backend de reglas, Santiago/clustering,
Juan/Dapta).

REGLA DE ORO: nadie agrega un campo nuevo a estos modelos sin avisar en el
grupo. Si el frontend necesita capturar algo nuevo en el bowl, primero se
agrega aquí, luego se implementa — nunca al revés.

CRITERIO DE QUÉ PREGUNTA VA DÓNDE (decisión del equipo):
  - Si el dato ayuda a personalizar/agrupar (clustering) -> va en el bowl,
    aunque sea "de gustos".
  - Si el dato solo sirve para calificación financiera fina, o es sensible /
    incómodo de dar por escrito -> va a la llamada de Dapta.

Fuente: sección 4 del esquema del sistema (docs/contrato-de-datos.md).
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field


# =========================================================================== #
# BLOQUE A — Señal del bowl
# =========================================================================== #
# ESTO ES EXACTAMENTE lo que recibe el modelo de clustering como input.
# NO lo cambies sin que Santiago DS lo sepa (es la entrada de su modelo).
# =========================================================================== #
class SenalBowl(BaseModel):
    """Payload que el bowl (frontend) hace POST a `POST /leads`."""

    # Selector de entrada
    tipo_vivienda: Literal["vis", "no_vis"]

    # Identificación
    nombre: str
    apellido: str
    correo: str
    telefono_movil: str  # crítico - sin esto Dapta no puede llamar

    # Elegibilidad básica
    afiliado: bool
    ingresos_hogar_rango: str  # rango, no cifra exacta

    # Señales de personalización / clustering
    edad: int
    personas_a_cargo: int
    zona_interes: str
    piso_preferido: str | None = None
    tipo_inmueble: Literal["apartamento", "casa", "sin_preferencia"] | None = None
    # ej. "cerca a colegio", "zona verde", "cerca al trabajo".
    # NO es un dropdown de proyectos específicos si el bowl es buscador general.
    entorno_deseado: str | None = None


# =========================================================================== #
# BLOQUE B — Resultado de la llamada/WhatsApp de Dapta
# =========================================================================== #
# Esto llega DESPUÉS, vía el webhook de resultado (POST /webhooks/dapta/resultado),
# NUNCA del bowl. Contiene los datos sensibles/financieros finos capturados en
# conversación.
# =========================================================================== #
class ResultadoCalificacionDapta(BaseModel):
    call_id: str
    call_status: str
    calificacion_lead: Literal["caliente", "tibio", "frio"]

    # Datos sensibles/financieros finos, capturados en conversación, no en el
    # formulario:
    ahorros_cesantias_declarado: str | None = None
    vivienda_nombre_propio_o_herencia: str | None = None
    primas_incluidas_plan_pago: bool | None = None
    cesantias_futuras_incluidas: bool | None = None
    disponible_visita: bool | None = None
    resumen_llamada: str


# =========================================================================== #
# BLOQUE C — Campos ELIMINADOS del contrato
# =========================================================================== #
# NO agregar de vuelta sin discutirlo con el equipo:
#   - "ingresos_familiares": duplicado exacto de ingresos_hogar_rango.
#   - "¿has recibido subsidios antes?": NO se pregunta, se CONSULTA vía el cruce
#     mock con Ministerio de Vivienda (ver backend/core/external_mocks.py, H2).
#     Preguntarlo repetiría el problema original que este reto busca corregir.
# =========================================================================== #


# =========================================================================== #
# Resultado del clustering (salida del puerto clustering_client.predecir_cluster)
# =========================================================================== #
class ResultadoClustering(BaseModel):
    """Lo que devuelve el modelo de clustering al backend."""

    cluster_id: str
    proyectos_recomendados: list[str] = Field(default_factory=list)


# =========================================================================== #
# Ficha de traspaso al asesor humano (H9) — producto final del backend
# =========================================================================== #
class FichaTraspaso(BaseModel):
    """
    Resultado final que recibe el ASESOR HUMANO (pieza 5 del sistema).

    La arma `core/handoff_card.py` combinando el motor de reglas, el clustering
    y el resultado de calificación de Dapta.

    Los campos SENSIBLES (ahorros, herencia, primas) viven aquí — en la ficha
    final — y nunca antes en el pipeline.
    """

    lead_id: UUID
    nombre_completo: str
    telefono_movil: str

    # Del motor de reglas + clustering
    cluster_id: str | None = None
    proyectos_recomendados: list[str] = Field(default_factory=list)
    beneficios_aplicables: list[str] = Field(default_factory=list)

    # Del resultado de Dapta (llega por webhook, después)
    calificacion_lead: Literal["caliente", "tibio", "frio"] | None = None
    resultado_dapta: ResultadoCalificacionDapta | None = None

    resumen: str = ""


# =========================================================================== #
# Contrato v1 (LEGACY) — se conserva porque `core/rules_engine.py` (H1-H10) lo
# importa. No lo borres sin migrar el motor de reglas.
# =========================================================================== #
class TipoProyecto(str, Enum):
    VIS = "vis"
    NO_VIS = "no_vis"


class TipoAfiliacion(str, Enum):
    """H1 — 3 categorías."""

    AFILIADO_TRABAJADOR = "afiliado_trabajador"
    BENEFICIARIO = "beneficiario"
    NO_AFILIADO = "no_afiliado"


class Urgencia(str, Enum):
    ALTA = "alta"
    MEDIA = "media"
    BAJA = "baja"


class Identificacion(BaseModel):
    nombre: str
    apellidos: str
    tipo_identificacion: str
    numero_identificacion: str
    correo: str  # TODO: validar formato de correo si se añade email-validator
    telefono: str


class Afiliacion(BaseModel):
    tipo: TipoAfiliacion


class Financiero(BaseModel):
    ingreso_rango_declarado: str
    ingreso_estimado_numerico: float


class Preferencias(BaseModel):
    zona_interes: str
    urgencia: Urgencia
    personas_a_cargo: int = Field(..., ge=0)


class SenalesComportamiento(BaseModel):
    tiempo_total_bowl_segundos: float = Field(..., ge=0)
    pasos_completados: int = Field(..., ge=0)
    abandono_en_paso: Optional[str] = None


class PerfilLead(BaseModel):
    """Contrato v1 legacy usado por el motor de reglas (H1-H10)."""

    lead_id: UUID
    timestamp: datetime
    canal_origen: str
    proyecto_interes: str
    tipo_proyecto: TipoProyecto

    identificacion: Identificacion
    afiliacion: Afiliacion
    financiero: Financiero
    preferencias: Preferencias
    senales_comportamiento: SenalesComportamiento = Field(
        ..., alias="señales_comportamiento"
    )

    model_config = {"populate_by_name": True, "use_enum_values": True}
