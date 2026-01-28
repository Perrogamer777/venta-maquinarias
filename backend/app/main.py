"""
MACI WhatsApp Agent - Backend Principal
Integra Webhook de Meta, Transcripción de Audio y Lógica de Agente.
"""
import os
import logging
from fastapi import FastAPI, Request
from dotenv import load_dotenv
import vertexai
from vertexai.generative_models import GenerativeModel, Part
import firebase_admin
from firebase_admin import firestore
from datetime import datetime

# Servicios
from app.services.whatsapp import send_message, send_image, send_document, get_media_url, download_media
from app.services.firebase import db, save_message_firestore, get_chat_history_firestore
from app.services.agent import process_message

# Cargar variables
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Config
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "venta-maquinarias-2627e")
LOCATION = os.getenv("GCP_LOCATION", "us-central1")
VERIFY_TOKEN = os.getenv("VERIFY_TOKEN", "maquinaria123")

# Init Vertex
vertexai.init(project=PROJECT_ID, location=LOCATION)

app = FastAPI(title="MACI WhatsApp Agent", version="2.0.0")

@app.get("/")
def health_check():
    return {"status": "MACI Agent V2 🚜 + 🎙️", "version": "2.0.0"}

@app.get("/webhook")
def verify_webhook(request: Request):
    """Verificar webhook de Meta"""
    mode = request.query_params.get("hub.mode")
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    
    if mode == "subscribe" and token == VERIFY_TOKEN:
        logger.info("✅ Webhook verificado")
        return int(challenge)
    return {"error": "Token inválido"}, 403

async def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/ogg") -> str:
    """Transcribe audio usando Gemini Flash (Multimodal)"""
    try:
        # Limpiar mime-type (WhatsApp envía 'audio/ogg; codecs=opus')
        if ";" in mime_type:
            mime_type = mime_type.split(";")[0]

        model = GenerativeModel("gemini-2.0-flash-exp")
        part = Part.from_data(data=audio_bytes, mime_type=mime_type)
        
        prompt = """
        Transcribe este mensaje de voz de WhatsApp.
        Contexto: Un cliente agricultor chileno consultando por maquinaria.
        Idioms: Puede contener modismos chilenos o términos técnicos agrícolas.
        Tarea: Transcribe exactamente lo que dice el usuario. Si hay ruido, ignóralo.
        """
        
        response = model.generate_content(
            [part, prompt],
            generation_config={"temperature": 0.0}
        )
        return response.text.strip()
    except Exception as e:
        logger.error(f"❌ Error transcribiendo audio: {e}")
        return ""

@app.post("/webhook")
async def receive_webhook(request: Request):
    """Recibir mensajes de WhatsApp (Texto y Audio)"""
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
        
        final_text = ""
        
        # 1. Procesar Entrada (Texto o Audio)
        if msg_type == "text":
            final_text = message["text"]["body"]
            
        elif msg_type == "audio":
            logger.info(f"🎙️ Recibido audio de {phone}")
            audio_id = message["audio"]["id"]
            mime_type = message["audio"].get("mime_type", "audio/ogg")
            
            # Descargar y transcribir
            url = get_media_url(audio_id)
            if url:
                audio_content = download_media(url)
                if audio_content:
                    final_text = await transcribe_audio(audio_content, mime_type)
                    logger.info(f"📝 Transcripción: {final_text}")
                    # Guardar nota de sistema sobre la transcripción
                    save_message_firestore(phone, "user", f"[AUDIO TRANSCRITO]: {final_text}")
                else:
                    logger.error("Error descargando audio content")
            else:
                logger.error("Error obteniendo URL de audio")
                
            if not final_text:
                # Fallback si falla transcripción
                send_message(phone, "🙉 Tuve problemas escuchando tu audio. ¿Podrías escribirlo?")
                return {"status": "error_audio"}

        if not final_text:
            return {"status": "ignored"}

        # 2. Guardar mensaje User (si fue texto, el audio ya se guardó arriba modificando contenido)
        if msg_type == "text":
            save_message_firestore(phone, "user", final_text)
        
        # 3. Obtener Historial
        history = get_chat_history_firestore(phone, limit=20)
        
        # 4. Procesar con AGENTE INTELIGENTE
        # Usamos el servicio robusto de agent.py (con tools, retry, cotizaciones)
        result = process_message(final_text, chat_history=history)
        
        # 5. Enviar Respuestas
        if result.get("text"):
            send_message(phone, result["text"])
            save_message_firestore(phone, "assistant", result["text"])
            
        # Imágenes
        for img_url in result.get("images", []):
            send_image(phone, img_url)
            save_message_firestore(phone, "assistant", "📷 Imagen enviada", msg_type="image", media_url=img_url)
            
        # Documentos (PDFs)
        for doc in result.get("documents", []):
            filename = doc.get("filename", "Documento.pdf")
            send_document(phone, doc["url"], filename=filename)
            save_message_firestore(phone, "assistant", f"📄 {filename}", msg_type="document", media_url=doc["url"])
            
        return {"status": "ok"}
    
    except Exception as e:
        logger.error(f"❌ Error webhook: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}

# Endpoints auxiliares para frontend
@app.post("/api/upload-image")
async def upload_image_endpoint(request: Request):
    # (Mantener lógica original o importar de servicio)
    try:
        from google.cloud import storage
        import uuid
        form = await request.form()
        file = form.get("file")
        if not file: return {"success": False}
        contents = await file.read()
        filename = f"uploads/{uuid.uuid4()}_{file.filename}"
        storage_client = storage.Client()
        bucket = storage_client.bucket(f"{PROJECT_ID}.appspot.com")
        blob = bucket.blob(filename)
        blob.upload_from_string(contents, content_type=file.content_type)
        blob.make_public()
        return {"success": True, "url": blob.public_url}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/send-whatsapp-message")
async def send_dashboard_message(request: Request):
    """Para que el humano conteste desde el dashboard"""
    try:
        data = await request.json()
        phone = data.get("phone")
        msg = data.get("message")
        if send_message(phone, msg):
            save_message_firestore(phone, "assistant", msg)
            return {"success": True}
        return {"success": False}
    except Exception:
        return {"success": False}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
