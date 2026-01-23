'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FilterPanel } from './FilterPanel';
import { RecipientList } from './RecipientList';
import { useRecipients } from '../hooks/useRecipients';
import type { Promocion } from '@/types';
import { toast } from '@/utils/toast';

interface SendModalProps {
    promo: Promocion;
    onClose: () => void;
}

export function SendModal({ promo, onClose }: SendModalProps) {
    const [showFilters, setShowFilters] = useState(true); // Default to open to show RFM
    const [sending, setSending] = useState(false);
    const [selectedRecipients, setSelectedRecipients] = useState<Set<string>>(new Set());

    const {
        filteredDestinatarios,
        isLoading,
        segmentCounts,
        filters: {
            minSpent,
            setMinSpent,
            minVisits,
            setMinVisits,
            recencyMonths,
            setRecencyMonths,
            searchQuery,
            setSearchQuery,
            selectedSegments,
            setSelectedSegments,
        },
    } = useRecipients();

    // Map to track selection
    const destinatariosWithSelection = filteredDestinatarios.map(dest => ({
        ...dest,
        selected: selectedRecipients.has(dest.telefono),
    }));

    const handleToggle = (telefono: string) => {
        const newSelection = new Set(selectedRecipients);
        if (newSelection.has(telefono)) {
            newSelection.delete(telefono);
        } else {
            newSelection.add(telefono);
        }
        setSelectedRecipients(newSelection);
    };

    const handleSelectAll = () => {
        const newSelection = new Set(filteredDestinatarios.map(d => d.telefono));
        setSelectedRecipients(newSelection);
    };

    const handleDeselectAll = () => {
        setSelectedRecipients(new Set());
    };

    const handleSend = async () => {
        if (selectedRecipients.size === 0) {
            toast.warning('Selecciona al menos un destinatario');
            return;
        }

        setSending(true);

        try {
            const response = await fetch('/api/send-promotion', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    phones: Array.from(selectedRecipients),
                    imageUrl: promo.imagenUrl,
                    title: promo.titulo,
                    description: promo.descripcion,
                    promotionId: promo.id
                }),
            });

            const result = await response.json();

            // Check for FastAPI validation errors
            if (result.detail && Array.isArray(result.detail)) {
                const errorMessages = result.detail.map((err: { loc?: string[]; msg: string }) =>
                    `${err.loc?.join('.')} - ${err.msg}`
                ).join(', ');
                toast.error(`Error de validación: ${errorMessages}`);
                return;
            }

            if (result.success) {
                toast.success(`Promoción enviada a ${result.summary?.sent || selectedRecipients.size} destinatarios`);
                onClose();
            } else {
                toast.error(result.message || 'Error al enviar la promoción');
            }
        } catch (error) {
            toast.error('Error al enviar la promoción');
            console.error('Error sending promotion:', error);
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">Enviar Promoción</h2>
                        <p className="text-xs sm:text-sm text-gray-500 mt-0.5 truncate">{promo.titulo}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors flex-shrink-0 ml-2"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Filter Panel with RFM */}
                <FilterPanel
                    minSpent={minSpent}
                    setMinSpent={setMinSpent}
                    minVisits={minVisits}
                    setMinVisits={setMinVisits}
                    recencyMonths={recencyMonths}
                    setRecencyMonths={setRecencyMonths}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    showFilters={showFilters}
                    setShowFilters={setShowFilters}
                    selectedSegments={selectedSegments}
                    setSelectedSegments={setSelectedSegments}
                    segmentCounts={segmentCounts}
                />

                {/* Selection Controls */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-semibold text-gray-900 dark:text-white">{selectedRecipients.size}</span> de {filteredDestinatarios.length} seleccionados
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleSelectAll}
                            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                            SELECCIONAR TODOS
                        </button>
                        <button
                            onClick={handleDeselectAll}
                            className="text-xs font-medium text-gray-500 hover:underline"
                        >
                            DESELECCIONAR
                        </button>
                    </div>
                </div>

                {/* Recipients List */}
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    <RecipientList
                        destinatarios={destinatariosWithSelection}
                        isLoading={isLoading}
                        onToggle={handleToggle}
                    />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
                    <Button variant="ghost" size="md" onClick={onClose} disabled={sending}>
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        size="md"
                        onClick={handleSend}
                        isLoading={sending}
                        disabled={selectedRecipients.size === 0}
                    >
                        Enviar a {selectedRecipients.size} destinatarios
                    </Button>
                </div>
            </div>
        </div>
    );
}
