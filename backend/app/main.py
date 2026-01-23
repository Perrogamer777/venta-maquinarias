"""
Chocolate Bot - FastAPI Application
Punto de entrada principal para Cloud Run.
"""
import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.agent.core import process_message
from app.api.dashboard import router as dashboard_router
from app.api.promotions import router as promotions_router
from app.api.generate_promo import router as ai_promo_router
from app.api.cron import router as cron_router

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='{"time": "%(asctime)s", "level": "%(levelname)s", "module": "%(name)s", "message": "%(message)s"}'
)
logger = logging.getLogger(__name__)

# Crear aplicación FastAPI
app = FastAPI(
    title="Chocolate Bot",
    description="Asistente de CIPRES Ecolodge & Spa",
    version="2.1.0"
)

# IMPORTANTE: CORS debe estar ANTES de incluir routers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Desarrollo local
        "http://localhost:5173",  # Vite local
        "https://dashboard-cipres-5g4fzthyxa-uc.a.run.app",  # Producción
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Incluir routers
app.include_router(dashboard_router)
app.include_router(promotions_router)  # Promociones masivas
app.include_router(ai_promo_router)    # Generación con IA
app.include_router(cron_router)        # Tareas programadas (Cron)


@app.get("/")
async def health_check():
    """Health check para Cloud Run."""
    return {"status": "Chocolate Asistente de Reservas Online 🍫", "version": "2.0.0"}


@app.get("/webhook")
async def verify_webhook(request: Request):
    """Verificación de webhook de Meta/WhatsApp."""
    params = request.query_params
    
    if params.get("hub.verify_token") == settings.verify_token:
        logger.info("Webhook verificado exitosamente")
        return int(params.get("hub.challenge", 0))
    
    logger.warning("Token de verificación inválido")
    raise HTTPException(status_code=403, detail="Token inválido")


