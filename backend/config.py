"""
Configuración del backend por variables de entorno.

Pieza del sistema: BACKEND.

Carga `.env` (en la raíz del repo) si `python-dotenv` está disponible, y expone
los secretos/URLs. NUNCA hardcodear secretos en el código: la URL del flow de
Dapta trae un x-api-key y por eso vive solo en `.env` (gitignored).
"""

from __future__ import annotations

import os

try:  # carga .env si existe; opcional (no rompe si falta la dependencia)
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:  # pragma: no cover
    pass


# URL del webhook de entrada del flow `colsubsidio-vivienda-perfilamiento-lead`
# (Nodo 1). Incluye el x-api-key como query param. La da Dapti.
DAPTA_FLOW_STUDIO_WEBHOOK_URL: str | None = os.environ.get(
    "DAPTA_FLOW_STUDIO_WEBHOOK_URL"
)

# Si es true, `POST /leads` dispara la llamada REAL de Dapta. Por defecto false
# para no gastar créditos ni llamar números de prueba, y porque el From Number
# de Dapta aún no está configurado. Ponlo en "true" en Render cuando esté listo.
DAPTA_LLAMADAS_ACTIVAS: bool = os.environ.get(
    "DAPTA_LLAMADAS_ACTIVAS", "false"
).strip().lower() in {"1", "true", "yes", "si", "sí"}

# Secreto compartido para verificar el webhook de resultado ENTRANTE de Dapta.
# Si está definido, /webhooks/dapta/resultado exige el header X-Dapta-Secret.
DAPTA_WEBHOOK_SECRET: str | None = os.environ.get("DAPTA_WEBHOOK_SECRET")

# --- Seguimiento por WhatsApp (agente de texto "Manuela — Seguimiento WhatsApp") --
# GATED: por defecto APAGADO. Cuando la persona no contesta la llamada, si esto
# está activo Y configurado, el backend dispara el seguimiento por WhatsApp.
# Requiere una línea de WhatsApp Business conectada en Dapta (flujo Meta) — hasta
# entonces queda en no-op y no afecta nada de lo que ya funciona.
DAPTA_WHATSAPP_ACTIVO: bool = os.environ.get(
    "DAPTA_WHATSAPP_ACTIVO", "false"
).strip().lower() in {"1", "true", "yes", "si", "sí"}
# URL del endpoint de Dapta para iniciar la conversación de WhatsApp del agente.
DAPTA_WHATSAPP_URL: str | None = os.environ.get("DAPTA_WHATSAPP_URL")
# x-api-key del endpoint (si aplica).
DAPTA_WHATSAPP_API_KEY: str | None = os.environ.get("DAPTA_WHATSAPP_API_KEY")
# Secret key del agente de texto (se obtiene al conectar la línea de WhatsApp).
DAPTA_WHATSAPP_AGENT_KEY: str | None = os.environ.get("DAPTA_WHATSAPP_AGENT_KEY")

# Origen permitido para CORS (el frontend). TODO(seguridad): aplicarlo.
FRONTEND_ORIGIN: str = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")

# Supabase: el backend escribe el resultado de Dapta en la tabla de leads para
# que el dashboard lo muestre en vivo (Realtime). Reusa el proyecto COLSUBSIDIO-leads.
SUPABASE_URL: str | None = os.environ.get("SUPABASE_URL")
# Key con permiso de escritura. En el hackathon vale la publishable (RLS permisiva);
# en producción usar service_role y cerrar RLS.
SUPABASE_KEY: str | None = os.environ.get("SUPABASE_KEY")
