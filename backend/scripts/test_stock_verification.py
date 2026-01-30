#!/usr/bin/env python3
"""
Test que el agente verifica stock ANTES de recomendar productos.
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.agent import process_message

def test_stock_verification():
    """Prueba que el agente busque productos antes de recomendarlos."""
    
    phone_number = "+56912345999"  # Número de prueba
    
    print("=" * 80)
    print("TEST: VERIFICACIÓN DE STOCK ANTES DE RECOMENDAR")
    print("=" * 80)
    
    # Test 1: Pedir algo específico que probablemente no existe
    print("\n📝 TEST 1: Cliente pide 'arado de cincel'")
    print("-" * 80)
    
    message = "hola, necesito un arado de cincel"
    print(f"Cliente: {message}")
    
    response = process_message(message, chat_history=[], client_phone=phone_number)
    print(f"\n🤖 Agente: {response.get('text', 'ERROR')}")
    
    # Verificar si hay function_calls
    if response.get('function_calls'):
        print(f"\n✅ CORRECTO: El agente llamó a funciones:")
        for call in response['function_calls']:
            print(f"   - {call['name']}: {call.get('args', {})}")
        
        # Verificar que buscar_maquinaria fue llamado
        search_calls = [c for c in response['function_calls'] if c['name'] == 'buscar_maquinaria']
        if search_calls:
            print(f"\n✅ EXCELENTE: El agente buscó ANTES de recomendar")
        else:
            print(f"\n❌ ERROR: El agente NO buscó antes de recomendar")
    else:
        print(f"\n⚠️ ADVERTENCIA: No hubo llamadas a funciones")
    
    # Verificar que NO mencione productos específicos sin buscar
    # CORRECTO: "no tengo arado de cincel" ✅
    # INCORRECTO: "tengo arado de cincel" sin buscar ❌
    response_text = response.get('text', '').lower()
    mencionó_sin_buscar = False
    
    # Solo es error si dice que "tiene" o "tenemos" productos sin haber buscado
    if ("tengo" in response_text or "tenemos" in response_text):
        palabras_productos = ["rastra", "cultivador", "tractor"]  # Productos que sabemos no buscó
        mencionó_sin_buscar = any(f"tengo {p}" in response_text or f"tenemos {p}" in response_text for p in palabras_productos)
    
    if mencionó_sin_buscar and not response.get('function_calls'):
        print(f"\n❌ ERROR CRÍTICO: Mencionó productos sin buscar primero")
    
    print("\n" + "=" * 80)
    
    # Test 2: Pedir algo genérico
    print("\n📝 TEST 2: Cliente pide 'algo para mantenimiento de suelos'")
    print("-" * 80)
    
    message = "necesito algo para mantenimiento de suelos"
    print(f"Cliente: {message}")
    
    response = process_message(message, chat_history=[], client_phone=phone_number)
    print(f"\n🤖 Agente: {response.get('text', 'ERROR')}")
    
    if response.get('function_calls'):
        print(f"\n✅ El agente llamó a:")
        for call in response['function_calls']:
            print(f"   - {call['name']}: {call.get('args', {})}")
        
        search_calls = [c for c in response['function_calls'] if c['name'] == 'buscar_maquinaria']
        if search_calls:
            print(f"\n✅ PERFECTO: Buscó productos antes de recomendar")
            print(f"   Query usada: {search_calls[0].get('args', {})}")
    
    print("\n" + "=" * 80)
    
    # Test 3: Continuación - pedir detalles de lo que ofreció
    print("\n📝 TEST 3: Cliente pide más información sobre lo que el agente ofreció")
    print("-" * 80)
    
    message = "cuéntame más del primero"
    print(f"Cliente: {message}")
    
    response = process_message(message, chat_history=[], client_phone=phone_number)
    print(f"\n🤖 Agente: {response.get('text', 'ERROR')}")
    
    if response.get('function_calls'):
        print(f"\n✅ El agente llamó a:")
        for call in response['function_calls']:
            print(f"   - {call['name']}: {call.get('args', {})}")
    
    # Verificar que no diga "no tengo fotos disponibles" si mencionó el producto antes
    if "no tengo fotos" in response.get('text', '').lower():
        print(f"\n❌ ERROR: Ofreció un producto que no tiene")
    else:
        print(f"\n✅ CORRECTO: Respuesta coherente")
    
    print("\n" + "=" * 80)
    print("✅ PRUEBAS COMPLETADAS")
    print("=" * 80)

if __name__ == "__main__":
    test_stock_verification()
