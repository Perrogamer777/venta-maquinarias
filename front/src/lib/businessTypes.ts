import { Building, Hotel, Home, Truck } from 'lucide-react';

export interface Nomenclature {
    units: { plural: string; singular: string; };
    reservations: { plural: string; singular: string; };
    clients: { plural: string; singular: string; };
    calendar: string;
    promotions: string;
    statistics: string;
}

export interface BusinessTypePreset {
    id: string;
    name: string;
    icon: typeof Building | typeof Hotel | typeof Home | typeof Truck;
    nomenclature: Nomenclature;
}

export const BUSINESS_TYPES: BusinessTypePreset[] = [
    {
        id: 'machinery',
        name: 'Maquinaria',
        icon: Truck,
        nomenclature: {
            units: { plural: 'Maquinarias', singular: 'Maquinaria' },
            reservations: { plural: 'Cotizaciones', singular: 'Cotización' },
            clients: { plural: 'Clientes', singular: 'Cliente' },
            calendar: 'Pipeline de Ventas',
            promotions: 'Catálogo',
            statistics: 'Métricas de Ventas'
        }
    },
    {
        id: 'hotel',
        name: 'Hotel',
        icon: Hotel,
        nomenclature: {
            units: { plural: 'Habitaciones', singular: 'Habitación' },
            reservations: { plural: 'Reservaciones', singular: 'Reservación' },
            clients: { plural: 'Huéspedes', singular: 'Huésped' },
            calendar: 'Disponibilidad',
            promotions: 'Ofertas Especiales',
            statistics: 'Métricas'
        }
    },
    {
        id: 'apartments',
        name: 'Departamentos',
        icon: Home,
        nomenclature: {
            units: { plural: 'Departamentos', singular: 'Departamento' },
            reservations: { plural: 'Reservas', singular: 'Reserva' },
            clients: { plural: 'Inquilinos', singular: 'Inquilino' },
            calendar: 'Calendario',
            promotions: 'Promociones',
            statistics: 'Estadísticas'
        }
    },
    {
        id: 'custom',
        name: 'Personalizado',
        icon: Building,
        nomenclature: {
            units: { plural: 'Unidades', singular: 'Unidad' },
            reservations: { plural: 'Reservas', singular: 'Reserva' },
            clients: { plural: 'Clientes', singular: 'Cliente' },
            calendar: 'Calendario',
            promotions: 'Promociones',
            statistics: 'Estadísticas'
        }
    }
];

export function getPresetById(id: string): BusinessTypePreset | undefined {
    return BUSINESS_TYPES.find(type => type.id === id);
}

// Ahora el default es maquinaria
export const DEFAULT_NOMENCLATURE: Nomenclature = {
    units: { plural: 'Maquinarias', singular: 'Maquinaria' },
    reservations: { plural: 'Cotizaciones', singular: 'Cotización' },
    clients: { plural: 'Clientes', singular: 'Cliente' },
    calendar: 'Pipeline de Ventas',
    promotions: 'Catálogo',
    statistics: 'Métricas de Ventas'
};

// Categorías predefinidas de maquinaria agrícola
export const CATEGORIAS_MAQUINARIA = [
    'Preparación de suelo',
    'Siembra',
    'Fertilización',
    'Riego',
    'Cosecha',
    'Post-cosecha',
    'Transporte',
    'Mantenimiento',
    'Otros'
];

// Estados de stock
export const ESTADOS_STOCK = [
    { value: 'DISPONIBLE', label: 'Disponible', color: 'bg-green-100 text-green-800' },
    { value: 'BAJO_PEDIDO', label: 'Bajo Pedido', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'AGOTADO', label: 'Agotado', color: 'bg-red-100 text-red-800' }
];

// Estados de cotización
export const ESTADOS_COTIZACION = [
    { value: 'NUEVA', label: 'Nueva', color: 'bg-blue-100 text-blue-800', icon: '🔵' },
    { value: 'CONTACTADO', label: 'Contactado', color: 'bg-yellow-100 text-yellow-800', icon: '🟡' },
    { value: 'NEGOCIANDO', label: 'Negociando', color: 'bg-orange-100 text-orange-800', icon: '🟠' },
    { value: 'VENDIDA', label: 'Vendida', color: 'bg-green-100 text-green-800', icon: '🟢' },
    { value: 'PERDIDA', label: 'Perdida', color: 'bg-gray-100 text-gray-800', icon: '⚫' }
];
