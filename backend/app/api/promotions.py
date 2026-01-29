"""
API endpoints para envío de promociones masivas por WhatsApp.
Con guardado en Firestore para que aparezcan en el historial de conversaciones.
"""
import asyncio
import logging
from typing import List
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx

from app.core.config import settings
from app.services.firebase import db, save_message_firestore

logger = logging.getLogger(__name__)

router = APIRouter()


# --- Modelos ---

class SendPromotionRequest(BaseModel):
    phones: List[str]
    imageUrl: str
    title: str
    description: str
    promotionId: str


class MessageResult(BaseModel):
    phone: str
    status: str
    messageId: str = None
    error: str = None


class PromotionSummary(BaseModel):
    total: int
    sent: int
    failed: int


class SendPromotionResponse(BaseModel):
    success: bool
    results: List[MessageResult]
    summary: PromotionSummary


# --- Funciones auxiliares ---

async def save_promo_message_to_firestore(phone: str, image_url: str, caption: str):
    """
    Guarda el mensaje promocional en el historial del chat usando la función estándar.
    Esto hace que aparezca en la vista de Conversaciones del dashboard.
    """
    try:
        # Usar la función estándar de firebase.py para consistencia
        # El caption incluye el texto de la promoción
        save_message_firestore(
            phone=phone,
            role="assistant",
            content=f"📢 PROMOCIÓN: {caption}",
            msg_type="image",
            media_url=image_url
        )
        logger.info(f"📝 Mensaje promocional guardado para {phone}")
        
    except Exception as e:
        logger.error(f"Error guardando mensaje promocional en Firestore: {e}")


async def send_image_message(phone: str, image_url: str, caption: str) -> dict:
    """
    Envía imagen con texto a un número de WhatsApp.
    Versión asíncrona usando httpx.
    """
    url = f"https://graph.facebook.com/v18.0/{settings.PHONE_NUMBER_ID}/messages"
    
    headers = {
        "Authorization": f"Bearer {settings.META_TOKEN}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "messaging_product": "whatsapp",
        "recipient_type": "individual",
        "to": phone,
        "type": "image",
        "image": {
            "link": image_url,
            "caption": caption
        }
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(url, headers=headers, json=payload, timeout=30)
            
            if response.status_code == 200:
                # Guardar mensaje en Firestore si se envió exitosamente
                await save_promo_message_to_firestore(phone, image_url, caption)
                
                data = response.json()
                message_id = data.get("messages", [{}])[0].get("id", "")
                logger.info(f"✅ Promoción enviada a {phone}: {message_id}")
                return {
                    "phone": phone,
                    "status": "sent",
                    "messageId": message_id
                }
            else:
                error_msg = response.text[:200]
                logger.error(f"❌ Error enviando a {phone}: {error_msg}")
                return {
                    "phone": phone,
                    "status": "error",
                    "error": error_msg
                }
        except Exception as e:
            logger.error(f"❌ Excepción enviando a {phone}: {e}")
            return {
                "phone": phone,
                "status": "error",
                "error": str(e)
            }


# --- Endpoints ---

@router.post("/send-promotion", response_model=SendPromotionResponse)
async def send_promotion(request: SendPromotionRequest):
    """
    Envía una promoción con imagen a múltiples destinatarios.
    
    - Construye el caption con título en negrita + descripción
    - Envía con rate limiting para respetar límites de WhatsApp
    - Guarda cada mensaje en Firestore para que aparezca en Conversaciones
    - Guarda historial de envío en colección 'promotions'
    """
    logger.info(f"📣 Iniciando envío de promoción '{request.promotionId}' a {len(request.phones)} destinatarios")
    
    # Validaciones
    if not request.phones:
        raise HTTPException(status_code=400, detail="La lista de teléfonos no puede estar vacía")
    
    if len(request.phones) > 100:
        raise HTTPException(status_code=400, detail="Máximo 100 destinatarios por envío")
    
    if not request.imageUrl.startswith("http"):
        raise HTTPException(status_code=400, detail="imageUrl debe ser una URL válida")
    
    # Construir caption (título en negrita + descripción)
    caption = f"*{request.title}*\n\n{request.description}"
    
    # Enviar a todos los destinatarios con rate limiting
    results = []
    sent_count = 0
    failed_count = 0
    
    for i, phone in enumerate(request.phones):
        result = await send_image_message(phone, request.imageUrl, caption)
        results.append(result)
        
        if result["status"] == "sent":
            sent_count += 1
        else:
            failed_count += 1
        
        # Rate limiting: esperar 100ms entre mensajes
        if i < len(request.phones) - 1:
            await asyncio.sleep(0.1)
            
            # Pausa más larga cada 10 mensajes
            if (i + 1) % 10 == 0:
                logger.info(f"📊 Progreso: {i + 1}/{len(request.phones)} enviados. Pausa de 1s...")
                await asyncio.sleep(1)
    
    # Guardar historial de la promoción
    try:
        from google.cloud import firestore as fs
        
        promo_ref = db.collection('promotions').document(request.promotionId)
        
        batch_record = {
            "enviadoEn": datetime.now(),
            "destinatarios": len(request.phones),
            "enviados": sent_count,
            "fallidos": failed_count,
            "imageUrl": request.imageUrl,
            "title": request.title
        }
        
        # Verificar si el documento existe
        doc = promo_ref.get()
        if doc.exists:
            promo_ref.update({
                "historialEnvios": fs.ArrayUnion([batch_record]),
                "ultimoEnvio": datetime.now(),
                "status": "sent"
            })
        else:
            promo_ref.set({
                "id": request.promotionId,
                "title": request.title,
                "description": request.description,
                "imageUrl": request.imageUrl,
                "createdAt": datetime.now(),
                "ultimoEnvio": datetime.now(),
                "status": "sent",
                "historialEnvios": [batch_record]
            })
        
        logger.info(f"📊 Historial guardado para promoción {request.promotionId}")
    except Exception as e:
        logger.warning(f"No se pudo guardar historial: {e}")
    
    logger.info(f"Promoción completada: {sent_count} enviados, {failed_count} fallidos")
    
    return SendPromotionResponse(
        success=failed_count == 0,
        results=[MessageResult(**r) for r in results],
        summary=PromotionSummary(
            total=len(request.phones),
            sent=sent_count,
            failed=failed_count
        )
    )


@router.get("/promotions/{promotion_id}")
async def get_promotion_stats(promotion_id: str):
    """
    Obtiene estadísticas de una promoción específica.
    """
    try:
        doc = db.collection('promotions').document(promotion_id).get()
        
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Promoción no encontrada")
        
        data = doc.to_dict()
        
        # Calcular totales
        historial = data.get("historialEnvios", [])
        total_enviados = sum(h.get("enviados", 0) for h in historial)
        total_fallidos = sum(h.get("fallidos", 0) for h in historial)
        
        return {
            "id": promotion_id,
            "title": data.get("title"),
            "description": data.get("description"),
            "imageUrl": data.get("imageUrl"),
            "stats": {
                "totalEnviados": total_enviados,
                "totalFallidos": total_fallidos,
                "cantidadEnvios": len(historial)
            },
            "ultimoEnvio": data.get("ultimoEnvio"),
            "historialEnvios": historial
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo promoción: {e}")
        raise HTTPException(status_code=500, detail=str(e))
