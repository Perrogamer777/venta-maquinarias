"""
Servicio de Firebase - Persistencia de historial y reservas.
"""
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
import zoneinfo
import logging
from app.config import settings

logger = logging.getLogger(__name__)

# Inicializamos Firebase (Patrón Singleton para Cloud Run)
if not firebase_admin._apps:
    app = firebase_admin.initialize_app()

# Usamos la base de datos (default)
db = firestore.client()


def _get_timezone():
    """Obtiene la zona horaria configurada."""
    try:
        return zoneinfo.ZoneInfo(settings.timezone)
    except:
        return zoneinfo.ZoneInfo("UTC")


def save_message(telefono: str, role: str, contenido: str, 
                  msg_type: str = "text", image_url: str = None,
                  source: str = None) -> bool:
    """
    Guarda un mensaje en el historial del usuario.
    
    Args:
        telefono: Número de teléfono del usuario
        role: "user" o "model"
        contenido: Texto del mensaje
        msg_type: "text" o "image"
        image_url: URL de la imagen (solo si msg_type="image")
        source: Origen del mensaje ("dashboard", "bot", "whatsapp")
    
    Returns:
        True si se guardó correctamente
    """
    try:
        timestamp = datetime.now(_get_timezone())
        
        # Referencia al documento del usuario
        user_ref = db.collection("chats").document(telefono)
        
        # Actualizamos metadatos
        user_ref.set({
            "last_interaction": timestamp,
            "phone": telefono
        }, merge=True)

        # Construir datos del mensaje
        message_data = {
            "role": role,
            "parts": [{"text": contenido if contenido else ""}],
            "timestamp": timestamp,
            "type": msg_type
        }
        
        # Agregar URL de imagen si existe
        if image_url:
            message_data["image_url"] = image_url
        
        # Agregar source si existe (para identificar origen del mensaje)
        if source:
            message_data["source"] = source

        # Guardamos el mensaje
        user_ref.collection("messages").add(message_data)
        return True
    except Exception as e:
        logger.error(f"Error guardando mensaje en Firebase: {e}")
        return False


def get_history(telefono: str, limit: int = None) -> list:
    """
    Recupera el historial de mensajes del usuario.
    
    Args:
        telefono: Número de teléfono
        limit: Número máximo de mensajes (default: settings.history_limit)
    
    Returns:
        Lista de mensajes en formato Gemini
    """
    if limit is None:
        limit = settings.history_limit
    
    try:
        # Usamos order_by descendente + limit + get() para evitar error de streaming
        docs = db.collection("chats").document(telefono)\
                 .collection("messages")\
                 .order_by("timestamp", direction=firestore.Query.DESCENDING)\
                 .limit(limit)\
                 .get()
        
        historial = []
        for doc in docs:
            data = doc.to_dict()
            role = data["role"]
            
            # Gemini solo acepta "user" o "model"
            # Filtrar roles inválidos como "dashboard"
            if role == "dashboard":
                continue  # Ignorar mensajes del dashboard
            elif role == "assistant":
                role = "model"  # Mapear assistant a model
            elif role not in ["user", "model"]:
                continue  # Ignorar cualquier otro rol inválido
            
            historial.append({
                "role": role,
                "parts": data["parts"]
            })
        
        # Invertimos para tener orden cronológico
        historial.reverse()
        return historial
    except Exception as e:
        logger.error(f"Error leyendo historial de Firebase: {e}")
        return []


def save_reservation(datos_reserva: dict) -> str:
    """
    Guarda una reserva en Firebase.
    
    Args:
        datos_reserva: Diccionario con datos de la reserva
    
    Returns:
        ID del documento creado o "error_db" si falla
    """
    try:
        datos_reserva["created_at"] = datetime.now(_get_timezone())
        reserva_ref = db.collection("reservas").add(datos_reserva)
        return reserva_ref[1].id
    except Exception as e:
        logger.error(f"Error guardando reserva: {e}")
        return "error_db"


