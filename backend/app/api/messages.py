from fastapi import APIRouter, Request, HTTPException
import logging
from app.services.whatsapp import send_message
from app.services.firebase import save_message

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/send-whatsapp-message")
async def send_whatsapp_message_endpoint(request: Request):
    """Envía mensaje de WhatsApp desde el dashboard"""
    try:
        data = await request.json()
        phone = data.get("phone")
        message = data.get("message")
        
        if not phone or not message:
            return {"success": False, "error": "Phone and message required"}
        
        # Enviar mensaje
        success = send_message(phone, message)
        
        if success:
            # Guardar en Firestore
            save_message(phone, "assistant", message)
            return {"success": True, "message": "Mensaje enviado"}
        else:
            return {"success": False, "error": "Failed to send"}
    
    except Exception as e:
        logger.error(f"❌ Error endpoint send: {e}")
        return {"success": False, "error": str(e)}
