#!/bin/bash

# Script para actualizar variables de entorno en Cloud Run
set -e

PROJECT_ID="silken-fortress-479315-b0"
REGION="us-central1"
SERVICE_NAME="dashboard-cipres"

echo "🔐 Leyendo variables de .env.local..."
source .env.local

echo "📤 Actualizando variables de entorno en Cloud Run..."
gcloud run services update $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --update-env-vars "\
NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY,\
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,\
NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID,\
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,\
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,\
NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID"

echo "✅ Variables actualizadas. Cloud Run está reconstruyendo el servicio..."
echo ""
echo "⏳ Espera 1-2 minutos y recarga la página del dashboard"
