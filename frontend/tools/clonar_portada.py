#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Extrae la portada real de Colsubsidio y la deja lista para reproducirla.

    pip install playwright && playwright install       (o usar Edge del sistema)
    python tools/clonar_portada.py                     # -> js/portada.js

Produce `js/portada.js` (GENERADO) y descarga a `assets/portada/` las imagenes
que usa la pagina. Con eso, `templates.js` puede pintar
https://www.colsubsidio.com/vivienda/proyectos sin pedir nada a la red.

POR QUE DOS PASES
-----------------
La pagina es Drupal servido por Next.js:

  A) Casi todo viene YA en el `__NEXT_DATA__` del HTML: los tres menus de la
     cabecera, los 8 grupos del footer, los textos de cada franja, los
     degradados literales y las rutas de las imagenes. Es exactamente la misma
     tecnica que usa tools/scrape_proyectos.py, y no necesita navegador.

  B) Pero DOS franjas no estan ahi: las tarjetas de "Proyectos propios"
     (`field_new_projects`) y los contadores de "Ciudades"
     (`field_automatic_information`) son vistas de Drupal (`view--view`) que se
     resuelven EN CLIENTE. Para esas hay que renderizar. Se usa Playwright con
     el Edge del sistema (`channel='msedge'`), porque los navegadores propios
     de Playwright no estan bajados en esta maquina.

Si el pase B falla, el script NO pisa lo que ya hubiera en js/portada.js para
esas dos franjas: es preferible un catalogo de hace una semana que una portada
con dos huecos.

LO QUE ESTE SCRIPT NO HACE
--------------------------
No baja el CSS de ellos. Sus bundles suman >250 KB de reglas globales que
chocarian con las 3.900 lineas de `.gdf-*` y romperian el quiz. El aspecto se
reproduce en css/styles.css a mano, pero con los numeros MEDIDOS: ver
`--medir`, que vuelca los estilos computados de la pagina real.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import unicodedata
import urllib.parse
import urllib.request

URL = "https://www.colsubsidio.com/vivienda/proyectos"
SITIO = "https://www.colsubsidio.com"
CMS = "https://cms.colsubsidio.com"

AQUI = os.path.dirname(os.path.abspath(__file__))
APP = os.path.dirname(AQUI)
SALIDA_JS = os.path.join(APP, "js", "portada.js")
DIR_IMG = os.path.join(APP, "assets", "portada")
REL_IMG = "assets/portada"

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36"}

RE_NEXT = re.compile(
    r'<script id="__NEXT_DATA__" type="application/json"[^>]*>(.*?)</script>', re.S
)


# --------------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------------
def bajar(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=90).read().decode("utf-8", "replace")


def bajar_binario(url: str) -> bytes:
    req = urllib.request.Request(url, headers=UA)
    return urllib.request.urlopen(req, timeout=90).read()


def sin_tildes(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if not unicodedata.combining(c))


def slugificar(texto: str) -> str:
    limpio = sin_tildes(texto or "").lower()
    return re.sub(r"[^a-z0-9]+", "-", limpio).strip("-") or "x"


def absoluta(url: str | None) -> str | None:
    """Las rutas del CMS vienen relativas ('/sites/default/files/...') y las del
    propio Next ('/assets/icons/...'). Cada una cuelga de un host distinto."""
    if not url:
        return None
    if url.startswith("http"):
        return url
    if url.startswith("/sites/"):
        return CMS + url
    return SITIO + url


def texto_plano(html: str | None) -> str | None:
    """El CMS entrega los parrafos como HTML ('<p>...</p>'). Aqui solo se quiere
    el texto: el marcado lo pone templates.js."""
    if not html:
        return None
    t = re.sub(r"<[^>]+>", " ", html)
    t = (t.replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", '"')
          .replace("&#039;", "'").replace("&lt;", "<").replace("&gt;", ">"))
    return re.sub(r"\s+", " ", t).strip() or None


