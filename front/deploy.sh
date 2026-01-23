#!/bin/bash

# Script de Deployment para Dashboard CIPRES en Google Cloud Run
# Uso: ./deploy.sh [PROJECT_ID] [REGION]

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuración
PROJECT_ID=${1:-""}
REGION=${2:-"us-central1"}
SERVICE_NAME="dashboard-cipres"

echo -e "${GREEN}🚀 Dashboard CIPRES - Deployment Script${NC}"
echo "================================================"

# Verificar que se proporcionó PROJECT_ID
if [ -z "$PROJECT_ID" ]; then
    echo -e "${RED}❌ Error: Debes proporcionar el PROJECT_ID${NC}"
    echo "Uso: ./deploy.sh PROJECT_ID [REGION]"
    echo "Ejemplo: ./deploy.sh mi-proyecto-gcp us-central1"
    exit 1
fi

# Verificar que gcloud esté instalado
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}❌ Error: gcloud CLI no está instalado${NC}"
    echo "Instala desde: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Verificar archivo .env.local
if [ ! -f ".env.local" ]; then
    echo -e "${RED}❌ Error: Archivo .env.local no encontrado${NC}"
    echo "Crea el archivo con tus credenciales de Firebase"
    exit 1
fi

echo -e "${YELLOW}📋 Configuración:${NC}"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service: $SERVICE_NAME"
echo ""

# Leer variables de entorno
echo -e "${YELLOW}🔐 Leyendo variables de entorno...${NC}"
source .env.local

# Verificar que las variables existan
if [ -z "$NEXT_PUBLIC_FIREBASE_API_KEY" ]; then
    echo -e "${RED}❌ Error: Variables de Firebase no encontradas en .env.local${NC}"
    exit 1
fi

# Configurar proyecto
echo -e "${YELLOW}⚙️  Configurando proyecto GCP...${NC}"
gcloud config set project $PROJECT_ID

# Habilitar APIs necesarias
echo -e "${YELLOW}🔌 Habilitando APIs necesarias...${NC}"
gcloud services enable run.googleapis.com --quiet
gcloud services enable cloudbuild.googleapis.com --quiet

# Deploy
echo -e "${YELLOW}🏗️  Desplegando en Cloud Run...${NC}"
gcloud run deploy $SERVICE_NAME \
  --source . \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "\
NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY,\
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,\
NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID,\
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,\
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,\
NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID"

# Obtener URL del servicio
echo ""
echo -e "${GREEN}✅ Deployment completado!${NC}"
echo ""
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region $REGION --format 'value(status.url)')
echo -e "${GREEN}🌐 URL del servicio:${NC} $SERVICE_URL"
echo ""
echo -e "${YELLOW}📊 Para ver logs:${NC}"
echo "  gcloud run logs tail $SERVICE_NAME --region $REGION"
echo ""
echo -e "${YELLOW}📈 Para ver métricas:${NC}"
echo "  https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME?project=$PROJECT_ID"
