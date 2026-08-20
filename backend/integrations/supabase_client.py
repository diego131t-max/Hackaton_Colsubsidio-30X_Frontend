"""
Cliente ligero de Supabase para el backend (vía PostgREST + httpx).

Pieza del sistema: BACKEND <-> SUPABASE.

Escribe el resultado de la calificación de Dapta en la tabla
`reto_vivienda_leads` para que el DASHBOARD lo muestre en vivo (Realtime).
No usa el SDK; un PATCH REST basta y evita otra dependencia pesada.

Requiere config.SUPABASE_URL + config.SUPABASE_KEY. Si faltan, las funciones
quedan en no-op (útil en tests o sin .env) para no romper el webhook.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from backend import config
from backend.integrations.dapta_client import TZ_BOGOTA, normalizar_telefono_e164
from backend.models.schemas import ResultadoCalificacionDapta, SenalBowl

TABLA = "reto_vivienda_leads"

# Bogotá (UTC-5, sin horario de verano). Manuela agenda "mañana a las 10" pensando
# en hora local; guardarlo como UTC ingenuo correría toda cita 5 horas.


def ahora_iso() -> str:
    """Instante actual en ISO-8601 con offset de Bogotá."""
    return datetime.now(TZ_BOGOTA).isoformat(timespec="seconds")


def evento(pieza: str, estado: str, nota: str) -> dict[str, str]:
    """
    Un evento del timeline, con marca de tiempo.

    El asesor no necesita saber en qué etapa está el lead (eso ya lo dice
    `nodo_actual`): necesita saber HACE CUÁNTO pasó cada cosa, porque un lead
    caliente de hace 20 minutos y uno de hace seis días se trabajan distinto.
    Los eventos históricos no tienen `ts` — quien los lea debe tolerar su
    ausencia en vez de asumir la fecha de la fila.
    """
    return {"pieza": pieza, "estado": estado, "nota": nota, "ts": ahora_iso()}


# Formatos que puede devolver el agente al agendar, del más al menos explícito.
# Es deliberadamente corto: si no cae en uno de estos, se prefiere dejar la
# columna en null antes que adivinar una fecha y mandar al asesor un día errado.
_FORMATOS_FECHA = (
    "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M",
    "%Y-%m-%d %H:%M", "%d/%m/%Y %H:%M", "%Y-%m-%d",
)


def _parsear_agendamiento(crudo: str | None) -> str | None:
    """
    Texto libre del agente -> ISO-8601 con zona de Bogotá, o None.

    Devolver None NO pierde información: el texto original sigue guardado en
    `resultado_dapta.fecha_hora_agendada`. La columna existe solo para poder
    ordenar por "cita más próxima", y una fecha inventada ahí es peor que un
    hueco, porque el asesor la leería como un compromiso real.
    """
    if not crudo or not str(crudo).strip():
        return None
    texto = str(crudo).strip().replace("Z", "")
    for formato in _FORMATOS_FECHA:
        try:
            fecha = datetime.strptime(texto, formato)
        except ValueError:
            continue
        return fecha.replace(tzinfo=TZ_BOGOTA).isoformat(timespec="seconds")
    try:  # último intento: ISO con offset ya incluido
        return datetime.fromisoformat(texto).isoformat(timespec="seconds")
    except ValueError:
        return None


def _configurado() -> bool:
    return bool(config.SUPABASE_URL and config.SUPABASE_KEY)


def _headers() -> dict[str, str]:
    assert config.SUPABASE_KEY  # garantizado por el guard del caller
    return {
        "apikey": config.SUPABASE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def crear_lead(
    lead_id: UUID,
    senal: SenalBowl,
    call_id: str,
    canal_origen: str = "formulario_web",
) -> dict[str, Any]:
    """
    Inserta el lead recién capturado en Supabase (etapa 'backend'), usando
    nuestro lead_id como `id` de la fila y guardando el `call_id` para poder
    correlacionar luego el resultado de Dapta. El dashboard lo verá al instante
    por Realtime.
    """
    if not _configurado():
        return {"estado": "omitido", "motivo": "Supabase no configurado"}

    import httpx

    fila = {
        "id": str(lead_id),
        "call_id": call_id,
        # E.164 para correlacionar el resultado de Dapta por `to_number`.
        "telefono_e164": normalizar_telefono_e164(senal.telefono_movil),
        "canal_origen": canal_origen,
        "nodo_actual": "backend",
        "estado_nodo": "en_proceso",
        "senal": senal.model_dump(),
        "timeline": [
            evento("bowl", "completado", "Completó el formulario"),
            evento("backend", "en_proceso", "Reglas H1–H10"),
        ],
    }
    url = f"{config.SUPABASE_URL}/rest/v1/{TABLA}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(url, headers=_headers(), json=fila)
        r.raise_for_status()
        return {"estado": "creado", "id": str(lead_id)}


async def crear_lead_recomendaciones(
    lead_id: UUID,
    senal: SenalBowl,
    cluster_id: str | None,
    proyectos_recomendados: list[str],
    canal_origen: str = "formulario_web",
    recomendaciones_detalle: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Registro TEMPORAL creado al terminar el formulario (paso /recomendaciones),
    ANTES de que la persona elija/confirme. Queda en etapa 'clustering' con las
    recomendaciones ya calculadas; el dashboard lo ve entrar al instante.
    Al confirmar (/leads con lead_id) se completa con el proyecto elegido.
    """
    if not _configurado():
        return {"estado": "omitido", "motivo": "Supabase no configurado"}

    import httpx

    fila = {
        "id": str(lead_id),
        "call_id": str(lead_id),
        # E.164 para correlacionar el resultado de Dapta por `to_number`.
        "telefono_e164": normalizar_telefono_e164(senal.telefono_movil),
        "canal_origen": canal_origen,
        "nodo_actual": "clustering",
        "estado_nodo": "completado",
        "senal": senal.model_dump(),
        "cluster_id": cluster_id,
        "proyectos_recomendados": proyectos_recomendados,
        # Espejo enriquecido: mismos proyectos, con el match_score que el modelo
        # ya calculó. Sin esto el asesor ve una lista de nombres sin saber cuál
        # encaja mejor ni por qué.
        "recomendaciones_detalle": recomendaciones_detalle or [],
        "timeline": [
            evento("bowl", "completado", "Completó el formulario"),
            evento("backend", "completado", "Reglas H1–H10"),
            evento("clustering", "completado", "Recomendaciones generadas"),
        ],
    }
    url = f"{config.SUPABASE_URL}/rest/v1/{TABLA}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.post(url, headers=_headers(), json=fila)
        r.raise_for_status()
        return {"estado": "creado", "id": str(lead_id)}


