"""
Servicio WuBook - Lógica de negocio para cabañas (disponibilidad, precios, reservas).
"""
import time
import random
import string
import logging
from datetime import datetime, timedelta
from app.config import settings
from app.services.firebase import save_reservation, db

logger = logging.getLogger(__name__)

# Marcador de versión para confirmar despliegue
logger.info("🚀 WUBOOK SERVICE v2.0 - FIRESTORE ENABLED")


def get_site_context() -> dict:
    """
    Obtiene información del sitio web scrapeada (servicios, descripción).
    Útil para dar contexto al agente sobre el negocio.
    """
    try:
        doc = db.collection("configuracion").document("sitio_web").get()
        if doc.exists:
            return doc.to_dict()
        return {}
    except Exception as e:
        logger.warning(f"No se pudo obtener contexto del sitio: {e}")
        return {}

# --- CABAÑAS DESDE FIRESTORE (SIN DATOS LOCALES) ---

# Cache para evitar múltiples lecturas en la misma request
_cabin_cache = None
_cabin_cache_time = 0
CACHE_TTL = 60  # Segundos


def get_cabin_details() -> dict:
    """
    Lee las cabañas EXCLUSIVAMENTE desde Firestore.
    Usa caché de 60 segundos para rendimiento.
    Si Firestore falla o está vacío, retorna diccionario vacío.
    """
    global _cabin_cache, _cabin_cache_time
    import time as time_module
    
    # Verificar caché
    if _cabin_cache and (time_module.time() - _cabin_cache_time) < CACHE_TTL:
        logger.info(f"🔄 Usando caché de cabañas ({len(_cabin_cache)} cabañas)")
        return _cabin_cache
    
    logger.info("🔍 Leyendo cabañas desde Firestore...")
    
    try:
        cabanas = {}
        docs = list(db.collection('cabanas').stream())
        logger.info(f"📦 Documentos en 'cabanas': {len(docs)}")
        
        for doc in docs:
            data = doc.to_dict()
            
            # Verificar si está activa
            if not data.get("activa", True):
                logger.info(f"  ⏭️ Saltando {doc.id} (no activa)")
                continue
            
            # Leer capacidad del campo numérico
            capacidad_num = data.get("capacidad", 0)
            
            cabanas[doc.id] = {
                "nombre": data.get("nombre", ""),
                "aliases": data.get("aliases", []),
                "capacidad": f"{capacidad_num} personas",
                "capacidad_num": capacidad_num,
                "amenidades": data.get("amenidades", ""),
                "descripcion": data.get("descripcion", ""),
                "imagenes": data.get("imagenes", []),
                "base_price": data.get("precioPorNoche", 0),
                "es_premium": data.get("esPremium", False)
            }
            logger.info(f"  ✓ {doc.id}: capacidad={capacidad_num}")
        
        if not cabanas:
            logger.error("❌ No hay cabañas en Firestore. Verifica la colección 'cabanas'.")
            return {}
        
        # Actualizar caché
        _cabin_cache = cabanas
        _cabin_cache_time = time_module.time()
        
        logger.info(f"✅ {len(cabanas)} cabañas cargadas desde Firestore")
        return cabanas
        
    except Exception as e:
        logger.error(f"❌ Error leyendo cabañas: {type(e).__name__}: {e}")
        # Retornar caché si existe
        if _cabin_cache:
            logger.warning("⚠️ Usando caché expirado")
            return _cabin_cache
        return {}


def get_cabin_services(cabin_key: str) -> list:
    """
    Obtiene los servicios adicionales disponibles para una cabaña.
    
    Args:
        cabin_key: ID de la cabaña (laurel, cipres, yurta_mirador, castano)
    
    Returns:
        Lista de servicios disponibles con nombre y descripción
    """
    try:
        servicios = []
        docs = db.collection('servicios_adicionales').stream()
        
        for doc in docs:
            data = doc.to_dict()
            cabanas_disponibles = data.get("cabanas", [])
            
            if cabin_key in cabanas_disponibles:
                servicios.append({
                    "nombre": data.get("nombre", ""),
                    "descripcion": data.get("descripcion", "")
                })
        
        logger.info(f"📦 Servicios para {cabin_key}: {len(servicios)}")
        return servicios
        
    except Exception as e:
        logger.error(f"Error obteniendo servicios: {e}")
        return []


def get_cabin_services_text(nombre_cabana_query: str) -> str:
    """
    Devuelve los servicios adicionales como texto para el agente.
    """
    key = _match_cabin(nombre_cabana_query)
    
    if not key:
        return "No encontré esa cabaña."
    
    servicios = get_cabin_services(key)
    
    if not servicios:
        return f"Esta cabaña no tiene servicios adicionales disponibles."
    
    cabins = get_cabin_details()
    nombre_cabana = cabins.get(key, {}).get("nombre", key)
    
    lineas = [f"🌟 Servicios adicionales disponibles para {nombre_cabana}:\n"]
    for s in servicios:
        lineas.append(f"• {s['nombre']}: {s['descripcion']}")
    
    lineas.append("\n¿Te interesa agregar alguno de estos servicios a tu reserva?")
    
    return "\n".join(lineas)


