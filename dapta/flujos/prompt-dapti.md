# Prompt para Dapti — flow enrutador de leads

Pegar TAL CUAL en el chat de Dapti dentro de Dapta. Está en español a propósito:
Dapti responde en el idioma en que se le escribe.

## Por qué esto lo arma Dapti y no nosotros por MCP

El balanceador de Dapta corta cualquier petición de más de 8192 bytes. Un solo
nodo "Dapta Phone Call" pesa 4560 bytes de configuración, así que un flow con
condicional + dos nodos de llamada ronda los 14 KB: imposible de desplegar por
`preview_create_flow`. Dentro de la plataforma ese límite no aplica.

Los dos flows sueltos que ya existen (`i1UVz` afiliados, `fKcku` no afiliados)
sí cupieron porque tienen un solo nodo de llamada cada uno. Sirven de referencia
viva: están desplegados y ya generaron una llamada real.

## Decisión de diseño: el seguimiento por WhatsApp NO va en este flow

Parece natural colgar una rama "si no contesta → WhatsApp" del mismo flow. No lo
hagas, por una razón concreta: **los agentes de texto de Dapta no aceptan ni una
sola variable**. No hay forma de pasarles el nombre, el proyecto ni la cuota.

El contexto tiene que viajar dentro del PRIMER MENSAJE, redactado en prosa. Y
quien puede redactarlo es el backend, que es el único que tiene el lead
completo. Por eso ese salto vive en `backend/integrations/dapta_client.py`
(`enviar_whatsapp_seguimiento`), disparado desde el webhook post-call cuando
`disconnection_reason` es `dial_no_answer`. Está escrito y gated por
`DAPTA_WHATSAPP_ACTIVO`; se enciende cuando exista la línea de WhatsApp Business.

Meterlo en el flow obligaría a que el agente de texto pregunte de nuevo lo que la
persona ya llenó en el formulario — exactamente el problema que este proyecto
existe para corregir.

---

# PROMPT (copiar desde aquí)

Necesito un flow en Flow Studio que enrute leads de vivienda a uno de dos
agentes de voz según si la persona está afiliada a Colsubsidio o no.

Nómbralo: **Colsubsidio - Enrutador de Leads**

## 1. Trigger

Webhook POST. El body trae estos campos (todos opcionales, tipo texto):

nombre, telefono, proyecto, afiliado, tipo_vivienda, current_time,
rango_ingreso, zona_interes, urgencia, edad, entorno_deseado, personas_a_cargo,
piso_preferido, tipo_inmueble, proyecto_recomendado, cuota_estimada_mensual,
valor_estimado_vivienda, subsidio_estimado, external_lead_id

## 2. Condicional

Evalúa `{{trigger.body.afiliado}}`.

- Si es verdadero (true) → rama A
- En cualquier otro caso (false, vacío, nulo) → rama B

Que el caso por defecto sea la rama B es intencional: si la afiliación llega
vacía, es más seguro tratar a la persona como NO afiliada. El agente de no
afiliados tiene prohibido prometer subsidios, así que un error en esa dirección
no genera una promesa que no podamos cumplir. Al revés sí.

## 3. Rama A — nodo "Dapta Phone Call"

- Agente: **Manuela — Vivienda Afiliados** (`1c92622f-9a33-4043-b2d0-342c4309cedf`)
- From Number: `+15179945094`
- To Number: `{{trigger.body.telefono}}`

## 4. Rama B — nodo "Dapta Phone Call"

- Agente: **Manuela — Vivienda No Afiliados** (`82f36ebd-f28e-46dd-bb21-93fa58b8dcd9`)
- From Number: `+15179945094`
- To Number: `{{trigger.body.telefono}}`

## 5. Variables — LAS MISMAS EN LOS DOS NODOS

Son 15. La izquierda es el nombre que usa el prompt del agente; la derecha, de
dónde sale. Si falta una, el agente la pronuncia literalmente en la llamada.

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

Ojo: `contact_name` sale de `nombre`. Es el único que cambia de nombre.

## 6. Manejo de errores — importante

Los nodos de llamada vienen con `on_error: continue` por defecto. Cámbialo para
que un fallo del nodo marque la ejecución como fallida.

Lo pido porque ya nos pasó: el servicio de telefonía devolvió 403, el nodo se lo
tragó y el flow apareció como exitoso con cero llamadas hechas. En producción
eso significa un panel en verde mientras nadie recibe llamadas.

## 7. Lo que NO debe hacer este flow

- No agregues nodos de WhatsApp, SMS ni correo. El seguimiento cuando no
  contestan lo maneja nuestro backend desde el webhook post-call.
- No agregues nodos de CRM ni de Google Sheets.
- No toques la configuración de los agentes de voz: su prompt y sus campos de
  extracción ya están puestos.

Cuando lo tengas, dame la URL del webhook del flow.

# (fin del prompt)

---

## Después de que Dapti lo cree

1. Pedirle la URL del webhook.
2. Ponerla en Render como `DAPTA_FLOW_WEBHOOK_AFILIADO` **y** como
   `DAPTA_FLOW_WEBHOOK_NO_AFILIADO`. Con el enrutador, las dos apuntan al mismo
   sitio y la decisión la toma el flow.
3. El backend sigue funcionando sin cambios: ya elige URL por afiliación, y si
   ambas son iguales el resultado es el mismo.
4. Probar con un lead `afiliado: true` y otro `false`, verificando en Dapta que
   cada uno entró al agente correcto.
