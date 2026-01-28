"""
Servicio del agente de IA con Gemini y Function Calling.
VERSION SIMPLIFICADA ANTI-LOOPS.
"""
import logging
import json
import re
import vertexai
from vertexai.generative_models import (
    GenerativeModel, 
    Tool, 
    FunctionDeclaration,
    GenerationConfig
)
from app.core.config import settings
from app.services.maquinarias import search_maquinarias, get_maquinaria
from app.services.quotation import generate_quotation_pdf, save_quotation_to_firestore

logger = logging.getLogger(__name__)

vertexai.init(location=settings.GCP_LOCATION)

SYSTEM_PROMPT = """
<role>
Eres un asesor comercial experto de MACI - Maquinaria Agrícola en Chile.
Tu objetivo es ayudar a los agricultores a encontrar la maquinaria perfecta, resolver dudas técnicas y generar cotizaciones formales.
</role>

<personality>
- Asesor de ventas empático, paciente y experto.
- **Venta Consultiva**: NO solo entregues precios. PREGUNTA para qué necesitan la máquina, qué cultivo tienen, o qué potencia tiene su tractor.
- Muestra interés genuino en el proyecto del agricultor.
- Usa emojis (🚜🌾💰✅) para dar calidez.
</personality>

<sales_strategy>
1. **Indaga**: Si el cliente pide algo genérico, haz UNA pregunta clave.
2. **ACTÚA**: En cuanto el cliente responda tu pregunta (ej: "frutas"), **BUSCA INMEDIATAMENTE** usando esa palabra clave. NO sigas preguntando.
3. **Cierre**: Siempre termina guiando al siguiente paso.
</sales_strategy>

<constraints>
- **CRÍTICO**: NUNCA respondas con frases de transición como "Déjame revisar".
- SIEMPRE ejecuta la herramienta de búsqueda INMEDIATAMENTE si necesitas información.
- **SOLO OFRECE LO QUE EXISTE**: Si no encuentras algo en el inventario, dilo claramente.
- **FORMATO**: Usa UN SOLO asterisco para negritas (ej: *producto*, NO **producto**). WhatsApp no usa doble asterisco.
- Si el cliente dice "Me interesa X", **NO VUELVAS A BUSCAR**. Usa `mostrar_imagenes_por_nombre` para dar detalles visuales.
- **CONTEXTO**: Si el usuario dice "ese", "lo quiero", "cotízalo", **ASUME** que habla del ÚLTIMO PRODUCTO que mostraste. NO preguntes el nombre de nuevo, **BÚSCALO EN EL HISTORIAL**.
</constraints>

<tools_usage>
1. `buscar_maquinaria`: Solo para búsquedas iniciales.
2. `mostrar_imagenes_por_nombre`: Úsala AUTOMÁTICAMENTE si el cliente muestra interés.
3. `generar_cotizacion`: Si el usuario da nombre/mail/teléfono, EXTRAE los datos y LLAMA A LA FUNCIÓN. Si falta algún dato, pide SOLO el que falta.
</tools_usage>

<examples>
Usuario: "Hola, qué tienen?"
Asistente: (Llamada a función `buscar_maquinaria(consulta="todas")`)

Usuario: "Frutas" (Respuesta a pregunta anterior)
Asistente: (Llamada a función `buscar_maquinaria(consulta="cosecha frutas")`)

Usuario: "Me interesa el carro comedor y el aljibe"
Asistente: (Llamada a función `mostrar_imagenes_por_nombre(nombres_productos=["Carro comedor movil", "Carro Aljibe"])`)

Usuario: "Cotízame esos dos. Soy Juan Perez, juan@mail.com, +5699999999"
Asistente: (Llamada a función `generar_cotizacion(nombres_productos=["Carro comedor movil", "Carro Aljibe"], cliente_nombre="Juan Perez", ...)`)
</examples>
"""

# Funciones
buscar_func = FunctionDeclaration(
    name="buscar_maquinaria",
    description="Busca productos. Usa 'todas' para catálogo completo.",
    parameters={
        "type": "object",
        "properties": {"consulta": {"type": "string"}},
        "required": ["consulta"]
    }
)

mostrar_imagenes_func = FunctionDeclaration(
    name="mostrar_imagenes_por_nombre",
    description="Muestra fotos de uno o VARIOS productos. Usa nombres exactos.",
    parameters={
        "type": "object",
        "properties": {
            "nombres_productos": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Lista de nombres de productos (ej: ['Carro A', 'Carro B'])"
            }
        },
        "required": ["nombres_productos"]
    }
)

