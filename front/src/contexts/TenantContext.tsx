'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from './AuthContext';

interface TenantConfig {
    companyName: string;
    companySubtitle?: string;
    businessType?: string;
    nomenclature?: any;
    // Add other config fields as needed
}

interface TenantContextType {
    tenantId: string;
    tenantConfig: TenantConfig | null;
    loading: boolean;
    error: string | null;
}

export const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({
    children,
    tenantId
}: {
    children: ReactNode;
    tenantId: string;
}) {
    const { user } = useAuth(); // Can be used to verify access
    const [tenantConfig, setTenantConfig] = useState<TenantConfig | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!tenantId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        // Subscribe to tenant config (clients/{tenantId}/config/company_settings)
        // Or just clients/{tenantId} if config is on the doc itself.
        // Based on architecture doc: clients/{tenantId}/config doc or clients/{tenantId} doc?
        // Architecture says: clients/{tenantId}/config
        // AdminPage currently saves to: config/company_settings (global) AND updateDoc(clients/{id})

        // We will assume configuration sits at clients/{tenantId} or clients/{tenantId}/config/settings
        // Let's watch clients/{tenantId} for basic info for now.

        const unsubscribe = onSnapshot(doc(db, 'clients', tenantId),
            (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setTenantConfig({
                        companyName: data.businessName,
                        companySubtitle: data.companySubtitle,
                        businessType: data.businessType,
                        nomenclature: data.nomenclature
                    });
                    setError(null);
                } else {
                    setError('Tenant not found');
                    setTenantConfig(null);
                }
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching tenant config:", err);
                setError('Error loading tenant configuration');
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [tenantId]);

    return (
        <TenantContext.Provider value={{ tenantId, tenantConfig, loading, error }}>
            {children}
        </TenantContext.Provider>
    );
}

export function useTenant() {
    const context = useContext(TenantContext);
    if (context === undefined) {
        throw new Error('useTenant must be used within a TenantProvider');
    }
    return context;
}
