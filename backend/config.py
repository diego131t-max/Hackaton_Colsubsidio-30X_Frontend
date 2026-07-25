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

# Secreto compartido para verificar el webhook de resultado ENTRANTE de Dapta.
# TODO(seguridad): usarlo en /webhooks/dapta/resultado (HMAC o header).
DAPTA_WEBHOOK_SECRET: str | None = os.environ.get("DAPTA_WEBHOOK_SECRET")

# Origen permitido para CORS (el frontend). TODO(seguridad): aplicarlo.
FRONTEND_ORIGIN: str = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5173")
