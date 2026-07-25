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

from backend import config
from backend.models.schemas import ResultadoCalificacionDapta

TABLA = "reto_vivienda_leads"


def _headers() -> dict[str, str]:
    assert config.SUPABASE_KEY  # garantizado por el guard del caller
    return {
        "apikey": config.SUPABASE_KEY,
        "Authorization": f"Bearer {config.SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def guardar_resultado(resultado: ResultadoCalificacionDapta) -> dict[str, Any]:
    """
    Actualiza la fila del lead cuyo `call_id` coincide, con la calificación y el
    resultado de Dapta, avanzándolo a la pieza 'asesor'.

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
    params = {"call_id": f"eq.{resultado.call_id}"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.patch(url, headers=_headers(), params=params, json=cuerpo)
        r.raise_for_status()
        filas = r.json()
        if filas:
            return {"estado": "actualizado", "filas": len(filas)}
        return {"estado": "sin_match", "call_id": resultado.call_id}
