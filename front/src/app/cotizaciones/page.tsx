'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, addDoc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useConfig } from '@/contexts/ConfigContext';
import { ESTADOS_COTIZACION } from '@/lib/businessTypes';
import type { Cotizacion, Maquinaria } from '@/types';
import { Search, FileText, User, Building2, Mail, Phone, X, Plus, Edit2, Trash2, Calendar, DollarSign, Save } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';

export default function CotizacionesPage() {
    const { nomenclature } = useConfig();
    const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
    const [maquinarias, setMaquinarias] = useState<Maquinaria[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEstado, setFilterEstado] = useState<string>('');
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedCotizacion, setSelectedCotizacion] = useState<Cotizacion | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; code: string }>({
        isOpen: false,
        id: '',
        code: ''
    });

    const [formData, setFormData] = useState<Partial<Cotizacion>>({
        codigo_cotizacion: '',
        maquinaria: '',
        cliente_nombre: '',
        cliente_empresa: '',
        cliente_email: '',
        cliente_telefono: '',
        estado: 'NUEVA',
        origen: 'dashboard',
        fecha_seguimiento: '',
        presupuesto_cliente: 0,
        precio_cotizado: 0,
        notas: ''
    });

    useEffect(() => {
        // Load maquinarias for dropdown
        const fetchMaquinarias = async () => {
            const snapshot = await getDocs(collection(db, 'maquinarias'));
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Maquinaria[];
            setMaquinarias(data.filter(m => m.activa));
        };
        fetchMaquinarias();

        // Real-time listener for cotizaciones
        const unsubscribe = onSnapshot(
            collection(db, 'cotizaciones'),
            (snapshot) => {
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Cotizacion[];
                setCotizaciones(data.sort((a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                ));
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const generateCode = () => {
        const prefix = 'COT';
        const timestamp = Date.now().toString(36).toUpperCase();
        return `${prefix}-${timestamp}`;
    };

    const handleSave = async () => {
        try {
            const dataToSave = {
                ...formData,
                codigo_cotizacion: formData.codigo_cotizacion || generateCode(),
                created_at: editingId ? formData.created_at : new Date().toISOString()
            };

            if (editingId) {
                await setDoc(doc(db, 'cotizaciones', editingId), dataToSave, { merge: true });
            } else {
                await addDoc(collection(db, 'cotizaciones'), dataToSave);
            }
            resetForm();
        } catch (error) {
            console.error('Error saving cotizacion:', error);
        }
    };

    const handleEdit = (cotizacion: Cotizacion) => {
        setFormData(cotizacion);
        setEditingId(cotizacion.id || null);
        setShowForm(true);
    };

    const handleDelete = (id: string, code: string) => {
        setDeleteModal({ isOpen: true, id, code });
    };

    const confirmDelete = async () => {
        try {
            await deleteDoc(doc(db, 'cotizaciones', deleteModal.id));
            setDeleteModal({ isOpen: false, id: '', code: '' });
            setSelectedCotizacion(null);
        } catch (error) {
            console.error('Error deleting cotizacion:', error);
        }
    };

    const resetForm = () => {
        setFormData({
            codigo_cotizacion: '',
            maquinaria: '',
            cliente_nombre: '',
            cliente_empresa: '',
            cliente_email: '',
            cliente_telefono: '',
            estado: 'NUEVA',
            origen: 'dashboard',
            fecha_seguimiento: '',
            presupuesto_cliente: 0,
            precio_cotizado: 0,
            notas: ''
        });
        setEditingId(null);
        setShowForm(false);
    };

    const getEstadoBadge = (estado: string) => {
        const config = ESTADOS_COTIZACION.find(e => e.value === estado);
        return config || { label: estado, color: 'bg-gray-100 text-gray-800', icon: '⚪' };
    };

    const filteredCotizaciones = cotizaciones.filter(c => {
        const matchesSearch =
            c.cliente_nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.cliente_empresa?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.maquinaria?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.codigo_cotizacion?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesEstado = !filterEstado || c.estado === filterEstado;
        return matchesSearch && matchesEstado;
    });

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        try {
            return format(new Date(dateStr), "d MMM yyyy", { locale: es });
        } catch {
            return dateStr;
        }
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <FileText size={28} className="text-blue-600" />
                            {nomenclature.reservations.plural}
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            Gestiona tus cotizaciones y leads de venta
                        </p>
                    </div>
                    <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors"
                    >
                        <Plus size={18} />
                        Nueva {nomenclature.reservations.singular}
                    </button>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por cliente, empresa, maquinaria..."
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                        />
                    </div>
                    <select
                        value={filterEstado}
                        onChange={(e) => setFilterEstado(e.target.value)}
                        className="px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-gray-900 dark:text-white"
                    >
                        <option value="">Todos los estados</option>
                        {ESTADOS_COTIZACION.map(estado => (
                            <option key={estado.value} value={estado.value}>
                                {estado.icon} {estado.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {ESTADOS_COTIZACION.map(estado => {
                        const count = cotizaciones.filter(c => c.estado === estado.value).length;
                        return (
                            <button
                                key={estado.value}
                                onClick={() => setFilterEstado(filterEstado === estado.value ? '' : estado.value)}
                                className={`p-3 rounded-xl border transition-all ${filterEstado === estado.value
                                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-gray-300'
                                    }`}
                            >
                                <div className="text-2xl font-bold text-gray-900 dark:text-white">{count}</div>
                                <div className="text-xs text-gray-500">{estado.icon} {estado.label}</div>
                            </button>
                        );
                    })}
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
                    {loading ? (
                        <div className="p-8 space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-16 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-lg" />
                            ))}
                        </div>
                    ) : filteredCotizaciones.length === 0 ? (
                        <div className="p-12 text-center">
                            <FileText size={48} className="mx-auto text-gray-300 dark:text-gray-700 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                {searchTerm || filterEstado ? 'Sin resultados' : 'Sin cotizaciones'}
                            </h3>
                            <p className="text-gray-500 mb-4">
                                {searchTerm || filterEstado
                                    ? 'Intenta cambiar los filtros de búsqueda'
                                    : 'Comienza creando tu primera cotización'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="border-b border-gray-100 dark:border-slate-800">
                                    <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        <th className="px-4 py-3">Código</th>
                                        <th className="px-4 py-3">Cliente</th>
                                        <th className="px-4 py-3">Maquinaria</th>
                                        <th className="px-4 py-3">Estado</th>
                                        <th className="px-4 py-3">Precio</th>
                                        <th className="px-4 py-3">Fecha</th>
                                        <th className="px-4 py-3 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 dark:divide-slate-800">
                                    {filteredCotizaciones.map(cotizacion => {
                                        const estadoBadge = getEstadoBadge(cotizacion.estado);
                                        return (
                                            <tr
                                                key={cotizacion.id}
                                                className="hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer"
                                                onClick={() => setSelectedCotizacion(cotizacion)}
                                            >
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                                                        {cotizacion.codigo_cotizacion}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div>
                                                        <p className="font-medium text-gray-900 dark:text-white text-sm">
                                                            {cotizacion.cliente_nombre}
                                                        </p>
                                                        {cotizacion.cliente_empresa && (
                                                            <p className="text-xs text-gray-500">{cotizacion.cliente_empresa}</p>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                                        {cotizacion.maquinaria}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${estadoBadge.color}`}>
                                                        {estadoBadge.icon} {estadoBadge.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {cotizacion.precio_cotizado ? (
                                                        <span className="font-medium text-gray-900 dark:text-white">
                                                            ${cotizacion.precio_cotizado.toLocaleString('es-CL')}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-400 text-sm">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                    {formatDate(cotizacion.created_at)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => handleEdit(cotizacion)}
                                                            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg"
                                                        >
                                                            <Edit2 size={14} className="text-gray-500" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(cotizacion.id!, cotizacion.codigo_cotizacion)}
                                                            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                                                        >
                                                            <Trash2 size={14} className="text-red-500" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white dark:bg-slate-900 px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                {editingId ? 'Editar' : 'Nueva'} {nomenclature.reservations.singular}
                            </h2>
                            <button onClick={resetForm} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Maquinaria Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Maquinaria *
                                </label>
                                <select
                                    value={formData.maquinaria}
                                    onChange={(e) => setFormData(prev => ({ ...prev, maquinaria: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                >
                                    <option value="">Seleccionar maquinaria...</option>
                                    {maquinarias.map(m => (
                                        <option key={m.id} value={m.nombre}>{m.nombre}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Client Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <User size={14} className="inline mr-1" />
                                        Nombre del Cliente *
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.cliente_nombre}
                                        onChange={(e) => setFormData(prev => ({ ...prev, cliente_nombre: e.target.value }))}
                                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <Building2 size={14} className="inline mr-1" />
                                        Empresa
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.cliente_empresa}
                                        onChange={(e) => setFormData(prev => ({ ...prev, cliente_empresa: e.target.value }))}
                                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <Mail size={14} className="inline mr-1" />
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        value={formData.cliente_email}
                                        onChange={(e) => setFormData(prev => ({ ...prev, cliente_email: e.target.value }))}
                                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <Phone size={14} className="inline mr-1" />
                                        Teléfono
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.cliente_telefono}
                                        onChange={(e) => setFormData(prev => ({ ...prev, cliente_telefono: e.target.value }))}
                                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* Status & Prices */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Estado
                                    </label>
                                    <select
                                        value={formData.estado}
                                        onChange={(e) => setFormData(prev => ({ ...prev, estado: e.target.value as Cotizacion['estado'] }))}
                                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    >
                                        {ESTADOS_COTIZACION.map(estado => (
                                            <option key={estado.value} value={estado.value}>
                                                {estado.icon} {estado.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <DollarSign size={14} className="inline mr-1" />
                                        Presupuesto Cliente
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.presupuesto_cliente}
                                        onChange={(e) => setFormData(prev => ({ ...prev, presupuesto_cliente: Number(e.target.value) }))}
                                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        <DollarSign size={14} className="inline mr-1" />
                                        Precio Cotizado
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.precio_cotizado}
                                        onChange={(e) => setFormData(prev => ({ ...prev, precio_cotizado: Number(e.target.value) }))}
                                        className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* Follow-up Date */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    <Calendar size={14} className="inline mr-1" />
                                    Fecha de Seguimiento
                                </label>
                                <input
                                    type="date"
                                    value={formData.fecha_seguimiento}
                                    onChange={(e) => setFormData(prev => ({ ...prev, fecha_seguimiento: e.target.value }))}
                                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                />
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Notas
                                </label>
                                <textarea
                                    value={formData.notas}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notas: e.target.value }))}
                                    rows={3}
                                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                                    placeholder="Notas adicionales sobre el cliente o la negociación..."
                                />
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
                                {editingId ? 'Guardar Cambios' : 'Crear Cotización'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Sidebar */}
            {selectedCotizacion && (
                <div className="fixed inset-0 z-50 flex">
                    <div className="flex-1 bg-black/30" onClick={() => setSelectedCotizacion(null)} />
                    <div className="w-full max-w-md bg-white dark:bg-slate-900 shadow-xl overflow-y-auto">
                        <div className="sticky top-0 bg-white dark:bg-slate-900 px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                            <div>
                                <span className="font-mono text-sm text-blue-600">{selectedCotizacion.codigo_cotizacion}</span>
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                    {selectedCotizacion.cliente_nombre}
                                </h2>
                            </div>
                            <button onClick={() => setSelectedCotizacion(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <span className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium ${getEstadoBadge(selectedCotizacion.estado).color}`}>
                                    {getEstadoBadge(selectedCotizacion.estado).icon} {getEstadoBadge(selectedCotizacion.estado).label}
                                </span>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Maquinaria</p>
                                    <p className="font-medium text-gray-900 dark:text-white">{selectedCotizacion.maquinaria}</p>
                                </div>

                                {selectedCotizacion.cliente_empresa && (
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Empresa</p>
                                        <p className="text-gray-900 dark:text-white">{selectedCotizacion.cliente_empresa}</p>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Email</p>
                                        <p className="text-gray-900 dark:text-white text-sm">{selectedCotizacion.cliente_email}</p>
                                    </div>
                                    {selectedCotizacion.cliente_telefono && (
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Teléfono</p>
                                            <p className="text-gray-900 dark:text-white text-sm">{selectedCotizacion.cliente_telefono}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    {selectedCotizacion.presupuesto_cliente ? (
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Presupuesto</p>
                                            <p className="text-gray-900 dark:text-white font-medium">
                                                ${selectedCotizacion.presupuesto_cliente.toLocaleString('es-CL')}
                                            </p>
                                        </div>
                                    ) : null}
                                    {selectedCotizacion.precio_cotizado ? (
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Precio Cotizado</p>
                                            <p className="text-green-600 dark:text-green-400 font-bold text-lg">
                                                ${selectedCotizacion.precio_cotizado.toLocaleString('es-CL')}
                                            </p>
                                        </div>
                                    ) : null}
                                </div>

                                {selectedCotizacion.fecha_seguimiento && (
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Fecha Seguimiento</p>
                                        <p className="text-gray-900 dark:text-white">{formatDate(selectedCotizacion.fecha_seguimiento)}</p>
                                    </div>
                                )}

                                {selectedCotizacion.notas && (
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Notas</p>
                                        <p className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-wrap">{selectedCotizacion.notas}</p>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-gray-200 dark:border-slate-700 flex gap-2">
                                <button
                                    onClick={() => { handleEdit(selectedCotizacion); setSelectedCotizacion(null); }}
                                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium"
                                >
                                    <Edit2 size={16} />
                                    Editar
                                </button>
                                <button
                                    onClick={() => { handleDelete(selectedCotizacion.id!, selectedCotizacion.codigo_cotizacion); setSelectedCotizacion(null); }}
                                    className="px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 rounded-xl font-medium"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDeleteModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: '', code: '' })}
                onConfirm={confirmDelete}
                title="Eliminar Cotización"
                message={`¿Estás seguro de eliminar la cotización "${deleteModal.code}"? Esta acción no se puede deshacer.`}
            />
        </DashboardLayout>
    );
}
