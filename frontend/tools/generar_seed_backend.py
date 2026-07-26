#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Publica NUESTRO catalogo scrapeado en el esquema que consume el backend
(proyectos_seed.json). Uso:

    python tools/generar_seed_backend.py              # escribe data/proyectos_seed.json
    python tools/generar_seed_backend.py --cache      # guarda/reusa el volcado crudo
    python tools/generar_seed_backend.py --limite 5   # pruebas

POR QUE EXISTE
--------------
El backend recomienda sobre su propio `proyectos_seed.json` (100 proyectos, y por
lo que se ve en las respuestas, generados sinteticamente: hasta Sumapaz -una
localidad rural sin proyectos de vivienda- devuelve 5). Nosotros tenemos 66
proyectos REALES bajados de colsubsidio.com, con precio, area, habitaciones y
planos oficiales. Este script los deja en el formato exacto que el backend ya
sabe leer, para que el equipo pueda cambiar el catalogo de prueba por el real
sin tocar su codigo.

DE DONDE SALE CADA CAMPO
------------------------
Reusa `scrape_proyectos.py` como modulo (misma descarga, mismo parseo del
`__NEXT_DATA__`); aqui solo esta el MAPEO al esquema del backend, mas dos
extracciones que el catalogo de la app no guarda: la direccion y las amenidades
en texto libre.

