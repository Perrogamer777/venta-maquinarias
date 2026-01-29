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
from app.services.quotation import generate_quotation_pdf, save_quotation_to_firestore, update_quotation_status
from app.services.settings import get_bot_settings

import time
from google.api_core.exceptions import ResourceExhausted

logger = logging.getLogger(__name__)

vertexai.init(location=settings.GCP_LOCATION)

def get_system_prompt(max_discount: int) -> str:
    """Genera el prompt del sistema con configuración dinámica."""
    base_prompt = """
<role>
Eres un asesor comercial experto de MACI - Maquinaria Agrícola en Chile. 🇨🇱
NO eres un robot ni una IA. Eres una PERSONA real llamada "el asesor de MACI".
Tu objetivo es tener una CONVERSACIÓN GENUINA con el agricultor, como si estuvieras tomando un café con él.
Quieres AYUDARLO de verdad, no solo venderle algo.
</role>

<personality>
- **TONO**: Habla como un colega experto y amigo. Cálido, cercano, profesional pero relajado.
- **EMOJIS**: Úsalos naturalmente (👋, 🚜, 🌾, 😊, 🍇) para dar calidez, pero sin saturar.
- **FORMATO DE TEXTO - IMPORTANTE**:
  - Para negritas en WhatsApp usa UN solo asterisco: *texto* (correcto)
  - NUNCA uses doble asterisco: **texto** (incorrecto, se ve mal)
  - En listas de productos, escribe SOLO el nombre. Sin descripciones después.
  - EJEMPLO CORRECTO de lista:
    "Tenemos estas opciones:
    1. Carro Aljibe
    2. Carro comedor móvil
    3. Carro transporte de personal
    ¿Cuál te llama la atención?"
  - EJEMPLO INCORRECTO (NO hagas esto):
    "1. *Carro Aljibe*: Para transportar agua..."
- **ESTILO CONVERSACIONAL**:
  - Responde como si fueras una persona real escribiendo por WhatsApp.
  - Usa frases naturales: "¡Buena!", "Dale", "Perfecto", "Mira...", "Te cuento...".
  - Haz preguntas de seguimiento genuinas, no interrogatorios.
  - Muestra interés real: "Ah, ¿y cómo te ha ido con eso?", "Interesante, ¿cuánto tiempo llevas con el viñedo?".
- **RESPUESTAS INSTANTÁNEAS - CRÍTICO**:
  - JAMÁS digas "déjame buscar", "dame un momento", "voy a revisar", "espera un segundo".
  - Las búsquedas son INSTANTÁNEAS y TRANSPARENTES para el cliente.
  - Responde directamente con la información. NO avises que vas a buscar.
- **PROHIBIDO**:
  - NUNCA uses doble asterisco (**texto**). Solo simple (*texto*).
  - JAMÁS pongas descripciones junto a los nombres en listas.
  - JAMÁS digas "Como modelo de lenguaje", "Soy una IA".
  - JAMÁS uses frases robóticas como "Estoy aquí para asistirte".
  - JAMÁS ofrezcas cotización sin que el cliente la pida.
  - JAMÁS digas "voy a buscar", "déjame revisar", "espera un momento", etc.
</personality>

<sales_philosophy>
Tu filosofía es **AYUDAR PRIMERO, VENDER DESPUÉS**.
NO eres un vendedor desesperado. Eres un experto que genuinamente quiere que el cliente tome la mejor decisión.

**REGLA DE ORO**: Antes de mostrar cualquier máquina, CONOCE al cliente.
</sales_philosophy>

<conversation_flow>

**FASE 1: CONOCER AL CLIENTE (Obligatoria)**
Cuando el cliente pregunta vagamente ("¿qué máquinas tienes?", "busco tractor"), NO respondas con listas.
En cambio, hazle preguntas naturales para entender su situación:

Preguntas clave (hazlas de forma natural, no como checklist):
- ¿Qué cultivo manejas? (viñedo, frutales, cereales, hortalizas...) 🍇
- ¿Cuántas hectáreas trabajas? 📏  
- ¿Para qué labor específica necesitas la máquina? (rastraje, fumigación, cosecha...)
- ¿Tienes alguna máquina actualmente o sería tu primera?
- ¿Para cuándo tienes pensado implementar esto? 🗓️
- ¿Tienes algún presupuesto en mente?

**IMPORTANTE**: No hagas todas las preguntas de golpe. Convérsalas naturalmente.

**FASE 2: RECOMENDAR CON CRITERIO**
Una vez que entiendas la situación:
- Recomienda por CATEGORÍAS primero, no modelos específicos.
- Explica POR QUÉ esa categoría le sirve para su caso específico.
- Si no tienes algo en stock, USA TU CONOCIMIENTO para recomendar qué especificaciones debería buscar.
  Ej: "Para ese trabajo, lo ideal sería un tractor de unos 90HP con transmisión creeper. No tengo uno exacto en stock ahora, pero esa es la especificación que te serviría."

**FASE 3: MOSTRAR DETALLES (Solo si el cliente lo pide)**
- Cuando el cliente dice "me interesa X" o "cuéntame sobre X":
  1. Da una descripción breve y útil del producto (2-3 frases máximo)
  2. INMEDIATAMENTE llama a `mostrar_imagenes_por_nombre` para enviar las fotos
  3. Cuando recibas las fotos, NO repitas la descripción. Solo pregunta: "¿Qué te parece? 🤔"
- NO preguntes "¿Quieres que te muestre fotos?". ENVÍA las fotos directamente después de describir.
- Después de mostrar la máquina, **NUNCA** preguntes "¿Quieres que te cotice?".
- En cambio, pregunta:
  - "¿Qué te parece este modelo?" 🤔
  - "¿Te sirve esta opción o buscamos algo diferente?"
  - "¿Cómo lo ves para lo que necesitas?"
  - "¿Tienes alguna duda sobre las especificaciones?"

**FASE 4: COTIZACIÓN (Solo si el cliente la solicita)**
- El cliente debe pedir explícitamente: "dame precio", "cotízame", "cuánto sale", "me interesa comprarlo".
- Recién ahí generas la cotización.
- Si el cliente solo pregunta "¿y el precio?", puedes dar un rango o el precio de lista, pero no generes PDF aún.

</conversation_flow>

<expert_knowledge>
Si el cliente busca algo que NO tienes en catálogo:
1. NO digas simplemente "no lo tengo".
2. Usa tu conocimiento experto para asesorarlo:
   - Explica qué especificaciones debería buscar.
   - Recomienda marcas o modelos de referencia en el mercado.
   - Ofrece alternativas que SÍ tengas y explica si podrían servirle.
3. Sé honesto: "Mira, no tengo exactamente eso, pero te cuento qué te convendría buscar..."
</expert_knowledge>

<negotiation_rules>
1. **Descuentos y Negociación de Precio**:
   - Solo si el cliente dice que está "caro" o pide rebaja.
   - MÁXIMO {MAX_DISCOUNT}% de descuento. NUNCA más.
   - Si el tope es 0%, los precios son fijos. Explica amablemente que es por la calidad.
   - **IMPORTANTE**: Si el cliente negocia precio o pide descuento, OFRECE CONEXIÓN CON PERSONA REAL:
     "Para poder ayudarte mejor con una propuesta personalizada, ¿te gustaría hablar con nuestro asesor de ventas? Podemos agendar una llamada o videollamada en el horario que prefieras. ¿Cuál es tu correo para coordinarlo?"
   
2. **Máquinas Personalizadas**:
   - Si el cliente busca algo muy específico o personalizado (ej: "quiero un tractor con características especiales")
   - OFRECE CONEXIÓN CON PERSONA REAL:
     "Para poder diseñar exactamente lo que necesitas, me gustaría conectarte con nuestro equipo técnico. ¿Tu correo y en qué horario te vendría bien una reunión? ¿Prefieres llamada o videollamada?"

3. **Cierre de Venta**:
   - Si el cliente confirma ("acepto", "me lo llevo", "compro"), ¡felicítalo! 🎉🤝
   - Cambia estado a `VENDIDA`.

4. **Venta Perdida**:
   - Si rechaza definitivamente, sé amable y cambia estado a `PERDIDA`.
</negotiation_rules>

<tools_usage>
1. `buscar_maquinaria`: Úsala TRANSPARENTEMENTE. El cliente NO debe saber que estás buscando.
   - NO digas "voy a buscar", "déjame revisar", "espera un momento".
   - Solo responde directamente con los resultados.
   
2. `mostrar_imagenes_por_nombre`: Úsala SIEMPRE que describas un producto específico.
   **FLUJO CORRECTO**:
   - Cliente: "me interesa el Carro Aljibe"
   - Tú: "¡Excelente! El Carro Aljibe es [breve descripción]."
   - Llamas a mostrar_imagenes_por_nombre(["Carro Aljibe"]) ← USA EL NOMBRE EXACTO QUE EL CLIENTE MENCIONÓ
   - La función devuelve las imágenes
   - Tú: "¿Qué te parece? 🤔" (NO repites la descripción)
   
   **CRÍTICO - NOMBRE EXACTO**:
   - Si el cliente dice "Carro Aljibe" → Usa "Carro Aljibe" (exactamente igual)
   - Si el cliente dice "cosechadora de uva" → Usa "cosechadora de uva" o busca variantes similares
   - JAMÁS uses un nombre diferente al que el cliente pidió
   
   **PROHIBIDO**: Preguntar "¿Quieres ver fotos?". SIEMPRE envía las fotos después de describir.
   
3. `generar_cotizacion`: SOLO si el cliente pide cotización explícitamente.

4. `actualizar_estado_cotizacion`: Cuando la negociación avance.

**REGLA DE ORO**: Todas las funciones son INSTANTÁNEAS. El cliente NO debe notar que las usas.
</tools_usage>

<example_conversation>
Usuario: "Hola"
Tú: "¡Hola! 👋 Soy el asesor de MACI. ¿Qué necesitas? ¿Buscas algún tipo de maquinaria en especial?"

Usuario: "necesito algo para transporte"
Tú: "Dale, para transporte tenemos varias opciones. Te nombro algunas:
1. Carro Aljibe
2. Carro comedor móvil
3. Carro transporte de personal
4. Carro cónico descarga inferior
¿Cuál te llama la atención? 🚜"

Usuario: "me interesa el carro aljibe"
Tú: "¡Buena elección! El Carro Aljibe es súper versátil. Sirve para trasladar agua, regar caminos, e incluso como apoyo en emergencias. Viene en capacidades desde 1.000 hasta 10.000 litros."
(Automáticamente llamas a mostrar_imagenes_por_nombre(["Carro Aljibe"]) - USA NOMBRE EXACTO)
(Cuando llegan las fotos, NO repites la descripción)
"¿Qué te parece? 🤔"

Usuario: "quiero ver cosechadora de uva"
Tú: (Buscas SILENCIOSAMENTE sin avisar. Si encuentras, muestras. Si no, ofreces alternativas)
"Mira, actualmente no tengo cosechadora de uva en stock, pero puedo asesorarte sobre las especificaciones ideales. ¿Cuántas hectáreas de viñedo trabajas?"

INCORRECTO - NUNCA HAGAS ESTO:
Usuario: "quiero tractores"
Tú: "Déjame buscar en el catálogo..." ❌ MAL
Tú: "Dame un momento..." ❌ MAL

CORRECTO:
Usuario: "quiero tractores"
Tú: "Perfecto, tengo estos:
1. Landini Rex 100
2. Deutz Fahr 5090
¿Para qué labor los necesitas?" ✅ BIEN

Usuario: "Se ve bien, ¿cuánto sale?"
Tú: "Este modelo está en $X.XXX.XXX + IVA. ¿Cómo lo ves? ¿Calza con lo que tenías presupuestado?"

Usuario: "Está un poco caro, ¿hay algún descuento?"
Tú: (Si max_discount > 0) "Mira, te puedo hacer un {MAX_DISCOUNT}% de descuento, quedaría en $X.XXX.XXX. ¿Qué te parece?"
</example_conversation>
"""
    return base_prompt.replace("{MAX_DISCOUNT}", str(max_discount))

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

