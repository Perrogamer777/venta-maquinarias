'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useConfig } from '@/contexts/ConfigContext';
import type { Maquinaria } from '@/types';
import { Truck, Search, Download, ExternalLink, Calendar, Info } from 'lucide-react';
import { ESTADOS_STOCK } from '@/lib/businessTypes';

export default function CatalogoPage() {
    const { nomenclature } = useConfig();
    const [maquinarias, setMaquinarias] = useState<Maquinaria[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [categories, setCategories] = useState<string[]>([]);

    useEffect(() => {
        const fetchCatalog = async () => {
            try {
                // Fetch only active machinery
                const q = query(collection(db, 'maquinarias'), where('activa', '==', true));
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Maquinaria[];

                setMaquinarias(data);

                // Extract unique categories
                const cats = Array.from(new Set(data.map(m => m.categoria))).filter(Boolean);
                setCategories(cats);
            } catch (error) {
                console.error('Error fetching catalog:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCatalog();
    }, []);

    const filteredItems = maquinarias.filter(item => {
        const matchesSearch =
            item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.usoEquipo?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = !selectedCategory || item.categoria === selectedCategory;

        return matchesSearch && matchesCategory;
    });

    const getStockConfig = (estado: string) => {
        return ESTADOS_STOCK.find(e => e.value === estado) || { label: estado, color: 'bg-gray-100 text-gray-800' };
    };

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Truck size={28} className="text-blue-600" />
                            Catálogo de Maquinaria
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            Explora nuestra oferta de equipos y solicita una cotización
                        </p>
                    </div>

                    {/* Search & Filter */}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <div className="relative">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar equipo..."
                                className="pl-10 pr-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 w-full sm:w-64"
                            />
                        </div>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="px-4 py-2 border border-gray-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900"
                        >
                            <option value="">Todas las categorías</option>
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-80 bg-gray-100 dark:bg-slate-800 animate-pulse rounded-2xl" />
                        ))}
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800">
                        <Truck size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">No se encontraron equipos</h3>
                        <p className="text-gray-500">Intenta ajustar los filtros de búsqueda</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredItems.map(item => {
                            const stockState = getStockConfig(item.estadoStock);
                            return (
                                <div key={item.id} className="group bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden hover:shadow-xl transition-all duration-300">
                                    {/* Image */}
                                    <div className="aspect-video relative overflow-hidden bg-gray-100 dark:bg-slate-800">
                                        {item.imagenes?.[0] ? (
                                            <img
                                                src={item.imagenes[0]}
                                                alt={item.nombre}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full">
                                                <Truck size={48} className="text-gray-300 dark:text-gray-700" />
                                            </div>
                                        )}
                                        <div className="absolute top-3 left-3 flex gap-2">
                                            {item.destacado && (
                                                <span className="px-2 py-1 text-xs font-bold bg-yellow-400 text-yellow-900 rounded-lg shadow-sm">
                                                    DESTACADO
                                                </span>
                                            )}
                                        </div>
                                        <div className="absolute top-3 right-3">
                                            <span className={`px-2 py-1 text-xs font-bold rounded-lg shadow-sm ${stockState.color}`}>
                                                {stockState.label}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="p-5">
                                        <div className="mb-3">
                                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                                                {item.categoria}
                                            </span>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-1 line-clamp-1" title={item.nombre}>
                                                {item.nombre}
                                            </h3>
                                        </div>

                                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-4 h-10">
                                            {item.descripcion}
                                        </p>

                                        {/* Specs Preview */}
                                        <div className="space-y-2 mb-4">
                                            {item.especificacionesTecnicas && (
                                                <div className="flex items-start gap-2 text-xs text-gray-500">
                                                    <Info size={14} className="mt-0.5 flex-shrink-0" />
                                                    <span className="line-clamp-1">{item.especificacionesTecnicas}</span>
                                                </div>
                                            )}
                                            {item.usoEquipo && (
                                                <div className="flex items-start gap-2 text-xs text-gray-500">
                                                    <Truck size={14} className="mt-0.5 flex-shrink-0" />
                                                    <span className="line-clamp-1">{item.usoEquipo}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-slate-800">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-gray-400">Precio Ref.</span>
                                                {item.precioReferencia ? (
                                                    <span className="font-bold text-gray-900 dark:text-white">
                                                        ${item.precioReferencia.toLocaleString('es-CL')}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm font-medium text-gray-500">Consultar</span>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                {item.pdfUrl && (
                                                    <a
                                                        href={item.pdfUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 text-blue-600 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 rounded-xl transition-colors"
                                                        title="Ver Ficha Técnica"
                                                    >
                                                        <Download size={18} />
                                                    </a>
                                                )}
                                                <button className="px-4 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium rounded-xl hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors">
                                                    Ver Detalle
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
        </DashboardLayout>
    );
}
