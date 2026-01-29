"""
API endpoint para verificar y enviar recordatorios automáticos.
Diseñado para ser llamado por Cloud Scheduler cada 5 minutos.
"""
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Request

from app.services.firebase import db, save_message_firestore
from app.services.whatsapp import send_message
from app.services.settings import get_bot_settings

logger = logging.getLogger(__name__)

router = APIRouter()


def get_chats_pending_reminder(minutes_threshold: int) -> list:
    """
    Obtiene chats donde:
    - El último mensaje fue del assistant (bot)
    - Han pasado más de X minutos sin respuesta del cliente
    - No se ha enviado recordatorio aún
    - El agente no está pausado
    """
    pending_chats = []
    threshold_time = datetime.utcnow() - timedelta(minutes=minutes_threshold)
    
    try:
        # Obtener todos los chats
        chats_ref = db.collection('chats').stream()
        
        for chat_doc in chats_ref:
            chat_data = chat_doc.to_dict()
            phone = chat_doc.id
            
            # Ignorar si el agente está pausado
            if chat_data.get('agentePausado', False) or chat_data.get('agent_paused', False):
                continue
            
            # Ignorar si ya se envió recordatorio
            if chat_data.get('reminderSent', False):
                continue
            
            # Obtener último mensaje
            messages_ref = (
                db.collection('chats')
                .document(phone)
                .collection('messages')
                .order_by('timestamp', direction='DESCENDING')
                .limit(1)
            )
            
            last_msg_docs = list(messages_ref.stream())
            
            if not last_msg_docs:
                continue
                
            last_msg = last_msg_docs[0].to_dict()
            
            # Solo si el último mensaje fue del assistant/model
            if last_msg.get('role') not in ['assistant', 'model']:
                continue
            
            # Verificar tiempo transcurrido
            timestamp = last_msg.get('timestamp')
            if not timestamp:
                continue
                
            # Parsear timestamp (puede ser string ISO o datetime)
            if isinstance(timestamp, str):
                try:
                    msg_time = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                    # Convertir a UTC naive para comparar
                    msg_time = msg_time.replace(tzinfo=None)
                except:
                    continue
            elif hasattr(timestamp, 'timestamp'):
                # Es un Timestamp de Firestore
                msg_time = datetime.utcfromtimestamp(timestamp.timestamp())
            else:
                continue
            
            # Si han pasado suficientes minutos
            if msg_time < threshold_time:
                pending_chats.append({
                    'phone': phone,
                    'last_message_time': msg_time,
                    'minutes_waiting': int((datetime.utcnow() - msg_time).total_seconds() / 60)
                })
                
    except Exception as e:
        logger.error(f"Error obteniendo chats pendientes: {e}")
    
    return pending_chats


@router.post("/check-reminders")
async def check_and_send_reminders(request: Request = None):
    """
    Endpoint para ser llamado por Cloud Scheduler.
    Verifica chats sin respuesta y envía recordatorios.
    """
    logger.info("⏰ Iniciando verificación de recordatorios...")
    
    # Obtener configuración
    settings = get_bot_settings()
    
    if not settings.get('enableReminders', False):
        logger.info("📴 Recordatorios desactivados en configuración")
        return {
            "success": True,
            "message": "Reminders disabled",
            "sent": 0
        }
    
    minutes = settings.get('reminderTimeMinutes', 30)
    reminder_message = settings.get('reminderMessage', '¿Sigues interesado? Estoy aquí para ayudarte. 🚜')
    
    logger.info(f"⚙️ Config: {minutes} minutos, mensaje: {reminder_message[:50]}...")
    
    # Obtener chats pendientes
    pending = get_chats_pending_reminder(minutes)
    logger.info(f"📋 Encontrados {len(pending)} chats pendientes de recordatorio")
    
    sent_count = 0
    failed_count = 0
    
    for chat in pending:
        phone = chat['phone']
        try:
            # Enviar recordatorio
            success = send_message(phone, reminder_message)
            
            if success:
                # Guardar mensaje en historial
                save_message_firestore(phone, "assistant", f"⏰ {reminder_message}")
                
                # Marcar que se envió recordatorio para no duplicar
                db.collection('chats').document(phone).update({
                    'reminderSent': True,
                    'reminderSentAt': datetime.utcnow()
                })
                
                sent_count += 1
                logger.info(f"✅ Recordatorio enviado a {phone} (esperando {chat['minutes_waiting']} min)")
            else:
                failed_count += 1
                logger.error(f"❌ Error enviando recordatorio a {phone}")
                
        except Exception as e:
            failed_count += 1
            logger.error(f"❌ Excepción enviando a {phone}: {e}")
    
    result = {
        "success": True,
        "checked": len(pending),
        "sent": sent_count,
        "failed": failed_count,
        "config": {
            "minutes": minutes,
            "enabled": True
        }
    }
    
    logger.info(f"⏰ Verificación completada: {sent_count} enviados, {failed_count} fallidos")
    
    return result


@router.post("/reset-reminder/{phone}")
async def reset_reminder_flag(phone: str):
    """
    Resetea el flag de recordatorio cuando el cliente responde.
    Debe llamarse cuando llega un mensaje del usuario.
    """
    try:
        db.collection('chats').document(phone).update({
            'reminderSent': False
        })
        return {"success": True, "phone": phone}
    except Exception as e:
        logger.error(f"Error reseteando reminder flag: {e}")
        return {"success": False, "error": str(e)}
