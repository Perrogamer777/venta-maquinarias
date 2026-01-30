"""
Servicio de Firebase para almacenamiento de conversaciones.
"""
import logging
from datetime import datetime
import firebase_admin
from firebase_admin import credentials, firestore

logger = logging.getLogger(__name__)

from app.core.config import settings

# Inicializar Firebase (solo una vez)
if not firebase_admin._apps:
    # Forzar el uso del proyecto configurado 'venta-maquinarias-2627e'
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {
        'projectId': settings.GCP_PROJECT_ID,
    })

# Obtener cliente (usa la app inicializada arriba por defecto)
db = firestore.client()


def save_message_firestore(phone: str, role: str, content: str, msg_type: str = "text", media_url: str = None) -> None:
    """Guarda un mensaje en Firestore"""
    try:
        now = datetime.now()
        
        # IMPORTANTE: Crear/actualizar el documento del chat PRIMERO
        chat_ref = db.collection("chats").document(phone)
        chat_ref.set({
            "last_interaction": now,
            "phone": phone,
            "agentePausado": False,
            "unread": role == "user"
        }, merge=True)
        
        # Datos del mensaje
        msg_data = {
            "role": role,
            "content": content or "",
            "timestamp": now.isoformat(),
            "type": msg_type
        }
        
        if media_url:
            msg_data["media_url"] = media_url
            msg_data["image_url"] = media_url # Retrocompatibilidad frontend
            
        # Structure for Vertex AI (text only)
        if content:
            msg_data["parts"] = [{"text": content}]
        
        # Ahora guardar el mensaje en la subcolección
        chat_ref.collection("messages").add(msg_data)
        
        logger.info(f"💾 Mensaje guardado: {phone} - {role} ({msg_type})")
    except Exception as e:
        logger.error(f"Error guardando mensaje: {e}")


def get_chat_history_firestore(phone: str, limit: int = 50) -> list:
    """Obtiene el historial del chat"""
    try:
        messages = []
        docs = (
            db.collection("chats")
            .document(phone)
            .collection("messages")
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )
        
        for doc in docs:
            data = doc.to_dict()
            content = data.get("content")
            
            # Fallback para mensajes antiguos guardados solo en parts
            if not content and data.get("parts"):
                try:
                    content = data["parts"][0]["text"]
                except (IndexError, KeyError):
                    content = ""
            
            messages.append({
                "role": data.get("role"),
                "content": content
            })
        
        return list(reversed(messages))
    except Exception as e:
        logger.error(f"Error obteniendo historial: {e}")
        return []


def schedule_meeting(phone: str, client_email: str, meeting_time: str, meeting_type: str = "videollamada") -> bool:
    """
    Agenda una reunión con una persona real.
    
    Args:
        phone: Teléfono del cliente (WhatsApp)
        client_email: Email del cliente
        meeting_time: Horario preferido para la reunión (ej: "mañana 3pm", "viernes 10am", "martes 14:30")
        meeting_type: Tipo de reunión ("videollamada" o "llamada telefónica")
    """
    try:
        from datetime import datetime, timedelta, timezone
        import re
        
        # Chile está en UTC-3
        chile_tz = timezone(timedelta(hours=-3))
        now = datetime.now(chile_tz)
        scheduled_at = now  # Default to now if parsing fails
        
        # Intentar parsear el horario
        meeting_time_lower = meeting_time.lower().strip()
        
        # Extraer la hora (formatos: 14:30, 3pm, 15:00, 10am, 14hrs, etc.)
        hour = 10  # Default
        minute = 0
        
        # Buscar formato HH:MM (ej: 14:30, 9:45)
        time_match = re.search(r'(\d{1,2}):(\d{2})', meeting_time_lower)
        if time_match:
            hour = int(time_match.group(1))
            minute = int(time_match.group(2))
        else:
            # Buscar formato número solo (ej: 14hrs, 14, 3pm, 10am)
            ampm_match = re.search(r'(\d{1,2})\s*(hrs?|am|pm)?', meeting_time_lower)
            if ampm_match:
                hour = int(ampm_match.group(1))
                suffix = ampm_match.group(2) or ''
                
                # Si tiene 'hrs' o 'hr', es formato 24 horas (no convertir)
                if 'hr' in suffix:
                    # Ya es formato 24h, no hacer nada
                    pass
                elif 'pm' in suffix and hour < 12:
                    hour += 12
                elif 'am' in suffix and hour == 12:
                    hour = 0
                # Si no tiene sufijo y es <= 12, asumir PM si es >= 1
                elif not suffix and 1 <= hour <= 7:
                    # Horarios entre 1-7 sin sufijo probablemente son PM
                    hour += 12
        
        # Determinar el día
        days_offset = 0
        
        dias_semana = {
            'lunes': 0, 'martes': 1, 'miercoles': 2, 'miércoles': 2,
            'jueves': 3, 'viernes': 4, 'sabado': 5, 'sábado': 5, 'domingo': 6
        }
        
        if 'mañana' in meeting_time_lower or 'manana' in meeting_time_lower:
            days_offset = 1
        elif 'pasado mañana' in meeting_time_lower or 'pasado manana' in meeting_time_lower:
            days_offset = 2
        elif 'hoy' in meeting_time_lower:
            days_offset = 0
        else:
            # Buscar día de la semana
            for dia, dia_num in dias_semana.items():
                if dia in meeting_time_lower:
                    current_weekday = now.weekday()
                    days_offset = (dia_num - current_weekday) % 7
                    if days_offset == 0:
                        days_offset = 7  # Siguiente semana si es el mismo día
                    break
        
        # Calcular fecha final
        target_date = now + timedelta(days=days_offset)
        scheduled_at = target_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
        
        # Validación: No permitir agendar en horarios que ya pasaron
        if scheduled_at <= now:
            # Si es hoy y ya pasó, intentar mover al día siguiente
            if days_offset == 0:
                scheduled_at += timedelta(days=1)
                logger.warning(f"⚠️ Hora {meeting_time} ya pasó hoy, moviendo a mañana: {scheduled_at.strftime('%Y-%m-%d %H:%M')}")
            else:
                # Si es un día específico y ya pasó, es un error
                logger.error(f"❌ No se puede agendar reunión en el pasado: {meeting_time} → {scheduled_at.strftime('%Y-%m-%d %H:%M')}")
                return False
        
        meeting_ref = db.collection("meetings").document()
        
        # Convertir a UTC para guardar correctamente
        # scheduled_at está en timezone de Chile (UTC-3), convertir a UTC
        scheduled_at_utc = scheduled_at.astimezone(timezone.utc)
        
        meeting_data = {
            "phone": phone,
            "email": client_email,
            "preferred_time": meeting_time,  # Texto original del cliente
            "scheduled_at": scheduled_at_utc.replace(tzinfo=None),    # Guardar en UTC sin timezone
            "type": meeting_type,
            "status": "pendiente",
            "created_at": datetime.now(timezone.utc).replace(tzinfo=None),
            "notes": ""
        }
        
        meeting_ref.set(meeting_data)
        
        logger.info(f"📅 Reunión agendada: {phone} - {meeting_time} → {scheduled_at.strftime('%Y-%m-%d %H:%M')} Chile ({scheduled_at_utc.strftime('%Y-%m-%d %H:%M')} UTC) ({meeting_type})")
        return True
        
    except Exception as e:
        logger.error(f"Error agendando reunión: {e}")
        return False


