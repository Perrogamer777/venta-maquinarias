'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { Megaphone, Send, Image as ImageIcon, Calendar, Clock, Loader2, Save, X, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Promotion {
    id?: string;
    title: string;
    description: string;
    imageUrl?: string;
    scheduledAt?: string;
    status: 'pending' | 'sent' | 'cancelled';
    createdAt: any;
}

export default function PromocionesPage() {
    const [loading, setLoading] = useState(true);
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [showForm, setShowForm] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<Promotion>>({
        title: '',
        description: '',
        imageUrl: '',
        scheduledAt: '',
        status: 'pending'
    });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        fetchPromotions();
    }, []);

    const fetchPromotions = async () => {
        try {
            const q = query(collection(db, 'promotions'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const promos = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Promotion[];
            setPromotions(promos);
        } catch (error) {
            console.error('Error fetching promotions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.title?.trim() || !formData.description?.trim()) {
            toast.error('Título y descripción son obligatorios');
            return;
        }

        setSaving(true);
        try {
            await addDoc(collection(db, 'promotions'), {
                ...formData,
                createdAt: new Date(),
                status: 'pending'
            });
            toast.success('Promoción programada correctamente');
            setShowForm(false);
            setFormData({ title: '', description: '', imageUrl: '', scheduledAt: '', status: 'pending' });
            fetchPromotions();
        } catch (error) {
            console.error('Error saving promotion:', error);
            toast.error('Error al guardar la promoción');
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // Create a reference
            const storageRef = ref(storage, `promotions/${Date.now()}_${file.name}`);

            // Upload
            const snapshot = await uploadBytes(storageRef, file);

            // Get URL
            const url = await getDownloadURL(snapshot.ref);

            setFormData(prev => ({ ...prev, imageUrl: url }));
            toast.success('Imagen subida correctamente');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Error al subir imagen (Firebase Storage)');
        } finally {
            setUploading(false);
        }
    };

    return (
        <DashboardLayout>
            <div className="animate-fade-in max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Megaphone className="text-blue-500" />
                            Promociones Masivas
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                            Gestiona y envía tus campañas de marketing por WhatsApp.
                        </p>
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-blue-600/20"
                    >
                        <Plus size={18} />
                        Nueva Campaña
                    </button>
                </div>

                {/* Create Form */}
                {showForm && (
                    <div className="mb-8 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 animate-slide-in shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Nueva Promoción</h2>
                            <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Título de la Campaña</label>
                                    <input
                                        type="text"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
                                        placeholder="Ej: Oferta Especial de Invierno ❄️"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Mensaje / Descripción</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full h-32 px-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none dark:text-white"
                                        placeholder="Escribe el contenido de tu promoción..."
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            Programación
                                        </label>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={!!formData.scheduledAt}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        // Set default to tomorrow 9am if checking
                                                        const tomorrow = new Date();
                                                        tomorrow.setDate(tomorrow.getDate() + 1);
                                                        tomorrow.setHours(9, 0, 0, 0);
                                                        // Format to ISO string for datetime-local (YYYY-MM-DDTHH:mm)
                                                        const isoString = tomorrow.toISOString().slice(0, 16);
                                                        setFormData({ ...formData, scheduledAt: isoString });
                                                    } else {
                                                        setFormData({ ...formData, scheduledAt: '' });
                                                    }
                                                }}
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                                            <span className="ml-3 text-sm font-medium text-gray-900 dark:text-gray-300">
                                                Programar envío
                                            </span>
                                        </label>
                                    </div>

                                    {formData.scheduledAt && (
                                        <div className="relative animate-fade-in-up">
                                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                            <input
                                                type="datetime-local"
                                                value={formData.scheduledAt}
                                                onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none dark:text-white"
                                            />
                                            <p className="text-xs text-blue-500 mt-1.5 flex items-center gap-1">
                                                <Clock size={12} />
                                                Se enviará automáticamente en la fecha seleccionada.
                                            </p>
                                        </div>
                                    )}
                                    {!formData.scheduledAt && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Se guardará como borrador para enviar manualmente después.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Imagen Promocional (Opcional)</label>

                                    <div className="mb-3">
                                        {formData.imageUrl ? (
                                            <div className="relative aspect-video rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 group">
                                                <img src={formData.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => setFormData({ ...formData, imageUrl: '' })}
                                                    className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="aspect-video rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700 flex flex-col items-center justify-center text-gray-400 bg-gray-50 dark:bg-slate-800/50">
                                                <ImageIcon size={48} className="mb-2 opacity-50" />
                                                <span className="text-sm">Sin imagen seleccionada</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2">
                                        <label className="flex-1 btn-secondary cursor-pointer bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 px-4 py-2 rounded-xl text-sm font-medium text-center transition-colors flex items-center justify-center gap-2 text-gray-700 dark:text-gray-300">
                                            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                                            {uploading ? 'Subiendo...' : 'Subir Imagen'}
                                            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={uploading} />
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.imageUrl}
                                            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                            className="flex-[2] px-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm dark:text-white"
                                            placeholder="O pega una URL de imagen..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-gray-100 dark:border-slate-800">
                            <button
                                onClick={() => setShowForm(false)}
                                className="px-5 py-2.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className={`flex items-center gap-2 px-6 py-2.5 text-white rounded-xl font-medium transition-all shadow-lg disabled:opacity-70 ${formData.scheduledAt
                                    ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                                    : 'bg-green-600 hover:bg-green-700 shadow-green-600/20'
                                    }`}
                            >
                                {saving ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : formData.scheduledAt ? (
                                    <Calendar size={18} />
                                ) : (
                                    <Send size={18} />
                                )}
                                {saving
                                    ? 'Guardando...'
                                    : formData.scheduledAt
                                        ? 'Programar Campaña'
                                        : 'Enviar Ahora'
                                }
                            </button>
                        </div>
                    </div>
                )}

                {/* Promotions List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {loading ? (
                        [1, 2, 3].map(i => (
                            <div key={i} className="h-64 bg-gray-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
                        ))
                    ) : promotions.length === 0 ? (
                        <div className="col-span-full py-12 text-center bg-gray-50 dark:bg-slate-900/50 rounded-3xl border border-gray-100 dark:border-slate-800">
                            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 dark:text-blue-400">
                                <Megaphone size={32} />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No hay campañas programadas</h3>
                            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                                Crea tu primera campaña promocional para conectar con tus clientes.
                            </p>
                        </div>
                    ) : (
                        promotions.map((promo) => (
                            <div key={promo.id} className="group bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                {/* Card Image */}
                                <div className="aspect-[2/1] bg-gray-100 dark:bg-slate-800 relative overflow-hidden">
                                    {promo.imageUrl ? (
                                        <img src={promo.imageUrl} alt={promo.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-slate-700">
                                            <Megaphone size={40} />
                                        </div>
                                    )}
                                    <div className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide backdrop-blur-md shadow-sm
                                        ${promo.status === 'sent' ? 'bg-green-500/90 text-white' :
                                            promo.status === 'pending' ? 'bg-amber-500/90 text-white' :
                                                'bg-gray-500/90 text-white'}`}>
                                        {promo.status === 'sent' ? 'Enviada' : promo.status === 'pending' ? 'Programada' : 'Borrador'}
                                    </div>
                                </div>

                                {/* Card Content */}
                                <div className="p-5">
                                    <div className="flex items-start justify-between mb-3">
                                        <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1 text-lg" title={promo.title}>
                                            {promo.title}
                                        </h3>
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-3 mb-4 h-15">
                                        {promo.description}
                                    </p>

                                    <div className="flex items-center gap-2 text-xs text-gray-400 font-medium pt-4 border-t border-gray-50 dark:border-slate-800">
                                        {promo.scheduledAt ? (
                                            <>
                                                <Clock size={14} className="text-blue-500" />
                                                <span>Envío: {new Date(promo.scheduledAt).toLocaleString('es-CL')}</span>
                                            </>
                                        ) : (
                                            <>
                                                <Save size={14} />
                                                <span>Guardado como borrador</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
