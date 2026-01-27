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
Eres un asesor de MACI - Maquinaria Agrícola en Chile.

INSTRUCCIONES CRÍTICAS:
1. Si el cliente pide catálogo/todas/lista → llama buscar_maquinaria("todas")
2. Si el cliente está interesado en un producto y PIDE FOTOS → llama mostrar_imagenes_por_nombre("Nombre Producto")
3. Si el cliente da datos de contacto → llama generar_cotizacion

REGLAS:
- NUNCA muestres IDs técnicos al usuario
- NO uses buscar_maquinaria cuando pidan fotos de un producto YA mencionado
- Usa nombres claros, precios + IVA, emojis 🚜🌾💰
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
    description="Muestra fotos de un producto. Usa el NOMBRE del producto que el cliente mencionó.",
    parameters={
        "type": "object",
        "properties": {"nombre_producto": {"type": "string", "description": "Nombre exacto del producto"}},
        "required": ["nombre_producto"]
    }
)

cotizar_func = FunctionDeclaration(
    name="generar_cotizacion",
    description="Genera cotización. Necesitas nombre del producto y datos del cliente.",
    parameters={
        "type": "object",
        "properties": {
            "nombre_producto": {"type": "string"},
            "cliente_nombre": {"type": "string"},
            "cliente_email": {"type": "string"},
            "cliente_telefono": {"type": "string"}
        },
        "required": ["nombre_producto", "cliente_nombre", "cliente_email", "cliente_telefono"]
    }
)

tools = Tool(function_declarations=[buscar_func, mostrar_imagenes_func, cotizar_func])


def execute_func(name: str, args: dict) -> dict:
    """Ejecuta funciones."""
    logger.info(f"🔧 {name} → {args}")
    
    if name == "buscar_maquinaria":
        resultados = search_maquinarias(args.get("consulta", ""), limit=10)
        if resultados:
            return {"success": True, "productos": [
                {"nombre": m["nombre"], "precio": m.get("precioReferencia", 0), 
                 "descripcion": m.get("descripcion", "")[:80], "id": m["id"]}
                for m in resultados
            ]}
        return {"success": False}
    
    elif name == "mostrar_imagenes_por_nombre":
        nombre = args.get("nombre_producto", "")
        # Buscar el producto por nombre
        resultados = search_maquinarias(nombre, limit=1)
        if resultados:
            m = resultados[0]
            if m.get("imagenes"):
                return {
                    "success": True,
                    "nombre": m["nombre"],
                    "imagenes": m["imagenes"],
                    "id": m["id"]
                }
        return {"success": False, "mensaje": "Sin imágenes o producto no encontrado"}
    
    elif name == "generar_cotizacion":
        nombre = args.get("nombre_producto", "")
        resultados = search_maquinarias(nombre, limit=1)
        if not resultados:
            return {"success": False, "mensaje": "Producto no encontrado"}
        
        m = resultados[0]
        pdf = generate_quotation_pdf(
            cliente_nombre=args["cliente_nombre"],
            cliente_email=args["cliente_email"],
            cliente_telefono=args["cliente_telefono"],
            maquinaria=m
        )
        
        if pdf:
            save_quotation_to_firestore(
                codigo=pdf.split("/")[-1].replace(".pdf", ""),
                cliente_nombre=args["cliente_nombre"],
                cliente_email=args["cliente_email"],
                cliente_telefono=args["cliente_telefono"],
                maquinaria_id=m["id"],
                maquinaria_nombre=m["nombre"],
                precio=m.get("precioReferencia", 0),
                pdf_url=pdf
            )
            return {
                "success": True,
                "pdf_url": pdf,
                "nombre": m["nombre"],
                "precio": m.get("precioReferencia", 0),
                "imagenes": m.get("imagenes", [])
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
        response = model.generate_content(prompt, generation_config=GenerationConfig(temperature=0.7))
        
        result = {"text": "", "images": [], "documents": []}
        
        for candidate in response.candidates:
            for part in candidate.content.parts:
                if hasattr(part, 'text') and part.text:
                    result["text"] += part.text
                
                elif hasattr(part, 'function_call') and part.function_call:
                    fc = part.function_call
                    fr = execute_func(fc.name, dict(fc.args))
                    
                    if fc.name == "buscar_maquinaria" and fr.get("success"):
                        productos = fr["productos"]
                        lista = []
                        for i, p in enumerate(productos, 1):
                            precio = f"${p['precio']:,.0f}".replace(",", ".") if p['precio'] else "Consultar"
                            lista.append(f"{i}. **{p['nombre']}**\n   💰 {precio} + IVA\n   📝 {p['descripcion']}...")
                        
                        intro = "🚜 Nuestro catálogo:\n\n" if len(productos) > 5 else "🚜 Productos encontrados:\n\n"
                        result["text"] = intro + "\n\n".join(lista) + "\n\n¿Te interesa alguno? Dime el nombre."
                    
                    elif fc.name == "mostrar_imagenes_por_nombre":
                        if fr.get("success"):
                            result["images"].extend(fr["imagenes"][:3])
                            result["text"] = (
                                f"📷 **{fr['nombre']}**\n\n"
                                f"Si la imagen no carga, clic aquí:\n🔗 {fr['imagenes'][0]}\n\n"
                                "¿Quieres cotización?"
                            )
                        else:
                            result["text"] = "No tengo fotos de ese producto."
                    
                    elif fc.name == "generar_cotizacion" and fr.get("success"):
                        result["documents"].append({"url": fr["pdf_url"], "filename": f"Cotizacion.pdf"})
                        result["images"].extend(fr.get("imagenes", [])[:2])
                        precio = f"${fr['precio']:,.0f}".replace(",", ".")
                        result["text"] = f"✅ Cotización lista!\n📄 {fr['nombre']}\n💰 {precio} + IVA"

        if not result["text"]:
            result["text"] = "Error procesando. Intenta de nuevo."
        
        return result
        
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"text": "Error técnico."}
