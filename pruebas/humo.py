#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Prueba de humo del pipeline completo, SIN red.

    python pruebas/humo.py

POR QUE EXISTE
--------------
Los fallos que nos han costado tiempo no fueron caidas ruidosas: fueron datos
que se degradaban en silencio y aparecian tres capas mas abajo. El telefono que
se guardaba como +575723456789, la calificacion que se perdia al aplanar el
webhook, las amenidades vacias que daban 0 de 50 puntos a todo el catalogo.

Este script recorre el pipeline con casos limite y falla RUIDOSAMENTE. No
sustituye probar contra produccion; sirve para no llegar alli con lo obvio roto.
"""

from __future__ import annotations

import asyncio
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(RAIZ))

fallos: list[str] = []


def check(nombre: str, condicion: bool, detalle: str = "") -> None:
    print(f"  {'ok  ' if condicion else 'FALLA'} {nombre}" + (f"  → {detalle}" if not condicion and detalle else ""))
    if not condicion:
        fallos.append(nombre)


def seccion(titulo: str) -> None:
    print(f"\n── {titulo} " + "─" * max(0, 58 - len(titulo)))


# --------------------------------------------------------------------------- #
def probar_telefonos() -> None:
    seccion("Telefonos")
    from backend.integrations.dapta_client import normalizar_telefono_e164 as n

    validos = ["3125923915", "312 592 3915", "+57 312-592-3915", "57 3125923915",
               "(312) 592 3915", "+573125923915", "0057 3125923915"]
    for v in validos:
        check(f"acepta {v!r}", n(v) == "+573125923915", f"dio {n(v)}")

    # El bug que produjo +575723456789: numero incompleto que "parecia" valido.
    invalidos = ["+57 23456789", "+57 2345678", "+57 34567890", "2345678",
                 "6012345678", "", None, "abc", "31259239150", "312592391"]
    for v in invalidos:
        check(f"rechaza {v!r}", n(v) is None, f"dio {n(v)}")


def probar_schema() -> None:
    seccion("SenalBowl (la puerta del formulario)")
    from backend.models.schemas import SenalBowl

    base = dict(tipo_vivienda="vis", nombre="X", apellido="Y", correo="a@b.c",
                afiliado=True, ingresos_hogar_rango="Hasta $2.800.000",
                edad=34, personas_a_cargo=2, zona_interes="Bosa")

    def intenta(**extra) -> bool:
        try:
            SenalBowl(**{**base, **extra})
            return True
        except Exception:
            return False

    check("acepta movil valido", intenta(telefono_movil="3125923915"))
    check("rechaza movil incompleto", not intenta(telefono_movil="+57 23456789"))
    check("rechaza fijo", not intenta(telefono_movil="6012345678"))
    check("habitaciones es opcional", intenta(telefono_movil="3125923915", numero_habitaciones=None))
    check("personas_a_cargo 0 se acepta", intenta(telefono_movil="3125923915", personas_a_cargo=0))


def probar_webhook() -> None:
    seccion("Webhook post-call")
    from backend.models.schemas import ResultadoCalificacionDapta as R

    plano = R.desde_webhook({
        "call_id": "a", "call_status": "ended", "calificacion_lead": "caliente",
        "resumen_llamada": "Acepto visita", "disponible_visita": True,
        "modalidad_agendada": "presencial", "fecha_hora_agendada": "2026-08-25 10:00",
    })
    check("forma plana conserva la calificacion", plano.calificacion_lead == "caliente")
    check("forma plana conserva el resumen", plano.resumen_llamada == "Acepto visita")
    check("forma plana conserva la cita", plano.fecha_hora_agendada == "2026-08-25 10:00")

    nativo = R.desde_webhook({"call": {
        "call_id": "b", "call_status": "ended", "to_number": "+573125923915",
        "call_analysis": {"call_summary": "generico", "custom_analysis_data": {
            "calificacion_lead": "tibio", "disponible_visita": True,
            "fecha_hora_agendada": False, "ahorros_cesantias_declarado": False}}}})
    check("forma nativa lee la extraccion", nativo.calificacion_lead == "tibio")
    check("false en campo de texto -> None", nativo.fecha_hora_agendada is None)
    check("bool real se conserva", nativo.disponible_visita is True)

    vacio = R.desde_webhook({"call": {"call_id": "c", "call_status": "ended",
        "disconnection_reason": "dial_no_answer",
        "call_analysis": {"custom_analysis_data": {"calificacion_lead": ""}}}})
    check("no contesta: calificacion vacia -> None", vacio.calificacion_lead is None)

    try:
        R.desde_webhook({"hola": "mundo"})
        check("cuerpo irreconocible se rechaza", False, "lo acepto")
    except Exception:
        check("cuerpo irreconocible se rechaza", True)


def probar_modelo() -> None:
    seccion("Modelo de recomendaciones")
    from backend.integrations import recomendaciones_client as rc
    from backend.models.schemas import SenalBowl

    base = dict(tipo_vivienda="vis", nombre="X", apellido="Y", correo="a@b.c",
                telefono_movil="3125923915", afiliado=True, edad=34,
                personas_a_cargo=2, zona_interes="Bosa")

    bandas = {"Hasta $2.800.000": 1, "$2.800.000 – $5.700.000": 2,
              "$5.700.000 – $11.400.000": 3, "Más de $11.400.000": 4}
    for etiqueta, esperado in bandas.items():
        s = SenalBowl(**base, ingresos_hogar_rango=etiqueta)
        check(f"banda {etiqueta}", rc._banda_salario(s) == esperado)

    s = SenalBowl(**base, ingresos_hogar_rango="$2.800.000 – $5.700.000", numero_habitaciones=3)
    r = asyncio.run(rc.recomendar(s, top=6))
    recs = r["recomendaciones"]
    check("devuelve 6 recomendaciones", len(recs) == 6, f"dio {len(recs)}")
    check("orden descendente por match", all(recs[i]["match_score"] >= recs[i+1]["match_score"] for i in range(len(recs)-1)))
    check("desglose suma el match", all(abs(sum(x["match_desglose"].values()) - x["match_score"]) < 0.6 for x in recs))
    check("determinista", [x["match_score"] for x in asyncio.run(rc.recomendar(s, top=6))["recomendaciones"]] == [x["match_score"] for x in recs])

    zona_mala = SenalBowl(**{**base, "zona_interes": "Marte"}, ingresos_hogar_rango="Hasta $2.800.000")
    rz = asyncio.run(rc.recomendar(zona_mala))
    check("zona desconocida no revienta", rz["recomendaciones"] == [] and rz["sin_recomendaciones_motivo"])


def probar_catalogo() -> None:
    seccion("Catalogo en las tres capas")
    front = json.loads((RAIZ / "frontend/data/proyectos_seed.json").read_text(encoding="utf-8"))
    back = json.loads((RAIZ / "backend/data/proyectos_seed.json").read_text(encoding="utf-8"))
    motor = json.loads((RAIZ / "modelo_recomendaciones/motor/proyectos_model.json").read_text(encoding="utf-8"))
    if isinstance(motor, dict):
        motor = motor.get("proyectos") or list(motor.values())[0]

    ids = [{p["id_proyecto"] for p in x} for x in (front, back, motor)]
    check("mismo numero de proyectos", len(front) == len(back) == len(motor), f"{len(front)}/{len(back)}/{len(motor)}")
    check("mismos ids", ids[0] == ids[1] == ids[2])
    check("backend con amenidades", all(p.get("amenidades_entorno") for p in back))
    check("motor con amenidades", all(p.get("zonas_comunes") for p in motor))
    check("todos con precio", all(p.get("precio_desde_cop") for p in back))


def probar_prompts() -> None:
    seccion("Prompts de Dapta")
    validas = {"current_time", "contact_name", "edad", "tipo_vivienda", "rango_ingreso",
               "zona_interes", "entorno_deseado", "personas_a_cargo", "piso_preferido",
               "tipo_inmueble", "urgencia", "proyecto_recomendado",
               "cuota_estimada_mensual", "valor_estimado_vivienda", "subsidio_estimado"}
    for archivo in ("voz-afiliados.txt", "voz-no-afiliados.txt"):
        ruta = RAIZ / "dapta/build" / archivo
        texto = ruta.read_text(encoding="utf-8")
        usadas = set(re.findall(r"\{\{(\w+)\}\}", texto))
        check(f"{archivo}: sin variables huerfanas", not (usadas - validas), str(usadas - validas))
        for campo in ("calificacion_lead", "resumen_llamada", "justificacion_calificacion",
                      "disponible_visita", "fecha_hora_agendada", "modalidad_agendada"):
            check(f"{archivo}: contrato incluye {campo}", campo in texto)
        check(f"{archivo}: menciona end_call", "end_call" in texto)


def probar_payload_dapta() -> None:
    seccion("Payload hacia el flow")
    from backend import config
    from backend.integrations import dapta_client
    from backend.models.schemas import ResultadoClustering, SenalBowl

    config.DAPTA_FLOW_WEBHOOK_AFILIADO = None
    config.DAPTA_FLOW_WEBHOOK_NO_AFILIADO = None
    s = SenalBowl(tipo_vivienda="vis", nombre="Juan", apellido="Lopez", correo="a@b.c",
                  telefono_movil="3125923915", afiliado=True,
                  ingresos_hogar_rango="$2.800.000 – $5.700.000", edad=34,
                  personas_a_cargo=2, zona_interes="Bosa", numero_habitaciones=3)
    rec = ResultadoClustering(cluster_id="c1", proyectos_recomendados=["Florecer"])
    r = asyncio.run(dapta_client.disparar_llamada(s, rec, urgencia="alta",
        cuota_estimada_mensual=1700000, valor_estimado_vivienda=207580000,
        subsidio_estimado=42000000, external_lead_id="x"))
    pl = r["payload_enviado"]

    prompt = (RAIZ / "dapta/build/voz-afiliados.txt").read_text(encoding="utf-8")
    usadas = set(re.findall(r"\{\{(\w+)\}\}", prompt))
    alias = {"contact_name": "nombre"}
    faltan = [v for v in sorted(usadas) if alias.get(v, v) not in pl]
    check("toda variable del prompt tiene origen", not faltan, str(faltan))
    check("telefono normalizado a E.164", pl["telefono"] == "+573125923915")
    check("current_time en hora de Bogota", bool(re.match(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}", pl["current_time"] or "")))


def main() -> int:
    print("Prueba de humo — pipeline Reto Vivienda\n")
    for f in (probar_telefonos, probar_schema, probar_webhook, probar_modelo,
              probar_catalogo, probar_prompts, probar_payload_dapta):
        try:
            f()
        except Exception as e:  # noqa: BLE001
            print(f"  FALLA {f.__name__} reviento: {type(e).__name__}: {e}")
            fallos.append(f.__name__)

    print("\n" + "═" * 62)
    if fallos:
        print(f"{len(fallos)} FALLOS:")
        for x in fallos:
            print("  -", x)
        return 1
    print("Sin fallos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
