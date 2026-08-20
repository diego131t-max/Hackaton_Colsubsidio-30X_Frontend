"""
Seguimiento por CORREO cuando la persona no contesta la llamada.

POR QUE CORREO Y NO SMS
-----------------------
Dapta no tiene nodo de SMS: toda su mensajeria es WhatsApp, que necesita una
linea de WhatsApp Business aprobada por Meta (tramite lento). Montar SMS aparte
exigiria una cuenta de Twilio propia, y un long code estadounidense mandando SMS
a moviles colombianos se filtra mucho: llega tarde, o no llega.

El correo, en cambio, esta disponible hoy. Es campo OBLIGATORIO del formulario
—161 de 161 leads lo tienen— no cuesta nada por envio, no depende de ninguna
aprobacion y admite el enlace a la ficha del proyecto, que en 160 caracteres de
SMS no cabe.

GATED
-----
Sin credenciales SMTP esto es un no-op que devuelve el motivo. Asi el webhook
post-call no cambia de comportamiento mientras no se configure.
"""

from __future__ import annotations

import logging
import smtplib
import ssl
from email.message import EmailMessage
from typing import Any

from backend import config

logger = logging.getLogger(__name__)


def _texto(lead: dict[str, Any]) -> tuple[str, str]:
    """Asunto y cuerpo, personalizados con lo que la persona ya nos dijo."""
    senal = lead.get("senal") or {}
    nombre = (senal.get("nombre") or "").strip().split(" ")[0] or "Hola"
    proyecto = senal.get("proyecto_elegido") or ""
    zona = senal.get("zona_interes") or ""

    asunto = (
        f"{nombre}, seguimos con tu búsqueda de vivienda en {zona}".strip()
        if zona
        else f"{nombre}, seguimos con tu búsqueda de vivienda"
    )

    referencia = f" sobre {proyecto}" if proyecto else ""
    cuerpo = (
        f"Hola {nombre},\n\n"
        f"Te llamamos desde Colsubsidio Vivienda para hablar{referencia}, pero no "
        "logramos comunicarnos.\n\n"
        "No hace falta que hagas nada: un asesor te va a contactar. Si prefieres "
        "adelantarlo, respóndenos este correo con el día y la hora que te sirvan, "
        "de lunes a viernes entre 8 de la mañana y 4 de la tarde.\n\n"
        "Gracias,\n"
        "Colsubsidio Vivienda"
    )
    return asunto, cuerpo


async def enviar_seguimiento(lead: dict[str, Any] | None) -> dict[str, Any]:
    """
    Envia el correo de seguimiento. No lanza nunca: el webhook post-call no debe
    fallar porque el correo no salga, o Dapta lo reintentaria en bucle.
    """
    if not config.CORREO_ACTIVO:
        return {"status": "desactivado", "motivo": "CORREO_ACTIVO=false"}
    if not (config.SMTP_HOST and config.SMTP_USUARIO and config.SMTP_CLAVE):
        return {"status": "sin_configurar", "motivo": "faltan credenciales SMTP"}
    if not lead:
        return {"status": "sin_lead", "motivo": "el webhook no correlaciono ningun lead"}

    destino = ((lead.get("senal") or {}).get("correo") or "").strip()
    if "@" not in destino:
        return {"status": "sin_correo"}

    asunto, cuerpo = _texto(lead)
    mensaje = EmailMessage()
    mensaje["From"] = config.CORREO_REMITENTE or config.SMTP_USUARIO
    mensaje["To"] = destino
    mensaje["Subject"] = asunto
    mensaje.set_content(cuerpo)

    try:
        contexto = ssl.create_default_context()
        with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PUERTO, timeout=15) as smtp:
            smtp.starttls(context=contexto)
            smtp.login(config.SMTP_USUARIO, config.SMTP_CLAVE)
            smtp.send_message(mensaje)
        logger.info("Seguimiento por correo enviado a %s", destino)
        return {"status": "enviado", "destino": destino}
    except Exception as e:  # noqa: BLE001 - ver docstring
        logger.exception("Fallo al enviar el seguimiento por correo")
        return {"status": "error", "motivo": str(e)[:200]}
