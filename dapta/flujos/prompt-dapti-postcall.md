# Prompt para Dapti — flow post-llamada (WhatsApp + retorno al backend)

Pegar la sección "PROMPT" en el chat de Dapti. Lo demás es contexto nuestro.

## Por qué esto NO va en el enrutador

Medido: `Colsubsidio - Enrutador de Leads` termina en **290 ms de media**. Las
llamadas duran entre 50 y 130 segundos. El nodo de llamada solo la ENCOLA y
devuelve; cuando el flow acaba, el teléfono todavía no ha sonado.

Así que dentro del enrutador no existe la información "no contestó": preguntarla
ahí devolvería siempre lo mismo. El seguimiento tiene que colgar del evento
post-llamada, que es cuando Dapta ya sabe cómo terminó.

## Qué cambia en el cableado

Hoy los dos agentes mandan su post-call directo a nuestro backend. Con este flow
en medio, pasan a mandárselo al flow, y el flow:

```
agente ──post-call──> FLOW ──1──> backend (SIEMPRE, es lo primero)
                        └───2──> ¿no contestó? ──> WhatsApp
                        └───3──> responde algo
```

El orden importa: el reenvío al backend va PRIMERO. Si la línea de WhatsApp no
existe todavía —hoy no existe— ese nodo falla, y no queremos que un fallo del
seguimiento se lleve por delante el resultado de la llamada.

Riesgo asumido: si el flow entero se cae, perdemos el resultado. Se puede
revertir en un minuto devolviendo el webhook de los agentes a nuestro backend.

## Ojo con el doble envío

Nuestro backend también tiene un gancho de seguimiento (WhatsApp y correo),
apagado por `DAPTA_WHATSAPP_ACTIVO=false`. Mientras el flow se encargue del
WhatsApp, esa variable se queda apagada. Si algún día se enciende, la persona
recibiría dos mensajes.

---

# PROMPT (copiar desde aquí)

Necesito un segundo flow que se ejecute DESPUÉS de cada llamada. No toques
`Colsubsidio - Enrutador de Leads`: ese dispara las llamadas y está funcionando.

Nómbralo: **Colsubsidio - Post Llamada**

## 1. Trigger

Webhook POST. Recibe el evento post-llamada de los agentes de voz, que llega con
la forma nativa de Dapta: todo anidado dentro de un objeto `call`.

Los campos que voy a usar son:

- `{{trigger.body.call.disconnection_reason}}`
- `{{trigger.body.call.to_number}}`
- `{{trigger.body.call.call_analysis.custom_analysis_data.calificacion_lead}}`
- `{{trigger.body.call.dynamic_variables.contact_name}}`
- `{{trigger.body.call.dynamic_variables.proyecto_recomendado}}`

## 2. Nodo HTTP — "Devolver al backend" (VA PRIMERO)

Antes de cualquier otra cosa, reenvía el evento completo a nuestro backend.

- Método: POST
- URL: `https://hackaton-colsubsidio-30x-frontend.onrender.com/webhooks/dapta/resultado`
- Cuerpo: el body del trigger **tal cual llegó, sin transformar**. Nuestro
  backend ya entiende la forma nativa con el objeto `call` anidado.
- `on_error`: que un fallo aquí marque la ejecución como fallida. Este es el
  nodo que no puede perderse en silencio.

Va primero a propósito: es el que mete el lead en la ficha del asesor. El
seguimiento por WhatsApp es deseable; esto es obligatorio.

## 3. Nodo Code — "¿Contestó?"

Devuelve una sola variable, `contesto`, como el texto `"true"` o `"false"`.

Es `"false"` cuando `disconnection_reason` sea uno de: `dial_no_answer`,
`voicemail`, `dial_busy`, `dial_failed`, `invalid_destination`, `no_answer`.
En cualquier otro caso, `"true"`.

Devuélvelo como texto, no como booleano: en el otro flow los condicionales
comparan contra la cadena `"true"` y no quiero depender de cómo se interpole un
booleano.

## 4. Condicional — "¿Contestó?"

Evalúa `contesto`.

- `"true"` → termina, no hay nada más que hacer.
- `"false"` → sigue al nodo de WhatsApp.

## 5. Nodo "Send Whatsapp Template" — solo si NO contestó

- Destinatario: `{{trigger.body.call.to_number}}`
- Plantilla: usa una que diga, en esencia:

  > Hola {{1}}, te llamamos desde Colsubsidio Vivienda para hablar de tu
  > búsqueda de vivienda y no logramos comunicarnos. ¿Te queda mejor que te
  > llamemos en otro momento? Respóndenos por aquí y te ayudamos.

  Con `{{1}}` = `{{trigger.body.call.dynamic_variables.contact_name}}`.

- **`on_error`: continuar.** Hoy no hay línea de WhatsApp Business conectada, así
  que este nodo va a fallar. Es esperado y no debe marcar la ejecución como
  fallida: para cuando llega aquí, el resultado ya está guardado en el paso 2.

Si la plantilla necesita aprobación de Meta y todavía no existe, déjalo
configurado igual y dime qué falta.

## 6. Respuesta del flow

Configura `response_params` para que el flow devuelva un JSON con:

- `recibido`: el `call_id`
- `contesto`: la variable del paso 3
- `reenviado_al_backend`: el código HTTP que devolvió el paso 2
- `whatsapp`: `enviado`, `omitido` o `error`, según lo que haya pasado

Ahora mismo el flow responde "If you want to return a response, you must
configure the response_params", que no sirve para diagnosticar nada cuando algo
falla.

## 7. Cuando lo termines, dame

1. La URL del webhook del flow, **con su x-api-key**.
2. Confirmación de que el reenvío al backend va antes que el WhatsApp.
3. Confirmación de que el nodo de WhatsApp está en `on_error: continuar` y el de
   reenvío no.

# (fin del prompt)

---

## Después de que Dapti lo cree

1. Cambiar el `dapta_webhook` de los DOS agentes para que apunte a este flow en
   vez de a nuestro backend. Se hace por MCP en una llamada.
2. Probar con una llamada contestada: debe llegar a la ficha del asesor.
3. Probar con una no contestada (no responder al teléfono): debe llegar igual, y
   el nodo de WhatsApp debe fallar sin tumbar la ejecución.
4. Cuando exista la línea de WhatsApp, ese nodo empieza a funcionar solo.
