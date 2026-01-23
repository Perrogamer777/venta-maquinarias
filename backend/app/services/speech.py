"""
Servicio de transcripción de audio usando Google Cloud Speech-to-Text.
Incluye normalización de emails y mejoras para detección.
"""
import logging
import re
from google.cloud import speech

logger = logging.getLogger(__name__)

# Inicializar cliente de Speech-to-Text
speech_client = speech.SpeechClient()


def normalize_email_in_text(text: str) -> str:
    """
    Normaliza direcciones de email dictadas en el texto.
    
    Convierte patrones como:
    - "pablo reinoso arroba gmail punto com" → "pablo.reinoso@gmail.com"
    - "pablo punto reinoso arroba gmail punto com" → "pablo.reinoso@gmail.com"
    - "mi correo es juan at hotmail dot com" → "mi correo es juan@hotmail.com"
    """
    if not text:
        return text
    
    result = text
    
    # Reemplazar variantes de "arroba" / "at" / "@"
    result = re.sub(r'\s*arroba\s*', '@', result, flags=re.IGNORECASE)
    result = re.sub(r'\s+at\s+', '@', result, flags=re.IGNORECASE)
    result = re.sub(r'\s*aroba\s*', '@', result, flags=re.IGNORECASE)  # typo común
    
    # Reemplazar variantes de "guion bajo" / "underscore" / "_"
    result = re.sub(r'\s*gui[oó]n\s*bajo\s*', '_', result, flags=re.IGNORECASE)
    result = re.sub(r'\s*underscore\s*', '_', result, flags=re.IGNORECASE)
    result = re.sub(r'\s*barra\s*baja\s*', '_', result, flags=re.IGNORECASE)
    result = re.sub(r'\s*sub\s*guion\s*', '_', result, flags=re.IGNORECASE)
    
    # Reemplazar variantes de "punto" / "dot" / "."
    result = re.sub(r'\s*punto\s*', '.', result, flags=re.IGNORECASE)
    result = re.sub(r'\s+dot\s+', '.', result, flags=re.IGNORECASE)
    
    # Buscar patrones de email y normalizarlos
    # Patrón: algo @ algo . algo (con posibles espacios)
    email_pattern = r'([a-zA-Z0-9\.\s]+)@([a-zA-Z0-9\.\s]+)\.([a-zA-Z]{2,})'
    
    def clean_email(match):
        local = match.group(1).strip().lower().replace(' ', '.')
        domain = match.group(2).strip().lower().replace(' ', '')
        tld = match.group(3).strip().lower()
        
        # Limpiar puntos duplicados
        local = re.sub(r'\.+', '.', local)
        local = local.strip('.')
        
        return f"{local}@{domain}.{tld}"
    
    result = re.sub(email_pattern, clean_email, result)
    
    logger.info(f"Email normalizado: '{text[:50]}' → '{result[:50]}'")
    
    return result


def transcribe_audio(audio_bytes: bytes, mime_type: str = "audio/ogg") -> str:
    """
    Transcribe audio a texto usando Google Cloud Speech-to-Text.
    
    Args:
        audio_bytes: Bytes del archivo de audio
        mime_type: Tipo MIME del audio (audio/ogg, audio/mpeg, etc.)
    
    Returns:
        Texto transcrito o mensaje de error
    """
    try:
        logger.info(f"Transcribiendo audio ({len(audio_bytes)} bytes, tipo: {mime_type})")
        
        # Determinar encoding basado en mime_type
        # WhatsApp envía audios en formato OGG con codec Opus
        if "ogg" in mime_type or "opus" in mime_type:
            encoding = speech.RecognitionConfig.AudioEncoding.OGG_OPUS
        elif "mpeg" in mime_type or "mp3" in mime_type:
            encoding = speech.RecognitionConfig.AudioEncoding.MP3
        elif "wav" in mime_type:
            encoding = speech.RecognitionConfig.AudioEncoding.LINEAR16
        else:
            # Intentar con OGG_OPUS como fallback (común en WhatsApp)
            encoding = speech.RecognitionConfig.AudioEncoding.OGG_OPUS
        
        # Configuración del reconocimiento - mejorada para mejor detección
        config = speech.RecognitionConfig(
            encoding=encoding,
            sample_rate_hertz=16000,  # WhatsApp usa 16kHz típicamente
            language_code="es-ES",    # Español (España) - mejor soporte
            alternative_language_codes=["en-US", "pt-BR"],
            enable_automatic_punctuation=True,
            # Mejoras para detección de audio
            audio_channel_count=1,  # Mono (WhatsApp es mono)
            enable_word_confidence=True,  # Útil para debugging
            # Adaptación de speech para emails
            speech_contexts=[
                speech.SpeechContext(
                    phrases=[
                        "arroba", "punto", "gmail", "hotmail", "outlook", 
                        "yahoo", ".com", ".cl", ".es", "@",
                        "reserva", "reservar", "cabaña", "cabañas",
                        "enero", "febrero", "marzo", "abril", "mayo", "junio",
                        "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
                    ],
                    boost=10.0  # Aumentar probabilidad de detectar estas palabras
                )
            ]
        )
        
        # Audio desde bytes
        audio = speech.RecognitionAudio(content=audio_bytes)
        
        # Realizar transcripción
        response = speech_client.recognize(config=config, audio=audio)
        
        # Extraer texto de los resultados
        transcription = ""
        for result in response.results:
            if result.alternatives:
                transcription += result.alternatives[0].transcript + " "
        
        transcription = transcription.strip()
        
        if transcription:
            # Normalizar emails en el texto transcrito
            transcription = normalize_email_in_text(transcription)
            logger.info(f"Audio transcrito: '{transcription[:50]}...'")
            return transcription
        else:
            logger.warning("No se detectó habla en el audio")
            return "[Audio sin habla detectada]"
            
    except Exception as e:
        logger.error(f"Error transcribiendo audio: {e}", exc_info=True)
        return f"[Error al transcribir audio: {str(e)[:50]}]"


def transcribe_audio_long(audio_bytes: bytes, mime_type: str = "audio/ogg", gcs_uri: str = None) -> str:
    """
    Transcribe audios largos (> 1 minuto) usando operación asíncrona.
    Requiere que el audio esté en GCS o usar recognize_long_running_audio.
    
    Para audios cortos (< 1 min), usa transcribe_audio() directamente.
    """
    # Para audios largos, se necesita subir a GCS primero
    # Por ahora, retornamos a la función síncrona que funciona para audios cortos
    return transcribe_audio(audio_bytes, mime_type)
