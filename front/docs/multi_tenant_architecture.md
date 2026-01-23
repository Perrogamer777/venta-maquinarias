# Arquitectura Multi-Tenant para Dashboard

## Resumen
Implementación de multi-tenancy usando **base de datos compartida con Tenant ID** (Opción 1) y **rutas dinámicas con Tenant ID** (Opción 3).

---

## 🔄 Flujo General de Usuario

```mermaid
flowchart TB
    subgraph Login["🔐 Autenticación"]
        A[Usuario ingresa] --> B{¿Tiene sesión?}
        B -->|No| C[Login Page]
        B -->|Sí| D{¿Es Admin?}
        C --> D
    end
    
    subgraph Routing["🛣️ Enrutamiento"]
        D -->|Sí| E["/admin<br/>Panel Administrador"]
        D -->|No| F{¿Múltiples Tenants?}
        F -->|Sí| G[Selector de Tenant]
        F -->|No| H["Redirigir a<br/>/app/{tenantId}"]
        G --> H
    end
    
    subgraph Dashboard["📊 Dashboard del Cliente"]
        H --> I["/app/{tenantId}/dashboard"]
        I --> J[Cargar config del tenant]
        J --> K[Mostrar datos filtrados]
    end
    
    style E fill:#1A1A1A,color:#fff
    style I fill:#D4AF37,color:#1A1A1A
```

---

## 📁 Estructura de Base de Datos (Firestore)

```mermaid
flowchart TD
    subgraph Firestore["☁️ Firestore Database"]
        Root["📂 Root"]
        
        subgraph Clients["clients/"]
            C1["📁 hotelcampo<br/>(Tenant 1)"]
            C2["📁 cipres<br/>(Tenant 2)"]
        end
        
        subgraph TenantData1["Datos de Hotel de Campo"]
            C1 --> T1C["cabanas/"]
            C1 --> T1R["reservas/"]
            C1 --> T1CH["chats/"]
            C1 --> T1P["promociones/"]
            C1 --> T1F["feedback/"]
            C1 --> T1Config["config"]
        end
        
        subgraph TenantData2["Datos de Ciprés"]
            C2 --> T2C["cabanas/"]
            C2 --> T2R["reservas/"]
            C2 --> T2CH["chats/"]
            C2 --> T2P["promociones/"]
            C2 --> T2F["feedback/"]
            C2 --> T2Config["config"]
        end
        
        Root --> AdminCol["📁 admin-data<br/>(datos globales)"]
        Root --> Clients
    end
    
    style C1 fill:#D4AF37,color:#1A1A1A
    style C2 fill:#22c55e,color:#fff
```

### Ejemplo de Paths:
| Antes (Sin Multi-Tenant) | Después (Con Multi-Tenant) |
|--------------------------|---------------------------|
| `reservas/` | `clients/{tenantId}/reservas/` |
| `cabanas/` | `clients/{tenantId}/cabanas/` |
| `chats/` | `clients/{tenantId}/chats/` |
| `config` | `clients/{tenantId}/config` |

---

## 🛣️ Estructura de Rutas (Next.js App Router)

```mermaid
flowchart LR
    subgraph Admin["Panel Admin<br/>(Solo Super-Admin)"]
        A1["/admin"] --> A2["Lista de clientes"]
        A1 --> A3["/admin/crear-cliente"]
    end
    
    subgraph App["Dashboard por Tenant"]
        B1["/app/[tenantId]"] --> B2["layout.tsx<br/>(TenantProvider)"]
        B2 --> B3["/dashboard"]
        B2 --> B4["/reservas"]
        B2 --> B5["/cabanas"]
        B2 --> B6["/calendario"]
        B2 --> B7["/estadisticas"]
        B2 --> B8["/promociones"]
        B2 --> B9["/conversaciones"]
        B2 --> B10["/configuracion"]
    end
    
    style A1 fill:#1A1A1A,color:#fff
    style B1 fill:#D4AF37,color:#1A1A1A
```

### Estructura de Carpetas:
```
src/app/
├── admin/                    # Panel Super-Admin
│   └── page.tsx
├── app/
│   └── [tenantId]/           # Dynamic route por tenant
│       ├── layout.tsx        # TenantProvider wrapper
│       ├── page.tsx          # Dashboard
│       ├── reservas/
│       │   └── page.tsx
│       ├── cabanas/
│       │   └── page.tsx
│       ├── calendario/
│       │   └── page.tsx
│       └── ...
└── login/
    └── page.tsx
```

