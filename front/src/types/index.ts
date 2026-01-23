// Mensaje individual en una conversación
export interface Mensaje {
    role: 'user' | 'model';
    parts: { text: string }[];
    timestamp: string;
    type?: 'text' | 'image';
    image_url?: string;
}

// Conversación (documento principal)
export interface Conversacion {
    telefono: string;
    ultimoMensaje?: string;
    ultimaFecha?: string;
    mensajes?: Mensaje[];
    agentePausado?: boolean;
    unread?: boolean;
}

// Cotización (antes Reserva)
export interface Cotizacion {
    id?: string;
    codigo_cotizacion: string;
    maquinaria: string;
    maquinaria_id?: string;
    cliente_nombre: string;
    cliente_empresa?: string;
    cliente_email: string;
    cliente_telefono?: string;
    estado: 'NUEVA' | 'CONTACTADO' | 'NEGOCIANDO' | 'VENDIDA' | 'PERDIDA';
    origen: string;
    created_at: string;
    fecha_seguimiento?: string;
    presupuesto_cliente?: number;
    precio_cotizado?: number;
    notas?: string;
}

// Legacy: Reserva (mantener para compatibilidad mientras se migra stats/flujo)
export interface Reserva {
    id?: string;
    codigo_reserva?: string;
    cabana?: string; // Legacy field name
    cliente_nombre?: string;
    cliente_telefono?: string;
    cliente_email?: string;
    fecha_inicio?: string;
    fecha_fin?: string;
    estado?: string;
    created_at?: string | any; // Type 'any' for firestore timestamp compat
    precio_total?: number;
}

// Estadísticas
export interface Estadisticas {
    totalConversaciones: number;
    totalCotizaciones: number;
    cotizacionesPendientes: number;
    mensajesHoy: number;
}

// Maquinaria (antes Cabaña)
export interface Maquinaria {
    id?: string;
    nombre: string;
    categoria: string; // Ej: "Preparación de suelo", "Cosecha", etc.
    descripcion: string; // ¿Para qué sirve?
    especificacionesTecnicas: string; // Fabricado en / materiales
    usoEquipo: string; // Equipo usado en
    dimensiones?: string; // Dimensiones y variantes
    variantes?: string[]; // Ej: "De 3 ganchos", "De 4 ganchos", etc.
    imagenes?: string[];
    pdfUrl?: string; // URL del PDF de especificaciones
    pdfTextoExtraido?: string; // Texto extraído del PDF para búsqueda AI
    precioReferencia?: number; // Precio referencial (puede variar según configuración)
    estadoStock: 'DISPONIBLE' | 'BAJO_PEDIDO' | 'AGOTADO';
    destacado?: boolean;
    activa: boolean;
    tags?: string[]; // Ej: ["abonador", "fertilizante", "granulado"]
}

// Categoría de Maquinaria
export interface CategoriaMaquinaria {
    id?: string;
    nombre: string;
    descripcion?: string;
    icono?: string;
    orden?: number;
    activa: boolean;
}

// Servicio Adicional (mantener para compatibilidad)
export interface ServicioAdicional {
    id?: string;
    nombre: string;
    descripcion: string;
    precio?: number;
    maquinarias?: string[];
    activo?: boolean;
}

// Promoción / Catálogo
export interface Promocion {
    id?: string;
    titulo: string;
    descripcion: string;
    imagenUrl: string;
    activa: boolean;
    creadaEn: string;
    historialEnvios?: {
        enviadoEn: string;
        destinatarios: number;
        enviados: number;
        fallidos: number;
    }[];
}
