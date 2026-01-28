"""
Servicio de WhatsApp para envío de mensajes.
"""
import logging
import requests
from app.core.config import settings

logger = logging.getLogger(__name__)

# Límite de caracteres de WhatsApp
MAX_CHARS = 4000  # Dejamos margen de seguridad


def split_message(message: str, max_length: int = MAX_CHARS) -> list:
    """Divide un mensaje largo en chunks respetando saltos de línea"""
    if len(message) <= max_length:
        return [message]
    
    chunks = []
    lines = message.split('\n')
    current_chunk = ""
    
    for line in lines:
        # Si agregar esta línea excede el límite
        if len(current_chunk) + len(line) + 1 > max_length:
            if current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = line + '\n'
            else:
                # Línea individual muy larga - forzar corte
                chunks.append(line[:max_length])
                current_chunk = line[max_length:] + '\n'
        else:
            current_chunk += line + '\n'
    
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    
    return chunks


def send_message(phone: str, message: str) -> bool:
    """Envía un mensaje de WhatsApp (divide automáticamente si es muy largo)"""
    if not settings.META_TOKEN or not settings.PHONE_NUMBER_ID:
        logger.warning("⚠️ META_TOKEN o PHONE_NUMBER_ID no configurados")
        return False
    
    # Dividir mensaje si es necesario
    chunks = split_message(message)
    
    if len(chunks) > 1:
        logger.info(f"📨 Mensaje dividido en {len(chunks)} partes")
    
    url = f"https://graph.facebook.com/v18.0/{settings.PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {settings.META_TOKEN}",
        "Content-Type": "application/json"
    }
    
    all_success = True
    for i, chunk in enumerate(chunks, 1):
        data = {
            "messaging_product": "whatsapp",
            "to": phone,
            "text": {"body": chunk}
        }
        
        try:
            response = requests.post(url, headers=headers, json=data, timeout=10)
            response.raise_for_status()
            logger.info(f"✅ Parte {i}/{len(chunks)} enviada a {phone}")
        except requests.exceptions.RequestException as e:
            error_msg = f"❌ Error enviando parte {i}/{len(chunks)}: {e}"
            if e.response is not None:
                 error_msg += f" | Detalle: {e.response.text}"
            logger.error(error_msg)
            all_success = False
        except Exception as e:
            logger.error(f"❌ Error inesperado enviando parte {i}: {e}")
            all_success = False
    
    return all_success


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
    
    # Añadir caption si está presente
    if caption and caption.strip():
        data["image"]["caption"] = caption[:1024]  # WhatsApp limit
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=10)
        response.raise_for_status()
        logger.info(f"✅ Imagen enviada a {phone}")
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


def send_document(phone: str, document_url: str, filename: str = "", caption: str = "") -> bool:
    """Envía un documento (PDF, etc.) por WhatsApp"""
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
            "link": document_url
        }
    }
    
    if filename:
        data["document"]["filename"] = filename
    if caption:
        data["document"]["caption"] = caption[:1024]
    
    try:
        response = requests.post(url, headers=headers, json=data, timeout=10)
        response.raise_for_status()
        logger.info(f"✅ Documento enviado a {phone}")
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
