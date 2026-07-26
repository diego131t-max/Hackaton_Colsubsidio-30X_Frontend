#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Genera el catalogo de proyectos de vivienda de la app a partir del sitio real
de Colsubsidio. Uso:

    pip install "scrapling[fetchers]"
    python tools/scrape_proyectos.py            # escribe js/proyectos.js
    python tools/scrape_proyectos.py --no-img   # sin bajar imagenes (mas rapido)

COMO SE OBTIENEN LOS DATOS (y por que asi)
------------------------------------------
1. El listado https://www.colsubsidio.com/vivienda/proyectos NO trae los
   proyectos en el HTML: los carga por JS. Pero el sitemap si los lista todos,
   asi que de ahi salen las URLs -> sin navegador, sin paginacion.
2. Cada ficha de proyecto es Drupal + Next.js y trae el NODO COMPLETO dentro
   de <script id="__NEXT_DATA__">. De ahi salen area, habitaciones, banos,
   precio, ciudad, departamento y tipo de subsidio, ya como JSON limpio.
3. La API JSON:API del CMS (cms.colsubsidio.com/jsonapi/node/housing_projects)
   NO sirve: para usuarios anonimos responde data:[] con "insufficient
   authorization". Por eso el camino es sitemap + __NEXT_DATA__.

4. Las TIPOLOGIAS (Tipo A, Tipo B...) salen del paragraph "modular_tabs" de
   field_section: nombre, area construida, area privada, precio, fecha de
   entrega, la lista de espacios ("Los apartamentos cuentan con: ...") con su
   icono, y la galeria de planos. Ese paragraph se arma de DOS formas segun el
   proyecto (con y sin selector de "Etapa"/"Torre"), por eso _buscar_specs baja
   recursivamente en vez de seguir una ruta fija. Verificado: los 31 proyectos
   de Bogota publican tipologias (81 en total) y todas traen area, area
   privada, planos y lista de espacios.
5. Las AMENIDADES (zonas comunes) salen del paragraph "information_with_icons",
   con la etiqueta en field_link.title —NO en field_description, que viene
   vacio— y su icono en field_image. Cada una se mapea ademas a la clave del
   vocabulario de 25 del contrato, para poder cruzarla con el `entorno_deseado`
   que eligio el usuario y resaltar coincidencias en la tarjeta.

QUE NO HACE ESTE SCRIPT
-----------------------
- No inventa amenidades. Las etiquetas que no encajan en el vocabulario de 25
  ("Cuarto de residuos", "Subestacion electrica", "Ascensor") se muestran igual
  con su nombre real, pero se quedan sin `clave`: no se fuerzan a una categoria
  que no les corresponde.
- No lee el .xlsx. El numero de transacciones reales sale de la tabla ya
  documentada en docs/proyectos-reales-investigacion.md, mapeada a mano.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from concurrent.futures import ThreadPoolExecutor

SITEMAP = "https://www.colsubsidio.com/sitemap-0.xml"
CMS = "https://cms.colsubsidio.com"
RE_PROYECTO = re.compile(
    r"https://www\.colsubsidio\.com/vivienda/proyectos/[a-z0-9-]+/[a-z0-9-]+"
)

AQUI = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(AQUI)
SALIDA_JS = os.path.join(APP, "js", "proyectos.js")
DIR_IMG = os.path.join(APP, "assets", "proyectos")
DIR_PLANOS = os.path.join(APP, "assets", "planos")
DIR_ICONOS = os.path.join(APP, "assets", "iconos-tipologia")

# Limites oficiales de las 20 localidades de Bogota (datos abiertos del
# Distrito). Se usan para ubicar cada proyecto por coordenada; se cachean
# porque son ~2 MB y no cambian.
URL_LOCALIDADES = (
    "https://datosabiertos.bogota.gov.co/dataset/856cb657-8ca3-4ee8-857f-37211173b1f8/"
    "resource/497b8756-0927-4aee-8da9-ca4e32ca3a8a/download/loca.json"
)
CACHE_LOCALIDADES = os.path.join(AQUI, ".cache_localidades.json")

# Nombres bonitos: el dataset oficial los trae en mayuscula y sin tilde
# ("ANTONIO NARIÑO", "LOS MARTIRES"). Este es el vocabulario que ve el usuario
# y el que viaja en `zona_interes` hacia el backend.
LOCALIDADES_BOGOTA = [
    "Usaquén", "Chapinero", "Santa Fe", "San Cristóbal", "Usme", "Tunjuelito",
    "Bosa", "Kennedy", "Fontibón", "Engativá", "Suba", "Barrios Unidos",
    "Teusaquillo", "Los Mártires", "Antonio Nariño", "Puente Aranda",
    "La Candelaria", "Rafael Uribe Uribe", "Ciudad Bolívar", "Sumapaz",
]

# --------------------------------------------------------------------------
# Transacciones reales por proyecto (hackathon_VIVIENDAv2.xlsx, 4.142 registros
# entre 2024-01 y 2026-07). Fuente: docs/proyectos-reales-investigacion.md.
# La clave es el titulo EXACTO como lo publica el sitio hoy.
#
# El mapeo es explicito a proposito: emparejar por parecido de nombre falla.
# Verificado: un match difuso cruza "Agrupacion De Vivienda Jardin" (Soacha,
# Maipore) con "Ciudad Jardin" (Bogota), que son proyectos distintos. Por eso
# ese no esta en la tabla.
# --------------------------------------------------------------------------
TRANSACCIONES = {
    "Monguí": 622,
    "La Macarena": 374,
    "Verde Esperanza - El Dorado": 374,
    "La Arboleda": 353,
    "Inari": 304,
    "Pamplona": 234,
    "Los Nogales": 200,
    "Bosque de Arrayán": 200,
    "Bosque de Turpial": 179,
    "Versalles": 174,
    "Payandé": 137,
    "Reserva de Guayacán": 135,
    "Samán": 130,
    "Karakalí": 112,
    "Araucaria": 111,
    "Vibo Once": 31,
    "Reserva del Nogal": 12,
    "Mirador del Virrey": 11,
    "Zarzal": 8,
}

