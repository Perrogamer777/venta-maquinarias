#!/usr/bin/env python3
"""Test conversación completa con Carro Aljibe."""
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.agent import process_message

print('SIMULACIÓN COMPLETA: Carro Aljibe')
print('=' * 70)

phone = '+56912345678'
history = []

# Paso 1: Pedir transporte
msg = 'necesito algo para transporte'
print(f'\n👤: {msg}')
r = process_message(msg, history, phone)
print(f'🤖: {r["text"][:150]}...')
history.extend([
    {'role': 'user', 'content': msg},
    {'role': 'assistant', 'content': r['text']}
])

if 'aljibe' in r['text'].lower():
    print('   ✅ Menciona Carro Aljibe')

# Paso 2: Pedir Carro Aljibe
msg = 'me interesa el carro aljibe'
print(f'\n👤: {msg}')
r = process_message(msg, history, phone)
print(f'🤖: {r["text"][:200]}...')
history.extend([
    {'role': 'user', 'content': msg},
    {'role': 'assistant', 'content': r['text']}
])

if 'no tengo' in r['text'].lower():
    print('   ❌ ERROR: Dice que no tiene (pero sí tiene)')
else:
    print('   ✅ Muestra info del Carro Aljibe')

# Paso 3: Preguntar precio
msg = 'cuanto cuesta?'
print(f'\n👤: {msg}')
r = process_message(msg, history, phone)
print(f'🤖: {r["text"]}')

print('\n' + '=' * 70)
if '$' in r['text']:
    print('✅ CORRECTO: Da el precio del Carro Aljibe')
else:
    print('❌ ERROR: No dio el precio')
