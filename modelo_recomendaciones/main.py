"""
Punto de entrada del MODELO DE RECOMENDACIONES (CLI + validación).

Pieza del sistema: MODELO DE RECOMENDACIONES (Santiago DS).

Recibe la RUTA de un JSON de entrada, valida que cumpla el contrato del modelo,
corre la predicción y escribe el JSON de salida con el Top 6 anotado.

    python main.py entrada.json
    python main.py entrada.json --desglose --top 6
    python main.py entrada.json --solo-validar

La lógica del modelo vive en `recomendaciones.py`; este archivo solo orquesta:
leer -> validar -> predecir -> escribir.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from recomendaciones import (
    CARPETA,
    RANGOS_INGRESO,
    SALIDA_POR_DEFECTO,
    Parametros,
    _construir_salida,
    clasificar_ingreso,
    normalizar_texto,
    recomendar_inmuebles,
    resolver_catalogo,
)

#: Sin estos campos el modelo no puede puntuar (aborta con error).
CAMPOS_OBLIGATORIOS: tuple[str, ...] = (
    "tipo_vivienda",
    "afiliado",
    "ingresos_hogar_rango",
    "personas_a_cargo",
    "zona_interes",
)

#: Parte del contrato SenalBowl pero NO usados por el scoring (solo se avisa).
CAMPOS_INFORMATIVOS: tuple[str, ...] = (
    "nombre",
    "apellido",
    "correo",
    "telefono_movil",
    "edad",
    "tipo_inmueble",
)

ZONAS_VALIDAS: frozenset[str] = frozenset(
    {
        "usaquen", "chapinero", "santa_fe", "san_cristobal", "usme",
        "tunjuelito", "bosa", "kennedy", "fontibon", "engativa",
        "suba", "barrios_unidos", "teusaquillo", "los_martires",
        "antonio_narino", "puente_aranda", "la_candelaria",
        "rafael_uribe_uribe", "ciudad_bolivar", "sumapaz",
    }
)

TIPOS_VIVIENDA_VALIDOS: frozenset[str] = frozenset({"vis", "no_vis"})


class EntradaInvalida(Exception):
    """El JSON de entrada no cumple el contrato mínimo del modelo."""


def cargar_json(ruta: Path) -> Any:
    """Lee el JSON de `ruta` (o el único .json si `ruta` es una carpeta)."""
    if ruta.is_dir():
        encontrados = sorted(ruta.glob("*.json"))
        if not encontrados:
            raise EntradaInvalida(f"No hay ningún .json dentro de {ruta}")
        if len(encontrados) > 1:
            nombres = ", ".join(archivo.name for archivo in encontrados)
            raise EntradaInvalida(
                f"{ruta} tiene varios .json ({nombres}). Indica cuál usar."
            )
        ruta = encontrados[0]

    if not ruta.is_file():
        raise EntradaInvalida(f"No existe el archivo {ruta}")

    try:
        with ruta.open(encoding="utf-8") as archivo:
            return json.load(archivo)
    except json.JSONDecodeError as error:
        raise EntradaInvalida(f"{ruta} no es JSON válido: {error}") from error


def extraer_usuario_y_catalogo(
    datos: Any,
) -> tuple[dict[str, Any], list[dict[str, Any]] | None]:
    """Acepta las tres formas: SenalBowl plana, {usuario}, o {usuario, catalogo}."""
    if not isinstance(datos, dict):
        raise EntradaInvalida(
            "La raíz del JSON debe ser un objeto con la señal del lead, no un array."
        )

    usuario = datos.get("usuario") if isinstance(datos.get("usuario"), dict) else datos

    catalogo = datos.get("catalogo")
    if catalogo is not None and not isinstance(catalogo, list):
        raise EntradaInvalida('"catalogo" debe ser un array de inmuebles.')

    return usuario, catalogo


def validar_usuario(usuario: dict[str, Any]) -> tuple[list[str], list[str]]:
    """Revisa el lead contra el contrato. Devuelve (errores, avisos)."""
    errores: list[str] = []
    avisos: list[str] = []

    for campo in CAMPOS_OBLIGATORIOS:
        if usuario.get(campo) is None:
            errores.append(f'Falta el campo obligatorio "{campo}".')

    tipo_vivienda = usuario.get("tipo_vivienda")
    if tipo_vivienda is not None and tipo_vivienda not in TIPOS_VIVIENDA_VALIDOS:
        errores.append(
            f'"tipo_vivienda" = {tipo_vivienda!r}; se esperaba "vis" o "no_vis".'
        )

    if usuario.get("afiliado") is not None and not isinstance(
        usuario.get("afiliado"), bool
    ):
        errores.append('"afiliado" debe ser booleano (true/false), sin comillas.')

    personas = usuario.get("personas_a_cargo")
    if personas is not None and (
        isinstance(personas, bool) or not isinstance(personas, int) or personas < 0
    ):
        errores.append('"personas_a_cargo" debe ser un entero >= 0.')

    zona = usuario.get("zona_interes")
    if isinstance(zona, str) and zona and normalizar_texto(zona) not in ZONAS_VALIDAS:
        avisos.append(
            f'"zona_interes" = {zona!r} no está entre las 20 localidades del '
            "catálogo; el resultado puede venir vacío."
        )

    rango = usuario.get("ingresos_hogar_rango")
    if rango is not None:
        banda = clasificar_ingreso(rango)
        if banda is None:
            errores.append(
                f'"ingresos_hogar_rango" = {rango!r} no tiene ninguna cifra '
                "interpretable. Usar una de las 4 bandas canónicas: "
                + " | ".join(r.etiqueta for r in RANGOS_INGRESO)
            )
        elif banda.etiqueta != str(rango):
            avisos.append(
                f'"ingresos_hogar_rango" = {rango!r} no es una banda canónica; '
                f"se interpretó como banda {banda.ordinal} ({banda.banda_smmlv})."
            )

    if usuario.get("entorno_deseado") is None:
        avisos.append(
            'Sin "entorno_deseado": la dimensión de entorno (50 pts) puntúa '
            "neutro para todos los inmuebles."
        )

    faltantes = [campo for campo in CAMPOS_INFORMATIVOS if usuario.get(campo) is None]
    if faltantes:
        avisos.append(
            "Campos del contrato SenalBowl ausentes (no afectan el score): "
            + ", ".join(faltantes)
        )

    return errores, avisos


def _construir_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Lee la ruta de un JSON con la señal del lead, corre el modelo de "
            "recomendación y escribe el Top N anotado con match_score."
        ),
        epilog="La estructura exacta del JSON está en ESTRUCTURA_JSON.txt.",
    )
    parser.add_argument("entrada", type=Path)
    parser.add_argument("--catalogo", type=Path, default=None)
    parser.add_argument("--salida", type=Path, default=SALIDA_POR_DEFECTO)
    parser.add_argument("--top", type=int, default=Parametros.MAX_RESULTADOS)
    parser.add_argument("--desglose", action="store_true")
    parser.add_argument("--solo-validar", action="store_true")
    return parser


def main() -> int:
    args = _construir_parser().parse_args()

    try:
        datos = cargar_json(args.entrada)
        usuario, catalogo_embebido = extraer_usuario_y_catalogo(datos)
    except EntradaInvalida as error:
        print(f"ERROR: {error}")
        return 2

    errores, avisos = validar_usuario(usuario)
    for aviso in avisos:
        print(f"AVISO: {aviso}")
    if errores:
        print("\nLa entrada no cumple el contrato del modelo:")
        for error in errores:
            print(f"  - {error}")
        return 2

    if args.solo_validar:
        print("\nEntrada válida. (--solo-validar: no se corrió el modelo.)")
        return 0

    if catalogo_embebido is not None and args.catalogo is None:
        catalogo, origen = catalogo_embebido, args.entrada
    else:
        try:
            catalogo, origen = resolver_catalogo(args.catalogo)
        except (FileNotFoundError, ValueError) as error:
            print(f"ERROR: {error}")
            return 2

    if not catalogo:
        print("ERROR: el catálogo está vacío; no hay nada que recomendar.")
        return 2

    recomendaciones = recomendar_inmuebles(
        usuario, catalogo, top=args.top, con_desglose=args.desglose
    )

    salida = _construir_salida(usuario, catalogo, recomendaciones, Path(origen))
    args.salida.parent.mkdir(parents=True, exist_ok=True)
    with args.salida.open("w", encoding="utf-8") as archivo:
        json.dump(salida, archivo, ensure_ascii=False, indent=2)

    print(f"\nEntrada:   {args.entrada}")
    print(f"Catalogo:  {origen} ({len(catalogo)} inmuebles)")
    print(f"Salida:    {args.salida}")
    if not recomendaciones:
        print("\nNingun inmueble paso el filtro estricto (revisa zona/piso).")
        return 0
    print(f"\nTop {len(recomendaciones)}:")
    for posicion, inmueble in enumerate(recomendaciones, start=1):
        precio = f"{int(inmueble.get('precio_desde_cop') or 0):,}".replace(",", ".")
        print(
            f"  {posicion}. [{inmueble['match_score']:>3}] "
            f"{inmueble.get('id_proyecto')} - {inmueble.get('nombre_proyecto')} "
            f"({inmueble.get('tipo_vivienda')}, ${precio})"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