# Amenidades curadas a mano en docs/proyectos-amenidades.md (leidas del texto
# de zonas comunales de cada ficha). Clave = titulo actual en el sitio.
# Solo se usan las 9 claves del vocabulario de AMENITIES en data.js.
AMENIDADES_CURADAS = {
    "Monguí": ["porteria", "salon", "infantil", "biosaludable", "recreativa", "parqueadero"],
    "La Macarena": ["porteria", "cancha", "recreativa", "biosaludable", "infantil", "parqueadero", "gimnasio", "salon"],
    "Verde Esperanza - El Dorado": ["recreativa", "salon", "biosaludable", "infantil", "porteria", "parqueadero"],
    "La Arboleda": ["porteria", "salon", "infantil", "gimnasio", "recreativa"],
    "Inari": ["porteria", "gimnasio", "biosaludable", "infantil", "salon"],
    "Pamplona": ["porteria", "gimnasio", "cancha", "infantil", "recreativa", "biosaludable"],
    "Los Nogales": ["recreativa", "salon", "gimnasio", "parqueadero", "cancha", "infantil"],
    "Bosque de Arrayán": ["porteria", "infantil", "cancha", "recreativa", "salon", "biosaludable", "gimnasio", "parqueadero"],
    "Bosque de Turpial": ["porteria", "salon", "infantil", "recreativa", "gimnasio", "cancha", "biosaludable", "parqueadero"],
    "Versalles": ["porteria", "salon", "cancha", "infantil", "recreativa", "biosaludable"],
    "Payandé": ["salon", "recreativa", "parqueadero"],
    "Reserva de Guayacán": ["salon", "piscina", "recreativa", "infantil", "parqueadero"],
    "Samán": ["porteria", "salon", "piscina", "infantil", "recreativa", "gimnasio", "parqueadero"],
    "Karakalí": ["gimnasio", "recreativa", "porteria", "biosaludable", "salon"],
    "Araucaria": ["porteria", "salon", "gimnasio", "recreativa", "infantil", "cancha"],
    "Vibo Once": ["porteria", "salon", "gimnasio", "recreativa", "infantil"],
    "Reserva del Nogal": ["salon", "porteria", "parqueadero"],
    "Mirador del Virrey": ["salon", "parqueadero"],
    "Zarzal": ["porteria", "salon", "infantil", "gimnasio", "parqueadero", "recreativa"],
}

# Paleta y emojis de respaldo: solo se ven si un proyecto se queda sin imagen.
GRADIENTES = [
    "linear-gradient(135deg,#0067b1,#4a94cc)",
    "linear-gradient(135deg,#3a7bb0,#7ec0ec)",
    "linear-gradient(135deg,#004c85,#0067b1)",
    "linear-gradient(135deg,#2f6a9c,#5aa0d0)",
    "linear-gradient(135deg,#575756,#8a8a89)",
    "linear-gradient(135deg,#0067b1,#7ec0ec)",
    "linear-gradient(135deg,#33322f,#5f5e5b)",
    "linear-gradient(135deg,#4a94cc,#0067b1)",
]
EMOJIS = ["🏢", "🏘️", "🏡", "🏙️"]


# --------------------------------------------------------------------------
# Red. Se usa Scrapling como fetcher (headers de navegador reales, reintentos)
# y si no esta instalado se cae a urllib, que hace exactamente lo mismo aqui
# porque la data ya viene en JSON y no hay que parsear HTML.
# --------------------------------------------------------------------------
try:
    from scrapling.fetchers import Fetcher

    def bajar(url: str) -> str:
        r = Fetcher.get(url, timeout=60)
        if r.status != 200:
            raise IOError("HTTP %s" % r.status)
        return r.body if isinstance(r.body, str) else r.body.decode("utf-8", "replace")

    MOTOR = "scrapling"
except Exception:  # pragma: no cover - ruta de respaldo
    import urllib.request

    _UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36"}

    def bajar(url: str) -> str:
        req = urllib.request.Request(url, headers=_UA)
        return urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")

    MOTOR = "urllib (scrapling no disponible)"


def bajar_binario(url: str) -> bytes:
    import urllib.request

    req = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0"}
    )
    return urllib.request.urlopen(req, timeout=60).read()


# --------------------------------------------------------------------------
# Extraccion
# --------------------------------------------------------------------------
RE_NEXT = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json"[^>]*>(.*?)</script>', re.S
)


def nodo_de_ficha(html: str):
    """Devuelve el nodo del proyecto, o None si la pagina no es una ficha."""
    m = RE_NEXT.search(html)
    if not m:
        return None
    try:
        data = json.loads(m.group(1))
    except ValueError:
        return None
    recurso = (data.get("props") or {}).get("pageProps", {}).get("resource") or {}
    if recurso.get("type") != "node--housing_projects":
        return None
    return recurso


def nombre_de(ref) -> str | None:
    return (ref or {}).get("name") if isinstance(ref, dict) else None


def primera_url(obj, prof=0) -> str | None:
    """La imagen viene anidada dentro de la media entity; se busca la 1a 'url'."""
    if prof > 5 or not isinstance(obj, dict):
        return None
    u = obj.get("url")
    if isinstance(u, str) and u:
        return u
    for v in obj.values():
        if isinstance(v, dict):
            r = primera_url(v, prof + 1)
            if r:
                return r
    return None


def slug_de(url: str) -> str:
    return url.rstrip("/").rsplit("/", 1)[-1]


def slugificar(texto: str) -> str:
    """'Tipo A1 ' -> 'tipo-a1'. Para nombres de archivo predecibles."""
    limpio = sin_tildes(texto or "").lower()
    limpio = re.sub(r"[^a-z0-9]+", "-", limpio).strip("-")
    return limpio or "x"


