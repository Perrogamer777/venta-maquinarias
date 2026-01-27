"""
Configuración centralizada de la aplicación.
"""
import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    """Configuración de la aplicación"""
    
    # Google Cloud
    GCP_PROJECT_ID: str = os.getenv("GCP_PROJECT_ID", "venta-maquinarias-2627e")
    GCP_LOCATION: str = os.getenv("GCP_LOCATION", "us-central1")
    
    # WhatsApp/Meta
    META_TOKEN: str = os.getenv("META_TOKEN", "")
    PHONE_NUMBER_ID: str = os.getenv("PHONE_NUMBER_ID", "")
    VERIFY_TOKEN: str = os.getenv("VERIFY_TOKEN", "maquinarias123")
    
    # Gemini
    MODEL_NAME: str = os.getenv("MODEL_NAME", "gemini-2.0-flash-exp")


settings = Settings()
