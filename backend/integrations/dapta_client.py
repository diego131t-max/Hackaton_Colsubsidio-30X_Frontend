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
from datetime import datetime, timedelta, timezone
from typing import Any

from backend import config
# Vive aqui y no en supabase_client porque ese modulo ya importa de este:
# ponerlo al reves crea un ciclo de imports.
TZ_BOGOTA = timezone(timedelta(hours=-5))

from backend.models.schemas import (
    FichaTraspaso,
    ResultadoCalificacionDapta,
    ResultadoClustering,
    SenalBowl,
)


def normalizar_telefono_e164(raw: str | None, indicativo: str = "57") -> str | None:
    """
    Normaliza un movil colombiano a E.164 (+57 + 10 digitos que empiezan por 3).

    Devuelve None si NO es un movil colombiano valido. Esa es la parte
    importante: la version anterior "siempre devolvia algo", y con
    "+57 23456789" (8 digitos, incompleto) producia +575723456789 — el
    indicativo duplicado. Se guardaba en Supabase sin una queja, y el fallo
    aparecia mucho despues, en la telefonia, lejos de donde el usuario todavia
    podia corregirlo.

    Fabricar un numero plausible a partir de uno invalido es peor que rechazar:
    el dato malo sobrevive y contamina la correlacion del resultado.
    """
    if not raw:
        return None
    digitos = re.sub(r"\D", "", str(raw))
    if not digitos:
        return None

    # Prefijo internacional marcado como 00 (00 57 3...).
    if digitos.startswith("00"):
        digitos = digitos[2:]
    # Con indicativo: se queda con lo que sigue.
    if digitos.startswith(indicativo) and len(digitos) > 10:
        digitos = digitos[len(indicativo):]

    # Un movil colombiano son exactamente 10 digitos y empieza por 3. Los fijos
    # (7 digitos + indicativo de ciudad) no sirven: el agente marca a moviles.
    if len(digitos) == 10 and digitos.startswith("3"):
        return "+" + indicativo + digitos
    return None


def es_movil_colombiano(raw: str | None) -> bool:
    """Azucar para validar sin quedarse con el resultado."""
    return normalizar_telefono_e164(raw) is not None


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
        tipo_vivienda            <-  senal.tipo_vivienda
        current_time             <-  hora actual en America/Bogota
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
        # El prompt usa {{tipo_vivienda}} y {{current_time}}. Una variable que
        # el flow no resuelve NO queda vacia: el agente la PRONUNCIA literal en
        # la llamada. Por eso todo lo que el prompt referencia tiene que salir
        # de aqui, aunque parezca redundante.
        "tipo_vivienda": senal.tipo_vivienda,
        # current_time ancla el agendamiento ("proximo dia habil"): sin hora de
        # Bogota propondria citas en la zona horaria del servidor.
        "current_time": datetime.now(TZ_BOGOTA).strftime("%Y-%m-%d %H:%M"),
        # Se sigue enviando por compatibilidad con el flow actual, pero los
        # agentes nuevos NO ramifican por este campo: ya saben con quién
        # hablan porque el backend los eligió por él.
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

    # El agente lo decide la afiliación: cada uno tiene límites distintos sobre
    # qué puede prometer. Ver dapta/README.md.
    url = (
        config.DAPTA_FLOW_WEBHOOK_AFILIADO
        if senal.afiliado is True
        else config.DAPTA_FLOW_WEBHOOK_NO_AFILIADO
    )

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


async def enviar_whatsapp_seguimiento(
    telefono: str | None,
    nombre: str | None = None,
    *,
    mensaje: str | None = None,
) -> dict[str, Any]:
    """
    Dispara el seguimiento por WhatsApp (agente de texto "Manuela — Seguimiento
    WhatsApp") cuando la persona NO contestó la llamada de voz.

    GATED y SEGURO: si `DAPTA_WHATSAPP_ACTIVO` está apagado o faltan credenciales,
    NO hace nada (no-op) y devuelve el motivo — así no rompe el webhook mientras
    no exista la línea de WhatsApp Business (conectada en Dapta vía Meta).

    Cuando esté activo, POST al endpoint de WhatsApp de Dapta con el mensaje de
    apertura y el número del lead; a partir de ahí el agente de texto conversa.
    """
    if not config.DAPTA_WHATSAPP_ACTIVO:
        return {"status": "desactivado", "motivo": "DAPTA_WHATSAPP_ACTIVO=false"}
    if not (config.DAPTA_WHATSAPP_URL and config.DAPTA_WHATSAPP_AGENT_KEY):
        return {"status": "sin_configurar", "motivo": "falta URL o agent_key de WhatsApp"}

    destino = normalizar_telefono_e164(telefono)
    if not destino:
        return {"status": "sin_telefono"}

    saludo = f"Hola {nombre.split()[0]}" if nombre else "Hola"
    texto = mensaje or (
        f"{saludo}, soy Manuela de Colsubsidio Vivienda. Dejaste tus datos en "
        "nuestro formulario pero no pudimos hablar por teléfono. ¿Tienes un "
        "momento para agendar una asesoría rápida?"
    )
    payload = {
        "role": "user",
        "source": "whatsapp",
        "whatsapp_provider": "message_bird",
        "message": texto,
        "whatsapp_target": destino,
        "agent_key": config.DAPTA_WHATSAPP_AGENT_KEY,
    }
    headers = (
        {"x-api-key": config.DAPTA_WHATSAPP_API_KEY}
        if config.DAPTA_WHATSAPP_API_KEY
        else {}
    )
    import httpx

    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.post(config.DAPTA_WHATSAPP_URL, json=payload, headers=headers)
        r.raise_for_status()
        return {"status": "enviado", "http_status": r.status_code}


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
