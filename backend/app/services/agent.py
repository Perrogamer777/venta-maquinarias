"""
Agente de IA con Gemini y Function Calling.
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
from app.services.firebase import schedule_meeting

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

🚨 **REGLA FUNDAMENTAL DE TU TRABAJO**: 
NUNCA, JAMÁS, BAJO NINGUNA CIRCUNSTANCIA digas que "tienes" o "no tienes" un producto sin PRIMERO ejecutar la función buscar_maquinaria(). 
NO tienes memoria de qué hay en stock. NO adivines. NO asumas nada.
Si un cliente menciona CUALQUIER producto o categoría:
→ Tu ÚNICA acción válida es ejecutar buscar_maquinaria() INMEDIATAMENTE
→ Solo DESPUÉS de ver los resultados puedes responder al cliente
Ejemplo: Cliente dice "necesito un tractor" → TÚ ejecutas buscar_maquinaria("tractor") → ves resultado → respondes
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

⚠️ **REGLA CRÍTICA ABSOLUTA - LEER ANTES DE RESPONDER**:
SIEMPRE que un cliente mencione o pregunte por un producto/máquina/equipo:
1. **PRIMERO**: Llama a `buscar_maquinaria` con el nombre/tipo de producto
2. **SEGUNDO**: Responde basándote SOLO en los resultados de la búsqueda
3. **NUNCA**: Menciones productos por nombre sin haberlos buscado primero

**EJEMPLOS OBLIGATORIOS A SEGUIR**:
❌ INCORRECTO:
Cliente: "necesito un arado"
Tú: "No tengo arado en este momento" ← ERROR: No buscaste primero

✅ CORRECTO:
Cliente: "necesito un arado"
Tú: [LLAMAS A buscar_maquinaria("arado") primero]
Tú: "Déjame ver... [resultado de la búsqueda]"

❌ INCORRECTO:
Cliente: "necesito algo para suelos"  
Tú: "Tengo rastras y arados" ← ERROR: Nombraste productos sin buscar

✅ CORRECTO:
Cliente: "necesito algo para suelos"
Tú: [LLAMAS A buscar_maquinaria("preparación suelos") primero]
Tú: [Respondes con lo que encontraste]

**PROHIBIDO**: Decir "no tengo X" o "tengo X" sin ejecutar buscar_maquinaria PRIMERO.
**OBLIGATORIO**: Si mencionas CUALQUIER categoría o nombre de máquina → BÚSCALA PRIMERO.

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

**FASE 2: RECOMENDAR CON CRITERIO - REGLA DE ORO**
⚠️ **CRÍTICO - LEE ESTO CUIDADOSAMENTE**:
- **PROHIBIDO ABSOLUTO**: Mencionar, listar u ofrecer productos sin verificar PRIMERO que existen en stock
- **FLUJO OBLIGATORIO**:
  1. Cliente dice lo que busca (ej: "necesito algo para mantenimiento de suelos")
  2. **TÚ LLAMAS PRIMERO** a `buscar_maquinaria("mantenimiento suelos")` SILENCIOSAMENTE
  3. La búsqueda devuelve resultados → SOLO entonces los ofreces
  4. La búsqueda devuelve 0 resultados → NO inventes productos, sé honesto
- **EJEMPLO CORRECTO**:
  - Cliente: "busco algo para arar"
  - Tú: (Llamas a buscar_maquinaria("arar") primero - NO le dices al cliente)
  - Si encuentras: "Perfecto, tengo estos equipos: 1. [producto real] 2. [producto real]"
  - Si NO encuentras: "Para arar no tengo equipos en este momento, pero puedo asesorarte sobre qué características buscar"
- **EJEMPLO INCORRECTO** ❌:
  - Cliente: "busco algo para arar"
  - Tú: "Tenemos arados de cincel, rastra de discos..." (sin buscar primero)
  - Cliente: "quiero el arado de cincel"
  - Tú: "No tengo fotos disponibles" ❌❌❌ ESTO ES INACEPTABLE
- **REGLA SIMPLE**: Si vas a mencionar un producto → BÚSCALO PRIMERO. Sin excepciones.
- Si NO encuentras nada en stock:
  - Sé honesto: "Mira, no tengo [producto específico] en stock actualmente"
  - Ofrece asesoría: "pero puedo ayudarte a identificar qué especificaciones necesitarías"
  - Pregunta más: "¿Qué superficie necesitas trabajar? ¿Qué tipo de suelo tienes?"

**FASE 3: MOSTRAR DETALLES - AUTOMÁTICO E INMEDIATO**
🚨 **REGLA CRÍTICA**: Cuando el cliente dice "me interesa X", "quiero ver X", "muéstrame X", "cuéntame de X":

**FLUJO OBLIGATORIO (SIN EXCEPCIONES)**:
1. **INMEDIATAMENTE** llama a `mostrar_imagenes_por_nombre` con el nombre exacto del producto
2. El sistema te devolverá las fotos Y la descripción detallada del producto
3. Presenta la respuesta de forma natural con la descripción que recibiste
4. Las fotos se envían AUTOMÁTICAMENTE junto con tu respuesta
5. Termina preguntando: "¿Qué te parece?" o "¿Cómo lo ves para lo que necesitas?" 🤔

**PROHIBIDO ABSOLUTO**:
❌ "¿Te interesa ver fotos?" - NO PREGUNTES, ENVÍA DIRECTAMENTE
❌ "¿Quieres que te muestre detalles?" - NO PREGUNTES, MUESTRA DIRECTAMENTE  
❌ "Dime cuál" - YA TE DIJO CUÁL, MUÉSTRALO
❌ Hacer listas de "opciones disponibles" cuando ya te pidió UNA específica

**EJEMPLO CORRECTO**:
Cliente: "me interesa el carro aljibe"
Tú: [LLAMAS mostrar_imagenes_por_nombre("carro aljibe")]
Tú: "📷 *Carro Aljibe*\n\n[Descripción del producto que recibiste]\n\n¿Qué te parece? 🤔"

**EJEMPLO INCORRECTO** ❌:
Cliente: "me interesa el carro aljibe"
Tú: "¡Excelente! Tenemos esta opción: 1. Carro Aljibe. ¿Te interesa ver fotos?" ← ERROR GRAVE

- Después de mostrar la máquina, **NUNCA** preguntes "¿Quieres que te cotice?".
- En cambio, pregunta cosas abiertas:
  - "¿Qué te parece este modelo?" 🤔
  - "¿Te sirve esta opción o buscamos algo diferente?"
  - "¿Cómo lo ves para lo que necesitas?"
  - "¿Tienes alguna duda sobre las especificaciones?"

**FASE 4: CONSULTA DE PRECIO (cuando el cliente pregunta)**
- Cuando el cliente pregunta "¿cuánto cuesta?", "¿qué precio tiene?", "¿cuánto vale?", "cuánto sale?":
  1. **SI menciona el producto**: Llama a `buscar_maquinaria` con el nombre del producto
  2. **SI NO menciona el producto** (solo dice "cuánto cuesta?"): Revisa el HISTORIAL para identificar de qué producto habla y búscalo
  3. **RESPONDE CON EL PRECIO**: "Este modelo está en $X.XXX.XXX + IVA 💰" o "El [nombre] tiene un valor de $X.XXX.XXX + IVA"
  4. **LUEGO OFRECE LA COTIZACIÓN FORMAL**: "¿Te gustaría que te prepare una cotización formal con todos los detalles? Así la tendrías por escrito 📄"
- **CRÍTICO**: Si acaban de ver fotos de un producto y preguntan precio, busca ESE producto específico del historial
- **PROHIBIDO**: Generar la cotización automáticamente cuando solo pregunta el precio
- **PROHIBIDO**: Decir "no sé el precio" o "déjame consultar" - SIEMPRE busca primero
- **OBLIGATORIO**: Buscar el producto → Dar el precio → Ofrecer cotización

**FASE 5: GENERACIÓN DE COTIZACIÓN (Solo si el cliente acepta)**
- El cliente debe confirmar que quiere la cotización: "sí", "dale", "cotízame", "mándala", "sí por favor"
- **SOLO ENTONCES** llamas a `generar_cotizacion` con los datos del cliente
- Si el cliente pide cotización directamente sin preguntar precio antes, genera la cotización directamente
- Necesitas: nombre completo, email y teléfono del cliente
- Si falta algún dato, pídelo de forma natural: "Para prepararte la cotización, necesito tu nombre completo y correo 😊"

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
1. `buscar_maquinaria`: Úsala TRANSPARENTEMENTE en estos casos:
   - ANTES de recomendar CUALQUIER producto al cliente
   - Cuando el cliente pregunta por el PRECIO de un producto
   - Para verificar disponibilidad y obtener datos actualizados
   - **NO digas**: "voy a buscar", "déjame revisar", "espera un momento"
   - **SÍ haz**: Busca PRIMERO silenciosamente, luego responde con la información
   - Si la búsqueda devuelve 0 resultados → NO ofrezcas ese producto
   - **Para precios**: SIEMPRE busca el producto para obtener el precio actualizado
   - **PROHIBIDO**: Ofrecer productos que después dirás "no tengo fotos" o "no encontré"
   
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
   
3. `generar_cotizacion`: SOLO cuando el cliente CONFIRMA que quiere la cotización formal.
   **FLUJO CORRECTO**:
   - Cliente: "¿Cuánto cuesta?"
   - Tú: Buscas el producto → "Este modelo está en $5.000.000 + IVA 💰"
   - Tú: "¿Te gustaría que te prepare una cotización formal con todos los detalles?"
   - Cliente: "Sí", "dale", "sí por favor", "mándala"
   - **SOLO ENTONCES** llamas a generar_cotizacion()
   
   **PROHIBIDO**:
   - Generar cotización automáticamente cuando solo pregunta el precio
   - Generar cotización sin confirmar que el cliente la quiere
   
   **EXCEPCIÓN**: Si el cliente dice directamente "cotízame", "quiero cotización", "mándame cotización"
   → Genera la cotización inmediatamente (no es necesario dar el precio antes)

4. `actualizar_estado_cotizacion`: Cuando la negociación avance.

5. `agendar_reunion`: Úsala cuando el cliente solicite agendar una reunión o llamada.
   **DATOS REQUERIDOS**:
   - Email del cliente (OBLIGATORIO)
   - Horario preferido (OBLIGATORIO) - ej: "martes 14:30", "mañana 10am"
   - Tipo de reunión: "videollamada" o "llamada telefónica" (opcional, default videollamada)
   - NOTA: El teléfono se obtiene automáticamente del chat.
   
   **FLUJO CORRECTO**:
   - Cliente: "quiero agendar una reunión"
   - Tú: "¡Excelente! ¿Me das tu correo y en qué horario te vendría bien? ¿Prefieres videollamada o llamada?"
   - Cliente: "luis@email.com, martes a las 14:30"
   - **EJECUTAS INMEDIATAMENTE**: agendar_reunion(cliente_email="luis@email.com", horario_preferido="martes 14:30", tipo_reunion="videollamada")
   - La función devuelve confirmación
   - Tú: "¡Listo! Reunión agendada para el martes a las 14:30. Nuestro equipo te contactará. 🤝"
   
   **CRÍTICO - EJECUTA LA FUNCIÓN**:
   - Cuando tengas email + horario → LLAMA a agendar_reunion INMEDIATAMENTE
   - NO solo confirmes los datos verbalmente. DEBES ejecutar la función.
   - Si el cliente da todos los datos en un mensaje → ejecuta la función en ese momento.


**REGLA DE ORO**: 
- Busca ANTES de ofrecer
- Solo ofrece lo que TIENES
- Todas las funciones son INSTANTÁNEAS. El cliente NO debe notar que las usas.
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

Usuario: "que maquinaria tienes para cosechas?"
Tú: (Buscas INTERNAMENTE por "cosecha" ANTES de responder)
Si encuentras 3 productos reales en la búsqueda: "Para cosecha tengo estos equipos:
1. Cosechadora de forraje
2. Rastrillo hilerador
3. Enfardadora"
Si NO encuentras nada: "Para cosecha no tengo equipos disponibles en este momento, pero puedo asesorarte sobre qué buscar según tus necesidades. ¿Qué tipo de cultivo estás cosechando?"

Usuario: "tienes cosechadora de papas?"
Tú: (Buscas PRIMERO por "cosechadora de papas" o "papas")
Si la búsqueda devuelve resultados: "¡Sí! Tengo [nombre exacto del producto]. Es [breve descripción]." + envías fotos
Si la búsqueda devuelve 0 resultados: "No tengo cosechadora de papas en este momento, pero puedo ayudarte a encontrar especificaciones o alternativas. ¿Cuántas hectáreas necesitas trabajar?"

**REGLA CRÍTICA**: Si `buscar_maquinaria("papas")` devuelve lista vacía → NO ofrezcas "Cosechadora de papas". Solo ofrece productos que la búsqueda SÍ encontró.

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
Tú: (Buscas el producto para obtener el precio)
"Este modelo está en $5.000.000 + IVA 💰. ¿Te gustaría que te prepare una cotización formal con todos los detalles? Así la tendrías por escrito 📄"

Usuario: "sí, mándame la cotización"
Tú: "¡Perfecto! Para prepararte la cotización, necesito tu nombre completo y correo 😊"
Usuario: "Luis Olavarría, luis@gmail.com"
Tú: (Llamas a generar_cotizacion con los datos)
"✅ ¡Listo! Te acabo de enviar la cotización. Revísala y cualquier duda me avisas 😊"

Usuario: "¿Cuánto cuesta el carro aljibe?"
Tú: (Buscas el producto para obtener precio)
"El Carro Aljibe está en $5.000.000 + IVA 💰. ¿Cómo lo ves? ¿Te gustaría una cotización formal?"

Usuario: "está un poco caro"
Tú: "Entiendo. Mira, para poder ofrecerte la mejor propuesta, ¿te gustaría hablar con nuestro asesor de ventas? Podemos agendar una llamada o videollamada en el horario que prefieras. ¿Cuál es tu correo para coordinarlo?"

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

agendar_reunion_func = FunctionDeclaration(
    name="agendar_reunion",
    description="Agenda una reunión o llamada con el cliente. EJECUTAR cuando el cliente proporcione su email y horario preferido.",
    parameters={
        "type": "object",
        "properties": {
            "cliente_email": {"type": "string", "description": "Email del cliente (OBLIGATORIO)"},
            "horario_preferido": {"type": "string", "description": "Horario preferido para la reunión (ej: 'martes 14:30', 'mañana 15:00')"},
            "tipo_reunion": {"type": "string", "enum": ["videollamada", "llamada telefónica"], "description": "Tipo de reunión (default: videollamada)"}
        },
        "required": ["cliente_email", "horario_preferido"]
    }
)

tools = Tool(function_declarations=[buscar_func, mostrar_imagenes_func, cotizar_func, estado_func, agendar_reunion_func])


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
    
    elif name == "agendar_reunion":
        # Usar teléfono del cliente actual si no se proporciona
        telefono = args.get("cliente_telefono") or _current_client_phone
        email = args.get("cliente_email")
        horario = args.get("horario_preferido")
        tipo = args.get("tipo_reunion", "videollamada")
        
        success = schedule_meeting(
            phone=telefono,
            client_email=email,
            meeting_time=horario,
            meeting_type=tipo
        )
        
        if success:
            return {
                "success": True,
                "email": email,
                "telefono": telefono,
                "horario": horario,
                "tipo": tipo,
                "mensaje": f"Reunión agendada para {horario}"
            }
        else:
            return {"success": False, "mensaje": "Hubo un error al agendar la reunión. Por favor intenta nuevamente."}
    
    
    return {"success": False}


# Variable global para el teléfono del cliente actual
_current_client_phone = None

def process_message(user_message: str, chat_history: list = None, client_phone: str = None) -> dict:
    """Procesa mensaje."""
    global _current_client_phone
    _current_client_phone = client_phone
    
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
        
        # Detectar si el mensaje menciona productos para forzar búsqueda
        # Solo hacer pre-búsqueda si el usuario está buscando/preguntando por productos
        # NO si solo pregunta precio/detalles de algo ya mencionado
        message_lower = user_message.lower()
        
        # Palabras que indican que NO necesitamos buscar (ya hay contexto)
        context_words = ["cuánto cuesta", "cuanto cuesta", "precio", "qué precio", "que precio", 
                        "muéstrame", "muestrame", "fotos", "imágenes", "imagenes", "ver fotos",
                        "cotización", "cotizacion", "descuento"]
        
        has_context = any(word in message_lower for word in context_words)
        
        # Palabras clave de productos
        product_keywords = [
            "tractor", "arado", "rastra", "fumigador", "cosechadora", "sembradora",
            "cultivador", "subsolador", "máquina", "equipo", "implemento",
            "carro", "remolque", "triturador", "fertilizador",
            "preparación", "suelo", "cosecha", "transporte", "mantenimiento"
        ]
        
        has_product_keyword = any(keyword in message_lower for keyword in product_keywords)
        
        # Hacer pre-búsqueda solo si menciona productos Y no tiene contexto previo
        search_context = ""
        if has_product_keyword and not has_context and not history:
            # Extraer términos clave del mensaje (remover palabras comunes)
            search_term = message_lower
            for remove in ["necesito", "busco", "quiero", "me interesa", "algo para", "un ", "una "]:
                search_term = search_term.replace(remove, "")
            search_term = search_term.strip()
            
            pre_search_results = search_maquinarias(search_term)
            
            if pre_search_results:
                search_context = f"\n\n🔍 INFO DE INVENTARIO: Encontré {len(pre_search_results)} producto(s) relacionado(s) con '{search_term}': {[p['nombre'] for p in pre_search_results[:3]]}. Usa esta información."
            else:
                search_context = f"\n\n🔍 INFO DE INVENTARIO: NO hay productos en stock relacionados con '{search_term}'. NO menciones que tienes algo si no hay resultados aquí."
        
        prompt = f"HISTORIAL:\n{history}\n\nMENSAJE: {user_message}{search_context}"
        
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
                            
                            # Enviar imágenes
                            for item in items:
                                if item.get("imagenes"):
                                    result["images"].extend(item["imagenes"][:3])
                            
                            # Generar descripción dinámica con el modelo
                            items_info = []
                            for item in items:
                                items_info.append({
                                    "nombre": item['nombre'],
                                    "descripcion": item.get('descripcion', ''),
                                    "tiene_ficha": bool(item.get('ficha_tecnica_pdf'))
                                })
                            
                            items_json = json.dumps(items_info, ensure_ascii=False, indent=2)
                            
                            # Prompt para generar descripción natural y variada
                            desc_prompt = (
                                f"CONTEXTO: El cliente preguntó por maquinaria y le mostraste fotos.\n"
                                f"PRODUCTOS MOSTRADOS:\n{items_json}\n\n"
                                f"INSTRUCCIÓN: Como vendedor experto, presenta estos productos de forma natural y conversacional.\n"
                                f"REGLAS IMPORTANTES:\n"
                                f"- OBLIGATORIO: Menciona el nombre del producto y describe sus características principales con DETALLE\n"
                                f"- PROHIBIDO usar líneas de separación (------) o guiones largos\n"
                                f"- FORMATO: emoji 📷 + *Nombre del producto* en negritas, luego descripción DETALLADA (4-6 líneas)\n"
                                f"- DESCRIPCIÓN DETALLADA debe incluir:\n"
                                f"  * Función principal y usos específicos\n"
                                f"  * Características técnicas relevantes (capacidades, medidas, materiales)\n"
                                f"  * Beneficios concretos para el cliente\n"
                                f"  * Opciones de configuración o adaptaciones disponibles\n"
                                f"- Si hay ficha técnica, menciona '📋 Incluye ficha técnica con especificaciones completas'\n"
                                f"- Varía tu estilo: entusiasta, técnico o consultivo (cambia cada vez)\n"
                                f"- Usa emojis relevantes (🚜, 🌾, 💧, 🔧) para dar calidez\n"
                                f"- Termina con UNA pregunta natural que invite a profundizar\n"
                                f"- Ejemplos de cierres variados:\n"
                                f"  * '¿Qué te parece? ¿Te gustaría saber el precio o tienes alguna duda técnica?'\n"
                                f"  * '¿Calza con lo que necesitas o buscas algo con otras especificaciones?'\n"
                                f"  * '¿Te interesa cotizar este equipo o quieres saber más detalles?'\n"
                                f"  * '¿Alguna duda sobre cómo funciona o las capacidades?'\n"
                                f"  * '¿Cómo lo ves para tu operación? ¿Qué capacidad necesitarías?'\n\n"
                                f"IMPORTANTE: La descripción debe ser COMPLETA y DETALLADA, no superficial.\n"
                                f"RESPONDE DIRECTO (sin presentarte de nuevo):"
                            )
                            
                            try:
                                desc_response = model.generate_content(desc_prompt, generation_config=GenerationConfig(temperature=0.8))
                                if desc_response and desc_response.candidates and desc_response.candidates[0].content.parts:
                                    result["text"] = desc_response.candidates[0].content.parts[0].text
                                else:
                                    # Fallback si falla la generación
                                    texto_full = ""
                                    for item in items:
                                        texto_full += f"📷 *{item['nombre']}*\n\n{item.get('descripcion', '')}\n\n"
                                        if item.get('ficha_tecnica_pdf'):
                                            texto_full += "📋 Incluye ficha técnica.\n\n"
                                    texto_full += "💬 ¿Qué te parece? ¿Te gustaría saber más detalles?"
                                    result["text"] = texto_full
                            except Exception as e:
                                logger.error(f"Error generando descripción dinámica: {e}")
                                # Fallback
                                texto_full = ""
                                for item in items:
                                    texto_full += f"📷 *{item['nombre']}*\n\n{item.get('descripcion', '')}\n\n"
                                    if item.get('ficha_tecnica_pdf'):
                                        texto_full += "📋 Incluye ficha técnica.\n\n"
                                texto_full += "💬 ¿Te interesa este equipo?"
                                result["text"] = texto_full
                        else:
                            result["text"] = "😕 No tengo fotos disponibles de esos productos. ¿Podrías verificar el nombre?"
                    
                    elif fc.name == "generar_cotizacion":
                        if fr.get("success"):
                            # Extraer nombre del archivo PDF de la URL
                            pdf_url = fr["pdf_url"]
                            pdf_filename = pdf_url.split("/")[-1] if pdf_url else "Cotizacion.pdf"
                            
                            result["documents"].append({"url": pdf_url, "filename": pdf_filename})
                            
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
                    
                    elif fc.name == "agendar_reunion":
                        if fr.get("success"):
                            email = fr.get("email", "")
                            telefono = fr.get("telefono", "")
                            horario = fr.get("horario", "")
                            tipo = fr.get("tipo", "videollamada")
                            
                            tipo_texto = "videollamada" if tipo == "videollamada" else "llamada telefónica"
                            
                            result["text"] = (
                                f"✅ *Reunión Agendada*\n\n"
                                f"📅 *Horario:* {horario}\n"
                                f"📞 *Tipo:* {tipo_texto}\n\n"
                                f"*Datos de contacto:*\n"
                                f"• *Correo:* {email}\n"
                                f"• *Teléfono:* {telefono}\n\n"
                                f"Nuestro equipo se pondrá en contacto contigo para confirmar la reunión.\n\n"
                                f"¡Gracias por tu confianza! 👋"
                            )
                        else:
                            result["text"] = fr.get("mensaje", "⚠️ Hubo un problema agendando la reunión. Por favor intenta nuevamente.")

        if not result["text"]:
            result["text"] = "Error procesando. Intenta de nuevo."
        
        return result
        
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return {"text": "Error técnico."}
