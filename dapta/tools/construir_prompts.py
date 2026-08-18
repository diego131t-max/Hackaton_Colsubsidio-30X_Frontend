#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Ensambla los prompts finales de los agentes de voz a partir del núcleo + variante.

    python dapta/tools/construir_prompts.py            # escribe dapta/build/
    python dapta/tools/construir_prompts.py --check    # verifica sin escribir

POR QUÉ NO SE ESCRIBEN LOS PROMPTS COMPLETOS A MANO
---------------------------------------------------
Los dos agentes comparten el 70 por ciento del texto: estilo, pronunciación,
límites, agendamiento, catálogo y contrato de salida. Mantener dos copias
garantiza que se separen — y la que se queda vieja no falla ruidosamente, solo
empieza a decir cosas distintas por teléfono.

Aquí cada bloque compartido vive una vez en dapta/nucleo/ y este script lo
inserta en las dos variantes. El catálogo, a su vez, se genera desde el seed del
backend (generar_catalogo_prompt.py), así que la cadena completa es:

    backend/data/proyectos_seed.json
      -> dapta/nucleo/catalogo-proyectos.md
      -> dapta/build/voz-afiliados.txt  y  voz-no-afiliados.txt

Lo que sale de dapta/build/ es lo que se pega en el campo `instructions` del
agente en Dapta (o lo que se pasa a create_voice_agent).

MARCADORES
----------
En las variantes, dos comentarios HTML marcan dónde entra cada bloque:
    <!-- CATALOGO -->  -> dapta/nucleo/catalogo-proyectos.md
    <!-- SALIDA -->    -> dapta/nucleo/salida-estructurada.md
Las políticas comunes se anexan siempre al final, antes de la salida.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[2]
NUCLEO = RAIZ / "dapta" / "nucleo"
VOZ = RAIZ / "dapta" / "voz"
BUILD = RAIZ / "dapta" / "build"

# Variables que el runtime de Dapta inyecta desde el webhook. Cualquier {{...}}
# que aparezca en el prompt y NO esté aquí es un token huérfano: Dapta no lo
# resuelve y el agente lo pronuncia literalmente en la llamada.
VARIABLES_VALIDAS = {
    "current_time", "contact_name", "edad", "tipo_vivienda", "rango_ingreso",
    "zona_interes", "entorno_deseado", "personas_a_cargo", "piso_preferido",
    "tipo_inmueble", "urgencia", "proyecto_recomendado",
    "cuota_estimada_mensual", "valor_estimado_vivienda", "subsidio_estimado",
}

VARIANTES = {
    "voz-afiliados": VOZ / "afiliados.md",
    "voz-no-afiliados": VOZ / "no-afiliados.md",
}


def sin_comentarios(texto: str) -> str:
    """Quita los comentarios HTML: son notas para nosotros, no para el agente."""
    return re.sub(r"<!--.*?-->\n?", "", texto, flags=re.DOTALL)


def construir(ruta_variante: Path) -> str:
    catalogo = sin_comentarios((NUCLEO / "catalogo-proyectos.md").read_text(encoding="utf-8"))
    salida = sin_comentarios((NUCLEO / "salida-estructurada.md").read_text(encoding="utf-8"))
    politicas = sin_comentarios((NUCLEO / "politicas-comunes.md").read_text(encoding="utf-8"))
    variante = ruta_variante.read_text(encoding="utf-8")

    if "<!-- CATALOGO -->" not in variante or "<!-- SALIDA -->" not in variante:
        raise SystemExit(f"ABORTADO: {ruta_variante.name} no tiene los marcadores CATALOGO/SALIDA")

    # El catálogo va dentro del contexto de la variante; las políticas comunes
    # entre el flujo y la salida; la salida al final (es lo último que el modelo
    # debe tener fresco al cerrar la llamada).
    texto = variante.replace("<!-- CATALOGO -->", catalogo.strip())
    texto = texto.replace("<!-- SALIDA -->", politicas.strip() + "\n\n" + salida.strip())
    texto = sin_comentarios(texto)
    # Colapsa los huecos que dejan los comentarios eliminados.
    texto = re.sub(r"\n{3,}", "\n\n", texto).strip() + "\n"
    return texto


