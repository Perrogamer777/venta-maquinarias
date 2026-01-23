'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useConfig } from '@/contexts/ConfigContext';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import type { Maquinaria } from '@/types';
import { CATEGORIAS_MAQUINARIA, ESTADOS_STOCK } from '@/lib/businessTypes';
import {
    Plus, Trash2, Edit2, Save, X, Truck, FileText,
    DollarSign, ImageIcon, Tag, Wrench, Clock, Package
} from 'lucide-react';

export default function InventarioPage() {
    const { nomenclature } = useConfig();
    const [maquinarias, setMaquinarias] = useState<Maquinaria[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({
        isOpen: false,
        id: '',
        name: ''
    });

    // Form state
    const [formData, setFormData] = useState<Partial<Maquinaria>>({
        nombre: '',
        categoria: 'Preparación de suelo',
        descripcion: '',
        especificacionesTecnicas: '',
        usoEquipo: '',
        dimensiones: '',
        variantes: [],
        imagenes: [],
        pdfUrl: '',
        precioReferencia: 0,
        estadoStock: 'DISPONIBLE',
        destacado: false,
        activa: true,
        tags: []
    });

    const [newImageUrl, setNewImageUrl] = useState('');
    const [newVariante, setNewVariante] = useState('');
    const [newTag, setNewTag] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const maquinariasSnapshot = await getDocs(collection(db, 'maquinarias'));
            const maquinariasData = maquinariasSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Maquinaria[];
            setMaquinarias(maquinariasData);
        } catch (error) {
            console.error('Error fetching maquinarias:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            if (editingId) {
                await setDoc(doc(db, 'maquinarias', editingId), formData, { merge: true });
            } else {
                await addDoc(collection(db, 'maquinarias'), formData);
            }
            await fetchData();
            resetForm();
        } catch (error) {
            console.error('Error saving maquinaria:', error);
        }
    };

    const handleDelete = (id: string, name: string) => {
        setDeleteModal({ isOpen: true, id, name });
    };

    const confirmDelete = async () => {
        try {
            await deleteDoc(doc(db, 'maquinarias', deleteModal.id));
            await fetchData();
            setDeleteModal({ isOpen: false, id: '', name: '' });
        } catch (error) {
            console.error('Error deleting maquinaria:', error);
        }
    };

    const handleEdit = (maquinaria: Maquinaria) => {
        setFormData(maquinaria);
        setEditingId(maquinaria.id || null);
        setShowForm(true);
    };

    const resetForm = () => {
        setFormData({
            nombre: '',
            categoria: 'Preparación de suelo',
            descripcion: '',
            especificacionesTecnicas: '',
            usoEquipo: '',
            dimensiones: '',
            variantes: [],
            imagenes: [],
            pdfUrl: '',
            precioReferencia: 0,
            estadoStock: 'DISPONIBLE',
            destacado: false,
            activa: true,
            tags: []
        });
        setEditingId(null);
        setShowForm(false);
    };

    const addImage = () => {
        if (newImageUrl.trim()) {
            setFormData(prev => ({
                ...prev,
                imagenes: [...(prev.imagenes || []), newImageUrl.trim()]
            }));
            setNewImageUrl('');
        }
    };

    const removeImage = (index: number) => {
        setFormData(prev => ({
            ...prev,
            imagenes: prev.imagenes?.filter((_, i) => i !== index)
        }));
    };

    const addVariante = () => {
        if (newVariante.trim()) {
            setFormData(prev => ({
                ...prev,
                variantes: [...(prev.variantes || []), newVariante.trim()]
            }));
            setNewVariante('');
        }
    };

    const removeVariante = (index: number) => {
        setFormData(prev => ({
            ...prev,
            variantes: prev.variantes?.filter((_, i) => i !== index)
        }));
    };

    const addTag = () => {
        if (newTag.trim()) {
            setFormData(prev => ({
                ...prev,
                tags: [...(prev.tags || []), newTag.trim().toLowerCase()]
            }));
            setNewTag('');
        }
    };

    const removeTag = (index: number) => {
        setFormData(prev => ({
            ...prev,
            tags: prev.tags?.filter((_, i) => i !== index)
        }));
    };

    const getStockBadge = (estado: string) => {
        const config = ESTADOS_STOCK.find(e => e.value === estado);
        return config || { label: estado, color: 'bg-gray-100 text-gray-800' };
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Truck size={28} className="text-blue-600" />
                            Inventario de {nomenclature.units.plural}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            Gestiona tu catálogo de maquinaria agrícola
                        </p>
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
                    >
                        <Plus size={18} />
                        Nueva {nomenclature.units.singular}
                    </button>
                </div>

                {/* Form Modal */}
                {showForm && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                            <div className="sticky top-0 bg-white dark:bg-slate-900 px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                    {editingId ? 'Editar' : 'Nueva'} {nomenclature.units.singular}
                                </h2>
                                <button onClick={resetForm} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="p-6 space-y-6">
                                {/* Basic Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Nombre *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.nombre}
                                            onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                                            className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                            placeholder="Ej: Aplicador de Fertilizante Granulado"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Categoría *
                                        </label>
                                        <select
                                            value={formData.categoria}
                                            onChange={(e) => setFormData(prev => ({ ...prev, categoria: e.target.value }))}
                                            className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                        >
                                            {CATEGORIAS_MAQUINARIA.map(cat => (
                                                <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Descripción (¿Para qué sirve?)
                                    </label>
                                    <textarea
                                        value={formData.descripcion}
                                        onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
                                        rows={3}
                                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                        placeholder="Describe para qué sirve este equipo..."
                                    />
                                </div>

                                {/* Technical Specs */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <Wrench size={14} className="inline mr-1" />
                                        Especificaciones Técnicas (Fabricado en)
                                    </label>
                                    <textarea
                                        value={formData.especificacionesTecnicas}
                                        onChange={(e) => setFormData(prev => ({ ...prev, especificacionesTecnicas: e.target.value }))}
                                        rows={4}
                                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono text-sm"
                                        placeholder="• Estructura en ángulo laminado 100x100x12mm&#10;• Ruedas de apoyo metálicas de 500mm..."
                                    />
                                </div>

                                {/* Use & Dimensions */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Equipo usado en
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.usoEquipo}
                                            onChange={(e) => setFormData(prev => ({ ...prev, usoEquipo: e.target.value }))}
                                            className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                            placeholder="Ej: Distribución de fertilizante granulado para frutales"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            Dimensiones
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.dimensiones}
                                            onChange={(e) => setFormData(prev => ({ ...prev, dimensiones: e.target.value }))}
                                            className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                            placeholder="Ej: Largo 2.250mm con dos puntas"
                                        />
                                    </div>
                                </div>

                                {/* Variants */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Variantes disponibles
                                    </label>
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={newVariante}
                                            onChange={(e) => setNewVariante(e.target.value)}
                                            className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                            placeholder="Ej: De 3 ganchos"
                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addVariante())}
                                        />
                                        <button onClick={addVariante} className="px-4 py-2 bg-gray-100 dark:bg-slate-700 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600">
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.variantes?.map((v, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm">
                                                {v}
                                                <button onClick={() => removeVariante(i)} className="hover:text-blue-600">
                                                    <X size={14} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Price & Stock */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            <DollarSign size={14} className="inline mr-1" />
                                            Precio Referencia
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.precioReferencia}
                                            onChange={(e) => setFormData(prev => ({ ...prev, precioReferencia: Number(e.target.value) }))}
                                            className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            <Package size={14} className="inline mr-1" />
                                            Estado Stock
                                        </label>
                                        <select
                                            value={formData.estadoStock}
                                            onChange={(e) => setFormData(prev => ({ ...prev, estadoStock: e.target.value as Maquinaria['estadoStock'] }))}
                                            className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                        >
                                            {ESTADOS_STOCK.map(estado => (
                                                <option key={estado.value} value={estado.value}>{estado.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                            <FileText size={14} className="inline mr-1" />
                                            URL del PDF
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.pdfUrl}
                                            onChange={(e) => setFormData(prev => ({ ...prev, pdfUrl: e.target.value }))}
                                            className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                            placeholder="https://..."
                                        />
                                    </div>
                                </div>

                                {/* Tags */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <Tag size={14} className="inline mr-1" />
                                        Tags / Etiquetas
                                    </label>
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={newTag}
                                            onChange={(e) => setNewTag(e.target.value)}
                                            className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                            placeholder="Ej: abonador, fertilizante"
                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                                        />
                                        <button onClick={addTag} className="px-4 py-2 bg-gray-100 dark:bg-slate-700 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600">
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.tags?.map((tag, i) => (
                                            <span key={i} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-full text-sm">
                                                #{tag}
                                                <button onClick={() => removeTag(i)} className="hover:text-red-600">
                                                    <X size={14} />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Images */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <ImageIcon size={14} className="inline mr-1" />
                                        Imágenes (URLs)
                                    </label>
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            value={newImageUrl}
                                            onChange={(e) => setNewImageUrl(e.target.value)}
                                            className="flex-1 px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                            placeholder="https://..."
                                            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addImage())}
                                        />
                                        <button onClick={addImage} className="px-4 py-2 bg-gray-100 dark:bg-slate-700 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-600">
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-4 gap-2">
                                        {formData.imagenes?.map((img, i) => (
                                            <div key={i} className="relative group aspect-video bg-gray-100 dark:bg-slate-800 rounded-lg overflow-hidden">
                                                <img src={img} alt="" className="w-full h-full object-cover" />
                                                <button
                                                    onClick={() => removeImage(i)}
                                                    className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Checkboxes */}
                                <div className="flex gap-6">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.destacado}
                                            onChange={(e) => setFormData(prev => ({ ...prev, destacado: e.target.checked }))}
                                            className="w-4 h-4 rounded border-gray-300"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Destacado</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.activa}
                                            onChange={(e) => setFormData(prev => ({ ...prev, activa: e.target.checked }))}
                                            className="w-4 h-4 rounded border-gray-300"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Activa (visible)</span>
                                    </label>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="sticky bottom-0 bg-white dark:bg-slate-900 px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
                                <button
                                    onClick={resetForm}
                                    className="px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium"
                                >
                                    <Save size={18} />
                                    {editingId ? 'Guardar Cambios' : 'Crear Maquinaria'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Maquinarias Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-64 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-2xl" />
                        ))}
                    </div>
                ) : maquinarias.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800">
                        <Truck size={48} className="mx-auto text-gray-300 dark:text-gray-700 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                            Sin maquinaria registrada
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 mb-4">
                            Comienza agregando tu primera maquinaria al catálogo
                        </p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium"
                        >
                            <Plus size={18} />
                            Agregar Maquinaria
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {maquinarias.map(maquinaria => {
                            const stockBadge = getStockBadge(maquinaria.estadoStock);
                            return (
                                <div
                                    key={maquinaria.id}
                                    className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden hover:shadow-lg transition-shadow"
                                >
                                    {/* Image */}
                                    <div className="aspect-video bg-gray-100 dark:bg-slate-800 relative">
                                        {maquinaria.imagenes?.[0] ? (
                                            <img
                                                src={maquinaria.imagenes[0]}
                                                alt={maquinaria.nombre}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full">
                                                <Truck size={48} className="text-gray-300 dark:text-gray-700" />
                                            </div>
                                        )}
                                        {/* Stock Badge */}
                                        <span className={`absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-medium ${stockBadge.color}`}>
                                            {stockBadge.label}
                                        </span>
                                        {maquinaria.destacado && (
                                            <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                                ⭐ Destacado
                                            </span>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                                    {maquinaria.categoria}
                                                </span>
                                                <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
                                                    {maquinaria.nombre}
                                                </h3>
                                            </div>
                                        </div>

                                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                                            {maquinaria.descripcion || maquinaria.usoEquipo}
                                        </p>

                                        {/* Tags */}
                                        {maquinaria.tags && maquinaria.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-3">
                                                {maquinaria.tags.slice(0, 3).map((tag, i) => (
                                                    <span key={i} className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 rounded">
                                                        #{tag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {/* Price & Actions */}
                                        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-slate-800">
                                            {maquinaria.precioReferencia ? (
                                                <span className="text-lg font-bold text-gray-900 dark:text-white">
                                                    ${maquinaria.precioReferencia.toLocaleString('es-CL')}
                                                </span>
                                            ) : (
                                                <span className="text-sm text-gray-500">Consultar precio</span>
                                            )}
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => handleEdit(maquinaria)}
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                                >
                                                    <Edit2 size={16} className="text-gray-500" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(maquinaria.id!, maquinaria.nombre)}
                                                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} className="text-red-500" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Delete Modal */}
            <ConfirmDeleteModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: '', name: '' })}
                onConfirm={confirmDelete}
                title="Eliminar Maquinaria"
                message={`¿Estás seguro de eliminar "${deleteModal.name}"? Esta acción no se puede deshacer.`}
            />
        </DashboardLayout>
    );
}
