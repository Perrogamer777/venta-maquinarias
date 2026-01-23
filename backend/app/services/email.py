"""
Servicio de Email - Envío de notificaciones por correo electrónico usando Resend.
"""
import logging
import os

logger = logging.getLogger(__name__)

# API Key de Resend (obtener en https://resend.com)
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "re_E4f2e2wa_4k7VYnuv1tr9MC3vsB3BmKJ3")
FROM_EMAIL = os.getenv("FROM_EMAIL", "onboarding@resend.dev")  # Email de prueba de Resend
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "")  # Vacío = no notificar admin por ahora


def send_reservation_email(
    cliente_nombre: str,
    cliente_email: str,
    cabana: str,
    fecha_inicio: str,
    fecha_fin: str,
    codigo_reserva: str,
    telefono: str = ""
) -> bool:
    """
    Envía email de confirmación de reserva al cliente y notificación al admin.
    
    Returns:
        True si el envío fue exitoso
    """
    if not RESEND_API_KEY:
        logger.warning("⚠️ RESEND_API_KEY no configurada, email no enviado")
        return False
    
    try:
        import resend
        resend.api_key = RESEND_API_KEY
        
        # Email al cliente
        email_cliente = f"""
¡Hola {cliente_nombre}! 🎉

Tu pre-reserva ha sido registrada exitosamente.

📋 DETALLES DE TU RESERVA:
━━━━━━━━━━━━━━━━━━━━━━━━━━
🏨 Cabaña: {cabana}
📅 Fecha de llegada: {fecha_inicio}
📅 Fecha de salida: {fecha_fin}
🎟️ Código de reserva: {codigo_reserva}

⚠️ IMPORTANTE:
Esta es una PRE-RESERVA. Para confirmarla, debes realizar el pago 
dentro de las próximas 24 horas.

Te enviaremos los datos de pago por separado.

📞 ¿Tienes dudas? Responde a este correo o escríbenos por WhatsApp.

¡Gracias por elegirnos!
Equipo de Reservas
"""
        
        resend.Emails.send({
            "from": FROM_EMAIL,
            "to": cliente_email,
            "subject": f"🏨 Pre-Reserva Confirmada - {codigo_reserva}",
            "text": email_cliente
        })
        
        logger.info(f"✅ Email enviado a cliente: {cliente_email}")
        
        # Email al administrador
        if ADMIN_EMAIL:
            email_admin = f"""
📢 NUEVA PRE-RESERVA RECIBIDA

📋 DATOS DE LA RESERVA:
━━━━━━━━━━━━━━━━━━━━━━━━━━
🎟️ Código: {codigo_reserva}
🏨 Cabaña: {cabana}
📅 Check-in: {fecha_inicio}
📅 Check-out: {fecha_fin}

👤 DATOS DEL CLIENTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━
Nombre: {cliente_nombre}
Email: {cliente_email}
Teléfono: {telefono or "No proporcionado"}

⏳ Estado: PENDIENTE DE PAGO

Revisa el Dashboard para más detalles.
"""
            
            resend.Emails.send({
                "from": FROM_EMAIL,
                "to": ADMIN_EMAIL,
                "subject": f"📢 Nueva Reserva - {cabana} - {fecha_inicio}",
                "text": email_admin
            })
            
            logger.info(f"✅ Email enviado a admin: {ADMIN_EMAIL}")
        
        return True
        
    except ImportError:
        logger.error("❌ Módulo 'resend' no instalado. Ejecuta: pip install resend")
        return False
    except Exception as e:
        logger.error(f"❌ Error enviando email: {e}")
        return False