def valor(nodo, *claves):
    """d['a']['b'] sin reventar si falta algun eslabon."""
    cur = nodo
    for k in claves:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(k)
    return cur


def url_de_media(media) -> str | None:
    """URL del binario dentro de una media entity de Drupal (mismo helper que
    scrape_proyectos.py: el archivo real cuelga de thumbnail.uri.url)."""
    if not isinstance(media, dict):
        return None
    for rama in ("thumbnail", "field_media_image"):
        sub = media.get(rama)
        if isinstance(sub, dict) and isinstance(sub.get("uri"), dict):
            u = sub["uri"].get("url")
            if isinstance(u, str):
                return u
    return None


def primera_imagen(nodo, prof: int = 0) -> str | None:
    """Primera ruta de imagen a cualquier profundidad. Hace falta porque cada
    tipo de parrafo del CMS cuelga la imagen de un campo distinto
    (field_image, field_image_two, field_banner...)."""
    if prof > 8 or nodo is None:
        return None
    if isinstance(nodo, str):
        return nodo if re.search(r"/sites/default/files/.+\.(png|jpe?g|webp|svg)$", nodo) else None
    if isinstance(nodo, dict):
        directa = url_de_media(nodo)
        if directa:
            return directa
        for k, v in nodo.items():
            if k in ("links", "resourceIdObjMeta", "metatag", "paragraph_type"):
                continue
            r = primera_imagen(v, prof + 1)
            if r:
                return r
    if isinstance(nodo, list):
        for v in nodo:
            r = primera_imagen(v, prof + 1)
            if r:
                return r
    return None


def enlace(nodo) -> dict | None:
    """{ texto, url } de un field_link de Drupal. Los `internal:` y `entity:`
    se dejan como ruta del sitio; en la demo no navegan a ningun sitio, pero el
    href real es lo que hace que el enlace se vea (y se copie) igual."""
    if not isinstance(nodo, dict):
        return None
    uri = nodo.get("resolvable_uri") or nodo.get("uri") or ""
    if uri.startswith("internal:"):
        uri = uri[len("internal:"):]
    if uri.startswith("entity:"):
        uri = "/" + uri[len("entity:"):]
    return {"texto": nodo.get("title") or None, "url": uri or None}


# --------------------------------------------------------------------------
# Descarga de imagenes
# --------------------------------------------------------------------------
_CACHE_IMG: dict = {}


def guardar_imagen(remota: str | None, prefijo: str) -> str | None:
    """Baja la imagen y devuelve su ruta RELATIVA para el navegador.
    Idempotente: si el archivo ya esta, no vuelve a pedirlo."""
    if not remota:
        return None
    url = absoluta(remota)
    if url in _CACHE_IMG:
        return _CACHE_IMG[url]

    base = urllib.parse.unquote(url.rsplit("/", 1)[-1])
    raiz, ext = os.path.splitext(base)
    ext = (ext or ".webp").lower()
    if ext not in (".webp", ".png", ".jpg", ".jpeg", ".svg"):
        ext = ".webp"
    nombre = "%s-%s%s" % (prefijo, slugificar(raiz)[:48], ext)
    destino = os.path.join(DIR_IMG, nombre)
    rel = "%s/%s" % (REL_IMG, nombre)

    if not (os.path.exists(destino) and os.path.getsize(destino) > 0):
        try:
            datos = bajar_binario(url)
            if len(datos) < 100:
                raise IOError("archivo sospechosamente pequeno (%d bytes)" % len(datos))
            with open(destino, "wb") as fh:
                fh.write(datos)
            print("    + %s (%.0f KB)" % (nombre, len(datos) / 1024.0))
        except Exception as e:
            print("    ! %s -> %s" % (nombre, e))
            _CACHE_IMG[url] = None
            return None

    _CACHE_IMG[url] = rel
    return rel


