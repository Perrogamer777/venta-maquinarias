import { use } from 'react';
import { TenantProvider } from '@/contexts/TenantContext';
import DashboardLayout from '@/components/DashboardLayout';

export default function TenantLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ tenantId: string }>;
}) {
    // Next.js 15: params is a promise
    const { tenantId } = use(params);

    return (
        <TenantProvider tenantId={tenantId}>
            <DashboardLayout>
                {children}
            </DashboardLayout>
        </TenantProvider>
    );
}
