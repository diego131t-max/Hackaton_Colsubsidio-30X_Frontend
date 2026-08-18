# Manuela en WhatsApp — por qué NO son los mismos agentes

Respuesta corta: los prompts de voz no se pueden reutilizar tal cual. Hay que
crear agentes de TEXTO aparte. Las razones son de la plataforma, no de estilo.

## Las tres diferencias que lo impiden

1. **Los agentes de texto de Dapta no aceptan variables.** Cero. La guía del MCP
   lo dice sin matices: "ZERO runtime input variables anywhere — do NOT use
   `{{variable_name}}` or any `{{token}}`". Todo el andamiaje de voz
   (`{{proyecto_recomendado}}`, `{{cuota_estimada_mensual}}`,
   `{{contact_name}}`…) no tiene dónde entrar. Si se dejan, el agente los
   escribe literalmente en el chat.

2. **No se envía un prompt completo.** En voz se pasa `instructions` con el
   prompt entero. En texto se pasa `important_instructions`: una pista de
   comportamiento de 1 a 3 frases, y la plataforma GENERA el prompt a partir del
   `company_context`. Es un modelo distinto: se configura, no se escribe.

3. **La mitad del prompt de voz es maquinaria de voz.** Reglas de pronunciación,
   cómo leer un teléfono, cómo decir una cifra en millones, no leer correos en
   voz alta, ceder ante interrupciones, `end_call`. En WhatsApp nada de eso
   aplica — y algunas reglas se invierten: por chat SÍ conviene mandar el enlace
   a la ficha del proyecto, cosa que en voz está prohibida.

## Qué sí se reutiliza

El conocimiento, que es lo que costó construir:

- El catálogo de proyectos (`dapta/nucleo/catalogo-proyectos.md`, generado desde
  el seed del backend).
- El criterio de calificación caliente / tibio / frío.
- La estrategia de conversión para no afiliados.
- El contrato de salida hacia el backend.

Por eso el catálogo va en `company_description`: es la vía por la que el
conocimiento entra al agente de texto sin necesitar variables.

## Cómo llega el contexto del lead sin variables

Este es el punto que hay que resolver al conectar la línea. Tres opciones, de
mejor a peor:

1. **El backend abre la conversación con el contexto dentro del primer
   mensaje.** Es lo que ya hace `dapta_client.enviar_whatsapp_seguimiento`: manda
   un mensaje de apertura redactado por nosotros. Ahí caben el nombre, el
   proyecto y la cuota, en prosa. El agente lee ese mensaje como parte del hilo y
   tiene el contexto sin ninguna variable.
2. **Un flow de FlowStudio que consulte el backend** antes de responder. Más
   trabajo, más piezas que se pueden caer.
3. **Que el agente lo pregunte.** Es la peor: la persona ya llenó el formulario y
   volver a preguntarle repite exactamente el problema que este proyecto existe
   para corregir.

Vamos con la opción 1.

---

# Payloads listos para crear los dos agentes de texto

Cuando esté la cuenta nueva y la línea de WhatsApp Business conectada, se crean
con `preview_create_text_agent` y luego `commit_create_text_agent`.

`workspace_id`, `author_id`, `author_name` y `author_email` NO se pasan: los
inyecta la API key.

## Agente 1 — afiliados

```
agent_name:  "Dapti"
purpose:     "266"
language:    "es"
company_name: "Colsubsidio Vivienda"
company_description: <el contenido de dapta/build/whatsapp-contexto-afiliados.txt>
important_instructions:
  "Eres Manuela, asesora de vivienda de Colsubsidio, escribiendo por WhatsApp a
   una persona YA AFILIADA que dejó sus datos en el formulario. Tu meta es
   resolver sus dudas del proyecto que le recomendamos y agendar una visita o
   asesoría de lunes a viernes entre 8am y 4pm, proponiendo tú un horario
   concreto. Mensajes cortos, tono colombiano cercano, una pregunta a la vez, y
   nunca inventes precios ni montos de subsidio que no estén en tu contexto."
```

## Agente 2 — no afiliados

```
agent_name:  "Dapti"
purpose:     "266"
language:    "es"
company_name: "Colsubsidio Vivienda"
company_description: <el contenido de dapta/build/whatsapp-contexto-no-afiliados.txt>
important_instructions:
  "Eres Manuela, asesora de vivienda de Colsubsidio, escribiendo por WhatsApp a
   una persona que NO es afiliada y dejó sus datos en el formulario. Tu meta es
   que se afilie: explica que la afiliación es el primer paso para acceder a
   subsidios y mejores condiciones, pregunta si trabaja con contrato, es
   independiente o tiene empresa, y agenda una asesoría de lunes a viernes entre
   8am y 4pm. NUNCA confirmes cupo de un proyecto, montos de subsidio ni
   elegibilidad: eso lo valida el asesor. Mensajes cortos, tono cercano, una
   pregunta a la vez."
```

## Diferencias de conducta respecto a la voz

- Sí puedes mandar el enlace a la ficha oficial del proyecto (`url_ficha` del
  catálogo). En voz está prohibido; por chat es lo más útil que puedes hacer.
- Sí puedes escribir cifras con números ("$207.580.000") en vez de deletrearlas.
- Los emojis están permitidos con moderación: los agentes de texto los renderizan
  nativamente y en WhatsApp lo raro es no usarlos. En voz están prohibidos.
- No hay `end_call`: la conversación queda abierta.
- La brevedad sigue mandando, pero por otra razón: en WhatsApp un párrafo largo
  no se lee, se ignora.