def url_de_media(media) -> str | None:
    """URL del archivo dentro de una media entity de Drupal.

    El binario real cuelga de thumbnail.uri.url; se cae a field_media_image
    por si algun nodo trae la imagen solo por ahi.
    """
    if not isinstance(media, dict):
        return None
    for rama in ("thumbnail", "field_media_image"):
        sub = media.get(rama)
        if isinstance(sub, dict):
            uri = sub.get("uri")
            if isinstance(uri, dict) and isinstance(uri.get("url"), str):
                return uri["url"]
    return None


def texto_alt(media) -> str | None:
    if not isinstance(media, dict):
        return None
    thumb = media.get("thumbnail") or {}
    return (thumb.get("resourceIdObjMeta") or {}).get("alt")


IGNORAR_AL_BAJAR = ("links", "paragraph_type", "resourceIdObjMeta", "relationshipNames",
                    "metatag", "behavior_settings")


def _buscar_specs(nodo, etapa, salida, prof=0):
    """Recolecta los `specifications_module_item` a cualquier profundidad.

    Hay DOS formas de armar las tipologias en el CMS y una version anterior de
    este script solo entendia la primera, dejando 7 proyectos sin planos:

      A) modular_tabs -> modular_tabs_item -> field_tab[] -> specifications_module_item
      B) modular_tabs -> modular_tabs_select ("Etapa del proyecto")
                      -> tabs_select_item ("Etapa 1", "Torre 2", "Tipo B")
                      -> modular_tabs_item -> field_tab[] -> specifications_module_item

    En vez de codificar las dos rutas (y romperse con una tercera), se baja
    recursivamente buscando el nodo final. De paso se arrastra el nombre de la
    etapa/torre, que hace falta: La Arboleda tiene un "Tipo A" en la Etapa 2 y
    otro distinto en la Etapa 3, con precios diferentes.
    """
    if not isinstance(nodo, (dict, list)) or prof > 14:
        return salida
    if isinstance(nodo, list):
        for x in nodo:
            _buscar_specs(x, etapa, salida, prof + 1)
        return salida
    tipo = nodo.get("type")
    if tipo == "paragraph--tabs_select_item" and nodo.get("field_title"):
        etapa = str(nodo["field_title"]).strip() or etapa
    if tipo == "paragraph--specifications_module_item":
        salida.append((nodo, etapa))
        return salida
    for k, v in nodo.items():
        if k in IGNORAR_AL_BAJAR:
            continue
        _buscar_specs(v, etapa, salida, prof + 1)
    return salida


def etiqueta_tipologia(nombre: str, etapa: str | None) -> str:
    """'Torre 2' + 'Tipo A' -> 'Torre 2 · Tipo A'.

    Si el nombre ya arranca con la etapa no se repite ("Tipo B" + "Tipo B1"
    se queda en "Tipo B1"), y sin etapa se devuelve el nombre tal cual.
    """
    if not etapa or nombre.lower().startswith(etapa.lower()):
        return nombre
    return "%s · %s" % (etapa, nombre)


# --------------------------------------------------------------------------
# Vocabulario de amenidades del backend: 25 etiquetas EXACTAS.
#
# ⚠️ DUPLICADA en app/js/data.js (pregunta 'entorno_deseado'). Si cambia una,
# cambia la otra: el backend cruza lo que el usuario elige contra lo que trae
# el catalogo, y una diferencia de una letra rompe el match en silencio. Se
# respetan las erratas del contrato ("gymnasio", "cancha e padel", "zona de
# lavanderia" sin tilde, "zona kid" en singular).
# --------------------------------------------------------------------------
VOCABULARIO = [
    "lobby", "piscina", "zona de lavanderia", "zona bbq", "zona pet",
    "zona kid", "locales comerciales", "zona fitness", "salon social",
    "spa mascotas", "zona cool", "zona cine", "coworking", "sala vip",
    "zona cafe", "gymnasio", "parqueadero", "zona verde", "parque",
    "sala de juegos", "pista de trote", "voleibol playa", "cancha e padel",
    "taller de bicicletas", "sauna",
]

# El sitio publica las amenidades como texto libre: ~250 variantes distintas
# para decir ~25 cosas ("Salon social", "Salon comunal", "Salones sociales").
# Esto las agrupa por palabra clave. NO es coincidencia difusa: cada regla se
# escribio mirando las etiquetas reales, y el orden importa (gana la primera
# que casa), por eso las especificas van antes que las genericas.
REGLAS_AMENIDAD = [
    (r"spa de mascotas|spa mascotas|pet spa|pet grooming|beauty spa", "spa mascotas"),
    (r"taller de bicicleta|spa de bicicleta|bicicleta|bicicletero", "taller de bicicletas"),
    (r"cancha .*padel|padel", "cancha e padel"),
    (r"voleibol", "voleibol playa"),
    (r"sauna|turco", "sauna"),
    (r"piscina|jacuzzi|zona humeda|zonas humedas", "piscina"),
    (r"lavanderia|lavander", "zona de lavanderia"),
    (r"bbq|teppanyaki|asado", "zona bbq"),
    (r"\bpet\b|mascota|canino", "zona pet"),
    (r"infantil|\bkid|ninos|\bnino\b|ludoteca|playground|play ground|juegos de exterior|multijuegos|teatrino", "zona kid"),
    (r"local comercial|locales comerciales", "locales comerciales"),
    (r"gimnasio|gimansio|\bgym|ecogym|cardio|pesas|spinning|\btrx\b|calistenia", "gymnasio"),
    (r"fitness|yoga|meditacion|aerobic", "zona fitness"),
    (r"salon social|salon comunal|salones sociales|social kitchen|club house|edificio comunal|salon de social|club cocina|social living", "salon social"),
    (r"cine|proyeccion|sala de tv|sala tv", "zona cine"),
    (r"coworking|sala de junta|sala de reunion|salon de negocio|salas de reunion|salon de reunion|oficina|sala de juntas", "coworking"),
    (r"sala vip|salon vip|premium|sala de lectura|salas premium", "sala vip"),
    (r"cafe|cafeteria", "zona cafe"),
    (r"parqueadero|parqueaderos", "parqueadero"),
    (r"sala de juegos|salon de juegos|juegos de mesa|bolera|bolos|ping pong|golfito|squash|ajedrez", "sala de juegos"),
    (r"trote|atletica|caminata|sendero|circuito", "pista de trote"),
    (r"zona verde|zonas verdes|paisajis|jardin|lago", "zona verde"),
    (r"parque", "parque"),
    (r"lobby|porteria|recepcion", "lobby"),
    (r"zona cool|lounge|terraza|mirador|hamaca|chimenea|fireplace|kiosco|picnic|camping|descanso|lectura|zona de estar|fogata|rooftop", "zona cool"),
]
REGLAS_AMENIDAD = [(re.compile(p), e) for p, e in REGLAS_AMENIDAD]


