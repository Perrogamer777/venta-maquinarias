"""
Script para insertar datos de prueba de valorPotencial en chats existentes.
Ejecutar: python -m app.scripts.seed_valor_potencial
"""
from app.services.firebase import db
from datetime import datetime, timedelta
import random


# Datos de ejemplo
CABANAS_EJEMPLO = [
    {"nombre": "Cabaña Laurel", "precioPorNoche": 85000},
    {"nombre": "Cabaña Ciprés", "precioPorNoche": 95000},
    {"nombre": "Yurta Mirador", "precioPorNoche": 75000},
    {"nombre": "Cabaña Castaño", "precioPorNoche": 120000},
]


def seed_valor_potencial():
    """Agrega valorPotencial a chats existentes para demostración."""
    print("💰 Insertando datos de valorPotencial en chats...")
    
    # Obtener todos los chats existentes
    chats = list(db.collection('chats').stream())
    
    if not chats:
        print("⚠️  No hay chats existentes. Creando chats de ejemplo...")
        # Crear algunos chats de ejemplo
        telefonos_ejemplo = [
            "56912345678",
            "56923456789",
            "56934567890",
            "56945678901",
            "56956789012"
        ]
        for tel in telefonos_ejemplo:
            db.collection('chats').document(tel).set({
                "phone": tel,
                "clientName": f"Cliente Demo {tel[-4:]}",
                "lastMessageAt": datetime.now(),
                "agentePausado": False
            })
        chats = list(db.collection('chats').stream())
    
    print(f"📋 Encontrados {len(chats)} chats")
    
    # Agregar valorPotencial a algunos chats (no todos)
    actualizados = 0
    for i, chat in enumerate(chats):
        # Solo agregar a ~70% de los chats para variedad
        if random.random() > 0.7:
            print(f"  ⏭️  Saltando {chat.id} (sin intención de reserva)")
            continue
        
        cabana = random.choice(CABANAS_EJEMPLO)
        noches = random.randint(2, 5)
        
        # Generar fechas futuras
        fecha_inicio = datetime.now() + timedelta(days=random.randint(7, 60))
        fecha_fin = fecha_inicio + timedelta(days=noches)
        
        valor_potencial = {
            "monto": cabana["precioPorNoche"] * noches,
            "cabana": cabana["nombre"],
            "fechaInicio": fecha_inicio.strftime("%Y-%m-%d"),
            "fechaFin": fecha_fin.strftime("%Y-%m-%d"),
            "noches": noches,
            "precioPorNoche": cabana["precioPorNoche"],
            "actualizadoEn": datetime.now()
        }
        
        # Actualizar chat sin sobrescribir otros campos
        db.collection('chats').document(chat.id).update({
            "valorPotencial": valor_potencial
        })
        
        print(f"  ✅ {chat.id}: {cabana['nombre']} x {noches} noches = ${valor_potencial['monto']:,}")
        actualizados += 1
    
    print(f"\n🎉 {actualizados} chats actualizados con valorPotencial")
    
    # Mostrar resumen de valores
    total = sum([
        chat.to_dict().get('valorPotencial', {}).get('monto', 0)
        for chat in db.collection('chats').stream()
        if chat.to_dict().get('valorPotencial')
    ])
    
    print(f"\n💰 Valor potencial total: ${total:,}")


if __name__ == "__main__":
    seed_valor_potencial()
