"""
Script para insertar datos de demostración de reservas en Firestore.
Ejecutar una sola vez: python -m app.scripts.seed_reservations
"""
from datetime import datetime, timedelta
import random

# Usar el mismo db ya inicializado del app
from app.services.firebase import db

# Datos chilenos de demostración
CABANAS = ["Cabaña Laurel", "Cabaña Ciprés", "Yurta Mirador", "Cabaña Castaño"]
ESTADOS = ["PENDIENTE_PAGO", "CONFIRMADA", "CANCELADA", "COMPLETADA"]

NOMBRES = [
    "María José González Pérez",
    "Juan Pablo Muñoz Silva",
    "Carla Andrea Soto Rojas",
    "Pedro Antonio Fernández López",
    "Ana María Díaz Torres",
    "Diego Alejandro Morales Herrera",
    "Laura Valentina Contreras Vera",
    "Andrés Felipe Espinoza Núñez",
    "Camila Ignacia Fuentes Araya",
    "Felipe Sebastián Guzmán Bravo",
    "Valentina Paz Jiménez Castro",
    "Sebastián Nicolás Reyes Vargas",
    "Francisca Belén Ortiz Pizarro",
    "Matías Ignacio Cornejo Aravena",
    "Javiera Constanza Tapia Molina",
    "Rodrigo Andrés Vega Sandoval",
    "Catalina Isabel Riquelme Medina",
    "Cristóbal Eduardo Lagos Paredes",
    "Antonia Sofía Bustos Carrasco",
    "Tomás Alejandro Navarro Figueroa"
]

TELEFONOS_CHILENOS = [
    "+56912345678", "+56923456789", "+56934567890", "+56945678901", "+56956789012",
    "+56967890123", "+56978901234", "+56989012345", "+56990123456", "+56901234567",
    "+56911223344", "+56922334455", "+56933445566", "+56944556677", "+56955667788",
    "+56966778899", "+56977889900", "+56988990011", "+56999001122", "+56900112233"
]


def generate_email(nombre):
    """Genera email basado en el nombre."""
    parts = nombre.lower().split()
    email = f"{parts[0]}.{parts[-1]}@gmail.com"
    return email.replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ñ", "n")


def random_date_oct_nov_dec_2025():
    """Genera una fecha aleatoria entre Oct-Dic 2025."""
    # Inicio: 1 de octubre 2025, Fin: 31 de diciembre 2025
    start = datetime(2025, 10, 1)
    end = datetime(2025, 12, 31)
    delta = (end - start).days
    random_days = random.randint(0, delta)
    return start + timedelta(days=random_days)


def generate_reservations():
    """Genera 20 reservas de demostración."""
    reservations = []
    today = datetime(2025, 12, 18)  # Fecha actual de referencia
    
    for i in range(20):
        nombre = NOMBRES[i]
        
        # Generar fecha de reserva en Oct-Nov-Dic 2025
        fecha_inicio = random_date_oct_nov_dec_2025()
        noches = random.randint(2, 5)
        fecha_fin = fecha_inicio + timedelta(days=noches)
        
        # Fecha de creación: 1-14 días antes de la fecha de inicio
        created_at = fecha_inicio - timedelta(days=random.randint(1, 14))
        
        # Determinar estado basado en fecha
        if fecha_fin < today:
            estado = random.choice(["COMPLETADA", "CANCELADA", "COMPLETADA"])
        elif fecha_inicio <= today <= fecha_fin:
            estado = "CONFIRMADA"
        else:
            estado = random.choice(["PENDIENTE_PAGO", "CONFIRMADA", "PENDIENTE_PAGO"])
        
        # Algunas específicamente canceladas para variedad
        if i in [3, 8, 14, 18]:
            estado = "CANCELADA"
        
        # Generar código único
        codigo = f"RES-{''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=4))}"
        
        reservations.append({
            "cabana": random.choice(CABANAS),
            "cliente_email": generate_email(nombre),
            "cliente_nombre": nombre,
            "cliente_telefono": TELEFONOS_CHILENOS[i],
            "codigo_reserva": codigo,
            "created_at": created_at,
            "estado": estado,
            "fecha_fin": fecha_fin.strftime("%d/%m/%Y"),
            "fecha_inicio": fecha_inicio.strftime("%d/%m/%Y"),
            "origen": "WhatsApp Bot"
        })
    
    return reservations


def seed():
    """Inserta las reservas en Firestore."""
    print("Insertando 20 reservas de demostración (Oct-Dic 2025)...")
    
    reservations = generate_reservations()
    
    for i, res in enumerate(reservations):
        doc_ref = db.collection('reservas').document()
        doc_ref.set(res)
        print(f"  {i+1:2}. {res['codigo_reserva']} | {res['cliente_nombre'][:25]:<25} | {res['cabana']:<15} | {res['estado']:<15} | {res['fecha_inicio']}")
    
    print(f"\n ¡{len(reservations)} reservas insertadas exitosamente!")
    
    # Resumen por estado
    estados = {}
    for res in reservations:
        estado = res['estado']
        estados[estado] = estados.get(estado, 0) + 1
    
    print("\n -Resumen por estado:")
    for estado, count in sorted(estados.items()):
        print(f"   • {estado}: {count}")
    
    # Resumen por mes
    print("\n -Resumen por mes:")
    meses = {"10": 0, "11": 0, "12": 0}
    for res in reservations:
        mes = res['fecha_inicio'].split('/')[1]
        meses[mes] = meses.get(mes, 0) + 1
    print(f"   • Octubre: {meses.get('10', 0)}")
    print(f"   • Noviembre: {meses.get('11', 0)}")
    print(f"   • Diciembre: {meses.get('12', 0)}")


if __name__ == "__main__":
    seed()
