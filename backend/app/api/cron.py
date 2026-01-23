"""
Endpoints para tareas programadas (Cron Jobs).
Requiere configuración en Cloud Scheduler.
"""
import logging
from datetime import datetime, timedelta
import zoneinfo
from fastapi import APIRouter
from google.cloud import firestore

from app.config import settings
from app.services.firebase import db
from app.services.whatsapp import send_text

logger = logging.getLogger(__name__)

router = APIRouter()

def _get_timezone():
    """Obtiene la zona horaria configurada."""
    try:
        return zoneinfo.ZoneInfo(settings.timezone)
    except:
        return zoneinfo.ZoneInfo("UTC")

@router.post("/api/cron/follow-up-abandoned")
async def follow_up_abandoned_reservations():
    """
    Cron Job: Revisa conversaciones abandonadas con potencial de venta.
    
    Lógica:
    1. Busca chats con 'valorPotencial' (intención de reserva detectada)
    2. Filtrar por inactividad: última interacción > 2 horas y < 24 horas
    3. Verificar que no se haya enviado seguimiento ('followUpSent' != true)
    4. Enviar mensaje de reactivación
    """
    logger.info("⏰ Ejecutando Cron: Seguimiento de carritos abandonados")
    
    tz = _get_timezone()
    now = datetime.now(tz)
    
    # Ventana de tiempo: Chats inactivos entre 2 y 24 horas
    time_limit_start = now - timedelta(hours=2)
    time_limit_end = now - timedelta(hours=24)
    
    try:
        # Nota: Para consultas complejas en Firestore se requieren índices compuestos.
        # Estrategia simplificada: Traer chats recientes y filtrar en memoria 
        # para evitar errores de índices faltantes en esta etapa.
        
        # Obtenemos chats actualizados en las últimas 24 horas
        # Usamos 'lastMessageAt' o 'last_interaction' dependiendo de cuál uses consistentemente
        # En firebase.py usa 'last_interaction', en promotions.py usa 'lastMessageAt'
        # Consultaremos ambos o el más reciente.
        
        # En tu código actual de valor_potencial.py se actualiza 'valorPotencial', 
        # pero no explícitamente el timestamp principal del chat en todos los casos.
        # Asumiremos que save_message actualiza 'last_interaction'.
        
        # Optimización: Buscar chats donde existe 'valorPotencial'
        # (Esto requeriría que todos tengan ese campo o usar un índice)
        
        # Enfoque robusto sin índices complejos:
        # 1. Listar documentos de 'chats'
        # 2. Filtrar en código
        
        processed_count = 0
        sent_count = 0
        
        docs = db.collection('chats').stream()
        
        for doc in docs:
            data = doc.to_dict()
            chat_id = doc.id
            processed_count += 1
            
            # 1. Verificar si tiene valor potencial (intención de reserva)
            valor_potencial = data.get('valorPotencial')
            if not valor_potencial:
                continue
                
            # 2. Verificar inactividad (entre 2 y 24 horas)
            # Intentar obtener timestamp de varias fuentes posibles
            last_activity = data.get('last_interaction') or data.get('lastMessageAt') or data.get('timestamp')
            
            if not last_activity:
                continue
            
            # Convertir a datetime con zona horaria si es necesario
            if isinstance(last_activity, str):
                try:
                    last_activity = datetime.fromisoformat(last_activity.replace('Z', '+00:00'))
                except:
                    continue
            
            # Asegurar zona horaria
            if last_activity.tzinfo is None:
                last_activity = last_activity.replace(tzinfo=tz)
            else:
                last_activity = last_activity.astimezone(tz)
                
            # Verificar ventana de tiempo (inactivo hace más de 2h pero menos de 24h)
            if last_activity > time_limit_start:
                # Muy reciente (< 2 horas), el usuario podría seguir hablando
                continue
                
            if last_activity < time_limit_end:
                # Muy antiguo (> 24 horas), ya pasó el momento
                continue
                
            # 3. Verificar si ya se envió seguimiento
            if data.get('followUpSent', False):
                continue
                
            # 4. Verificar si el agente está en modo pausa (intervención humana)
            if data.get('agentePausado', False):
                continue
            
            # --- CANDIDATO ENCONTRADO ---
            
            cabana_nombre = valor_potencial.get('cabana', 'la cabaña')
            client_name = data.get('clientName', 'Hola')
            if client_name == 'Hola': client_name = '' # Ajuste estético
            
            # Mensaje amigable
            mensaje = f"Hola, noté que te interesó {cabana_nombre}. ¿Te gustaría retomar la reserva o tienes alguna duda que pueda resolver?"
            
            logger.info(f"Enviando seguimiento a {chat_id} por {cabana_nombre}")
            
            # Enviar mensaje
            # Importante: Usar send_text directamente para no gatillar loop infinito del bot
            response = send_text(chat_id, mensaje)
            
            if response:
                # 5. Marcar como enviado
                db.collection('chats').document(chat_id).update({
                    'followUpSent': True,
                    'followUpAt': firestore.SERVER_TIMESTAMP,
                    # También guardamos el mensaje en el historial para que se vea en el dashboard
                    # Lo hacemos manualmente para no activar el webhook del bot
                })
                
                # Guardar en subcolección messages para visibilidad
                msg_data = {
                    "role": "model",
                    "parts": [{"text": mensaje}],
                    "timestamp": datetime.now(tz),
                    "type": "text",
                    "source": "cron_followup"
                }
                db.collection('chats').document(chat_id).collection('messages').add(msg_data)
                
                sent_count += 1
            
        return {
            "status": "success",
            "processed": processed_count,
            "messages_sent": sent_count,
            "timestamp": now.isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error en cron de seguimiento: {e}", exc_info=True)
        return {"status": "error", "message": str(e)}