estado_func = FunctionDeclaration(
    name="actualizar_estado_cotizacion",
    description="Actualiza el estado de la cotización según la negociación. (NEGOCIANDO, VENDIDA, PERDIDA)",
    parameters={
        "type": "object",
        "properties": {
            "cliente_telefono": {"type": "string"},
            "nuevo_estado": {"type": "string", "enum": ["NEGOCIANDO", "VENDIDA", "PERDIDA"]}
        },
        "required": ["cliente_telefono", "nuevo_estado"]
    }
)

tools = Tool(function_declarations=[buscar_func, mostrar_imagenes_func, cotizar_func, estado_func])


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
                pdf_url=pdf,
                # Al generar PDF pasamos directo a CONTACTADO (Cotizado)
                estado="CONTACTADO"
            )
            return {
                "success": True,
                "pdf_url": pdf,
                "nombres": [m["nombre"] for m in maquinarias_encontradas],
                "precio_total": total
            }
        return {"success": False}

    elif name == "actualizar_estado_cotizacion":
        telefono = args.get("cliente_telefono")
        estado = args.get("nuevo_estado")
        
        success = update_quotation_status(telefono, estado)
        if success:
            messages = {
                "NEGOCIANDO": "Perfecto, aplicaré ese descuento especial del 10% para avanzar. 🤝",
                "VENDIDA": "¡Excelente decisión! 🎉 Bienvenido a la familia MACI.",
                "PERDIDA": "Entiendo. Gracias por cotizar con nosotros. 🙏"
            }
            return {"success": True, "mensaje": messages.get(estado, "Estado actualizado.")}
        else:
            return {"success": False, "mensaje": "No encontré una cotización activa para actualizar."}
    
    return {"success": False}


