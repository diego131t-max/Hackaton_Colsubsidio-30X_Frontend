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
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


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
    # Filtro DURO del modelo: es lo ultimo que la escalera de relajacion
    # suelta. El formulario ya lo preguntaba (pregunta sexta del quiz) pero
    # no lo enviaba; sin el, el modelo asume 2 alcobas para todo el mundo.
    numero_habitaciones: Literal[1, 2, 3, 4] | None = None
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
    # Dapta rellena lo que no pudo extraer de DOS formas distintas, ninguna de
    # ellas null. Confirmado en llamadas reales de este workspace:
    #
    #   - campos de texto sin dato  ->  el booleano `false`
    #     (fecha_hora_agendada, ahorros_cesantias_declarado, ...)
    #   - llamada sin contestar     ->  la cadena vacia en TODOS los campos,
    #     incluido calificacion_lead, que es un Literal y la rechaza
    #
    # Sin esta coercion el webhook responde 422 y el lead se queda sin ficha.
    # Y pasaria en la mayoria de las llamadas, porque el caso frecuente no es la
    # conversacion completa: es que no contesten.
    @field_validator(
        "calificacion_lead", "justificacion_calificacion", "fecha_hora_agendada",
        "modalidad_agendada", "ahorros_cesantias_declarado",
        "vivienda_nombre_propio_o_herencia", "resumen_llamada",
        mode="before",
    )
    @classmethod
    def _sin_dato_es_none(cls, v: Any) -> Any:
        # `false` y "" significan "no lo supe". Un `true` en un campo de texto
        # seria un dato corrupto que SI queremos que reviente, no que se cuele
        # convertido en la cadena "True".
        if v is False or (isinstance(v, str) and not v.strip()):
            return None
        return v


    @classmethod
    def desde_webhook(cls, crudo: dict[str, Any]) -> "ResultadoCalificacionDapta":
        """
        Construye el resultado desde el cuerpo REAL del webhook post-call.

        Dapta no manda los campos planos: manda `{"call": {...}}` y mete la
        extraccion dos niveles adentro, en `call.call_analysis
        .custom_analysis_data`. Validar el cuerpo directo contra este modelo
        devolvia 422, Dapta lo interpretaba como entrega fallida y marcaba la
        llamada como `client_webhook_has_already_been_sent: false`. Resultado:
        llamadas reales que ocurrian y nunca llegaban a la base.

        Se sigue aceptando la forma plana: los simuladores y las pruebas la usan,
        y no hay razon para romperlas.
        """
        cuerpo = crudo.get("call") if isinstance(crudo.get("call"), dict) else crudo
        analisis = cuerpo.get("call_analysis") or {}
        extraidos = analisis.get("custom_analysis_data") or {}

        # Se toma TODO campo del modelo que venga en la raiz, no una lista fija
        # de siete. Con la lista fija, un cuerpo plano perdia en silencio
        # calificacion_lead, resumen_llamada y los demas: el webhook respondia
        # 200 y el lead quedaba sin ficha igual que si no hubiera llegado.
        conocidos = set(cls.model_fields)
        datos: dict[str, Any] = {
            k: v for k, v in cuerpo.items() if k in conocidos and v is not None
        }
        # La extraccion del agente manda sobre la raiz: es el dato mas especifico.
        datos.update({k: v for k, v in extraidos.items() if v is not None})

        # Si el agente no lleno resumen_llamada, el resumen generico de Dapta es
        # mejor que nada: el asesor necesita algo que leer.
        if not datos.get("resumen_llamada") and analisis.get("call_summary"):
            datos["resumen_llamada"] = analisis["call_summary"]

        # Nuestro id, si algun dia viaja de vuelta como variable dinamica.
        dinamicas = cuerpo.get("dynamic_variables") or {}
        for clave in ("external_lead_id", "lead_id"):
            if dinamicas.get(clave):
                datos.setdefault(clave, dinamicas[clave])

        # La forma plana puede traer campos que no estan en `call`.
        for clave in ("lead_id", "external_lead_id", "telefono"):
            if crudo.get(clave) is not None:
                datos.setdefault(clave, crudo[clave])

        return cls(**datos)

    call_id: str
    call_status: str
    # Opcional: en llamadas sin contestar (no_answer/voicemail) Dapta no produce
    # calificación. Si viene None, el lead NO avanza a 'asesor' (ver supabase).
    calificacion_lead: Literal["caliente", "tibio", "frio"] | None = None

    # --- Correlación con NUESTRO lead ---------------------------------------- #
    # El webhook POST-CALL del agente de Dapta NO manda nuestro lead_id: manda el
    # número del lead en `to_number`. Correlacionamos por teléfono (normalizado a
    # E.164 contra la columna telefono_e164). Si algún día llega lead_id (flujo
    # legacy), se prioriza. Ver supabase_client.guardar_resultado.
    lead_id: str | None = None
    external_lead_id: str | None = None  # alias tolerado por si Dapta lo llama así
    telefono: str | None = None
    to_number: str | None = None   # número del lead en el webhook nativo de Dapta
    from_number: str | None = None

    # Motivo de desconexión que envía Dapta (no_answer, voicemail, user_hangup…).
    disconnection_reason: str | None = None

    # --- Lo que el asesor necesita para retomar sin repreguntar (ficha H9) ---- #
    # Por qué salió en ese nivel. Manuela ya lo razona para decidir la etiqueta;
    # sin esto el asesor ve un badge "caliente" sin saber qué lo hizo caliente y
    # tiene que escuchar la llamada entera para enterarse.
    justificacion_calificacion: str | None = None
    # Cita acordada. Se recibe TAL CUAL la dijo el agente (texto libre: Manuela
    # agenda hablando, no llenando un date picker). La normalización a timestamp
    # ocurre al persistir — ver supabase_client._parsear_agendamiento — y el texto
    # original se conserva siempre, porque un parseo fallido no debe borrar el
    # único registro de que la persona sí aceptó una cita.
    fecha_hora_agendada: str | None = None
    modalidad_agendada: str | None = None  # "virtual" | "presencial"

    @property
    def lead_id_correlacion(self) -> str | None:
        """Nuestro id de lead, venga como `lead_id` o como `external_lead_id`."""
        return self.lead_id or self.external_lead_id

    @property
    def telefono_correlacion(self) -> str | None:
        """Teléfono del lead: `telefono` explícito o `to_number` del webhook nativo."""
        return self.telefono or self.to_number

    @model_validator(mode="before")
    @classmethod
    def _aplanar_formato_nativo_dapta(cls, data: object) -> object:
        """
        Acepta el formato NATIVO del webhook post-call del agente de Dapta, donde
        la calificación va anidada en `call_analysis.custom_analysis_data`. Lo
        aplana a nuestros campos top-level. El formato plano legacy pasa intacto.
        """
        if not isinstance(data, dict):
            return data
        analisis = data.get("call_analysis")
        if not isinstance(analisis, dict):
            return data
        aplanado = dict(data)
        anidados = analisis.get("custom_analysis_data")
        if isinstance(anidados, dict):
            for clave, valor in anidados.items():
                aplanado.setdefault(clave, valor)
        # to_number es el número del lead -> úsalo como teléfono de correlación.
        if data.get("to_number") and not aplanado.get("telefono"):
            aplanado["telefono"] = data["to_number"]
        return aplanado

    # Datos sensibles/financieros finos, capturados en conversación, no en el
    # formulario:
    ahorros_cesantias_declarado: str | None = None
    vivienda_nombre_propio_o_herencia: str | None = None
    primas_incluidas_plan_pago: bool | None = None
    cesantias_futuras_incluidas: bool | None = None
    disponible_visita: bool | None = None
    resumen_llamada: str | None = None

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
