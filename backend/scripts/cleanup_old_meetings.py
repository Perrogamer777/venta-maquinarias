#!/usr/bin/env python3
"""
Script para limpiar reuniones antiguas de la base de datos.
- Elimina reuniones canceladas con más de 30 días
- Elimina reuniones sin scheduled_at
"""
import sys
import os
from datetime import datetime, timezone, timedelta

# Agregar el directorio padre al path para importar el módulo app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.firebase import db


def cleanup_old_meetings(days_old: int = 30, dry_run: bool = False):
    """
    Limpia reuniones antiguas de la base de datos.
    
    Args:
        days_old: Eliminar reuniones canceladas con más de X días
        dry_run: Si es True, solo muestra lo que se eliminaría sin eliminarlo
    """
    print('=== LIMPIEZA DE REUNIONES ANTIGUAS ===')
    print(f'Días de antigüedad: {days_old}')
    print(f'Modo: {"DRY RUN (no se eliminará nada)" if dry_run else "ELIMINACIÓN REAL"}')
    print()
    
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=days_old)
    
    # Obtener todas las reuniones
    docs = list(db.collection('meetings').stream())
    
    to_delete = []
    
    for doc in docs:
        data = doc.to_dict()
        should_delete = False
        reason = ""
        
        # Caso 1: Reuniones sin scheduled_at
        if data.get('scheduled_at') is None:
            should_delete = True
            reason = "Sin fecha programada"
        
        # Caso 2: Reuniones canceladas antiguas
        elif data.get('status') == 'cancelada':
            created_at = data.get('created_at')
            if created_at and hasattr(created_at, 'replace'):
                if created_at < cutoff_date:
                    should_delete = True
                    reason = f"Cancelada hace más de {days_old} días"
        
        if should_delete:
            to_delete.append({
                'doc': doc,
                'data': data,
                'reason': reason
            })
    
    print(f'Encontradas {len(to_delete)} reuniones para eliminar:')
    print()
    
    for item in to_delete:
        data = item['data']
        print(f'ID: {item["doc"].id}')
        print(f'  Email: {data.get("email", "Sin email")}')
        print(f'  Status: {data.get("status")}')
        print(f'  Scheduled: {data.get("scheduled_at")}')
        print(f'  Created: {data.get("created_at")}')
        print(f'  Razón: {item["reason"]}')
        
        if not dry_run:
            item['doc'].reference.delete()
            print('  ✓ ELIMINADA')
        else:
            print('  (NO ELIMINADA - DRY RUN)')
        print()
    
    if dry_run:
        print(f'✓ DRY RUN completado: {len(to_delete)} reuniones SE ELIMINARÍAN')
        print('Ejecuta sin --dry-run para eliminarlas realmente')
    else:
        print(f'✓ Limpieza completada: {len(to_delete)} reuniones eliminadas')


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Limpia reuniones antiguas de Firestore')
    parser.add_argument('--days', type=int, default=30, 
                        help='Eliminar reuniones canceladas con más de X días (default: 30)')
    parser.add_argument('--dry-run', action='store_true',
                        help='Mostrar lo que se eliminaría sin eliminarlo')
    
    args = parser.parse_args()
    
    cleanup_old_meetings(days_old=args.days, dry_run=args.dry_run)
