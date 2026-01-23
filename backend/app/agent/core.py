"""
Core del agente IA - Lógica principal del procesamiento de mensajes.
"""
import logging
import zoneinfo
from datetime import datetime
import vertexai
from vertexai.generative_models import GenerativeModel, Content, Part

from app.config import settings
from app.agent.prompts import get_system_prompt
from app.agent.tools import get_agent_tools, execute_tool
from app.services.firebase import save_message, get_history, get_bot_settings
from app.services.whatsapp import send_text

logger = logging.getLogger(__name__)

# Inicializar Vertex AI
vertexai.init(project=settings.project_id, location=settings.location)


def _get_current_date() -> str:
    """Obtiene la fecha actual en zona horaria configurada."""
    try:
        tz = zoneinfo.ZoneInfo(settings.timezone)
    except:
        tz = zoneinfo.ZoneInfo("UTC")
    return datetime.now(tz).strftime("%d/%m/%Y (%A)")


def _convert_history_to_content(history_dicts: list) -> list[Content]:
    """Convierte historial de Firebase a objetos Content de Vertex AI."""
    content_objects = []
    for msg in history_dicts:
        try:
            text = msg["parts"][0]["text"]
            content_objects.append(
                Content(role=msg["role"], parts=[Part.from_text(text)])
            )
        except (KeyError, IndexError) as e:
            logger.warning(f"Error convirtiendo mensaje del historial: {e}")
            continue
    return content_objects


async def process_message(texto_usuario: str, telefono: str) -> None:
    """
    Procesa un mensaje entrante del usuario.
    
    Args:
        texto_usuario: Mensaje del usuario
        telefono: Número de teléfono del usuario
    """
    try:
        logger.info(f"📱 Procesando mensaje de: [{telefono}]")
        
        # 1. Guardar mensaje del usuario
        save_message(telefono, "user", texto_usuario)
        
        # 2. Obtener configuración dinámica y construir prompt
        bot_settings = get_bot_settings()
        system_instruction = get_system_prompt(bot_settings)
        
        # 3. Inicializar modelo con prompt dinámico
        # Se crea una nueva instancia por request para aplicar el prompt actualizado
        model = GenerativeModel(
            settings.model_name,
            system_instruction=[system_instruction],
            tools=[get_agent_tools()],
        )
        
        # 4. Obtener historial
        historial_dicts = get_history(telefono)
        history_objects = _convert_history_to_content(historial_dicts)
        
        # 4.5 Obtener reservas previas del usuario para contexto de memoria
        from app.services.firebase import get_user_reservations
        reservas_previas = get_user_reservations(telefono, limit=5)
        reservas_context = ""
        if reservas_previas:
            reservas_context = "\n[HISTORIAL DE RESERVAS DEL USUARIO:\n"
            for r in reservas_previas:
                reservas_context += f"  - {r['cabana']}: {r['fecha_inicio']} al {r['fecha_fin']} (Código: {r['codigo']}, Estado: {r['estado']})\n"
            reservas_context += "]\n"
        
        # 5. Crear chat con historial
        chat = model.start_chat(history=history_objects)
        
        # 6. Construir prompt con contexto de fecha y reservas previas
        hoy = _get_current_date()
        prompt = f"[SISTEMA: Hoy es {hoy}.]{reservas_context}[Usuario dice:] {texto_usuario}"
        
        # 7. Enviar mensaje y obtener respuesta
        try:
            response = chat.send_message(prompt)
        except Exception as e:
            logger.error(f"Error enviando mensaje a Gemini: {e}")
            send_text(telefono, "Lo siento, tengo problemas de conexión. ¿Podrías intentar de nuevo?")
            return
        
        # 8. Verificar respuesta válida
        if not response.candidates:
            logger.warning("Respuesta bloqueada por filtros de seguridad")
            send_text(telefono, "Lo siento, no puedo procesar ese mensaje.")
            return
        
        # 9. Loop de herramientas
        turnos = 0
        context = {"telefono": telefono}
        
        while response.candidates[0].function_calls and turnos < settings.max_tool_turns:
            turnos += 1
            function_calls = response.candidates[0].function_calls
            logger.info(f"Procesando {len(function_calls)} function call(s)")
            
            # Procesar TODAS las function calls en este turno
            function_response_parts = []
            for fc in function_calls:
                logger.info(f"Ejecutando herramienta: {fc.name}")
                resultado = execute_tool(fc.name, dict(fc.args), context)
                function_response_parts.append(
                    Part.from_function_response(
                        name=fc.name, 
                        response={"content": resultado}
                    )
                )
            
            # Enviar TODAS las respuestas en UN SOLO mensaje (requerido por Gemini)
            try:
                response = chat.send_message(function_response_parts)
            except Exception as e:
                logger.error(f"Error enviando resultado de tool: {e}")
                break
        
        # 10. Enviar respuesta final
        if response.candidates:
            try:
                # Intentar obtener texto (puede fallar si hay function calls pendientes)
                texto_respuesta = response.text
                save_message(telefono, "model", texto_respuesta)
                send_text(telefono, texto_respuesta)
            except ValueError as e:
                # Gemini no generó texto (posiblemente quedó en function calls)
                logger.warning(f"No se pudo obtener texto de respuesta: {e}")
                send_text(telefono, "Me trabé un poco con tu solicitud. ¿Podrías simplificarla o hacerla por partes?")
        else:
            send_text(telefono, "Me quedé pensando... ¿Podrías reformular tu pregunta?")
        
        # 11. Detectar y actualizar valor potencial
        try:
            from app.services.valor_potencial import (
                detectar_intencion_reserva, 
                actualizar_valor_potencial
            )
            
            valor_potencial = detectar_intencion_reserva(
                mensaje=texto_usuario,
                historial=historial_dicts
            )
            
            if valor_potencial:
                actualizar_valor_potencial(telefono, valor_potencial)
        except Exception as vp_error:
            logger.warning(f"Error en tracking de valor potencial: {vp_error}")
    
    except Exception as e:
        logger.error(f"Error procesando mensaje: {e}", exc_info=True)
        send_text(telefono, "Tuve un error técnico. ¿Me repites eso?")
