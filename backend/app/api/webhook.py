"""
Rutas de la API para WhatsApp webhook.
"""
import logging
from fastapi import APIRouter, Request, HTTPException

from app.services.firebase import save_message, get_chat_history
from app.services.whatsapp import send_message, send_image, send_document
from app.services.agent import process_message
from app.services.image_converter import convert_image_list
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
        
        logger.info(f"📱 Mensaje de {phone}: {text[:50]}...")
        
        # Guardar mensaje usuario
        try:
            save_message(phone, "user", text)
        except Exception as e:
            logger.error(f"Error guardando mensaje usuario: {e}")
        
        # Historial
        history = []
        try:
            history = get_chat_history(phone)
        except Exception as e:
            logger.error(f"Error obteniendo historial: {e}")
        
        # Procesar con agente
        response = process_message(text, history)
        
        if isinstance(response, str):
            response_text = response
            images = []
            documents = []
        else:
            response_text = response.get("text", "")
            images = response.get("images", [])
            documents = response.get("documents", [])
        
        # 1. Enviar TEXTO
        if response_text:
            sent = send_message(phone, response_text)
            if sent:
                logger.info("✅ Respuesta de texto enviada")
                # Guardar texto
                try:
                    save_message(phone, "assistant", response_text)
                except Exception as e:
                    logger.error(f"Error guardando respuesta asistente: {e}")
            else:
                logger.error("❌ Falló el envío de texto a WhatsApp")
        
        # 2. Enviar IMÁGENES
        if images:
            logger.info(f"🔄 Procesando {len(images)} imágenes...")
            
            # Conversión explícita
            images_convertidas = convert_image_list(images)
            logger.info(f"📸 Imágenes convertidas/validadas: {len(images_convertidas)}")
            
            for img_url in images_convertidas:
                try:
                    logger.info(f"📤 Enviando imagen: {img_url}")
                    ok = send_image(phone, img_url, caption="📷 Imagen del producto")
                    if ok:
                        logger.info(f"🖼️ Imagen enviada correctamente")
                        # Guardar imagen en historial
                        try:
                            save_message(phone, "assistant", "Imagen enviada", msg_type="image", media_url=img_url)
                        except Exception as e:
                            logger.error(f"Error guardando log imagen: {e}")
                    else:
                        logger.error(f"❌ API WhatsApp rechazó la imagen")
                except Exception as e:
                    logger.error(f"❌ Excepción enviando imagen: {e}")
        
        # 3. Enviar DOCUMENTOS
        for doc in documents:
            try:
                send_document(phone, doc.get("url"), doc.get("filename", "Cotizacion.pdf"))
                # Guardar documento
                try:
                    save_message(phone, "assistant", "Cotización PDF", msg_type="document", media_url=doc.get("url"))
                except Exception as e:
                    logger.error(f"Error guardando log documento: {e}")
            except Exception as e:
                logger.error(f"Error enviando documento: {e}")
        
        return {"status": "ok"}
    
    except Exception as e:
        logger.error(f"❌ Error procesando webhook: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}