async def actualizar_lead(lead_id: UUID, campos: dict[str, Any]) -> dict[str, Any]:
    """Actualiza (PATCH) la fila del lead por su `id` con los campos dados."""
    if not _configurado():
        return {"estado": "omitido"}

    import httpx

    url = f"{config.SUPABASE_URL}/rest/v1/{TABLA}"
    params = {"id": f"eq.{lead_id}"}
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.patch(url, headers=_headers(), params=params, json=campos)
        r.raise_for_status()
        return {"estado": "actualizado"}


def _criterio_correlacion(resultado: ResultadoCalificacionDapta) -> tuple[dict[str, str], str]:
    """
    Decide POR QUÉ campo cruzar el resultado de Dapta con la fila del lead.

    Orden de preferencia (de más a menos confiable):
      1) lead_id  -> nuestro id de fila (echo del external_lead_id). Único y exacto.
      2) telefono -> `senal->>telefono_movil`, acotado a los que siguen en 'dapta',
                     para no pisar leads viejos con el mismo número.
      3) call_id  -> respaldo legacy (solo sirve si Dapta llegara a devolver
                     nuestro id como call_id).
    Devuelve (params_para_postgrest, nombre_del_criterio).
    """
    lead_id = resultado.lead_id_correlacion
    if lead_id:
        return {"id": f"eq.{lead_id}"}, "lead_id"
    tel = resultado.telefono_correlacion
    if tel:
        # Normaliza a E.164 y cruza contra la columna telefono_e164 (así el
        # to_number "+573125923915" matchea aunque el form guardara "312 592 3915").
        #
        # `resultado_dapta=is.null` NO es un detalle: una llamada sin contestar
        # deja la fila en 'dapta' (estado 'error'), así que sigue cruzando por
        # teléfono. Sin este filtro, el resultado de la SIGUIENTE llamada a ese
        # mismo número pisa el lead que ya tenía respuesta en vez de tomar el que
        # aún la espera — y un lead se queda mudo para siempre. Un teléfono
        # repetido es común: la misma persona llena el formulario dos veces.
        tel_e164 = normalizar_telefono_e164(tel)
        return (
            {
                "telefono_e164": f"eq.{tel_e164}",
                "nodo_actual": "eq.dapta",
                "resultado_dapta": "is.null",
            },
            "telefono",
        )
    return {"call_id": f"eq.{resultado.call_id}"}, "call_id"


