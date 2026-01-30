#!/usr/bin/env python3
"""
Test de los problemas reportados por el usuario.
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.agent import process_message

def test_scenario_1():
    """Test: Pregunta precio después de ver fotos."""
    print("=" * 80)
    print("TEST 1: Consultar precio después de ver producto")
    print("=" * 80)
    
    phone = "+56912345678"
    
    # Simular historial de conversación
    history = [
        {"role": "user", "content": "necesito algo para transporte"},
        {"role": "assistant", "content": "¡Excelente! Para transporte tenemos: 1. Carro abonador para frutales..."},
        {"role": "user", "content": "me interesa el carro abonador para frutales"},
        {"role": "assistant", "content": "¡Excelente! Tenemos esta opción..."},
        {"role": "user", "content": "si"},
        {"role": "assistant", "content": "📷 Carro abonador para frutales... [descripción completa]"}
    ]
    
    print("\n👤 Cliente: cuanto cuesta?")
    response = process_message("cuanto cuesta?", chat_history=history, client_phone=phone)
    print(f"🤖 Agente: {response['text']}\n")
    
    if "$" in response['text'] or "precio" in response['text'].lower():
        print("✅ Da el precio directamente sin volver a buscar")
    else:
        print("❌ No dio el precio o volvió a buscar el producto")

def test_scenario_2():
    """Test: Carro Aljibe debe estar disponible."""
    print("\n" + "=" * 80)
    print("TEST 2: Verificar disponibilidad de Carro Aljibe")
    print("=" * 80)
    
    phone = "+56912345678"
    
    # Primera consulta: buscar transporte
    print("\n👤 Cliente: necesito algo para transporte")
    response1 = process_message("necesito algo para transporte", chat_history=[], client_phone=phone)
    print(f"🤖 Agente: {response1['text'][:200]}...")
    
    if "aljibe" in response1['text'].lower():
        print("✅ Carro Aljibe aparece en la lista inicial")
    else:
        print("⚠️ Carro Aljibe NO aparece en lista inicial")
    
    # Luego preguntar específicamente por Carro Aljibe
    history = [
        {"role": "user", "content": "necesito algo para transporte"},
        {"role": "assistant", "content": response1['text']}
    ]
    
    print("\n👤 Cliente: me interesa el carro aljibe")
    response2 = process_message("me interesa el carro aljibe", chat_history=history, client_phone=phone)
    print(f"🤖 Agente: {response2['text']}\n")
    
    if "no tengo" in response2['text'].lower() or "no está en stock" in response2['text'].lower():
        print("❌ ERROR: Dice que NO tiene Carro Aljibe (pero debería tenerlo)")
    else:
        print("✅ Responde correctamente sobre Carro Aljibe")

def test_scenario_3():
    """Test: Verificar que Carro Aljibe existe en inventario."""
    print("\n" + "=" * 80)
    print("TEST 3: Verificar inventario de Carro Aljibe")
    print("=" * 80)
    
    from app.services.maquinarias import search_maquinarias
    
    results = search_maquinarias("carro aljibe")
    print(f"\n🔍 Búsqueda 'carro aljibe': {len(results)} resultados")
    
    if results:
        for r in results:
            print(f"   - {r['nombre']} (Stock: {r.get('stock_status', 'N/A')})")
        print("\n✅ Carro Aljibe SÍ está en inventario")
    else:
        print("\n❌ Carro Aljibe NO encontrado en inventario")
    
    # Buscar solo "aljibe"
    results2 = search_maquinarias("aljibe")
    print(f"\n🔍 Búsqueda 'aljibe': {len(results2)} resultados")
    if results2:
        for r in results2:
            print(f"   - {r['nombre']}")

if __name__ == "__main__":
    test_scenario_3()  # Primero verificar inventario
    test_scenario_2()  # Luego probar disponibilidad
    test_scenario_1()  # Finalmente probar consulta de precio
    
    print("\n" + "=" * 80)
    print("✅ TESTS COMPLETADOS")
    print("=" * 80)
