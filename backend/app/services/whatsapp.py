"""
Servicio de WhatsApp para envío y recepción de mensajes/medios.
"""
import logging
import requests
from app.core.config import settings

logger = logging.getLogger(__name__)

# Límite de caracteres de WhatsApp
MAX_CHARS = 4000

def split_message(message: str, max_length: int = MAX_CHARS) -> list:
    """Divide un mensaje largo en chunks respetando saltos de línea"""
    if len(message) <= max_length:
        return [message]
    
    chunks = []
    lines = message.split('\n')
    current_chunk = ""
    
    for line in lines:
        if len(current_chunk) + len(line) + 1 > max_length:
            if current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = line + '\n'
            else:
                chunks.append(line[:max_length])
                current_chunk = line[max_length:] + '\n'
        else:
            current_chunk += line + '\n'
    
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    
    return chunks


def send_message(phone: str, message: str) -> bool:
    """Envía un mensaje de texto"""
    if not settings.META_TOKEN or not settings.PHONE_NUMBER_ID:
        logger.warning("⚠️ META_TOKEN o PHONE_NUMBER_ID no configurados")
        return False
    
    chunks = split_message(message)
    url = f"https://graph.facebook.com/v18.0/{settings.PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.META_TOKEN}",
        "Content-Type": "application/json"
    }
    
    for chunk in chunks:
        data = {
            "messaging_product": "whatsapp",
            "to": phone,
            "text": {"body": chunk}
        }
        try:
            requests.post(url, headers=headers, json=data, timeout=10).raise_for_status()
        except Exception as e:
            logger.error(f"❌ Error enviando mensaje: {e}")
            return False
    return True


def send_image(phone: str, image_url: str, caption: str = "") -> bool:
    """Envía una imagen"""
    if not settings.META_TOKEN or not settings.PHONE_NUMBER_ID:
        logger.warning("⚠️ META_TOKEN o PHONE_NUMBER_ID no configurados para imagen")
        return False
    
    url = f"https://graph.facebook.com/v18.0/{settings.PHONE_NUMBER_ID}/messages"
    headers = {"Authorization": f"Bearer {settings.META_TOKEN}", "Content-Type": "application/json"}
    
    data = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "image",
        "image": {"link": image_url}
    }
    if caption: data["image"]["caption"] = caption[:1024]
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=15)
        response.raise_for_status()
        logger.info(f"✅ Imagen enviada exitosamente a {phone}")
        return True
    except requests.exceptions.HTTPError as e:
        # Log detallado del error de la API de WhatsApp
        try:
            error_detail = e.response.json()
            logger.error(f"❌ Error API WhatsApp enviando imagen: {error_detail}")
        except:
            logger.error(f"❌ Error HTTP enviando imagen: {e}")
        return False
    except Exception as e:
        logger.error(f"❌ Error enviando imagen: {e}")
        return False


def send_document(phone: str, document_url: str, filename: str = "", caption: str = "") -> bool:
    """Envía un documento"""
    if not settings.META_TOKEN or not settings.PHONE_NUMBER_ID:
        return False
    
    url = f"https://graph.facebook.com/v18.0/{settings.PHONE_NUMBER_ID}/messages"
    headers = {"Authorization": f"Bearer {settings.META_TOKEN}", "Content-Type": "application/json"}
    
    data = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "document",
        "document": {"link": document_url}
    }
    if filename: data["document"]["filename"] = filename
    if caption: data["document"]["caption"] = caption[:1024]
    
    try:
        requests.post(url, headers=headers, json=data, timeout=10).raise_for_status()
        return True
    except Exception as e:
        logger.error(f"❌ Error enviando documento: {e}")
        return False


def get_media_url(media_id: str) -> str:
    """Obtiene la URL de descarga de un medio de WhatsApp"""
    if not settings.META_TOKEN: return ""
    
    url = f"https://graph.facebook.com/v18.0/{media_id}"
    headers = {"Authorization": f"Bearer {settings.META_TOKEN}"}
    
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        return resp.json().get("url", "")
    except Exception as e:
        logger.error(f"❌ Error obteniendo URL de media {media_id}: {e}")
        return ""


def download_media(media_url: str) -> bytes:
    """Descarga el contenido binario del medio"""
    if not settings.META_TOKEN: return None
    
    headers = {"Authorization": f"Bearer {settings.META_TOKEN}"}
    
    try:
        resp = requests.get(media_url, headers=headers, timeout=30)
        resp.raise_for_status()
        return resp.content
    except Exception as e:
        logger.error(f"❌ Error descargando media: {e}")
        return None
