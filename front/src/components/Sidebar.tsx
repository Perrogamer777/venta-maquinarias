'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import {
    MessageSquare,
    FileText,
    Kanban,
    BarChart3,
    LogOut,
    Home,
    Settings,
    Workflow,
    Truck,
    BookOpen,
    MessageSquarePlus,
    ChevronLeft,
    Sun,
    Moon
} from 'lucide-react';
import { TenantContext } from '@/contexts/TenantContext';
import { useContext } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfig } from '@/contexts/ConfigContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useSidebar } from '@/contexts/SidebarContext';

export default function Sidebar() {
    const pathname = usePathname();
    const { logout, user } = useAuth();
    const { companyName: globalName, companySubtitle: globalSubtitle, nomenclature: globalNomenclature } = useConfig();
    const { theme, toggleTheme } = useTheme();
    const { isCollapsed, setIsCollapsed } = useSidebar();

    // Try to get tenant context (safe access)
    const tenantContext = useContext(TenantContext);
    const tenantConfig = tenantContext?.tenantConfig;

    const companyName = tenantConfig?.companyName || globalName;
    const companySubtitle = tenantConfig?.companySubtitle || globalSubtitle;
    const nomenclature = tenantConfig?.nomenclature || globalNomenclature;

    const params = useParams();
    const tenantId = params?.tenantId as string;

    const getHref = (path: string) => {
        if (!tenantId) return path;
        // Handle root path specially if needed, but usually just prefix
        // If path is '/', user might want '/app/tenantId/dashboard' or just '/app/tenantId'
        if (path === '/') return `/app/${tenantId}/dashboard`;
        return `/app/${tenantId}${path}`;
    };

    // Navigation items with dynamic labels - Updated for Machinery Sales
    const mainNavItems = [
        { href: getHref('/'), icon: Home, label: 'Dashboard' },
        { href: getHref('/conversaciones'), icon: MessageSquare, label: 'Conversaciones' },
        { href: getHref('/cotizaciones'), icon: FileText, label: nomenclature.reservations.plural },
        { href: getHref('/pipeline'), icon: Kanban, label: nomenclature.calendar },
    ];

    const managementItems = [
        { href: getHref('/flujo'), icon: Workflow, label: 'Flujo Comercial' },
        { href: getHref('/inventario'), icon: Truck, label: nomenclature.units.plural },
        { href: getHref('/catalogo'), icon: BookOpen, label: nomenclature.promotions },
    ];

    const systemItems = [
        { href: getHref('/estadisticas'), icon: BarChart3, label: nomenclature.statistics },
        { href: getHref('/configuracion'), icon: Settings, label: 'Configuración' },
        { href: getHref('/feedback'), icon: MessageSquarePlus, label: 'Sugerencias' },
    ];

    const NavLink = ({ item }: { item: { href: string; icon: React.ComponentType<{ size?: number; className?: string }>; label: string } }) => {
        const isActive = pathname === item.href;
        return (
            <Link
                href={item.href}
                className={`sidebar-item text-sm ${isActive ? 'sidebar-item-active' : ''}`}
            >
                <item.icon size={18} />
                {!isCollapsed && <span>{item.label}</span>}
            </Link>
        );
    };

    return (
        <aside
            className={`fixed left-0 top-0 h-screen ${isCollapsed ? 'w-16' : 'w-56'} flex flex-col transition-all duration-300 ease-in-out z-50`}
            style={{ background: 'hsl(var(--sidebar-background))' }}
        >
            {/* Logo & Company Header */}
            <div className="px-4 py-5">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: 'hsl(var(--sidebar-accent))' }}>
                        <Truck size={20} style={{ color: 'hsl(var(--sidebar-foreground))' }} />
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <h1 className="font-bold text-sm" style={{ color: 'hsl(var(--sidebar-foreground))' }}>
                                {companyName}
                            </h1>
                            <p className="text-xs" style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)' }}>
                                {companySubtitle}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* User Card */}
            <div className="px-3 pb-4">
                <div className={`flex items-center gap-3 p-2.5 rounded-xl ${isCollapsed ? 'justify-center' : ''}`}
                    style={{ background: 'hsl(var(--sidebar-accent))' }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                        style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}>
                        {user?.email?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: 'hsl(var(--sidebar-foreground))' }}>
                                {user?.email?.split('@')[0] || 'Admin'}
                            </p>
                            <p className="text-xs" style={{ color: 'hsl(var(--sidebar-foreground) / 0.6)' }}>
                                Vendedor
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Navigation */}
            <nav className="flex-1 px-3 py-2 overflow-y-auto">
                {/* Principal Section */}
                <div className="mb-5">
                    {!isCollapsed && (
                        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: 'hsl(var(--sidebar-foreground) / 0.4)' }}>
                            Principal
                        </p>
                    )}
                    <ul className="space-y-0.5">
                        {mainNavItems.map((item) => (
                            <li key={item.href}>
                                <NavLink item={item} />
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Gestión Section */}
                <div className="mb-5">
                    {!isCollapsed && (
                        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: 'hsl(var(--sidebar-foreground) / 0.4)' }}>
                            Gestión
                        </p>
                    )}
                    <ul className="space-y-0.5">
                        {managementItems.map((item) => (
                            <li key={item.href}>
                                <NavLink item={item} />
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Sistema Section */}
                <div>
                    {!isCollapsed && (
                        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider"
                            style={{ color: 'hsl(var(--sidebar-foreground) / 0.4)' }}>
                            Sistema
                        </p>
                    )}
                    <ul className="space-y-0.5">
                        {systemItems.map((item) => (
                            <li key={item.href}>
                                <NavLink item={item} />
                            </li>
                        ))}
                    </ul>
                </div>
            </nav>

            {/* Bottom Actions */}
            <div className="px-3 py-4 space-y-1" style={{ borderTop: '1px solid hsl(var(--sidebar-border))' }}>
                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className={`sidebar-item text-sm w-full ${isCollapsed ? 'justify-center' : ''}`}
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    {!isCollapsed && <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>}
                </button>

                {/* Logout */}
                <button
                    onClick={() => logout()}
                    className={`sidebar-item text-sm w-full ${isCollapsed ? 'justify-center' : ''}`}
                >
                    <LogOut size={18} />
                    {!isCollapsed && <span>Cerrar Sesión</span>}
                </button>

                {/* Collapse Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={`w-full flex items-center justify-center py-3 mt-2 transition-all duration-200`}
                    style={{ color: 'hsl(var(--sidebar-foreground) / 0.7)' }}
                >
                    <ChevronLeft size={18} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
                </button>
            </div>
        </aside>
    );
}
