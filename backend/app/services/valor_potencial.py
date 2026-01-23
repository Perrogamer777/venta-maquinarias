"""
Servicio para detectar intención de reserva y calcular valor potencial.
Analiza mensajes para identificar cabañas y fechas mencionadas.
"""
import re
import logging
from datetime import datetime
from google.cloud import firestore

from app.services.firebase import db

logger = logging.getLogger(__name__)

# Mapeo de meses para extracción de fechas textuales
MESES = {
    'enero': 1, 'febrero': 2, 'marzo': 3, 'abril': 4,
    'mayo': 5, 'junio': 6, 'julio': 7, 'agosto': 8,
    'septiembre': 9, 'octubre': 10, 'noviembre': 11, 'diciembre': 12
}


def extraer_fechas(texto: str) -> list:
    """
    Extrae fechas del texto usando múltiples patrones.
    
    Soporta formatos:
    - DD/MM/YYYY, DD-MM-YYYY
    - "10 de enero", "15 de febrero"
    - "del 10 al 15 de enero"
    
    Returns:
        Lista con hasta 2 fechas ordenadas
    """
    fechas = []
    
    # Patrón numérico: DD/MM/YYYY o DD-MM-YYYY
    patron_numerico = r'(\d{1,2})[/-](\d{1,2})[/-](\d{4}|\d{2})'
    for match in re.finditer(patron_numerico, texto):
        try:
            dia, mes, año = match.groups()
            if len(año) == 2:
                año = "20" + año
            fecha = datetime(int(año), int(mes), int(dia))
            fechas.append(fecha)
        except:
            pass
    
    # Patrón textual: "10 de enero"
    patron_textual = r'(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)'
    for match in re.finditer(patron_textual, texto.lower()):
        try:
            dia = int(match.group(1))
            mes = MESES[match.group(2)]
            año = datetime.now().year
            fecha = datetime(año, mes, dia)
            # Si la fecha ya pasó, asumir año siguiente
            if fecha < datetime.now():
                fecha = datetime(año + 1, mes, dia)
            fechas.append(fecha)
        except:
            pass
    
    # Ordenar y retornar máximo 2
    fechas.sort()
    return fechas[:2]


def get_cabanas_from_firestore() -> list:
    """Obtiene lista de cabañas con precios desde Firestore."""
    try:
        docs = db.collection('cabanas').stream()
        cabanas = []
        for doc in docs:
            data = doc.to_dict()
            if data.get('activa', True):
                cabanas.append({
                    'id': doc.id,
                    'nombre': data.get('nombre', ''),
                    'precioPorNoche': data.get('precioPorNoche', 0),
                    'aliases': data.get('aliases', [])
                })
        return cabanas
    except Exception as e:
        logger.error(f"Error obteniendo cabañas: {e}")
        return []


def detectar_cabana_mencionada(texto: str, cabanas: list) -> dict | None:
    """
    Detecta si el texto menciona alguna cabaña.
    
    Args:
        texto: Texto a analizar
        cabanas: Lista de cabañas disponibles
    
    Returns:
        Cabaña detectada o None
    """
    texto_lower = texto.lower()
    
    for cabana in cabanas:
        # Buscar por nombre
        nombre_lower = cabana['nombre'].lower()
        if nombre_lower in texto_lower:
            return cabana
        
        # Buscar por aliases
        for alias in cabana.get('aliases', []):
            if alias.lower() in texto_lower:
                return cabana
    
    return None


def detectar_intencion_reserva(mensaje: str, historial: list, cabanas: list = None) -> dict | None:
    """
    Analiza el mensaje y historial para detectar intención de reserva.
    
    Args:
        mensaje: Último mensaje del cliente
        historial: Mensajes anteriores de la conversación
        cabanas: Lista de cabañas disponibles (si None, se obtiene de Firestore)
    
    Returns:
        dict con valor potencial o None si no se detecta intención
    """
    if cabanas is None:
        cabanas = get_cabanas_from_firestore()
    
    if not cabanas:
        logger.warning("No hay cabañas disponibles para calcular valor potencial")
        return None
    
    # Construir texto completo de los últimos mensajes
    textos_historial = []
    for m in historial[-5:]:
        # Manejar diferentes estructuras de historial
        if isinstance(m, dict):
            if 'parts' in m and m['parts']:
                textos_historial.append(m['parts'][0].get('text', ''))
            elif 'content' in m:
                textos_historial.append(m.get('content', ''))
    
    texto_completo = " ".join(textos_historial) + " " + mensaje
    
    # 1. Detectar cabaña mencionada
    cabana_detectada = detectar_cabana_mencionada(texto_completo, cabanas)
    
    if not cabana_detectada:
        return None
    
    # 2. Detectar fechas
    fechas = extraer_fechas(texto_completo)
    
    if len(fechas) >= 2:
        fecha_inicio = fechas[0]
        fecha_fin = fechas[1]
        noches = (fecha_fin - fecha_inicio).days
        if noches <= 0:
            noches = 2  # Fallback
    else:
        # Si no hay fechas específicas, asumir 2 noches como promedio
        noches = 2
        fecha_inicio = None
        fecha_fin = None
    
    # 3. Calcular valor potencial
    precio_noche = cabana_detectada.get('precioPorNoche', 0)
    monto = precio_noche * noches
    
    if monto <= 0:
        return None
    
    logger.info(f"💰 Valor potencial detectado: {cabana_detectada['nombre']} x {noches} noches = ${monto:,}")
    
    return {
        "monto": monto,
        "cabana": cabana_detectada['nombre'],
        "fechaInicio": fecha_inicio.strftime('%Y-%m-%d') if fecha_inicio else None,
        "fechaFin": fecha_fin.strftime('%Y-%m-%d') if fecha_fin else None,
        "noches": noches,
        "precioPorNoche": precio_noche,
        "actualizadoEn": firestore.SERVER_TIMESTAMP
    }


def actualizar_valor_potencial(telefono: str, valor_potencial: dict) -> bool:
    """
    Actualiza el valor potencial en el documento del chat.
    Usa update() para no sobrescribir otros campos.
    
    Args:
        telefono: Número de teléfono del chat
        valor_potencial: Datos del valor potencial
    
    Returns:
        True si se actualizó correctamente
    """
    try:
        chat_ref = db.collection('chats').document(telefono)
        chat_ref.update({
            'valorPotencial': valor_potencial
        })
        logger.info(f"✅ Valor potencial actualizado para {telefono}: ${valor_potencial['monto']:,}")
        return True
    except Exception as e:
        logger.error(f"Error actualizando valor potencial: {e}")
        return False


def limpiar_valor_potencial(telefono: str) -> bool:
    """
    Elimina el valor potencial del chat (cuando se crea una reserva).
    
    Args:
        telefono: Número de teléfono del chat
    
    Returns:
        True si se limpió correctamente
    """
    try:
        chat_ref = db.collection('chats').document(telefono)
        chat_ref.update({
            'valorPotencial': firestore.DELETE_FIELD
        })
        logger.info(f"🧹 Valor potencial limpiado para {telefono}")
        return True
    except Exception as e:
        logger.error(f"Error limpiando valor potencial: {e}")
        return False
