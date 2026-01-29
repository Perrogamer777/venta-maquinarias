
"""
Servicio de conversión de imágenes para compatibilidad con WhatsApp.
Convierte imágenes WebP a JPG y las almacena en Cloud Storage.
"""
import logging
import io
import requests
import hashlib
from PIL import Image
from google.cloud import storage

logger = logging.getLogger(__name__)

BUCKET_NAME = "venta-maquinarias-cotizaciones"
CONVERTED_IMAGES_FOLDER = "imagenes_convertidas"


def webp_to_jpg(webp_url: str) -> str:
    """
    Convierte una imagen WebP a JPG y la sube a Cloud Storage.
    
    Args:
        webp_url: URL de la imagen WebP original
    
    Returns:
        URL pública de la imagen JPG convertida, o None si falla
    """
    try:
        # Si la URL ya es JPG o PNG, devolverla tal cual
        if webp_url.lower().endswith(('.jpg', '.jpeg', '.png')):
            logger.info(f"Imagen ya es JPG/PNG: {webp_url}")
            return webp_url
        
        logger.info(f"🔄 Convirtiendo WebP a JPG: {webp_url}")
        
        # Descargar la imagen WebP (con User-Agent para evitar bloqueos)
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
        response = requests.get(webp_url, headers=headers, timeout=15)
        response.raise_for_status()
        
        # Abrir con Pillow
        img = Image.open(io.BytesIO(response.content))
        
        # Convertir a RGB (necesario para JPG si tiene transparencia)
        if img.mode in ('RGBA', 'LA', 'P'):
            # Crear fondo blanco para transparencias
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        # DEBUG: Log image details
        logger.info(f"📐 Imagen procesada: {img.size} formato original: {img.format} mode: {img.mode}")

        # Crear nombre único basado SOLO en la URL (para cache efectivo)
        url_hash = hashlib.md5(webp_url.encode()).hexdigest()[:16]
        jpg_filename = f"{CONVERTED_IMAGES_FOLDER}/{url_hash}.jpg"
        
        # Convertir a JPG en memoria
        jpg_buffer = io.BytesIO()
        img.save(jpg_buffer, format='JPEG', quality=90, optimize=True)
        jpg_buffer.seek(0)
        
        # Subir a Cloud Storage
        storage_client = storage.Client()
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(jpg_filename)
        
        # Verificar si ya existe (cache)
        if blob.exists():
            logger.info(f"✅ Imagen ya convertida previamente (cache): {jpg_filename}")
            blob.make_public()
            return blob.public_url
        
        # Subir nueva imagen
        blob.upload_from_file(jpg_buffer, content_type='image/jpeg')
        blob.make_public()
        
        public_url = blob.public_url
        logger.info(f"✅ Imagen convertida y subida: {public_url}")
        
        return public_url
        
    except requests.exceptions.RequestException as e:
        logger.error(f"❌ Error descargando imagen: {e}")
        return None
    except Exception as e:
        logger.error(f"❌ Error convirtiendo imagen: {e}", exc_info=True)
        return None


def convert_image_list(image_urls: list) -> list:
    """
    Convierte una lista de URLs de imágenes a formato compatible con WhatsApp.
    
    Args:
        image_urls: Lista de URLs de imágenes
    
    Returns:
        Lista de URLs convertidas (JPG), filtrando las que fallaron
    """
    converted_urls = []
    
    for url in image_urls:
        converted_url = webp_to_jpg(url)
        if converted_url:
            converted_urls.append(converted_url)
        else:
            logger.warning(f"⚠️ No se pudo convertir: {url}")
    
    return converted_urls
