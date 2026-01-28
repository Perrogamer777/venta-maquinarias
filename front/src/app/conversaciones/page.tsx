'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useEffect, useState, useRef } from 'react';
import { collection, getDocs, query, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    Search, MessageSquare, Send, Zap, PauseCircle, PlayCircle, Eye, EyeOff,
    User, UserCircle, UserCircle2, UserCheck, UserCog, Users, CircleUser, Contact, PersonStanding, Baby
} from 'lucide-react';
import type { Conversacion, Mensaje } from '@/types';
import type { LucideIcon } from 'lucide-react';

// Avatar icons for clients - person-related icons
const AVATAR_ICONS: LucideIcon[] = [User, UserCircle, UserCircle2, UserCheck, UserCog, Users, CircleUser, Contact, PersonStanding, Baby];
const AVATAR_COLORS = [
    'from-orange-400 to-red-500',
    'from-green-400 to-emerald-500',
    'from-purple-400 to-indigo-500',
    'from-pink-400 to-rose-500',
    'from-blue-400 to-cyan-500',
    'from-amber-400 to-yellow-500',
    'from-teal-400 to-green-500',
    'from-indigo-400 to-purple-500',
    'from-rose-400 to-pink-500',
    'from-cyan-400 to-blue-500',
];

// Get consistent avatar for a phone number
const getAvatarForPhone = (phone: string) => {
    const hash = phone.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return {
        Icon: AVATAR_ICONS[hash % AVATAR_ICONS.length],
        gradient: AVATAR_COLORS[hash % AVATAR_COLORS.length]
    };
};