def get_user_reservations(telefono: str, limit: int = 5) -> list:
    """
    Obtiene las reservas pasadas de un usuario por su teléfono.
    
    Args:
        telefono: Número de teléfono del usuario
        limit: Número máximo de reservas a retornar
    
    Returns:
        Lista de reservas con datos resumidos
    """
    try:
        reservas = []
        docs = db.collection("reservas")\
            .where("cliente_telefono", "==", telefono)\
            .order_by("created_at", direction=firestore.Query.DESCENDING)\
            .limit(limit)\
            .stream()
        
        for doc in docs:
            data = doc.to_dict()
            reservas.append({
                "codigo": data.get("codigo_reserva", "N/A"),
                "cabana": data.get("cabana", "Desconocida"),
                "fecha_inicio": data.get("fecha_inicio", ""),
                "fecha_fin": data.get("fecha_fin", ""),
                "estado": data.get("estado", "PENDIENTE")
            })
        
        logger.info(f"📋 Reservas encontradas para {telefono}: {len(reservas)}")
        return reservas
    except Exception as e:
        logger.error(f"Error obteniendo reservas del usuario: {e}")
        return []


# --- FUNCIONES DE ESTADO (Para slot filling mejorado - Fase 3) ---

def get_conversation_state(telefono: str) -> dict:
    """Obtiene el estado actual de la conversación (slots, intent, etc.)"""
    try:
        doc = db.collection("chats").document(telefono).get()
        if doc.exists:
            data = doc.to_dict()
            return data.get("state", {})
        return {}
    except Exception as e:
        logger.error(f"Error leyendo estado: {e}")
        return {}


def get_bot_settings() -> dict:
    """
    Obtiene la configuración dinámica del bot desde Firestore.
    Retorna un diccionario con defaults si no existe.
    """
    defaults = {
        # Configuración básica
        "botName": "Asistente de Reservas",
        "tone": "profesional",
        "responseStyle": "conciso",
        "customInstructions": "",
        
        # Nuevos campos
        "language": "es",
        "greeting": "¡Hola! 👋 Soy {botName}, tu asistente de reservas. ¿En qué puedo ayudarte?",
        "farewell": "¡Gracias por contactarnos! Fue un gusto atenderte.",
        "unavailableMessage": "Lo siento, no hay disponibilidad para esas fechas. ¿Te gustaría probar con otras fechas?",
        "maxResponseLength": 500,
        "useEmojis": True,
        "mentionPrices": True,
        "collectClientInfo": True,
        
        # Modo avanzado
        "useAdvancedMode": False,
        "systemPrompt": ""
    }
    
    try:
        doc = db.collection("config").document("bot_settings").get()
        if doc.exists:
            data = doc.to_dict()
            # Merge con defaults para asegurar que existan todas las keys
            merged = {**defaults, **data}
            logger.info(f"⚙️ Bot settings cargados: tone={merged.get('tone')}, advancedMode={merged.get('useAdvancedMode')}")
            return merged
        return defaults
    except Exception as e:
        logger.error(f"Error leyendo configuración del bot: {e}")
        return defaults


def is_agent_paused(telefono: str) -> bool:
    """
    Verifica si el agente está pausado para este usuario.
    Maneja booleanos y strings ('true'/'false').
    """
    try:
        logger.info(f"🔍 Buscando documento: chats/{telefono}")
        doc = db.collection("chats").document(telefono).get()
        
        if doc.exists:
            data = doc.to_dict()
            val = data.get("agentePausado", False)
            logger.info(f"🔍 Documento encontrado. agentePausado = {val} (tipo: {type(val).__name__})")
            
            # Manejo robusto de tipos
            if isinstance(val, bool):
                return val
            if isinstance(val, str):
                return val.lower() == "true"
            return bool(val)
        
        logger.info(f"🔍 Documento chats/{telefono} NO existe")
        return False
    except Exception as e:
        logger.error(f"Error verificando estado de pausa: {e}")
        return False
