'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTenant } from '@/contexts/TenantContext';
import { ChevronLeft, ChevronRight, User, Home, CalendarDays, LogIn, LogOut } from 'lucide-react';
import {
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    format,
    addMonths,
    subMonths,
    isSameMonth,
    isSameDay,
    isWithinInterval,
    parseISO,
    startOfWeek,
    endOfWeek
} from 'date-fns';
import { es } from 'date-fns/locale';
import type { Reserva } from '@/types';
import { useConfig } from '@/contexts/ConfigContext';

interface ReservaWithDates extends Reserva {
    startDate: Date;
    endDate: Date;
}

export default function CalendarioPage() {
    const { tenantId, loading: tenantLoading } = useTenant();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [reservas, setReservas] = useState<ReservaWithDates[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReserva, setSelectedReserva] = useState<ReservaWithDates | null>(null);
    const [selectedDay, setSelectedDay] = useState<{ date: Date; reservas: ReservaWithDates[] } | null>(null);
    const { nomenclature } = useConfig();

    // Colores para diferentes cabañas
    const cabanaColors: Record<string, string> = {
        'Laurel': 'bg-blue-500',
        'Ciprés': 'bg-green-500',
        'Cipres': 'bg-green-500',
        'Familiar XL': 'bg-purple-500',
        'default': 'bg-indigo-500'
    };

    const getCabanaColor = (cabana: string) => {
        for (const key of Object.keys(cabanaColors)) {
            if (cabana?.toLowerCase().includes(key.toLowerCase())) {
                return cabanaColors[key];
            }
        }
        return cabanaColors.default;
    };

    useEffect(() => {
        if (tenantLoading || !tenantId) {
            setLoading(true);
            return;
        }
        async function fetchReservas() {
            try {
                const snapshot = await getDocs(collection(db, 'clients', tenantId, 'reservas'));
                const data: ReservaWithDates[] = [];

                console.log('Total reservas encontradas:', snapshot.docs.length);

                snapshot.docs.forEach(doc => {
                    const reserva = doc.data() as Reserva;
                    console.log('Reserva:', reserva.codigo_reserva, 'Fechas:', reserva.fecha_inicio, '-', reserva.fecha_fin, 'Estado:', reserva.estado);

                    if (reserva.fecha_inicio && reserva.fecha_fin && reserva.estado !== 'CANCELADA') {
                        try {
                            // Intentar parsear la fecha - manejar diferentes formatos (String ISO, String DD/MM/YYYY, Timestamp)
                            let startDate: Date | null = null;
                            let endDate: Date | null = null;

                            const parseDate = (dateVal: any): Date | null => {
                                if (!dateVal) return null;
                                // Si es Timestamp de Firestore
                                if (typeof dateVal === 'object' && 'toDate' in dateVal && typeof dateVal.toDate === 'function') {
                                    return dateVal.toDate();
                                }
                                // Si es string
                                if (typeof dateVal === 'string') {
                                    if (dateVal.includes('/')) {
                                        const [day, month, year] = dateVal.split('/');
                                        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                    }
                                    return parseISO(dateVal);
                                }
                                return null;
                            };

                            startDate = parseDate(reserva.fecha_inicio);
                            endDate = parseDate(reserva.fecha_fin);

                            if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                                data.push({
                                    ...reserva,
                                    id: doc.id,
                                    startDate,
                                    endDate
                                });
                                console.log('Reserva agregada:', reserva.cabana, startDate, '-', endDate);
                            }
                        } catch (e) {
                            console.error('Error parsing dates for:', reserva.codigo_reserva, e);
                        }
                    }
                });

                console.log('Reservas procesadas:', data.length);
                setReservas(data);
            } catch (error) {
                console.error('Error fetching reservas:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchReservas();
    }, [tenantId, tenantLoading]);

    // Obtener días del mes actual y días de semanas 
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 }); // Lunes
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    // Reservas para un día específico
    const getReservasForDay = (day: Date) => {
        return reservas.filter(reserva => {
            try {
                return isWithinInterval(day, { start: reserva.startDate, end: reserva.endDate });
            } catch {
                return false;
            }
        });
    };

    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const goToToday = () => setCurrentMonth(new Date());

    const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    return (

        <div className="animate-fade-in">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendario</h1>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-0.5">Disponibilidad de {nomenclature.units.plural.toLowerCase()}</p>
                </div>

                {/* Navigation */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={goToToday}
                        className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition-colors"
                    >
                        Hoy
                    </button>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={prevMonth}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <ChevronLeft size={18} className="text-gray-500 dark:text-gray-400" />
                        </button>
                        <span className="text-lg font-semibold text-gray-900 dark:text-white min-w-[180px] text-center capitalize">
                            {format(currentMonth, 'MMMM yyyy', { locale: es })}
                        </span>
                        <button
                            onClick={nextMonth}
                            className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <ChevronRight size={18} className="text-gray-500 dark:text-gray-400" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="glass rounded-xl p-4 mb-6 flex flex-wrap gap-4">
                <span className="text-gray-600 dark:text-gray-400 text-sm">{nomenclature.units.plural}:</span>
                {Object.entries(cabanaColors).filter(([key]) => key !== 'default').map(([name, color]) => (
                    <div key={name} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${color}`}></div>
                        <span className="text-sm text-gray-600 dark:text-gray-300">{name}</span>
                    </div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="glass rounded-xl overflow-hidden">
                {loading ? (
                    <div className="p-8 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                    </div>
                ) : (
                    <>
                        {/* Week days header */}
                        <div className="grid grid-cols-7 bg-gray-100/50 dark:bg-gray-800/50">
                            {weekDays.map(day => (
                                <div key={day} className="py-3 text-center text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {day}
                                </div>
                            ))}
                        </div>

                        {/* Days grid */}
                        <div className="grid grid-cols-7 divide-x divide-y divide-gray-200 dark:divide-gray-800">
                            {calendarDays.map((day, idx) => {
                                const dayReservas = getReservasForDay(day);
                                const isCurrentMonth = isSameMonth(day, currentMonth);
                                const isToday = isSameDay(day, new Date());

                                return (
                                    <div
                                        key={idx}
                                        className={`min-h-[100px] p-2 ${!isCurrentMonth ? 'bg-gray-50 dark:bg-gray-900/50' : 'bg-white dark:bg-gray-900/20'
                                            } ${isToday ? 'ring-2 ring-indigo-500 ring-inset' : ''}`}
                                    >
                                        <div className={`text-sm mb-1 ${isToday
                                            ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                                            : isCurrentMonth
                                                ? 'text-gray-700 dark:text-gray-300'
                                                : 'text-gray-400 dark:text-gray-600'
                                            }`}>
                                            {format(day, 'd')}
                                        </div>

                                        <div className="space-y-1">
                                            {dayReservas.slice(0, 3).map((reserva, rIdx) => (
                                                <button
                                                    key={rIdx}
                                                    onClick={() => setSelectedReserva(reserva)}
                                                    className={`w-full text-left px-2 py-1 rounded text-xs text-white truncate ${getCabanaColor(reserva.cabana)} hover:opacity-80 transition-opacity`}
                                                >
                                                    {reserva.cabana}
                                                </button>
                                            ))}
                                            {dayReservas.length > 3 && (
                                                <button
                                                    onClick={() => setSelectedDay({ date: day, reservas: dayReservas })}
                                                    className="w-full text-left text-xs text-indigo-600 dark:text-indigo-400 px-2 hover:underline font-medium"
                                                >
                                                    +{dayReservas.length - 3} más
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Reservation Detail Modal */}
            {selectedReserva && (
                <div
                    className="fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] z-[100] overflow-y-auto"
                    onClick={() => setSelectedReserva(null)}
                >
                    <div className="min-h-full flex items-center justify-center p-4">
                        <div
                            className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-xl animate-fade-in border border-gray-200 dark:border-gray-800"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header with Cabin Color */}
                            <div className="p-5 border-b border-gray-100 dark:border-gray-800">
                                <div className="flex items-center gap-3">
                                    <div className={`w-3 h-3 rounded-full ${getCabanaColor(selectedReserva.cabana)}`} />
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {selectedReserva.cabana}
                                    </h3>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-5 space-y-4">
                                {/* Date Cards */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3 border border-emerald-100 dark:border-emerald-800/30">
                                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs mb-1">
                                            <LogIn size={12} />
                                            <span>Check-in</span>
                                        </div>
                                        <p className="text-gray-900 dark:text-white font-semibold">{selectedReserva.fecha_inicio}</p>
                                    </div>
                                    <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 border border-red-100 dark:border-red-800/30">
                                        <div className="flex items-center gap-2 text-red-500 dark:text-red-400 text-xs mb-1">
                                            <LogOut size={12} />
                                            <span>Check-out</span>
                                        </div>
                                        <p className="text-gray-900 dark:text-white font-semibold">{selectedReserva.fecha_fin}</p>
                                    </div>
                                </div>

                                {/* Client Info */}
                                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4">
                                    <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
                                        <User size={12} />
                                        <span>Cliente</span>
                                    </div>
                                    <p className="text-gray-900 dark:text-white font-medium">{selectedReserva.cliente_nombre}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{selectedReserva.cliente_email}</p>
                                </div>

                                {/* Status & Code */}
                                <div className="flex items-center justify-between py-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-500">Estado</span>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${selectedReserva.estado === 'CONFIRMADA'
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                                            }`}>
                                            {selectedReserva.estado?.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs text-gray-400">Código</span>
                                        <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400 font-medium">{selectedReserva.codigo_reserva}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="px-5 pb-5">
                                <button
                                    onClick={() => setSelectedReserva(null)}
                                    className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl transition-colors text-sm font-medium"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Day Detail Modal - Shows all reservations for a specific day */}
            {selectedDay && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={() => setSelectedDay(null)}
                >
                    <div
                        className="glass rounded-2xl w-full max-w-lg animate-fade-in bg-white dark:bg-gray-900 max-h-[80vh] flex flex-col"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                <CalendarDays size={20} className="text-indigo-600 dark:text-indigo-400" />
                                {format(selectedDay.date, "d 'de' MMMM, yyyy", { locale: es })}
                            </h3>
                            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                                {selectedDay.reservas.length} reserva{selectedDay.reservas.length !== 1 ? 's' : ''} para este día
                            </p>
                        </div>

                        {/* Reservations List - Grouped by Client */}
                        <div className="p-4 space-y-4 overflow-y-auto flex-1">
                            {(() => {
                                // Agrupar reservas por cliente
                                const groupedByClient = selectedDay.reservas.reduce((acc, reserva) => {
                                    const clientName = reserva.cliente_nombre || 'Sin nombre';
                                    if (!acc[clientName]) {
                                        acc[clientName] = [];
                                    }
                                    acc[clientName].push(reserva);
                                    return acc;
                                }, {} as Record<string, ReservaWithDates[]>);

                                return Object.entries(groupedByClient).map(([clientName, clientReservas]) => (
                                    <div key={clientName} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                        {/* Client Header */}
                                        <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <User size={16} className="text-gray-600 dark:text-gray-400" />
                                                    <h4 className="font-semibold text-gray-900 dark:text-white">
                                                        {clientName}
                                                    </h4>
                                                </div>
                                                <span className="text-xs bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 px-2 py-1 rounded-full">
                                                    {clientReservas.length} {clientReservas.length !== 1 ? nomenclature.units.plural.toLowerCase() : nomenclature.units.singular.toLowerCase()}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Client's Cabins */}
                                        <div className="divide-y divide-gray-100 dark:divide-gray-800">
                                            {clientReservas.map((reserva, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => {
                                                        setSelectedDay(null);
                                                        setSelectedReserva(reserva);
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors flex items-center gap-3"
                                                >
                                                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getCabanaColor(reserva.cabana)}`}></div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span className="font-medium text-gray-900 dark:text-white text-sm flex items-center gap-1">
                                                                <Home size={14} className="text-gray-500" />
                                                                {reserva.cabana}
                                                            </span>
                                                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${reserva.estado === 'CONFIRMADA'
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                                                                : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                                                                }`}>
                                                                {reserva.estado?.replace('_', ' ')}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                                            <span className="flex items-center gap-1">
                                                                <LogIn size={11} className="text-green-500" />
                                                                {reserva.fecha_inicio}
                                                            </span>
                                                            <span className="flex items-center gap-1">
                                                                <LogOut size={11} className="text-red-400" />
                                                                {reserva.fecha_fin}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
                            <button
                                onClick={() => setSelectedDay(null)}
                                className="w-full py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg transition-colors font-medium"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
}