# --------------------------------------------------------------------------
# Pase A: __NEXT_DATA__
# --------------------------------------------------------------------------
def menu_items(lista, wrapper: str | None = None) -> list:
    """Aplana un menu de Drupal a [{texto, url, icono}].

    Los menus de cabecera vienen en TRES variantes (la normal y dos de
    personalizacion: `-people-woman`, `-people-digital`). Se toma la normal,
    que es la que ve todo el mundo.
    """
    salida = []
    if not isinstance(lista, list):
        return salida
    if lista and isinstance(lista[0], dict) and "currentMenu" in lista[0]:
        elegido = None
        for w in lista:
            if wrapper and w.get("id") == wrapper:
                elegido = w
                break
        lista = (elegido or lista[0]).get("currentMenu") or []
    for it in lista:
        if not isinstance(it, dict) or it.get("enabled") is False:
            continue
        e = enlace(it.get("link")) or {}
        salida.append({
            "texto": it.get("title"),
            "url": e.get("url"),
            "_icono": primera_imagen(it.get("field_icon") or it.get("field_image")),
        })
    return salida


def extraer(html: str) -> dict:
    m = RE_NEXT.search(html)
    if not m:
        raise SystemExit("No aparece __NEXT_DATA__: la pagina cambio de tecnologia.")
    d = json.loads(m.group(1))
    pp = d["props"]["pageProps"]
    r = pp["resource"]
    menus = pp["menus"]
    secs = {}
    for s in r.get("field_section") or []:
        secs.setdefault(s.get("type"), s)

    out: dict = {}

    # --- cabecera -----------------------------------------------------------
    # El logo a color va aparte: el que ya hay en el repo (assets/Logov2.png)
    # es la version BLANCA, hecha para la nav azul de la app, y sobre la barra
    # blanca del portal no se ve. No cuelga del CMS sino de su propio Next.
    out["logo"] = "/assets/icons/logo-colsubsidio.svg"

    hm = menus["headerMenus"]
    out["clientes"] = menu_items(hm.get("clientTypeMenu"))
    out["global"] = menu_items(hm.get("globalMenu"))
    out["mega"] = menu_items(hm.get("mainMenu"), "menu_link_content--main-menu")

    # --- hero (el marco se conserva; los 3 campos se sustituyen) -------------
    sf = secs.get("paragraph--search_filters_module") or {}
    out["hero"] = {
        "gradiente": sf.get("field_background_color"),
        "titulo_original": sf.get("field_title"),
        "_imagen": primera_imagen(sf.get("field_image")),
        "migaja": r.get("field_title") or r.get("title"),
    }

    # --- Ciudadela Maipore --------------------------------------------------
    ban = (valor(secs.get("paragraph--main_banner_slider"), "field_item") or [{}])[0]
    valores = []
    for v in ban.get("field_text_with_value") or []:
        if isinstance(v, dict) and v.get("field_value"):
            # El CMS escribe el area como '34,94 m<sup>2</sup>'. Se normaliza al
            # caracter para que templates.js pueda escapar TODO sin excepciones
            # (las tarjetas de proyecto ya usan 'm²' literal).
            crudo = re.sub(r"<sup>\s*2\s*</sup>", "²", str(v["field_value"]))
            valores.append({"etiqueta": v.get("field_text_value"), "valor": texto_plano(crudo)})
    out["maipore"] = {
        "gradiente": ban.get("field_background_color"),
        "titulo": ban.get("field_title"),
        "texto": texto_plano(valor(ban, "field_long_description", "value")),
        "valores": valores,
        "cta": enlace(ban.get("field_link")),
        "_imagen": primera_imagen(ban.get("field_image")),
    }

    # --- Proyectos propios (solo el encabezado; las tarjetas, en el pase B) --
    mc = secs.get("paragraph--module_cards_with_labels") or {}
    out["propios"] = {
        "titulo": mc.get("field_title"),
        "texto": texto_plano(mc.get("field_description")) or mc.get("field_description"),
        "cta": enlace(mc.get("field_link")),
        "tarjetas": [],
    }

    # --- Ciudades (idem) ----------------------------------------------------
    out["ciudades"] = {
        "titulo": valor(secs.get("paragraph--slider_type_d"), "field_title"),
        "items": [],
    }

    # --- Nuestros aliados ---------------------------------------------------
    al = secs.get("paragraph--allies_module") or {}
    out["aliados"] = {
        "titulo": al.get("field_title"),
        "texto": texto_plano(al.get("field_description")) or al.get("field_description"),
        "logos": [
            {"_imagen": primera_imagen(it.get("field_image")),
             "alt": (valor(it, "field_image", "thumbnail", "resourceIdObjMeta", "alt") or "")}
            for it in (al.get("field_item") or [])
        ],
    }

    # --- Mas opciones para ti -----------------------------------------------
    es = r.get("field_exit_streets") or {}
    tarjetas = []
    for it in es.get("field_item") or []:
        tarjetas.append({
            "titulo": it.get("field_title") or it.get("title"),
            "texto": texto_plano(valor(it, "field_description", "value")
                                 or it.get("field_description")
                                 or valor(it, "body", "value")),
            "cta": enlace(it.get("field_link")) or {"texto": "Conoce más", "url": None},
            "_imagen": primera_imagen(it),
        })
    out["opciones"] = {
        "titulo": es.get("field_title"),
        "texto": texto_plano(valor(es, "field_description", "value")) or es.get("field_description"),
        "tarjetas": tarjetas,
    }

    # --- pestana de encuesta ------------------------------------------------
    out["opinion"] = enlace(valor(secs.get("paragraph--survey_button"), "field_link"))

    # --- footer -------------------------------------------------------------
    # El footer es de PESTANAS (Acerca de nosotros | Trabaja con nosotros |
    # Legales | Accesos rapidos | Contactanos), no de columnas: la activa lleva
    # subrayado amarillo y solo ella muestra sus enlaces.
    fm = menus["footerMenus"]
    # "Contactanos" no es un menu suelto sino varios bloques; el unico que es
    # una lista de enlaces es `footerContact`, que alterna rotulo
    # ('En Bogotá:', con uri route:<nolink>) y numero (con uri tel:).
    contacto = [
        {"texto": it.get("title"),
         "url": (valor(it, "link", "uri") or "").replace("route:<nolink>", "") or None}
        for it in (valor(fm.get("footerContactUs"), "footerContact") or [])
        if isinstance(it, dict) and it.get("enabled") is not False
    ]
    out["footer"] = {
        "pestanas": [
            {"titulo": "Acerca de nosotros", "links": menu_items(fm.get("footerWeAreColsubsidio"))},
            {"titulo": "Trabaja con nosotros", "links": menu_items(fm.get("footerOurServices"))},
            {"titulo": "Legales", "links": menu_items(fm.get("footerLegal"))},
            {"titulo": "Accesos rápidos", "links": menu_items(fm.get("footerQuickAccess"))},
            {"titulo": "Contáctanos", "links": contacto},
        ],
        "redes": menu_items(fm.get("footerSocialNetworks")),
        "vigilancia": menu_items(fm.get("footerSuperSalud")),
        "copyright": texto_plano(valor(fm.get("copyright"), "body", "value")),
    }
    return out


