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

import re
from typing import Any

from backend import config
from backend.models.schemas import (
    FichaTraspaso,
    ResultadoCalificacionDapta,
    ResultadoClustering,
    SenalBowl,
)


def normalizar_telefono_e164(raw: str | None, indicativo: str = "57") -> str | None:
    """
    Normaliza un teléfono colombiano a E.164 (+57XXXXXXXXXX) para que la
    telefonía de Dapta pueda marcar SIN error.

    La marcación saliente exige E.164; si llega el número crudo del formulario
    ("312 592 3915", "57 3125923915", "+57 312-592-3915", "3125923915") la
    llamada no conecta. Esta función tolera espacios, guiones, paréntesis y el
    prefijo, y siempre devuelve "+57" + 10 dígitos del móvil.

    Devuelve el original si no logra interpretarlo (mejor mandar algo que None).
    """
    if not raw:
        return raw
    digitos = re.sub(r"\D", "", raw)  # solo dígitos: ignora +, espacios, guiones
    if not digitos:
        return raw
    # Ya trae indicativo país (57 + 10 dígitos = 12).
    if digitos.startswith(indicativo) and len(digitos) == len(indicativo) + 10:
        return "+" + digitos
    # Solo el móvil de 10 dígitos (celular colombiano empieza por 3).
    if len(digitos) == 10:
        return "+" + indicativo + digitos
    # Otros largos: respeta el indicativo si ya está, si no lo antepone.
    if digitos.startswith(indicativo):
        return "+" + digitos
    return "+" + indicativo + digitos


async def disparar_llamada(
    senal: SenalBowl,
    recomendaciones: ResultadoClustering,
    *,
    urgencia: str | None = None,
    cuota_estimada_mensual: float | None = None,
    valor_estimado_vivienda: float | None = None,
    subsidio_estimado: float | None = None,
    proyecto_interes: str | None = None,
    external_lead_id: str | None = None,
) -> dict[str, Any]:
    """
    Arma el payload que espera el webhook del flow `colsubsidio-vivienda-
    perfilamiento-lead` (Nodo 1) e inicia la llamada de Manuela.

    El trigger de Dapti espera EXACTAMENTE estos 16 campos (mapeo abajo). Usa los
    nombres tal cual los pide Dapta, NO los nuestros.

    Los tres cálculos financieros (cuota/valor/subsidio) y `urgencia` NO están en
    SenalBowl: los produce el backend (rules_engine / bandas de precio) y se
    inyectan por parámetro. Mientras esas piezas sean stub, llegan como None.

        Dapta (16 campos)        <-  Origen
        ----------------------------------------------------------------------
        nombre                   <-  f"{senal.nombre} {senal.apellido}"
        telefono                 <-  senal.telefono_movil
        proyecto                 <-  proyecto_interes | top recomendado
        afiliado                 <-  senal.afiliado
        rango_ingreso            <-  senal.ingresos_hogar_rango
        zona_interes             <-  senal.zona_interes
        urgencia                 <-  parámetro (derivado por el backend)
        edad                     <-  senal.edad
        entorno_deseado          <-  senal.entorno_deseado
        personas_a_cargo         <-  senal.personas_a_cargo
        piso_preferido           <-  senal.piso_preferido
        tipo_inmueble            <-  senal.tipo_inmueble
        proyecto_recomendado     <-  recomendaciones.proyectos_recomendados[0]
        cuota_estimada_mensual   <-  parámetro (rules_engine, regla 40%)
        valor_estimado_vivienda  <-  parámetro (bandas de precio)
        subsidio_estimado        <-  parámetro (rules_engine / external_mocks)

    TODO (Juan):
      - [ ] Confirmar con Dapti los nombres EXACTOS de las variables del guion.
      - [ ] Reemplazar el retorno mock por el POST real a DAPTA_FLOW_STUDIO_WEBHOOK_URL
            (la URL nueva del flow v2 que dará Dapti).
      - [ ] Cablear urgencia + los 3 cálculos financieros desde el orquestador.
      - [ ] Reintentos/timeout y manejo de error de la API de Dapta.
    """
    proyecto_top = (
        recomendaciones.proyectos_recomendados[0]
        if recomendaciones.proyectos_recomendados
        else ""
    )

    payload_dapta: dict[str, Any] = {
        "nombre": f"{senal.nombre} {senal.apellido}",
        # E.164 obligatorio para que Dapta pueda marcar (to_number).
        "telefono": normalizar_telefono_e164(senal.telefono_movil),
        "proyecto": proyecto_interes or proyecto_top,
        "afiliado": senal.afiliado,
        "rango_ingreso": senal.ingresos_hogar_rango,
        "zona_interes": senal.zona_interes,
        "urgencia": urgencia,
        "edad": senal.edad,
        "entorno_deseado": senal.entorno_deseado,
        "personas_a_cargo": senal.personas_a_cargo,
        "piso_preferido": senal.piso_preferido,
        "tipo_inmueble": senal.tipo_inmueble,
        "proyecto_recomendado": proyecto_top,
        "cuota_estimada_mensual": cuota_estimada_mensual,
        "valor_estimado_vivienda": valor_estimado_vivienda,
        "subsidio_estimado": subsidio_estimado,
        # Nuestro id para correlacionar el resultado: si Dapta lo devuelve como
        # call_id en el webhook de resultado, el match es directo.
        "external_lead_id": external_lead_id,
    }

    url = config.DAPTA_FLOW_STUDIO_WEBHOOK_URL

    # Sin URL configurada (p. ej. en tests o sin .env) -> modo mock, no llama.
    if not url:
        return {"status": "mock_enqueued", "payload_enviado": payload_dapta}

    # POST real al flow v2 de Dapta. La URL ya incluye el x-api-key como query
    # param, así que no hace falta header extra.
    import httpx

    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(url, json=payload_dapta)
        r.raise_for_status()
        try:
            cuerpo = r.json()
        except ValueError:
            cuerpo = r.text
        return {"status": "enviado", "http_status": r.status_code, "respuesta": cuerpo}


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
