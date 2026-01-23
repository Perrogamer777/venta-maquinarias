#!/bin/bash

# Script para build y deploy manual con Docker
set -e

PROJECT_ID="silken-fortress-479315-b0"
REGION="us-central1"
SERVICE_NAME="dashboard-cipres"
IMAGE_NAME="gcr.io/$PROJECT_ID/$SERVICE_NAME"

echo "🔐 Leyendo variables de .env.local..."
source .env.local

echo "🐳 Haciendo build de la imagen Docker (amd64)..."
docker build \
  --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_FIREBASE_API_KEY="$NEXT_PUBLIC_FIREBASE_API_KEY" \
  --build-arg NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN" \
  --build-arg NEXT_PUBLIC_FIREBASE_PROJECT_ID="$NEXT_PUBLIC_FIREBASE_PROJECT_ID" \
  --build-arg NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET" \
  --build-arg NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID" \
  --build-arg NEXT_PUBLIC_FIREBASE_APP_ID="$NEXT_PUBLIC_FIREBASE_APP_ID" \
  -t $IMAGE_NAME:latest \
  .

echo "📤 Configurando Docker para GCR..."
gcloud auth configure-docker --quiet

echo "📦 Subiendo imagen a Google Container Registry..."
docker push $IMAGE_NAME:latest

echo "🚀 Desplegando a Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_NAME:latest \
  --platform managed \
  --region $REGION \
  --project $PROJECT_ID \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1

echo ""
echo "✅ Deploy completado!"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --project $PROJECT_ID --format 'value(status.url)')
echo "🌐 URL: $SERVICE_URL"
echo ""
echo "🔍 Verifica en la consola que ahora veas: hasApiKey: true, hasProjectId: true"
