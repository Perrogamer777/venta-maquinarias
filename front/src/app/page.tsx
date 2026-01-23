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
      <div className="animate-fade-in space-y-6">
        {/* Welcome Header */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            ¡Hola, Vendedor! <span className="text-2xl">🚜</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1 capitalize">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>

        {/* Stats Grid */}
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
              <h3 className="font-semibold text-gray-900 dark:text-white">Cotizaciones Recientes</h3>
              <Link
                href="/cotizaciones"
                className="text-sm text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 transition-colors"
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
                <FileText size={32} className="mx-auto text-gray-300 dark:text-gray-700 mb-2" />
                <p className="text-gray-500 text-sm">No hay cotizaciones recientes</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-slate-800">
                {recentActivities.map((activity) => {
                  // Get initials from the title (name)
                  const nameParts = activity.title.split(' ');
                  const initials = nameParts.length >= 2
                    ? `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase()
                    : activity.title.substring(0, 2).toUpperCase();

                  const estadoBadge = getEstadoBadge(activity.estado);

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
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${estadoBadge.color}`}>
                          {estadoBadge.icon} {estadoBadge.label}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cotizaciones Chart - Right side */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Tendencia Cotizaciones</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Últimos 7 días</p>
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
                      className="w-full bg-gradient-to-t from-blue-500 to-blue-300 dark:from-blue-600 dark:to-blue-400 rounded-t-md transition-all duration-500 hover:from-blue-400 hover:to-blue-200"
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

        {/* Maquinaria Stats */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Truck size={20} className="text-gray-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Cotizaciones por {nomenclature.units.singular}</h3>
            </div>
            <Link
              href="/inventario"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              Ver Inventario
              <ChevronRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="h-32 bg-gray-100 dark:bg-gray-800 animate-pulse rounded-xl" />
          ) : maquinariaStats.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay cotizaciones activas</p>
          ) : (
            <div className="flex items-center gap-8">
              {/* Donut Chart */}
              <div className="relative w-32 h-32 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  {(() => {
                    const total = maquinariaStats.reduce((sum, m) => sum + m.cotizaciones, 0);
                    let cumulativePercent = 0;
                    const colorMap: Record<string, string> = {
                      'bg-blue-500': '#3b82f6',
                      'bg-emerald-500': '#10b981',
                      'bg-purple-500': '#a855f7',
                      'bg-amber-500': '#f59e0b',
                      'bg-rose-500': '#f43f5e',
                    };

                    return maquinariaStats.map((maquinaria, idx) => {
                      const percent = (maquinaria.cotizaciones / total) * 100;
                      const strokeDasharray = `${percent} ${100 - percent}`;
                      const strokeDashoffset = -cumulativePercent;
                      cumulativePercent += percent;

                      return (
                        <circle
                          key={maquinaria.name}
                          cx="18"
                          cy="18"
                          r="15.915"
                          fill="none"
                          stroke={colorMap[maquinaria.color] || '#6b7280'}
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
                    {maquinariaStats.reduce((sum, m) => sum + m.cotizaciones, 0)}
                  </span>
                  <span className="text-xs text-gray-500">total</span>
                </div>
              </div>

              {/* Legend */}
              <div className="flex-1 space-y-2">
                {maquinariaStats.map((maquinaria) => {
                  const total = maquinariaStats.reduce((sum, m) => sum + m.cotizaciones, 0);
                  const percent = Math.round((maquinaria.cotizaciones / total) * 100);
                  return (
                    <div key={maquinaria.name} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${maquinaria.color}`} />
                      <span className="text-sm text-gray-600 dark:text-gray-400 flex-1 truncate">{maquinaria.name}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{maquinaria.cotizaciones}</span>
                      <span className="text-xs text-gray-400 w-10 text-right">{percent}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout >
  );
}
