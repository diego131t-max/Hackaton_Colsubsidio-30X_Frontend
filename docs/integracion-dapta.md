# Integración con Dapta (sección 5)

> Lo que le toca a Juan. Implementación stub en
> [`backend/integrations/dapta_client.py`](../backend/integrations/dapta_client.py).

## Qué necesita saber Dapta de cada lead
Del contrato de datos de la sección 4, Dapta necesita como mínimo:
- `identificacion.nombre` y `identificacion.telefono` (para marcar y saludar por nombre)
- `proyecto_interes` (para que el guion hable del proyecto correcto, no genérico)
- `afiliacion.tipo` (para no repreguntar si ya es afiliado — el mismo principio de H1)
- `financiero.ingreso_rango_declarado` (para que la calificación no repita la pregunta)
- `preferencias.urgencia` (para priorizar el tono/velocidad de cierre en el guion)

## Lo que tienes que resolver con Laura/Dapta
1. **Mecanismo de disparo**: cuando el backend recibe el POST del bowl, ¿cómo notifica a Dapta para que llame? Lo más probable es un webhook saliente desde tu backend hacia un endpoint de Dapta, o la API de Dapta para "crear lead + iniciar llamada". Confirma el nombre exacto del endpoint con Laura.
2. **Formato del contexto**: Dapta necesita el contexto en algún formato que su agente pueda leer antes/durante la llamada (probablemente variables de un template de guion, no el JSON completo). Vas a tener que mapear el contrato de datos de la sección 4 a lo que sea que pida su API.
3. **Condicionales del guion**: aquí es donde defines, con las reglas y contexto que Laura mencionó, cuándo el agente escala a WhatsApp (no contesta) y cuándo agenda con el asesor (lead calificado como "caliente" — usa la misma lógica de probabilidad de cierre que ya definimos en `handoff_card.py`, no inventes una nueva).
4. **Webhook de retorno**: cuando Dapta termina de calificar (por voz o WhatsApp), necesitas que te devuelva el resultado a tu backend para generar la ficha de traspaso final — confirma si Dapta soporta webhooks de salida al terminar una llamada/conversación.

## Módulo que vas a construir: `backend/integrations/dapta_client.py`
Responsabilidades:
- `disparar_llamada(lead: PerfilLead) -> dict`: arma el payload desde el contrato de datos y llama a la API de Dapta.
- `recibir_resultado_calificacion(payload_de_dapta: dict) -> FichaTraspaso`: parsea lo que Dapta devuelve y lo integra a la ficha de traspaso ya existente (`handoff_card.py`).