def clave_de_amenidad(etiqueta: str) -> str | None:
    """'Terraza BBQ' -> 'zona bbq'. None si no encaja en el vocabulario (p. ej.
    'Cuarto de residuos' o 'Subestacion electrica', que no tienen casilla)."""
    normal = sin_tildes(etiqueta or "").lower().strip()
    for patron, clave in REGLAS_AMENIDAD:
        if patron.search(normal):
            return clave
    return None


def extraer_amenidades(recurso: dict) -> list:
    """Zonas comunes del proyecto, con su icono: el bloque "Este proyecto
    cuenta con:" de la ficha.

    OJO donde vive la etiqueta: en `field_link.title`, NO en
    `field_description` (que viene vacio). Una version anterior de este script
    buscaba en field_description, no encontraba nada, y de ahi salio la
    afirmacion —falsa— de que las amenidades no eran scrapeables. Los 66
    proyectos las publican, ~10 cada uno.
    """
    salida = []
    vistas = set()
    for sec in recurso.get("field_section") or []:
        if not isinstance(sec, dict) or sec.get("type") != "paragraph--information_with_icons":
            continue
        for item in sec.get("field_item") or []:
            if not isinstance(item, dict):
                continue
            enlace = item.get("field_link") or {}
            etiqueta = (enlace.get("title") or "").strip() if isinstance(enlace, dict) else ""
            if not etiqueta or etiqueta.lower() in vistas:
                continue
            vistas.add(etiqueta.lower())
            salida.append({
                "label": etiqueta,
                # Clave del vocabulario de 25 del contrato: es lo que permite
                # cruzarla con el `entorno_deseado` que eligio el usuario y
                # resaltar las coincidencias en la tarjeta. Puede ser None.
                "clave": clave_de_amenidad(etiqueta),
                "_icono_remoto": url_de_media(item.get("field_image")),
            })
    return salida


def extraer_tipologias(recurso: dict) -> list:
    """Tipologias publicadas en la ficha (Tipo A, Tipo B...).

    De cada `specifications_module_item` salen:
      field_area / field_private_area / field_price / field_delivery_date
      field_item[]    -> espacios (field_description + field_image = icono svg)
      field_gallery[] -> planos   (field_description + field_image)
    """
    tipologias = []
    for sec in recurso.get("field_section") or []:
        if not isinstance(sec, dict) or sec.get("type") != "paragraph--modular_tabs":
            continue
        grupo = (sec.get("field_title") or "").strip() or None

        for tab, etapa in _buscar_specs(sec.get("field_item"), None, []):
            nombre = (tab.get("field_title") or "").strip()
            if not nombre:
                continue

            espacios = []
            for esp in tab.get("field_item") or []:
                if not isinstance(esp, dict):
                    continue
                etiqueta = (esp.get("field_description") or "").strip()
                if not etiqueta:
                    continue
                espacios.append({"label": etiqueta, "_icono_remoto": url_de_media(esp.get("field_image"))})

            planos = []
            for pl in tab.get("field_gallery") or []:
                if not isinstance(pl, dict):
                    continue
                ruta = url_de_media(pl.get("field_image"))
                if not ruta:
                    continue
                planos.append({
                    "desc": (pl.get("field_description") or "").strip() or None,
                    "alt": texto_alt(pl.get("field_image")),
                    "_plano_remoto": CMS + ruta if ruta.startswith("/") else ruta,
                })

            tipologias.append({
                "nombre": etiqueta_tipologia(nombre, etapa),
                "grupo": grupo,
                "etapa": etapa,
                "area": tab.get("field_area"),
                "areaPrivada": tab.get("field_private_area"),
                # En pesos, no en millones: el simulador de plan de pagos
                # (js/simulador.js) trabaja con el valor exacto.
                "precio": tab.get("field_price") or None,
                "entrega": (tab.get("field_delivery_date") or "").strip() or None,
                "espacios": espacios,
                "planos": planos,
            })
    return tipologias


def sin_tildes(s: str) -> str:
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()


# --------------------------------------------------------------------------
# Ubicacion por localidad
#
# Se cruzan DOS senales independientes, porque ninguna basta sola:
#
#   1. La coordenada del mapa de la ficha, contra los poligonos oficiales.
#      Problema: ese mapa es el de la SALA DE VENTAS, y varias constructoras
#      usan una sola sala para varios proyectos. Verificado: Acanto, Eskala y
#      Florecer comparten el punto (4.6293, -74.2076); para los dos primeros
#      coincide con su proyecto, para Eskala no —su proyecto esta en la Avenida
#      Carrera 50, en Puente Aranda.
#   2. La localidad nombrada en el TEXTO descriptivo de la propia ficha. Es
#      menos frecuente (solo algunas la mencionan) pero cuando aparece es del
#      proyecto, no de la sala de ventas. Por eso GANA sobre la coordenada.
#
# No se usa geocodificacion externa: se probo Nominatim y con la nomenclatura
# bogotana falla feo (ubico "Carrera 15 # 63A-40" en Tunjuelito, que esta a
# 10 km de Chapinero).
# --------------------------------------------------------------------------
_LOCALIDADES_CACHE = None