---

## 🔐 Modelo de Usuarios y Permisos

```mermaid
flowchart TB
    subgraph Users["👤 Usuarios"]
        U1["Super Admin<br/>admin@tuapp.com"]
        U2["Admin Hotel<br/>pablo@gmail.com"]
        U3["Admin Ciprés<br/>cipres@gmail.com"]
        U4["Multi-Tenant User<br/>gestor@externo.com"]
    end
    
    subgraph Access["🔓 Acceso"]
        U1 -->|"role: superadmin"| ACC1["✅ /admin<br/>✅ Todos los tenants"]
        U2 -->|"tenants: [hotelcampo]"| ACC2["❌ /admin<br/>✅ /app/hotelcampo/*"]
        U3 -->|"tenants: [cipres]"| ACC3["❌ /admin<br/>✅ /app/cipres/*"]
        U4 -->|"tenants: [hotelcampo, cipres]"| ACC4["❌ /admin<br/>✅ /app/hotelcampo/*<br/>✅ /app/cipres/*"]
    end
    
    style U1 fill:#ef4444,color:#fff
    style U2 fill:#D4AF37,color:#1A1A1A
    style U3 fill:#22c55e,color:#fff
    style U4 fill:#6366f1,color:#fff
```

### Estructura de Usuario en Firestore:
```json
{
  "uid": "abc123",
  "email": "pablo@gmail.com",
  "role": "tenant_admin",
  "tenants": [
    {
      "id": "hotelcampo",
      "name": "Hotel de Campo",
      "role": "admin",
      "permissions": ["read", "write", "delete"]
    }
  ]
}
```

---

## 🔄 Flujo de Datos con TenantContext

```mermaid
sequenceDiagram
    participant U as Usuario
    participant LY as Layout [tenantId]
    participant TP as TenantProvider
    participant FB as Firestore
    participant PG as Página (Reservas, etc.)
    
    U->>LY: Accede a /app/hotelcampo/reservas
    LY->>TP: Inicializar con tenantId="hotelcampo"
    TP->>FB: Obtener config de clients/hotelcampo/config
    FB-->>TP: {nomenclature, settings, ...}
    TP->>PG: Proveer tenantId + config
    PG->>FB: Query: clients/hotelcampo/reservas
    FB-->>PG: [lista de reservas]
    PG-->>U: Mostrar reservas del tenant
```

---

## 🛡️ Seguridad con Firestore Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Función helper para verificar acceso al tenant
    function hasAccessToTenant(tenantId) {
      return request.auth != null && (
        request.auth.token.role == 'superadmin' ||
        tenantId in request.auth.token.tenants
      );
    }
    
    // Datos de cada tenant - solo accesibles por sus usuarios
    match /clients/{tenantId}/{document=**} {
      allow read, write: if hasAccessToTenant(tenantId);
    }
    
    // Panel admin - solo super-admins
    match /admin-data/{document=**} {
      allow read, write: if request.auth.token.role == 'superadmin';
    }
  }
}
```

---

## 📊 Resumen de Cambios Necesarios

| Componente | Estado Actual | Cambio Requerido |
|------------|---------------|------------------|
| **Rutas** | `/reservas`, `/cabanas` | `/app/[tenantId]/reservas` |
| **Queries** | `collection(db, 'reservas')` | `collection(db, 'clients/${tenantId}/reservas')` |
| **Context** | `ConfigContext` | Agregar `TenantContext` con `tenantId` |
| **Auth** | Simple login | Agregar `tenants[]` a usuario |
| **Sidebar** | Links fijos | Links dinámicos con `tenantId` |

---

## ⏱️ Estimación de Implementación

| Fase | Tarea | Tiempo |
|------|-------|--------|
| 1 | Restructurar Firestore (migrar datos) | 2-3 horas |
| 2 | Crear rutas dinámicas `/app/[tenantId]/` | 3-4 horas |
| 3 | Implementar `TenantContext` | 2 horas |
| 4 | Actualizar todas las queries con tenantId | 3-4 horas |
| 5 | Actualizar Sidebar y navegación | 1-2 horas |
| 6 | Firestore Security Rules | 1 hora |
| 7 | Testing y ajustes | 2-3 horas |
| **Total** | | **~15-20 horas** |