# --- FUNCIONES DE BÚSQUEDA ---

def _match_cabin(query: str) -> str | None:
    """Busca cabaña por nombre o alias."""
    q = query.lower()
    cabins = get_cabin_details()
    
    for key, info in cabins.items():
        if key in q:
            return key
        
        for alias in info.get("aliases", []):
            if alias in q:
                return key
    
    return None


def get_cabin_url(nombre_cabana_query: str) -> str | None:
    """Devuelve la primera imagen de la cabaña (para compatibilidad)."""
    key = _match_cabin(nombre_cabana_query)
    if key:
        cabins = get_cabin_details()
        imagenes = cabins[key].get("imagenes", [])
        return imagenes[0] if imagenes else None
    return None


def get_cabin_images(nombre_cabana_query: str) -> list:
    """Devuelve TODAS las imágenes de una cabaña."""
    key = _match_cabin(nombre_cabana_query)
    if key:
        cabins = get_cabin_details()
        return cabins[key].get("imagenes", [])
    return []


def get_cabin_data(nombre_cabana_query: str) -> dict | None:
    """
    Devuelve todos los datos de una cabaña.
    
    Returns:
        dict con nombre, capacidad, amenidades, descripcion, imagenes, base_price
        o None si no se encuentra
    """
    key = _match_cabin(nombre_cabana_query)
    if key:
        cabins = get_cabin_details()
        return cabins[key].copy()
    return None


def get_cabin_info(nombre_cabana_query: str) -> str:
    """Devuelve la descripción en texto para Gemini."""
    cabins = get_cabin_details()
    key = _match_cabin(nombre_cabana_query)
    
    if key:
        info = cabins[key]
        logger.info(f"📋 get_cabin_info para '{key}': capacidad={info.get('capacidad')}, capacidad_num={info.get('capacidad_num')}")
        return (f"**{info['nombre']}**\n"
                f"👥 Capacidad: {info['capacidad']}\n"
                f"✨ Amenidades: {info['amenidades']}\n"
                f"📝 {info['descripcion']}")
    else:
        cabanas_disponibles = ", ".join([c["nombre"] for c in cabins.values()])
        return f"No encontré esa cabaña. Tenemos: {cabanas_disponibles}"


# --- LÓGICA DE PRECIOS ---

def _calcular_precio_dinamico(fecha_dt: datetime, precio_base: int) -> int:
    """Aplica reglas de precio dinámico."""
    dia_semana = fecha_dt.weekday()
    
    # Viernes y Sábado +20%
    if dia_semana in [4, 5]:
        return int(precio_base * 1.20)
    return precio_base


def _generar_inventario_simulado(fecha_inicio_dt: datetime, dias_totales: int) -> list:
    """Genera disponibilidad simulada."""
    es_temporada_alta = fecha_inicio_dt.month == 2  # Febrero
    cabins = get_cabin_details()
    
    resultados = []
    
    for key, cabana in cabins.items():
        precio_total = 0
        esta_disponible = True
        
        for i in range(dias_totales):
            dia_actual = fecha_inicio_dt + timedelta(days=i)
            
            # El Domo se llena los findes de febrero
            if es_temporada_alta and cabana.get("es_premium") and dia_actual.weekday() >= 5:
                esta_disponible = False
            
            precio_noche = _calcular_precio_dinamico(dia_actual, cabana["base_price"])
            precio_total += precio_noche
        
        resultados.append({
            "key": key,
            "name": f"{cabana['nombre']} ({cabana['capacidad_num']} personas)",
            "total_price": precio_total,
            "avg_price": precio_total // dias_totales if dias_totales > 0 else 0,
            "avail": 1 if esta_disponible else 0,
            "capacidad": cabana["capacidad_num"]
        })
    
    return resultados


# --- FUNCIONES PRINCIPALES ---

def check_availability(fecha_inicio: str, fecha_fin: str, num_personas: int = None) -> str:
    """Consulta disponibilidad y precios."""
    logger.info(f"Consultando disponibilidad: {fecha_inicio} al {fecha_fin}")
    
    try:
        f_inicio = datetime.strptime(fecha_inicio, "%d/%m/%Y")
        f_fin = datetime.strptime(fecha_fin, "%d/%m/%Y")
        noches = (f_fin - f_inicio).days
        
        if noches < 1:
            return "Error: La fecha de salida debe ser posterior a la de llegada."
    except ValueError:
        return "Error de formato: Usa fechas DD/MM/YYYY (ej: 10/01/2025)."
    
    if settings.use_mock_mode:
        time.sleep(0.3)  # Simula latencia
        rooms_data = _generar_inventario_simulado(f_inicio, noches)
    else:
        return "Error: Credenciales WuBook no configuradas."
    
    # Formatear respuesta
    header = f"🔎 Disponibilidad para {noches} noches ({fecha_inicio} al {fecha_fin})"
    if num_personas:
        header += f" - {num_personas} personas"
    
    lineas = [header + ":\n"]
    hay_opciones = False
    
    for room in rooms_data:
        if room['avail'] > 0:
            hay_opciones = True
            total_fmt = f"${room['total_price']:,.0f}"
            promedio_fmt = f"${room['avg_price']:,.0f}"
            
            # Recomendar según capacidad
            es_recomendada = False
            if num_personas and room['capacidad'] >= num_personas and room['capacidad'] <= num_personas + 2:
                es_recomendada = True
            
            marca = "⭐ RECOMENDADA" if es_recomendada else "✅"
            
            lineas.append(
                f"{marca} **{room['name']}**\n"
                f"   - Total: {total_fmt}\n"
                f"   - Por noche: {promedio_fmt}"
            )
        else:
            lineas.append(f"❌ {room['name']}: No disponible")
    
    if not hay_opciones:
        return f"Lo siento, no hay disponibilidad para esas {noches} noches. Intenta otras fechas."
    
    resultado = "\n".join(lineas)
    logger.info(f"📤 Resultado check_availability:\n{resultado}")
    return resultado