cotizar_func = FunctionDeclaration(
    name="generar_cotizacion",
    description="Genera cotización para uno o Varios productos. Necesitas nombres y datos del cliente.",
    parameters={
        "type": "object",
        "properties": {
            "nombres_productos": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Lista de nombres de productos (ej: ['Carro A', 'Carro B'])"
            },
            "cliente_nombre": {"type": "string"},
            "cliente_email": {"type": "string"},
            "cliente_telefono": {"type": "string"}
        },
        "required": ["nombres_productos", "cliente_nombre", "cliente_email", "cliente_telefono"]
    }
)

tools = Tool(function_declarations=[buscar_func, mostrar_imagenes_func, cotizar_func])


def execute_func(name: str, args: dict) -> dict:
    """Ejecuta funciones."""
    logger.info(f"🔧 {name} → {args}")
    
    if name == "buscar_maquinaria":
        resultados = search_maquinarias(args.get("consulta", ""), limit=6)
        if resultados:
            return {"success": True, "productos": [
                {
                    "nombre": m["nombre"], 
                    "precio": m.get("precioReferencia", 0), 
                    "descripcion": m.get("descripcion", ""),
                    "ficha_tecnica_pdf": m.get("fichaTecnicaPdf", ""),
                    "id": m["id"]
                }
                for m in resultados
            ]}
        return {"success": False}
    
    elif name == "mostrar_imagenes_por_nombre":
        nombres = args.get("nombres_productos", [])
        if isinstance(nombres, str):
            nombres = [nombres]
        if not nombres and args.get("nombre_producto"):
            nombres = [args.get("nombre_producto")]
            
        items_encontrados = []
        for nombre in nombres:
            resultados = search_maquinarias(nombre, limit=1)
            if resultados:
                m = resultados[0]
                items_encontrados.append({
                    "nombre": m["nombre"],
                    "descripcion": m.get("descripcion", ""),
                    "imagenes": m.get("imagenes", []),
                    "ficha_tecnica_pdf": m.get("fichaTecnicaPdf", ""),
                    "id": m["id"]
                })
        
        if items_encontrados:
            return {"success": True, "items": items_encontrados}
            
        return {"success": False, "mensaje": "Sin imágenes o producto no encontrado"}
    
    elif name == "generar_cotizacion":
        nombres = args.get("nombres_productos", [])
        # Compatibilidad si el modelo alucina y manda string
        if isinstance(nombres, str):
            nombres = [nombres]
        # Compatibilidad old prompt
        if not nombres and args.get("nombre_producto"):
            nombres = [args.get("nombre_producto")]
            
        maquinarias_encontradas = []
        for nombre in nombres:
            res = search_maquinarias(nombre, limit=1)
            if res:
                maquinarias_encontradas.append(res[0])
        
        if not maquinarias_encontradas:
            return {"success": False, "mensaje": "No se encontraron los productos especificados"}
        
        # Calcular precio total referencia
        total = sum([m.get("precioReferencia", 0) for m in maquinarias_encontradas])
        
        pdf = generate_quotation_pdf(
            cliente_nombre=args["cliente_nombre"],
            cliente_email=args["cliente_email"],
            cliente_telefono=args["cliente_telefono"],
            maquinarias=maquinarias_encontradas
        )
        
        if pdf:
            save_quotation_to_firestore(
                codigo=pdf.split("/")[-1].replace(".pdf", ""),
                cliente_nombre=args["cliente_nombre"],
                cliente_email=args["cliente_email"],
                cliente_telefono=args["cliente_telefono"],
                maquinaria_ids=[m["id"] for m in maquinarias_encontradas],
                maquinaria_nombres=[m["nombre"] for m in maquinarias_encontradas],
                precio_total=total,
                pdf_url=pdf
            )
            return {
                "success": True,
                "pdf_url": pdf,
                "nombres": [m["nombre"] for m in maquinarias_encontradas],
                "precio_total": total
            }
        return {"success": False}
    
    return {"success": False}


