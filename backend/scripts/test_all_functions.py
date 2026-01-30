#!/usr/bin/env python3
"""
Test comprehensivo de todas las funciones del agente.
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.agent import process_message

def print_section(title):
    """Imprime sección con formato."""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def print_test(test_name):
    """Imprime nombre del test."""
    print(f"\n📝 {test_name}")
    print("-" * 80)

def send_message(message, phone="+56912345678"):
    """Envía mensaje y muestra respuesta."""
    print(f"👤 Cliente: {message}")
    response = process_message(message, chat_history=[], client_phone=phone)
    print(f"\n🤖 Agente: {response.get('text', 'ERROR')}")
    
    if response.get('images'):
        print(f"\n📷 Imágenes enviadas: {len(response['images'])} foto(s)")
        for i, img in enumerate(response['images'][:2], 1):
            print(f"   {i}. {img[:60]}...")
    
    return response

def main():
    print_section("TEST COMPREHENSIVO - TODAS LAS FUNCIONES DEL AGENTE")
    
    # ========================================================================
    # TEST 1: BÚSQUEDA DE PRODUCTOS
    # ========================================================================
    print_section("FUNCIÓN 1: buscar_maquinaria")
    
    print_test("1.1 - Búsqueda de producto que NO existe")
    response = send_message("busco un arado de discos")
    if "no tengo" in response['text'].lower() or "no encontré" in response['text'].lower():
        print("✅ Responde correctamente cuando no hay stock")
    else:
        print("⚠️ La respuesta podría ser más clara sobre falta de stock")
    
    print_test("1.2 - Búsqueda de producto que SÍ existe")
    response = send_message("necesito un carro transportador")
    if "carro" in response['text'].lower():
        print("✅ Encuentra y muestra productos disponibles")
    else:
        print("❌ No mostró productos existentes")
    
    print_test("1.3 - Búsqueda vaga (debe hacer preguntas)")
    response = send_message("qué máquinas tienes?")
    if "?" in response['text']:  # Debe hacer preguntas
        print("✅ Hace preguntas para entender necesidad")
    else:
        print("⚠️ Debería hacer más preguntas antes de listar")
    
    # ========================================================================
    # TEST 2: MOSTRAR IMÁGENES
    # ========================================================================
    print_section("FUNCIÓN 2: mostrar_imagenes_por_nombre")
    
    print_test("2.1 - Solicitar fotos de producto existente")
    response = send_message("muéstrame fotos del carro transportador de bins")
    if response.get('images') or "foto" in response['text'].lower():
        print("✅ Muestra o menciona imágenes del producto")
    else:
        print("⚠️ No hay imágenes o no respondió adecuadamente")
    
    print_test("2.2 - Solicitar fotos de producto inexistente")
    response = send_message("quiero ver fotos del arado de cincel")
    if "no tengo" in response['text'].lower() or not response.get('images'):
        print("✅ Responde correctamente cuando no hay producto")
    else:
        print("❌ Envió imágenes de algo que no tiene")
    
    # ========================================================================
    # TEST 3: CONSULTA DE PRECIOS
    # ========================================================================
    print_section("FUNCIÓN 3: Flujo de Precios y Cotización")
    
    print_test("3.1 - Consultar precio de producto")
    response = send_message("cuánto cuesta el carro aljibe?")
    if "$" in response['text'] or "precio" in response['text'].lower():
        print("✅ Proporciona información de precio")
    else:
        print("⚠️ No mencionó precio claramente")
    
    print_test("3.2 - Verificar que NO genera cotización automáticamente")
    if "pdf" not in response['text'].lower() and "cotización generada" not in response['text'].lower():
        print("✅ NO genera cotización automáticamente")
    else:
        print("❌ Generó cotización sin que el cliente la pidiera")
    
    print_test("3.3 - Solicitar cotización explícitamente")
    response = send_message("sí, genera una cotización para el carro aljibe por favor")
    if "cotización" in response['text'].lower() or "cotizacion" in response['text'].lower():
        print("✅ Genera cotización cuando el cliente lo solicita")
    else:
        print("⚠️ No generó la cotización solicitada")
    
    # ========================================================================
    # TEST 4: DESCUENTOS
    # ========================================================================
    print_section("FUNCIÓN 4: Manejo de Descuentos")
    
    print_test("4.1 - Cliente solicita descuento razonable (5%)")
    response = send_message("me puedes hacer un 5% de descuento?")
    if "descuento" in response['text'].lower():
        print("✅ Responde sobre descuento")
        if "actualiza" in response['text'].lower() or "nuevo precio" in response['text'].lower():
            print("✅ Aplica el descuento correctamente")
    else:
        print("⚠️ No procesó la solicitud de descuento")
    
    print_test("4.2 - Cliente solicita descuento excesivo (20%)")
    response = send_message("dame un 20% de descuento")
    if "10%" in response['text'] or "máximo" in response['text'].lower():
        print("✅ Limita descuento correctamente (máx 10%)")
    else:
        print("⚠️ Debería mencionar el límite de descuento")
    
    # ========================================================================
    # TEST 5: AGENDAR REUNIÓN
    # ========================================================================
    print_section("FUNCIÓN 5: agendar_reunion")
    
    print_test("5.1 - Cliente quiere más información presencial")
    response = send_message("me gustaría una reunión para ver opciones")
    if "reunión" in response['text'].lower() or "reunion" in response['text'].lower():
        print("✅ Reconoce solicitud de reunión")
    else:
        print("⚠️ No reconoció la solicitud de reunión")
    
    print_test("5.2 - Proporcionar datos para agendar")
    response = send_message("sí, mi email es juan@test.cl y mi teléfono es +56912345678, para mañana a las 14hrs")
    if "agend" in response['text'].lower():
        print("✅ Procesa y agenda la reunión")
        if "14" in response['text'] or "mañana" in response['text'].lower():
            print("✅ Confirma horario correctamente")
    else:
        print("⚠️ No agendó la reunión correctamente")
    
    # ========================================================================
    # TEST 6: CONVERSACIÓN NATURAL
    # ========================================================================
    print_section("FUNCIÓN 6: Calidad Conversacional")
    
    print_test("6.1 - Saludo inicial")
    response = send_message("hola")
    if "hola" in response['text'].lower() and "?" in response['text']:
        print("✅ Saluda y hace preguntas naturales")
    else:
        print("⚠️ Respuesta poco conversacional")
    
    print_test("6.2 - Tono y formato (sin doble asterisco)")
    if "**" not in response['text']:
        print("✅ Formato correcto (usa asterisco simple)")
    else:
        print("❌ Usa doble asterisco (incorrecto para WhatsApp)")
    
    print_test("6.3 - Respuesta debe ser concisa")
    word_count = len(response['text'].split())
    if word_count < 100:
        print(f"✅ Respuesta concisa ({word_count} palabras)")
    else:
        print(f"⚠️ Respuesta muy larga ({word_count} palabras)")
    
    # ========================================================================
    # TEST 7: MANEJO DE ERRORES
    # ========================================================================
    print_section("FUNCIÓN 7: Manejo de Casos Extremos")
    
    print_test("7.1 - Mensaje confuso o sin sentido")
    response = send_message("asdfgh xyz 123")
    if response.get('text') and len(response['text']) > 10:
        print("✅ Responde apropiadamente a mensaje confuso")
    else:
        print("⚠️ No manejó bien el mensaje confuso")
    
    print_test("7.2 - Cliente pide algo fuera del alcance")
    response = send_message("puedes enviarme un libro de recetas?")
    if "maquinaria" in response['text'].lower() or "agrícola" in response['text'].lower():
        print("✅ Redirige conversación a su ámbito")
    else:
        print("⚠️ No redirigió adecuadamente")
    
    # ========================================================================
    # RESUMEN FINAL
    # ========================================================================
    print_section("RESUMEN DE PRUEBAS COMPLETADAS")
    
    print("""
    ✅ Funciones testeadas:
    1. buscar_maquinaria - Búsqueda de productos
    2. mostrar_imagenes_por_nombre - Envío de fotos
    3. Consulta de precios y flujo de cotización
    4. Manejo de descuentos (límite 10%)
    5. agendar_reunion - Agendamiento de reuniones
    6. Calidad conversacional y formato
    7. Manejo de casos extremos
    
    📋 Revisa los resultados arriba para identificar áreas de mejora.
    """)
    
    print("=" * 80)
    print("✅ TEST COMPREHENSIVO COMPLETADO")
    print("=" * 80)

if __name__ == "__main__":
    main()
