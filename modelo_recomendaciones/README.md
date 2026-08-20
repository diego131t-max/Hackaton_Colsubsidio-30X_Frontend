# Modelo de recomendaciones

Dos motores conviven en esta carpeta, y no por indecisión: hacen cosas distintas.

## `motor/` — recomendador (v2, el que rankea)

Autor: Santiago. Es el que decide qué proyectos ve el lead.

```
primer_filtro    filtro duro: tipo de vivienda, localidad, zonas comunes,
                 alcobas. Si quedan menos de 10 candidatos aplica una ESCALERA
                 DE RELAJACIÓN y expande a localidades vecinas por grafo.
      |
modelo           Nearest Neighbors en dos modos:
                 - contenido: perfil objetivo de cada proyecto vs. el usuario
                 - colaborativo: k vecinos en el historial, ponderados
      |
post_arreglos    normaliza el score a un porcentaje legible (62–98)
```

El score final mezcla `modelo` (0.70), `zonas` (0.20) y `localidad` (0.10). El
componente colaborativo pesa 0.60 dentro de `modelo` cuando hay historial.

### Qué es real y qué no

`historial_simulado.json` son **4.043 interacciones generadas**, no
comportamiento de compradores reales. El componente colaborativo aprende de
datos sintéticos. Para el demo funciona y el ranking es coherente, pero no debe
presentarse como aprendizaje sobre clientes reales hasta que haya historial de
verdad — que es justo lo que este piloto empezará a producir.

El porcentaje que ve la persona tampoco es el score crudo: `post_arreglos`
sortea el del primero entre 85 y 98 y baja los demás en proporción a su
diferencia real. Es una capa comercial sobre un ranking que sí es real. El
backend le fija una semilla derivada del perfil para que el mismo lead vea
siempre el mismo número.

## `recomendaciones.py` — reglas financieras (v1, lo que queda vivo)

Ya no rankea nada. Se conserva solo por `Parametros` (SMMLV, topes de subsidio)
y `parsear_ingreso_mensual`: son las cifras que Manuela dice por teléfono. No
tienen que ver con el ranking y estaban probadas, así que reescribirlas habría
mezclado dos cambios en uno.

## Regenerar el catálogo del motor

```bash
python modelo_recomendaciones/tools/regenerar_modelo.py
```

Toma `frontend/data/proyectos_seed.json` (el scrapeo real, fuente única) y
produce `motor/proyectos_model.json` con las features derivadas. Correrlo cada
vez que cambie el seed.

No se guarda una copia del seed dentro de `motor/`. Un tercer catálogo se
desincroniza en silencio: ya nos pasó, y el síntoma no fue un error sino
recomendaciones peores durante semanas.

## El desglose que ve el asesor

La ficha muestra de dónde sale el match. Los componentes se reescalan para sumar
el porcentaje mostrado, conservando las proporciones:

| Componente | Qué mide |
|---|---|
| Perfil | Cercanía demográfica al perfil objetivo del proyecto |
| Historial | Señal de los vecinos en el historial |
| Amenidades | Cobertura de las zonas comunes pedidas |
| Localidad | Cercanía a la localidad buscada |

Los leads capturados antes del cambio conservan el desglose v1 (entorno /
capacidad / asequibilidad / beneficio caja) y el dashboard los sigue pintando:
detecta qué claves trae cada fila.
