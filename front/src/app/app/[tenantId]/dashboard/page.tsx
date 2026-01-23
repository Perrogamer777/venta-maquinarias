'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Calendar, Clock, LogIn, LogOut, MessageSquare, Building, ChevronRight, TrendingUp, TrendingDown, CalendarCheck, DollarSign } from 'lucide-react';
import type { Reserva } from '@/types';
import Link from 'next/link';
import { isToday, parseISO, subDays, format, startOfDay, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
// import { useConfig } from '@/contexts/ConfigContext'; // Replaced by TenantContext
import { useTenant } from '@/contexts/TenantContext';
import { DEFAULT_NOMENCLATURE } from '@/lib/businessTypes';

interface DashboardStats {
    totalReservas: number;
    pendientesPago: number;
    checkInsHoy: number;
    checkOutsHoy: number;
    ingresosMes: number;
}

interface RecentActivity {
    id: string;
    type: 'chat' | 'reserva';
    title: string;
    description: string;
    timestamp: Date;
    icon: 'message' | 'calendar';
    link: string;
}

interface CabanaOccupancy {
    name: string;
    reservasActivas: number;
    color: string;
}

interface ChartDataPoint {
    day: string;
    count: number;
    date: Date;
    // ... other properties
}

export default function TenantDashboardPage() {
    const { isAdmin } = useAuth();
    const router = useRouter();
    const { tenantConfig, loading: tenantLoading, tenantId } = useTenant();
    const nomenclature = tenantConfig?.nomenclature || DEFAULT_NOMENCLATURE;

    const [stats, setStats] = useState<DashboardStats>({
        totalReservas: 0,
        pendientesPago: 0,
        checkInsHoy: 0,
        checkOutsHoy: 0,
        ingresosMes: 0,
    });
    const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
    const [cabanaOccupancy, setCabanaOccupancy] = useState<CabanaOccupancy[]>([]);
    const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
    const [trendPercentage, setTrendPercentage] = useState(0);
    const [weekTotals, setWeekTotals] = useState({ thisWeek: 0, lastWeek: 0 });
    const [loading, setLoading] = useState(true);

    // Redirect admin users to /admin
    useEffect(() => {
        if (isAdmin) {
            router.push('/admin');
        }
    }, [isAdmin, router]);

    // Parse various date formats
    const parseDate = (dateVal: unknown): Date | null => {
        if (!dateVal) return null;
        if (typeof dateVal === 'object' && dateVal !== null && 'toDate' in dateVal) {
            return (dateVal as { toDate: () => Date }).toDate();
        }
        if (typeof dateVal === 'string') {
            if (dateVal.includes('/')) {
                const [day, month, year] = dateVal.split('/');
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }
            return parseISO(dateVal);
        }
        return null;
    };

    useEffect(() => {
        if (!tenantId) return;

        // Real-time listener for reservations
        // IMPORTANT: Need to update query to use tenant structure (clients/{tenantId}/reservas)
        // For now, testing phase, we might keep reading from root 'reservas' OR start reading from nested.
        // The plan said "scripts/migrate_to_multitenant.js" handles migration. 
        // If we want to PROVE it works, we should ideally read from 'clients/{tenantId}/reservas'.
        // BUT we haven't migrated data yet. 
        // The user wants to "probar como seria". 
        // I will read from `collection(db, 'clients', tenantId, 'reservas')`.
        // If data is missing, dashboard will be empty.

        const unsubscribeReservas = onSnapshot(
            collection(db, 'clients', tenantId, 'reservas'),
            (snapshot) => {
                const reservas: Reserva[] = [];
                let pendientes = 0;
                let checkInsHoy = 0;
                let checkOutsHoy = 0;
                const cabanaCount: Record<string, number> = {};

                snapshot.forEach((doc) => {
                    const data = doc.data() as Reserva;
                    reservas.push({ ...data, id: doc.id });

                    if (data.estado === 'PENDIENTE_PAGO') {
                        pendientes++;
                    }

                    // Count check-ins today
                    const startDate = parseDate(data.fecha_inicio);
                    if (startDate && isToday(startDate)) {
                        checkInsHoy++;
                    }

                    // Count check-outs today
                    const endDate = parseDate(data.fecha_fin);
                    if (endDate && isToday(endDate)) {
                        checkOutsHoy++;
                    }

                    // Count reservations per cabin - only current month
                    const currentMonth = new Date().getMonth();
                    const currentYear = new Date().getFullYear();

                    if (data.cabana && data.estado !== 'CANCELADA' && startDate) {
                        if (startDate.getMonth() === currentMonth && startDate.getFullYear() === currentYear) {
                            cabanaCount[data.cabana] = (cabanaCount[data.cabana] || 0) + 1;
                        }
                    }
                });

                // Calculate income for the current month (only confirmed and completed reservations)
                const ingresosMes = reservas
                    .filter(r => {
                        const startDate = parseDate(r.fecha_inicio);
                        const currentMonth = new Date().getMonth();
                        const currentYear = new Date().getFullYear();
                        return startDate &&
                            startDate.getMonth() === currentMonth &&
                            startDate.getFullYear() === currentYear &&
                            (r.estado === 'CONFIRMADA' || r.estado === 'COMPLETADA');
                    })
                    .reduce((sum, r) => sum + (r.precio_total || 0), 0);

                setStats({
                    totalReservas: reservas.filter(r => r.estado !== 'CANCELADA').length,
                    pendientesPago: pendientes,
                    checkInsHoy,
                    checkOutsHoy,
                    ingresosMes,
                });

                // Set cabin occupancy with colors
                const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500'];
                const occupancy = Object.entries(cabanaCount).map(([name, count], idx) => ({
                    name,
                    reservasActivas: count,
                    color: colors[idx % colors.length]
                }));
                setCabanaOccupancy(occupancy);

                // Calculate chart data - Reservations created in last 7 days
                const today = startOfDay(new Date());
                const last7Days: ChartDataPoint[] = [];

                for (let i = 6; i >= 0; i--) {
                    const date = subDays(today, i);
                    const dayName = format(date, 'EEE', { locale: es });
                    const count = reservas.filter(r => {
                        const createdAt = parseDate(r.created_at);
                        if (!createdAt) return false;
                        return startOfDay(createdAt).getTime() === date.getTime();
                    }).length;

                    last7Days.push({
                        day: dayName.charAt(0).toUpperCase() + dayName.slice(1),
                        count,
                        date
                    });
                }

                setChartData(last7Days);

                // Calculate trend (compare last 7 days vs previous 7 days)
                const thisWeekTotal = last7Days.reduce((sum, d) => sum + d.count, 0);
                const prevWeekStart = subDays(today, 13);
                const prevWeekEnd = subDays(today, 7);
                const prevWeekTotal = reservas.filter(r => {
                    const createdAt = parseDate(r.created_at);
                    if (!createdAt) return false;
                    return isWithinInterval(createdAt, { start: prevWeekStart, end: prevWeekEnd });
                }).length;

                setWeekTotals({ thisWeek: thisWeekTotal, lastWeek: prevWeekTotal });

                if (prevWeekTotal > 0) {
                    const trend = ((thisWeekTotal - prevWeekTotal) / prevWeekTotal) * 100;
                    setTrendPercentage(Math.round(trend));
                } else if (thisWeekTotal > 0) {
                    setTrendPercentage(100);
                }

                // Add recent reservations to activities
                const reservaActivities: RecentActivity[] = reservas
                    .filter(r => parseDate(r.created_at))
                    .map(reserva => ({
                        id: `reserva-${reserva.id}`,
                        type: 'reserva' as const,
                        title: reserva.cliente_nombre || 'Nueva reserva',
                        description: `${reserva.cabana} - ${reserva.fecha_inicio} al ${reserva.fecha_fin}`,
                        timestamp: parseDate(reserva.created_at)!,
                        icon: 'calendar' as const,
                        link: `/app/${tenantId}/reservas` // Updated link
                    }))
                    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                    .slice(0, 6);

                setRecentActivities(reservaActivities);
                setLoading(false);
            },
            (error) => {
                console.error('Error listening to reservations:', error);
                setLoading(false);
            }
        );

        // Cleanup listener on unmount
        return () => {
            unsubscribeReservas();
        };
    }, [tenantId]); // Dependency on tenantId

    const formatTimeAgo = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `${diffMins} min`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}d`;
        return format(date, 'd MMM', { locale: es });
    };

    const statCards = [
        {
            label: 'Total Reservas',
            value: stats.totalReservas,
            icon: Calendar,
            bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            href: `/app/${tenantId}/reservas`
        },
        {
            label: 'Pendientes Pago',
            value: stats.pendientesPago,
            icon: Clock,
            bgColor: 'bg-amber-100 dark:bg-amber-900/30',
            iconColor: 'text-amber-600 dark:text-amber-400',
            href: `/app/${tenantId}/flujo` // Assuming flow page exists
        },
        {
            label: 'Check-ins Hoy',
            value: stats.checkInsHoy,
            icon: LogIn,
            bgColor: 'bg-blue-100 dark:bg-blue-900/30',
            iconColor: 'text-blue-600 dark:text-blue-400',
            href: `/app/${tenantId}/calendario`
        },
        {
            label: 'Check-outs Hoy',
            value: stats.checkOutsHoy,
            icon: LogOut,
            bgColor: 'bg-rose-100 dark:bg-rose-900/30',
            iconColor: 'text-rose-600 dark:text-rose-400',
            href: `/app/${tenantId}/calendario`
        },
        {
            label: 'Ingresos Mes',
            value: stats.ingresosMes,
            icon: DollarSign,
            bgColor: 'bg-purple-100 dark:bg-purple-900/30',
            iconColor: 'text-purple-600 dark:text-purple-400',
            href: `/app/${tenantId}/estadisticas`,
            isCurrency: true
        },
    ];

    const maxChartValue = Math.max(...chartData.map(d => d.count), 1);

    return (
        // DashboardLayout removed - handled by layout.tsx
        <div className="animate-fade-in space-y-6">
            {/* Welcome Header */}
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    ¡Hola, {tenantConfig?.companyName || 'Admin'}! <span className="text-2xl">👋</span>
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 capitalize">
                    {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                </p>
            </div>

            {/* Stats Grid - Matching reference design */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {statCards.map((stat, index) => (
                    <div key={stat.label} className={`animate-fade-in-up stagger-${Math.min(index + 1, 5)}`}>
                        <Link
                            href={stat.href}
                            className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group block"
                        >
                            <div className={`w-11 h-11 rounded-xl ${stat.bgColor} flex items-center justify-center mb-4`}>
                                <stat.icon size={20} className={stat.iconColor} />
                            </div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                                {loading ? (
                                    <div className="h-8 w-12 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-lg" />
                                ) : stat.isCurrency ? (
                                    `$${stat.value.toLocaleString('es-CL')}`
                                ) : (
                                    stat.value.toLocaleString()
                                )}
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                        </Link>
                    </div>
                ))}
            </div>

            {/* Main Content Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activities - Left side, spans 2 columns */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                        <h3 className="font-semibold text-gray-900 dark:text-white">Actividad Reciente</h3>
                        <Link
                            href={`/app/${tenantId}/conversaciones`}
                            className="text-sm text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center gap-1 transition-colors"
                        >
                            Ver todo
                            <ChevronRight size={14} />
                        </Link>
                    </div>

                    {loading ? (
                        <div className="p-4 space-y-3">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="h-16 bg-gray-50 dark:bg-slate-800 animate-pulse rounded-xl" />
                            ))}
                        </div>
                    ) : recentActivities.length === 0 ? (
                        <div className="p-12 text-center">
                            <MessageSquare size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-2" />
                            <p className="text-gray-500 text-sm">No hay actividad reciente</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50 dark:divide-slate-800">
                            {recentActivities.map((activity) => {
                                // Get initials from the title (name)
                                const nameParts = activity.title.split(' ');
                                const initials = nameParts.length >= 2
                                    ? `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase()
                                    : activity.title.substring(0, 2).toUpperCase();

                                return (
                                    <Link
                                        key={activity.id}
                                        href={activity.link}
                                        className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 dark:hover:bg-slate-800/50 transition-colors"
                                    >
                                        {/* Avatar with initials */}
                                        <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-600 dark:text-gray-300 font-semibold text-sm flex-shrink-0">
                                            {initials}
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                {activity.title}
                                            </p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                                                {activity.description}
                                            </p>
                                        </div>

                                        {/* Right side - date and badge */}
                                        <div className="flex-shrink-0 text-right flex flex-col items-end gap-1">
                                            <span className="text-xs text-gray-400 dark:text-gray-500">
                                                {format(activity.timestamp, 'd MMM', { locale: es })}
                                            </span>
                                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">
                                                <Calendar size={10} />
                                                Reserva
                                            </span>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Reservations Chart - Right side */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="font-semibold text-gray-900 dark:text-white">Tendencia Reservas</h3>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Reservas creadas - últimos 7 días</p>
                        </div>
                        {trendPercentage !== 0 && (
                            <div className={`flex items-center gap-1 text-sm font-semibold ${trendPercentage > 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                                }`}>
                                {trendPercentage > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                <span>{trendPercentage > 0 ? '+' : ''}{trendPercentage}%</span>
                            </div>
                        )}
                    </div>

                    {/* Week totals */}
                    <div className="flex gap-6 mb-4">
                        <div>
                            <span className="text-2xl font-bold text-gray-900 dark:text-white">{weekTotals.thisWeek}</span>
                            <p className="text-xs text-gray-500">Esta semana</p>
                        </div>
                        <div>
                            <span className="text-2xl font-bold text-gray-400">{weekTotals.lastWeek}</span>
                            <p className="text-xs text-gray-500">Semana pasada</p>
                        </div>
                    </div>

                    {/* Bar Chart */}
                    <div className="relative h-40">
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex flex-col justify-between">
                            {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="border-b border-gray-100 dark:border-gray-800" />
                            ))}
                        </div>

                        {/* Bars with gradient effect */}
                        <div className="absolute inset-0 flex items-end justify-between gap-2 pt-4 pb-6">
                            {chartData.map((dataPoint, idx) => (
                                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group">
                                    <div className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {dataPoint.count}
                                    </div>
                                    <div
                                        className="w-full bg-gradient-to-t from-emerald-500 to-emerald-300 dark:from-emerald-600 dark:to-emerald-400 rounded-t-md transition-all duration-500 hover:from-emerald-400 hover:to-emerald-200"
                                        style={{ height: `${(dataPoint.count / maxChartValue) * 100}%`, minHeight: dataPoint.count > 0 ? '8px' : '0' }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* X-axis labels */}
                    <div className="flex justify-between mt-2">
                        {chartData.map((dataPoint, idx) => (
                            <span key={idx} className="text-xs text-gray-400 flex-1 text-center">{dataPoint.day}</span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Cabin Occupancy */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <Building size={20} className="text-gray-500" />
                        <h3 className="font-semibold text-gray-900 dark:text-white">Reservas por {nomenclature.units.singular}</h3>
                    </div>
                    <Link
                        href={`/app/${tenantId}/cabanas`}
                        className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                    >
                        Gestionar
                        <ChevronRight size={14} />
                    </Link>
                </div>

                {loading ? (
                    <div className="h-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
                ) : cabanaOccupancy.length === 0 ? (
                    <p className="text-gray-500 text-sm">No hay reservas activas</p>
                ) : (
                    <div className="flex items-center gap-8">
                        {/* Donut Chart */}
                        <div className="relative w-32 h-32 flex-shrink-0">
                            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                {(() => {
                                    const total = cabanaOccupancy.reduce((sum, c) => sum + c.reservasActivas, 0);
                                    let cumulativePercent = 0;
                                    const colorMap: Record<string, string> = {
                                        'bg-blue-500': '#3b82f6',
                                        'bg-emerald-500': '#10b981',
                                        'bg-purple-500': '#a855f7',
                                        'bg-amber-500': '#f59e0b',
                                        'bg-rose-500': '#f43f5e',
                                    };

                                    return cabanaOccupancy.map((cabana, idx) => {
                                        const percent = (cabana.reservasActivas / total) * 100;
                                        const strokeDasharray = `${percent} ${100 - percent}`;
                                        const strokeDashoffset = -cumulativePercent;
                                        cumulativePercent += percent;

                                        return (
                                            <circle
                                                key={cabana.name}
                                                cx="18"
                                                cy="18"
                                                r="15.915"
                                                fill="none"
                                                stroke={colorMap[cabana.color] || '#6b7280'}
                                                strokeWidth="3.5"
                                                strokeDasharray={strokeDasharray}
                                                strokeDashoffset={strokeDashoffset}
                                                className="transition-all duration-500"
                                            />
                                        );
                                    });
                                })()}
                            </svg>
                            {/* Center text */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                                    {cabanaOccupancy.reduce((sum, c) => sum + c.reservasActivas, 0)}
                                </span>
                                <span className="text-xs text-gray-500">total</span>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex-1 space-y-2">
                            {cabanaOccupancy.map((cabana) => {
                                const total = cabanaOccupancy.reduce((sum, c) => sum + c.reservasActivas, 0);
                                const percent = Math.round((cabana.reservasActivas / total) * 100);
                                return (
                                    <div key={cabana.name} className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${cabana.color}`} />
                                        <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">{cabana.name}</span>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{cabana.reservasActivas}</span>
                                        <span className="text-xs text-gray-400 w-10 text-right">{percent}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
