"""
API endpoint para subir imágenes a Cloud Storage.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from google.cloud import storage
from app.core.config import settings
import logging
import uuid
from datetime import datetime

router = APIRouter()
logger = logging.getLogger(__name__)

# Cliente de Cloud Storage
storage_client = storage.Client()
BUCKET_NAME = "venta-maquinarias-2627e.firebasestorage.app"


@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """Sube una imagen a Cloud Storage y retorna la URL pública"""
    try:
        # Validar tipo de archivo
        allowed_types = ["image/jpeg", "image/jpg", "image/png", "image/webp"]
        if file.content_type not in allowed_types:
            raise HTTPException(400, "Solo se permiten imágenes (JPG, PNG, WEBP)")
        
        # Validar tamaño (max 5MB)
        contents = await file.read()
        if len(contents) > 5 * 1024 * 1024:
            raise HTTPException(400, "La imagen no puede superar 5MB")
        
        # Generar nombre único
        ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"maquinarias/{timestamp}_{unique_id}.{ext}"
        
        # Subir a Cloud Storage
        bucket = storage_client.bucket(BUCKET_NAME)
        blob = bucket.blob(filename)
        blob.upload_from_string(contents, content_type=file.content_type)
        
        # Hacer público
        blob.make_public()
        
        # Retornar URL pública
        public_url = blob.public_url
        
        logger.info(f"✅ Imagen subida: {filename}")
        return {"success": True, "url": public_url}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error subiendo imagen: {e}", exc_info=True)
        raise HTTPException(500, f"Error al subir imagen: {str(e)}")
