'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Nomenclature, DEFAULT_NOMENCLATURE } from '@/lib/businessTypes';

interface CompanySettings {
    companyName: string;
    companySubtitle?: string;
    businessType?: 'cabins' | 'hotel' | 'apartments' | 'custom';
    nomenclature?: Nomenclature;
}

interface ConfigContextType {
    companyName: string;
    companySubtitle: string;
    businessType: string;
    nomenclature: Nomenclature;
    loading: boolean;
    updateCompanySettings: (settings: Partial<CompanySettings>) => Promise<void>;
}

const defaultSettings: CompanySettings = {
    companyName: 'MACI',
    companySubtitle: 'Panel de Control',
    businessType: 'cabins',
    nomenclature: DEFAULT_NOMENCLATURE
};

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<CompanySettings>(defaultSettings);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!db) {
            setLoading(false);
            return;
        }

        // Real-time listener for company settings
        const unsubscribe = onSnapshot(
            doc(db, 'config', 'company_settings'),
            (docSnap) => {
                if (docSnap.exists()) {
                    setSettings({
                        ...defaultSettings,
                        ...docSnap.data() as CompanySettings
                    });
                }
                setLoading(false);
            },
            (error) => {
                console.error('Error loading company settings:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const updateCompanySettings = async (newSettings: Partial<CompanySettings>) => {
        if (!db) return;

        try {
            await setDoc(doc(db, 'config', 'company_settings'), {
                ...settings,
                ...newSettings
            }, { merge: true });
        } catch (error) {
            console.error('Error updating company settings:', error);
            throw error;
        }
    };

    return (
        <ConfigContext.Provider value={{
            companyName: settings.companyName,
            companySubtitle: settings.companySubtitle || 'Panel de Control',
            businessType: settings.businessType || 'cabins',
            nomenclature: settings.nomenclature || DEFAULT_NOMENCLATURE,
            loading,
            updateCompanySettings
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