def get_all_meetings(status_filter: str = None, limit: int = 100) -> list:
    """
    Obtiene todas las reuniones programadas.
    
    Args:
        status_filter: Filtrar por estado (pendiente, confirmada, completada, cancelada)
        limit: Número máximo de reuniones a retornar
    """
    try:
        query = db.collection("meetings").order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit)
        
        if status_filter:
            query = query.where("status", "==", status_filter)
        
        meetings = []
        for doc in query.stream():
            meeting_data = doc.to_dict()
            meeting_data["id"] = doc.id
            
            # Convert datetime to ISO string for JSON serialization
            if "created_at" in meeting_data and meeting_data["created_at"]:
                if hasattr(meeting_data["created_at"], 'isoformat'):
                    meeting_data["created_at"] = meeting_data["created_at"].isoformat()
                elif hasattr(meeting_data["created_at"], 'timestamp'):
                    # Firestore Timestamp
                    meeting_data["created_at"] = meeting_data["created_at"].isoformat()
            
            if "scheduled_at" in meeting_data and meeting_data["scheduled_at"]:
                if hasattr(meeting_data["scheduled_at"], 'isoformat'):
                    meeting_data["scheduled_at"] = meeting_data["scheduled_at"].isoformat()
                elif hasattr(meeting_data["scheduled_at"], 'timestamp'):
                    # Firestore Timestamp
                    meeting_data["scheduled_at"] = meeting_data["scheduled_at"].isoformat()
            
            meetings.append(meeting_data)
        
        return meetings
    except Exception as e:
        logger.error(f"Error obteniendo reuniones: {e}")
        return []


def get_meeting_by_id(meeting_id: str) -> dict:
    """Obtiene una reunión específica por ID."""
    try:
        doc = db.collection("meetings").document(meeting_id).get()
        
        if doc.exists:
            meeting_data = doc.to_dict()
            meeting_data["id"] = doc.id
            
            # Convert datetime to ISO string
            if "created_at" in meeting_data and meeting_data["created_at"]:
                if hasattr(meeting_data["created_at"], 'isoformat'):
                    meeting_data["created_at"] = meeting_data["created_at"].isoformat()
                elif hasattr(meeting_data["created_at"], 'timestamp'):
                    meeting_data["created_at"] = meeting_data["created_at"].isoformat()
            
            if "scheduled_at" in meeting_data and meeting_data["scheduled_at"]:
                if hasattr(meeting_data["scheduled_at"], 'isoformat'):
                    meeting_data["scheduled_at"] = meeting_data["scheduled_at"].isoformat()
                elif hasattr(meeting_data["scheduled_at"], 'timestamp'):
                    meeting_data["scheduled_at"] = meeting_data["scheduled_at"].isoformat()
            
            return meeting_data
        return None
    except Exception as e:
        logger.error(f"Error obteniendo reunión {meeting_id}: {e}")
        return None


def update_meeting_status(meeting_id: str, new_status: str) -> bool:
    """
    Actualiza el estado de una reunión.
    
    Args:
        meeting_id: ID de la reunión
        new_status: Nuevo estado (pendiente, confirmada, completada, cancelada)
    """
    try:
        db.collection("meetings").document(meeting_id).update({
            "status": new_status
        })
        
        logger.info(f"📅 Estado de reunión {meeting_id} actualizado a: {new_status}")
        return True
    except Exception as e:
        logger.error(f"Error actualizando estado de reunión: {e}")
        return False


def add_meeting_notes(meeting_id: str, notes: str) -> bool:
    """
    Agrega o actualiza notas en una reunión.
    
    Args:
        meeting_id: ID de la reunión
        notes: Notas a agregar
    """
    try:
        db.collection("meetings").document(meeting_id).update({
            "notes": notes
        })
        
        logger.info(f"📝 Notas agregadas a reunión {meeting_id}")
        return True
    except Exception as e:
        logger.error(f"Error agregando notas: {e}")
        return False