# --------------------------------------------------------------------------
# Pase B: lo que el CMS resuelve en cliente
# --------------------------------------------------------------------------
JS_TARJETAS = r"""
() => {
  const T = (e) => (e ? e.textContent.trim().replace(/\s+/g, ' ') : null);
  const hojas = (r) => [...r.querySelectorAll('*')]
      .filter((e) => e.children.length === 0 && T(e)).map((e) => T(e));
  // La tarjeta es el ancestro del <a> que ya contiene la <img>: el enlace solo
  // envuelve el nombre, el precio y la foto son hermanos suyos.
  const tarjetaDe = (a) => { let n = a; for (let i = 0; i < 8 && n; i++) { if (n.querySelector('img')) return n; n = n.parentElement; } return null; };
  const out = { propios: [], ciudades: [] };

  const vistos = new Set();
  document.querySelectorAll('a[href*="/vivienda/proyectos/"]').forEach((a) => {
    const t = tarjetaDe(a); if (!t || vistos.has(t)) return; vistos.add(t);
    const im = t.querySelector('img');
    out.propios.push({ url: a.getAttribute('href'), nombre: T(a),
                       img: im && im.getAttribute('src'), alt: im && im.alt, textos: hojas(t) });
  });

  document.querySelectorAll('a[href*="ciudad="]').forEach((a) => {
    const t = tarjetaDe(a); if (!t) return;
    const im = t.querySelector('img'); const tag = t.querySelector('.tagBasicPink');
    if (im && tag) out.ciudades.push({ url: a.getAttribute('href'), img: im.getAttribute('src'),
                                       alt: im.alt, tag: T(tag), textos: hojas(t) });
  });
  return out;
}
"""


