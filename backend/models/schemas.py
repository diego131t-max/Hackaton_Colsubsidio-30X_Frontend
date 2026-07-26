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

from pydantic import BaseModel, Field, field_validator


# =========================================================================== #
# BLOQUE A — Señal del bowl
# =========================================================================== #
# ESTO ES EXACTAMENTE lo que recibe el modelo de clustering como input.
# NO lo cambies sin que Santiago DS lo sepa (es la entrada de su modelo).
# --------------------------------------------------------------------------- #
# Opciones de `entorno_deseado` (amenidades) — set definido por el equipo del
# formulario (Carlos). El front las muestra como multi-select; el usuario elige
# varias y llegan como lista. Mantener alineados estos slugs con la UI.
# --------------------------------------------------------------------------- #
# Etiquetas EXACTAS que espera el modelo de recomendaciones de Santiago (hace
# match por string contra el catálogo). Con espacios y tal cual — OJO: "gymnasio"
# (no "gimnasio") y "cancha e padel" (no "de padel"). No slugificar.
ENTORNO_DESEADO_OPCIONES: list[str] = [
    "lobby", "piscina", "zona de lavanderia", "zona bbq", "zona pet", "zona kid",
    "locales comerciales", "zona fitness", "salon social", "spa mascotas",
    "zona cool", "zona cine", "coworking", "sala vip", "zona cafe", "gymnasio",
    "parqueadero", "zona verde", "parque", "sala de juegos", "pista de trote",
    "voleibol playa", "cancha e padel", "taller de bicicletas", "sauna",
]

# Piso preferido: el front muestra bajo/medio/alto; el valor viaja como 1/2/3.
PISO_PREFERIDO_LABELS = {1: "bajo", 2: "medio", 3: "alto"}


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
    # 1=bajo, 2=medio, 3=alto (ver PISO_PREFERIDO_LABELS). Tolera "bajo"/"medio"/
    # "alto"/"sin_preferencia" por compatibilidad con el front actual.
    piso_preferido: Literal[1, 2, 3] | None = None
    tipo_inmueble: Literal["apartamento", "casa", "sin_preferencia"] | None = None
    # LISTA de amenidades (ver ENTORNO_DESEADO_OPCIONES). Acepta también un solo
    # string (se envuelve en lista) por compatibilidad con el front actual.
    entorno_deseado: list[str] | None = None

    # Proyecto que la persona ELIGIÓ tras ver las recomendaciones (se envía en la
    # confirmación final; Dapta hablará de este proyecto). Opcional: en el primer
    # POST a /recomendaciones aún no existe.
    proyecto_elegido: str | None = None

    # --- Compatibilidad / normalización -------------------------------------- #
    @field_validator("piso_preferido", mode="before")
    @classmethod
    def _norm_piso(cls, v: object) -> object:
        if v is None or isinstance(v, bool):
            return None
        if isinstance(v, int):
            return v
        if isinstance(v, str):
            t = v.strip().lower()
            mapa = {"bajo": 1, "medio": 2, "alto": 3, "1": 1, "2": 2, "3": 3}
            if t in mapa:
                return mapa[t]
            if t in ("", "sin_preferencia", "sin preferencia", "null", "none"):
                return None
        return v

    @field_validator("entorno_deseado", mode="before")
    @classmethod
    def _norm_entorno(cls, v: object) -> object:
        if v is None:
            return None
        if isinstance(v, str):
            t = v.strip()
            return [t] if t else None
        if isinstance(v, (list, tuple)):
            items = [str(x).strip() for x in v if str(x).strip()]
            return items or None
        return v


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

    # Motivo de desconexión que envía Dapta (no_answer, voicemail, completed…).
    # Campo extra respecto al contrato original; lo aceptamos para tener contexto.
    disconnection_reason: str | None = None

    # Datos sensibles/financieros finos, capturados en conversación, no en el
    # formulario:
    ahorros_cesantias_declarado: str | None = None
    vivienda_nombre_propio_o_herencia: str | None = None
    primas_incluidas_plan_pago: bool | None = None
    cesantias_futuras_incluidas: bool | None = None
    disponible_visita: bool | None = None
    resumen_llamada: str

    # --- Blindaje de contrato (defensa ante lo que mande el agente de voz) --- #
    @field_validator("calificacion_lead", mode="before")
    @classmethod
    def _normalizar_calificacion(cls, v: object) -> object:
        """Tolera 'frío' con tilde y mayúsculas -> canoniza a 'frio'/'tibio'/'caliente'."""
        if isinstance(v, str):
            t = v.strip().lower()
            for a, b in (("í", "i"), ("é", "e"), ("á", "a"), ("ó", "o"), ("ú", "u")):
                t = t.replace(a, b)
            return t
        return v

    @field_validator(
        "primas_incluidas_plan_pago",
        "cesantias_futuras_incluidas",
        "disponible_visita",
        mode="before",
    )
    @classmethod
    def _coercionar_bool(cls, v: object) -> object:
        """Acepta 'Sí'/'No' (y variantes) además de booleanos reales."""
        if isinstance(v, str):
            t = v.strip().lower()
            if t in {"sí", "si", "true", "1", "yes", "y", "verdadero"}:
                return True
            if t in {"no", "false", "0", "n", "falso"}:
                return False
            if t in {"", "none", "null", "n/a", "na"}:
                return None
        return v


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
