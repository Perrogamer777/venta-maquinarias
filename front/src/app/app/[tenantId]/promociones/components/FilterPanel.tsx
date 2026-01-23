import { Search, Filter, ChevronDown, ChevronUp, DollarSign, Calendar, Users, Star } from 'lucide-react';
import { RFM_SEGMENTS, type RFMSegment } from '../hooks/useRecipients';

interface FilterPanelProps {
    minSpent: number;
    setMinSpent: (value: number) => void;
    minVisits: number;
    setMinVisits: (value: number) => void;
    recencyMonths: number;
    setRecencyMonths: (value: number) => void;
    searchQuery: string;
    setSearchQuery: (value: string) => void;
    showFilters: boolean;
    setShowFilters: (value: boolean) => void;
    selectedSegments: Set<RFMSegment>;
    setSelectedSegments: (value: Set<RFMSegment>) => void;
    segmentCounts: Record<RFMSegment, number>;
}

export function FilterPanel({
    minSpent,
    setMinSpent,
    minVisits,
    setMinVisits,
    recencyMonths,
    setRecencyMonths,
    searchQuery,
    setSearchQuery,
    showFilters,
    setShowFilters,
    selectedSegments,
    setSelectedSegments,
    segmentCounts,
}: FilterPanelProps) {
    const toggleSegment = (segment: RFMSegment) => {
        const newSelection = new Set(selectedSegments);
        if (newSelection.has(segment)) {
            newSelection.delete(segment);
        } else {
            newSelection.add(segment);
        }
        setSelectedSegments(newSelection);
    };

    const activeFiltersCount = (minSpent > 0 ? 1 : 0) + (minVisits > 0 ? 1 : 0) + (recencyMonths < 120 ? 1 : 0) + selectedSegments.size;

    return (
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 space-y-4 flex-shrink-0 bg-gray-50/50 dark:bg-gray-800/30">
            <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1 max-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar cliente..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                </div>
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${showFilters
                        ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                >
                    <Filter size={16} />
                    Filtros RFM
                    {activeFiltersCount > 0 && (
                        <span className="ml-1 px-1.5 py-0.5 text-xs bg-indigo-600 text-white rounded-full font-bold">
                            {activeFiltersCount}
                        </span>
                    )}
                    {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
            </div>

            {showFilters && (
                <div className="space-y-4 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 animate-fade-in">
                    {/* RFM Segments */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Star size={12} /> Segmentos RFM
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {(Object.keys(RFM_SEGMENTS) as RFMSegment[]).map((segment) => (
                                <button
                                    key={segment}
                                    onClick={() => toggleSegment(segment)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedSegments.has(segment)
                                            ? RFM_SEGMENTS[segment].color + ' ring-2 ring-offset-1 ring-indigo-500 dark:ring-offset-gray-900'
                                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                                        }`}
                                    title={RFM_SEGMENTS[segment].description}
                                >
                                    {RFM_SEGMENTS[segment].label}
                                    <span className="ml-1 opacity-60">({segmentCounts[segment]})</span>
                                </button>
                            ))}
                        </div>
                        {selectedSegments.size > 0 && (
                            <button
                                onClick={() => setSelectedSegments(new Set())}
                                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                            >
                                Limpiar selección
                            </button>
                        )}
                    </div>

                    {/* RFM Filters Grid */}
                    <div className="grid grid-cols-3 gap-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                        {/* Recency (R) */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Calendar size={12} /> R - Recencia
                            </label>
                            <select
                                value={recencyMonths}
                                onChange={(e) => setRecencyMonths(parseInt(e.target.value))}
                                className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none"
                            >
                                <option value={1}>Último mes</option>
                                <option value={3}>3 meses</option>
                                <option value={6}>6 meses</option>
                                <option value={12}>1 año</option>
                                <option value={24}>2 años</option>
                                <option value={120}>Todos</option>
                            </select>
                        </div>

                        {/* Frequency (F) */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Users size={12} /> F - Frecuencia
                            </label>
                            <select
                                value={minVisits}
                                onChange={(e) => setMinVisits(parseInt(e.target.value))}
                                className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none"
                            >
                                <option value={0}>Cualquiera</option>
                                <option value={1}>≥1 visita</option>
                                <option value={2}>≥2 visitas</option>
                                <option value={3}>≥3 visitas</option>
                                <option value={5}>≥5 visitas</option>
                            </select>
                        </div>

                        {/* Monetary (M) */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                                <DollarSign size={12} /> M - Gasto Mín.
                            </label>
                            <select
                                value={minSpent}
                                onChange={(e) => setMinSpent(parseInt(e.target.value))}
                                className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs outline-none"
                            >
                                <option value={0}>Cualquiera</option>
                                <option value={50000}>≥$50.000</option>
                                <option value={100000}>≥$100.000</option>
                                <option value={200000}>≥$200.000</option>
                                <option value={500000}>≥$500.000</option>
                                <option value={1000000}>≥$1.000.000</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