@app.post("/webhook")
async def receive_webhook(request: Request):
    """
    Recibe mensajes de WhatsApp.
    Procesa mensajes de texto e imágenes.
    """
    try:
        data = await request.json()
        
        # Extraer mensaje
        entry = data.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        
        if "messages" not in value:
            return {"status": "no_message"}
        
        message = value["messages"][0]
        telefono = message["from"]
        msg_type = message.get("type", "text")
        
        # ============ VERIFICACIÓN DE PAUSA ============
        from app.services.firebase import db
        chat_ref = db.collection("chats").document(telefono)
        chat_doc = chat_ref.get()
        
        if chat_doc.exists:
            chat_data = chat_doc.to_dict()
            agent_paused = chat_data.get("agentePausado", False)
            logger.info(f"🔍 Check pausa para {telefono}: agentePausado={agent_paused}")
            
            if agent_paused:
                logger.info(f"⏸️ Agente PAUSADO para {telefono}. Ignorando mensaje.")
                # Guardamos el mensaje para que aparezca en el dashboard
                from app.services.firebase import save_message
                if msg_type == "text":
                    save_message(telefono, "user", message["text"]["body"])
                return {"status": "ok", "reason": "agent_paused"}
        else:
            logger.info(f"🔍 Documento chats/{telefono} no existe, creando nuevo")
        # ================================================
        
        # Procesar según tipo de mensaje
        if msg_type == "text":
            # Mensaje de texto normal
            texto = message["text"]["body"]
            logger.info(f"Mensaje texto de {telefono}: {texto[:50]}...")
            await process_message(texto, telefono)
            
        elif msg_type == "image":
            # Mensaje con imagen
            from app.services.whatsapp import download_whatsapp_media, upload_to_firebase_storage
            from app.services.firebase import save_message
            
            image_data = message.get("image", {})
            media_id = image_data.get("id")
            caption = image_data.get("caption", "")
            mime_type = image_data.get("mime_type", "image/jpeg")
            
            logger.info(f"Imagen recibida de {telefono}, media_id: {media_id}")
            
            # Descargar imagen de WhatsApp
            image_bytes = download_whatsapp_media(media_id)
            
            if image_bytes:
                # Subir a Firebase Storage
                image_url = upload_to_firebase_storage(image_bytes, telefono, mime_type)
                
                if image_url:
                    # Guardar en Firestore con la URL de Storage
                    save_message(
                        telefono=telefono,
                        role="user",
                        contenido=caption,
                        msg_type="image",
                        image_url=image_url
                    )
                    logger.info(f"Imagen guardada en Storage: {image_url}")
                    
                    # Procesar como mensaje (el caption o indicar que envió imagen)
                    texto_para_gemini = caption if caption else "[El usuario envió una imagen]"
                    await process_message(texto_para_gemini, telefono)
                else:
                    logger.error("No se pudo subir imagen a Storage")
                    save_message(telefono, "user", caption or "[Imagen no procesada]", "image")
            else:
                logger.error("No se pudo descargar imagen de WhatsApp")
                save_message(telefono, "user", caption or "[Imagen no procesada]", "image")
        elif msg_type == "audio":
            # Mensaje de audio - transcribir con Speech-to-Text
            from app.services.whatsapp import download_whatsapp_media
            from app.services.speech import transcribe_audio
            from app.services.firebase import save_message
            
            audio_data = message.get("audio", {})
            media_id = audio_data.get("id")
            mime_type = audio_data.get("mime_type", "audio/ogg")
            
            logger.info(f"🎤 Audio recibido de {telefono}, media_id: {media_id}, mime: {mime_type}")
            
            # Descargar audio de WhatsApp
            audio_bytes = download_whatsapp_media(media_id)
            
            if audio_bytes:
                # Transcribir audio a texto
                texto_transcrito = transcribe_audio(audio_bytes, mime_type)
                
                # Guardar el mensaje original (audio) en Firestore
                save_message(
                    telefono=telefono,
                    role="user",
                    contenido=f"[Audio]: {texto_transcrito}",
                    msg_type="audio"
                )
                
                logger.info(f"Audio transcrito: {texto_transcrito[:50]}...")
                
                # Procesar el texto transcrito como si fuera un mensaje de texto
                await process_message(texto_transcrito, telefono)
            else:
                logger.error("No se pudo descargar audio de WhatsApp")
                save_message(telefono, "user", "[Audio no procesado]", "audio")
        
        else:
            # Otros tipos de mensaje (video, sticker, etc.) - ignorar por ahora
            logger.info(f"Mensaje ignorado (tipo: {msg_type})")
        
        return {"status": "ok"}
    
    except Exception as e:
        logger.error(f"Error procesando webhook: {e}", exc_info=True)
        return {"status": "error"}


# --- ENDPOINT PARA SCRAPING ---

@app.post("/scrape")
async def trigger_scrape():
    """
    Ejecuta el scraping del sitio web del cliente.
    Puede ser llamado manualmente o por Cloud Scheduler.
    """
    try:
        from app.services.scraper import run_full_scrape
        resultado = run_full_scrape()
        return {
            "status": "ok",
            "servicios_encontrados": len(resultado.get("servicios", [])),
            "guardado": resultado.get("guardado_en_firestore", False),
            "timestamp": resultado.get("timestamp")
        }
    except Exception as e:
        logger.error(f"Error en scraping: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/scrape/status")
async def scrape_status():
    """Muestra la última actualización de datos scrapeados."""
    try:
        from app.services.scraper import get_cached_site_data
        data = get_cached_site_data()
        if data:
            return {
                "status": "ok",
                "ultima_actualizacion": data.get("ultima_actualizacion"),
                "servicios": len(data.get("servicios", [])),
                "fuente": data.get("fuente")
            }
        return {"status": "no_data", "mensaje": "Ejecuta POST /scrape primero"}
    except Exception as e:
        logger.error(f"Error obteniendo status: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Para ejecución local
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
