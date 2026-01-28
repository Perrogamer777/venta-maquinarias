'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { FileText, Clock, PlusCircle, CheckCircle, MessageSquare, Truck, ChevronRight, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import type { Cotizacion, Maquinaria } from '@/types';
import Link from 'next/link';
import { subDays, format, startOfDay, isWithinInterval, isToday } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useConfig } from '@/contexts/ConfigContext';
import { ESTADOS_COTIZACION } from '@/lib/businessTypes';

interface DashboardStats {
  totalCotizaciones: number;
  pendientesSeguimiento: number;
  cotizacionesNuevasHoy: number;
  ventasCerradasHoy: number;
  ventasMes: number;
}

interface RecentActivity {
  id: string;
  type: 'chat' | 'cotizacion';
  title: string;
  description: string;
  timestamp: Date;
  estado: string;
  link: string;
}

interface MaquinariaStats {
  name: string;
  cotizaciones: number;
  color: string;
}

interface ChartDataPoint {
  day: string;
  count: number;
  date: Date;
}

export default function HomePage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const { nomenclature } = useConfig();
  const [stats, setStats] = useState<DashboardStats>({
    totalCotizaciones: 0,
    pendientesSeguimiento: 0,
    cotizacionesNuevasHoy: 0,
    ventasCerradasHoy: 0,
    ventasMes: 0,
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [maquinariaStats, setMaquinariaStats] = useState<MaquinariaStats[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [trendPercentage, setTrendPercentage] = useState(0);
  const [weekTotals, setWeekTotals] = useState({ thisWeek: 0, lastWeek: 0 });
  const [loading, setLoading] = useState(true);

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
      return new Date(dateVal);
    }
    return null;
  };

  useEffect(() => {
    // Real-time listener for cotizaciones
    const unsubscribeCotizaciones = onSnapshot(
      collection(db, 'cotizaciones'),
      (snapshot) => {
        const cotizaciones: Cotizacion[] = [];
        let pendientes = 0;
        let nuevasHoy = 0;
        let ventasHoy = 0;
        const maquinariaCount: Record<string, number> = {};

        snapshot.forEach((doc) => {
          const data = doc.data() as Cotizacion;
          cotizaciones.push({ ...data, id: doc.id });

          // Pendientes de seguimiento (NUEVA o CONTACTADO)
          if (data.estado === 'NUEVA' || data.estado === 'CONTACTADO') {
            pendientes++;
          }

          // Cotizaciones nuevas hoy
          const createdAt = parseDate(data.created_at);
          if (createdAt && isToday(createdAt)) {
            nuevasHoy++;
          }

          // Ventas cerradas hoy
          if (data.estado === 'VENDIDA' && createdAt && isToday(createdAt)) {
            ventasHoy++;
          }

          // Count cotizaciones per maquinaria
          const currentMonth = new Date().getMonth();
          const currentYear = new Date().getFullYear();

          if (data.maquinaria && data.estado !== 'PERDIDA' && createdAt) {
            if (createdAt.getMonth() === currentMonth && createdAt.getFullYear() === currentYear) {
              maquinariaCount[data.maquinaria] = (maquinariaCount[data.maquinaria] || 0) + 1;
            }
          }
        });

        // Calculate sales for the current month (only VENDIDA)
        const ventasMes = cotizaciones
          .filter(c => {
            const createdAt = parseDate(c.created_at);
            const currentMonth = new Date().getMonth();
            const currentYear = new Date().getFullYear();
            return createdAt &&
              createdAt.getMonth() === currentMonth &&
              createdAt.getFullYear() === currentYear &&
              c.estado === 'VENDIDA';
          })
          .reduce((sum, c) => sum + (c.precio_cotizado || 0), 0);

        setStats({
          totalCotizaciones: cotizaciones.filter(c => c.estado !== 'PERDIDA').length,
          pendientesSeguimiento: pendientes,
          cotizacionesNuevasHoy: nuevasHoy,
          ventasCerradasHoy: ventasHoy,
          ventasMes,
        });

        // Set maquinaria stats with colors
        const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500'];
        const maquinariaStatsData = Object.entries(maquinariaCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count], idx) => ({
            name,
            cotizaciones: count,
            color: colors[idx % colors.length]
          }));
        setMaquinariaStats(maquinariaStatsData);

        // Calculate chart data - Cotizaciones created in last 7 days
        const today = startOfDay(new Date());
        const last7Days: ChartDataPoint[] = [];

        for (let i = 6; i >= 0; i--) {
          const date = subDays(today, i);
          const dayName = format(date, 'EEE', { locale: es });
          const count = cotizaciones.filter(c => {
            const createdAt = parseDate(c.created_at);
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
        const prevWeekTotal = cotizaciones.filter(c => {
          const createdAt = parseDate(c.created_at);
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

        // Add recent cotizaciones to activities
        const cotizacionActivities: RecentActivity[] = cotizaciones
          .filter(c => parseDate(c.created_at))
          .map(cotizacion => ({
            id: `cotizacion-${cotizacion.id}`,
            type: 'cotizacion' as const,
            title: cotizacion.cliente_nombre || 'Nueva cotización',
            description: `${cotizacion.maquinaria} - ${cotizacion.cliente_empresa || 'Sin empresa'}`,
            timestamp: parseDate(cotizacion.created_at)!,
            estado: cotizacion.estado,
            link: '/cotizaciones'
          }))
          .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
          .slice(0, 6);

        setRecentActivities(cotizacionActivities);
        setLoading(false);
      },
      (error) => {
        console.error('Error listening to cotizaciones:', error);
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      unsubscribeCotizaciones();
    };
  }, []);

  const getEstadoBadge = (estado: string) => {
    const estadoConfig = ESTADOS_COTIZACION.find(e => e.value === estado);
    return estadoConfig || { label: estado, color: 'bg-gray-100 text-gray-800', icon: '⚪' };
  };

  const statCards = [
    {
      label: 'Total Cotizaciones',
      value: stats.totalCotizaciones,
      icon: FileText,
      bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      iconColor: 'text-blue-600 dark:text-blue-400',
      href: '/cotizaciones'
    },
    {
      label: 'Pendiente Seguimiento',
      value: stats.pendientesSeguimiento,
      icon: Clock,
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      iconColor: 'text-amber-600 dark:text-amber-400',
      href: '/pipeline'
    },
    {
      label: 'Nuevas Hoy',
      value: stats.cotizacionesNuevasHoy,
      icon: PlusCircle,
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      href: '/cotizaciones'
    },
    {
      label: 'Cerradas Hoy',
      value: stats.ventasCerradasHoy,
      icon: CheckCircle,
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      iconColor: 'text-green-600 dark:text-green-400',
      href: '/pipeline'
    },
    {
      label: 'Ventas del Mes',
      value: stats.ventasMes,
      icon: DollarSign,
      bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      iconColor: 'text-purple-600 dark:text-purple-400',
      href: '/estadisticas',
      isCurrency: true
    },
  ];

  const maxChartValue = Math.max(...chartData.map(d => d.count), 1);

  return (
    <DashboardLayout>
      <div className="animate-fade-in space-y-6 max-w-[1600px] mx-auto">
        {/* Welcome Header */}
        <div className="mb-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            ¡Hola, Vendedor!
            <Truck size={28} className="text-lime-600" />
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-base mt-2 capitalize font-medium">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>

        {/* Stats Grid - Top Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {statCards.slice(0, 4).map((stat, index) => (
            <div key={stat.label} className={`animate-fade-in-up stagger-${index + 1}`}>
              <Link
                href={stat.href}
                className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group block h-full flex flex-col justify-between"
              >
                <div className={`w-10 h-10 rounded-2xl ${stat.bgColor} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-300`}>
                  <stat.icon size={20} className={stat.iconColor} />
                </div>
                <div>
                  <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight">
                    {loading ? (
                      <div className="h-8 w-16 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-lg" />
                    ) : (
                      stat.value.toLocaleString()
                    )}
                  </div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{stat.label}</p>
                </div>
              </Link>
            </div>
          ))}
        </div>

        {/* Ventas Banner */}
        <div className="animate-fade-in-up stagger-5">
          <Link href="/estadisticas" className="relative overflow-hidden bg-gradient-to-r from-green-800 to-green-700 rounded-3xl p-8 shadow-2xl flex items-center justify-between group">
            <div className="relative z-10 text-white">
              <p className="text-lime-300 font-semibold mb-1 text-sm tracking-wider uppercase">Ventas del Mes</p>
              <h2 className="text-5xl font-bold tracking-tight">
                {loading ? '...' : `$${stats.ventasMes.toLocaleString('es-CL')}`}
              </h2>
            </div>
            <div className="bg-white/10 p-4 rounded-full backdrop-blur-sm group-hover:bg-white/20 transition-all duration-300">
              <DollarSign size={48} className="text-lime-300" />
            </div>
            {/* Decorative circle */}
            <div className="absolute -right-10 -bottom-20 w-64 h-64 bg-lime-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-lime-500/20 transition-all duration-500"></div>
          </Link>
        </div>

        {/* Main Content Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Cotizaciones */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/30 dark:bg-slate-800/30">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white">Cotizaciones Recientes</h3>
              <Link
                href="/cotizaciones"
                className="text-sm font-medium text-gray-500 hover:text-green-700 dark:hover:text-green-400 flex items-center gap-1 transition-colors"
              >
                Ver todo
                <ChevronRight size={16} />
              </Link>
            </div>

            <div className="flex-1 min-h-[300px] flex flex-col justify-center">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-gray-50 dark:bg-slate-800 animate-pulse rounded-2xl" />
                  ))}
                </div>
              ) : recentActivities.length === 0 ? (
                <div className="text-center p-12">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText size={32} className="text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">No hay cotizaciones recientes</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-slate-800">
                  {recentActivities.map((activity) => {
                    const estadoBadge = getEstadoBadge(activity.estado);
                    return (
                      <Link
                        key={activity.id}
                        href={activity.link}
                        className="flex items-center gap-5 px-8 py-5 hover:bg-green-50/50 dark:hover:bg-slate-800/50 transition-colors group"
                      >
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:bg-white group-hover:shadow-md transition-all duration-300">
                          <FileText size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 dark:text-white text-base truncate mb-1">{activity.title}</h4>
                          <p className="text-sm text-gray-500 truncate">{activity.description}</p>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${estadoBadge.color}`}>
                            {/* Icon rendered as component if possible, else fallback */}
                            {/* Note: In this file context, getEstadoBadge returns an object with 'icon' property. 
                                          If getEstadoBadge returns a component class, we can render it. 
                                          We need to check how it's defined. Based on previous context it returns an icon component or a string.
                                          Let's safely assume we render it if it's not a string, or handle string case.
                                          However, simplified for this specific design requirement based on image: just text primarily or icon + text.
                                      */}
                            {typeof estadoBadge.icon !== 'string' && <estadoBadge.icon size={12} strokeWidth={3} />}
                            {estadoBadge.label}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Trend Chart */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col h-full">
            <div className="mb-8">
              <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">Tendencia Cotizaciones</h3>
              <p className="text-sm text-gray-500">Últimos 7 días</p>

              <div className="flex items-end gap-4 mt-6">
                <div className="text-center">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white block">{weekTotals.thisWeek}</span>
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Esta semana</span>
                </div>
                <div className="text-center pl-4 border-l border-gray-200 dark:border-slate-700">
                  <span className="text-4xl font-bold text-gray-400 block">{weekTotals.lastWeek}</span>
                  <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Semana pasada</span>
                </div>
              </div>
            </div>

            <div className="flex-1 relative min-h-[150px] w-full">
              {/* Simple Area Chart Visualization */}
              <div className="absolute inset-0 flex items-end justify-between px-2 gap-2">
                {chartData.map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 flex-1 h-full justify-end group">
                    <div className="w-full bg-green-100 dark:bg-green-900/20 rounded-t-lg relative overflow-hidden transition-all duration-500 hover:bg-green-200 dark:hover:bg-green-800/30"
                      style={{ height: `${(d.count / (maxChartValue || 1)) * 100}%` }}>
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500"></div>
                    </div>
                    <span className="text-xs font-medium text-gray-400 group-hover:text-green-600 transition-colors">{d.day.charAt(0)}</span>
                  </div>
                ))}
              </div>
              {/* Smooth Curve SVG Overlay (Decorative) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" preserveAspectRatio="none">
                <path d={`M0 ${150} C ${chartData.map((d, i) => `${(i * (100 / 6))}% ${150 - ((d.count / maxChartValue) * 150)}`).join(', ')}`} fill="none" stroke="currentColor" className="text-green-500" strokeWidth="2" />
              </svg>
            </div>
          </div>
        </div>

        {/* Inventory Summary */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-gray-100 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-gray-900 dark:text-white flex items-center gap-2">
              <Truck size={20} className="text-green-600" />
              Cotizaciones por Maquinaria
            </h3>
            <Link href="/inventario" className="text-sm font-semibold text-green-600 hover:text-green-700 flex items-center gap-1">
              Ver Inventario <ChevronRight size={16} />
            </Link>
          </div>

          {/* Simple Horizontal Bar or Pill List */}
          <div className="flex flex-wrap gap-4">
            {loading ? (
              <div className="h-10 bg-gray-50 w-full animate-pulse rounded-full"></div>
            ) : maquinariaStats.length === 0 ? (
              <p className="text-gray-500 text-sm">No hay datos disponibles</p>
            ) : (
              maquinariaStats.map((stat) => (
                <div key={stat.name} className="flex items-center gap-3 pl-2 pr-4 py-2 bg-gray-50 dark:bg-slate-800/50 rounded-full border border-gray-100 dark:border-slate-700">
                  <div className={`w-2.5 h-2.5 rounded-full ${stat.color}`}></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{stat.name}</span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white border-l border-gray-200 dark:border-slate-600 pl-3">{stat.cotizaciones}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
