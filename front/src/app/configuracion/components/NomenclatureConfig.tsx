'use client';

import { useState } from 'react';
import { useConfig } from '@/contexts/ConfigContext';
import { BUSINESS_TYPES, getPresetById, type Nomenclature } from '@/lib/businessTypes';
import { Button } from '@/components/ui/Button';
import { Building2, Save } from 'lucide-react';
import { toast } from '@/utils/toast';

export function NomenclatureConfig() {
    const { nomenclature, businessType, updateCompanySettings } = useConfig();
    const [selectedType, setSelectedType] = useState(businessType || 'cabins');
    const [customNomenclature, setCustomNomenclature] = useState<Nomenclature>(nomenclature);
    const [saving, setSaving] = useState(false);

    const handleTypeChange = (typeId: string) => {
        setSelectedType(typeId);
        const preset = getPresetById(typeId);
        if (preset && typeId !== 'custom') {
            setCustomNomenclature(preset.nomenclature);
        }
    };

    const saveNomenclature = async () => {
        setSaving(true);
        try {
            await updateCompanySettings({
                businessType: selectedType as 'cabins' | 'hotel' | 'apartments' | 'custom',
                nomenclature: customNomenclature
            });
            toast.success('Nomenclatura actualizada correctamente');
        } catch (error) {
            console.error('Error:', error);
            toast.error('Error al guardar configuración');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="glass rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                <Building2 className="text-emerald-500" />
                Nomenclatura del Sistema
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Personaliza los nombres que aparecen en el dashboard según tu tipo de negocio
            </p>

            {/* Business Type Selector */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Tipo de Negocio
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {BUSINESS_TYPES.map(type => {
                        const Icon = type.icon;
                        return (
                            <button
                                key={type.id}
                                onClick={() => handleTypeChange(type.id)}
                                className={`p-4 rounded-xl border-2 transition-all ${selectedType === type.id
                                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-emerald-300'
                                    }`}
                            >
                                <Icon size={24} className="mx-auto mb-2 text-gray-700 dark:text-gray-300" />
                                <div className="text-sm font-medium text-gray-900 dark:text-white">{type.name}</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Preview */}
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-6">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Vista Previa del Dashboard
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">Unidades (plural):</span>
                        <div className="font-medium text-gray-900 dark:text-white">{customNomenclature.units.plural}</div>
                    </div>
                    <div>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">Unidad (singular):</span>
                        <div className="font-medium text-gray-900 dark:text-white">{customNomenclature.units.singular}</div>
                    </div>
                    <div>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">Reservaciones:</span>
                        <div className="font-medium text-gray-900 dark:text-white">{customNomenclature.reservations.plural}</div>
                    </div>
                    <div>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">Clientes:</span>
                        <div className="font-medium text-gray-900 dark:text-white">{customNomenclature.clients.plural}</div>
                    </div>
                    <div>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">Calendario:</span>
                        <div className="font-medium text-gray-900 dark:text-white">{customNomenclature.calendar}</div>
                    </div>
                    <div>
                        <span className="text-gray-500 dark:text-gray-400 text-xs">Promociones:</span>
                        <div className="font-medium text-gray-900 dark:text-white">{customNomenclature.promotions}</div>
                    </div>
                </div>
            </div>

            {/* Custom Fields */}
            {selectedType === 'custom' && (
                <div className="space-y-4 mb-6 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Personalizar Etiquetas
                    </h4>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Unidades (Plural)
                            </label>
                            <input
                                type="text"
                                value={customNomenclature.units.plural}
                                onChange={(e) => setCustomNomenclature({
                                    ...customNomenclature,
                                    units: { ...customNomenclature.units, plural: e.target.value }
                                })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg dark:text-white"
                                placeholder="ej: Habitaciones"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Unidad (Singular)
                            </label>
                            <input
                                type="text"
                                value={customNomenclature.units.singular}
                                onChange={(e) => setCustomNomenclature({
                                    ...customNomenclature,
                                    units: { ...customNomenclature.units, singular: e.target.value }
                                })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg dark:text-white"
                                placeholder="ej: Habitación"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Reservaciones (Plural)
                            </label>
                            <input
                                type="text"
                                value={customNomenclature.reservations.plural}
                                onChange={(e) => setCustomNomenclature({
                                    ...customNomenclature,
                                    reservations: { ...customNomenclature.reservations, plural: e.target.value }
                                })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg dark:text-white"
                                placeholder="ej: Reservaciones"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Reservación (Singular)
                            </label>
                            <input
                                type="text"
                                value={customNomenclature.reservations.singular}
                                onChange={(e) => setCustomNomenclature({
                                    ...customNomenclature,
                                    reservations: { ...customNomenclature.reservations, singular: e.target.value }
                                })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg dark:text-white"
                                placeholder="ej: Reservación"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Calendario
                            </label>
                            <input
                                type="text"
                                value={customNomenclature.calendar}
                                onChange={(e) => setCustomNomenclature({
                                    ...customNomenclature,
                                    calendar: e.target.value
                                })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg dark:text-white"
                                placeholder="ej: Disponibilidad"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Promociones
                            </label>
                            <input
                                type="text"
                                value={customNomenclature.promotions}
                                onChange={(e) => setCustomNomenclature({
                                    ...customNomenclature,
                                    promotions: e.target.value
                                })}
                                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-lg dark:text-white"
                                placeholder="ej: Ofertas"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Save Button */}
            <Button
                variant="primary"
                onClick={saveNomenclature}
                isLoading={saving}
                className="w-full md:w-auto"
            >
                <Save size={18} />
                Guardar Configuración
            </Button>
        </div>
    );
}
