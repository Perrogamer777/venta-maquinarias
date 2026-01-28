"""
MACI WhatsApp Agent - Backend Minimalista
"""
import os
import logging
from fastapi import FastAPI, Request
from dotenv import load_dotenv
import vertexai
from vertexai.generative_models import GenerativeModel
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import requests

# Cargar variables de entorno
load_dotenv()

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuración
PROJECT_ID = os.getenv("GCP_PROJECT_ID", "venta-maquinarias-2627e")
LOCATION = os.getenv("GCP_LOCATION", "us-central1")
META_TOKEN = os.getenv("META_TOKEN")
PHONE_NUMBER_ID = os.getenv("PHONE_NUMBER_ID")
VERIFY_TOKEN = os.getenv("VERIFY_TOKEN", "maquinaria123")

# Inicializar Firebase
if not firebase_admin._apps:
    firebase_admin.initialize_app()
db = firestore.client()

# Inicializar Vertex AI
vertexai.init(project=PROJECT_ID, location=LOCATION)

# Crear app FastAPI
app = FastAPI(title="MACI WhatsApp Agent", version="1.0.0")


# System prompt simple
SYSTEM_PROMPT = """
Eres un asesor de ventas de MACI - Maquinaria Agrícola en Chile.

Tu trabajo es:
1. Entender qué necesita el cliente (tipo de maquinaria, cultivo, hectáreas)
2. Recomendar la mejor opción
3. Generar cotizaciones

Sé amable, profesional y conversacional.
Usa emojis 🚜🌾 para hacer la conversación más amigable.
"""


def send_whatsapp_message(phone_number: str, message: str):
    """Envía un mensaje de WhatsApp"""
    url = f"https://graph.facebook.com/v18.0/{PHONE_NUMBER_ID}/messages"
    headers = {
        "Authorization": f"Bearer {META_TOKEN}",
        "Content-Type": "application/json"
    }
    data = {
        "messaging_product": "whatsapp",
        "to": phone_number,
        "text": {"body": message}
    }
    
    try:
        response = requests.post(url, headers=headers, json=data)
        response.raise_for_status()
        logger.info(f"✅ Mensaje enviado a {phone_number}")
    except Exception as e:
        logger.error(f"❌ Error enviando mensaje: {e}")


def save_message(phone: str, role: str, content: str):
    """Guarda un mensaje en Firestore"""
    try:
        db.collection("chats").document(phone).collection("messages").add({
            "role": role,
            "content": content,
            "timestamp": datetime.now()
        })
    except Exception as e:
        logger.error(f"Error guardando mensaje: {e}")


def get_chat_history(phone: str, limit: int = 10):
    """Obtiene el historial del chat"""
    try:
        messages = []
        docs = db.collection("chats").document(phone).collection("messages")\
            .order_by("timestamp", direction=firestore.Query.DESCENDING)\
            .limit(limit)\
            .stream()
        
        for doc in docs:
            data = doc.to_dict()
            messages.append({
                "role": data.get("role"),
                "content": data.get("content")
            })
        
        return list(reversed(messages))
    except Exception as e:
        logger.error(f"Error obteniendo historial: {e}")
        return []


@app.get("/")
def health_check():
    """Health check"""
    return {"status": "MACI WhatsApp Agent 🚜", "version": "1.0.0"}


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


@app.post("/webhook")
async def receive_webhook(request: Request):
    """Recibir mensajes de WhatsApp"""
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
        text = message.get("text", {}).get("body", "")
        
        if not text:
            return {"status": "ok"}
        
        logger.info(f"📱 Mensaje de {phone}: {text}")
        
        # Guardar mensaje del usuario
        save_message(phone, "user", text)
        
        # Obtener historial
        history = get_chat_history(phone)
        
        # Procesar con Gemini
        model = GenerativeModel("gemini-2.0-flash-exp", system_instruction=[SYSTEM_PROMPT])
        
        # Construir contexto
        chat_context = ""
        for msg in history[-5:]:  # Últimos 5 mensajes
            role = "Usuario" if msg["role"] == "user" else "Asistente"
            chat_context += f"{role}: {msg['content']}\\n"
        
        # Generar respuesta
        prompt = f"Contexto de conversación:\\n{chat_context}\\n\\nNuevo mensaje del usuario: {text}"
        response = model.generate_content(prompt)
        
        if response.text:
            # Guardar y enviar respuesta
            save_message(phone, "assistant", response.text)
            send_whatsapp_message(phone, response.text)
        
        return {"status": "ok"}
    
    except Exception as e:
        logger.error(f"❌ Error procesando webhook: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)

@app.post("/api/upload-image")
async def upload_image_endpoint(request: Request):
    """Sube imagen a Cloud Storage"""
    try:
        from google.cloud import storage
        import uuid
        
        form = await request.form()
        file = form.get("file")
        
        if not file:
            return {"success": False, "error": "No file"}
        
        contents = await file.read()
        
        # Validar tamaño (max 5MB)
        if len(contents) > 5 * 1024 * 1024:
            return {"success": False, "error": "Max 5MB"}
        
        # Nombre único
        ext = file.filename.split(".")[-1] if "." in file.filename else "jpg"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        filename = f"maquinarias/{timestamp}_{unique_id}.{ext}"
        
        # Subir
        storage_client = storage.Client()
        bucket = storage_client.bucket(f"{PROJECT_ID}.appspot.com")
        blob = bucket.blob(filename)
        blob.upload_from_string(contents, content_type=file.content_type)
        blob.make_public()
        
        logger.info(f"✅ Imagen: {filename}")
        return {"success": True, "url": blob.public_url}
        
    except Exception as e:
        logger.error(f"❌ Upload error: {e}")
        return {"success": False, "error": str(e)}
