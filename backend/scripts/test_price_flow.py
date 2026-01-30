#!/usr/bin/env python3
"""Test para verificar el flujo correcto de precio y cotización"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.agent import process_message

print("="*70)
print("TEST: Flujo correcto de Precio → Oferta de Cotización")
print("="*70)
print()

# Simular conversación completa
chat_history = [
    {"role": "user", "content": "Hola"},
    {"role": "assistant", "content": "¡Hola! Soy el asesor de MACI. ¿Qué necesitas?"},
    {"role": "user", "content": "quiero ver el carro aljibe"},
    {"role": "assistant", "content": "¡Excelente! El Carro Aljibe es súper versátil..."}
]

# PASO 1: Cliente pregunta el precio
print("PASO 1: Cliente pregunta el precio")
print("-" * 70)
result1 = process_message(
    user_message="¿Cuánto cuesta?",
    chat_history=chat_history,
    client_phone="56990702658"
)

print("RESPUESTA DEL AGENTE:")
print(result1.get("text", ""))
print()

# Verificar que NO generó cotización
if result1.get("documents"):
    print("❌ ERROR: Generó cotización cuando solo preguntó el precio")
else:
    print("✅ OK: No generó cotización automáticamente")

# Verificar que menciona el precio
if "$" in result1.get("text", "") or "precio" in result1.get("text", "").lower():
    print("✅ OK: Menciona el precio")
else:
    print("⚠️  ADVERTENCIA: No menciona el precio claramente")

# Verificar que ofrece la cotización
if "cotización" in result1.get("text", "").lower() or "cotizacion" in result1.get("text", "").lower():
    print("✅ OK: Ofrece preparar una cotización")
else:
    print("⚠️  ADVERTENCIA: No ofrece la cotización")

print()
print("="*70)
print("RESUMEN: El agente debe:")
print("1. ✓ Dar el precio")
print("2. ✓ Ofrecer preparar la cotización formal")
print("3. ✓ NO generar el PDF automáticamente")
print("="*70)
