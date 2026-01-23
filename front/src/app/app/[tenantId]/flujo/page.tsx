'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTenant } from '@/contexts/TenantContext';
import type { Reserva } from '@/types';
import { Info, CheckCircle, Clock, XCircle, MessageCircle, Home, Award, Phone, Search } from 'lucide-react';

interface Interesado {
    telefono: string;
    ultimoMensaje: string;
    ultimaFecha: string;
    valorPotencial?: {
        monto: number;
        cabana: string;
        noches: number;
    };
}

export default function FlujoPage() {
    const { tenantId, loading: tenantLoading } = useTenant();
    const [loading, setLoading] = useState(true);
    const [reservas, setReservas] = useState<Reserva[]>([]);
    const [interesados, setInteresados] = useState<Interesado[]>([]);
    const [showGuide, setShowGuide] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (tenantLoading || !tenantId) {
            setLoading(true);
            return;
        }
        async function fetchData() {
            try {
                // Fetch reservas
                const qReservas = query(collection(db, 'clients', tenantId, 'reservas'), orderBy('created_at', 'desc'));
                const reservasSnapshot = await getDocs(qReservas);
                const reservasData = reservasSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as Reserva));
                setReservas(reservasData);

                // Fetch chats para "Interesados"
                const chatsSnapshot = await getDocs(collection(db, 'clients', tenantId, 'conversaciones'));
                const telefonosConReserva = new Set(reservasData.map(r => r.cliente_telefono).filter(Boolean));

                const interesadosData: Interesado[] = [];

                for (const docSnapshot of chatsSnapshot.docs) {
                    const telefono = docSnapshot.id;
                    const chatData = docSnapshot.data();

                    // Filtrar: solo incluir si NO tiene reserva
                    if (!telefonosConReserva.has(telefono)) {
                        // Obtener último mensaje
                        const mensajesRef = collection(db, 'clients', tenantId, 'conversaciones', telefono, 'messages');
                        const mensajesQuery = query(mensajesRef, orderBy('timestamp', 'desc'), limit(1));
                        const mensajesSnapshot = await getDocs(mensajesQuery);

                        let ultimoMensaje = '';
                        let ultimaFecha = '';

                        if (!mensajesSnapshot.empty) {
                            const lastMsg = mensajesSnapshot.docs[0].data();
                            ultimoMensaje = lastMsg.parts?.[0]?.text || '';
                            ultimaFecha = lastMsg.timestamp || '';
                        }

                        interesadosData.push({
                            telefono,
                            ultimoMensaje: ultimoMensaje.substring(0, 60) + (ultimoMensaje.length > 60 ? '...' : ''),
                            ultimaFecha,
                            valorPotencial: chatData.valorPotencial || undefined
                        });
                    }
                }

                setInteresados(interesadosData);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [tenantId, tenantLoading]);

    const stages = [
        {
            id: 'INTERESADOS',
            title: '1. Interesados',
            color: 'bg-blue-100 dark:bg-blue-900/20',
            textColor: 'text-blue-800 dark:text-blue-300',
            borderColor: 'border-blue-200 dark:border-blue-800',
            icon: MessageCircle,
            description: 'Clientes que han consultado por chat.'
        },
        {
            id: 'PENDIENTE_PAGO',
            title: '2. Pre-reserva',
            color: 'bg-amber-100 dark:bg-amber-900/20',
            textColor: 'text-amber-800 dark:text-amber-300',
            borderColor: 'border-amber-200 dark:border-amber-800',
            icon: Clock,
            description: 'Reserva creada, esperando pago.'
        },
        {
            id: 'CONFIRMADA',
            title: '3. Confirmada',
            color: 'bg-green-100 dark:bg-green-900/20',
            textColor: 'text-green-800 dark:text-green-300',
            borderColor: 'border-green-200 dark:border-green-800',
            icon: CheckCircle,
            description: 'Pago recibido.'
        },
        {
            id: 'COMPLETADA',
            title: '4. Completada',
            color: 'bg-purple-100 dark:bg-purple-900/20',
            textColor: 'text-purple-800 dark:text-purple-300',
            borderColor: 'border-purple-200 dark:border-purple-800',
            icon: Award,
            description: 'Estadía finalizada.'
        },
        {
            id: 'CANCELADA',
            title: '5. Cancelada',
            color: 'bg-red-50 dark:bg-red-900/10',
            textColor: 'text-red-800 dark:text-red-300',
            borderColor: 'border-red-200 dark:border-red-800',
            icon: XCircle,
            description: 'No se concretó la reserva.'
        }
    ];

    const formatDate = (dateInput: unknown) => {
        if (!dateInput) return '';

        try {
            let date: Date;

            // Handle Firestore Timestamp
            if (typeof dateInput === 'object' && dateInput !== null && 'toDate' in dateInput) {
                date = (dateInput as { toDate: () => Date }).toDate();
            } else if (typeof dateInput === 'string') {
                date = new Date(dateInput);
            } else {
                return '';
            }

            // Check if date is valid
            if (isNaN(date.getTime())) return '';

            return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' });
        } catch {
            return '';
        }
    };

    return (

        <div className="flex flex-col h-[calc(100vh-6rem)] animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Flujo Comercial</h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">Visualiza el embudo de ventas completo</p>
                </div>
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, teléfono, código..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 pr-4 py-2 w-72 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm dark:text-white"
                    />
                </div>
            </div>

            {/* Kanban Board */}
            <div className="flex-1 overflow-x-auto pb-4">
                <div className="flex gap-4 h-full min-w-[1400px]">
                    {stages.map((stage) => {
                        // Para Interesados, usamos la lista de interesados
                        const isInteresados = stage.id === 'INTERESADOS';

                        // Filtrar por búsqueda
                        const search = searchTerm.toLowerCase().trim();

                        const filteredInteresados = interesados.filter(i =>
                            !search ||
                            i.telefono.includes(search) ||
                            i.ultimoMensaje.toLowerCase().includes(search)
                        );

                        const filteredReservas = reservas.filter(r =>
                            r.estado === stage.id && (
                                !search ||
                                r.cliente_nombre?.toLowerCase().includes(search) ||
                                r.cliente_telefono?.includes(search) ||
                                r.codigo_reserva?.toLowerCase().includes(search) ||
                                r.cabana?.toLowerCase().includes(search)
                            )
                        );

                        const stageReservas = isInteresados ? [] : filteredReservas;
                        const stageInteresados = isInteresados ? filteredInteresados : [];
                        const count = isInteresados ? stageInteresados.length : stageReservas.length;

                        // Calculate total value for this stage
                        const stageTotal = isInteresados
                            ? stageInteresados.reduce((sum, i) => sum + (i.valorPotencial?.monto || 0), 0)
                            : stageReservas.reduce((sum, r) => sum + (r.precio_total || 0), 0);

                        return (
                            <div key={stage.id} className="flex-1 flex flex-col min-w-[260px]">
                                {/* Column Header */}
                                <div className={`p-3 rounded-t-xl border-t border-x ${stage.borderColor} ${stage.color} flex-shrink-0`}>
                                    <div className="flex items-center justify-between mb-1">
                                        <h3 className={`font-bold flex items-center gap-2 text-sm ${stage.textColor}`}>
                                            <stage.icon size={16} />
                                            {stage.title}
                                        </h3>
                                        <span className={`px-2 py-0.5 rounded-full text-xs bg-white/50 font-bold ${stage.textColor}`}>
                                            {count}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className={`text-xs opacity-80 ${stage.textColor}`}>
                                            {stage.description}
                                        </p>
                                        {stageTotal > 0 && (
                                            <span className={`text-xs font-bold ${stage.textColor}`}>
                                                ${stageTotal.toLocaleString('es-CL')}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Column Body */}
                                <div className={`p-3 rounded-b-xl border-x border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex-1 overflow-y-auto space-y-2`}>
                                    {loading ? (
                                        [1, 2].map(i => (
                                            <div key={i} className="h-20 bg-white dark:bg-gray-800 rounded-lg animate-pulse" />
                                        ))
                                    ) : isInteresados ? (
                                        // Render Interesados cards
                                        stageInteresados.length > 0 ? (
                                            stageInteresados.map((int) => (
                                                <div
                                                    key={int.telefono}
                                                    className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
                                                >
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Phone size={14} className="text-blue-500" />
                                                        <span className="font-medium text-gray-900 dark:text-white text-sm">
                                                            +{int.telefono}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                                        {int.ultimoMensaje || 'Sin mensajes'}
                                                    </p>
                                                    {int.ultimaFecha && (
                                                        <p className="text-xs text-gray-400 mt-1">
                                                            {formatDate(int.ultimaFecha)}
                                                        </p>
                                                    )}
                                                    {int.valorPotencial && (
                                                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                                            <span className="text-xs text-gray-500">
                                                                {int.valorPotencial.cabana} · {int.valorPotencial.noches} noches
                                                            </span>
                                                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                                                ${int.valorPotencial.monto.toLocaleString('es-CL')}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-xs italic">
                                                No hay interesados sin reserva
                                            </div>
                                        )
                                    ) : stageReservas.length > 0 ? (
                                        // Render Reservas cards
                                        stageReservas.map((reserva) => (
                                            <div
                                                key={reserva.id || Math.random()}
                                                className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow"
                                            >
                                                <div className="flex justify-between items-start mb-1">
                                                    <span className="text-xs font-mono text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                                                        #{reserva.codigo_reserva}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {reserva.fecha_inicio}
                                                    </span>
                                                </div>

                                                <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                                                    {reserva.cliente_nombre || 'Sin nombre'}
                                                </h4>

                                                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-2">
                                                    <Home size={12} />
                                                    <span>{reserva.cabana}</span>
                                                </div>

                                                {reserva.precio_total && (
                                                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700 flex justify-between items-center">
                                                        <span className="text-xs text-gray-500">Total</span>
                                                        <span className="font-bold text-sm text-gray-900 dark:text-white">
                                                            ${reserva.precio_total.toLocaleString()}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-xs italic">
                                            Sin reservas
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Process Guide Modal */}
            {showGuide && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={() => setShowGuide(false)}
                >
                    <div
                        className="bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-900 z-10">
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                                <Info className="text-indigo-500" />
                                Guía del Proceso Comercial
                            </h3>
                            <button onClick={() => setShowGuide(false)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl text-blue-800 dark:text-blue-300 text-sm">
                                <p>Esta guía describe el flujo completo desde el primer contacto hasta la estadía completada.</p>
                            </div>

                            <div className="space-y-4">
                                {[
                                    { color: 'bg-blue-500', title: '1. Interesados', desc: 'Cliente contacta por WhatsApp. El chatbot responde automáticamente.' },
                                    { color: 'bg-amber-500', title: '2. Pre-reserva', desc: 'Cliente decide reservar. Se genera pre-reserva con 24h para pagar.' },
                                    { color: 'bg-green-500', title: '3. Confirmada', desc: 'Pago recibido. Enviar confirmación con voucher y detalles.' },
                                    { color: 'bg-purple-500', title: '4. Completada', desc: 'Estadía finalizada. Solicitar reseña y agradecer.' },
                                    { color: 'bg-red-500', title: '5. Cancelada', desc: 'No se concretó o fue cancelada por el cliente.' }
                                ].map((step, i) => (
                                    <div key={i} className="flex gap-3">
                                        <div className={`w-3 h-3 rounded-full ${step.color} mt-1.5 flex-shrink-0`} />
                                        <div>
                                            <h4 className="font-semibold text-gray-900 dark:text-white">{step.title}</h4>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">{step.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={() => setShowGuide(false)}
                                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors font-medium"
                                >
                                    Entendido
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

    );
}
