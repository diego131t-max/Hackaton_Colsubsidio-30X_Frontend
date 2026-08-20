# Prompt para Dapti — flow completo de llamadas

La sección "PROMPT" de abajo se pega tal cual en el chat de Dapti dentro de
Dapta. Lo de antes y lo de después es contexto nuestro, no se pega.

## Por qué esto lo arma Dapti y no nosotros por MCP

El balanceador de Dapta corta cualquier petición de más de 8192 bytes. Un solo
nodo "Dapta Phone Call" pesa 4560 bytes de configuración, así que un flow con
condicionales y dos nodos de llamada ronda los 14 KB: imposible de desplegar
por `preview_create_flow`. Dentro de la plataforma ese límite no aplica.

## Qué ya existe (para que Dapti no lo duplique)

- Los dos agentes de voz, con su prompt, su voz y sus 10 campos de extracción.
- El webhook post-call, ya configurado **en ambos agentes**, apuntando a nuestro
  backend. No va en el flow.
- Dos flows sueltos de una sola llamada (`i1UVz`, `fKcku`) que sirvieron para
  probar. Cuando el enrutador funcione, se borran.

## Decisión: el seguimiento por WhatsApp NO va en el flow

Los agentes de texto de Dapta no aceptan ni una sola variable. No hay forma de
pasarles el nombre, el proyecto ni la cuota. El contexto tiene que viajar dentro
del PRIMER MENSAJE, en prosa, y el único que tiene el lead completo para
redactarlo es el backend. Por eso ese salto vive en `enviar_whatsapp_seguimiento`,
disparado desde el webhook post-call cuando `disconnection_reason` es
`dial_no_answer`.

Meterlo en el flow obligaría al agente de texto a preguntar de nuevo lo que la
persona ya llenó en el formulario — el problema exacto que este proyecto existe
para corregir.

---

# PROMPT (copiar desde aquí hasta el final del bloque)

Necesito un flow en Flow Studio, de principio a fin, que reciba un lead de
vivienda desde nuestro backend y lo llame con el agente de voz que corresponda.

Nómbralo: **Colsubsidio - Enrutador de Leads**

## 1. Trigger

Webhook POST. El body trae estos 19 campos, todos de tipo texto y todos
opcionales (el backend siempre los manda, pero un campo vacío no debe tumbar
la ejecución):

nombre, telefono, proyecto, afiliado, tipo_vivienda, current_time,
rango_ingreso, zona_interes, urgencia, edad, entorno_deseado, personas_a_cargo,
piso_preferido, tipo_inmueble, proyecto_recomendado, cuota_estimada_mensual,
valor_estimado_vivienda, subsidio_estimado, external_lead_id

## 2. Nodo Code — "Validar lead"

Antes de gastar una llamada, valida la entrada. Devuelve estos tres campos:

- `telefono_valido`: true solo si `{{trigger.body.telefono}}` cumple el formato
  E.164 de móvil colombiano, es decir `+57` seguido de 10 dígitos que empiezan
  por 3. Ejemplo válido: `+573125923915`.
- `telefono`: el mismo número, sin espacios ni guiones.
- `es_afiliado`: true solo si `{{trigger.body.afiliado}}` es exactamente `true`
  o la cadena `"true"`. Cualquier otra cosa (false, vacío, nulo, `"0"`) es false.

Que la afiliación se resuelva aquí y no en el condicional es a propósito: quiero
un único sitio donde se decida, y que ese sitio trate el vacío como "no
afiliado".

## 3. Condicional — "¿Teléfono válido?"

Evalúa `telefono_valido` del nodo anterior.

- Falso → termina el flow ahí, sin llamar a nadie.
- Verdadero → sigue al condicional de afiliación.

Un número mal formado hace que la telefonía falle igual, pero gastando el
intento y ensuciando el reporte de llamadas.

## 4. Condicional — "¿Es afiliada?"

Evalúa `es_afiliado` del nodo Code.

- Verdadero → rama A
- Falso → rama B

**El caso por defecto tiene que ser la rama B.** Si la afiliación llega vacía o
rara, la persona se trata como NO afiliada. El agente de no afiliados tiene
prohibido prometer subsidios, así que equivocarse hacia ese lado no genera una
promesa que no podamos cumplir. Al revés sí.

## 5. Rama A — nodo "Dapta Phone Call"

- Agente: **Manuela — Vivienda Afiliados** (`1c92622f-9a33-4043-b2d0-342c4309cedf`)
- From Number: `+15179945094`
- To Number: el `telefono` que devolvió el nodo Code

## 6. Rama B — nodo "Dapta Phone Call"

- Agente: **Manuela — Vivienda No Afiliados** (`82f36ebd-f28e-46dd-bb21-93fa58b8dcd9`)
- From Number: `+15179945094`
- To Number: el `telefono` que devolvió el nodo Code

## 7. Variables — LAS MISMAS 15 EN LOS DOS NODOS DE LLAMADA

La columna izquierda es el nombre que usa el prompt del agente; la derecha, de
dónde sale. Si falta una, el agente la pronuncia literalmente durante la
llamada, así que tienen que estar las 15 en ambas ramas.

