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


def send_image(phone: str, image_url: str, caption: str = "") -> bool:
    """
    Envía una imagen por WhatsApp.
    
    Args:
        phone: Número de teléfono destino
        image_url: URL pública de la imagen
        caption: Texto opcional debajo de la imagen
    
    Returns:
        True si se envió correctamente
    """
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
        "type": "image",
        "image": {
            "link": image_url
        }
    }
    
    if caption:
        data["image"]["caption"] = caption
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=15)
        response.raise_for_status()
        logger.info(f"🖼️ Imagen enviada a {phone}")
        return True
    except requests.exceptions.RequestException as e:
        error_msg = f"❌ Error enviando imagen: {e}"
        if e.response is not None:
             error_msg += f" | Detalle: {e.response.text}"
        logger.error(error_msg)
        return False
    except Exception as e:
        logger.error(f"❌ Error inesperado enviando imagen: {e}")
        return False


def send_document(phone: str, document_url: str, filename: str, caption: str = "") -> bool:
    """
    Envía un documento (PDF) por WhatsApp.
    
    Args:
        phone: Número de teléfono destino
        document_url: URL pública del documento
        filename: Nombre del archivo a mostrar
        caption: Texto opcional
    
    Returns:
        True si se envió correctamente
    """
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
        "type": "document",
        "document": {
            "link": document_url,
            "filename": filename
        }
    }
    
    if caption:
        data["document"]["caption"] = caption
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=15)
        response.raise_for_status()
        logger.info(f"📄 Documento enviado a {phone}: {filename}")
        return True
    except requests.exceptions.RequestException as e:
        error_msg = f"❌ Error enviando documento: {e}"
        if e.response is not None:
             error_msg += f" | Detalle: {e.response.text}"
        logger.error(error_msg)
        return False
    except Exception as e:
        logger.error(f"❌ Error inesperado enviando documento: {e}")
        return False
