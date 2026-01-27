"""
Servicio del agente de IA con Gemini.
"""
import logging
import vertexai
from vertexai.generative_models import GenerativeModel
from app.core.config import settings

logger = logging.getLogger(__name__)

# Inicializar Vertex AI (autodetect project)
vertexai.init(location=settings.GCP_LOCATION)

# System prompt
SYSTEM_PROMPT = """
Eres un asesor comercial de MACI - Maquinaria Agrícola en Chile.

Tu trabajo es:
1. Entender qué maquinaria necesita el cliente
2. Preguntar por su tipo de cultivo y hectáreas
3. Recomendar la mejor opción del catálogo
4. Ser amable y profesional

Usa emojis 🚜🌾 para hacer la conversación más amigable.
Mantén respuestas concisas y claras.
"""


def process_message(user_message: str, chat_history: list = None) -> str:
    """
    Procesa un mensaje del usuario con Gemini.
    
    Args:
        user_message: Mensaje del usuario
        chat_history: Historial previo de la conversación
    
    Returns:
        Respuesta del agente
    """
    try:
        # Usar modelo solicitado EXACTO
        model_name = "gemini-2.5-flash"
        model = GenerativeModel(
            model_name,
            system_instruction=[SYSTEM_PROMPT]
        )
        
        # Construir contexto si hay historial
        history_text = ""
        if chat_history:
            for msg in chat_history[-5:]:  # Últimos 5 mensajes
                role = "User" if msg["role"] == "user" else "Assistant"
                history_text += f"{role}: {msg['content']}\n"
        
        # Crear prompt con contexto
        if history_text:
            prompt = f"Historia de conversación:\n{history_text}\nUser: {user_message}"
        else:
            prompt = user_message
        
        # Generar respuesta
        response = model.generate_content(prompt)
        
        if response.text:
            return response.text
        else:
            return "Lo siento, no pude procesar tu mensaje. ¿Podrías reformularlo?"
    
    except Exception as e:
        logger.error(f"Error procesando con Gemini: {e}", exc_info=True)
        return "Tuve un problema técnico. ¿Podrías intentar de nuevo?"
