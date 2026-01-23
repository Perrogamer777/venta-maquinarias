'use client';

import { AlertTriangle } from 'lucide-react';

interface ConfirmDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    isLoading?: boolean;
}

export function ConfirmDeleteModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    isLoading = false
}: ConfirmDeleteModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                {/* Header with Icon */}
                <div className="p-6 flex flex-col items-center text-center border-b border-gray-200 dark:border-gray-800">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                        <AlertTriangle size={32} className="text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        Esta acción no se puede deshacer
                    </p>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-6">
                        <p className="text-sm text-gray-700 dark:text-gray-300 text-center">
                            {message}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={onConfirm}
                            disabled={isLoading}
                            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {isLoading ? 'Eliminando...' : 'Eliminar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
