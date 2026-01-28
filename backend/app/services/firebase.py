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
        now = datetime.now()
        
        # IMPORTANTE: Crear/actualizar el documento del chat PRIMERO
        # Sin esto, el documento padre no existe y no aparece en consultas
        chat_ref = db.collection("chats").document(phone)
        chat_ref.set({
            "last_interaction": now,
            "phone": phone,
            "agentePausado": False,
            "unread": role == "user"  # Marcar como no leído si es mensaje del usuario
        }, merge=True)
        
        # Ahora guardar el mensaje en la subcolección
        chat_ref.collection("messages").add({
            "role": role,
            "parts": [{"text": content}],
            "timestamp": now.isoformat()
        })
        
        logger.info(f"💾 Mensaje guardado: {phone} - {role}")
    except Exception as e:
        logger.error(f"Error guardando mensaje: {e}")


def get_chat_history(phone: str, limit: int = 50) -> list:
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
