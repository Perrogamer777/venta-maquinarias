# 🚜 Sistema de Venta de Maquinaria - Dashboard

Sistema integral para la gestión de ventas de maquinaria agrícola y pesada, diseñado para **MACI Group**.

## 📋 Descripción

Este proyecto ha sido transformado para especializarse en la comercialización de maquinaria. Permite administrar todo el ciclo de vida de la venta, desde la gestión del inventario hasta el seguimiento de prospectos en un pipeline visual.

### Módulos Principales

- **📊 Dashboard**: Métricas en tiempo real de cotizaciones, ventas y actividad reciente.
- **🚜 Inventario**: Catálogo completo de maquinaria con especificaciones técnicas, variantes y galería de fotos.
- **📝 Cotizaciones**: Gestión centralizada de leads y oportunidades de venta.
- **🏗️ Pipeline**: Tablero Kanban interactivo para visualizar el estado de las negociaciones (Nueva, Contactado, Negociando, Vendida, Perdida).

## 🚀 Tecnologías

- **Framework**: Next.js 14 (App Router)
- **Base de Datos**: Firebase Firestore
- **Estilos**: Tailwind CSS + Lucide Icons
- **UI**: @hello-pangea/dnd (Kanban)

## 🛠️ Instalación y Configuración

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>

# 2. Instalar dependencias
cd front
npm install

# 3. Importante: Instalar dependencias específicas del pipeline
npm install @hello-pangea/dnd

# 4. Configurar variables de entorno
# Crear un archivo .env.local con las credenciales de Firebase del proyecto 'venta-maquinarias'
```

## 📐 Estructura del Proyecto

```
src/app/
├── 📊 page.tsx            # Dashboard Principal
├── 🚜 inventario/         # Gestión de Máquinas
├── 📝 cotizaciones/       # Listado de Leads
└── 📋 pipeline/           # Vista Kanban de Ventas
```

## 🔄 Estado del Proyecto

El sistema está configurado por defecto con el preset de negocio `machinery` en `src/lib/businessTypes.ts`, adaptando toda la nomenclatura e iconos al contexto industrial.
