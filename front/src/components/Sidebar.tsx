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
    ];

    const systemItems = [
        { href: getHref('/estadisticas'), icon: BarChart3, label: nomenclature.statistics },
        { href: getHref('/configuracion'), icon: Settings, label: 'Configuración' },
        { href: getHref('/feedback'), icon: MessageSquarePlus, label: 'Sugerencias' },
    ];

    const NavLink = ({ item }: { item: { href: string; icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>; label: string } }) => {
        const isActive = pathname === item.href;
        return (
            <Link
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${isActive
                    ? 'bg-lime-400 text-green-900 font-semibold shadow-lg shadow-lime-400/20'
                    : 'text-gray-200 hover:text-white hover:bg-white/10'
                    }`}
            >
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'animate-pulse-slow' : 'group-hover:scale-110 transition-transform'} />
                {!isCollapsed && <span className="text-sm">{item.label}</span>}
            </Link>
        );
    };

    return (
        <aside
            className={`fixed left-0 top-0 h-screen ${isCollapsed ? 'w-24' : 'w-72'} flex flex-col transition-all duration-300 ease-in-out z-50 shadow-xl`}
            style={{ background: 'hsl(var(--sidebar-background))', borderColor: 'hsl(var(--sidebar-border))', borderWidth: '0 1px 0 0' }}
        >
            {/* Logo & Company Header */}
            <div className="px-6 py-6 mb-2">
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-4'}`}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-lime-400/20 text-lime-400">
                        <Truck size={22} strokeWidth={2.5} />
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0 animate-fade-in">
                            <h1 className="font-bold text-lg leading-tight text-white tracking-tight">
                                {companyName}
                            </h1>
                            <p className="text-xs text-gray-400 font-medium tracking-wide">
                                Panel de Control
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* User Card */}
            <div className="px-4 mb-6">
                <div className={`flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 transition-all hover:bg-white/10 ${isCollapsed ? 'justify-center' : ''}`}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 bg-lime-400 text-green-900 border-2 border-green-900">
                        {user?.email?.charAt(0).toUpperCase() || 'A'}
                    </div>
                    {!isCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate leading-none mb-1">
                                {user?.email?.split('@')[0] || 'Admin'}
                            </p>
                            <p className="text-xs text-lime-400/80 font-medium">
                                Vendedor
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Navigation */}
            <nav className="flex-1 px-3 py-2 overflow-y-auto overflow-x-hidden space-y-6">
                {/* Principal Section */}
                <div>
                    {!isCollapsed && (
                        <p className="px-4 mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                            Principal
                        </p>
                    )}
                    <ul className="space-y-1">
                        {mainNavItems.map((item) => (
                            <li key={item.href}>
                                <NavLink item={item} />
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Gestión Section */}
                <div>
                    {!isCollapsed && (
                        <p className="px-4 mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                            Gestión
                        </p>
                    )}
                    <ul className="space-y-1">
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
                        <p className="px-4 mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                            Sistema
                        </p>
                    )}
                    <ul className="space-y-1">
                        {systemItems.map((item) => (
                            <li key={item.href}>
                                <NavLink item={item} />
                            </li>
                        ))}
                    </ul>
                </div>
            </nav>

            {/* Bottom Actions */}
            <div className="px-4 py-4 space-y-2 border-t border-white/5 bg-black/10">
                {/* Theme Toggle */}
                <button
                    onClick={toggleTheme}
                    className={`flex items-center gap-3 w-full p-2.5 rounded-xl text-gray-300 hover:text-white hover:bg-white/5 transition-all duration-200 ${isCollapsed ? 'justify-center' : ''}`}
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    {!isCollapsed && <span className="text-sm font-medium">{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>}
                </button>

                {/* Logout */}
                <button
                    onClick={() => logout()}
                    className={`flex items-center gap-3 w-full p-2.5 rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-400/10 transition-all duration-200 group ${isCollapsed ? 'justify-center' : ''}`}
                >
                    <LogOut size={18} className="group-hover:translate-x-1 transition-transform" />
                    {!isCollapsed && <span className="text-sm font-medium">Cerrar Sesión</span>}
                </button>

                {/* Collapse Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="flex items-center justify-center py-2 text-gray-400 hover:text-white transition-colors w-full"
                >
                    <ChevronLeft size={20} className={`transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
                </button>
            </div>
        </aside>
    );
}
