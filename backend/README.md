# MACI WhatsApp Backend

Backend estructurado para el agente de WhatsApp de ventas de maquinaria.

## Estructura

```
backend/
├── app/
│   ├── main.py              # FastAPI app principal
│   ├── core/
│   │   └── config.py        # Configuración
│   ├── api/
│   │   ├── webhook.py       # Rutas del webhook
│   │   └── meetings.py      # API de reuniones
│   └── services/
│       ├── agent.py         # Lógica Gemini
│       ├── firebase.py      # Almacenamiento
│       ├── maquinarias.py   # Búsqueda de productos
│       ├── quotation.py     # Generación de cotizaciones
│       └── whatsapp.py      # Envío de mensajes
├── scripts/
│   └── cleanup_old_meetings.py  # Script de limpieza
├── requirements.txt
└── Dockerfile
```

## Scripts de Mantenimiento

### Limpieza de Reuniones Antiguas

El script `cleanup_old_meetings.py` permite limpiar reuniones de la base de datos:

```bash
# Ver qué se eliminaría (dry-run)
python3 scripts/cleanup_old_meetings.py --dry-run

# Eliminar reuniones canceladas con más de 30 días
python3 scripts/cleanup_old_meetings.py

# Eliminar reuniones canceladas con más de 7 días
python3 scripts/cleanup_old_meetings.py --days 7

# Eliminar TODAS las reuniones canceladas
python3 scripts/cleanup_old_meetings.py --days 0
```

El script elimina automáticamente:
- Reuniones sin `scheduled_at` (reuniones mal creadas)
- Reuniones canceladas con más de X días de antigüedad

## Deployment

```bash
gcloud run deploy venta-maquinarias-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --project venta-maquinarias
```

## Webhook Configuration

- **URL**: `https://your-url.run.app/webhook`
- **Verify Token**: `maquinaria123`