async def guardar_resultado(resultado: ResultadoCalificacionDapta) -> dict[str, Any]:
    """
    Actualiza la fila del lead correlacionado con la calificación y el resultado
    de Dapta, avanzándolo a la pieza 'asesor'.

    La correlación NO depende del `call_id` de Dapta (que es su id interno, no el
    nuestro): usa `lead_id` -> `telefono` -> `call_id` en ese orden (ver
    `_criterio_correlacion`).

    Devuelve un dict con el desenlace: {'estado': 'actualizado'|'sin_match'|'omitido'}.
    Nunca lanza hacia el webhook (un error 5xx haría que Dapta reintentara);
    los problemas se reportan en el dict y se loguean arriba.
    """
    if not (config.SUPABASE_URL and config.SUPABASE_KEY):
        return {"estado": "omitido", "motivo": "Supabase no configurado"}

    import httpx

    if resultado.calificacion_lead:
        # Hubo conversación y calificación -> lo entregamos al asesor humano.
        cuerpo = {
            "nodo_actual": "asesor",
            "estado_nodo": "completado",
            "calificacion": resultado.calificacion_lead,
            "resultado_dapta": resultado.model_dump(),
            # Texto libre del agente -> timestamp ordenable. Si no se puede
            # interpretar queda null, pero el texto sigue en resultado_dapta.
            "agendado_para": _parsear_agendamiento(resultado.fecha_hora_agendada),
        }
        nota_evento = "Calificado %s por Manuela" % resultado.calificacion_lead
        estado_evento = "completado"
    else:
        # No contestó / buzón: no hay calificación. No avanza a asesor; queda en
        # 'dapta' con estado 'error' (candidato a seguimiento). El motivo real
        # (no_answer/voicemail) queda en resultado_dapta.disconnection_reason.
        cuerpo = {
            "nodo_actual": "dapta",
            "estado_nodo": "error",
            "resultado_dapta": resultado.model_dump(),
        }
        nota_evento = "Sin respuesta (%s)" % (resultado.disconnection_reason or "desconocido")
        estado_evento = "error"

    url = f"{config.SUPABASE_URL}/rest/v1/{TABLA}"
    params, criterio = _criterio_correlacion(resultado)

    async with httpx.AsyncClient(timeout=15.0) as client:
        # Se LEE antes de escribir porque el timeline se AÑADE, no se reemplaza:
        # un PATCH directo del array borraría los eventos previos (bowl, backend,
        # clustering) y el asesor perdería la historia del lead. PostgREST no
        # sabe hacer append sobre jsonb en una sola operación.
        previa = await client.get(
            url,
            headers=_headers(),
            # `order` explícito: sin él PostgREST no garantiza el orden y el
            # desempate de abajo (filas_previas[-1] = la más reciente) sería azar.
            params={**params, "select": "id,timeline", "order": "created_at.asc"},
        )
        previa.raise_for_status()
        filas_previas = previa.json()
        if not filas_previas:
            return {
                "estado": "sin_match",
                "criterio": criterio,
                "call_id": resultado.call_id,
                "lead_id": resultado.lead_id_correlacion,
            }

        # El criterio por teléfono puede traer más de una fila (mismo número que
        # rellenó el formulario dos veces). Se actualiza la MÁS RECIENTE por id,
        # no todas: pisar leads viejos con el resultado de una llamada nueva
        # inventaría historia que no ocurrió.
        objetivo = filas_previas[-1]
        timeline = objetivo.get("timeline") or []
        if not isinstance(timeline, list):
            timeline = []
        cuerpo["timeline"] = timeline + [evento("dapta", estado_evento, nota_evento)]

        r = await client.patch(
            url, headers=_headers(), params={"id": f"eq.{objetivo['id']}"}, json=cuerpo
        )
        r.raise_for_status()
        filas = r.json()
        if filas:
            return {
                "estado": "actualizado",
                "filas": len(filas),
                "criterio": criterio,
                "agendado_para": cuerpo.get("agendado_para"),
                # La fila actualizada viaja de vuelta para que el webhook pueda
                # redactar el seguimiento SIN volver a consultar: necesita el
                # nombre, el correo y el proyecto, y ya los tenemos aqui.
                "lead": filas[0],
            }
        return {
            "estado": "sin_match",
            "criterio": criterio,
            "call_id": resultado.call_id,
            "lead_id": resultado.lead_id_correlacion,
        }