def render(js: str) -> dict | None:
    """Renderiza la pagina y evalua `js`. Devuelve None si no hay navegador."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  ! Playwright no esta instalado: se conservan las tarjetas anteriores.")
        return None
    try:
        with sync_playwright() as p:
            # Los navegadores propios de Playwright no estan bajados en esta
            # maquina; el Edge del sistema hace exactamente lo mismo aqui.
            nav = None
            for kw in ({"channel": "msedge"}, {}, {"channel": "chrome"}):
                try:
                    nav = p.chromium.launch(**kw)
                    break
                except Exception:
                    continue
            if nav is None:
                raise IOError("no hay navegador (probar: playwright install)")
            pg = nav.new_page(viewport={"width": 1440, "height": 1000})
            pg.goto(URL, wait_until="networkidle", timeout=120000)
            # Los carruseles cargan sus imagenes al entrar en pantalla.
            for _ in range(14):
                pg.mouse.wheel(0, 800)
                pg.wait_for_timeout(300)
            pg.wait_for_timeout(3000)
            d = pg.evaluate(js)
            nav.close()
            return d
    except Exception as e:
        print("  ! No se pudo renderizar (%s): se conservan las tarjetas anteriores." % e)
        return None


RE_PRECIO = re.compile(r"^\$[\d.]+$")
RE_AREA = re.compile(r"^[\d.,]+\s*m²$")


def leer_tarjeta_propio(t: dict) -> dict:
    """De la lista plana de textos de la tarjeta saca sus campos.

    El orden es estable ([etiqueta VIS?], nombre, ubicacion, 'Precio desde',
    precio, 'Área desde', area) pero la etiqueta VIS solo esta en algunas, asi
    que se identifica cada dato por su FORMA y no por su posicion.
    """
    txt = t.get("textos") or []
    nombre = t.get("nombre")
    precio = next((x for x in txt if RE_PRECIO.match(x)), None)
    area = next((x for x in txt if RE_AREA.match(x)), None)
    etiqueta = next((x for x in txt if "Subsidio" in x), None)
    ubic = None
    if nombre in txt:
        i = txt.index(nombre)
        if i + 1 < len(txt) and " - " in txt[i + 1]:
            ubic = txt[i + 1]
    return {"nombre": nombre, "ubicacion": ubic, "precio": precio, "area": area,
            "etiqueta": etiqueta, "url": t.get("url"), "alt": t.get("alt"),
            "_imagen": t.get("img")}


def leer_tarjeta_ciudad(c: dict) -> dict:
    txt = c.get("textos") or []
    tag = c.get("tag")
    nombre = next((x for x in reversed(txt) if x != tag), None)
    return {"nombre": nombre, "proyectos": tag, "url": c.get("url"),
            "alt": c.get("alt"), "_imagen": c.get("img")}


# --------------------------------------------------------------------------
# Emision del JS
# --------------------------------------------------------------------------
def js_valor(v) -> str:
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
    if re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$]*", str(k)):
        return str(k)
    return "'" + str(k).replace("\\", "\\\\").replace("'", "\\'") + "'"


def bajar_todas(d: dict) -> int:
    """Recorre el arbol cambiando cada `_imagen`/`_icono` por su ruta local.
    El prefijo sale de la rama, para que assets/portada/ se lea de un vistazo."""
    n = 0

    def paso(nodo, prefijo):
        nonlocal n
        if isinstance(nodo, list):
            for x in nodo:
                paso(x, prefijo)
        elif isinstance(nodo, dict):
            for campo in ("_imagen", "_icono"):
                if campo in nodo:
                    rel = guardar_imagen(nodo.pop(campo), prefijo)
                    if rel:
                        nodo["imagen"] = rel
                        n += 1
            for k, v in list(nodo.items()):
                paso(v, prefijo)

    # El logo es una cadena suelta, no un nodo con `_imagen`.
    if isinstance(d.get("logo"), str):
        d["logo"] = guardar_imagen(d["logo"], "logo")
        if d["logo"]:
            n += 1

    for rama, prefijo in (("hero", "hero"), ("maipore", "maipore"), ("propios", "proyecto"),
                          ("ciudades", "ciudad"), ("aliados", "aliado"),
                          ("opciones", "opcion"), ("footer", "icono"),
                          ("global", "icono"), ("mega", "icono"), ("clientes", "icono")):
        paso(d.get(rama), prefijo)
    return n


def escribir_js(d: dict, ruta: str) -> None:
    import datetime

    lineas = [
        "// ARCHIVO GENERADO — no editar a mano.",
        "// Lo produce tools/clonar_portada.py desde la pagina real:",
        "//   %s" % URL,
        "//",
        "//   Generado: %s" % datetime.date.today().isoformat(),
        "//   Proyectos propios: %d   Ciudades: %d   Aliados: %d" % (
            len(d["propios"]["tarjetas"]), len(d["ciudades"]["items"]), len(d["aliados"]["logos"])),
        "//   Imagenes en assets/portada/: %d" % len([v for v in _CACHE_IMG.values() if v]),
        "//",
        "// Son los textos, menus, degradados e imagenes EXACTOS de la portada de",
        "// Colsubsidio. js/templates.js los pinta en portada(); el aspecto vive en",
        "// css/styles.css (.gdf-portada-*), escrito con los estilos computados que",
        "// mide `python tools/clonar_portada.py --medir`.",
        "//",
        "// La UNICA franja que no sale de aqui es el hero: el buscador original",
        "// (3 desplegables + Buscar + aviso) se sustituye por la entrada a la Grua",
        "// del Futuro. De `hero` solo se usan el degradado y la imagen, que son el",
        "// marco que se conserva.",
        "",
        "window.GDF_PORTADA = %s;" % js_valor(d),
        "",
    ]
    with io.open(ruta, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lineas))


# --------------------------------------------------------------------------
def main() -> int:
    ap = argparse.ArgumentParser(description="Clona la portada de vivienda de Colsubsidio.")
    ap.add_argument("--medir", action="store_true",
                    help="ademas, vuelca los estilos computados de la pagina real a "
                         "tools/.estilos_portada.json (insumo del CSS, no lo consume la app)")
    args = ap.parse_args()

    os.makedirs(DIR_IMG, exist_ok=True)

    print("1) Bajando %s ..." % URL)
    d = extraer(bajar(URL))
    print("   menus: %d clientes, %d globales, %d categorias" % (
        len(d["clientes"]), len(d["global"]), len(d["mega"])))

    print("2) Renderizando para las dos franjas que el CMS resuelve en cliente...")
    dom = render(JS_TARJETAS)
    if dom:
        d["propios"]["tarjetas"] = [leer_tarjeta_propio(t) for t in dom.get("propios") or []]
        d["ciudades"]["items"] = [leer_tarjeta_ciudad(c) for c in dom.get("ciudades") or []]
        print("   %d proyectos propios, %d ciudades" % (
            len(d["propios"]["tarjetas"]), len(d["ciudades"]["items"])))
    else:
        anterior = leer_anterior()
        d["propios"]["tarjetas"] = valor(anterior, "propios", "tarjetas") or []
        d["ciudades"]["items"] = valor(anterior, "ciudades", "items") or []
        print("   conservadas del archivo anterior: %d / %d" % (
            len(d["propios"]["tarjetas"]), len(d["ciudades"]["items"])))

    print("3) Descargando imagenes a %s ..." % REL_IMG)
    n = bajar_todas(d)
    print("   %d imagenes referenciadas" % n)

    escribir_js(d, SALIDA_JS)
    print("4) Escrito %s (%.1f KB)" % (SALIDA_JS, os.path.getsize(SALIDA_JS) / 1024.0))

    if args.medir:
        medir()
    return 0


def leer_anterior() -> dict:
    """El js/portada.js anterior, para no perder datos si el pase B falla."""
    try:
        with io.open(SALIDA_JS, encoding="utf-8") as fh:
            txt = fh.read()
        cuerpo = txt.split("window.GDF_PORTADA =", 1)[1].rsplit(";", 1)[0]
        # De literal JS a JSON: comillas simples -> dobles, claves sin comillas.
        cuerpo = re.sub(r"([{,]\s*)([A-Za-z_$][A-Za-z0-9_$]*)\s*:", r'\1"\2":', cuerpo)
        cuerpo = re.sub(r"'((?:[^'\\]|\\.)*)'", lambda m: json.dumps(m.group(1).replace("\\'", "'")), cuerpo)
        return json.loads(cuerpo)
    except Exception:
        return {}


JS_MEDIR = r"""
() => {
  const P = ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','color',
             'backgroundColor','backgroundImage','padding','margin','borderRadius','border',
             'boxShadow','height','width','gap','objectFit','maxWidth'];
  const cs = (el) => { if (!el) return null; const c = getComputedStyle(el); const o = {};
      P.forEach((p) => { if (c[p] && c[p] !== 'none' && c[p] !== 'normal' && c[p] !== '0px') o[p] = c[p]; });
      const r = el.getBoundingClientRect(); o._box = [Math.round(r.x), Math.round(r.width), Math.round(r.height)]; return o; };
  const T = (e) => (e ? e.textContent.trim().replace(/\s+/g, ' ') : null);
  const t = (s, sel) => [...document.querySelectorAll(sel || '*')].find((e) => T(e) === s);
  const o = {};
  o.body = cs(document.body);
  o.personas = cs(t('Personas', 'a,li,span,button'));
  o.nav_link = cs(t('Te ayudamos', 'a,span'));
  o.mega_item = cs(t('Salud', 'a,span,button'));
  o.mega_bar = cs(t('Salud', 'a,span,button')?.closest('nav,ul,div'));
  o.h1 = cs(document.querySelector('h1'));
  o.hero = cs(document.querySelector('h1')?.closest('section'));
  o.h2_grande = cs([...document.querySelectorAll('h2')].find((e) => /Ciudades/.test(T(e))));
  o.tag_pink = cs(document.querySelector('.tagBasicPink'));
  o.card_img = cs(document.querySelector('a[href*="/vivienda/proyectos/"]')?.closest('div')?.querySelector('img'));
  o.btn_negro = cs([...document.querySelectorAll('a,button')].find((e) => /Encuentra tu nuevo hogar/.test(T(e))));
  o.footer = cs(document.querySelector('footer'));
  return o;
}
"""


def medir() -> None:
    print("5) Midiendo estilos computados...")
    d = render(JS_MEDIR)
    if not d:
        return
    ruta = os.path.join(AQUI, ".estilos_portada.json")
    with io.open(ruta, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(d, ensure_ascii=False, indent=1))
    print("   -> %s" % ruta)


if __name__ == "__main__":
    sys.exit(main())
