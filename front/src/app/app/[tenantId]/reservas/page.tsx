'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useConfig } from '@/contexts/ConfigContext';
import { useTenant } from '@/contexts/TenantContext';
import { Search, Calendar, User, Mail, Phone, X, LogIn, LogOut } from 'lucide-react';
import type { Reserva } from '@/types';

export default function ReservasPage() {
    const { nomenclature } = useConfig();
    const { tenantId, loading: tenantLoading } = useTenant();
    const [reservas, setReservas] = useState<Reserva[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
    const [selectedReserva, setSelectedReserva] = useState<Reserva | null>(null);

    // Helper para convertir Timestamp de Firestore o string a fecha
    const formatFirestoreDate = (date: unknown): string => {
        if (!date) return '-';
        if (typeof date === 'object' && date !== null && 'toDate' in date) {
            return (date as { toDate: () => Date }).toDate().toISOString().split('T')[0];
        }
        if (typeof date === 'string') {
            return date.split('T')[0];
        }
        return '-';
    };

    useEffect(() => {
        // Wait for tenant to load
        if (tenantLoading || !tenantId) {
            setLoading(true);
            return;
        }

        async function fetchReservas() {
            try {
                // ✅ QUERY FROM TENANT COLLECTION
                const snapshot = await getDocs(collection(db, 'clients', tenantId, 'reservas'));
                const data: Reserva[] = snapshot.docs.map(doc => {
                    const docData = doc.data();
                    console.log('Reserva campos:', Object.keys(docData), 'Datos:', docData);
                    return {
                        ...docData as Reserva,
                        id: doc.id,
                    };
                });

                // Sort by created_at descending
                data.sort((a, b) => {
                    const dateA = a.created_at && typeof a.created_at === 'object' && 'toDate' in a.created_at
                        ? (a.created_at as { toDate: () => Date }).toDate().getTime()
                        : new Date(a.created_at || 0).getTime();
                    const dateB = b.created_at && typeof b.created_at === 'object' && 'toDate' in b.created_at
                        ? (b.created_at as { toDate: () => Date }).toDate().getTime()
                        : new Date(b.created_at || 0).getTime();
                    return dateB - dateA;
                });

                setReservas(data);
            } catch (error) {
                console.error('Error fetching reservas:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchReservas();
    }, [tenantId, tenantLoading]);

    const filteredReservas = reservas
        .filter(reserva => {
            const matchesSearch =
                reserva.codigo_reserva?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                reserva.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                reserva.cabana?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = filterStatus === 'all' || reserva.estado === filterStatus;

            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => {
            const dateA = a.created_at && typeof a.created_at === 'object' && 'toDate' in a.created_at
                ? (a.created_at as { toDate: () => Date }).toDate().getTime()
                : new Date(a.created_at || 0).getTime();
            const dateB = b.created_at && typeof b.created_at === 'object' && 'toDate' in b.created_at
                ? (b.created_at as { toDate: () => Date }).toDate().getTime()
                : new Date(b.created_at || 0).getTime();
            return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
        });

    const getStatusBadge = (estado: string) => {
        const styles: Record<string, string> = {
            'CONFIRMADA': 'bg-green-500/20 text-green-400',
            'CANCELADA': 'bg-red-500/20 text-red-400',
            'PENDIENTE_PAGO': 'bg-amber-500/20 text-amber-400',
        };
        return styles[estado] || 'bg-gray-500/20 text-gray-400';
    };

    return (
        <>
            <div className="animate-fade-in">
                {/* Header */}
                <div className="mb-5">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reservas</h1>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-0.5">Gestiona las pre-reservas del chatbot</p>
                </div>

                {/* Filters */}
                <div className="glass rounded-lg p-3 mb-4 flex flex-wrap gap-3 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input
                            type="text"
                            placeholder={`Buscar por código, cliente o ${nomenclature.units.singular.toLowerCase()}...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="PENDIENTE_PAGO">Pendiente de Pago</option>
                        <option value="CONFIRMADA">Confirmada</option>
                        <option value="CANCELADA">Cancelada</option>
                    </select>

                    <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest')}
                        className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 flex items-center gap-2"
                    >
                        <option value="newest">Más recientes primero</option>
                        <option value="oldest">Más antiguas primero</option>
                    </select>
                </div>

                {/* Table */}
                <div className="glass rounded-xl overflow-hidden">
                    {loading ? (
                        <div className="p-8 space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-16 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-lg"></div>
                            ))}
                        </div>
                    ) : filteredReservas.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No se encontraron reservas
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="text-left text-gray-600 dark:text-gray-400 text-xs border-b border-gray-200 dark:border-gray-800">
                                        <th className="px-4 py-3 font-medium">Código</th>
                                        <th className="px-4 py-3 font-medium">Cliente</th>
                                        <th className="px-4 py-3 font-medium">Teléfono</th>
                                        <th className="px-4 py-3 font-medium">{nomenclature.units.singular}</th>
                                        <th className="px-4 py-3 font-medium">Fechas</th>
                                        <th className="px-4 py-3 font-medium">Estado</th>
                                        <th className="px-4 py-3 font-medium">Creada</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                    {filteredReservas.map((reserva) => (
                                        <tr
                                            key={reserva.id}
                                            className="text-gray-600 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                                            onClick={() => setSelectedReserva(reserva)}
                                        >
                                            <td className="px-6 py-4 font-mono text-indigo-600 dark:text-indigo-400">
                                                {reserva.codigo_reserva}
                                            </td>
                                            <td className="px-6 py-4">{reserva.cliente_nombre}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{reserva.cliente_telefono || '-'}</td>
                                            <td className="px-6 py-4">{reserva.cabana}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <LogIn size={14} className="text-green-500" />
                                                        <span className="text-gray-900 dark:text-white font-medium">{reserva.fecha_inicio}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <LogOut size={14} className="text-red-400" />
                                                        <span className="text-gray-600 dark:text-gray-400">{reserva.fecha_fin}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(reserva.estado)}`}>
                                                    {reserva.estado?.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                {formatFirestoreDate(reserva.created_at)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Detail Modal - Outside main content for proper fixed positioning */}
            {selectedReserva && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] overflow-y-auto"
                    onClick={() => setSelectedReserva(null)}
                >
                    <div className="min-h-full flex items-center justify-center p-4">
                        <div
                            className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl animate-fade-in my-8"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
                                <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                                    Reserva {selectedReserva.codigo_reserva}
                                </h3>
                                <button
                                    onClick={() => setSelectedReserva(null)}
                                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                >
                                    <X size={20} className="text-gray-500 dark:text-gray-400" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-500 dark:text-gray-400">Estado</span>
                                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadge(selectedReserva.estado)}`}>
                                        {selectedReserva.estado?.replace('_', ' ')}
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                                            <Calendar size={16} />
                                            <span>Check-in</span>
                                        </div>
                                        <p className="text-gray-900 dark:text-white font-medium">{selectedReserva.fecha_inicio}</p>
                                    </div>
                                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm mb-1">
                                            <Calendar size={16} />
                                            <span>Check-out</span>
                                        </div>
                                        <p className="text-gray-900 dark:text-white font-medium">{selectedReserva.fecha_fin}</p>
                                    </div>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                                    <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">{nomenclature.units.singular}</p>
                                    <p className="text-gray-900 dark:text-white font-medium">{selectedReserva.cabana}</p>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <User size={18} className="text-gray-500 dark:text-gray-400" />
                                        <span className="text-gray-900 dark:text-white">{selectedReserva.cliente_nombre}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Mail size={18} className="text-gray-500 dark:text-gray-400" />
                                        <span className="text-gray-900 dark:text-white">{selectedReserva.cliente_email}</span>
                                    </div>
                                    {selectedReserva.cliente_telefono && (
                                        <div className="flex items-center gap-3">
                                            <Phone size={18} className="text-gray-500 dark:text-gray-400" />
                                            <span className="text-gray-900 dark:text-white">{selectedReserva.cliente_telefono}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="text-sm text-gray-500 text-center pt-2">
                                    Origen: {selectedReserva.origen} • Creada: {formatFirestoreDate(selectedReserva.created_at)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
