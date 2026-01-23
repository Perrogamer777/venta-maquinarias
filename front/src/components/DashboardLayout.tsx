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
            <main className={`${isCollapsed ? 'ml-24' : 'ml-72'} min-h-screen transition-all duration-300`}>

                {/* Page Content */}
                <div className="p-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
