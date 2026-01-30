'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useEffect, useState, useCallback } from 'react';
import { Meeting } from '@/types';
import { ESTADOS_REUNION } from '@/lib/businessTypes';
import MeetingCard from '@/components/MeetingCard';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, List, CalendarDays, Phone, Video, Mail } from 'lucide-react';
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addMonths, subMonths, isSameMonth, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './calendar.css';

const locales = { 'es': es };

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
    getDay,
    locales,
});

// Configuración de actualización automática
const AUTO_REFRESH_INTERVAL = 30000; // 30 segundos (ajustable)

export default function CalendarioPage() {
    const [meetings, setMeetings] = useState<Meeting[]>([]);
    const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
    const [calendarView, setCalendarView] = useState<View>('week');
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

    // Cargar reuniones inicialmente
    useEffect(() => { fetchMeetings(); }, []);

    // Auto-refresh cada 30 segundos
    useEffect(() => {
        if (!autoRefresh) return;
        
        const interval = setInterval(() => {
            fetchMeetings();
        }, AUTO_REFRESH_INTERVAL);

        return () => clearInterval(interval);
    }, [autoRefresh]);

    useEffect(() => {
        if (statusFilter === 'all') {
            setFilteredMeetings(meetings);
        } else {
            setFilteredMeetings(meetings.filter(m => m.status === statusFilter));
        }
        
        // Actualizar la reunión seleccionada si todavía existe
        if (selectedMeeting) {
            const updatedMeeting = meetings.find(m => m.id === selectedMeeting.id);
            if (updatedMeeting) {
                setSelectedMeeting(updatedMeeting);
            } else {
                // La reunión fue eliminada o cancelada
                setSelectedMeeting(null);
            }
        }
    }, [statusFilter, meetings]);

    const fetchMeetings = async () => {
        try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://venta-maquinarias-backend-925532912523.us-central1.run.app';
            const response = await fetch(`${backendUrl}/api/meetings`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (data.success) {
                setMeetings(data.meetings);
                setFilteredMeetings(data.meetings);
                setLastUpdate(new Date());
            }
        } catch (error) {
            console.error('Error fetching meetings:', error);
            setMeetings([]);
            setFilteredMeetings([]);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (meetingId: string, newStatus: string) => {
        try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://venta-maquinarias-backend-925532912523.us-central1.run.app';
            const response = await fetch(`${backendUrl}/api/meetings/${meetingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (response.ok) await fetchMeetings();
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const handleUpdateNotes = async (meetingId: string, notes: string) => {
        try {
            const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://venta-maquinarias-backend-925532912523.us-central1.run.app';
            const response = await fetch(`${backendUrl}/api/meetings/${meetingId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes }),
            });
            if (response.ok) await fetchMeetings();
        } catch (error) {
            console.error('Error updating notes:', error);
        }
    };

    const calendarEvents = filteredMeetings
        .filter(meeting => meeting.scheduled_at && meeting.status !== 'cancelada') // Solo reuniones con fecha programada y no canceladas
        .map(meeting => {
            const eventDate = new Date(meeting.scheduled_at!);
            const endDate = new Date(eventDate.getTime() + 30 * 60 * 1000); // 30 minutos de duración
            const statusColors: Record<string, { bg: string; border: string }> = {
                'pendiente': { bg: '#FEF3C7', border: '#F59E0B' },
                'confirmada': { bg: '#DBEAFE', border: '#3B82F6' },
                'completada': { bg: '#D1FAE5', border: '#10B981' },
                'cancelada': { bg: '#FEE2E2', border: '#EF4444' },
            };
            const colors = statusColors[meeting.status] || statusColors['pendiente'];
            return { id: meeting.id, title: meeting.email?.split('@')[0] || 'Cliente', start: eventDate, end: endDate, resource: meeting, colors };
        });

    const eventStyleGetter = (event: { colors: { bg: string; border: string } }) => ({
        style: {
            backgroundColor: event.colors.bg,
            borderLeft: `4px solid ${event.colors.border}`,
            borderRadius: '6px',
            color: '#1F2937',
            padding: '4px 8px',
            fontSize: '0.8125rem',
            fontWeight: '500',
        }
    });

    const handleSelectEvent = useCallback((event: { resource: Meeting }) => {
        setSelectedMeeting(event.resource);
    }, []);

    // Mini Calendar Component
    const MiniCalendar = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(currentDate);
        const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
        const calendarEnd = addDays(endOfMonth(currentDate), 6 - getDay(monthEnd));
        const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
        const weekDays = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

        const hasMeeting = (date: Date) => meetings.some(m => {
            if (!m.scheduled_at || m.status === 'cancelada') return false;
            const meetingDate = new Date(m.scheduled_at);
            return isSameDay(meetingDate, date);
        });

        return (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <ChevronLeft size={18} className="text-gray-500" />
                    </button>
                    <h3 className="font-semibold text-gray-900 dark:text-white capitalize">{format(currentDate, 'MMMM yyyy', { locale: es })}</h3>
                    <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                        <ChevronRight size={18} className="text-gray-500" />
                    </button>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-2">
                    {weekDays.map((day, i) => (<div key={i} className="text-center text-xs font-medium text-gray-400 py-2">{day}</div>))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, i) => {
                        const isCurrentMonth = isSameMonth(day, currentDate);
                        const isToday = isSameDay(day, new Date());
                        const hasEvent = hasMeeting(day);
                        return (
                            <button 
                                key={i} 
                                onClick={() => setCurrentDate(day)} 
                                className={`relative aspect-square flex items-center justify-center text-sm rounded-lg transition-all ${isCurrentMonth ? 'text-gray-700 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600'} ${isToday ? 'bg-green-600 text-white font-bold shadow-lg shadow-green-600/30' : 'hover:bg-gray-100 dark:hover:bg-slate-800'}`}
                            >
                                {format(day, 'd')}
                                {hasEvent && !isToday && (<span className="absolute bottom-1 w-1 h-1 bg-green-500 rounded-full" />)}
                            </button>
                        );
                    })}
                </div>
                <div className="mt-5 pt-5 border-t border-gray-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Pendientes</span>
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">{meetings.filter(m => m.status === 'pendiente' && m.scheduled_at).length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Confirmadas</span>
                        <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">{meetings.filter(m => m.status === 'confirmada' && m.scheduled_at).length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Completadas</span>
                        <span className="px-2.5 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">{meetings.filter(m => m.status === 'completada' && m.scheduled_at).length}</span>
                    </div>
                </div>
                <div className="mt-5 pt-5 border-t border-gray-100 dark:border-slate-800">
                    <p className="text-xs font-medium text-gray-400 mb-3">FILTRAR POR ESTADO</p>
                    <div className="space-y-2">
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" checked={statusFilter === 'all' || statusFilter === 'pendiente'} onChange={() => setStatusFilter(statusFilter === 'pendiente' ? 'all' : 'pendiente')} className="w-4 h-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500" />
                            <span className="w-3 h-3 rounded-full bg-amber-500" />
                            <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white">Pendientes</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" checked={statusFilter === 'all' || statusFilter === 'confirmada'} onChange={() => setStatusFilter(statusFilter === 'confirmada' ? 'all' : 'confirmada')} className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500" />
                            <span className="w-3 h-3 rounded-full bg-blue-500" />
                            <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white">Confirmadas</span>
                        </label>
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <input type="checkbox" checked={statusFilter === 'all' || statusFilter === 'completada'} onChange={() => setStatusFilter(statusFilter === 'completada' ? 'all' : 'completada')} className="w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-500" />
                            <span className="w-3 h-3 rounded-full bg-green-500" />
                            <span className="text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white">Completadas</span>
                        </label>
                    </div>
                </div>
            </div>
        );
    };

    // Meeting Detail Sidebar
    const MeetingDetail = () => {
        if (!selectedMeeting) return null;
        const statusConfig = ESTADOS_REUNION.find(e => e.value === selectedMeeting.status);
        const eventDate = selectedMeeting.scheduled_at ? new Date(selectedMeeting.scheduled_at) : new Date(selectedMeeting.created_at);
        return (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Detalle de Reunión</h3>
                    <button onClick={() => setSelectedMeeting(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <div className="space-y-4">
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusConfig?.color || 'bg-gray-100 text-gray-700'}`}>
                        <span className="w-2 h-2 rounded-full bg-current" />
                        {statusConfig?.label || 'Pendiente'}
                    </div>
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                        <CalendarIcon size={18} />
                        <div>
                            <p className="font-medium text-gray-900 dark:text-white">{format(eventDate, "EEEE d 'de' MMMM", { locale: es })}</p>
                            <p className="text-sm">{format(eventDate, 'HH:mm')} hrs</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                        {selectedMeeting.type === 'videollamada' ? <Video size={18} /> : <Phone size={18} />}
                        <span className="capitalize">{selectedMeeting.type}</span>
                    </div>
                    <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-3">
                        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                            <Mail size={18} />
                            <span className="text-sm">{selectedMeeting.email}</span>
                        </div>
                        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400">
                            <Phone size={18} />
                            <span className="text-sm">{selectedMeeting.phone}</span>
                        </div>
                    </div>
                    {selectedMeeting.notes && (
                        <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                            <p className="text-xs font-medium text-gray-400 mb-2">NOTAS</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{selectedMeeting.notes}</p>
                        </div>
                    )}
                    <div className="pt-4 border-t border-gray-100 dark:border-slate-800 space-y-2">
                        {selectedMeeting.status === 'pendiente' && (
                            <button onClick={() => handleUpdateStatus(selectedMeeting.id, 'confirmada')} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors">
                                Confirmar Reunión
                            </button>
                        )}
                        {selectedMeeting.status === 'confirmada' && (
                            <button onClick={() => handleUpdateStatus(selectedMeeting.id, 'completada')} className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors">
                                Marcar como Completada
                            </button>
                        )}
                        {selectedMeeting.status !== 'cancelada' && selectedMeeting.status !== 'completada' && (
                            <button onClick={() => handleUpdateStatus(selectedMeeting.id, 'cancelada')} className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors">
                                Cancelar
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <DashboardLayout>
            <div className="animate-fade-in max-w-[1800px] mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                            <CalendarIcon size={28} className="text-green-600" />
                            Calendario de Reuniones
                        </h1>
                        <div className="flex items-center gap-3 mt-1">
                            <p className="text-gray-500 dark:text-gray-400 text-sm">Gestiona las llamadas y videollamadas programadas</p>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></span>
                                <span>
                                    {autoRefresh ? 'Actualización automática' : 'Pausado'} · 
                                    <span className="ml-1">{format(lastUpdate, 'HH:mm:ss')}</span>
                                </span>
                                <button 
                                    onClick={() => setAutoRefresh(!autoRefresh)}
                                    className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-xs font-medium transition-colors"
                                >
                                    {autoRefresh ? 'Pausar' : 'Reanudar'}
                                </button>
                                <button 
                                    onClick={fetchMeetings}
                                    className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-xs font-medium transition-colors"
                                >
                                    Actualizar ahora
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
                            <button onClick={() => setViewMode('calendar')} className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${viewMode === 'calendar' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
                                <CalendarDays size={18} />
                            </button>
                            <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
                                <List size={18} />
                            </button>
                        </div>
                        {viewMode === 'calendar' && (
                            <div className="flex bg-gray-100 dark:bg-slate-800 rounded-xl p-1">
                                {(['day', 'week', 'month', 'agenda'] as View[]).map((view) => (
                                    <button 
                                        key={view} 
                                        onClick={() => setCalendarView(view)} 
                                        className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${calendarView === view ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                                    >
                                        {view === 'day' ? 'Día' : view === 'week' ? 'Semana' : view === 'month' ? 'Mes' : 'Agenda'}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Content */}
                {loading ? (
                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 border border-gray-100 dark:border-slate-800 text-center">
                        <div className="animate-spin w-12 h-12 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-gray-500">Cargando reuniones...</p>
                    </div>
                ) : viewMode === 'calendar' ? (
                    <div className="flex gap-6">
                        {/* Left Sidebar */}
                        <div className="w-72 flex-shrink-0 space-y-4">
                            <MiniCalendar />
                            {selectedMeeting && <MeetingDetail />}
                        </div>

                        {/* Main Calendar */}
                        <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                            <div className="p-4" style={{ height: '780px' }}>
                                <Calendar
                                    localizer={localizer}
                                    events={calendarEvents}
                                    startAccessor="start"
                                    endAccessor="end"
                                    style={{ height: '100%' }}
                                    eventPropGetter={eventStyleGetter}
                                    view={calendarView}
                                    onView={(view) => setCalendarView(view)}
                                    date={currentDate}
                                    onNavigate={(newDate) => setCurrentDate(newDate)}
                                    onSelectEvent={handleSelectEvent}
                                    step={30}
                                    timeslots={2}
                                    min={new Date(0, 0, 0, 7, 0, 0)}
                                    max={new Date(0, 0, 0, 21, 0, 0)}
                                    toolbar={false}
                                    formats={{
                                        dayFormat: (date, culture, localizer) => localizer?.format(date, 'EEE', culture) ?? '',
                                        dayHeaderFormat: (date, culture, localizer) => localizer?.format(date, 'd', culture) ?? '',
                                    }}
                                    messages={{
                                        next: "Siguiente",
                                        previous: "Anterior",
                                        today: "Hoy",
                                        month: "Mes",
                                        week: "Semana",
                                        day: "Día",
                                        agenda: "Agenda",
                                        date: "Fecha",
                                        time: "Hora",
                                        event: "Reunión",
                                        noEventsInRange: "No hay reuniones programadas",
                                        showMore: (total) => `+${total} más`
                                    }}
                                    culture="es"
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {filteredMeetings.length === 0 ? (
                            <div className="col-span-full bg-white dark:bg-slate-900 rounded-3xl p-12 border border-gray-100 dark:border-slate-800 text-center">
                                <CalendarIcon size={48} className="text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500 font-medium">No hay reuniones programadas</p>
                            </div>
                        ) : (
                            filteredMeetings.map(meeting => (
                                <MeetingCard
                                    key={meeting.id}
                                    meeting={meeting}
                                    onUpdateStatus={handleUpdateStatus}
                                    onUpdateNotes={handleUpdateNotes}
                                />
                            ))
                        )}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
