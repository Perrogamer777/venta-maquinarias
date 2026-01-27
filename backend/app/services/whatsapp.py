"""
Servicio de WhatsApp para envío de mensajes.
"""
import logging
import requests
from app.core.config import settings

logger = logging.getLogger(__name__)


def send_message(phone: str, message: str) -> bool:
    """Envía un mensaje de WhatsApp"""
    if not settings.META_TOKEN or not settings.PHONE_NUMBER_ID:
        logger.warning("⚠️ META_TOKEN o PHONE_NUMBER_ID no configurados")
        return False
    
    url = f"https://graph.facebook.com/v18.0/{settings.PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.META_TOKEN}",
        "Content-Type": "application/json"
    }
    data = {
        "messaging_product": "whatsapp",
        "to": phone,
        "text": {"body": message}
    }
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=10)
        response.raise_for_status()
        logger.info(f"✅ Mensaje enviado a {phone}")
        return True
    except requests.exceptions.RequestException as e:
        error_msg = f"❌ Error enviando mensaje: {e}"
        if e.response is not None:
             error_msg += f" | Detalle: {e.response.text}"
        logger.error(error_msg)
        return False
    except Exception as e:
        logger.error(f"❌ Error inesperado enviando mensaje: {e}")
        return False
