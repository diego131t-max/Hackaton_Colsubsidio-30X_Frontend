"""
Cliente de integración con Dapta AI.

Pieza del sistema: DAPTA (contacto y calificación automática por voz/WhatsApp).
Dueño: Juan.

Este módulo conecta el backend con el agente de Dapta (Flow Studio). Deja el
PUERTO SALIENTE (disparar_llamada) y el PARSER de entrada
(recibir_resultado_calificacion) con tipos y mapeo listos. La llamada HTTP real
la completa Juan cuando el flow esté creado (ver docs/integracion-dapta.md).

Puede avanzar EN PARALELO con el resto del sistema.
"""

from __future__ import annotations

from typing import Any

from backend.models.schemas import (
    FichaTraspaso,
    ResultadoCalificacionDapta,
    ResultadoClustering,
    SenalBowl,
)

# TODO (Juan): pegar la URL real del webhook de Flow Studio cuando el flow
# esté creado. Debe venir de variable de entorno, NUNCA hardcodeada en el repo.
#   Ej.: DAPTA_FLOW_STUDIO_WEBHOOK_URL = os.environ["DAPTA_FLOW_STUDIO_WEBHOOK_URL"]
DAPTA_FLOW_STUDIO_WEBHOOK_URL: str | None = None


async def disparar_llamada(
    senal: SenalBowl, recomendaciones: ResultadoClustering
) -> dict[str, Any]:
    """
    Arma el payload que espera el webhook de Flow Studio de Dapta e inicia la
    llamada/WhatsApp.

    MAPEO contrato interno -> nombres que espera DAPTA (Flow Studio).
    Usa los nombres de campo tal cual los pide Dapta, NO los nuestros:

        Dapta            <-  Nuestro contrato
        ---------------------------------------------------------------
        nombre           <-  f"{senal.nombre} {senal.apellido}"
        telefono         <-  senal.telefono_movil
        proyecto         <-  recomendaciones.proyectos_recomendados[0]  (top-1)
        afiliado         <-  senal.afiliado
        rango_ingreso    <-  senal.ingresos_hogar_rango
        zona_interes     <-  senal.zona_interes
        urgencia         <-  (derivada; TODO: definir señal de urgencia real)

    TODO (Juan):
      - [ ] Confirmar con Laura los nombres EXACTOS de las variables del template
            de guion en Flow Studio y ajustar el mapeo de abajo.
      - [ ] Reemplazar el retorno mock por el POST real a DAPTA_FLOW_STUDIO_WEBHOOK_URL.
      - [ ] Definir de dónde sale `urgencia` (no está en SenalBowl v-final).
      - [ ] Reintentos/timeout y manejo de error de la API de Dapta.
    """
    proyecto_top = (
        recomendaciones.proyectos_recomendados[0]
        if recomendaciones.proyectos_recomendados
        else ""
    )

    payload_dapta: dict[str, Any] = {
        "nombre": f"{senal.nombre} {senal.apellido}",
        "telefono": senal.telefono_movil,
        "proyecto": proyecto_top,
        "afiliado": senal.afiliado,
        "rango_ingreso": senal.ingresos_hogar_rango,
        "zona_interes": senal.zona_interes,
        "urgencia": None,  # TODO(Juan): definir origen de urgencia
    }

    # --- MOCK: no hace la llamada real todavía --------------------------------
    # TODO(Juan): descomentar y completar cuando exista la URL del flow:
    #   async with httpx.AsyncClient() as client:
    #       r = await client.post(DAPTA_FLOW_STUDIO_WEBHOOK_URL, json=payload_dapta)
    #       r.raise_for_status()
    #       return r.json()
    return {"status": "mock_enqueued", "payload_enviado": payload_dapta}


def recibir_resultado_calificacion(
    payload_de_dapta: dict[str, Any],
) -> ResultadoCalificacionDapta:
    """
    Parsea y valida el payload del webhook de retorno de Dapta contra el
    contrato (ResultadoCalificacionDapta). Lanza ValidationError si no matchea.

    TODO (Juan):
      - [ ] Confirmar el esquema exacto que envía Dapta al terminar y ajustar el
            mapeo si los nombres difieren.
      - [ ] Verificar autenticidad del webhook (firma/secreto) — ver TODO de
            seguridad en main.py.
    """
    return ResultadoCalificacionDapta.model_validate(payload_de_dapta)


def integrar_en_ficha(
    ficha_base: FichaTraspaso, resultado: ResultadoCalificacionDapta
) -> FichaTraspaso:
    """
    Integra el resultado de Dapta a una ficha ya iniciada. Delega el ensamblaje
    fino a core/handoff_card.py (fuente única de la lógica de la ficha).

    TODO (Juan): decidir si esta integración vive aquí o toda en handoff_card.py.
    """
    from backend.core.handoff_card import aplicar_resultado_dapta

    return aplicar_resultado_dapta(ficha_base, resultado)