OJO CON LA DIRECCION (bug facil de introducir)
----------------------------------------------
El paragraph `map_module` trae DOS direcciones y la mas obvia es la equivocada:

  field_address_2            -> la SALA DE VENTAS. Para Acanto (que esta en
                                Bosa, Bogota) apunta a Soacha. Usarla ubicaria
                                mal el proyecto y el backend recomendaria por
                                zonas erroneas.
  field_long_description_two -> la direccion DEL PROYECTO ("Carrera 95A # 78
                                Sur, Bosa Recreo"). Es la que se usa aca.

Cuando no hay direccion del proyecto se cae a "{zona}, {muni}", que es
informacion verdadera aunque menos precisa. NUNCA se inventa una direccion.

QUE NO HACE
-----------
- No calcula `match_score`: eso es del backend, depende del lead.
- No inventa amenidades. Las que no encajan en el vocabulario de 25 del backend
  (cuarto de residuos, subestacion electrica, ascensor, oratorio...) se
  descartan en vez de forzarlas a una categoria que no les corresponde.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor

AQUI = os.path.dirname(os.path.abspath(__file__))
if AQUI not in sys.path:
    sys.path.insert(0, AQUI)

import scrape_proyectos as sp  # noqa: E402  (necesita el sys.path de arriba)

APP = os.path.dirname(AQUI)
SALIDA = os.path.join(APP, "data", "proyectos_seed.json")
CACHE = os.path.join(AQUI, ".cache_fichas.json")

# El vocabulario de 25 etiquetas y las reglas que mapean el texto libre del
# sitio a esas claves VIVEN EN scrape_proyectos.py (VOCABULARIO y
# clave_de_amenidad), porque el catalogo de la app tambien las necesita: cruza
# las amenidades de cada proyecto con el `entorno_deseado` que eligio el
# usuario. Se reusan aqui en vez de mantener dos copias que se desincronicen.
VOCABULARIO = sp.VOCABULARIO

RE_HTML = re.compile(r"<[^>]+>")


def a_vocabulario(etiquetas: list) -> list:
    """Etiquetas libres del sitio -> subconjunto ordenado del vocabulario."""
    encontradas = {sp.clave_de_amenidad(e) for e in etiquetas}
    encontradas.discard(None)
    # En el orden del vocabulario, no en el de aparicion, para que el JSON sea
    # estable entre corridas.
    return [e for e in VOCABULARIO if e in encontradas]


def amenidades_crudas(recurso: dict) -> list:
    """Las amenidades viven en field_link.title del paragraph
    'information_with_icons' — NO en field_description, que viene vacio. Los 66
    proyectos las traen (~10 cada uno)."""
    salida = []
    for sec in recurso.get("field_section") or []:
        if not isinstance(sec, dict) or sec.get("type") != "paragraph--information_with_icons":
            continue
        for item in sec.get("field_item") or []:
            if not isinstance(item, dict):
                continue
            enlace = item.get("field_link") or {}
            titulo = (enlace.get("title") or "").strip() if isinstance(enlace, dict) else ""
            if titulo:
                salida.append(titulo)
    return salida


def direccion_de(recurso: dict) -> str | None:
    """Direccion DEL PROYECTO. Ver la advertencia del encabezado: se ignora
    field_address_2 a proposito porque es la sala de ventas."""
    for sec in recurso.get("field_section") or []:
        if not isinstance(sec, dict) or sec.get("type") != "paragraph--map_module":
            continue
        for item in sec.get("field_item") or []:
            if not isinstance(item, dict):
                continue
            campo = item.get("field_long_description_two") or {}
            crudo = campo.get("value") if isinstance(campo, dict) else None
            if not crudo:
                continue
            texto = RE_HTML.sub(" ", crudo)
            texto = texto.replace("&nbsp;", " ").replace("&amp;", "&")
            texto = re.sub(r"\s+", " ", texto).strip(" .,;")
            # Un texto muy corto o muy largo no es una direccion; mejor caer al
            # respaldo que publicar basura.
            if 8 <= len(texto) <= 160:
                return texto
    return None


def habitaciones_de(tipologias: list, respaldo) -> list:
    """Habitaciones ofrecidas, contando los espacios 'Habitacion ...' de cada
    tipologia. Si el proyecto no publica tipologias, queda el dato global."""
    conteos = set()
    for t in tipologias or []:
        n = 0
        for esp in t.get("espacios") or []:
            if sp.sin_tildes(esp.get("label", "")).lower().strip().startswith("habitacion"):
                n += 1
        if n:
            conteos.add(n)
    if conteos:
        return sorted(conteos)
    return [int(respaldo)] if respaldo else []


def mapear_seed(recurso: dict, url: str, idx: int) -> dict:
    base = sp.mapear(recurso, url, idx)
    base.pop("_img_remota", None)
    tipologias = base.get("tipologias") or []

    precios = [t["precio"] for t in tipologias if t.get("precio")]
    areas = [t["area"] for t in tipologias if t.get("area")]

    # El catalogo de la app guarda el precio en MILLONES redondeados; el seed
    # necesita pesos exactos, asi que se toma del nodo crudo.
    precio_exacto = recurso.get("field_price") or 0

    zona = base.get("zona")
    muni = base.get("muni") or ""
    respaldo_dir = ", ".join([x for x in (zona, muni) if x]) or muni

    return {
        "nombre_proyecto": base["name"],
        "tipo_vivienda": "vis" if base["vis"] else "no_vis",
        # El backend indexa por LOCALIDAD de Bogota: es el campo que cruza con
        # el `zona_interes` que manda el formulario. Sale de la coordenada del
        # mapa contra los limites oficiales del Distrito (ver ubicar_localidad
        # en scrape_proyectos.py).
        "localidad": base.get("localidad"),
        "direccion": direccion_de(recurso) or respaldo_dir,
        "precio_desde_cop": int(min(precios)) if precios else int(precio_exacto),
        "area_construida_m2": min(areas) if areas else recurso.get("field_area"),
        "habitaciones_ofrecidas": habitaciones_de(tipologias, recurso.get("field_rooms")),
        "amenidades_entorno": a_vocabulario(amenidades_crudas(recurso)),
        "aplica_subsidio_caja": bool(base["vis"]),
        # Extras nuestros, fuera del contrato que ya consume el backend. Van al
        # final y son ignorables; sirven para que puedan enlazar a la ficha real
        # y saber que el dato no es inventado.
        "url_ficha": base.get("url"),
        "_direccion_es_aproximada": direccion_de(recurso) is None,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", action="store_true", help="guarda/reusa el volcado crudo de las fichas")
    ap.add_argument("--limite", type=int, default=0, help="solo N proyectos (pruebas)")
    args = ap.parse_args()

    fichas = None
    if args.cache and os.path.exists(CACHE):
        with open(CACHE, encoding="utf-8") as fh:
            fichas = json.load(fh)
        print("1) usando cache: %d fichas (%s)" % (len(fichas), CACHE))

    if fichas is None:
        print("motor de red: %s" % sp.MOTOR)
        print("1) sitemap...")
        urls = sorted(set(sp.RE_PROYECTO.findall(sp.bajar(sp.SITEMAP))))
        if args.limite:
            urls = urls[: args.limite]
        print("   %d fichas" % len(urls))

        print("2) descargando fichas...")

        def tarea(url):
            try:
                recurso = sp.nodo_de_ficha(sp.bajar(url))
                return {"url": url, "recurso": recurso} if recurso else None
            except Exception as e:
                print("    ! %s -> %s: %s" % (url, type(e).__name__, e))
                return None

        with ThreadPoolExecutor(max_workers=8) as ex:
            fichas = [f for f in ex.map(tarea, urls) if f]
        print("   ok: %d" % len(fichas))

        if args.cache:
            with open(CACHE, "w", encoding="utf-8") as fh:
                json.dump(fichas, fh)
            print("   cache escrito en %s" % CACHE)

    if not fichas:
        print("ABORTADO: no se obtuvo ninguna ficha; no se escribe el seed.")
        return 1

    print("3) mapeando al esquema del backend...")
    sp.cargar_localidades()  # antes de mapear: mapear_seed la necesita
    proyectos = [mapear_seed(f["recurso"], f["url"], i) for i, f in enumerate(fichas)]

    # Solo Bogota, igual que el catalogo de la app: sin localidad el backend no
    # puede cruzar el proyecto con la `zona_interes` del formulario.
    antes = len(proyectos)
    proyectos = [p for p in proyectos if p.get("localidad")]
    if antes != len(proyectos):
        print("   solo Bogota: %d de %d (los demas no tienen localidad)" % (len(proyectos), antes))

    # Orden alfabetico estable -> los id_proyecto no bailan entre corridas.
    proyectos.sort(key=lambda p: sp.sin_tildes(p["nombre_proyecto"]).lower())
    for i, p in enumerate(proyectos, start=1):
        # Se inserta primero para que quede al inicio de cada objeto del JSON.
        ordenado = {"id_proyecto": "COL-%03d" % i}
        ordenado.update(p)
        proyectos[i - 1] = ordenado

    carpeta = os.path.dirname(SALIDA)
    if not os.path.isdir(carpeta):
        os.makedirs(carpeta)
    with open(SALIDA, "w", encoding="utf-8") as fh:
        json.dump(proyectos, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    con_dir = sum(1 for p in proyectos if not p["_direccion_es_aproximada"])
    con_amen = sum(1 for p in proyectos if p["amenidades_entorno"])
    sin_precio = [p["nombre_proyecto"] for p in proyectos if not p["precio_desde_cop"]]
    sin_hab = [p["nombre_proyecto"] for p in proyectos if not p["habitaciones_ofrecidas"]]

    print("4) escrito %s" % SALIDA)
    print("   %d proyectos | %d VIS" % (
        len(proyectos), sum(1 for p in proyectos if p["tipo_vivienda"] == "vis")))
    print("   direccion real: %d/%d (el resto queda como 'zona, municipio')" % (con_dir, len(proyectos)))
    print("   con amenidades del vocabulario: %d/%d (media %.1f)" % (
        con_amen, len(proyectos),
        sum(len(p["amenidades_entorno"]) for p in proyectos) / max(1, len(proyectos))))
    if sin_precio:
        print("   OJO sin precio: %s" % ", ".join(sin_precio))
    if sin_hab:
        print("   OJO sin habitaciones: %s" % ", ".join(sin_hab))

    # Anomalias del ORIGEN, no del mapeo. Se reportan pero NO se corrigen: el
    # dato es el que publica colsubsidio.com y arreglarlo aca seria inventar.
    # Caso conocido: "Calia" figura como VIS de 36 m2 a $2.950 millones, que es
    # ~15 veces el tope VIS — casi seguro un cero de mas en la ficha original.
    TOPE_VIS_APROX = 250_000_000
    raros = [
        (p["nombre_proyecto"], p["precio_desde_cop"])
        for p in proyectos
        if p["tipo_vivienda"] == "vis" and p["precio_desde_cop"] > TOPE_VIS_APROX
    ]
    if raros:
        print("   AVISO: %d proyecto(s) marcados VIS por encima de ~$%dM (revisar con Colsubsidio," % (
            len(raros), TOPE_VIS_APROX // 1_000_000))
        print("          el dato viene asi de la ficha oficial y NO se corrige aqui):")
        for nombre, precio in sorted(raros, key=lambda x: -x[1]):
            print("            - %-34s $%.0fM" % (nombre[:34], precio / 1e6))
    return 0


if __name__ == "__main__":
    sys.exit(main())
