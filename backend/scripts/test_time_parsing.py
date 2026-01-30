#!/usr/bin/env python3
"""Test para verificar el parsing de horas"""
import re
from datetime import datetime, timedelta, timezone

# Chile está en UTC-3
chile_tz = timezone(timedelta(hours=-3))
now = datetime.now(chile_tz)

print(f'⏰ Hora actual: {now.strftime("%Y-%m-%d %H:%M")}')
print('='*60)
print()

test_cases = [
    'hoy a las 14:00 hrs',
    'hoy a las 14hrs',
    'mañana 3pm',
    'hoy 15:30',
    'viernes 10am',
    'hoy 2pm',
    'hoy 16hrs',
    'hoy 9am',
    'mañana 10:30'
]

for meeting_time in test_cases:
    meeting_time_lower = meeting_time.lower().strip()
    hour = 10
    minute = 0
    
    # Buscar formato HH:MM
    time_match = re.search(r'(\d{1,2}):(\d{2})', meeting_time_lower)
    if time_match:
        hour = int(time_match.group(1))
        minute = int(time_match.group(2))
    else:
        # Buscar formato número solo
        ampm_match = re.search(r'(\d{1,2})\s*(hrs?|am|pm)?', meeting_time_lower)
        if ampm_match:
            hour = int(ampm_match.group(1))
            suffix = ampm_match.group(2) or ''
            
            if 'hr' in suffix:
                pass  # Ya es formato 24h
            elif 'pm' in suffix and hour < 12:
                hour += 12
            elif 'am' in suffix and hour == 12:
                hour = 0
            elif not suffix and 1 <= hour <= 7:
                hour += 12  # Asumir PM para 1-7
    
    days_offset = 0
    if 'mañana' in meeting_time_lower:
        days_offset = 1
    elif 'hoy' in meeting_time_lower:
        days_offset = 0
    
    target_date = now + timedelta(days=days_offset)
    scheduled_at = target_date.replace(hour=hour, minute=minute, second=0, microsecond=0)
    
    status = '✅' if scheduled_at > now else '❌'
    
    print(f'{status} Input: "{meeting_time}"')
    print(f'   → Hora parseada: {hour:02d}:{minute:02d}')
    print(f'   → Fecha calculada: {scheduled_at.strftime("%Y-%m-%d %H:%M")}')
    print(f'   → Válida: {"Sí" if scheduled_at > now else "No (en el pasado)"}')
    print()
