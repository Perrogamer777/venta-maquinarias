#!/usr/bin/env python3
"""Test completo del flujo de precio y cotización - Varios escenarios"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.agent import process_message

print("="*70)
print("TEST COMPLETO: Flujo de Precio y Cotización")
print("="*70)
print()

# ============================================================================
# ESCENARIO 1: Pregunta precio → Ofrece cotización → Cliente acepta
# ============================================================================
print("\n" + "="*70)
print("ESCENARIO 1: Cliente pregunta precio, acepta cotización")
print("="*70)

chat1 = [
    {"role": "user", "content": "Hola"},
    {"role": "assistant", "content": "¡Hola! Soy el asesor de MACI."},
    {"role": "user", "content": "quiero ver el carro aljibe"},
    {"role": "assistant", "content": "Te envié las fotos del Carro Aljibe"}
]

print("\n1. Cliente pregunta: '¿Cuánto cuesta?'")
result1 = process_message("¿Cuánto cuesta?", chat1, "56990702658")
print("   Respuesta:")
print("   " + result1.get("text", "").replace("\n", "\n   "))

# Verificaciones
has_price = "$" in result1.get("text", "")
offers_quote = "cotización" in result1.get("text", "").lower() or "cotizacion" in result1.get("text", "").lower()
has_pdf = len(result1.get("documents", [])) > 0

print(f"\n   ✅ Menciona precio: {has_price}")
print(f"   ✅ Ofrece cotización: {offers_quote}")
print(f"   ✅ NO genera PDF: {not has_pdf}")

if has_price and offers_quote and not has_pdf:
    print("\n   ✓ ESCENARIO 1: CORRECTO")
else:
    print("\n   ✗ ESCENARIO 1: ERROR")

# ============================================================================
# ESCENARIO 2: Pregunta precio de otro producto
# ============================================================================
print("\n" + "="*70)
print("ESCENARIO 2: Precio de otro producto")
print("="*70)

chat2 = [
    {"role": "user", "content": "Hola"},
    {"role": "assistant", "content": "¡Hola! Soy el asesor de MACI."},
]

print("\n1. Cliente pregunta: 'cuanto vale el carro transporte de personal'")
result2 = process_message("cuanto vale el carro transporte de personal", chat2, "56990702658")
print("   Respuesta:")
print("   " + result2.get("text", "").replace("\n", "\n   "))

has_price2 = "$" in result2.get("text", "")
offers_quote2 = "cotización" in result2.get("text", "").lower() or "cotizacion" in result2.get("text", "").lower()
has_pdf2 = len(result2.get("documents", [])) > 0

print(f"\n   ✅ Menciona precio: {has_price2}")
print(f"   ✅ Ofrece cotización: {offers_quote2}")
print(f"   ✅ NO genera PDF: {not has_pdf2}")

if has_price2 and offers_quote2 and not has_pdf2:
    print("\n   ✓ ESCENARIO 2: CORRECTO")
else:
    print("\n   ✗ ESCENARIO 2: ERROR")

# ============================================================================
# ESCENARIO 3: Pide cotización directamente (sin preguntar precio antes)
# ============================================================================
print("\n" + "="*70)
print("ESCENARIO 3: Pide cotización directamente")
print("="*70)

chat3 = [
    {"role": "user", "content": "Hola"},
    {"role": "assistant", "content": "¡Hola! Soy el asesor de MACI."},
    {"role": "user", "content": "me interesa el carro aljibe"},
    {"role": "assistant", "content": "Te envié las fotos"}
]

print("\n1. Cliente dice: 'cotizame ese por favor'")
result3 = process_message("cotizame ese por favor", chat3, "56990702658")
print("   Respuesta:")
print("   " + result3.get("text", "").replace("\n", "\n   "))

asks_for_data = "nombre" in result3.get("text", "").lower() or "correo" in result3.get("text", "").lower() or "email" in result3.get("text", "").lower()

print(f"\n   ✅ Pide datos del cliente: {asks_for_data}")

if asks_for_data:
    print("\n   ✓ ESCENARIO 3: CORRECTO (pide datos para cotizar)")
else:
    print("\n   ✗ ESCENARIO 3: Debería pedir nombre y email")

# ============================================================================
# RESUMEN FINAL
# ============================================================================
print("\n" + "="*70)
print("RESUMEN FINAL")
print("="*70)

escenario1_ok = has_price and offers_quote and not has_pdf
escenario2_ok = has_price2 and offers_quote2 and not has_pdf2
escenario3_ok = asks_for_data

print(f"\nEscenario 1 (Precio → Ofrece cotización): {'✅ PASS' if escenario1_ok else '❌ FAIL'}")
print(f"Escenario 2 (Precio de otro producto): {'✅ PASS' if escenario2_ok else '❌ FAIL'}")
print(f"Escenario 3 (Pide cotización directa): {'✅ PASS' if escenario3_ok else '❌ FAIL'}")

if escenario1_ok and escenario2_ok and escenario3_ok:
    print("\n🎉 TODOS LOS ESCENARIOS PASARON - SISTEMA 100% FUNCIONAL")
else:
    print("\n⚠️  ALGUNOS ESCENARIOS FALLARON - REVISAR")

print("\n" + "="*70)
