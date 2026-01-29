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


def save_message_firestore(phone: str, role: str, content: str, msg_type: str = "text", media_url: str = None) -> None:
    """Guarda un mensaje en Firestore"""
    try:
        now = datetime.now()
        
        # IMPORTANTE: Crear/actualizar el documento del chat PRIMERO
        chat_ref = db.collection("chats").document(phone)
        chat_ref.set({
            "last_interaction": now,
            "phone": phone,
            "agentePausado": False,
            "unread": role == "user"
        }, merge=True)
        
        # Datos del mensaje
        msg_data = {
            "role": role,
            "content": content or "",
            "timestamp": now.isoformat(),
            "type": msg_type
        }
        
        if media_url:
            msg_data["media_url"] = media_url
            msg_data["image_url"] = media_url # Retrocompatibilidad frontend
            
        # Structure for Vertex AI (text only)
        if content:
            msg_data["parts"] = [{"text": content}]
        
        # Ahora guardar el mensaje en la subcolección
        chat_ref.collection("messages").add(msg_data)
        
        logger.info(f"💾 Mensaje guardado: {phone} - {role} ({msg_type})")
    except Exception as e:
        logger.error(f"Error guardando mensaje: {e}")


def get_chat_history_firestore(phone: str, limit: int = 50) -> list:
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
            content = data.get("content")
            
            # Fallback para mensajes antiguos guardados solo en parts
            if not content and data.get("parts"):
                try:
                    content = data["parts"][0]["text"]
                except (IndexError, KeyError):
                    content = ""
            
            messages.append({
                "role": data.get("role"),
                "content": content
            })
        
        return list(reversed(messages))
    except Exception as e:
        logger.error(f"Error obteniendo historial: {e}")
        return []


def schedule_meeting(phone: str, client_email: str, meeting_time: str, meeting_type: str = "videollamada") -> bool:
    """
    Agenda una reunión con una persona real.
    
    Args:
        phone: Teléfono del cliente (WhatsApp)
        client_email: Email del cliente
        meeting_time: Horario preferido para la reunión (ej: "mañana 3pm", "viernes 10am")
        meeting_type: Tipo de reunión ("videollamada" o "llamada telefónica")
    """
    try:
        from datetime import datetime
        
        meeting_ref = db.collection("meetings").document()
        
        meeting_data = {
            "phone": phone,
            "email": client_email,
            "preferred_time": meeting_time,
            "type": meeting_type,
            "status": "pendiente",  # pendiente, confirmada, completada, cancelada
            "created_at": datetime.utcnow(),
            "notes": ""
        }
        
        meeting_ref.set(meeting_data)
        
        logger.info(f"📅 Reunión agendada: {phone} - {meeting_time} ({meeting_type})")
        return True
        
    except Exception as e:
        logger.error(f"Error agendando reunión: {e}")
        return False
