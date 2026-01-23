'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { getDaysInMonth, parseISO, startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Phone, Home, Calendar, CheckCircle, User, Truck } from 'lucide-react';
import type { Reserva, Mensaje } from '@/types';
import { useConfig } from '@/contexts/ConfigContext';

interface DailyMessages {
    date: string;
    count: number;
}

interface CabanaStats {
    name: string;
    value: number;
    [key: string]: string | number;
}

export default function EstadisticasPage() {
    const { nomenclature } = useConfig();
    const [loading, setLoading] = useState(true);
    const [conversionData, setConversionData] = useState<{ totalChats: number; chatsConReserva: number; sinReserva: number; tasa: number }>({ totalChats: 0, chatsConReserva: 0, sinReserva: 0, tasa: 0 });
    const [reservasPorSemana, setReservasPorSemana] = useState<{ week: string; count: number }[]>([]);
    const [cabanaStats, setCabanaStats] = useState<CabanaStats[]>([]);
    const [cabanaOccupancy, setCabanaOccupancy] = useState<{ name: string; daysOccupied: number; totalDays: number; percentage: number; color: string }[]>([]);
    const [allReservas, setAllReservas] = useState<Reserva[]>([]);
    const [showReservasModal, setShowReservasModal] = useState(false);
    const [compareMonth, setCompareMonth] = useState<number>(1); // Months ago to compare
    const [compareOccupancy, setCompareOccupancy] = useState<{ name: string; daysOccupied: number; totalDays: number; percentage: number; color: string }[]>([]);

    const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'];

    useEffect(() => {
        async function fetchStats() {
            try {
                // Fetch all chats
                const convsSnapshot = await getDocs(collection(db, 'chats'));
                const totalChats = convsSnapshot.size;

                // Get all chat phone numbers
                const chatPhones = new Set(convsSnapshot.docs.map(doc => doc.id));

                // Fetch reservations for stats
                const reservasSnapshot = await getDocs(collection(db, 'reservas'));
                const reservas: Reserva[] = reservasSnapshot.docs.map(doc => doc.data() as Reserva);

                // Store reservations for modal
                setAllReservas(reservas);

                // Calculate conversion rate - count chats that have at least one reservation
                // Match by phone number (cliente_telefono in reservas vs chat docId)
                const phonesWithReserva = new Set(
                    reservas
                        .map(r => r.cliente_telefono?.replace(/\D/g, '')) // Normalize phone
                        .filter(Boolean)
                );

                // Count how many chats have made a reservation
                let chatsConReserva = 0;
                chatPhones.forEach(chatPhone => {
                    const normalizedChatPhone = chatPhone.replace(/\D/g, '');
                    if (phonesWithReserva.has(normalizedChatPhone)) {
                        chatsConReserva++;
                    }
                });

                const sinReserva = totalChats - chatsConReserva;
                const tasa = totalChats > 0 ? (chatsConReserva / totalChats) * 100 : 0;

                setConversionData({
                    totalChats,
                    chatsConReserva,
                    sinReserva,
                    tasa
                });

                // Group by week
                const reservasByWeek: Record<string, number> = {};
                const cabanaCount: Record<string, number> = {};

                reservas.forEach(reserva => {
                    // Week calculation
                    if (reserva.created_at) {
                        let date: Date;
                        if (typeof reserva.created_at === 'object' && reserva.created_at !== null && 'toDate' in reserva.created_at) {
                            date = (reserva.created_at as { toDate: () => Date }).toDate();
                        } else {
                            date = new Date(reserva.created_at);
                        }
                        const weekStart = new Date(date);
                        weekStart.setDate(date.getDate() - date.getDay());
                        const weekKey = weekStart.toISOString().split('T')[0];
                        reservasByWeek[weekKey] = (reservasByWeek[weekKey] || 0) + 1;
                    }

                    // Cabana count
                    if (reserva.cabana) {
                        cabanaCount[reserva.cabana] = (cabanaCount[reserva.cabana] || 0) + 1;
                    }
                });

                setReservasPorSemana(
                    Object.entries(reservasByWeek)
                        .map(([week, count]) => ({ week: week.slice(5), count }))
                        .sort((a, b) => a.week.localeCompare(b.week))
                        .slice(-8)
                );

                setCabanaStats(
                    Object.entries(cabanaCount)
                        .map(([name, value]) => ({ name, value }))
                        .sort((a, b) => b.value - a.value)
                );

                // Calculate cabin occupancy for current month
                const currentDate = new Date();
                const monthStart = startOfMonth(currentDate);
                const monthEnd = endOfMonth(currentDate);
                const daysInMonth = getDaysInMonth(currentDate);

                const cabanaColors: Record<string, string> = {
                    'Laurel': '#3b82f6',
                    'Ciprés': '#22c55e',
                    'Cipres': '#22c55e',
                    'Castaño': '#f59e0b',
                    'Familiar XL': '#8b5cf6',
                    'default': '#6366f1'
                };

                const getCabanaColor = (cabana: string): string => {
                    for (const key of Object.keys(cabanaColors)) {
                        if (cabana?.toLowerCase().includes(key.toLowerCase())) {
                            return cabanaColors[key];
                        }
                    }
                    return cabanaColors.default;
                };

                const occupancyByDay: Record<string, Set<string>> = {};

                reservas.forEach(reserva => {
                    if (!reserva.cabana || reserva.estado === 'CANCELADA') return;

                    let startDate: Date | null = null;
                    let endDate: Date | null = null;

                    const parseDate = (dateVal: unknown): Date | null => {
                        if (!dateVal) return null;
                        if (typeof dateVal === 'object' && dateVal !== null && 'toDate' in dateVal) {
                            return (dateVal as { toDate: () => Date }).toDate();
                        }
                        if (typeof dateVal === 'string') {
                            if (dateVal.includes('/')) {
                                const [d, m, y] = dateVal.split('/');
                                return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                            }
                            return parseISO(dateVal);
                        }
                        return null;
                    };

                    startDate = parseDate(reserva.fecha_inicio);
                    endDate = parseDate(reserva.fecha_fin);

                    if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

                    // Count days within current month
                    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                        if (d >= monthStart && d <= monthEnd) {
                            const dayKey = d.toISOString().split('T')[0];
                            if (!occupancyByDay[reserva.cabana]) {
                                occupancyByDay[reserva.cabana] = new Set();
                            }
                            occupancyByDay[reserva.cabana].add(dayKey);
                        }
                    }
                });

                const occupancyStats = Object.entries(occupancyByDay)
                    .map(([name, days]) => ({
                        name,
                        daysOccupied: days.size,
                        totalDays: daysInMonth,
                        percentage: Math.round((days.size / daysInMonth) * 100),
                        color: getCabanaColor(name)
                    }))
                    .sort((a, b) => b.percentage - a.percentage);

                setCabanaOccupancy(occupancyStats);

            } catch (error) {
                console.error('Error fetching stats:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchStats();
    }, []);

    // Calculate comparison month occupancy
    useEffect(() => {
        if (allReservas.length === 0) return;

        const compareDate = subMonths(new Date(), compareMonth);
        const monthStart = startOfMonth(compareDate);
        const monthEnd = endOfMonth(compareDate);
        const daysInMonth = getDaysInMonth(compareDate);

        const cabanaColors: Record<string, string> = {
            'Laurel': '#3b82f6',
            'Ciprés': '#22c55e',
            'Cipres': '#22c55e',
            'Castaño': '#f59e0b',
            'Familiar XL': '#8b5cf6',
            'default': '#6366f1'
        };

        const getCabanaColor = (cabana: string): string => {
            for (const key of Object.keys(cabanaColors)) {
                if (cabana?.toLowerCase().includes(key.toLowerCase())) {
                    return cabanaColors[key];
                }
            }
            return cabanaColors.default;
        };

        const occupancyByDay: Record<string, Set<string>> = {};

        allReservas.forEach(reserva => {
            if (!reserva.cabana || reserva.estado === 'CANCELADA') return;

            const parseDate = (dateVal: unknown): Date | null => {
                if (!dateVal) return null;
                if (typeof dateVal === 'object' && dateVal !== null && 'toDate' in dateVal) {
                    return (dateVal as { toDate: () => Date }).toDate();
                }
                if (typeof dateVal === 'string') {
                    if (dateVal.includes('/')) {
                        const [d, m, y] = dateVal.split('/');
                        return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
                    }
                    return parseISO(dateVal);
                }
                return null;
            };

            const startDate = parseDate(reserva.fecha_inicio);
            const endDate = parseDate(reserva.fecha_fin);

            if (!startDate || !endDate || isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return;

            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                if (d >= monthStart && d <= monthEnd) {
                    const dayKey = d.toISOString().split('T')[0];
                    if (!occupancyByDay[reserva.cabana]) {
                        occupancyByDay[reserva.cabana] = new Set();
                    }
                    occupancyByDay[reserva.cabana].add(dayKey);
                }
            }
        });

        const occupancyStats = Object.entries(occupancyByDay)
            .map(([name, days]) => ({
                name,
                daysOccupied: days.size,
                totalDays: daysInMonth,
                percentage: Math.round((days.size / daysInMonth) * 100),
                color: getCabanaColor(name)
            }))
            .sort((a, b) => b.percentage - a.percentage);

        setCompareOccupancy(occupancyStats);
    }, [compareMonth, allReservas]);

    return (
        <DashboardLayout>
            <div className="animate-fade-in">
                {/* Header */}
                <div className="mb-5">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estadísticas</h1>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-0.5">Métricas y análisis del chatbot</p>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="glass rounded-lg p-4 h-64 animate-pulse bg-gray-200 dark:bg-gray-800"></div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Conversion Rate */}
                        <div className="glass rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tasa de Conversión</h3>
                            <div className="h-64 flex flex-col justify-center">
                                {/* Big percentage */}
                                <div className="text-center mb-6">
                                    <div className="text-5xl font-bold text-indigo-600 dark:text-indigo-400">
                                        {conversionData.tasa.toFixed(1)}%
                                    </div>
                                    <p className="text-gray-600 dark:text-gray-400 mt-2">de chats terminan en reserva</p>
                                </div>

                                {/* Stats grid */}
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="text-center p-3 bg-gray-100 dark:bg-gray-800/50 rounded-lg">
                                        <div className="text-2xl font-bold text-gray-900 dark:text-white">{conversionData.totalChats}</div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400">Total Chats</div>
                                    </div>
                                    <button
                                        onClick={() => setShowReservasModal(true)}
                                        className="text-center p-3 bg-green-100 dark:bg-green-500/20 rounded-lg hover:bg-green-200 dark:hover:bg-green-500/30 transition-colors cursor-pointer"
                                    >
                                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">{conversionData.chatsConReserva}</div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400">Con Reserva</div>
                                        <div className="text-xs text-green-600 dark:text-green-400 mt-1">Ver clientes →</div>
                                    </button>
                                    <div className="text-center p-3 bg-red-100 dark:bg-red-500/20 rounded-lg">
                                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">{conversionData.sinReserva}</div>
                                        <div className="text-xs text-gray-600 dark:text-gray-400">Sin Reserva</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Reservations per week */}
                        <div className="glass rounded-xl p-6">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Reservas por Semana</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={reservasPorSemana}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" opacity={0.3} />
                                        <XAxis dataKey="week" stroke="#9ca3af" fontSize={12} />
                                        <YAxis stroke="#9ca3af" fontSize={12} />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#1f2937',
                                                border: '1px solid #374151',
                                                borderRadius: '8px',
                                                color: '#fff'
                                            }}
                                        />
                                        <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Cabañas más reservadas - Rediseño profesional */}
                        <div className="glass rounded-xl p-6">
                            <div className="flex items-center justify-between mb-5">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{nomenclature.units.plural} más Reservadas</h3>
                                <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                                    {cabanaStats.reduce((sum, c) => sum + c.value, 0)} total
                                </span>
                            </div>
                            <div className="space-y-4">
                                {cabanaStats.length === 0 ? (
                                    <div className="h-48 flex items-center justify-center text-gray-500">
                                        No hay datos suficientes
                                    </div>
                                ) : (
                                    cabanaStats.slice(0, 5).map((cabin, idx) => {
                                        const maxValue = Math.max(...cabanaStats.map(c => c.value));
                                        const percentage = (cabin.value / maxValue) * 100;
                                        const totalReservas = cabanaStats.reduce((sum, c) => sum + c.value, 0);
                                        const sharePercent = ((cabin.value / totalReservas) * 100).toFixed(1);

                                        // Medal colors for top 3
                                        const rankColors = [
                                            'bg-gradient-to-r from-amber-400 to-yellow-500 text-white shadow-lg shadow-amber-400/30',
                                            'bg-gradient-to-r from-gray-300 to-gray-400 text-white shadow-lg shadow-gray-400/30',
                                            'bg-gradient-to-r from-amber-600 to-amber-700 text-white shadow-lg shadow-amber-600/30',
                                        ];
                                        const barColors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500'];

                                        return (
                                            <div key={cabin.name} className="group">
                                                <div className="flex items-center gap-3 mb-2">
                                                    {/* Rank Badge */}
                                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${idx < 3
                                                        ? rankColors[idx]
                                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                                                        }`}>
                                                        {idx + 1}
                                                    </div>

                                                    {/* Cabin Name */}
                                                    <div className="flex-1 min-w-0">
                                                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                                                            {cabin.name}
                                                        </span>
                                                    </div>

                                                    {/* Stats */}
                                                    <div className="flex items-center gap-3 flex-shrink-0">
                                                        <span className="text-lg font-bold text-gray-900 dark:text-white">
                                                            {cabin.value}
                                                        </span>
                                                        <span className="text-xs text-gray-500 w-12 text-right">
                                                            {sharePercent}%
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Progress Bar */}
                                                <div className="ml-10 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${barColors[idx % barColors.length]} rounded-full transition-all duration-700 ease-out group-hover:opacity-80`}
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Cabin Occupancy Stats - Comparative View */}
                        <div className="glass rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Ocupación por {nomenclature.units.singular}</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Comparar con:</span>
                                    <select
                                        value={compareMonth}
                                        onChange={(e) => setCompareMonth(Number(e.target.value))}
                                        className="text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                    >
                                        {[1, 2, 3, 4, 5, 6].map(months => (
                                            <option key={months} value={months}>
                                                {format(subMonths(new Date(), months), 'MMMM yyyy', { locale: es })}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Comparison Table Header */}
                            <div className="grid grid-cols-4 gap-2 mb-3 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 pb-2">
                                <div>{nomenclature.units.singular}</div>
                                <div className="text-center">{format(new Date(), 'MMM yyyy', { locale: es })}</div>
                                <div className="text-center">{format(subMonths(new Date(), compareMonth), 'MMM yyyy', { locale: es })}</div>
                                <div className="text-right">Variación</div>
                            </div>

                            {/* Comparison Rows */}
                            <div className="space-y-3">
                                {cabanaOccupancy.length > 0 ? (
                                    cabanaOccupancy.map((cabin, idx) => {
                                        const compareData = compareOccupancy.find(c => c.name === cabin.name);
                                        const diff = compareData ? cabin.percentage - compareData.percentage : cabin.percentage;

                                        return (
                                            <div key={idx} className="grid grid-cols-4 gap-2 items-center py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cabin.color }}></div>
                                                    <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{cabin.name}</span>
                                                </div>
                                                <div className="text-center">
                                                    <span className="text-sm font-bold" style={{ color: cabin.color }}>
                                                        {cabin.percentage}%
                                                    </span>
                                                    <p className="text-xs text-gray-500">{cabin.daysOccupied}d</p>
                                                </div>
                                                <div className="text-center">
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                                        {compareData ? `${compareData.percentage}%` : '-'}
                                                    </span>
                                                    {compareData && <p className="text-xs text-gray-500">{compareData.daysOccupied}d</p>}
                                                </div>
                                                <div className="text-right">
                                                    {compareData ? (
                                                        <span className={`text-sm font-bold ${diff > 0 ? 'text-green-500' : diff < 0 ? 'text-red-500' : 'text-gray-500'}`}>
                                                            {diff > 0 ? '↑' : diff < 0 ? '↓' : '='} {diff > 0 ? '+' : ''}{diff}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm text-green-500 font-bold">Nuevo</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">No hay reservas este mes</p>
                                )}
                            </div>

                            {/* Summary */}
                            {cabanaOccupancy.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600 dark:text-gray-400">Ocupación promedio:</span>
                                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                            {Math.round(cabanaOccupancy.reduce((sum, c) => sum + c.percentage, 0) / cabanaOccupancy.length)}%
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal: Clientes con Reservas */}
            {showReservasModal && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={() => setShowReservasModal(false)}
                >
                    <div
                        className="glass rounded-2xl w-full max-w-2xl animate-fade-in bg-white dark:bg-gray-900 max-h-[85vh] flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <CheckCircle size={24} className="text-green-500" />
                                Clientes con Reservas
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                                {allReservas.length} reserva{allReservas.length !== 1 ? 's' : ''} en total
                            </p>
                        </div>

                        {/* Reservations List - Grouped by Client */}
                        <div className="p-4 space-y-4 overflow-y-auto flex-1">
                            {(() => {
                                // Group by client
                                const groupedByClient = allReservas.reduce((acc, reserva) => {
                                    const clientName = reserva.cliente_nombre || 'Sin nombre';
                                    if (!acc[clientName]) {
                                        acc[clientName] = {
                                            email: reserva.cliente_email,
                                            telefono: reserva.cliente_telefono,
                                            reservas: []
                                        };
                                    }
                                    acc[clientName].reservas.push(reserva);
                                    return acc;
                                }, {} as Record<string, { email?: string; telefono?: string; reservas: Reserva[] }>);

                                return Object.entries(groupedByClient).map(([clientName, data]: [string, { email?: string; telefono?: string; reservas: Reserva[] }]) => (
                                    <div key={clientName} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                        {/* Client Header */}
                                        <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                                        <User size={16} /> {clientName}
                                                    </h4>
                                                    {data.telefono && (
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                                                            <Phone size={12} /> {data.telefono}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="text-xs bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300 px-2 py-1 rounded-full">
                                                    {data.reservas.length} reserva{data.reservas.length !== 1 ? 's' : ''}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Client's Reservations */}
                                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {data.reservas.map((reserva, idx) => (
                                                <div key={idx} className="px-4 py-3 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-1">
                                                                <Truck size={14} /> {reserva.cabana}
                                                            </p>
                                                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                                                <Calendar size={12} />
                                                                <span>{reserva.fecha_inicio}</span>
                                                                <span>→</span>
                                                                <span>{reserva.fecha_fin}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${reserva.estado === 'CONFIRMADA'
                                                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                                                        : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                                                        }`}>
                                                        {reserva.estado?.replace('_', ' ')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
                            <button
                                onClick={() => setShowReservasModal(false)}
                                className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition-colors font-medium"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}
