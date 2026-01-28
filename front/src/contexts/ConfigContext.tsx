'use client';

import { createContext, useContext, ReactNode } from 'react';

// Simplified config - no Firestore reads, just static defaults
interface CompanySettings {
    companyName: string;
    phone: string;
    email: string;
    address: string;
}

interface Nomenclature {
    reservations: {
        singular: string;
        plural: string;
    };
    units: {
        singular: string;
        plural: string;
    };
    calendar: string;
    statistics: string;
}

interface ConfigContextType {
    settings: CompanySettings;
    nomenclature: Nomenclature;
    loading: boolean;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

const defaultSettings: CompanySettings = {
    companyName: 'MACI',
    phone: '+56 9 1234 5678',
    email: 'contacto@agromaci.cl',
    address: 'Chile'
};

const defaultNomenclature: Nomenclature = {
    reservations: {
        singular: 'Cotización',
        plural: 'Cotizaciones'
    },
    units: {
        singular: 'Maquinaria',
        plural: 'Maquinarias'
    },
    calendar: 'Pipeline de Ventas',
    statistics: 'Estadísticas'
};

export function ConfigProvider({ children }: { children: ReactNode }) {
    // No Firestore queries - just use defaults
    return (
        <ConfigContext.Provider value={{
            settings: defaultSettings,
            nomenclature: defaultNomenclature,
            loading: false
        }}>
            {children}
        </ConfigContext.Provider>
    );
}

export function useConfig() {
    const context = useContext(ConfigContext);
    if (context === undefined) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
}
