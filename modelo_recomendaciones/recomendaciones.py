"""
Motor de recomendación híbrido de inmuebles — versión Python.

Pieza del sistema: MODELO DE RECOMENDACIONES (Santiago DS).

Cómo opera:
  1. FILTRO ESTRICTO
     - El inmueble debe coincidir con `usuario.zona_interes`.
     - Si el usuario definió `piso_preferido`, debe existir en
       `inmueble.pisos_disponibles`.
  2. SCORING (0 a 100)
     - Entorno (50)     : intersección entorno_deseado ∩ amenidades_entorno.
     - Capacidad (20)   : max(habitaciones_ofrecidas) cubre personas_a_cargo + 1.
     - Financiero (30)  : ingresos + afiliación contra tipo_vivienda y
                          aplica_subsidio_caja del inmueble.
  3. SALIDA
     Top 6 inmuebles que pasaron el filtro, ordenados por score descendente y
     anotados con `match_score` (entero 0-100).

Solo librería estándar: se puede importar desde el backend (ver
backend/integrations/recomendaciones_client.py) o correr por CLI.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, NamedTuple

# --------------------------------------------------------------------------- #
# Rutas — todo se resuelve relativo a ESTA carpeta.
# --------------------------------------------------------------------------- #
CARPETA = Path(__file__).resolve().parent
RAIZ_REPO = CARPETA.parent

#: Dónde buscar el catálogo si no se pasa por CLI (en orden).
CANDIDATOS_CATALOGO: tuple[Path, ...] = (
    CARPETA / "proyectos_seed.json",
    RAIZ_REPO / "backend" / "data" / "proyectos_seed.json",
)

#: Salida por defecto: misma carpeta que este script.
SALIDA_POR_DEFECTO = CARPETA / "recomendaciones.json"


# --------------------------------------------------------------------------- #
# Parámetros del modelo — tunables sin tocar la lógica.
# --------------------------------------------------------------------------- #
class Parametros:
    """Pesos y umbrales del scoring. Cambiar aquí, no dentro de las funciones."""

    MAX_RESULTADOS = 6

    # Reparto del score (suma 100).
    PESO_ENTORNO = 50.0
    PESO_CAPACIDAD = 20.0
    PESO_FINANCIERO = 30.0

    # El bloque financiero se parte en asequibilidad + beneficio de caja.
    PESO_FIN_ASEQUIBILIDAD = 18.0
    PESO_FIN_SUBSIDIO = 12.0

    # Sin preferencias de entorno la dimensión no discrimina: se otorga el punto
    # medio en vez de 0, para no castigar al lead que no llenó ese paso del bowl.
    RATIO_ENTORNO_NEUTRO = 0.5

    # Porción del ingreso mensual que se asume disponible para la cuota.
    RATIO_CUOTA_SOBRE_INGRESO = 0.30
    # Factor cuota -> valor financiable (~crédito a 20 años en tasas locales).
    FACTOR_CAPACIDAD_ENDEUDAMIENTO = 120.0
    # Debajo de este ratio (asequible / precio) la asequibilidad puntúa 0.
    RATIO_ASEQUIBILIDAD_PISO = 0.60

    #: Base de cálculo: 1 SMMLV = $1.400.000 (redondeado; real 2025 ≈ $1.423.500).
    #: ACTUALIZAR cada año junto con las bandas de RANGOS_INGRESO.
    SMMLV = 1_400_000
    #: Tope de ingreso (en SMMLV) para subsidio de caja sobre VIS.
    TOPE_SMMLV_SUBSIDIO = 4

    #: Atenuación cuando el tipo de vivienda del inmueble no es el declarado.
    FACTOR_TIPO_VIVIENDA_DISCREPANTE = 0.75


# --------------------------------------------------------------------------- #
# Rangos de ingreso — SET CANÓNICO (4 buckets). Lo único que manda el bowl en
# `ingresos_hogar_rango`. Coincide 1:1 con los 4 rangos del formulario.
# --------------------------------------------------------------------------- #
class RangoIngreso(NamedTuple):
    ordinal: int  # 1..4, de menor a mayor ingreso
    banda_smmlv: str
    etiqueta: str  # valor EXACTO que envía el sistema
    representativo: int  # COP/mes que consume el modelo
    limite_inferior: int | None  # None = abierto hacia abajo
    limite_superior: int | None  # None = abierto hacia arriba


RANGOS_INGRESO: tuple[RangoIngreso, ...] = (
    RangoIngreso(1, "<= 2 SMMLV", "Hasta $2.800.000", 1_400_000, None, 2_800_000),
    RangoIngreso(2, "2-4 SMMLV", "$2.800.000 – $5.700.000", 4_250_000, 2_800_000, 5_700_000),
    RangoIngreso(3, "4-8 SMMLV", "$5.700.000 – $11.400.000", 8_550_000, 5_700_000, 11_400_000),
    RangoIngreso(4, "8+ SMMLV", "Más de $11.400.000", 14_000_000, 11_400_000, None),
)


#: Usuario de ejemplo, para correr el script sin argumentos (demo).
USUARIO_DEMO: dict[str, Any] = {
    "tipo_vivienda": "vis",
    "nombre": "Ana",
    "apellido": "Ramirez",
    "correo": "ana.ramirez@example.com",
    "telefono_movil": "+573001112233",
    "afiliado": True,
    "ingresos_hogar_rango": "$2.800.000 – $5.700.000",
    "edad": 34,
    "personas_a_cargo": 2,
    "zona_interes": "kennedy",
    "piso_preferido": None,
    "tipo_inmueble": "apartamento",
    "entorno_deseado": "zona kid, parque, zona verde, locales comerciales",
}


# --------------------------------------------------------------------------- #
# Helpers puros
# --------------------------------------------------------------------------- #
def acotar(valor: float, minimo: float, maximo: float) -> float:
    """Recorta `valor` al intervalo [minimo, maximo]."""
    return minimo if valor < minimo else maximo if valor > maximo else valor


def normalizar_texto(valor: str) -> str:
    """
    Canoniza texto para comparar: sin tildes, minúsculas y espacios/guiones
    colapsados a "_". Así "Rafael Uribe Uribe" == "rafael_uribe_uribe" y
    "Zona BBQ" == "zona bbq", venga del bowl o del catálogo.
    """
    sin_tildes = "".join(
        caracter
        for caracter in unicodedata.normalize("NFD", valor)
        if unicodedata.category(caracter) != "Mn"
    )
    return re.sub(r"[\s\-]+", "_", sin_tildes.strip().lower())


def normalizar_entorno(entorno: Any) -> set[str]:
    """
    Acepta lo que manda el bowl (string suelto, lista separada por , ; | , o un
    array de strings ya tipado) y devuelve el set canonizado.
    """
    if entorno is None:
        return set()
    crudos: Iterable[Any]
    if isinstance(entorno, (list, tuple, set)):
        crudos = entorno
    else:
        crudos = re.split(r"[,;|]", str(entorno))
    return {clave for item in crudos if (clave := normalizar_texto(str(item)))}


def parsear_piso_preferido(piso: Any) -> int | None:
    """
    `piso_preferido` puede llegar como "3", 3, "piso 3" o "sin preferencia".
    Sin un entero reconocible se interpreta como SIN preferencia (no filtra).
    """
    if piso is None:
        return None
    if isinstance(piso, bool):  # bool es subclase de int; no es un piso
        return None
    if isinstance(piso, int):
        return piso
    encontrado = re.search(r"\d+", str(piso))
    return int(encontrado.group()) if encontrado else None


def _extraer_cifras(texto: str) -> list[int]:
    """Saca los montos de un texto, leyendo el punto como separador de miles."""
    return [
        valor
        for token in re.findall(r"\d[\d.,]*", texto)
        if (valor := int(re.sub(r"\D", "", token) or 0)) > 0
    ]


#: Índice para reconocer una banda canónica por los montos de su etiqueta.
#: Tolera variantes de guion (- vs –), tildes, espaciado y símbolo $.
_INDICE_RANGOS: dict[tuple[int, ...], RangoIngreso] = {
    tuple(_extraer_cifras(rango.etiqueta)): rango for rango in RANGOS_INGRESO
}


def clasificar_ingreso(rango: Any) -> RangoIngreso | None:
    """
    Ubica `ingresos_hogar_rango` en una de las 4 bandas canónicas.
    Primero por la etiqueta exacta (por los montos); si es texto libre, estima
    el ingreso y busca la banda que lo contiene. None solo si nada interpretable.
    """
    if not rango:
        return None

    texto = str(rango)
    directo = _INDICE_RANGOS.get(tuple(_extraer_cifras(texto)))
    if directo is not None:
        return directo

    estimado = _estimar_ingreso_libre(texto)
    if estimado is None:
        return None

    for banda in RANGOS_INGRESO:
        supera_piso = banda.limite_inferior is None or estimado > banda.limite_inferior
        bajo_techo = banda.limite_superior is None or estimado <= banda.limite_superior
        if supera_piso and bajo_techo:
            return banda
    return None


def _estimar_ingreso_libre(texto: str) -> float | None:
    """
    Estima un ingreso mensual desde texto libre (fuera del set canónico).
    Punto medio si hay dos cifras; una sola cifra se ajusta según si el texto
    la acota por arriba ("hasta X" -> x0.75) o por abajo ("más de X" -> x1.25).
    """
    cifras = _extraer_cifras(texto)
    if not cifras:
        return None
    if len(cifras) >= 2:
        return (cifras[0] + cifras[1]) / 2

    unico = float(cifras[0])
    normalizado = normalizar_texto(texto)
    if re.search(r"menos|hasta|inferior|menor", normalizado):
        return unico * 0.75
    if re.search(r"mas|desde|superior|mayor", normalizado):
        return unico * 1.25
    return unico


def parsear_ingreso_mensual(rango: Any) -> float:
    """
    Convierte `ingresos_hogar_rango` al ingreso mensual que consume el modelo.
    Banda canónica -> su valor REPRESENTATIVO. Texto libre -> estimación.
    Sin nada interpretable -> default conservador de 2 SMMLV.
    """
    if not rango:
        return float(Parametros.SMMLV * 2)

    texto = str(rango)
    directo = _INDICE_RANGOS.get(tuple(_extraer_cifras(texto)))
    if directo is not None:
        return float(directo.representativo)

    estimado = _estimar_ingreso_libre(texto)
    return estimado if estimado is not None else float(Parametros.SMMLV * 2)


# --------------------------------------------------------------------------- #
# Componentes del score
# --------------------------------------------------------------------------- #
def puntuar_entorno(deseados: set[str], amenidades: Iterable[str]) -> float:
    """Hasta 50 pts — intersección entorno deseado ∩ amenidades del inmueble."""
    if not deseados:
        return Parametros.PESO_ENTORNO * Parametros.RATIO_ENTORNO_NEUTRO

    coincidencias = sum(
        1 for amenidad in amenidades if normalizar_texto(str(amenidad)) in deseados
    )
    return Parametros.PESO_ENTORNO * acotar(coincidencias / len(deseados), 0.0, 1.0)


def puntuar_capacidad(requeridas: int, ofrecidas: Iterable[int]) -> float:
    """Hasta 20 pts — la oferta máxima de habitaciones cubre al hogar."""
    valores = [int(h) for h in ofrecidas if isinstance(h, (int, float))]
    if not valores or requeridas <= 0:
        return 0.0

    maximo = max(valores)
    if maximo >= requeridas:
        return Parametros.PESO_CAPACIDAD
    return Parametros.PESO_CAPACIDAD * acotar(maximo / requeridas, 0.0, 1.0)


def puntuar_financiero(
    ingreso_mensual: float,
    es_afiliado: bool,
    tipo_vivienda_usuario: str,
    inmueble: dict[str, Any],
) -> tuple[float, float]:
    """
    Hasta 30 pts — ingresos + afiliación contra el tipo de vivienda y la
    elegibilidad de subsidio del inmueble. Devuelve
    (puntos_asequibilidad, puntos_subsidio).
    """
    precio = float(inmueble.get("precio_desde_cop") or 0)

    # --- Asequibilidad ----------------------------------------------------- #
    cuota_disponible = ingreso_mensual * Parametros.RATIO_CUOTA_SOBRE_INGRESO
    monto_asequible = cuota_disponible * Parametros.FACTOR_CAPACIDAD_ENDEUDAMIENTO
    ratio = (monto_asequible / precio) if precio > 0 else 0.0

    holgura = acotar(
        (ratio - Parametros.RATIO_ASEQUIBILIDAD_PISO)
        / (1 - Parametros.RATIO_ASEQUIBILIDAD_PISO),
        0.0,
        1.0,
    )
    coherencia_tipo = (
        1.0
        if inmueble.get("tipo_vivienda") == tipo_vivienda_usuario
        else Parametros.FACTOR_TIPO_VIVIENDA_DISCREPANTE
    )
    puntos_asequibilidad = Parametros.PESO_FIN_ASEQUIBILIDAD * holgura * coherencia_tipo

    # --- Beneficio de caja de compensación --------------------------------- #
    tope_subsidio = Parametros.SMMLV * Parametros.TOPE_SMMLV_SUBSIDIO
    aplica_subsidio = bool(inmueble.get("aplica_subsidio_caja"))
    inmueble_subsidiable = aplica_subsidio and inmueble.get("tipo_vivienda") == "vis"

    if es_afiliado and inmueble_subsidiable and ingreso_mensual <= tope_subsidio:
        puntos_subsidio = Parametros.PESO_FIN_SUBSIDIO
    elif es_afiliado and inmueble_subsidiable:
        puntos_subsidio = Parametros.PESO_FIN_SUBSIDIO * 0.58
    elif es_afiliado or not aplica_subsidio:
        puntos_subsidio = Parametros.PESO_FIN_SUBSIDIO * 0.42
    else:
        puntos_subsidio = Parametros.PESO_FIN_SUBSIDIO * 0.17

    return puntos_asequibilidad, puntos_subsidio


# --------------------------------------------------------------------------- #
# Entrada pública
# --------------------------------------------------------------------------- #
def recomendar_inmuebles(
    usuario: dict[str, Any],
    catalogo_inmuebles: list[dict[str, Any]],
    *,
    top: int = Parametros.MAX_RESULTADOS,
    con_desglose: bool = False,
) -> list[dict[str, Any]]:
    """
    Filtro estricto (zona + piso) y scoring 0-100. Devuelve el Top N con
    `match_score` inyectado, en orden descendente. Empates: más económico, luego
    id_proyecto (determinístico). Los inmuebles devueltos son COPIAS.
    """
    if not catalogo_inmuebles:
        return []

    zona_usuario = normalizar_texto(str(usuario.get("zona_interes") or ""))
    if not zona_usuario:
        return []

    entorno_deseado = normalizar_entorno(usuario.get("entorno_deseado"))
    piso_preferido = parsear_piso_preferido(usuario.get("piso_preferido"))
    personas_a_cargo = max(0, int(usuario.get("personas_a_cargo") or 0))
    habitaciones_requeridas = personas_a_cargo + 1
    ingreso_mensual = parsear_ingreso_mensual(usuario.get("ingresos_hogar_rango"))
    es_afiliado = usuario.get("afiliado") is True
    tipo_vivienda_usuario = (
        "no_vis" if usuario.get("tipo_vivienda") == "no_vis" else "vis"
    )

    candidatos: list[tuple[float, float, str, int, dict[str, float]]] = []

    for indice, inmueble in enumerate(catalogo_inmuebles):
        if not isinstance(inmueble, dict):
            continue

        # --- 1) Filtro estricto -------------------------------------------- #
        if normalizar_texto(str(inmueble.get("zona_interes") or "")) != zona_usuario:
            continue
        if piso_preferido is not None:
            pisos = inmueble.get("pisos_disponibles") or []
            if not isinstance(pisos, list) or piso_preferido not in pisos:
                continue

        # --- 2) Scoring (0-100) -------------------------------------------- #
        pts_entorno = puntuar_entorno(
            entorno_deseado, inmueble.get("amenidades_entorno") or []
        )
        pts_capacidad = puntuar_capacidad(
            habitaciones_requeridas, inmueble.get("habitaciones_ofrecidas") or []
        )
        pts_asequibilidad, pts_subsidio = puntuar_financiero(
            ingreso_mensual, es_afiliado, tipo_vivienda_usuario, inmueble
        )

        score = acotar(
            pts_entorno + pts_capacidad + pts_asequibilidad + pts_subsidio, 0.0, 100.0
        )
        desglose = {
            "entorno": round(pts_entorno, 2),
            "capacidad": round(pts_capacidad, 2),
            "asequibilidad": round(pts_asequibilidad, 2),
            "beneficio_caja": round(pts_subsidio, 2),
        }
        candidatos.append(
            (
                score,
                float(inmueble.get("precio_desde_cop") or 0),
                str(inmueble.get("id_proyecto") or ""),
                indice,
                desglose,
            )
        )

    candidatos.sort(key=lambda c: (-c[0], c[1], c[2]))

    recomendados: list[dict[str, Any]] = []
    for score, _precio, _id, indice, desglose in candidatos[: max(0, top)]:
        anotado = dict(catalogo_inmuebles[indice])
        anotado["match_score"] = int(round(score))
        if con_desglose:
            anotado["match_desglose"] = desglose
        recomendados.append(anotado)

    return recomendados


# --------------------------------------------------------------------------- #
# Carga / escritura de JSON
# --------------------------------------------------------------------------- #
def _leer_json(ruta: Path) -> Any:
    with ruta.open(encoding="utf-8") as archivo:
        return json.load(archivo)


def resolver_catalogo(ruta: Path | None) -> tuple[list[dict[str, Any]], Path]:
    """Devuelve (catálogo, ruta_usada). Sin ruta, busca en CANDIDATOS_CATALOGO."""
    rutas = (ruta,) if ruta is not None else CANDIDATOS_CATALOGO
    for candidata in rutas:
        if candidata is not None and candidata.is_file():
            datos = _leer_json(candidata)
            if isinstance(datos, dict):
                datos = datos.get("catalogo") or datos.get("inmuebles") or []
            if not isinstance(datos, list):
                raise ValueError(f"{candidata} no contiene un array de inmuebles.")
            return datos, candidata

    intentadas = ", ".join(str(r) for r in rutas if r is not None)
    raise FileNotFoundError(f"No se encontró el catálogo. Rutas probadas: {intentadas}")


def resolver_usuario(entrada: Any, ruta_usuario: Path | None) -> dict[str, Any]:
    """Usuario desde --usuario, o bajo la clave `usuario`, o el demo embebido."""
    if ruta_usuario is not None:
        datos = _leer_json(ruta_usuario)
        if not isinstance(datos, dict):
            raise ValueError(f"{ruta_usuario} debe contener un objeto SenalBowl.")
        return datos
    if isinstance(entrada, dict) and isinstance(entrada.get("usuario"), dict):
        return entrada["usuario"]
    return dict(USUARIO_DEMO)


def _construir_salida(
    usuario: dict[str, Any],
    catalogo: list[dict[str, Any]],
    recomendaciones: list[dict[str, Any]],
    origen_catalogo: Path,
) -> dict[str, Any]:
    """Envuelve el Top N con la metadata mínima para trazabilidad."""
    banda = clasificar_ingreso(usuario.get("ingresos_hogar_rango"))
    ingreso = parsear_ingreso_mensual(usuario.get("ingresos_hogar_rango"))
    return {
        "generado_en": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "origen_catalogo": origen_catalogo.name,
        "total_catalogo": len(catalogo),
        "top": len(recomendaciones),
        "usuario": usuario,
        "perfil_financiero": {
            "rango_declarado": usuario.get("ingresos_hogar_rango"),
            "banda_ordinal": banda.ordinal if banda else None,
            "banda_smmlv": banda.banda_smmlv if banda else None,
            "banda_canonica": banda is not None
            and banda.etiqueta == str(usuario.get("ingresos_hogar_rango")),
            "ingreso_mensual_estimado_cop": int(ingreso),
            "aplica_tope_subsidio": ingreso
            <= Parametros.SMMLV * Parametros.TOPE_SMMLV_SUBSIDIO,
        },
        "recomendaciones": recomendaciones,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Recomienda el Top 6 de inmuebles para un lead del bowl y escribe "
            "el JSON anotado con match_score en esta misma carpeta."
        )
    )
    parser.add_argument("entrada", nargs="?", type=Path, default=None)
    parser.add_argument("--usuario", type=Path, default=None)
    parser.add_argument("--salida", type=Path, default=SALIDA_POR_DEFECTO)
    parser.add_argument("--top", type=int, default=Parametros.MAX_RESULTADOS)
    parser.add_argument("--desglose", action="store_true")
    args = parser.parse_args()

    entrada_cruda = _leer_json(args.entrada) if args.entrada is not None else None

    if isinstance(entrada_cruda, list):
        catalogo, origen = entrada_cruda, args.entrada
    elif isinstance(entrada_cruda, dict) and isinstance(entrada_cruda.get("catalogo"), list):
        catalogo, origen = entrada_cruda["catalogo"], args.entrada
    else:
        catalogo, origen = resolver_catalogo(None)

    usuario = resolver_usuario(entrada_cruda, args.usuario)
    recomendaciones = recomendar_inmuebles(
        usuario, catalogo, top=args.top, con_desglose=args.desglose
    )

    salida = _construir_salida(usuario, catalogo, recomendaciones, Path(origen))
    args.salida.parent.mkdir(parents=True, exist_ok=True)
    with args.salida.open("w", encoding="utf-8") as archivo:
        json.dump(salida, archivo, ensure_ascii=False, indent=2)

    print(f"Catalogo:  {origen} ({len(catalogo)} inmuebles)")
    print(f"Zona lead: {usuario.get('zona_interes')}")
    print(f"Top {len(recomendaciones)} escrito en: {args.salida}")
    for posicion, inmueble in enumerate(recomendaciones, start=1):
        print(
            f"  {posicion}. [{inmueble['match_score']:>3}] "
            f"{inmueble.get('id_proyecto')} - {inmueble.get('nombre_proyecto')}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
