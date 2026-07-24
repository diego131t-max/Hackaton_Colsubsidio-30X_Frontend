# Contrato de datos (sección 4)

> El corazón de todo — fíjenlo antes de programar.
> Implementación validada en [`backend/models/schemas.py`](../backend/models/schemas.py) (Pydantic).

```json
{
  "lead_id": "uuid-generado-por-frontend",
  "timestamp": "ISO-8601",
  "canal_origen": "pauta_digital",
  "proyecto_interes": "Nuva Park",
  "tipo_proyecto": "vis | no_vis",

  "identificacion": {
    "nombre": "string",
    "apellidos": "string",
    "tipo_identificacion": "CC | TI | CE | NUIP | ...",
    "numero_identificacion": "string",
    "correo": "string",
    "telefono": "string (con indicativo, listo para que Dapta marque)"
  },

  "afiliacion": {
    "tipo": "afiliado_trabajador | beneficiario | no_afiliado"
  },

  "financiero": {
    "ingreso_rango_declarado": "string (ej. '$7.115.001 – $10.000.000')",
    "ingreso_estimado_numerico": "number, para que el motor de reglas calcule"
  },

  "preferencias": {
    "zona_interes": "string",
    "urgencia": "alta | media | baja",
    "personas_a_cargo": "number"
  },

  "señales_comportamiento": {
    "tiempo_total_bowl_segundos": "number",
    "pasos_completados": "number",
    "abandono_en_paso": "string | null"
  }
}
```

**Regla de oro para las 3 personas que construyen en paralelo:** nadie agrega un campo nuevo a este objeto sin avisar en el grupo. Si Carlos necesita capturar algo nuevo en el bowl, primero se agrega aquí, luego se implementa — nunca al revés.