// Format Chilean phone number: 56971223060 -> +569 7122 3060
const formatPhoneNumber = (phone: string): string => {
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');

    // Chilean format: 56 + 9 + XXXX + XXXX
    if (cleaned.length === 11 && cleaned.startsWith('56')) {
        return `+${cleaned.slice(0, 2)}${cleaned.slice(2, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
    }
    // If starts with 9 and is 9 digits (local format)
    if (cleaned.length === 9 && cleaned.startsWith('9')) {
        return `+56${cleaned.slice(0, 1)} ${cleaned.slice(1, 5)} ${cleaned.slice(5)}`;
    }
    // Default: add spaces every 4 digits
    return phone.replace(/(\d{4})(?=\d)/g, '$1 ');
};

export default function ConversacionesPage() {
    const [conversaciones, setConversaciones] = useState<Conversacion[]>([]);
    const [selectedConv, setSelectedConv] = useState<Conversacion | null>(null);
    const [mensajes, setMensajes] = useState<Mensaje[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMensajes, setLoadingMensajes] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom when messages change
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [mensajes]);

    useEffect(() => {
        if (!db) {
            console.error('Firebase not initialized');
            setLoading(false);
            return;
        }

        // Real-time listener for conversations
        const unsubscribe = onSnapshot(
            collection(db, 'chats'),
            async (snapshot) => {
                console.log('📊 Firestore snapshot received. Docs count:', snapshot.docs.length);
                console.log('📊 Snapshot metadata:', snapshot.metadata);

                const convs: Conversacion[] = [];

                for (const docSnapshot of snapshot.docs) {
                    const telefono = docSnapshot.id;
                    const chatData = docSnapshot.data();
                    console.log('💬 Processing chat:', telefono, chatData);

                    // Fetch last message for preview
                    const mensajesRef = collection(db, 'chats', telefono, 'messages');
                    const mensajesQuery = query(mensajesRef, orderBy('timestamp', 'desc'), limit(1));
                    const mensajesSnapshot = await getDocs(mensajesQuery);

                    console.log('📨 Messages for', telefono, ':', mensajesSnapshot.docs.length);

                    let ultimoMensaje = '';
                    let ultimaFecha = '';

                    if (!mensajesSnapshot.empty) {
                        const lastMsg = mensajesSnapshot.docs[0].data() as any;
                        // Soportar ambos formatos: nuevo (parts) y viejo (content)
                        ultimoMensaje = lastMsg.parts?.[0]?.text || lastMsg.content || '';
                        ultimaFecha = lastMsg.timestamp || '';
                    }

                    // Use last_interaction from chat document if available
                    let lastMessageAt: Date | null = null;
                    if (chatData.last_interaction?.toDate) {
                        lastMessageAt = chatData.last_interaction.toDate();
                    } else if (chatData.lastMessageAt?.toDate) {
                        // Fallback to lastMessageAt if exists
                        lastMessageAt = chatData.lastMessageAt.toDate();
                    } else if (ultimaFecha) {
                        const parsed = new Date(ultimaFecha);
                        if (!isNaN(parsed.getTime())) {
                            lastMessageAt = parsed;
                        }
                    }

                    convs.push({
                        telefono,
                        ultimoMensaje: ultimoMensaje.substring(0, 50) + (ultimoMensaje.length > 50 ? '...' : ''),
                        ultimaFecha: lastMessageAt && !isNaN(lastMessageAt.getTime()) ? lastMessageAt.toISOString() : ultimaFecha,
                        agentePausado: chatData.agentePausado || chatData.agent_paused || false,
                        unread: chatData.unread || false,
                    });
                }

                console.log('✅ Total conversations loaded:', convs.length);

                // Sort by last message date (most recent first)
                convs.sort((a, b) => {
                    if (!a.ultimaFecha) return 1;
                    if (!b.ultimaFecha) return -1;
                    return new Date(b.ultimaFecha).getTime() - new Date(a.ultimaFecha).getTime();
                });

                setConversaciones(convs);
                setLoading(false);
            },
            (error) => {
                console.error('❌ Error listening to conversations:', error);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const loadMensajes = async (telefono: string) => {
        if (!db) {
            console.error('Firebase not initialized');
            return;
        }

        setLoadingMensajes(true);
        try {
            const mensajesRef = collection(db, 'chats', telefono, 'messages');
            const mensajesQuery = query(mensajesRef, orderBy('timestamp', 'asc'));
            const snapshot = await getDocs(mensajesQuery);

            const msgs: Mensaje[] = snapshot.docs.map(doc => doc.data() as Mensaje);
            setMensajes(msgs);
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoadingMensajes(false);
        }
    };

    // Enviar mensaje de WhatsApp
    const sendMessage = async () => {
        if (!newMessage.trim() || !selectedConv || sending) return;

        setSending(true);
        try {
            // Usar API route de Next.js (sin CORS) en production y dev
            const fullUrl = '/api/send-message';

            console.log('🔍 Attempting to send to:', fullUrl);
            console.log('📱 Phone:', selectedConv.telefono);
            console.log('💬 Message:', newMessage);

            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phone: selectedConv.telefono,
                    message: newMessage
                })
            });

            if (!response.ok) {
                throw new Error('Error al enviar mensaje');
            }

            // Agregar mensaje localmente para feedback inmediato
            const newMsg: Mensaje = {
                role: 'assistant', // Cambiado de 'model' a 'assistant' para consistencia con backend
                parts: [{ text: newMessage }],
                timestamp: new Date().toISOString()
            };

            setMensajes([...mensajes, newMsg]);
            setNewMessage('');
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Error al enviar mensaje. Verifica que el chatbot esté corriendo.');
        } finally {
            setSending(false);
        }
    };

    // Toggle Agent Pause Status
    const togglePauseAgent = async (e: React.MouseEvent, conv: Conversacion) => {
        e.stopPropagation();
        if (!db) return;

        const newStatus = !conv.agentePausado;

        // Optimistic update
        setConversaciones(prev => prev.map(c =>
            c.telefono === conv.telefono ? { ...c, agentePausado: newStatus } : c
        ));
        if (selectedConv?.telefono === conv.telefono) {
            setSelectedConv(prev => prev ? { ...prev, agentePausado: newStatus } : null);
        }

        try {
            await updateDoc(doc(db, 'chats', conv.telefono), {
                agentePausado: newStatus
            });
        } catch (error) {
            console.error('Error updating pause status:', error);
            // Revert on error
            setConversaciones(prev => prev.map(c =>
                c.telefono === conv.telefono ? { ...c, agentePausado: !newStatus } : c
            ));
        }
    };

    // Toggle Unread Status
    const toggleUnread = async (e: React.MouseEvent, conv: Conversacion) => {
        e.stopPropagation();
        if (!db) return;

        const newStatus = !conv.unread;

        // Optimistic update
        setConversaciones(prev => prev.map(c =>
            c.telefono === conv.telefono ? { ...c, unread: newStatus } : c
        ));
        if (selectedConv?.telefono === conv.telefono) {
            setSelectedConv(prev => prev ? { ...prev, unread: newStatus } : null);
        }

        try {
            await updateDoc(doc(db, 'chats', conv.telefono), {
                unread: newStatus
            });
        } catch (error) {
            console.error('Error updating unread status:', error);
        }
    };

    // Templates de respuestas rápidas
    const quickReplies = [
        '¡Hola! ¿En qué puedo ayudarte?',
        'Gracias por tu consulta, revisaré la disponibilidad.',
        'Tu reserva ha sido confirmada',
        '¿Necesitas algo más?',
    ];

    const handleSelectConv = (conv: Conversacion) => {
        setSelectedConv(conv);
        loadMensajes(conv.telefono);
    };

    // Real-time listener para nuevos mensajes
    useEffect(() => {
        if (!selectedConv || !db) return;

        const mensajesRef = collection(db, 'chats', selectedConv.telefono, 'messages');
        const mensajesQuery = query(mensajesRef, orderBy('timestamp', 'asc'));

        const unsubscribe = onSnapshot(mensajesQuery, (snapshot) => {
            const msgs: Mensaje[] = snapshot.docs.map(doc => doc.data() as Mensaje);
            console.log('📩 Mensajes cargados:', msgs.length);
            if (msgs.length > 0) {
                console.log('📩 Primer mensaje:', msgs[0]);
            }
            setMensajes(msgs);
        });

        return () => unsubscribe();
    }, [selectedConv]);

    const formatDate = (dateInput: unknown) => {
        if (!dateInput) return '';

        let date: Date;

        // Si es un Timestamp de Firestore
        if (typeof dateInput === 'object' && dateInput !== null && 'toDate' in dateInput) {
            date = (dateInput as { toDate: () => Date }).toDate();
        } else if (typeof dateInput === 'string') {
            date = new Date(dateInput);
        } else {
            return '';
        }

        // Verificar si la fecha es válida
        if (isNaN(date.getTime())) return '';

        const now = new Date();
        const isToday = date.toDateString() === now.toDateString();

        if (isToday) {
            return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
    };

    const filteredConvs = conversaciones.filter(conv =>
        conv.telefono.includes(searchTerm) ||
        conv.ultimoMensaje?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <DashboardLayout>
            <div className="flex -m-6 animate-fade-in" style={{ height: 'calc(100vh - 57px)' }}>
                {/* Conversations List */}
                <div className="w-72 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-900/50">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-800">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Conversaciones</h2>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                            <input
                                type="text"
                                placeholder="Buscar por teléfono..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-4 space-y-3">
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="h-16 bg-gray-200 dark:bg-gray-800 animate-pulse rounded-lg"></div>
                                ))}
                            </div>
                        ) : filteredConvs.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                No hay conversaciones
                            </div>
                        ) : (
                            <div className="divide-y divide-gray-200 dark:divide-gray-800">
                                {filteredConvs.map((conv) => (
                                    <button
                                        key={conv.telefono}
                                        onClick={() => handleSelectConv(conv)}
                                        className={`w-full p-3 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${selectedConv?.telefono === conv.telefono ? 'bg-gray-200 dark:bg-gray-800' : ''
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            {(() => {
                                                const { Icon, gradient } = getAvatarForPhone(conv.telefono);
                                                return (
                                                    <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
                                                        <Icon size={20} className="text-white" />
                                                    </div>
                                                );
                                            })()}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-900 dark:text-white font-medium truncate">
                                                        {formatPhoneNumber(conv.telefono)}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        {formatDate(conv.ultimaFecha || '')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2">
                                                    <p className={`text-sm truncate ${conv.unread ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                                                        {conv.ultimoMensaje || 'Sin mensajes'}
                                                    </p>
                                                    <div className="flex items-center gap-1">
                                                        {conv.agentePausado && (
                                                            <PauseCircle size={14} className="text-amber-500" />
                                                        )}
                                                        {conv.unread && (
                                                            <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                {/* Chat View */}
                <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 min-h-0">
                    {selectedConv ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
                                {(() => {
                                    const { Icon, gradient } = getAvatarForPhone(selectedConv.telefono);
                                    return (
                                        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
                                            <Icon size={20} className="text-white" />
                                        </div>
                                    );
                                })()}
                                <div>
                                    <h3 className="text-gray-900 dark:text-white font-medium flex items-center gap-2">
                                        {formatPhoneNumber(selectedConv.telefono)}
                                        {selectedConv.agentePausado && (
                                            <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full flex items-center gap-1">
                                                <PauseCircle size={12} /> Pausado
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">{mensajes.length} mensajes</p>
                                </div>
                                <div className="ml-auto flex items-center gap-3">
                                    <button
                                        onClick={(e) => togglePauseAgent(e, selectedConv)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all shadow-sm group ${selectedConv.agentePausado
                                            ? 'bg-amber-100 text-amber-700 hover:bg-green-100 hover:text-green-700 border border-amber-200 hover:border-green-200'
                                            : 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 hover:border-rose-300'
                                            }`}
                                        title={selectedConv.agentePausado ? "Reanudar Agente" : "Pausar Agente"}
                                    >
                                        {selectedConv.agentePausado ? (
                                            <>
                                                <PlayCircle size={16} className="fill-current" />
                                                <span>Reanudar Agente</span>
                                            </>
                                        ) : (
                                            <>
                                                <PauseCircle size={16} />
                                                <span>Pausar Agente</span>
                                            </>
                                        )}
                                    </button>

                                    <button
                                        onClick={(e) => toggleUnread(e, selectedConv)}
                                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all shadow-sm ${selectedConv.unread
                                            ? 'bg-blue-100 text-blue-700 hover:bg-gray-100 hover:text-gray-600 border border-blue-200 hover:border-gray-200'
                                            : 'bg-white text-gray-500 hover:bg-blue-50 hover:text-blue-600 border border-gray-200 hover:border-blue-200'
                                            }`}
                                        title={selectedConv.unread ? "Marcar como Leído" : "Marcar como No Leído"}
                                    >
                                        {selectedConv.unread ? (
                                            <>
                                                <EyeOff size={16} />
                                                <span>Marcar Leído</span>
                                            </>
                                        ) : (
                                            <>
                                                <Eye size={16} />
                                                <span>Marcar No Leído</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Messages - flex-1 takes remaining space */}
                            <div className="flex-1 overflow-y-auto px-4 pt-4 min-h-0">
                                <div className="space-y-3 pb-4">
                                    {loadingMensajes ? (
                                        <div className="flex items-center justify-center h-full">
                                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
                                        </div>
                                    ) : (
                                        mensajes.map((mensaje, index) => (
                                            <div
                                                key={index}
                                                className={`flex ${(mensaje.role === 'model' || mensaje.role === 'assistant') ? 'justify-end' : 'justify-start'}`}
                                            >
                                                <div
                                                    className={`max-w-[70%] px-4 py-3 ${(mensaje.role === 'model' || mensaje.role === 'assistant') ? 'bubble-user' : 'bubble-bot'
                                                        }`}
                                                >
                                                    {/* Mostrar imagen si existe */}
                                                    {mensaje.image_url && (
                                                        <div className="mb-2">
                                                            <img
                                                                src={mensaje.image_url}
                                                                alt="Imagen de WhatsApp"
                                                                className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                                                style={{ maxHeight: '300px' }}
                                                                onClick={() => window.open(mensaje.image_url, '_blank')}
                                                            />
                                                        </div>
                                                    )}
                                                    {/* Mostrar texto (soporta formato viejo y nuevo) */}
                                                    {(() => {
                                                        // Formato nuevo: parts[0].text
                                                        const textoNuevo = mensaje.parts?.[0]?.text;
                                                        // Formato viejo: content
                                                        const textoViejo = (mensaje as any).content;
                                                        const texto = textoNuevo || textoViejo;

                                                        return texto ? (
                                                            <p className={`${(mensaje.role === 'model' || mensaje.role === 'assistant') ? 'text-white' : 'text-gray-900 dark:text-white'} whitespace-pre-wrap`}>
                                                                {texto}
                                                            </p>
                                                        ) : null;
                                                    })()}
                                                    {/* Indicador de tipo imagen sin URL (para cuando aún no está implementado en backend) */}
                                                    {mensaje.type === 'image' && !mensaje.image_url && (
                                                        <p className={`${(mensaje.role === 'model' || mensaje.role === 'assistant') ? 'text-indigo-200' : 'text-gray-500'} text-sm italic`}>
                                                            📷 Imagen enviada
                                                        </p>
                                                    )}
                                                    <p className={`text-xs mt-1 ${(mensaje.role === 'model' || mensaje.role === 'assistant') ? 'text-indigo-200' : 'text-gray-500 dark:text-gray-400'}`}>
                                                        {formatDate(mensaje.timestamp)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>
                            </div>

                            {/* Message Input */}
                            <div className="border-t border-gray-200 dark:border-gray-800 p-4 bg-gray-50 dark:bg-gray-900">
                                {/* Quick Replies */}
                                <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                                    {quickReplies.map((reply, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setNewMessage(reply)}
                                            disabled={sending}
                                            className="flex-shrink-0 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                                        >
                                            <Zap size={14} className="text-indigo-600 dark:text-indigo-400" />
                                            <span className="text-gray-700 dark:text-gray-300">{reply}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Input and Send Button */}
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                                        placeholder="Escribe un mensaje..."
                                        disabled={sending}
                                        className="flex-1 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all"
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={sending || !newMessage.trim()}
                                        className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 flex items-center gap-2"
                                    >
                                        {sending ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                                                <span>Enviando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Send size={18} />
                                                <span>Enviar</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center text-gray-500">
                                <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
                                <p>Selecciona una conversación</p>
                            </div>
                        </div>
                    )}
                </div>
            </div >
        </DashboardLayout >
    );
}