def crear_pre_reserva(nombre_cabana: str, fecha_inicio: str, fecha_fin: str, 
                       nombre_cliente: str, email_cliente: str,
                       telefono_cliente: str = None) -> str:
    """Crea una pre-reserva y la guarda en Firebase."""
    logger.info(f"Creando reserva: {nombre_cabana} para {nombre_cliente}")
    
    # ===== VERIFICACIÓN DE DUPLICADOS =====
    # Evitar crear reservas idénticas dentro de las últimas 24 horas
    try:
        from datetime import datetime, timedelta
        hace_24h = datetime.utcnow() - timedelta(hours=24)
        
        # Buscar reservas recientes con misma cabaña, fechas y teléfono
        query = db.collection("reservas")\
            .where("cabana", "==", nombre_cabana)\
            .where("fecha_inicio", "==", fecha_inicio)\
            .where("fecha_fin", "==", fecha_fin)
        
        if telefono_cliente:
            query = query.where("cliente_telefono", "==", telefono_cliente)
        
        reservas_existentes = list(query.stream())
        
        for reserva in reservas_existentes:
            data = reserva.to_dict()
            created = data.get("created_at")
            if created and created > hace_24h:
                # Ya existe una reserva idéntica reciente
                codigo_existente = data.get("codigo_reserva", "N/A")
                logger.warning(f"⚠️ Reserva duplicada detectada: {codigo_existente}")
                return (f"Ya tienes una reserva activa para estas fechas 📝\n\n"
                        f"🎟️ **Código:** {codigo_existente}\n"
                        f"📅 **Fechas:** {fecha_inicio} al {fecha_fin}\n"
                        f"🏨 **Cabaña:** {nombre_cabana}\n\n"
                        f"¿Necesitas modificar algo de esta reserva?")
    except Exception as dup_error:
        logger.warning(f"No se pudo verificar duplicados: {dup_error}")
    # ===== FIN VERIFICACIÓN DUPLICADOS =====
    
    codigo = "RES-" + ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    
    datos_reserva = {
        "codigo_reserva": codigo,
        "cabana": nombre_cabana,
        "fecha_inicio": fecha_inicio,
        "fecha_fin": fecha_fin,
        "cliente_nombre": nombre_cliente,
        "cliente_email": email_cliente,
        "cliente_telefono": telefono_cliente,
        "estado": "PENDIENTE_PAGO",
        "origen": "WhatsApp Bot"
    }
    
    try:
        doc_id = save_reservation(datos_reserva)
        logger.info(f"Reserva guardada con ID: {doc_id}")
        
        # Enviar email de confirmación
        try:
            from app.services.email import send_reservation_email
            send_reservation_email(
                cliente_nombre=nombre_cliente,
                cliente_email=email_cliente,
                cabana=nombre_cabana,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                codigo_reserva=codigo,
                telefono=telefono_cliente or ""
            )
        except Exception as email_error:
            logger.warning(f"No se pudo enviar email: {email_error}")
        
        # Limpiar valor potencial del chat (ya no es "potencial", es real)
        if telefono_cliente:
            try:
                from app.services.valor_potencial import limpiar_valor_potencial
                limpiar_valor_potencial(telefono_cliente)
            except Exception as vp_error:
                logger.warning(f"No se pudo limpiar valor potencial: {vp_error}")
        
        return (f"¡Excelente {nombre_cliente}! 🎉\n\n"
                f"Pre-reserva creada exitosamente.\n"
                f"🏨 **Cabaña:** {nombre_cabana}\n"
                f"📅 **Fechas:** {fecha_inicio} al {fecha_fin}\n"
                f"🎟️ **Código:** *{codigo}*\n\n"
                f"📧 Detalles de pago enviados a: {email_cliente}\n"
                f"⚠️ Tienes 24 horas para realizar el abono.")
    except Exception as e:
        logger.error(f"Error creando reserva: {e}")
        return "Error técnico guardando la reserva. Por favor intenta de nuevo."

