'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useConfig } from '@/contexts/ConfigContext';
import { useTenant } from '@/contexts/TenantContext';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import type { Cabana, ServicioAdicional } from '@/types';
import {
    Plus, Trash2, Edit2, Save, X, Building, Sparkles,
    Users, DollarSign, ImageIcon
} from 'lucide-react';

export default function CabanasPage() {
    const { nomenclature } = useConfig();
    const { tenantId, loading: tenantLoading } = useTenant();
    const [loading, setLoading] = useState(true);
    const [cabanas, setCabanas] = useState<Cabana[]>([]);
    const [servicios, setServicios] = useState<ServicioAdicional[]>([]);
    const [editingCabana, setEditingCabana] = useState<Cabana | null>(null);
    const [editingServicio, setEditingServicio] = useState<ServicioAdicional | null>(null);
    const [showCabanaForm, setShowCabanaForm] = useState(false);
    const [showServicioForm, setShowServicioForm] = useState(false);
    const [saving, setSaving] = useState(false);

    // Delete confirmation modal states
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [cabanaToDelete, setCabanaToDelete] = useState<{ id: string; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Scroll to top when modal opens
    useEffect(() => {
        if (showCabanaForm || showServicioForm) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [showCabanaForm, showServicioForm]);

    // Form states
    const [cabanaForm, setCabanaForm] = useState<Cabana>({
        nombre: '',
        descripcion: '',
        amenidades: '',
        capacidad: 2,
        precioPorNoche: 0,
        imagenes: [],
        esPremium: false,
        activa: true
    });
    const [newImageUrl, setNewImageUrl] = useState('');

    const [servicioForm, setServicioForm] = useState<ServicioAdicional>({
        nombre: '',
        descripcion: '',
        precio: 0,
        cabanas: [],
        activo: true
    });

    useEffect(() => {
        if (tenantLoading || !tenantId) {
            setLoading(true);
            return;
        }
        fetchData();
    }, [tenantId, tenantLoading]);

    async function fetchData() {
        try {
            // ✅ QUERY FROM TENANT COLLECTION
            const cabanasSnapshot = await getDocs(collection(db, 'clients', tenantId!, 'cabanas'));
            const cabanasData = cabanasSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Cabana));
            setCabanas(cabanasData);

            // ✅ QUERY FROM TENANT COLLECTION
            const serviciosSnapshot = await getDocs(collection(db, 'clients', tenantId!, 'servicios_adicionales'));
            const serviciosData = serviciosSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as ServicioAdicional));
            setServicios(serviciosData);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    }

    // Cabañas CRUD
    const handleSaveCabana = async () => {
        if (!tenantId) return;
        setSaving(true);
        try {
            if (editingCabana?.id) {
                await setDoc(doc(db, 'clients', tenantId, 'cabanas', editingCabana.id), cabanaForm);
            } else {
                await addDoc(collection(db, 'clients', tenantId, 'cabanas'), cabanaForm);
            }
            await fetchData();
            resetCabanaForm();
        } catch (error) {
            console.error('Error saving cabana:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCabana = async (id: string, name: string) => {
        setCabanaToDelete({ id, name });
        setShowDeleteModal(true);
    };

    const confirmDeleteCabana = async () => {
        if (!cabanaToDelete || !tenantId) return;

        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'clients', tenantId, 'cabanas', cabanaToDelete.id));
            await fetchData();
            setShowDeleteModal(false);
            setCabanaToDelete(null);
        } catch (error) {
            console.error('Error deleting cabana:', error);
            alert('Error al eliminar la cabaña');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleEditCabana = (cabana: Cabana) => {
        setEditingCabana(cabana);
        setCabanaForm(cabana);
        setShowCabanaForm(true);
    };

    const resetCabanaForm = () => {
        setEditingCabana(null);
        setCabanaForm({
            nombre: '',
            descripcion: '',
            amenidades: '',
            capacidad: 2,
            precioPorNoche: 0,
            imagenes: [],
            esPremium: false,
            activa: true
        });
        setNewImageUrl('');
        setShowCabanaForm(false);
    };

    const addImage = () => {
        if (newImageUrl.trim() && !cabanaForm.imagenes?.includes(newImageUrl.trim())) {
            setCabanaForm({
                ...cabanaForm,
                imagenes: [...(cabanaForm.imagenes || []), newImageUrl.trim()]
            });
            setNewImageUrl('');
        }
    };

    const removeImage = (index: number) => {
        setCabanaForm({
            ...cabanaForm,
            imagenes: cabanaForm.imagenes?.filter((_, i) => i !== index) || []
        });
    };

    // Servicios CRUD
    const handleSaveServicio = async () => {
        if (!tenantId) return;
        setSaving(true);
        try {
            if (editingServicio?.id) {
                await setDoc(doc(db, 'clients', tenantId, 'servicios_adicionales', editingServicio.id), servicioForm);
            } else {
                await addDoc(collection(db, 'clients', tenantId, 'servicios_adicionales'), servicioForm);
            }
            await fetchData();
            resetServicioForm();
        } catch (error) {
            console.error('Error saving servicio:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteServicio = async (id: string) => {
        if (!tenantId || !confirm('¿Estás seguro de eliminar este servicio?')) return;
        try {
            await deleteDoc(doc(db, 'clients', tenantId, 'servicios_adicionales', id));
            await fetchData();
        } catch (error) {
            console.error('Error deleting servicio:', error);
        }
    };

    const handleEditServicio = (servicio: ServicioAdicional) => {
        setEditingServicio(servicio);
        setServicioForm(servicio);
        setShowServicioForm(true);
    };

    const resetServicioForm = () => {
        setEditingServicio(null);
        setServicioForm({
            nombre: '',
            descripcion: '',
            precio: 0,
            cabanas: [],
            activo: true
        });
        setShowServicioForm(false);
    };

    const toggleCabanaInServicio = (cabanaName: string) => {
        const currentCabanas = servicioForm.cabanas || [];
        if (currentCabanas.includes(cabanaName)) {
            setServicioForm({
                ...servicioForm,
                cabanas: currentCabanas.filter(c => c !== cabanaName)
            });
        } else {
            setServicioForm({
                ...servicioForm,
                cabanas: [...currentCabanas, cabanaName]
            });
        }
    };

    return (
        <>
            <div className="space-y-6 animate-fade-in">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{nomenclature.units.plural} y Servicios</h1>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-0.5">Administra las {nomenclature.units.plural.toLowerCase()} disponibles y los servicios adicionales</p>
                </div>

                {loading ? (
                    <div className="space-y-6">
                        <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
                        <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
                    </div>
                ) : (
                    <>
                        {/* Cabañas Section */}
                        <div className="glass rounded-xl p-4 border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Building className="text-emerald-500" size={20} />
                                    {nomenclature.units.plural}
                                </h2>
                                <button
                                    onClick={() => setShowCabanaForm(true)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                                >
                                    <Plus size={16} />
                                    Nueva {nomenclature.units.singular}
                                </button>
                            </div>

                            {/* Cabañas Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {cabanas.map((cabana) => (
                                    <div
                                        key={cabana.id}
                                        className={`rounded-xl border-2 transition-all duration-300 overflow-hidden hover:-translate-y-1 hover:shadow-lg ${cabana.activa
                                            ? 'bg-white dark:bg-gray-800 border-emerald-200 dark:border-emerald-800 hover:shadow-emerald-500/10'
                                            : 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 opacity-60'
                                            }`}
                                    >
                                        {/* Image thumbnail */}
                                        {cabana.imagenes && cabana.imagenes.length > 0 && (
                                            <div className="relative h-32 bg-gray-100 dark:bg-gray-700">
                                                <img
                                                    src={cabana.imagenes[0]}
                                                    alt={cabana.nombre}
                                                    className="w-full h-full object-cover"
                                                />
                                                {cabana.imagenes.length > 1 && (
                                                    <span className="absolute bottom-2 right-2 px-2 py-0.5 text-xs bg-black/60 text-white rounded">
                                                        +{cabana.imagenes.length - 1} fotos
                                                    </span>
                                                )}
                                                {cabana.esPremium && (
                                                    <span className="absolute top-2 left-2 px-2 py-0.5 text-xs bg-amber-500 text-white rounded-full font-medium">
                                                        Premium
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <div className="p-4">
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-semibold text-gray-900 dark:text-white">{cabana.nombre}</h3>
                                                <span className={`px-2 py-0.5 text-xs rounded-full ${cabana.activa
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                                                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                                                    }`}>
                                                    {cabana.activa ? 'Activa' : 'Inactiva'}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">{cabana.descripcion}</p>
                                            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                                                <span className="flex items-center gap-1">
                                                    <Users size={14} />
                                                    {cabana.capacidad} personas
                                                </span>
                                                <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                                                    <DollarSign size={14} />
                                                    ${cabana.precioPorNoche?.toLocaleString() || 0}/noche
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEditCabana(cabana)}
                                                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/30"
                                                >
                                                    <Edit2 size={14} />
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => cabana.id && handleDeleteCabana(cabana.id, cabana.nombre)}
                                                    className="flex items-center justify-center gap-1 px-3 py-2 text-sm bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {cabanas.length === 0 && (
                                    <div className="col-span-full text-center py-12 text-gray-500">
                                        No hay {nomenclature.units.plural.toLowerCase()} registradas. ¡Crea la primera!
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Servicios Adicionales Section */}
                        <div className="glass rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Sparkles className="text-amber-500" />
                                    Servicios Adicionales
                                </h2>
                                <button
                                    onClick={() => setShowServicioForm(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition-colors"
                                >
                                    <Plus size={18} />
                                    Nuevo Servicio
                                </button>
                            </div>

                            {/* Servicios Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-gray-200 dark:border-gray-700">
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Servicio</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Descripción</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">{nomenclature.units.plural}</th>
                                            <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Precio</th>
                                            <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {servicios.map((servicio) => (
                                            <tr key={servicio.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                                <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{servicio.nombre}</td>
                                                <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">{servicio.descripcion}</td>
                                                <td className="py-3 px-4">
                                                    <div className="flex flex-wrap gap-1">
                                                        {servicio.cabanas && servicio.cabanas.length > 0 ? (
                                                            servicio.cabanas.map((cabana, idx) => (
                                                                <span key={idx} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded">
                                                                    {cabana}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-xs text-gray-400">Todas</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 text-sm font-semibold text-amber-600 dark:text-amber-400">
                                                    {servicio.precio ? `$${servicio.precio.toLocaleString()}` : '-'}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => handleEditServicio(servicio)}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors dark:hover:bg-blue-900/20"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => servicio.id && handleDeleteServicio(servicio.id)}
                                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors dark:hover:bg-red-900/20"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {servicios.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="text-center py-12 text-gray-500">
                                                    No hay servicios adicionales registrados.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {/* Cabaña Form Modal */}
                {showCabanaForm && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 p-4 overflow-y-auto animate-fade-in" onClick={resetCabanaForm}>
                        <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-5xl w-full my-auto animate-scale-in" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {editingCabana ? `Editar ${nomenclature.units.singular}` : `Nueva ${nomenclature.units.singular}`}
                                </h3>
                                <button onClick={resetCabanaForm} className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="p-6">
                                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                                    {/* Left Column - 3/5 width */}
                                    <div className="lg:col-span-3 space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                                            <input
                                                type="text"
                                                value={cabanaForm.nombre}
                                                onChange={(e) => setCabanaForm({ ...cabanaForm, nombre: e.target.value })}
                                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white text-base"
                                                placeholder={`Ej: ${nomenclature.units.singular} Laurel`}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                                            <textarea
                                                value={cabanaForm.descripcion}
                                                onChange={(e) => setCabanaForm({ ...cabanaForm, descripcion: e.target.value })}
                                                rows={8}
                                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white resize-none"
                                                placeholder={`Descripción completa de la ${nomenclature.units.singular.toLowerCase()}...`}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Capacidad (personas)</label>
                                                <input
                                                    type="number"
                                                    value={cabanaForm.capacidad}
                                                    onChange={(e) => setCabanaForm({ ...cabanaForm, capacidad: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white"
                                                    min="1"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Precio por Noche ($)</label>
                                                <input
                                                    type="number"
                                                    value={cabanaForm.precioPorNoche}
                                                    onChange={(e) => setCabanaForm({ ...cabanaForm, precioPorNoche: parseInt(e.target.value) || 0 })}
                                                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white"
                                                    min="0"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amenidades</label>
                                            <textarea
                                                value={cabanaForm.amenidades || ''}
                                                onChange={(e) => setCabanaForm({ ...cabanaForm, amenidades: e.target.value })}
                                                rows={3}
                                                className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white text-sm resize-none"
                                                placeholder="Ej: Estufa a pellet, WiFi, TV Cable, Parrilla, Estacionamiento..."
                                            />
                                        </div>
                                        <div className="flex items-center gap-3 pt-2">
                                            <input
                                                type="checkbox"
                                                id="cabanaActiva"
                                                checked={cabanaForm.activa}
                                                onChange={(e) => setCabanaForm({ ...cabanaForm, activa: e.target.checked })}
                                                className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                                            />
                                            <label htmlFor="cabanaActiva" className="text-sm font-medium text-gray-700 dark:text-gray-300">{nomenclature.units.singular} Activa (disponible para reservas)</label>
                                        </div>
                                    </div>

                                    {/* Right Column - Images 2/5 width */}
                                    <div className="lg:col-span-2 space-y-3">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                                Imágenes ({cabanaForm.imagenes?.length || 0})
                                            </label>
                                            <div className="flex gap-2 mb-3">
                                                <input
                                                    type="text"
                                                    value={newImageUrl}
                                                    onChange={(e) => setNewImageUrl(e.target.value)}
                                                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addImage())}
                                                    className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white text-sm"
                                                    placeholder="https://..."
                                                />
                                                <button
                                                    type="button"
                                                    onClick={addImage}
                                                    className="px-4 py-2.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl transition-colors font-medium"
                                                >
                                                    <Plus size={18} />
                                                </button>
                                            </div>
                                            {cabanaForm.imagenes && cabanaForm.imagenes.length > 0 ? (
                                                <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                                                    {cabanaForm.imagenes.map((url, index) => (
                                                        <div key={index} className="relative group aspect-square">
                                                            <img
                                                                src={url}
                                                                alt={`Imagen ${index + 1}`}
                                                                className="w-full h-full rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                                                            />
                                                            <button
                                                                type="button"
                                                                onClick={() => removeImage(index)}
                                                                className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                            >
                                                                <X size={12} />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="h-48 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-700">
                                                    <ImageIcon size={40} className="text-gray-400 mb-3" />
                                                    <p className="text-sm text-gray-500 font-medium">No hay imágenes</p>
                                                    <p className="text-xs text-gray-400">Añade URLs de imágenes arriba</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                                <button
                                    onClick={resetCabanaForm}
                                    className="px-5 py-2.5 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors font-medium"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveCabana}
                                    disabled={saving || !cabanaForm.nombre}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-xl transition-colors font-medium"
                                >
                                    <Save size={18} />
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Servicio Form Modal */}
                {showServicioForm && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={resetServicioForm}>
                        <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {editingServicio ? 'Editar Servicio' : 'Nuevo Servicio'}
                                </h3>
                                <button onClick={resetServicioForm} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre del Servicio</label>
                                    <input
                                        type="text"
                                        value={servicioForm.nombre}
                                        onChange={(e) => setServicioForm({ ...servicioForm, nombre: e.target.value })}
                                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none dark:text-white"
                                        placeholder="Ej: Uso de Tinajas"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
                                    <textarea
                                        value={servicioForm.descripcion}
                                        onChange={(e) => setServicioForm({ ...servicioForm, descripcion: e.target.value })}
                                        rows={2}
                                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none dark:text-white"
                                        placeholder="Descripción del servicio..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Precio ($ - opcional)</label>
                                    <input
                                        type="number"
                                        value={servicioForm.precio || ''}
                                        onChange={(e) => setServicioForm({ ...servicioForm, precio: parseInt(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none dark:text-white"
                                        min="0"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        {nomenclature.units.plural} donde aplica
                                        <span className="text-gray-400 font-normal ml-1">(deja vacío si aplica a todas)</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                        {cabanas.map((cabana) => (
                                            <label
                                                key={cabana.id}
                                                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${(servicioForm.cabanas || []).includes(cabana.nombre.toLowerCase())
                                                    ? 'bg-amber-100 dark:bg-amber-900/30'
                                                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                                                    }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={(servicioForm.cabanas || []).includes(cabana.nombre.toLowerCase())}
                                                    onChange={() => toggleCabanaInServicio(cabana.nombre.toLowerCase())}
                                                    className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                                />
                                                <span className="text-sm text-gray-700 dark:text-gray-300">{cabana.nombre}</span>
                                            </label>
                                        ))}
                                        {cabanas.length === 0 && (
                                            <p className="col-span-2 text-sm text-gray-400 text-center py-2">No hay {nomenclature.units.plural.toLowerCase()} registradas</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="servicioActivo"
                                        checked={servicioForm.activo}
                                        onChange={(e) => setServicioForm({ ...servicioForm, activo: e.target.checked })}
                                        className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                                    />
                                    <label htmlFor="servicioActivo" className="text-sm text-gray-700 dark:text-gray-300">
                                        Servicio activo
                                    </label>
                                </div>
                            </div>
                            <div className="p-6 border-t border-gray-200 dark:border-gray-800 flex justify-end gap-3">
                                <button
                                    onClick={resetServicioForm}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSaveServicio}
                                    disabled={saving || !servicioForm.nombre}
                                    className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                                >
                                    <Save size={18} />
                                    {saving ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Delete Confirmation Modal */}
            <ConfirmDeleteModal
                isOpen={showDeleteModal}
                onClose={() => {
                    setShowDeleteModal(false);
                    setCabanaToDelete(null);
                }}
                onConfirm={confirmDeleteCabana}
                title={cabanaToDelete?.name || ''}
                isLoading={isDeleting}
            />
        </>
    );
}
