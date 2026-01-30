#!/usr/bin/env python3
"""Script de prueba para agendamiento de reuniones"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.firebase import schedule_meeting, get_all_meetings, db

# Limpiar todas las reuniones
print('Limpiando reuniones existentes...')
docs = list(db.collection('meetings').stream())
for doc in docs:
    doc.reference.delete()
print(f'Eliminadas {len(docs)} reuniones')
print()

# Test: Agendar para hoy a las 14:00 hrs
print('TEST: "hoy a las 14:00 hrs"')
print('-' * 50)
result = schedule_meeting(
    phone='56990702658',
    client_email='luis.olavarria@gmail.com',
    meeting_time='hoy a las 14:00 hrs',
    meeting_type='llamada telefonica'
)
print(f'Resultado: {"Exito" if result else "Error"}')
print()

# Verificar lo guardado
print('REUNIONES GUARDADAS:')
print('=' * 60)
meetings = get_all_meetings()
for i, m in enumerate(meetings, 1):
    print(f'{i}. Preferred: {m.get("preferred_time")}')
    print(f'   Scheduled: {m.get("scheduled_at")}')
    print(f'   Email: {m.get("email")}')
    print()
