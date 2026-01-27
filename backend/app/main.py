"""
Aplicación principal FastAPI.
"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.webhook import router as webhook_router

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

# Crear aplicación
app = FastAPI(
    title="MACI WhatsApp Agent",
    description="Agente de ventas de maquinaria agrícola",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir rutas
app.include_router(webhook_router, tags=["webhook"])


@app.get("/")
def health_check():
    """Health check"""
    return {
        "status": "MACI WhatsApp Agent 🚜",
        "version": "1.0.0"
    }


@app.get("/health")
def health():
    """Health endpoint para Cloud Run"""
    return {"status": "healthy"}
