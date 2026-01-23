'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';
import { useRouter } from 'next/navigation';
import { useEffect, useContext } from 'react';
import { TenantContext } from '@/contexts/TenantContext'; // Import TenantContext
import Sidebar from './Sidebar';
import { Bot, Search, Bell } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();
    const { isCollapsed } = useSidebar();
    const router = useRouter();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [user, loading, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ background: 'hsl(var(--background))' }}>
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center animate-pulse shadow-lg"
                        style={{ background: 'hsl(var(--primary))' }}>
                        <Bot size={24} className="text-white" />
                    </div>
                    <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: 'hsl(var(--primary))', borderTopColor: 'transparent' }} />
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen transition-colors duration-200" style={{ background: 'hsl(var(--background))' }}>
            <Sidebar />

            {/* Main Content - adjusts based on sidebar collapsed state */}
            <main className={`${isCollapsed ? 'ml-16' : 'ml-56'} min-h-screen transition-all duration-300`}>
                {/* Top Header Bar */}
                <header className="sticky top-0 z-40 backdrop-blur-md"
                    style={{
                        background: 'hsl(var(--background) / 0.8)',
                        borderBottom: '1px solid hsl(var(--border))'
                    }}>
                    <div className="px-6 py-3 flex items-center justify-between">
                        {/* Tenant Info */}
                        <div className="hidden md:flex items-center gap-3 mr-4">
                            <div className="flex flex-col items-end">
                                <span className="text-sm font-medium" style={{ color: 'hsl(var(--foreground))' }}>
                                    {/* Try to get company name from context, fallback to static if not available (yet) */}
                                    <TenantContextConsumer />
                                </span>
                            </div>
                        </div>

                        {/* Search */}
                        <div className="relative max-w-md flex-1">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
                                style={{ color: 'hsl(var(--muted-foreground))' }} />
                            <input
                                type="text"
                                placeholder="Buscar reservas, huéspedes..."
                                className="w-full pl-10 pr-4 py-2 rounded-xl text-sm transition-all"
                                style={{
                                    background: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    color: 'hsl(var(--foreground))'
                                }}
                            />
                        </div>

                        {/* Right Actions */}
                        <div className="flex items-center gap-3">
                            <button className="relative p-2 rounded-xl transition-colors hover:opacity-80"
                                style={{ background: 'hsl(var(--muted) / 0.5)' }}>
                                <Bell size={20} style={{ color: 'hsl(var(--muted-foreground))' }} />
                                {/* Notification dot */}
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                                    style={{ background: 'hsl(var(--destructive))' }}></span>
                            </button>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}

// Helper component to consume TenantContext safely inside the layout
function TenantContextConsumer() {
    const context = useContext(TenantContext);

    // If no context or no config (e.g. root page without tenant), show empty or static
    if (!context || !context.tenantConfig) {
        return null;
    }

    return (
        <span className="font-semibold text-indigo-600 dark:text-indigo-400">
            {context.tenantConfig.companyName}
        </span>
    );
}
