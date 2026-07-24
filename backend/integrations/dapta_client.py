"""
Cliente de integración con Dapta AI.

Pieza del sistema: DAPTA (contacto y calificación automática por voz/WhatsApp).
Dueño: Juan.

Este módulo conecta el backend de reglas con el agente de Dapta. La lógica
real depende de la API de Dapta que Juan aún está confirmando con Laura/Dapta
(ver docs/integracion-dapta.md). Aquí quedan los dos stubs con TODOs.

Puede avanzar EN PARALELO con el resto del sistema: solo depende de que el
backend exponga el endpoint que dispara la llamada.
"""

from __future__ import annotations

from typing import Any

from backend.models.schemas import FichaTraspaso, PerfilLead


def disparar_llamada(lead: PerfilLead) -> dict[str, Any]:
    """
    Arma el payload desde el contrato de datos y llama a la API de Dapta para
    crear el lead e iniciar la llamada.

    Mapeo mínimo que Dapta necesita (ver sección 5):
      - identificacion.nombre  + identificacion.telefono  -> marcar y saludar
      - proyecto_interes                                   -> guion del proyecto correcto
      - afiliacion.tipo                                    -> no repreguntar (H1)
      - financiero.ingreso_rango_declarado                -> no repetir pregunta
      - preferencias.urgencia                              -> tono/velocidad de cierre

    TODO (Juan):
      - [ ] Confirmar con Laura el endpoint exacto: ¿webhook saliente o API
            "crear lead + iniciar llamada"?
      - [ ] Mapear el contrato (sección 4) al formato de variables de template
            que pide el guion de Dapta (probablemente NO el JSON completo).
      - [ ] Definir condicionales del guion: cuándo escala a WhatsApp (no
            contesta) y cuándo agenda con asesor (lead "caliente"). Reusar la
            lógica de probabilidad de handoff_card.py — NO inventar otra.
      - [ ] Manejo de errores/reintentos y timeout de la API de Dapta.
    """
    raise NotImplementedError(
        "disparar_llamada: pendiente de la API real de Dapta (Juan)."
    )


def recibir_resultado_calificacion(payload_de_dapta: dict[str, Any]) -> FichaTraspaso:
    """
    Parsea el webhook de retorno de Dapta (cuando termina de calificar por voz
    o WhatsApp) y lo integra a la ficha de traspaso final.

    TODO (Juan):
      - [ ] Confirmar que Dapta soporta webhook de salida al terminar la
            conversación, y su esquema.
      - [ ] Mapear el resultado de Dapta a FichaTraspaso (schemas.py) e
            invocar core/handoff_card.py para completar la ficha.
      - [ ] Validar/normalizar la probabilidad de cierre que devuelva Dapta
            contra la escala común del sistema.
    """
    raise NotImplementedError(
        "recibir_resultado_calificacion: pendiente del webhook de Dapta (Juan)."
    )
