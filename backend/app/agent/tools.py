"""
Definición de herramientas (tools) para el agente.
Cada tool tiene su declaración para Gemini y su función ejecutora.
"""
from vertexai.generative_models import Tool, FunctionDeclaration


# --- DECLARACIONES DE FUNCIONES PARA GEMINI ---

f_check_availability = FunctionDeclaration(
    name="check_availability",
    description="Consulta disponibilidad y precios exactos para fechas específicas. Devuelve todas las cabañas disponibles con precios.",
    parameters={
        "type": "object",
        "properties": {
            "fecha_inicio": {
                "type": "string", 
                "description": "Fecha de llegada en formato DD/MM/YYYY"
            },
            "fecha_fin": {
                "type": "string", 
                "description": "Fecha de salida en formato DD/MM/YYYY"
            },
            "num_personas": {
                "type": "integer", 
                "description": "Número de huéspedes (opcional, para recomendar cabañas)"
            }
        },
        "required": ["fecha_inicio", "fecha_fin"]
    },
)

f_get_cabin_info = FunctionDeclaration(
    name="get_cabin_info",
    description="Obtiene detalles, amenidades, fotos y descripción de una cabaña específica. Usa cuando el usuario pregunte por características de una cabaña.",
    parameters={
        "type": "object",
        "properties": {
            "nombre_cabana_query": {
                "type": "string", 
                "description": "Nombre o referencia de la cabaña (ej: 'domo', 'laurel', 'familiar')"
            }
        },
        "required": ["nombre_cabana_query"]
    },
)

f_crear_pre_reserva = FunctionDeclaration(
    name="crear_pre_reserva",
    description="Genera una pre-reserva formal en el sistema. SOLO usar cuando tengas TODOS los datos requeridos: cabaña, fechas, nombre y email del cliente.",
    parameters={
        "type": "object",
        "properties": {
            "nombre_cabana": {
                "type": "string", 
                "description": "Nombre exacto de la cabaña a reservar"
            },
            "fecha_inicio": {
                "type": "string", 
                "description": "Fecha de llegada DD/MM/YYYY"
            },
            "fecha_fin": {
                "type": "string", 
                "description": "Fecha de salida DD/MM/YYYY"
            },
            "nombre_cliente": {
                "type": "string", 
                "description": "Nombre completo del huésped titular"
            },
            "email_cliente": {
                "type": "string", 
                "description": "Email del huésped para enviar confirmación"
            }
        },
        "required": ["nombre_cabana", "fecha_inicio", "fecha_fin", "nombre_cliente", "email_cliente"]
    },
)

f_get_cabin_services = FunctionDeclaration(
    name="get_cabin_services",
    description="Obtiene los servicios adicionales disponibles para una cabaña específica (tinaja, sauna, mascotas, etc.). Usa después de que el usuario elija una cabaña para ofrecer extras.",
    parameters={
        "type": "object",
        "properties": {
            "nombre_cabana_query": {
                "type": "string", 
                "description": "Nombre o referencia de la cabaña (ej: 'laurel', 'yurta', 'castaño')"
            }
        },
        "required": ["nombre_cabana_query"]
    },
)


def get_agent_tools() -> Tool:
    """Retorna el objeto Tool con todas las funciones registradas."""
    return Tool(
        function_declarations=[
            f_check_availability,
            f_get_cabin_info,
            f_crear_pre_reserva,
            f_get_cabin_services,
        ]
    )


# --- EJECUTORES DE HERRAMIENTAS ---

def execute_tool(tool_name: str, args: dict, context: dict = None) -> str:
    """
    Router central para ejecutar herramientas.
    
    Args:
        tool_name: Nombre de la herramienta a ejecutar
        args: Argumentos de la herramienta (de Gemini)
        context: Contexto adicional (telefono, etc.)
    
    Returns:
        Resultado como string para enviar de vuelta a Gemini
    """
    # Importamos aquí para evitar imports circulares
    from app.services.wubook import check_availability, get_cabin_info, get_cabin_url, crear_pre_reserva
    from app.services.whatsapp import send_image
    
    try:
        if tool_name == "check_availability":
            fecha_inicio = args.get("fecha_inicio")
            fecha_fin = args.get("fecha_fin")
            
            if not fecha_inicio or not fecha_fin:
                return "Error: Necesito fecha de llegada y salida para consultar disponibilidad."
            
            num_personas = args.get("num_personas")
            return check_availability(fecha_inicio, fecha_fin, num_personas)
        
        elif tool_name == "get_cabin_info":
            nombre_cabana = args.get("nombre_cabana_query")
            if not nombre_cabana:
                return "Error: Necesito el nombre de la cabaña para buscar información."
            
            # Importar funciones necesarias
            from app.services.wubook import get_cabin_data, get_cabin_info
            from app.services.whatsapp import send_text, send_image_with_caption
            
            # Obtener datos completos de la cabaña
            cabin_data = get_cabin_data(nombre_cabana)
            
            if cabin_data and context and context.get("telefono"):
                telefono = context["telefono"]
                nombre = cabin_data.get("nombre", nombre_cabana)
                capacidad = cabin_data.get("capacidad", "")
                imagenes = cabin_data.get("imagenes", [])
                
                # Limitar a máximo 3 fotos para no saturar
                max_fotos = min(len(imagenes), 3)
                
                # Enviar las fotos con descripción
                for i in range(max_fotos):
                    url_foto = imagenes[i]
                    
                    # Solo la primera foto lleva caption descriptivo
                    if i == 0:
                        caption = f"📸 {nombre}\n👥 Capacidad: {capacidad}"
                    else:
                        caption = ""
                    
                    send_image_with_caption(telefono, url_foto, caption)
            
            return get_cabin_info(nombre_cabana)
        
        elif tool_name == "crear_pre_reserva":
            required = ["nombre_cabana", "fecha_inicio", "fecha_fin", "nombre_cliente", "email_cliente"]
            missing = [k for k in required if k not in args or not args[k]]
            
            if missing:
                return f"Error: Faltan datos para la reserva: {', '.join(missing)}. Pregunta al usuario."
            
            return crear_pre_reserva(
                args["nombre_cabana"],
                args["fecha_inicio"],
                args["fecha_fin"],
                args["nombre_cliente"],
                args["email_cliente"],
                telefono_cliente=context.get("telefono") if context else None
            )
        
        elif tool_name == "get_cabin_services":
            nombre_cabana = args.get("nombre_cabana_query")
            if not nombre_cabana:
                return "Error: Necesito el nombre de la cabaña para buscar servicios."
            
            from app.services.wubook import get_cabin_services_text
            return get_cabin_services_text(nombre_cabana)
        
        else:
            return f"Error: Herramienta '{tool_name}' no reconocida."
    
    except Exception as e:
        return f"Error ejecutando {tool_name}: {str(e)}"
