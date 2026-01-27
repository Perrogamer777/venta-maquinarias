"""
Rutas de la API para WhatsApp webhook.
"""
import logging
from fastapi import APIRouter, Request, HTTPException

from app.services.firebase import save_message, get_chat_history
from app.services.whatsapp import send_message
from app.services.agent import process_message
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/webhook")
async def verify_webhook(request: Request):
    """Verificación del webhook de Meta"""
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    
    if mode == "subscribe" and token == settings.VERIFY_TOKEN:
        logger.info("✅ Webhook verificado correctamente")
        return int(challenge)
    
    logger.warning("⚠️ Intento de verificación con token inválido")
    raise HTTPException(status_code=403, detail="Token inválido")


@router.post("/webhook")
async def receive_webhook(request: Request):
    """Recibe mensajes de WhatsApp"""
    try:
        data = await request.json()
        
        # Extraer mensaje
        entry = data.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        
        if "messages" not in value:
            return {"status": "no_message"}
        
        message = value["messages"][0]
        phone = message["from"]
        msg_type = message.get("type")
        
        # Solo procesar mensajes de texto
        if msg_type != "text":
            logger.info(f"Mensaje tipo {msg_type} ignorado")
            return {"status": "ok"}
        
        text = message.get("text", {}).get("body", "")
        if not text:
            return {"status": "ok"}
        
        # Intentar guardar mensaje usuario (no bloqueante)
        try:
            save_message(phone, "user", text)
        except Exception as e:
            logger.error(f"Error no bloqueante guardando mensaje usuario: {e}")
        
        # Obtener historial (con fallback a lista vacía)
        history = []
        try:
            history = get_chat_history(phone)
        except Exception as e:
            logger.error(f"Error obteniendo historial: {e}")
        
        # Procesar con el agente
        response_text = process_message(text, history)
        
        # Enviar respuesta PRIMERO (prioridad crítica)
        sent = send_message(phone, response_text)
        if sent:
            logger.info("✅ Respuesta enviada exitosamente")
        else:
            logger.error("❌ Falló el envío de respuesta a WhatsApp")
        
        # Intentar guardar respuesta asistente (no bloqueante)
        try:
            save_message(phone, "assistant", response_text)
        except Exception as e:
            logger.error(f"Error no bloqueante guardando respuesta asistente: {e}")
        
        return {"status": "ok"}
    
    except Exception as e:
        logger.error(f"❌ Error procesando webhook: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}
