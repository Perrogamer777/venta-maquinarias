import { TrendingUp, DollarSign, Clock, Search, Loader2 } from 'lucide-react';
import { type RFMSegment } from '../hooks/useRecipients';

interface Destinatario {
    telefono: string;
    nombre?: string;
    origen: 'chat' | 'reserva';
    selected: boolean;
    totalPaid: number;
    totalNights: number;
    lastVisit?: string;
    visitCount: number;
    rfmSegment: RFMSegment;
    rfmScore: { r: number; f: number; m: number };
}

interface RecipientListProps {
    destinatarios: Destinatario[];
    isLoading: boolean;
    onToggle: (telefono: string) => void;
}

function formatPhoneNumber(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('56')) {
        return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`;
    }
    return phone;
}

export function RecipientList({ destinatarios, isLoading, onToggle }: RecipientListProps) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-gray-300" />
            </div>
        );
    }

    if (destinatarios.length === 0) {
        return (
            <div className="text-center py-12 px-6">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Search size={24} className="text-gray-400" />
                </div>
                <p className="text-gray-500 font-medium">No hay clientes que coincidan</p>
                <p className="text-xs text-gray-400 mt-1">Prueba ajustando los filtros de búsqueda</p>
            </div>
        );
    }

    return (
        <>
            {destinatarios.map((dest) => (
                <label
                    key={dest.telefono}
                    className={`flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${dest.selected
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-sm'
                        : 'bg-white dark:bg-gray-800 border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
                        }`}
                >
                    <div className="pt-1">
                        <input
                            type="checkbox"
                            checked={dest.selected}
                            onChange={() => onToggle(dest.telefono)}
                            className="w-5 h-5 text-indigo-600 rounded-lg border-gray-300 focus:ring-indigo-500 transition-all"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="font-bold text-gray-900 dark:text-white text-sm truncate">
                                {dest.nombre || formatPhoneNumber(dest.telefono)}
                            </p>
                        </div>

                        {dest.nombre && (
                            <p className="text-xs text-gray-500 mb-2">{formatPhoneNumber(dest.telefono)}</p>
                        )}

                        {/* Metrics Row */}
                        <div className="flex flex-wrap gap-2 mt-2">
                            {/* RFM Score */}
                            <div className="flex items-center gap-0.5 text-[9px] font-mono bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-lg">
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold">R{dest.rfmScore.r}</span>
                                <span className="text-gray-400">·</span>
                                <span className="text-blue-600 dark:text-blue-400 font-bold">F{dest.rfmScore.f}</span>
                                <span className="text-gray-400">·</span>
                                <span className="text-amber-600 dark:text-amber-400 font-bold">M{dest.rfmScore.m}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-lg">
                                <TrendingUp size={10} />
                                {dest.visitCount} visitas
                            </div>
                            <div className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-2 py-1 rounded-lg">
                                <DollarSign size={10} />
                                ${dest.totalPaid.toLocaleString()}
                            </div>
                            {dest.lastVisit && (
                                <div className="flex items-center gap-1 text-[10px] font-medium text-gray-400 px-1 py-1">
                                    <Clock size={10} />
                                    {new Date(dest.lastVisit).toLocaleDateString()}
                                </div>
                            )}
                        </div>
                    </div>
                </label>
            ))}
        </>
    );
}
