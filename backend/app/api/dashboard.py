"""
API endpoints para el dashboard de administración.
"""
import logging
from datetime import datetime
from pydantic import BaseModel, validator
from fastapi import APIRouter, HTTPException

from app.services.whatsapp import send_text
from app.services.firebase import save_message

logger = logging.getLogger(__name__)

# Crear router
router = APIRouter(prefix="/api", tags=["Dashboard API"])


# --- MODELOS PYDANTIC ---

class SendMessageRequest(BaseModel):
    """Request para enviar mensaje de WhatsApp."""
    phone: str
    message: str
    
    @validator('phone')
    def validate_phone(cls, v):
        """Valida formato del teléfono."""
        # Remover espacios y caracteres especiales
        v = v.strip().replace(" ", "").replace("-", "").replace("+", "")
        
        # Debe empezar con 56 (código Chile)
        if not v.startswith('56'):
            raise ValueError('El teléfono debe comenzar con 56 (código de Chile)')
        
        # Debe tener entre 11 y 13 dígitos
        if len(v) < 11 or len(v) > 13:
            raise ValueError('Formato de teléfono inválido')
        
        return v
    
    @validator('message')
    def validate_message(cls, v):
        """Valida que el mensaje no esté vacío."""
        v = v.strip()
        if not v:
            raise ValueError('El mensaje no puede estar vacío')
        if len(v) > 4096:
            raise ValueError('El mensaje es demasiado largo (máximo 4096 caracteres)')
        return v


class SendMessageResponse(BaseModel):
    """Response al enviar mensaje."""
    status: str
    phone: str
    message: str
    timestamp: str


# --- ENDPOINTS ---

@router.post("/send-message", response_model=SendMessageResponse)
async def send_whatsapp_message(request: SendMessageRequest):
    """
    Envía un mensaje de WhatsApp al cliente desde el dashboard.
    
    - **phone**: Número de teléfono del cliente (incluir código país)
    - **message**: Contenido del mensaje a enviar
    
    Returns:
        Confirmación del envío con timestamp
    """
    try:
        phone = request.phone
        message = request.message
        
        logger.info(f"Dashboard enviando mensaje a {phone}: {message[:50]}...")
        
        # 1. Enviar mensaje vía WhatsApp Business API
        success = send_text(phone, message)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Error al enviar mensaje por WhatsApp. Verifica el token y el phone_number_id."
            )
        
        # 2. Guardar mensaje en Firestore como role='model' (para mostrarse a la derecha)
        #    con source='dashboard' para identificar que viene del agente humano
        timestamp = datetime.now().isoformat()
        saved = save_message(phone, "model", message, source="dashboard")
        
        if not saved:
            logger.warning(f"Mensaje enviado pero no se guardó en Firestore para {phone}")
        
        # 3. Retornar confirmación
        return SendMessageResponse(
            status="sent",
            phone=phone,
            message=message,
            timestamp=timestamp
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error en send_whatsapp_message: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error interno al enviar mensaje: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Health check para el API."""
    return {"status": "ok", "service": "dashboard-api"}