def process_message(user_message: str, chat_history: list = None) -> dict:
    """Procesa mensaje."""
    try:
        model = GenerativeModel("gemini-2.5-flash", system_instruction=[SYSTEM_PROMPT], tools=[tools])
        
        history = ""
        if chat_history:
            for msg in chat_history[-40:]:
                role = "Usuario" if msg["role"] == "user" else "Asistente"
                history += f"{role}: {msg['content']}\n"
        
        prompt = f"HISTORIAL:\n{history}\n\nMENSAJE: {user_message}"
        response = model.generate_content(prompt, generation_config=GenerationConfig(temperature=0.3))
        
        result = {"text": "", "images": [], "documents": []}
        
        for candidate in response.candidates:
            for part in candidate.content.parts:
                if hasattr(part, 'text') and part.text:
                    result["text"] += part.text
                
                elif hasattr(part, 'function_call') and part.function_call:
                    fc = part.function_call
                    fr = execute_func(fc.name, dict(fc.args))
                    
                    if fc.name == "buscar_maquinaria":
                        if fr.get("success"):
                            productos = fr["productos"]
                            lista = []
                            for i, p in enumerate(productos, 1):
                                precio = f"${p['precio']:,.0f}".replace(",", ".") if p['precio'] else "Consultar"
                                desc = p['descripcion'] if p['descripcion'] else "Consulta por más detalles"
                                
                                # Formato mejorado con bullets (WhatsApp compatible)
                                item = f"{i}. *{p['nombre']}*\n"
                                item += f"   💰 Precio: {precio} + IVA\n"
                                if desc and len(desc) > 10:
                                    item += f"   📝 {desc}\n"
                                if p.get('ficha_tecnica_pdf'):
                                    item += f"   📋 Con ficha técnica disponible\n"
                            
                                lista.append(item)
                            
                            intro = "🚜 *Nuestro Catálogo de Maquinaria*\n\n" if len(productos) > 5 else "🚜 *Productos Disponibles*\n\n"
                            
                            footer = "\n\n💬 ¿Te interesa ver fotos o detalles de alguno? Dime cuál."
                            if len(productos) >= 6:
                                footer = "\n\n📢 *Mostrando los primeros productos. Dime qué buscas para ver más.*" + footer
                                
                            result["text"] = intro + "\n".join(lista) + footer
                        else:
                            # Fallo la búsqueda exacta, usamos inteligencia del modelo para recuperar la venta
                            consulta = dict(fc.args).get("consulta", "lo que buscas")
                            prompt_fallback = (
                                f"Buscaste '{consulta}' en el inventario y NO hay resultados exactos.\n"
                                f"Como vendedor experto, NO digas solo 'no hay'.\n"
                                f"1. Dile que no tienes '{consulta}' exacto.\n"
                                f"2. Pregúntale qué labor agrícola necesita hacer (fumigar, cosechar, triturar, etc.).\n"
                                f"3. Ofrécele ver categorías generales (Nebulizadoras, Carros, Trituradoras, Tractores).\n"
                                f"Responde amable y proactivo, breve para WhatsApp."
                            )
                            try:
                                recovery = model.generate_content(prompt_fallback)
                                result["text"] = recovery.text
                            except:
                                result["text"] = "🧐 No encontré eso exactamente. ¿Podrías decirme qué labor agrícola necesitas realizar? (ej: fumigar, podar, acarrear). Así busco la mejor máquina para ti."

                    elif fc.name == "mostrar_imagenes_por_nombre":
                        if fr.get("success"):
                            items = fr.get("items", [])
                            # Retrocompatibilidad
                            if not items and "nombre" in fr:
                                items = [fr]
                            
                            texto_full = ""
                            for item in items:
                                if item.get("imagenes"):
                                    result["images"].extend(item["imagenes"][:3])
                                
                                texto_full += f"📷 *{item['nombre']}*\n\n"
                                if item.get("descripcion"):
                                    texto_full += f"{item['descripcion']}\n\n"
                                if item.get("ficha_tecnica_pdf"):
                                    texto_full += "📋 Incluye ficha técnica.\n\n"
                                texto_full += "--------------------------------\n\n"
                            
                            texto_full += "💬 ¿Te gustaría recibir una cotización formal? Indícame tu nombre y correo."
                            result["text"] = texto_full
                        else:
                            result["text"] = "😕 No tengo fotos disponibles de esos productos. ¿Podrías verificar el nombre?"
                    
                    elif fc.name == "generar_cotizacion":
                        if fr.get("success"):
                            result["documents"].append({"url": fr["pdf_url"], "filename": "Cotizacion.pdf"})
                            
                            precio = f"${fr.get('precio_total', 0):,.0f}".replace(",", ".")
                            
                            nombres = fr.get("nombres", [])
                            if not nombres and "nombre" in fr:
                                # Retrocompatibilidad
                                nombres = [fr["nombre"]]
                            
                            lista_nombres = "\n• ".join([f"*{n}*" for n in nombres])
                            
                            result["text"] = f"✅ *Cotización Generada Exitosamente*\n\n📄 Productos:\n• {lista_nombres}\n\n💰 Total Neto: {precio} + IVA"
                        else:
                            result["text"] = "⚠️ Hubo un problema generando la cotización. Asegúrate de que los productos existen o intenta nuevamente."

        if not result["text"]:
            result["text"] = "Error procesando. Intenta de nuevo."
        
        return result
        
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"text": "Error técnico."}
