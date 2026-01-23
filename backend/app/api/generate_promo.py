"""
API endpoints para generar contenido promocional usando IA (Vertex AI).
Usa Gemini 2.0 Flash (Nano Banana Pro) para texto e imágenes.
"""
import os
import json
import logging
import uuid
import base64
import vertexai
from vertexai.generative_models import GenerativeModel, GenerationConfig
from fastapi import APIRouter
from pydantic import BaseModel
from google.cloud import storage

from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# Inicializar Vertex AI
try:
    vertexai.init(project=settings.project_id, location=settings.location)
    logger.info(f"Vertex AI inicializado: {settings.project_id} en {settings.location}")
except Exception as e:
    logger.error(f"Error inicializando Vertex AI: {e}")


class GeneratePromotionRequest(BaseModel):
    prompt: str


class GeneratePromotionResponse(BaseModel):
    success: bool
    promotion: dict = None
    error: str = None


def save_image_to_gcs(image_bytes: bytes) -> str:
    """Guarda la imagen generada en Google Cloud Storage y retorna la URL pública."""
    try:
        bucket_name = os.getenv("GCP_STORAGE_BUCKET") or f"{settings.project_id}.firebasestorage.app"
        file_name = f"promociones/ai-gen-{uuid.uuid4()}.png"
        
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(file_name)
        
        blob.upload_from_string(image_bytes, content_type="image/png")
        
        try:
            blob.make_public()
            return blob.public_url
        except Exception:
            return f"https://firebasestorage.googleapis.com/v0/b/{bucket_name}/o/{file_name.replace('/', '%2F')}?alt=media"
            
    except Exception as e:
        logger.error(f"Error guardando imagen en GCS: {e}")
        raise e


@router.post("/api/generate-promotion", response_model=GeneratePromotionResponse)
async def generate_promotion(request: GeneratePromotionRequest):
    """
    Genera una promoción completa usando Gemini (Nano Banana Pro) para TODO.
    """
    try:
        logger.info(f"Generando promoción para: '{request.prompt[:50]}...'")
        
        # ===== PASO 1: Generar Título y Descripción con Gemini =====
        # Usamos gemini-2.0-flash para el texto
        text_model = GenerativeModel("gemini-2.0-flash")
        
        text_prompt = f"""Eres un experto en marketing digital para turismo de cabañas.
Genera un título y una descripción para una promoción basada en el input del usuario.

REGLAS CRÍTICAS PARA image_prompt:
- PROHIBIDO generar: cabañas, casas, edificios, habitaciones, interiores, paisajes específicos, lagos, montañas, volcanes
- OBLIGATORIO generar: personas felices, familias disfrutando, parejas románticas, momentos de relajación
- El prompt debe ser en INGLÉS y describir EMOCIONES humanas, no lugares físicos
- Ejemplo BUENO: "A happy family of four laughing together outdoors, warm golden hour lighting, candid joyful moment, professional photography"

Salida JSON requerida:
{{
    "titulo": "Título corto y atractivo con emojis (max 50 chars)",
    "descripcion": "Descripción persuasiva y clara (max 200 chars)",
    "image_prompt": "Prompt en inglés para generar imagen de PERSONAS felices"
}}

INPUT: {request.prompt}"""

        text_response = text_model.generate_content(
            text_prompt,
            generation_config=GenerationConfig(
                response_mime_type="application/json",
                temperature=0.7
            )
        )
        
        content = json.loads(text_response.text)
        
        # Manejar caso donde Gemini devuelve lista en vez de dict
        if isinstance(content, list) and len(content) > 0:
            content = content[0]
            
        logger.info(f"Texto generado: {content.get('titulo', '')[:30]}...")
        
        # ===== PASO 2: Generar Imagen con Gemini (Nano Banana Pro) =====
        # Usamos EXCLUSIVAMENTE gemini-2.0-flash-exp como solicitó el cliente
        image_url = None
        
        try:
            image_model = GenerativeModel("gemini-2.0-flash-exp")
            
            image_prompt = f"""Generate a high-quality, photorealistic promotional image.

STRICT RULES:
- DO NOT include: cabins, houses, buildings, rooms, interiors, landscapes, lakes, mountains, volcanoes
- ONLY include: Happy people, families enjoying time together, romantic couples, children playing, relaxation moments
- Focus on EMOTIONS and human EXPERIENCES
- Style: Warm, inviting, professional marketing photo
- Lighting: Natural, golden hour preferred
- Mood: Joyful, peaceful, connected

Description: {content.get('image_prompt', 'Happy family enjoying quality time together, warm lighting, candid moment')}

Generate this image now."""

            logger.info("Generando imagen con Gemini 2.0 Flash (Nano Banana Pro)...")

            # Configuración específica para generación de imagen con Gemini
            image_response = image_model.generate_content(
                image_prompt,
                generation_config=GenerationConfig(
                    temperature=1.0,
                    top_p=0.95,
                    response_modalities=["IMAGE"]
                )
            )
            
            # Extraer imagen de la respuesta
            if image_response.candidates:
                for part in image_response.candidates[0].content.parts:
                    if hasattr(part, 'inline_data') and part.inline_data:
                        # Imagen encontrada
                        image_bytes = part.inline_data.data
                        if isinstance(image_bytes, str):
                            image_bytes = base64.b64decode(image_bytes)
                        
                        image_url = save_image_to_gcs(image_bytes)
                        logger.info(f"Imagen generada y guardada: {image_url}")
                        break
            
            if not image_url:
                logger.warning("No se encontró imagen en la respuesta de Gemini")
                image_url = "https://placehold.co/600x600?text=Imagen+No+Generada"
                
        except Exception as img_error:
            logger.error(f"Error generando imagen con Gemini 2.0: {img_error}", exc_info=True)
            image_url = "https://placehold.co/600x600?text=Error+Generando+Imagen"

        return {
            "success": True,
            "promotion": {
                "titulo": content.get("titulo"),
                "descripcion": content.get("descripcion"),
                "imagenUrl": image_url
            }
        }
        
    except Exception as e:
        logger.error(f"Error generando promoción: {e}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }
