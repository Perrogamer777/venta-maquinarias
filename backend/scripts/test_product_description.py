#!/usr/bin/env python3
"""Test para verificar la generación variada de descripciones de productos"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.agent import process_message

# Simular conversación con historial
chat_history = [
    {"role": "user", "content": "Hola"},
    {"role": "assistant", "content": "¡Hola! Soy el asesor de MACI. ¿Qué necesitas?"},
]

# Pedir ver un producto 3 veces para ver variación
print("=" * 70)
print("TEST: Verificando que las descripciones varíen cada vez")
print("=" * 70)
print()

for i in range(3):
    print(f"\n{'='*70}")
    print(f"INTENTO {i+1}: Pidiendo ver 'Carro Aljibe'")
    print('='*70)
    
    result = process_message(
        user_message="quiero ver fotos del carro aljibe",
        chat_history=chat_history,
        client_phone="56990702658"
    )
    
    print("\n📝 RESPUESTA DEL AGENTE:")
    print("-" * 70)
    print(result.get("text", ""))
    print()
    
    if result.get("images"):
        print(f"📷 Imágenes enviadas: {len(result.get('images'))} fotos")
    
    # Verificar que no haya líneas de guiones
    if "----------" in result.get("text", ""):
        print("❌ ERROR: Todavía contiene líneas de separación!")
    else:
        print("✅ OK: Sin líneas de separación")
    
    print()

print("\n" + "="*70)
print("✅ TEST COMPLETADO")
print("="*70)
