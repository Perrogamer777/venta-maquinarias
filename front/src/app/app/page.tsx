'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

export default function AppRootPage() {
    const { user, loading, userTenants, loadingTenants } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Wait for auth and tenant loading to complete
        if (loading || loadingTenants) return;

        if (!user) {
            router.replace('/login');
            return;
        }

        // Redirect to first available tenant
        if (userTenants.length > 0) {
            const firstTenantId = userTenants[0].id;
            console.log(`Redirecting to tenant: ${firstTenantId}`);
            router.replace(`/app/${firstTenantId}/dashboard`);
        }
        // If no tenants, the UI will show the error state
    }, [user, loading, userTenants, loadingTenants, router]);

    // Still loading auth or tenants
    if (loading || loadingTenants) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                    <p className="text-gray-500 font-medium">Cargando tu espacio de trabajo...</p>
                </div>
            </div>
        );
    }

    // No tenants available for user
    if (userTenants.length === 0) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center p-8">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md mx-auto">
                        <div className="w-16 h-16 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                            </svg>
                        </div>
                        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Sin acceso a organizaciones</h1>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            Tu cuenta no tiene acceso a ninguna organización. Contacta al administrador para obtener acceso.
                        </p>
                        <button
                            onClick={() => router.push('/login')}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
                        >
                            Volver al Login
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // This should not be reached as we redirect above, but just in case
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                <p className="text-gray-500 font-medium">Redirigiendo...</p>
            </div>
        </div>
    );
}
