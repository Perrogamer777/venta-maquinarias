"""
Servicio de WhatsApp - Envío y recepción de mensajes a través de Meta API.
"""
import requests
import logging
import uuid
from app.config import settings

logger = logging.getLogger(__name__)


def send_message(telefono: str, contenido: str, tipo: str = "text") -> bool:
    """
    Envía un mensaje a través de WhatsApp.
    
    Args:
        telefono: Número de teléfono destino
        contenido: Texto o URL de imagen
        tipo: "text" o "image"
    
    Returns:
        True si el envío fue exitoso
    """
    url = f"https://graph.facebook.com/v18.0/{settings.phone_number_id}/messages"
    headers = {
        "Authorization": f"Bearer {settings.meta_token}", 
        "Content-Type": "application/json"
    }
    
    if tipo == "text":
        payload = {
            "messaging_product": "whatsapp", 
            "to": telefono, 
            "type": "text", 
            "text": {"body": contenido}
        }
    elif tipo == "image":
        payload = {
            "messaging_product": "whatsapp", 
            "to": telefono, 
            "type": "image", 
            "image": {"link": contenido}
        }
    else:
        logger.error(f"Tipo de mensaje no soportado: {tipo}")
        return False

    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code != 200:
            logger.error(f"Error Meta API ({tipo}): {response.text}")
            return False
        return True
    except Exception as e:
        logger.error(f"Error enviando mensaje WhatsApp: {e}")
        return False


def send_text(telefono: str, texto: str) -> bool:
    """Atajo para enviar mensaje de texto."""
    return send_message(telefono, texto, "text")


def send_image(telefono: str, url: str, save_to_firestore: bool = False) -> bool:
    """
    Envía una imagen por WhatsApp.
    
    Args:
        telefono: Número de teléfono destino
        url: URL de la imagen
        save_to_firestore: Si True, guarda el mensaje en Firestore
    
    Returns:
        True si el envío fue exitoso
    """
    success = send_message(telefono, url, "image")
    
    # Guardar en Firestore si se solicita
    if success and save_to_firestore:
        try:
            from app.services.firebase import save_message
            save_message(
                telefono=telefono,
                role="model",
                contenido="",  # Sin caption
                msg_type="image",
                image_url=url
            )
        except Exception as e:
            logger.warning(f"No se pudo guardar imagen en Firestore: {e}")
    
    return success


def send_image_with_caption(telefono: str, url: str, caption: str = "") -> bool:
    """
    Envía una imagen con caption y guarda en Firestore.
    
    Args:
        telefono: Número de teléfono destino
        url: URL de la imagen
        caption: Texto descriptivo de la imagen
    
    Returns:
        True si el envío fue exitoso
    """
    success = send_message(telefono, url, "image")
    
    if success:
        try:
            from app.services.firebase import save_message
            save_message(
                telefono=telefono,
                role="model",
                contenido=caption,
                msg_type="image",
                image_url=url
            )
        except Exception as e:
            logger.warning(f"No se pudo guardar imagen en Firestore: {e}")
    
    return success


# --- FUNCIONES PARA RECIBIR IMÁGENES ---

def download_whatsapp_media(media_id: str) -> bytes:
    """
    Descarga un archivo multimedia de WhatsApp.
    
    Args:
        media_id: ID del media en WhatsApp
    
    Returns:
        Bytes de la imagen o None si falla
    """
    try:
        # Paso 1: Obtener URL del media
        url = f"https://graph.facebook.com/v18.0/{media_id}"
        headers = {"Authorization": f"Bearer {settings.meta_token}"}
        
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            logger.error(f"Error obteniendo URL de media: {response.text}")
            return None
        
        media_url = response.json().get("url")
        if not media_url:
            logger.error("No se encontró URL en la respuesta de media")
            return None
        
        # Paso 2: Descargar el archivo
        download_response = requests.get(media_url, headers=headers)
        if download_response.status_code != 200:
            logger.error(f"Error descargando media: {download_response.status_code}")
            return None
        
        logger.info(f"Media descargado exitosamente: {len(download_response.content)} bytes")
        return download_response.content
        
    except Exception as e:
        logger.error(f"Error en download_whatsapp_media: {e}")
        return None


def upload_to_firebase_storage(image_bytes: bytes, phone: str, 
                                 mime_type: str = "image/jpeg") -> str:
    """
    Sube una imagen a Firebase Storage.
    
    Args:
        image_bytes: Bytes de la imagen
        phone: Teléfono del usuario (para organizar)
        mime_type: Tipo MIME de la imagen
    
    Returns:
        URL pública de la imagen o None si falla
    """
    try:
        from firebase_admin import storage
        
        # Generar nombre único
        file_extension = "jpg" if "jpeg" in mime_type else mime_type.split("/")[-1]
        filename = f"whatsapp_images/{phone}/{uuid.uuid4()}.{file_extension}"
        
        # Obtener bucket (usa el bucket por defecto del proyecto)
        bucket = storage.bucket()
        blob = bucket.blob(filename)
        
        # Subir imagen
        blob.upload_from_string(image_bytes, content_type=mime_type)
        
        # Hacer pública y obtener URL
        blob.make_public()
        public_url = blob.public_url
        
        logger.info(f"Imagen subida exitosamente: {public_url}")
        return public_url
        
    except Exception as e:
        logger.error(f"Error subiendo imagen a Storage: {e}")
        return None
