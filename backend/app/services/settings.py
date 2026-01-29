import logging
from app.services.firebase import db

logger = logging.getLogger(__name__)

DEFAULT_SETTINGS = {
    "maxDiscount": 10,
    "enableReminders": False,
    "reminderTimeMinutes": 30,
    "reminderMessage": "¿Sigues interesado en esta maquinaria? Si tienes dudas, estoy aquí para ayudarte. 🚜"
}

def get_bot_settings() -> dict:
    """Obtiene la configuración del bot desde Firestore."""
    try:
        doc_ref = db.collection("config").document("bot_settings")
        doc = doc_ref.get()
        
        if doc.exists:
            data = doc.to_dict()
            # Merge with defaults to ensure all keys exist
            return {**DEFAULT_SETTINGS, **data}
            
        return DEFAULT_SETTINGS
    except Exception as e:
        logger.error(f"Error reading bot settings: {e}")
        return DEFAULT_SETTINGS
