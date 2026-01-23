'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, Timestamp, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { BUSINESS_TYPES, getPresetById, type Nomenclature, DEFAULT_NOMENCLATURE } from '@/lib/businessTypes';
import {
    Users,
    Plus,
    Search,
    LayoutGrid,
    X,
    Loader2,
    Sparkles,
    CheckCircle,
    Edit,
    Trash2,
    LogOut,
    MessageSquarePlus,
    ArrowBigUp,
    Clock,
    Database
} from 'lucide-react';
import DataMigrationModal from '@/components/DataMigrationModal';

interface Client {
    id: string;
    businessName: string;
    companySubtitle?: string;
    contactEmail: string;
    contactPhone?: string;
    status: 'active' | 'inactive' | 'trial';
    createdAt: any;
    services: {
        aiPromotions: boolean;
    };
    notes?: string;
    subscriptionTier?: 'basic' | 'pro' | 'enterprise';
    businessType?: 'cabins' | 'hotel' | 'apartments' | 'custom';
    nomenclature?: Nomenclature;
}

const SERVICE_CONFIG = {
    aiPromotions: { label: 'IA Promociones', icon: Sparkles, color: 'text-amber-600', bg: 'bg-amber-100 border-amber-200' }
};

const STATUS_CONFIG = {
    active: { label: 'Activo', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    trial: { label: 'Prueba', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    inactive: { label: 'Inactivo', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' }
};

interface FeedbackPost {
    id: string;
    title: string;
    description: string;
    category: 'sugerencia' | 'mejora' | 'bug' | 'otro';
    votes: number;
    votedBy: string[];
    createdAt: any;
    authorName: string;
    status: 'pendiente' | 'en_revision' | 'completado';
    imageUrl?: string;
}

const FEEDBACK_CATEGORIES = {
    sugerencia: { label: 'Sugerencia', color: 'bg-blue-100 text-blue-700' },
    mejora: { label: 'Mejora', color: 'bg-green-100 text-green-700' },
    bug: { label: 'Bug', color: 'bg-red-100 text-red-700' },
    otro: { label: 'Otro', color: 'bg-gray-100 text-gray-700' }
};

const FEEDBACK_STATUSES = {
    pendiente: { label: 'Pendiente', color: 'bg-gray-100 text-gray-600' },
    en_revision: { label: 'En Revisión', color: 'bg-amber-100 text-amber-700' },
    completado: { label: 'Completado', color: 'bg-emerald-100 text-emerald-700' }
};

export default function AdminPage() {
    const { loading: authLoading, isAdmin, logout } = useAuth();
    const router = useRouter();
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
    const [activeTab, setActiveTab] = useState<'clients' | 'feedback'>('clients');
    const [feedbackPosts, setFeedbackPosts] = useState<FeedbackPost[]>([]);
    const [formData, setFormData] = useState({
        businessName: '',
        companySubtitle: '',
        contactEmail: '',
        contactPhone: '',
        status: 'trial' as Client['status'],
        services: {
            aiPromotions: false
        },
        notes: '',
        businessType: 'cabins' as Client['businessType'],
        nomenclature: DEFAULT_NOMENCLATURE,
        customId: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [showMigrationModal, setShowMigrationModal] = useState(false);

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            router.push('/');
        }
    }, [authLoading, isAdmin, router]);

    useEffect(() => {
        if (!isAdmin) return;

        const unsubscribe = onSnapshot(collection(db, 'clients'), (snapshot) => {
            const fetchedClients = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Client));
            setClients(fetchedClients);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isAdmin]);

    useEffect(() => {
        if (!isAdmin) return;
        const unsubscribe = onSnapshot(collection(db, 'feedback'), (snapshot) => {
            const posts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as FeedbackPost));
            posts.sort((a, b) => (b.votes || 0) - (a.votes || 0));
            setFeedbackPosts(posts);
        });
        return () => unsubscribe();
    }, [isAdmin]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (selectedClient) {
                await updateDoc(doc(db, 'clients', selectedClient.id), {
                    ...formData,
                    updatedAt: Timestamp.now()
                });
            } else {
                // Generate ID from custom input or fallback to auto-generated (if we wanted to keep that, but user wants custom)
                // If customId is empty, we force user to enter one or generate from name?
                // Let's assume formData.customId is populated.
                const clientId = formData.customId.trim().toLowerCase().replace(/\s+/g, '-');

                if (!clientId) {
                    alert('Por favor ingresa un ID personalizado');
                    setSubmitting(false);
                    return;
                }

                // Check if ID exists
                const docRef = doc(db, 'clients', clientId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    alert('Este ID ya está en uso. Por favor elige otro.');
                    setSubmitting(false);
                    return;
                }

                await setDoc(docRef, {
                    ...formData,
                    createdAt: Timestamp.now()
                });
            }

            // Note: We might want to remove this global config update if moving to strict multi-tenant
            // But for now keeping it as per legacy logic to update 'current' context if needed by legacy apps
            // although 'company_settings' is single document. Overwriting it on every client save seems wrong for multi-tenant.
            // I will COMMENT OUT this global overwrite to prevent one client overwriting another's global config.
            /* 
            await setDoc(doc(db, 'config', 'company_settings'), {
                companyName: formData.businessName,
                ...
            }, { merge: true }); 
            */

            resetForm();
        } catch (error) {
            console.error('Error saving client:', error);
            alert('Error al guardar el cliente');
        } finally {
            setSubmitting(false);
        }
    };

    const handleToggleService = async (clientId: string, serviceKey: keyof Client['services']) => {
        const client = clients.find(c => c.id === clientId);
        if (!client) return;
        try {
            await updateDoc(doc(db, 'clients', clientId), {
                [`services.${serviceKey}`]: !client.services[serviceKey]
            });
        } catch (error) {
            console.error('Error toggling service:', error);
        }
    };

    const handleDelete = async (clientId: string) => {
        if (!confirm('¿Estás seguro de eliminar este cliente?')) return;
        try {
            await deleteDoc(doc(db, 'clients', clientId));
        } catch (error) {
            console.error('Error deleting client:', error);
        }
    };

    const openEditModal = (client: Client) => {
        setSelectedClient(client);
        setFormData({
            businessName: client.businessName,
            companySubtitle: client.companySubtitle || '',
            contactEmail: client.contactEmail,
            contactPhone: client.contactPhone || '',
            status: client.status,
            services: { ...client.services },
            notes: client.notes || '',
            businessType: client.businessType || 'cabins',
            nomenclature: client.nomenclature || DEFAULT_NOMENCLATURE,
            customId: client.id
        });
        setShowModal(true);
    };

    const resetForm = () => {
        setIsClosing(true);
        setTimeout(() => {
            setFormData({
                businessName: '',
                companySubtitle: '',
                contactEmail: '',
                contactPhone: '',
                status: 'trial',
                services: { aiPromotions: false },
                notes: '',
                businessType: 'cabins',
                nomenclature: DEFAULT_NOMENCLATURE,
                customId: ''
            });
            setSelectedClient(null);
            setShowModal(false);
            setIsClosing(false);
        }, 200);
    };

    const filteredClients = clients.filter(client =>
        client.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.contactEmail.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleUpdateFeedbackStatus = async (postId: string, newStatus: FeedbackPost['status']) => {
        try {
            await updateDoc(doc(db, 'feedback', postId), { status: newStatus });
        } catch (error) {
            console.error('Error updating feedback status:', error);
        }
    };

    const formatFeedbackDate = (timestamp: any) => {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const stats = {
        total: clients.length,
        active: clients.filter(c => c.status === 'active').length,
        trial: clients.filter(c => c.status === 'trial').length
    };

    if (authLoading || !isAdmin) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-emerald-700" />
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-[#F8F9FA] overflow-hidden">

            {/* Sidebar Custom */}
            <aside className="w-72 bg-[#1A4D3E] text-white flex flex-col pt-8 pb-6 px-6 relative z-10 shrink-0">
                {/* Brand */}
                <div className="flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 bg-[#D4AF37]/20 rounded-xl flex items-center justify-center text-[#D4AF37]">
                        <LayoutGrid size={22} />
                    </div>
                    <span className="text-xs font-bold tracking-[0.2em] text-white/60">ADMINISTRADOR</span>
                </div>

                {/* Title */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold leading-tight mb-2">
                        Control de <br />
                        <span className="text-[#F59E0B]">Clientes</span>
                    </h1>
                    <p className="text-white/40 text-sm leading-relaxed max-w-[200px]">
                        Gestión de clientes, servicios y estados.
                    </p>
                </div>

                {/* Bottom Actions */}
                <div className="mt-auto space-y-3">
                    <button
                        onClick={() => setShowModal(true)}
                        className="w-full bg-[#F59E0B] hover:bg-[#D97706] text-[#1A4D3E] font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-black/10"
                    >
                        <Plus size={20} strokeWidth={2.5} />
                        Nuevo Cliente
                    </button>

                    <button
                        onClick={async () => {
                            await logout();
                            router.push('/login');
                        }}
                        className="w-full py-3 px-4 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all flex items-center gap-3 text-sm font-medium"
                    >
                        <LogOut size={18} />
                        Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto relative">
                <div className="p-8 max-w-[1600px] mx-auto">

                    {/* Top Search Bar */}
                    <div className="mb-8">
                        <div className="relative max-w-2xl">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Buscar por nombre, ID o email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-white border border-gray-200 rounded-2xl py-4 pl-12 pr-4 text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1A4D3E]/20 shadow-sm transition-all"
                            />
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                        {/* Total Clients */}
                        <div className="bg-white rounded-[1.5rem] p-6 border border-gray-100 shadow-sm flex items-start justify-between">
                            <div>
                                <h2 className="text-4xl font-bold text-gray-900 mb-1">{stats.total}</h2>
                                <p className="text-[11px] font-bold text-gray-400 tracking-wider uppercase">Total Clientes</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-xl text-gray-400">
                                <Users size={22} />
                            </div>
                        </div>

                        {/* Activos */}
                        <div className="bg-[#E8F5E9] rounded-[1.5rem] p-6 border border-[#E8F5E9] shadow-sm flex items-start justify-between">
                            <div>
                                <h2 className="text-4xl font-bold text-[#1A4D3E] mb-1">{stats.active}</h2>
                                <p className="text-[11px] font-bold text-[#1A4D3E]/60 tracking-wider uppercase">Activos</p>
                            </div>
                            <div className="p-3 bg-[#C8E6C9] rounded-xl text-[#1A4D3E]">
                                <CheckCircle size={22} />
                            </div>
                        </div>

                        {/* En Prueba */}
                        <div className="bg-[#FFF8E1] rounded-[1.5rem] p-6 border border-[#FFF8E1] shadow-sm flex items-start justify-between">
                            <div>
                                <h2 className="text-4xl font-bold text-[#b45309] mb-1">{stats.trial}</h2>
                                <p className="text-[11px] font-bold text-[#b45309]/60 tracking-wider uppercase">En Prueba</p>
                            </div>
                            <div className="p-3 bg-[#FFE082]/40 rounded-xl text-[#b45309]">
                                <Edit size={22} />
                            </div>
                        </div>
                    </div>

                    {/* Content Tabs */}
                    <div className="flex items-center gap-4 mb-8">
                        <button
                            onClick={() => setActiveTab('clients')}
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${activeTab === 'clients'
                                ? 'bg-[#1A4D3E] text-white shadow-lg shadow-[#1A4D3E]/20'
                                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                                }`}
                        >
                            <Users size={16} />
                            Clientes
                            <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeTab === 'clients' ? 'bg-[#F59E0B] text-[#1A4D3E]' : 'bg-gray-100'}`}>
                                {clients.length}
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab('feedback')}
                            className={`px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all ${activeTab === 'feedback'
                                ? 'bg-[#1A4D3E] text-white shadow-lg shadow-[#1A4D3E]/20'
                                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                                }`}
                        >
                            <MessageSquarePlus size={16} />
                            Sugerencias
                            <span className="px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px]">
                                {feedbackPosts.length}
                            </span>
                        </button>
                    </div>

                    {/* Client Grid */}
                    {activeTab === 'clients' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3 gap-6">
                            {filteredClients.map((client) => (
                                <div key={client.id} className="group rounded-[1.25rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300">
                                    {/* Card Header (Dark Green) */}
                                    <div className="bg-[#44705c] p-6 relative">
                                        <div className="flex justify-between items-start mb-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${STATUS_CONFIG[client.status].color}`}>
                                                {STATUS_CONFIG[client.status].label}
                                            </span>

                                            <button
                                                onClick={() => openEditModal(client)}
                                                className="text-white/60 hover:text-white transition-colors"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        </div>

                                        <h3 className="text-xl font-bold text-white mb-1">{client.businessName}</h3>
                                        <p className="text-white/60 text-sm font-medium">{client.contactEmail}</p>
                                    </div>

                                    {/* Card Body (White) */}
                                    <div className="bg-white p-6 min-h-[140px] flex flex-col justify-between">
                                        <div>
                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Servicios Activos</p>
                                            <div className="flex flex-wrap gap-2">
                                                {(Object.keys(SERVICE_CONFIG) as Array<keyof typeof SERVICE_CONFIG>).map(key => {
                                                    if (!client.services[key]) return null;
                                                    const service = SERVICE_CONFIG[key];
                                                    const Icon = service.icon;
                                                    return (
                                                        <div key={key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${service.bg}`}>
                                                            <Icon size={12} className={service.color} />
                                                            <span className={`text-[11px] font-bold ${service.color.replace('text-', 'text-opacity-90 ')}`}>
                                                                {service.label}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                                {Object.values(client.services).every(v => !v) && (
                                                    <span className="text-gray-400 text-xs italic">Ningún servicio activo</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-50">
                                            <code className="text-[11px] text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded">
                                                {client.id.substring(0, 8)}...
                                            </code>
                                            <button
                                                onClick={() => handleDelete(client.id)}
                                                className="text-gray-300 hover:text-red-500 transition-colors"
                                                title="Eliminar Cliente"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedClient(client);
                                                setShowMigrationModal(true);
                                            }}
                                            className="w-full mt-3 py-2 bg-gray-50 hover:bg-gray-100 text-gray-500 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition-colors border border-gray-100"
                                        >
                                            <Database size={12} />
                                            Migrar Datos
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Feedback Grid (reusing styles or simpler list) */}
                    {activeTab === 'feedback' && (
                        <div className="grid gap-4">
                            {feedbackPosts.map(post => (
                                <div key={post.id} className="bg-white p-6 rounded-2xl border border-gray-100 flex gap-4">
                                    <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl w-16 h-16 shrink-0">
                                        <ArrowBigUp className="text-[#F59E0B]" size={24} />
                                        <span className="font-bold text-sm">{post.votes}</span>
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between mb-2">
                                            <h3 className="font-bold text-lg">{post.title}</h3>
                                            <select
                                                value={post.status}
                                                onChange={(e) => handleUpdateFeedbackStatus(post.id, e.target.value as any)}
                                                className="text-xs bg-gray-50 border-none rounded-lg px-2 py-1 font-bold uppercase text-gray-500"
                                            >
                                                <option value="pendiente">Pendiente</option>
                                                <option value="en_revision">En Revisión</option>
                                                <option value="completado">Completado</option>
                                            </select>
                                        </div>
                                        <p className="text-gray-600 text-sm mb-2">{post.description}</p>
                                        <div className="flex gap-2 items-center text-xs text-gray-400">
                                            <span className={`px-2 py-0.5 rounded-full ${FEEDBACK_CATEGORIES[post.category].color} bg-opacity-20`}>
                                                {FEEDBACK_CATEGORIES[post.category].label}
                                            </span>
                                            <span>• {formatFeedbackDate(post.createdAt)}</span>
                                            <span>• {post.authorName}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Modal remains mostly the same, adjusted styles slightly if needed, but logic is fine */}
            {showModal && (
                <div
                    className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in-opacity'}`}
                    onClick={resetForm}
                >
                    <div
                        className={`bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl ${isClosing ? 'animate-scale-out' : 'animate-scale-in'}`}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-8 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <h2 className="text-2xl font-bold text-[#1A4D3E]">
                                {selectedClient ? 'Editar Cliente' : 'Nuevo Cliente'}
                            </h2>
                            <button onClick={resetForm} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X size={24} className="text-gray-400" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            {/* Form fields same as before but cleaner layout */}
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Nombre Negocio</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.businessName}
                                        onChange={e => setFormData({ ...formData, businessName: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-transparent focus:bg-white focus:border-[#F59E0B] focus:ring-0 transition-all font-medium"
                                        placeholder="Ej: Hotel del Valle"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Slogan / Descripción</label>
                                    <input
                                        type="text"
                                        value={formData.companySubtitle}
                                        onChange={e => setFormData({ ...formData, companySubtitle: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-transparent focus:bg-white focus:border-[#F59E0B] focus:ring-0 transition-all font-medium"
                                        placeholder="Ej: Hotel 4 estrellas"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Email Contacto</label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.contactEmail}
                                        onChange={e => setFormData({ ...formData, contactEmail: e.target.value })}
                                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-transparent focus:bg-white focus:border-[#F59E0B] focus:ring-0 transition-all font-medium"
                                        placeholder="admin@hotel.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">
                                        ID Personalizado (URL) {!selectedClient && <span className="text-[#F59E0B]">*</span>}
                                    </label>
                                    <input
                                        type="text"
                                        required={!selectedClient}
                                        disabled={!!selectedClient} // Cannot change ID after creation
                                        value={selectedClient ? selectedClient.id : formData.customId}
                                        onChange={e => setFormData({ ...formData, customId: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                                        className="w-full px-4 py-3 bg-gray-50 rounded-xl border-transparent focus:bg-white focus:border-[#F59E0B] focus:ring-0 transition-all font-medium disabled:opacity-50"
                                        placeholder="ej: hotel-del-valle"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        Será usado en la URL: /app/<b>{formData.customId || '...'}</b>/dashboard
                                    </p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Estado</label>
                                <div className="flex gap-3">
                                    {['active', 'trial', 'inactive'].map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, status: status as any })}
                                            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all border-2 ${formData.status === status
                                                ? 'border-[#1A4D3E] bg-[#1A4D3E]/5 text-[#1A4D3E]'
                                                : 'border-gray-100 text-gray-400 hover:border-gray-200'
                                                }`}
                                        >
                                            {STATUS_CONFIG[status as keyof typeof STATUS_CONFIG].label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Services Toggle */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Servicios</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {Object.entries(SERVICE_CONFIG).map(([key, config]) => (
                                        <label key={key} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${formData.services[key as keyof typeof formData.services]
                                            ? 'border-[#F59E0B] bg-[#F59E0B]/5'
                                            : 'border-gray-100 bg-gray-50'
                                            }`}>
                                            <input
                                                type="checkbox"
                                                checked={formData.services[key as keyof typeof formData.services]}
                                                onChange={e => setFormData({
                                                    ...formData,
                                                    services: { ...formData.services, [key]: e.target.checked }
                                                })}
                                                className="w-5 h-5 text-[#F59E0B] focus:ring-[#F59E0B] rounded"
                                            />
                                            <span className="font-bold text-gray-700">{config.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6 flex gap-4">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 py-4 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex-1 py-4 rounded-xl font-bold bg-[#F59E0B] text-[#1A4D3E] hover:bg-[#D97706] transition-colors shadow-lg shadow-[#F59E0B]/20"
                                >
                                    {submitting ? 'Guardando...' : 'Guardar Cliente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Migration Modal */}
            {showMigrationModal && selectedClient && (
                <DataMigrationModal
                    targetTenantId={selectedClient.id}
                    targetTenantName={selectedClient.businessName}
                    onClose={() => {
                        setShowMigrationModal(false);
                        setSelectedClient(null);
                    }}
                />
            )}
        </div>
    );
}