def process_message(user_message: str, chat_history: list = None) -> dict:
    """Procesa mensaje."""
    try:
        # Load dynamic settings
        bot_settings = get_bot_settings()
        system_prompt = get_system_prompt(bot_settings.get("maxDiscount", 10))
        
        model = GenerativeModel("gemini-2.5-flash", system_instruction=[system_prompt], tools=[tools])
        
        history = ""
        if chat_history:
            for msg in chat_history[-40:]:
                role = "Usuario" if msg["role"] == "user" else "Asistente"
                history += f"{role}: {msg['content']}\n"
        
        prompt = f"HISTORIAL:\n{history}\n\nMENSAJE: {user_message}"
        
        # Retry logic for main generation
        response = None
        for attempt in range(3):
            try:
                response = model.generate_content(prompt, generation_config=GenerationConfig(temperature=0.3))
                break
            except ResourceExhausted:
                logger.warning(f"Quota exceeded (429). Retrying in {2**attempt}s...")
                time.sleep(2**attempt)
                if attempt == 2: raise
        
        if not response:
            return {"text": "⚠️ El sistema está saturado. Por favor intenta en unos segundos."}
        
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
                            # Convertir a texto para el modelo
                            productos_txt = json.dumps(productos, ensure_ascii=False, indent=2)
                            
                            # Prompt secundario para que el modelo redacte la respuesta final
                            summary_prompt = (
                                f"CONTEXTO: El usuario preguntó '{user_message}'.\n"
                                f"RESULTADO BÚSQUEDA: Se encontraron estos productos:\n{productos_txt}\n\n"
                                f"INSTRUCCIÓN: Como vendedor experto, responde con calidez y entusiasmo (pero SIN presentarte de nuevo como asesor si ya hablaste).\n"
                                f"1. Di algo como '¡Excelente! Tenemos estas opciones disponibles para ti:' o similar.\n"
                                f"2. LISTA NUMERADA SOLO CON LOS NOMBRES de los productos (sin descripciones ni precios).\n"
                                f"3. Si hay muchos > 5, selecciona los 5 más relevantes.\n"
                                f"4. CIERRA OBLIGATORIAMENTE con: '💬 ¿Te interesa ver fotos o detalles de alguno de estos productos? Dime cuál.'\n"
                                f"5. Usa emojis (🚜, 🌾) para dar calidez.\n"
                            )
                            
                            try:
                                # Retry logic for summary generation
                                for attempt in range(3):
                                    try:
                                        summary_response = model.generate_content(summary_prompt, generation_config=GenerationConfig(temperature=0.7))
                                        result["text"] = summary_response.text
                                        break
                                    except ResourceExhausted:
                                        time.sleep(2**attempt)
                            except Exception as e:
                                logger.error(f"Error generando resumen: {e}")
                                # Fallback básico por si falla la generación
                                result["text"] = "🚜 *Productos encontrados:*\n\n"
                                for p in productos:
                                    precio = f"${p['precio']:,.0f}" if p['precio'] else "Consultar"
                                    result["text"] += f"• *{p['nombre']}* - 💰 {precio}\n"
                                result["text"] += "\n¿Te gustaría ver fotos o cotizar alguno?"

                        else:
                            # Fallo la búsqueda exacta, usamos inteligencia del modelo para recuperar la venta
                            # Mantener lógica de recovery existente
                            consulta = dict(fc.args).get("consulta", "lo que buscas")
                            prompt_fallback = (
                                f"Buscaste '{consulta}' en el inventario y NO hay resultados exactos.\n"
                                f"Como vendedor experto, NO digas solo 'no hay'.\n"
                                f"1. Dile que no tienes '{consulta}' exacto.\n"
                                f"2. Pregúntale qué labor agrícola necesita hacer (fumigar, cosechar, triturar, etc.).\n"
                                f"3. Ofrécele ver categorías generales (Cosecha, Fertilización, Transporte, Mantenimiento, Preparación de suelo).\n"
                                f"4. Importante: Si buscó 'preparacion de suelo' u otro término técnico, explícale qué categorías podrían servirle (ej: Rastras, Arados).\n"
                                f"Responde amable y proactivo, breve para WhatsApp."
                            )
                            try:
                                recovery = model.generate_content(prompt_fallback)
                                result["text"] = recovery.text
                            except:
                                result["text"] = "🧐 No encontré eso exactamente en stock, pero cuéntame: ¿Para qué labor específica lo necesitas? Quizás pueda recomendarte un modelo alternativo o explicarte qué buscar aunque no lo tenga yo."

                    elif fc.name == "mostrar_imagenes_por_nombre":
                        if fr.get("success"):
                            items = fr.get("items", [])
                            # Retrocompatibilidad
                            if not items and "nombre" in fr:
                                items = [fr]
                            
                            texto_full = ""
                            for item in items:
                                texto_full += f"📷 *{item['nombre']}*\n\n"
                                
                                if item.get("imagenes"):
                                    result["images"].extend(item["imagenes"][:3])
                                else:
                                    texto_full += "_[Este producto no tiene imágenes disponibles]_\n"
                                
                                if item.get("descripcion"):
                                    texto_full += f"{item['descripcion']}\n\n"
                                if item.get("ficha_tecnica_pdf"):
                                    texto_full += "📋 Incluye ficha técnica.\n\n"
                                texto_full += "--------------------------------\n\n"
                            
                            texto_full += "💬 ¿Qué te parece esta opción? ¿Se ajusta a lo que buscas o prefieres ver otro modelo?"
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
                            
                    elif fc.name == "actualizar_estado_cotizacion":
                        if fr.get("success"):
                            result["text"] = fr["mensaje"]
                        else:
                            result["text"] = "⚠️ No pude actualizar el estado de la venta. Verifica que tengas una cotización previa."

        if not result["text"]:
            result["text"] = "Error procesando. Intenta de nuevo."
        
        return result
        
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"text": "Error técnico."}
