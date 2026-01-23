'use client';

import { useState, useRef } from 'react';
import { Plus, Sparkles, Upload, Link as LinkIcon, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import { PromoCard } from './components/PromoCard';
import { SendModal } from './components/SendModal';
import { SkeletonPromoCard } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePromociones } from './hooks/usePromociones';
import type { Promocion } from '@/types';
import { toast } from '@/utils/toast';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

export default function PromocionesPage() {
    const [showModal, setShowModal] = useState(false);
    const [showSendModal, setShowSendModal] = useState(false);
    const [selectedPromo, setSelectedPromo] = useState<Promocion | null>(null);
    const [showAIModal, setShowAIModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [promoToDelete, setPromoToDelete] = useState<Promocion | null>(null);

    // Form state
    const [promoForm, setPromoForm] = useState({
        titulo: '',
        descripcion: '',
        imagenUrl: '',
        activa: true
    });
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState('');
    const [uploadingImage, setUploadingImage] = useState(false);
    const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // AI state
    const [aiPrompt, setAiPrompt] = useState('');
    const [generatingAI, setGeneratingAI] = useState(false);

    const { promociones, isLoading, createPromocion, updatePromocion, deletePromocion } = usePromociones();

    const resetForm = () => {
        setPromoForm({ titulo: '', descripcion: '', imagenUrl: '', activa: true });
        setImageFile(null);
        setImagePreview('');
        setImageMode('upload');
        setSelectedPromo(null);
    };

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setImagePreview(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const uploadImage = async (): Promise<string> => {
        if (!imageFile) return promoForm.imagenUrl;

        setUploadingImage(true);
        try {
            const timestamp = Date.now();
            const storageRef = ref(storage, `promociones/${timestamp}_${imageFile.name}`);
            await uploadBytes(storageRef, imageFile);
            const url = await getDownloadURL(storageRef);
            return url;
        } catch (error) {
            console.error('Error uploading image:', error);
            toast.error('Error al subir la imagen');
            return '';
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSubmit = async () => {
        if (!promoForm.titulo || !promoForm.descripcion) {
            toast.warning('Completa todos los campos obligatorios');
            return;
        }

        let imagenUrl = promoForm.imagenUrl;
        if (imageMode === 'upload' && imageFile) {
            imagenUrl = await uploadImage();
            if (!imagenUrl) return;
        }

        const promoData = {
            ...promoForm,
            imagenUrl,
            creadaEn: selectedPromo?.creadaEn || new Date().toISOString(),
            actualizadoEn: new Date().toISOString(),
        };

        if (selectedPromo?.id) {
            await updatePromocion.mutateAsync({ id: selectedPromo.id, data: promoData });
        } else {
            await createPromocion.mutateAsync(promoData as Omit<Promocion, 'id'>);
        }

        setShowModal(false);
        resetForm();
    };

    const handleEdit = (promo: Promocion) => {
        setSelectedPromo(promo);
        setPromoForm({
            titulo: promo.titulo,
            descripcion: promo.descripcion,
            imagenUrl: promo.imagenUrl || '',
            activa: promo.activa ?? true,
        });
        setImagePreview(promo.imagenUrl || '');
        setImageMode('url');
        setShowModal(true);
    };

    const handleDelete = (promo: Promocion) => {
        setPromoToDelete(promo);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!promoToDelete?.id) return;
        await deletePromocion.mutateAsync(promoToDelete.id);
        setShowDeleteModal(false);
        setPromoToDelete(null);
    };

    const handleSend = (promo: Promocion) => {
        setSelectedPromo(promo);
        setShowSendModal(true);
    };

    const handleGenerateAI = async () => {
        if (!aiPrompt.trim()) {
            toast.warning('Escribe una descripción para generar la promoción');
            return;
        }

        setGeneratingAI(true);
        try {
            const response = await fetch('/api/generate-promotion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: aiPrompt }),
            });

            const data = await response.json();

            if (data.success && data.promotion) {
                // Populate form with AI generated content
                setPromoForm({
                    titulo: data.promotion.titulo,
                    descripcion: data.promotion.descripcion,
                    imagenUrl: data.promotion.imagenUrl || '',
                    activa: true
                });

                if (data.promotion.imagenUrl) {
                    setImagePreview(data.promotion.imagenUrl);
                    setImageMode('url');
                }

                setShowAIModal(false);
                setShowModal(true);
                setAiPrompt('');
                toast.success('¡Promoción generada! Revisa y guarda');
            } else {
                toast.error(data.error || 'Error al generar promoción');
            }
        } catch (error) {
            console.error('Error generating promotion:', error);
            toast.error('Error de conexión. Inténtalo de nuevo.');
        } finally {
            setGeneratingAI(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={40} className="animate-spin text-gray-300" />
            </div>
        );
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Promociones</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Gestiona y envía promociones a tus clientes
                    </p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" size="lg" onClick={() => setShowAIModal(true)}>
                        <Sparkles size={20} />
                        Generar con IA
                    </Button>
                    <Button variant="primary" size="lg" onClick={() => { resetForm(); setShowModal(true); }}>
                        <Plus size={20} />
                        Nueva Promoción
                    </Button>
                </div>
            </div>

            {/* Promociones Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <SkeletonPromoCard key={i} />
                    ))}
                </div>
            ) : promociones.length === 0 ? (
                <EmptyState
                    icon={Plus}
                    title="No hay promociones creadas"
                    description="Crea tu primera promoción para empezar a enviar ofertas a tus clientes"
                    action={{
                        label: 'Crear Primera Promoción',
                        onClick: () => { resetForm(); setShowModal(true); },
                        icon: Plus
                    }}
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {promociones.map((promo, index) => (
                        <div
                            key={promo.id}
                            className={`animate-fade-in-up stagger-${Math.min(index + 1, 6)}`}
                        >
                            <PromoCard
                                promo={promo}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onSend={handleSend}
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-6 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                {selectedPromo ? 'Editar Promoción' : 'Nueva Promoción'}
                            </h2>
                            <button onClick={() => { setShowModal(false); resetForm(); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Título *
                                </label>
                                <input
                                    type="text"
                                    value={promoForm.titulo}
                                    onChange={(e) => setPromoForm({ ...promoForm, titulo: e.target.value })}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder="Ej: ¡Escapada Findé! 💕 Desconecta y Disfruta ✨"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Descripción *
                                </label>
                                <textarea
                                    value={promoForm.descripcion}
                                    onChange={(e) => setPromoForm({ ...promoForm, descripcion: e.target.value })}
                                    rows={4}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                    placeholder="Describe los detalles de la promoción..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Imagen
                                </label>
                                <div className="flex gap-2 mb-3">
                                    <button
                                        onClick={() => setImageMode('upload')}
                                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${imageMode === 'upload'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            }`}
                                    >
                                        <Upload size={16} className="inline mr-2" />
                                        Subir Archivo
                                    </button>
                                    <button
                                        onClick={() => setImageMode('url')}
                                        className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${imageMode === 'url'
                                            ? 'bg-emerald-600 text-white'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            }`}
                                    >
                                        <LinkIcon size={16} className="inline mr-2" />
                                        URL
                                    </button>
                                </div>

                                {imageMode === 'upload' ? (
                                    <div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            className="hidden"
                                        />
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-full px-4 py-8 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl hover:border-emerald-500 transition-colors"
                                        >
                                            <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                                {imageFile ? imageFile.name : 'Click para seleccionar una imagen'}
                                            </p>
                                        </button>
                                    </div>
                                ) : (
                                    <input
                                        type="url"
                                        value={promoForm.imagenUrl}
                                        onChange={(e) => {
                                            setPromoForm({ ...promoForm, imagenUrl: e.target.value });
                                            setImagePreview(e.target.value);
                                        }}
                                        className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="https://ejemplo.com/imagen.jpg"
                                    />
                                )}

                                {imagePreview && (
                                    <div className="mt-3 bg-gray-100 dark:bg-gray-800 rounded-xl p-2">
                                        <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-contain rounded-lg" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-6 flex items-center justify-end gap-3">
                            <Button variant="ghost" onClick={() => { setShowModal(false); resetForm(); }}>
                                Cancelar
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleSubmit}
                                isLoading={uploadingImage || createPromocion.isPending || updatePromocion.isPending}
                            >
                                {selectedPromo ? 'Actualizar' : 'Crear'} Promoción
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* AI Generation Modal */}
            {showAIModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                                    <Sparkles size={20} className="text-purple-600 dark:text-purple-400" />
                                </div>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Generar con IA</h2>
                            </div>
                            <button onClick={() => { setShowAIModal(false); setAiPrompt(''); }} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
                                <X size={20} className="text-gray-500" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Describe la promoción que quieres crear
                                </label>
                                <textarea
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    rows={4}
                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none resize-none"
                                    placeholder="Ej: Promoción de fin de semana largo con 20% de descuento en cabañas familiares..."
                                />
                            </div>
                            <p className="text-xs text-gray-500">
                                La IA generará un título, descripción e imagen para tu promoción.
                            </p>
                        </div>

                        <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-3">
                            <Button variant="ghost" onClick={() => { setShowAIModal(false); setAiPrompt(''); }}>
                                Cancelar
                            </Button>
                            <Button variant="primary" onClick={handleGenerateAI} isLoading={generatingAI}>
                                <Sparkles size={16} />
                                Generar Promoción
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Send Modal */}
            {showSendModal && selectedPromo && (
                <SendModal promo={selectedPromo} onClose={() => setShowSendModal(false)} />
            )}

            {/* Delete Confirmation Modal */}
            <ConfirmDeleteModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setPromoToDelete(null);
                }}
                onConfirm={confirmDelete}
                title={promoToDelete?.titulo || ''}
                isLoading={deletePromocion.isPending}
            />
        </div>
    );
}
