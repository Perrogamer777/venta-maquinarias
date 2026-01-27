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
│   │   └── webhook.py       # Rutas del webhook
│   └── services/
│       ├── agent.py         # Lógica Gemini
│       ├── firebase.py      # Almacenamiento
│       └── whatsapp.py      # Envío de mensajes
├── requirements.txt
└── Dockerfile
```

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