# Bloques del núcleo que NO tienen sentido en un agente de texto: son maquinaria
# de voz. Dejarlos dentro del company_description no rompe nada, pero gasta
# contexto y arriesga que el agente escriba " - - - " o hable de "end_call".
def contexto_whatsapp(perfil: str) -> str:
    """
    company_description para el agente de TEXTO.

    Los agentes de texto no aceptan variables ni prompt completo, así que el
    conocimiento (catálogo + criterio) entra por aquí. Se excluye todo lo que
    solo aplica a una llamada.
    """
    catalogo = sin_comentarios((NUCLEO / "catalogo-proyectos.md").read_text(encoding="utf-8"))
    # El catálogo del núcleo menciona {{proyecto_recomendado}}, que en texto no
    # existe: se reescribe la instrucción sin el token.
    catalogo = catalogo.replace(
        "Guíate por\n{{proyecto_recomendado}}; usa la lista para dar detalles o si preguntan por\nun proyecto puntual.",
        "Usa la lista para dar detalles o si preguntan por un proyecto puntual.",
    )
    catalogo = re.sub(r"\{\{\w+\}\}", "el proyecto recomendado", catalogo)

    if perfil == "afiliados":
        encabezado = (
            "Colsubsidio es una caja de compensación familiar colombiana con más de 45 "
            "años de trayectoria. Escribes a personas YA AFILIADAS que dejaron sus datos "
            "en el formulario de vivienda y esperan seguimiento.\n\n"
            "Horario de asesores: lunes a viernes, de 8 de la mañana a 4 de la tarde.\n\n"
            "Como la persona ya es afiliada, tiene acceso a los beneficios de vivienda de "
            "la Caja. Puedes decirlo, pero los montos exactos de subsidio los confirma "
            "siempre un asesor.\n"
        )
        criterio = (
            "Criterio para clasificar el interés de la persona:\n"
            "- Caliente: aceptó visita o asesoría, declaró algún respaldo financiero "
            "(ahorros, cesantías o primas) y no dejó dudas fuertes sin resolver.\n"
            "- Tibio: interés real pero sin respaldo financiero claro, o quiere pensarlo.\n"
            "- Frío: no está interesada, no tiene respaldo ni lo tendrá pronto, o no "
            "acepta ningún siguiente paso.\n"
        )
    else:
        encabezado = (
            "Colsubsidio es una caja de compensación familiar colombiana con más de 45 "
            "años de trayectoria. Escribes a personas que NO son afiliadas y dejaron sus "
            "datos en el formulario de vivienda.\n\n"
            "Horario de asesores: lunes a viernes, de 8 de la mañana a 4 de la tarde.\n\n"
            "LÍMITES CRÍTICOS: no confirmes disponibilidad ni cupo de ningún proyecto, no "
            "cites montos de subsidio ni porcentajes, y no prometas que la persona "
            "califica para algo. Habla de beneficios POSIBLES, nunca garantizados. Quien "
            "valida elegibilidad y el camino de afiliación (empleada, independiente o con "
            "empresa) es siempre un asesor. Puedes mencionar proyectos y su precio desde "
            "como referencia de lo que existe.\n"
        )
        criterio = (
            "Criterio para clasificar el interés de la persona:\n"
            "- Tibio es el buen desenlace aquí: aceptó afiliarse y agendar una asesoría.\n"
            "- Caliente casi nunca aplica, porque el proyecto todavía no está confirmado.\n"
            "- Frío: no le interesa afiliarse ni acepta ningún siguiente paso.\n"
        )

    return f"{encabezado}\n{catalogo.strip()}\n\n{criterio}"


def revisar(nombre: str, texto: str) -> list[str]:
    """
    Comprobaciones que evitan los fallos caros: un token huérfano se PRONUNCIA
    en la llamada, y un nombre de campo mal escrito se pierde en silencio.
    """
    problemas: list[str] = []

    usadas = set(re.findall(r"\{\{(\w+)\}\}", texto))
    huerfanas = usadas - VARIABLES_VALIDAS
    if huerfanas:
        problemas.append(
            "variables no reconocidas por el runtime (se dirían en voz alta): "
            + ", ".join(sorted(huerfanas))
        )

    # El contrato con el backend: si falta un campo, el asesor recibe la ficha coja.
    for campo in (
        "calificacion_lead", "justificacion_calificacion", "resumen_llamada",
        "disponible_visita", "fecha_hora_agendada", "modalidad_agendada",
        "ahorros_cesantias_declarado",
    ):
        if campo not in texto:
            problemas.append(f"falta el campo de salida '{campo}'")

    if "end_call" not in texto:
        problemas.append("no menciona end_call: la llamada no se cerraría sola")

    # Dapta no resuelve {{afiliado}}: el enrutamiento por afiliación lo hace el
    # backend eligiendo agente, así que la variable ya no debe aparecer.
    if "{{afiliado}}" in texto:
        problemas.append("usa {{afiliado}}, que ya no se envía (el backend enruta por agente)")

    if len(texto) > 40000:
        problemas.append(f"prompt muy largo ({len(texto)} caracteres)")

    return problemas


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="verifica sin escribir")
    args = ap.parse_args()

    BUILD.mkdir(parents=True, exist_ok=True)
    fallos = 0

    for nombre, ruta in VARIANTES.items():
        texto = construir(ruta)
        problemas = revisar(nombre, texto)

        estado = "OK" if not problemas else "REVISAR"
        print(f"{nombre:22s} {len(texto):6d} caracteres  {estado}")
        for p in problemas:
            print(f"    - {p}")
            fallos += 1

        if not args.check:
            (BUILD / f"{nombre}.txt").write_text(texto, encoding="utf-8")

    # Contextos de los agentes de TEXTO (company_description). No pasan por
    # `revisar`: no llevan variables ni end_call por diseño.
    for perfil in ("afiliados", "no-afiliados"):
        clave = "afiliados" if perfil == "afiliados" else "no-afiliados"
        texto_wa = contexto_whatsapp("afiliados" if perfil == "afiliados" else "no_afiliados")
        print(f"whatsapp-{clave:13s} {len(texto_wa):6d} caracteres  OK")
        if not args.check:
            (BUILD / f"whatsapp-contexto-{clave}.txt").write_text(texto_wa, encoding="utf-8")

    if args.check:
        print("\n--check: no se escribió nada.")
    else:
        print(f"\nescrito en {BUILD.relative_to(RAIZ)}/")

    return 1 if fallos else 0


if __name__ == "__main__":
    sys.exit(main())