def cargar_localidades():
    """Poligonos de las 20 localidades. Devuelve [(nombre, [anillos])]."""
    global _LOCALIDADES_CACHE
    if _LOCALIDADES_CACHE is not None:
        return _LOCALIDADES_CACHE

    crudo = None
    if os.path.exists(CACHE_LOCALIDADES):
        try:
            with open(CACHE_LOCALIDADES, encoding="utf-8") as fh:
                crudo = json.load(fh)
        except ValueError:
            crudo = None
    if crudo is None:
        print("   bajando limites de localidades (datos abiertos de Bogota)...")
        crudo = json.loads(bajar_binario(URL_LOCALIDADES).decode("utf-8"))
        with open(CACHE_LOCALIDADES, "w", encoding="utf-8") as fh:
            json.dump(crudo, fh)

    salida = []
    for f in crudo.get("features", []):
        nombre = (f.get("attributes") or {}).get("LocNombre")
        anillos = (f.get("geometry") or {}).get("rings") or []
        if nombre and anillos:
            salida.append((nombre_bonito_localidad(nombre), anillos))
    _LOCALIDADES_CACHE = salida
    return salida


def nombre_bonito_localidad(oficial: str) -> str:
    clave = sin_tildes(oficial).lower().strip()
    for L in LOCALIDADES_BOGOTA:
        if sin_tildes(L).lower() == clave:
            return L
    # "LOS MARTIRES" vs "Los Mártires", "CANDELARIA" vs "La Candelaria", etc.
    for L in LOCALIDADES_BOGOTA:
        ln = sin_tildes(L).lower()
        if clave in ln or ln in clave:
            return L
    return oficial.title()