| Variable | Valor |
|---|---|
| contact_name | `{{trigger.body.nombre}}` |
| current_time | `{{trigger.body.current_time}}` |
| edad | `{{trigger.body.edad}}` |
| tipo_vivienda | `{{trigger.body.tipo_vivienda}}` |
| rango_ingreso | `{{trigger.body.rango_ingreso}}` |
| zona_interes | `{{trigger.body.zona_interes}}` |
| entorno_deseado | `{{trigger.body.entorno_deseado}}` |
| personas_a_cargo | `{{trigger.body.personas_a_cargo}}` |
| piso_preferido | `{{trigger.body.piso_preferido}}` |
| tipo_inmueble | `{{trigger.body.tipo_inmueble}}` |
| urgencia | `{{trigger.body.urgencia}}` |
| proyecto_recomendado | `{{trigger.body.proyecto_recomendado}}` |
| cuota_estimada_mensual | `{{trigger.body.cuota_estimada_mensual}}` |
| valor_estimado_vivienda | `{{trigger.body.valor_estimado_vivienda}}` |
| subsidio_estimado | `{{trigger.body.subsidio_estimado}}` |

Ojo con `contact_name`: sale de `nombre`. Es el único que cambia de nombre.

## 8. Manejo de errores

Los nodos de llamada traen `on_error: continue` por defecto. Cámbialo en ambos
para que un fallo del nodo marque la ejecución como fallida.

Lo pido porque ya nos pasó: el servicio de telefonía devolvió 403, el nodo se lo
tragó y el flow apareció como exitoso con cero llamadas hechas. Un panel en
verde mientras nadie recibe llamadas es peor que un error.

## 9. Lo que este flow NO debe hacer

- Nada de WhatsApp, SMS ni correo. El seguimiento cuando no contestan lo maneja
  nuestro backend desde el webhook post-call.
- Nada de CRM, Google Sheets ni notificaciones.
- No toques la configuración de los agentes de voz: su prompt, su webhook
  post-call y sus campos de extracción ya están puestos y probados.
- No agregues un nodo de análisis post-llamada: ya está resuelto en el agente.

## 10. Cuando lo termines, dame

1. La URL del webhook del flow.
2. Confirmación de que ambos nodos de llamada quedaron con las 15 variables.
3. Confirmación de que `on_error` ya no es `continue`.

## 11. Cómo lo voy a probar

Con estos dos payloads. El primero debe entrar por la rama A y el segundo por la
rama B; cambia el teléfono por uno tuyo antes de dispararlos.

```json
{
  "nombre": "Prueba Afiliado", "telefono": "+573125923915", "afiliado": true,
  "tipo_vivienda": "vis", "current_time": "2026-08-20 09:00",
  "rango_ingreso": "$2.800.000 – $5.700.000", "zona_interes": "Bosa",
  "urgencia": "alta", "edad": "34", "entorno_deseado": "Piscina, Zona kids",
  "personas_a_cargo": "2", "piso_preferido": "2", "tipo_inmueble": "apartamento",
  "proyecto_recomendado": "Florecer", "cuota_estimada_mensual": "1700000",
  "valor_estimado_vivienda": "207580000", "subsidio_estimado": "42000000",
  "proyecto": "Florecer", "external_lead_id": "prueba-a"
}
```

```json
{
  "nombre": "Prueba No Afiliado", "telefono": "+573125923915", "afiliado": false,
  "tipo_vivienda": "vis", "current_time": "2026-08-20 09:00",
  "rango_ingreso": "$2.800.000 – $5.700.000", "zona_interes": "Bosa",
  "urgencia": "alta", "edad": "34", "entorno_deseado": "Piscina, Zona kids",
  "personas_a_cargo": "2", "piso_preferido": "2", "tipo_inmueble": "apartamento",
  "proyecto_recomendado": "Florecer", "cuota_estimada_mensual": "1700000",
  "valor_estimado_vivienda": "207580000", "subsidio_estimado": "0",
  "proyecto": "Florecer", "external_lead_id": "prueba-b"
}
```

Y un tercero que NO debe llamar a nadie, para comprobar el guardia del paso 3:
el mismo payload pero con `"telefono": "312592"`.

# (fin del prompt)

---

## Después de que Dapti lo cree

1. Pedirle la URL del webhook.
2. Ponerla en Render como `DAPTA_FLOW_WEBHOOK_AFILIADO` **y** como
   `DAPTA_FLOW_WEBHOOK_NO_AFILIADO`. Con el enrutador las dos apuntan al mismo
   sitio y la decisión la toma el flow. El backend no cambia: ya elige URL por
   afiliación, y si ambas son iguales el resultado es el mismo.
3. Disparar los tres payloads de prueba.
4. Borrar los flows viejos `i1UVz` y `fKcku`, que quedan sin uso.

## Pendiente de investigar: correlación por lead

Hoy el backend correlaciona el resultado post-call con el lead **por teléfono**,
porque el webhook de Dapta no trae nuestro `external_lead_id`. Ya nos costó un
bug: 26 leads compartían 17 teléfonos y un resultado aterrizó en la persona
equivocada. Está mitigado exigiendo `resultado_dapta is null`, pero la
correlación sigue siendo indirecta.

Existe un nodo "Add Data To Call" que adjunta `extra_data` a una llamada. Si eso
viaja de vuelta en el webhook post-call, resolvería la correlación de raíz. No
lo metí en el prompt porque no está verificado y un nodo extra que falle puede
tumbar la llamada. Vale la pena probarlo aparte, con el flow ya estable.
