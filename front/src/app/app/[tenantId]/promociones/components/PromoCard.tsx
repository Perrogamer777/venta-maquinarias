import { Eye, Trash2, Send } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { Promocion } from '@/types';

interface PromoCardProps {
    promo: Promocion;
    onEdit: (promo: Promocion) => void;
    onDelete: (promo: Promocion) => void;
    onSend: (promo: Promocion) => void;
}

export function PromoCard({ promo, onEdit, onDelete, onSend }: PromoCardProps) {
    const totalEnviados = promo.historialEnvios?.reduce((sum, e) => sum + e.enviados, 0) || 0;

    return (
        <div className="glass rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 group hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 transition-all duration-300 flex flex-col h-full">
            {/* Image */}
            <div className="relative h-40 bg-gray-100 dark:bg-gray-800 overflow-hidden flex-shrink-0">
                {promo.imagenUrl ? (
                    <img
                        src={promo.imagenUrl}
                        alt={promo.titulo}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <span className="text-gray-400">Sin imagen</span>
                    </div>
                )}

                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                        onClick={() => onEdit(promo)}
                        className="p-2 bg-white/90 dark:bg-gray-900/90 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors backdrop-blur-sm"
                    >
                        <Eye size={16} className="text-gray-600 dark:text-gray-400" />
                    </button>
                    <button
                        onClick={() => onDelete(promo)}
                        className="p-2 bg-white/90 dark:bg-gray-900/90 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors backdrop-blur-sm"
                    >
                        <Trash2 size={16} className="text-red-500" />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="p-4 flex flex-col flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-2 min-h-[3rem]">{promo.titulo}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3 flex-1">
                    {promo.descripcion}
                </p>

                {/* Stats */}
                {totalEnviados > 0 && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
                        <span>{totalEnviados} enviados</span>
                    </div>
                )}

                {/* Actions */}
                <Button
                    variant="primary"
                    size="sm"
                    className="w-full mt-auto"
                    onClick={() => onSend(promo)}
                >
                    <Send size={16} />
                    Enviar Promoción
                </Button>
            </div>
        </div>
    );
}