def _punto_en_anillo(x: float, y: float, anillo) -> bool:
    dentro = False
    n = len(anillo)
    j = n - 1
    for i in range(n):
        xi, yi = anillo[i][0], anillo[i][1]
        xj, yj = anillo[j][0], anillo[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            dentro = not dentro
        j = i
    return dentro


def localidad_de_coord(lat: float, lon: float) -> str | None:
    for nombre, anillos in cargar_localidades():
        dentro = False
        for anillo in anillos:
            if _punto_en_anillo(lon, lat, anillo):
                dentro = not dentro  # los anillos interiores son huecos
        if dentro:
            return nombre
    return None


RE_COORDS = re.compile(r"!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)")


def coords_de(recurso: dict):
    """lat/lon del iframe de Google Maps del modulo de sala de ventas."""
    for sec in recurso.get("field_section") or []:
        if not isinstance(sec, dict) or sec.get("type") != "paragraph--map_module":
            continue
        for item in sec.get("field_item") or []:
            if not isinstance(item, dict):
                continue
            m = RE_COORDS.search(item.get("field_url_iframe_2") or "")
            if m:
                return float(m.group(2)), float(m.group(1))
    return None


def localidad_en_texto(recurso: dict) -> str | None:
    """Localidad nombrada en la descripcion del proyecto.

    Se excluye a proposito el `map_module`: su direccion es la de la sala de
    ventas y, al estar compartida entre proyectos, contamina la senal (se
    comprobo con Mirador del Virrey y Reserva del Nogal, que comparten una
    direccion en Bosa pero estan los dos en San Cristobal).
    """
    trozos = [recurso.get("title") or ""]

    def meter(v):
        if isinstance(v, str):
            trozos.append(v)
        elif isinstance(v, dict) and v.get("value"):
            trozos.append(re.sub(r"<[^>]+>", " ", str(v["value"])))

    for sec in recurso.get("field_section") or []:
        if not isinstance(sec, dict):
            continue
        if sec.get("type") in ("paragraph--descriptive_module", "paragraph--information_text"):
            for campo in ("field_title", "field_long_description",
                          "field_long_description_two", "field_characteristics",
                          "field_two_columns_text"):
                meter(sec.get(campo))

    texto = sin_tildes(" | ".join(trozos)).lower()
    halladas = [L for L in LOCALIDADES_BOGOTA if sin_tildes(L).lower() in texto]
    # Solo sirve si es inequivoca: si la ficha nombra dos localidades no se
    # puede saber cual es la del proyecto y manda la coordenada.
    return halladas[0] if len(halladas) == 1 else None


def vecinas_de_localidades() -> dict:
    """Localidades que COLINDAN, calculado de los propios poligonos.

    Dos localidades son vecinas si comparten al menos 2 vertices exactos. El
    dataset del Distrito es topologicamente limpio, asi que esto da la
    adyacencia real sin escribirla a mano (verificado: Kennedy linda con Bosa,
    Fontibon, Puente Aranda, Tunjuelito y Ciudad Bolivar; La Candelaria solo
    con Santa Fe). js/matching.js la usa para no castigar un proyecto que
    queda en la localidad de al lado.
    """
    locs = cargar_localidades()
    puntos = []
    for nombre, anillos in locs:
        s = set()
        for anillo in anillos:
            for p in anillo:
                s.add((round(p[0], 6), round(p[1], 6)))
        puntos.append((nombre, s))

    vecinas = {}
    for i in range(len(puntos)):
        for j in range(i + 1, len(puntos)):
            comunes = len(puntos[i][1] & puntos[j][1])
            if comunes >= 2:
                vecinas.setdefault(puntos[i][0], []).append(puntos[j][0])
                vecinas.setdefault(puntos[j][0], []).append(puntos[i][0])
    return {k: sorted(v) for k, v in sorted(vecinas.items())}


def ubicar_localidad(recurso: dict):
    """Devuelve (localidad, fuente). fuente: 'texto' | 'coordenada' | None."""
    por_texto = localidad_en_texto(recurso)
    coords = coords_de(recurso)
    por_coord = localidad_de_coord(*coords) if coords else None
    if por_texto:
        return por_texto, ("texto" if por_texto != por_coord else "coordenada+texto")
    return por_coord, ("coordenada" if por_coord else None)


def mapear(recurso: dict, url: str, idx: int) -> dict:
    titulo = (recurso.get("title") or "").strip()
    depto = nombre_de(recurso.get("field_housing_project_department"))
    ciudad = nombre_de(recurso.get("field_housing_project_city"))
    subsidio = nombre_de(recurso.get("field_subsidy_type"))

    # En Bogota el campo "city" del CMS trae en realidad la ZONA (Occidente,
    # Chapinero, Suroriente...), que es justo lo que pregunta el quiz.
    es_bogota = (depto or "") == "Bogotá"
    muni = "Bogotá" if es_bogota else (ciudad or depto or "")
    zona = ciudad if es_bogota else None

    vis = (subsidio or "") == "VIS"
    precio = recurso.get("field_price") or 0

    proyecto = {
        "name": titulo,
        "muni": muni,
        "vis": vis,
        # La app razona en millones de COP (ver matching.js).
        "price": int(round(precio / 1e6)) if precio else 0,
        "area": recurso.get("field_area"),
        "hab": recurso.get("field_rooms"),
        "banos": recurso.get("field_bathrooms"),
        "subsidy": "Mi Casa Ya" if vis else "Crédito hipotecario",
        "emoji": EMOJIS[idx % len(EMOJIS)],
        "grad": GRADIENTES[idx % len(GRADIENTES)],
        "url": url,
        "slug": slug_de(url),
    }
    if zona:
        # Zona cardinal del CMS (Occidente, Norte...). Se conserva como dato
        # informativo, pero la ubicacion que usa la app es `localidad`.
        proyecto["zona"] = zona

    if es_bogota:
        localidad, fuente = ubicar_localidad(recurso)
        if localidad:
            proyecto["localidad"] = localidad
            proyecto["_fuente_localidad"] = fuente

    if titulo in TRANSACCIONES:
        proyecto["transacciones"] = TRANSACCIONES[titulo]
    if titulo in AMENIDADES_CURADAS:
        proyecto["amenities"] = AMENIDADES_CURADAS[titulo]

    tipologias = extraer_tipologias(recurso)
    if tipologias:
        proyecto["tipologias"] = tipologias

        # El precio "desde" sale de la tipologia mas barata, no de field_price.
        # Los dos son datos oficiales de la misma ficha, pero el de tipologia es
        # por unidad y resulta mas fiable: en Calia, field_price dice $2.950M y
        # sus tres tipologias $295M —un cero de mas, exactamente 10x—, y la app
        # se contradecia sola (la tarjeta mostraba un precio y el panel otro).
        # Es el unico caso con diferencia grande; en los otros 30 coinciden.
        precios = [t["precio"] for t in tipologias if t.get("precio")]
        if precios:
            proyecto["price"] = int(round(min(precios) / 1e6))

    # Zonas comunes reales de la ficha ("Este proyecto cuenta con:"). Distinto
    # de `amenities`, que era una curaduria a mano sobre 9 claves con icono
    # propio; estas traen la etiqueta y el icono del sitio.
    amenidades = extraer_amenidades(recurso)
    if amenidades:
        proyecto["amenidades"] = amenidades

    ruta = primera_url(recurso.get("field_project_image") or {}) or primera_url(
        recurso.get("field_large_image") or {}
    )
    proyecto["_img_remota"] = (CMS + ruta) if ruta and ruta.startswith("/") else ruta
    return proyecto


# Proyectos cuya ficha no publica imagen, pero que ya tenian una descargada de
# la version anterior del catalogo. Se reutiliza en vez de dejar la tarjeta con
# el gradiente de respaldo. Clave = titulo en el sitio, valor = archivo en
# assets/proyectos/.
IMAGENES_HEREDADAS = {
    "Verde Esperanza - El Dorado": "verde-esperanza-el-dorado.webp",
}


def guardar_imagen(proyecto: dict) -> None:
    """Baja la imagen a assets/proyectos/<slug>.<ext>. Si falla, se deja sin
    imagen y la tarjeta cae al gradiente+emoji que ya maneja templates.js."""
    remota = proyecto.pop("_img_remota", None)
    if not remota:
        heredada = IMAGENES_HEREDADAS.get(proyecto["name"])
        if heredada and os.path.exists(os.path.join(DIR_IMG, heredada)):
            proyecto["image"] = "assets/proyectos/" + heredada
        return
    ext = os.path.splitext(remota.split("?")[0])[1].lower() or ".jpg"
    if ext not in (".webp", ".jpg", ".jpeg", ".png"):
        ext = ".jpg"
    nombre = proyecto["slug"] + ext
    destino = os.path.join(DIR_IMG, nombre)
    rel = "assets/proyectos/" + nombre
    if os.path.exists(destino) and os.path.getsize(destino) > 0:
        proyecto["image"] = rel
        return
    try:
        datos = bajar_binario(remota)
        if len(datos) < 500:
            raise IOError("imagen sospechosamente pequeña (%d bytes)" % len(datos))
        with open(destino, "wb") as fh:
            fh.write(datos)
        proyecto["image"] = rel
    except Exception as e:
        print("    ! sin imagen %-28s %s" % (proyecto["name"][:28], e))


def bajar_a(remota: str, destino: str, minimo: int = 200) -> bool:
    """Descarga idempotente: si el archivo ya existe y pesa, no vuelve a bajar."""
    if os.path.exists(destino) and os.path.getsize(destino) > 0:
        return True
    try:
        datos = bajar_binario(remota)
        if len(datos) < minimo:
            raise IOError("archivo sospechosamente pequeno (%d bytes)" % len(datos))
        with open(destino, "wb") as fh:
            fh.write(datos)
        return True
    except Exception as e:
        print("    ! %s -> %s" % (os.path.basename(destino), e))
        return False


def _guardar_icono(entrada: dict, destino_dir: str, prefijo_rel: str) -> None:
    """Baja el icono de una entrada {label, _icono_remoto} y le pone `icon`."""
    import urllib.parse

    remota = entrada.pop("_icono_remoto", None)
    if not remota:
        return
    if remota.startswith("/"):
        remota = CMS + remota
    # El nombre viene URL-encoded en el CMS ("icono-ba%C3%B1os.svg").
    crudo = urllib.parse.unquote(remota.split("?")[0].rsplit("/", 1)[-1])
    base, ext = os.path.splitext(crudo)
    nombre = slugificar(base) + (ext.lower() if ext else ".svg")
    if bajar_a(remota, os.path.join(destino_dir, nombre)):
        entrada["icon"] = prefijo_rel + nombre


def guardar_assets_tipologias(proyecto: dict) -> None:
    """Baja planos e iconos de cada tipologia y reescribe las rutas a locales.

    Los planos se nombran <slug-proyecto>-<slug-tipologia>-<n>.<ext> para que
    el nombre sea estable entre corridas. Los iconos son compartidos entre
    proyectos (son SVGs del sistema de diseno de Colsubsidio), asi que van a
    una carpeta aparte con su nombre original normalizado.
    """
    for t in proyecto.get("tipologias") or []:
        planos = []
        for n, pl in enumerate(t.get("planos") or []):
            remota = pl.pop("_plano_remoto", None)
            if not remota:
                continue
            ext = os.path.splitext(remota.split("?")[0])[1].lower()
            if ext not in (".webp", ".jpg", ".jpeg", ".png"):
                ext = ".jpg"
            nombre = "%s-%s-%d%s" % (proyecto["slug"], slugificar(t["nombre"]), n + 1, ext)
            if bajar_a(remota, os.path.join(DIR_PLANOS, nombre), minimo=500):
                pl["src"] = "assets/planos/" + nombre
                planos.append(pl)
        t["planos"] = planos

        for esp in t.get("espacios") or []:
            _guardar_icono(esp, DIR_ICONOS, "assets/iconos-tipologia/")

    # Iconos de las zonas comunes. Van a la misma carpeta: son del mismo
    # sistema de diseno y varios se repiten entre secciones.
    for am in proyecto.get("amenidades") or []:
        _guardar_icono(am, DIR_ICONOS, "assets/iconos-tipologia/")


def js_valor(v) -> str:
    """Serializa un valor Python como literal JS. Soporta anidamiento, que es
    lo que necesitan las tipologias (lista de objetos con listas dentro)."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, list):
        return "[" + ", ".join(js_valor(x) for x in v) + "]"
    if isinstance(v, dict):
        return "{ " + ", ".join(
            "%s: %s" % (js_clave(k), js_valor(x)) for k, x in v.items() if x is not None
        ) + " }"
    return "'" + str(v).replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ") + "'"


def js_clave(k: str) -> str:
    """Las claves con espacios o tildes ('Ciudad Bolivar') deben ir citadas."""
    if re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$]*", str(k)):
        return str(k)
    return "'" + str(k).replace("\\", "\\\\").replace("'", "\\'") + "'"


def escribir_js(proyectos: list, ruta: str) -> None:
    import datetime

    hoy = datetime.date.today().isoformat()
    con_tx = sum(1 for p in proyectos if "transacciones" in p)
    con_tip = sum(1 for p in proyectos if p.get("tipologias"))
    n_tip = sum(len(p.get("tipologias") or []) for p in proyectos)
    lineas = [
        "// ARCHIVO GENERADO — no editar a mano.",
        "// Lo produce tools/scrape_proyectos.py desde el sitio real de",
        "// Colsubsidio (sitemap + __NEXT_DATA__ de cada ficha).",
        "//",
        "//   Generado: %s" % hoy,
        "//   Proyectos: %d  (%d con transacciones reales del Excel)" % (len(proyectos), con_tx),
        "//   Tipologias: %d en %d proyectos (los demas no las publican)" % (n_tip, con_tip),
        "//   Fuente: https://www.colsubsidio.com/vivienda/proyectos",
        "//",
        "// area/hab/banos/price son datos OFICIALES de la ficha de cada",
        "// proyecto, no estimaciones. `transacciones` es el # de opciones de",
        "// compra reales del Excel del reto (ver docs/proyectos-reales-",
        "// investigacion.md) — señal de demanda util para el clustering.",
        "//",
        "// `tipologias[]` son los planos publicados por proyecto: nombre,",
        "// area construida/privada, precio EN PESOS (no en millones, lo usa",
        "// js/simulador.js), fecha de entrega, los espacios que incluye y las",
        "// imagenes de plano. Los proyectos sin tipologias no traen el campo.",
        "//",
        "// `localidad` sale de cruzar la coordenada del mapa de la ficha con",
        "// los limites oficiales de las 20 localidades (datos abiertos de",
        "// Bogota); cuando el texto de la ficha nombra otra localidad, gana el",
        "// texto, porque el mapa suele ser el de la SALA DE VENTAS.",
        "// Para regenerar:  python tools/scrape_proyectos.py",
        "window.GDF_PROYECTOS = [",
    ]
    for p in proyectos:
        p.pop("slug", None)
        p.pop("_fuente_localidad", None)  # diagnostico del scraper, no de la app
        campos = [
            "%s: %s" % (k, js_valor(v)) for k, v in p.items() if v is not None
        ]
        lineas.append("  { " + ", ".join(campos) + " },")
    lineas.append("];")

    lineas += [
        "",
        "// Localidades que COLINDAN, calculadas de los poligonos oficiales (dos",
        "// localidades son vecinas si comparten al menos 2 vertices). La usa",
        "// js/matching.js para no castigar un proyecto que queda al lado de la",
        "// localidad pedida.",
        "window.GDF_LOCALIDADES_VECINAS = %s;" % js_valor(vecinas_de_localidades()),
    ]
    with open(ruta, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lineas) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-img", action="store_true", help="no descargar imagenes")
    ap.add_argument("--limite", type=int, default=0, help="solo N proyectos (pruebas)")
    ap.add_argument("--todo-el-pais", action="store_true",
                    help="no filtrar a Bogota (la app hoy espera solo Bogota)")
    args = ap.parse_args()

    print("motor de red: %s" % MOTOR)
    print("1) sitemap...")
    urls = sorted(set(RE_PROYECTO.findall(bajar(SITEMAP))))
    if args.limite:
        urls = urls[: args.limite]
    print("   %d fichas de proyecto" % len(urls))

    # Se cargan ANTES del pool: si cada hilo llama a cargar_localidades() a la
    # vez, los 8 ven el cache vacio y bajan los 2 MB por separado.
    if not args.todo_el_pais:
        cargar_localidades()

    print("2) descargando fichas...")

    def tarea(par):
        i, u = par
        try:
            recurso = nodo_de_ficha(bajar(u))
            if not recurso:
                return ("no-ficha", u, None)
            return ("ok", u, mapear(recurso, u, i))
        except Exception as e:
            return ("error", u, "%s: %s" % (type(e).__name__, e))

    with ThreadPoolExecutor(max_workers=8) as ex:
        resultados = list(ex.map(tarea, enumerate(urls)))

    proyectos = [r[2] for r in resultados if r[0] == "ok"]
    errores = [(r[1], r[2]) for r in resultados if r[0] == "error"]
    no_ficha = [r[1] for r in resultados if r[0] == "no-ficha"]
    print("   ok: %d | errores: %d | no eran ficha: %d" % (len(proyectos), len(errores), len(no_ficha)))
    for u, e in errores:
        print("    ! %s -> %s" % (u, e))

    if not proyectos:
        print("ABORTADO: no se obtuvo ningun proyecto; no se toca js/proyectos.js")
        return 1

    # La demo es SOLO de Bogota: se descartan los proyectos de Cundinamarca,
    # Boyaca y Tolima. Ojo, no basta con mirar la URL: hay fichas colgando de
    # /vivienda/proyectos/bogota/ que son de Soacha (p. ej. Zarzal), y esas
    # tampoco entran.
    if not args.todo_el_pais:
        fuera = [p["name"] for p in proyectos if p["muni"] != "Bogotá" or not p.get("localidad")]
        proyectos = [p for p in proyectos if p["muni"] == "Bogotá" and p.get("localidad")]
        print("   solo Bogota: %d proyectos (descartados %d)" % (len(proyectos), len(fuera)))
        if fuera:
            print("     fuera: %s" % ", ".join(sorted(fuera)))
        if not proyectos:
            print("ABORTADO: ningun proyecto de Bogota; no se toca js/proyectos.js")
            return 1

    if args.no_img:
        for p in proyectos:
            p.pop("_img_remota", None)
            for t in p.get("tipologias") or []:
                for pl in t.get("planos") or []:
                    pl.pop("_plano_remoto", None)
                for esp in t.get("espacios") or []:
                    esp.pop("_icono_remoto", None)
                # Sin plano descargado la tipologia no tiene nada que mostrar.
                t["planos"] = []
    else:
        print("3) imagenes de proyecto...")
        for d in (DIR_IMG, DIR_PLANOS, DIR_ICONOS):
            if not os.path.isdir(d):
                os.makedirs(d)
        with ThreadPoolExecutor(max_workers=6) as ex:
            list(ex.map(guardar_imagen, proyectos))
        print("   con imagen: %d/%d" % (sum(1 for p in proyectos if p.get("image")), len(proyectos)))

        print("4) planos e iconos de tipologias...")
        with ThreadPoolExecutor(max_workers=6) as ex:
            list(ex.map(guardar_assets_tipologias, proyectos))
        n_planos = sum(
            len(t.get("planos") or []) for p in proyectos for t in p.get("tipologias") or []
        )
        print("   %d planos descargados | %d iconos distintos" % (
            n_planos,
            len(os.listdir(DIR_ICONOS)) if os.path.isdir(DIR_ICONOS) else 0,
        ))

    # Orden estable (por nombre) para que el diff de git sea legible.
    proyectos.sort(key=lambda p: sin_tildes(p["name"]).lower())

    incompletos = [p["name"] for p in proyectos if not p.get("area") or not p.get("hab") or not p.get("price")]
    if incompletos:
        print("   ojo, sin area/hab/precio: %s" % ", ".join(incompletos[:6]))

    escribir_js(proyectos, SALIDA_JS)
    print("5) escrito %s" % SALIDA_JS)
    print("   %d proyectos | %d con transacciones reales | %d VIS" % (
        len(proyectos),
        sum(1 for p in proyectos if "transacciones" in p),
        sum(1 for p in proyectos if p["vis"]),
    ))
    con_tip = [p for p in proyectos if p.get("tipologias")]
    print("   %d proyectos con tipologias (%d tipologias en total)" % (
        len(con_tip),
        sum(len(p["tipologias"]) for p in con_tip),
    ))
    sin_tip = [p["name"] for p in proyectos if not p.get("tipologias")]
    if sin_tip:
        print("   sin tipologias (la UI cae al resumen): %s" % ", ".join(sin_tip))

    porloc = {}
    for p in proyectos:
        porloc.setdefault(p.get("localidad") or "(sin localidad)", []).append(p["name"])
    print("   localidades: %d" % len(porloc))
    for loc in sorted(porloc, key=lambda k: (-len(porloc[k]), k)):
        print("     %-20s %d" % (loc, len(porloc[loc])))
    por_texto = [p["name"] for p in proyectos if p.get("_fuente_localidad") == "texto"]
    if por_texto:
        print("   ubicados por el TEXTO de la ficha (su mapa apunta a la sala de")
        print("   ventas, que esta en otra localidad): %s" % ", ".join(por_texto))
    return 0


if __name__ == "__main__":
    sys.exit(main())
