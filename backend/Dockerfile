FROM python:3.11-slim

# Crear carpeta de trabajo
WORKDIR /app

# Copiar requerimientos e instalar dependencias
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código de la aplicación
COPY app/ ./app/

# Variables de entorno
ENV PORT=8080
ENV PYTHONUNBUFFERED=1

# Comando de inicio (usando el nuevo módulo)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]