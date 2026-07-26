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

from typing import Any
from uuid import UUID

from backend import config
from backend.models.schemas import ResultadoCalificacionDapta, SenalBowl

TABLA = "reto_vivienda_leads"


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
        "canal_origen": canal_origen,
        "nodo_actual": "backend",
        "estado_nodo": "en_proceso",
        "senal": senal.model_dump(),
        "timeline": [
            {"pieza": "bowl", "estado": "completado", "nota": "Completó el formulario"},
            {"pieza": "backend", "estado": "en_proceso", "nota": "Reglas H1–H10"},
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
        "canal_origen": canal_origen,
        "nodo_actual": "clustering",
        "estado_nodo": "completado",
        "senal": senal.model_dump(),
        "cluster_id": cluster_id,
        "proyectos_recomendados": proyectos_recomendados,
        "timeline": [
            {"pieza": "bowl", "estado": "completado", "nota": "Completó el formulario"},
            {"pieza": "backend", "estado": "completado", "nota": "Reglas H1–H10"},
            {"pieza": "clustering", "estado": "completado",
             "nota": "Recomendaciones generadas"},
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
    if resultado.telefono:
        tel = resultado.telefono.strip()
        return {"senal->>telefono_movil": f"eq.{tel}", "nodo_actual": "eq.dapta"}, "telefono"
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

    cuerpo = {
        "nodo_actual": "asesor",
        "estado_nodo": "completado",
        "calificacion": resultado.calificacion_lead,
        "resultado_dapta": resultado.model_dump(),
    }
    url = f"{config.SUPABASE_URL}/rest/v1/{TABLA}"
    params, criterio = _criterio_correlacion(resultado)

    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.patch(url, headers=_headers(), params=params, json=cuerpo)
        r.raise_for_status()
        filas = r.json()
        if filas:
            return {"estado": "actualizado", "filas": len(filas), "criterio": criterio}
        return {
            "estado": "sin_match",
            "criterio": criterio,
            "call_id": resultado.call_id,
            "lead_id": resultado.lead_id_correlacion,
        }
