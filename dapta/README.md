# Agentes de Dapta — Manuela

Dos agentes de VOZ especializados (afiliados / no afiliados) y sus equivalentes
de TEXTO para WhatsApp. Todo se define aquí, en el repo, y desde aquí se publica
a Dapta. La plataforma no es la fuente de verdad.

## Por qué dos agentes y no uno con un `if`

El prompt anterior manejaba ambos casos ramificando por `{{afiliado}}`. Se
separan porque **no cambia el guion, camben los límites**:

| | Afiliados | No afiliados |
|---|---|---|
| Objetivo primario | Calificar la compra | Convertir en afiliada |
| Puede citar subsidio | Sí, como estimado | **No**, ni montos ni porcentajes |
| Puede confirmar proyecto | Sí | **No**, solo como referencia |
| Techo de calificación | Caliente | Tibio en la práctica |
| Pregunta clave | Ahorros, primas, cesantías | Situación laboral |

Meter dos conjuntos de prohibiciones opuestas en un solo prompt hace que el
modelo se filtre de un lado al otro justo donde más caro sale: prometiéndole un
subsidio a alguien que todavía no puede recibirlo.

## Estructura

```
dapta/
  nucleo/                     compartido por los dos agentes
    catalogo-proyectos.md     GENERADO desde backend/data/proyectos_seed.json
    politicas-comunes.md      estilo, pronunciación, límites, agendamiento
    salida-estructurada.md    contrato con el backend (custom_analysis_data)
  voz/
    afiliados.md              identidad, objetivos, flujo y criterio
    no-afiliados.md
  whatsapp/
    README.md                 por qué son agentes distintos + payloads de texto
  build/                      SALIDA — lo que se pega en Dapta (no se edita)
  tools/
    generar_catalogo_prompt.py
    construir_prompts.py
```

Regla: **nunca se edita `build/` ni se edita el prompt en la plataforma.** Se
edita el núcleo o la variante y se reconstruye. Editar en Dapta desincroniza en
silencio, que es exactamente lo que pasó con el catálogo la vez pasada.

## Reconstruir

```bash
python dapta/tools/generar_catalogo_prompt.py > dapta/nucleo/catalogo-proyectos.md
python dapta/tools/construir_prompts.py
```

El segundo verifica antes de escribir:

- que no queden variables `{{...}}` fuera de las 15 que Dapta inyecta (una
  huérfana se **pronuncia en voz alta** durante la llamada);
- que estén todos los campos del contrato de salida (si falta uno, el webhook
  responde 200 y el asesor recibe la ficha coja, sin ningún error visible);
- que se mencione `end_call`.

`--check` verifica sin escribir. Devuelve código 1 si algo falla, así que sirve
en CI.

## El prompt NO se puede subir por API: hay que pegarlo

Medido, no supuesto: el balanceador de Dapta (`server: awselb/2.0`) responde
**403 a cualquier peticion con cuerpo mayor de 8192 bytes** — el umbral exacto
de la regla `SizeRestrictions_BODY` de AWS WAF. Comprobado por biseccion:

```
 8121 bytes -> 200        10121 bytes -> 403
 8221 bytes -> 403        29121 bytes -> 403
```

Nuestros prompts pesan ~29 KB, asi que `create_voice_agent` y
`commit_update_voice_agent` **no pueden transportarlos**. No es algo que se
arregle recortando: habria que cortar el 72 por ciento. Tampoco hay API REST
publica para el campo `instructions`.

Consecuencia practica: los agentes se crean por MCP con todo lo demas correcto
(proposito, voz, idioma, contexto de empresa) y el prompt se pega **a mano**
desde la interfaz, una vez por agente y cada vez que cambie.

Se crean con un marcador `PROMPT PENDIENTE DE PEGAR` que instruye al agente a
disculparse y colgar. Es deliberado: si alguien llama antes de pegar el prompt,
falla de forma visible en vez de sonar plausible y calificar mal a un lead.

### Agentes creados

| Agente | ID | Prompt a pegar |
|---|---|---|
| Manuela — Vivienda Afiliados | `1c92622f-9a33-4043-b2d0-342c4309cedf` | `dapta/build/voz-afiliados.txt` |
| Manuela — Vivienda No Afiliados | `82f36ebd-f28e-46dd-bb21-93fa58b8dcd9` | `dapta/build/voz-no-afiliados.txt` |

Se abren en `https://app.dapta.ai/agents-studio/voice-agents/<id>`.

