"""
Servicio de Firebase para almacenamiento de conversaciones.
"""
import logging
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore

logger = logging.getLogger(__name__)

from app.core.config import settings

# Inicializar Firebase (solo una vez)
if not firebase_admin._apps:
    # Forzar el uso del proyecto configurado 'venta-maquinarias-2627e'
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {
        'projectId': settings.GCP_PROJECT_ID,
    })

# Obtener cliente (usa la app inicializada arriba por defecto)
db = firestore.client()


def save_message(phone: str, role: str, content: str) -> None:
    """Guarda un mensaje en Firestore"""
    try:
        db.collection("chats").document(phone).collection("messages").add({
            "role": role,
            "content": content,
            "timestamp": datetime.now()
        })
        logger.info(f"💾 Mensaje guardado: {phone} - {role}")
    except Exception as e:
        logger.error(f"Error guardando mensaje: {e}")


def get_chat_history(phone: str, limit: int = 10) -> list:
    """Obtiene el historial del chat"""
    try:
        messages = []
        docs = (
            db.collection("chats")
            .document(phone)
            .collection("messages")
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )
        
        for doc in docs:
            data = doc.to_dict()
            messages.append({
                "role": data.get("role"),
                "content": data.get("content")
            })
        
        return list(reversed(messages))
    except Exception as e:
        logger.error(f"Error obteniendo historial: {e}")
        return []
