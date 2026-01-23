'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useConfig } from '@/contexts/ConfigContext';
import { ESTADOS_COTIZACION } from '@/lib/businessTypes';
import type { Cotizacion } from '@/types';
import {
    Kanban, MoreHorizontal, Calendar,
    DollarSign, User, Building2, Phone, Edit2, Trash2,
    X, Check, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';

export default function PipelinePage() {
    const { nomenclature } = useConfig();
    const [cotizaciones, setCotizaciones] = useState<Cotizacion[]>([]);
    const [loading, setLoading] = useState(true);
    const [columns, setColumns] = useState<Record<string, Cotizacion[]>>({});
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; code: string }>({
        isOpen: false,
        id: '',
        code: ''
    });

    useEffect(() => {
        const unsubscribe = onSnapshot(
            collection(db, 'cotizaciones'),
            (snapshot) => {
                const data = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Cotizacion[];

                setCotizaciones(data);

                // Group by status
                const grouped: Record<string, Cotizacion[]> = {};
                ESTADOS_COTIZACION.forEach(estado => {
                    grouped[estado.value] = data.filter(c => c.estado === estado.value)
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                });

                setColumns(grouped);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (
            destination.droppableId === source.droppableId &&
            destination.index === source.index
        ) {
            return;
        }

        const sourceStatus = source.droppableId;
        const destStatus = destination.droppableId;

        // Optimistic update
        const sourceCol = [...columns[sourceStatus]];
        const destCol = sourceStatus === destStatus ? sourceCol : [...columns[destStatus]];

        const [movedItem] = sourceCol.splice(source.index, 1);
        const updatedItem = { ...movedItem, estado: destStatus as Cotizacion['estado'] };

        if (sourceStatus === destStatus) {
            sourceCol.splice(destination.index, 0, updatedItem);
            setColumns({
                ...columns,
                [sourceStatus]: sourceCol
            });
        } else {
            destCol.splice(destination.index, 0, updatedItem);
            setColumns({
                ...columns,
                [sourceStatus]: sourceCol,
                [destStatus]: destCol
            });

            // Update Firestore
            try {
                await updateDoc(doc(db, 'cotizaciones', draggableId), {
                    estado: destStatus
                });
            } catch (error) {
                console.error('Error updating status:', error);
                // Revert on error would go here
            }
        }
    };

    const handleDelete = (id: string, code: string) => {
        setDeleteModal({ isOpen: true, id, code });
    };

    const confirmDelete = async () => {
        try {
            await deleteDoc(doc(db, 'cotizaciones', deleteModal.id));
            setDeleteModal({ isOpen: false, id: '', code: '' });
        } catch (error) {
            console.error('Error deleting cotizacion:', error);
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            return format(new Date(dateStr), "d MMM", { locale: es });
        } catch {
            return '-';
        }
    };

    const getTotalValue = (items: Cotizacion[]) => {
        return items.reduce((sum, item) => sum + (item.precio_cotizado || 0), 0);
    };

    return (
        <DashboardLayout>
            <div className="h-[calc(100vh-100px)] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Kanban size={28} className="text-blue-600" />
                            Pipeline de Ventas
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                            Visualiza y gestiona el progreso de tus oportunidades
                        </p>
                    </div>
                    <div className="bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
                        <span className="text-sm text-gray-500">Valor Total Pipeline: </span>
                        <span className="font-bold text-gray-900 dark:text-white ml-2">
                            ${cotizaciones.reduce((sum, c) => sum + (c.precio_cotizado || 0), 0).toLocaleString('es-CL')}
                        </span>
                    </div>
                </div>

                {/* Kanban Board */}
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="flex-1 overflow-x-auto pb-4">
                        <div className="flex gap-4 min-w-[1200px] h-full">
                            {ESTADOS_COTIZACION.map((estado) => (
                                <div key={estado.value} className="flex-1 min-w-[280px] flex flex-col">
                                    {/* Column Header */}
                                    <div className={`mb-3 p-3 rounded-xl border-t-4 bg-white dark:bg-slate-900 shadow-sm ${estado.color.replace('bg-', 'border-').split(' ')[0]
                                        }`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                                <estado.icon size={18} /> {estado.label}
                                            </h3>
                                            <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded-full text-gray-600">
                                                {columns[estado.value]?.length || 0}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 font-medium">
                                            ${getTotalValue(columns[estado.value] || []).toLocaleString('es-CL')}
                                        </div>
                                    </div>

                                    {/* Droppable Area */}
                                    <Droppable droppableId={estado.value}>
                                        {(provided: any, snapshot: any) => (
                                            <div
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                className={`flex-1 rounded-xl transition-colors p-2 ${snapshot.isDraggingOver
                                                    ? 'bg-blue-50/50 dark:bg-blue-900/10'
                                                    : 'bg-gray-50/50 dark:bg-slate-900/20'
                                                    }`}
                                            >
                                                {columns[estado.value]?.map((item, index) => (
                                                    <Draggable
                                                        key={item.id}
                                                        draggableId={item.id!}
                                                        index={index}
                                                    >
                                                        {(provided: any, snapshot: any) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                className={`mb-3 bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm group hover:shadow-md transition-all ${snapshot.isDragging
                                                                    ? 'shadow-lg rotate-2 border-blue-500 z-50'
                                                                    : 'border-gray-100 dark:border-slate-800'
                                                                    }`}
                                                                style={provided.draggableProps.style}
                                                            >
                                                                <div className="flex justify-between items-start mb-2">
                                                                    <span className="text-xs font-mono text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                                                                        {item.codigo_cotizacion}
                                                                    </span>
                                                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <button
                                                                            onClick={() => handleDelete(item.id!, item.codigo_cotizacion)}
                                                                            className="p-1 hover:bg-red-50 text-red-500 rounded"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                <h4 className="font-medium text-gray-900 dark:text-white mb-1 line-clamp-2">
                                                                    {item.maquinaria}
                                                                </h4>

                                                                <div className="space-y-1 mb-3">
                                                                    <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                                                                        <User size={14} />
                                                                        <span className="truncate">{item.cliente_nombre}</span>
                                                                    </div>
                                                                    {item.cliente_empresa && (
                                                                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                                            <Building2 size={12} />
                                                                            <span className="truncate">{item.cliente_empresa}</span>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="flex items-center justify-between pt-3 border-t border-gray-50 dark:border-slate-800">
                                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                                                        <Calendar size={12} />
                                                                        <span>{formatDate(item.created_at)}</span>
                                                                    </div>
                                                                    {item.precio_cotizado ? (
                                                                        <div className="font-semibold text-sm text-gray-900 dark:text-white">
                                                                            ${item.precio_cotizado.toLocaleString('es-CL')}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-xs text-gray-400">-</span>
                                                                    )}
                                                                </div>

                                                                {item.fecha_seguimiento && (
                                                                    <div className="mt-2 text-xs flex items-center gap-1 text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400 px-2 py-1 rounded">
                                                                        <AlertCircle size={10} />
                                                                        Seguimiento: {formatDate(item.fecha_seguimiento)}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                                {provided.placeholder}
                                                {columns[estado.value]?.length === 0 && (
                                                    <div className="h-24 flex items-center justify-center border-2 border-dashed border-gray-100 dark:border-slate-800 rounded-xl">
                                                        <span className="text-xs text-gray-400">Vacío</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Droppable>
                                </div>
                            ))}
                        </div>
                    </div>
                </DragDropContext>
            </div>

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