Al pegar, el editor de Dapta convierte las vinetas `- ` en parrafos sueltos.
Verificado que NO se pierde contenido: 272 y 276 lineas con contenido, cero
faltantes y cero anadidas respecto al archivo de `build/`. Por eso comparar
tamanos en bruto da un falso negativo (~72 caracteres de diferencia): hay que
comparar los conjuntos de lineas.

### Campos de extraccion: el otro punto donde se corta el circuito

Pegar el prompt NO basta. El prompt le pide al agente que produzca
`calificacion_lead`, `resumen_llamada` y los demas, pero Dapta solo incluye en
`custom_analysis_data` los campos **declarados en el agente**
(`post_call_analysis_data`). Si estan vacios: la llamada ocurre, el webhook
responde 200, el lead avanza y el asesor recibe la ficha vacia. Es el fallo
silencioso contra el que avisa `nucleo/salida-estructurada.md`.

Los dos agentes llevan los 10 campos del contrato, con los nombres exactos que
parsea `ResultadoCalificacionDapta`, y el webhook post-call apuntando a:

```
https://hackaton-colsubsidio-30x-frontend.onrender.com/webhooks/dapta/resultado
```

Esto SI se puede hacer por MCP (`preview_update_voice_agent` ->
`commit_update_voice_agent`): el payload son unos pocos KB y pasa el limite del
WAF. Lo unico que obliga a la interfaz es el prompt.

Esto no contradice la regla de arriba de no editar en la plataforma: la fuente
de verdad sigue siendo el repo. Lo que se pega es la salida de `build/`, nunca
texto escrito en Dapta.

## Publicar en la cuenta nueva de Dapta

El `workspace_id` lo inyecta la API key: **no se puede elegir cuenta desde la
llamada**. Para la cuenta nueva hay que generar su propia key y reconfigurar el
MCP con ella. Con eso hecho, cada agente de voz se crea así:

```
create_voice_agent(
  agent_name:             "Manuela — Vivienda Afiliados"        # o "… No Afiliados"
  agent_purpose:          "103"                                  # calificación de leads
  identity_name:          "Lia"                                  # plantilla base
  company_name:           "Colsubsidio Vivienda"
  company_description:    "Caja de compensación familiar colombiana con más de 45
                           años de trayectoria. Conecta familias con proyectos de
                           vivienda VIS y No VIS en Bogotá, con subsidios y
                           acompañamiento posterior a la entrega."
  company_website:        "https://www.colsubsidio.com/vivienda"
  important_instructions: ""
  instructions:           <contenido de dapta/build/voz-afiliados.txt>
  voice:                  "custom_voice_b7f9d4e2175e188767738b4a1c"
  voice_language:         "es-ES"
  model:                  "gpt-4.1"
)
```

No se pasan `workspace_id`, `author_id`, `author_email` ni `author_name`: los
inyecta la key y el servidor rechaza la llamada si van.

Los agentes de texto para WhatsApp van con otro par de tools
(`preview_create_text_agent` / `commit_create_text_agent`) y sus payloads están
en `dapta/whatsapp/README.md`.

## Después de crearlos: cablear el backend

Cada agente vive detrás de su propio flow, así que hay **dos webhooks** y el
backend elige según `senal.afiliado`. Las variables de entorno son:

```
DAPTA_FLOW_WEBHOOK_AFILIADO=https://...
DAPTA_FLOW_WEBHOOK_NO_AFILIADO=https://...
```

Si solo se define la vieja `DAPTA_FLOW_STUDIO_WEBHOOK_URL`, el backend la usa
para ambos casos y sigue funcionando igual que hoy — el cambio es compatible
hacia atrás a propósito, para que desplegar el código no dependa de tener las
dos URLs listas.

El webhook post-call de resultado (`/webhooks/dapta/resultado`) es **el mismo
para los dos agentes**: la correlación es por lead, no por agente. Hay que
pegarlo en la configuración de ambos.

## Checklist de puesta en marcha

- [x] Crear la cuenta nueva de Dapta y generar su API key
- [x] Reconfigurar el MCP (quedo como `dapta-colsubsidio`, en paralelo al viejo)
- [x] Crear los dos agentes de voz con los payloads de arriba
- [x] Pegar a mano el prompt de `build/` en cada agente (ver limite de 8 KB)
- [x] Pegar la URL del post-call webhook en AMBOS agentes
- [x] Declarar los 10 campos de `post_call_analysis_data` en AMBOS agentes
- [ ] Aprovisionar un número saliente que marque a móviles de Colombia
- [ ] Crear los dos flows y poner sus webhooks en Render
- [ ] Conectar la línea de WhatsApp Business (flujo Meta, lento) y crear los dos agentes de texto
- [ ] Probar con el número propio antes de activar `DAPTA_LLAMADAS_ACTIVAS`
