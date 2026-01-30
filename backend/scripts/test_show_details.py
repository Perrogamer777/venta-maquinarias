#!/usr/bin/env python3
"""Test: mostrar detalles cuando cliente dice 'me interesa X'."""
import sys
from pathlib import Path

backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from app.services.agent import process_message

print('TEST: "me interesa X" debe mostrar fotos AUTOMÁTICAMENTE')
print('=' * 70)

phone = '+56912345678'
history = []

# Paso 1: Listar opciones de transporte
msg = 'necesito algo para transporte'
print(f'\n👤: {msg}')
r1 = process_message(msg, history, phone)
print(f'🤖: {r1["text"][:120]}...')
history.extend([
    {'role': 'user', 'content': msg},
    {'role': 'assistant', 'content': r1['text']}
])

# Paso 2: Cliente dice "me interesa el carro aljibe"
msg = 'me interesa el carro aljibe'
print(f'\n👤: {msg}')
r2 = process_message(msg, history, phone)
print(f'🤖: {r2["text"][:300]}...')

if r2.get('images'):
    print(f'\n📷 Imágenes enviadas: {len(r2["images"])} foto(s)')

print('\n' + '=' * 70)

# Validaciones
errors = []

if '¿te interesa ver fotos?' in r2['text'].lower() or '¿quieres que te muestre?' in r2['text'].lower():
    errors.append("❌ Pregunta si quiere ver fotos (debe enviarlas directamente)")

if 'dime cuál' in r2['text'].lower():
    errors.append("❌ Dice 'dime cuál' cuando ya le dijeron cuál")

if '1. carro aljibe' in r2['text'].lower() or '1.⁠ ⁠carro aljibe' in r2['text'].lower():
    errors.append("❌ Hace lista de un solo producto (innecesario)")

if not r2.get('images'):
    errors.append("❌ NO envió imágenes automáticamente")

if '📷' not in r2['text'] and 'carro aljibe' in r2['text'].lower():
    # Si menciona el producto pero no tiene emoji de cámara, posiblemente no mostró fotos
    pass

if errors:
    print('\n'.join(errors))
else:
    print('✅ CORRECTO: Envía descripción e imágenes automáticamente')
    print('✅ NO pregunta si quiere ver fotos')
    print('✅ Presenta el producto directamente')
