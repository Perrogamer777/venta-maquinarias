'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';
import { Loader2, Database, AlertTriangle, CheckCircle } from 'lucide-react';

interface DataMigrationModalProps {
    onClose: () => void;
    targetTenantId: string;
    targetTenantName: string;
}

const COLLECTIONS_TO_MIGRATE = [
    { id: 'reservas', label: 'Reservas' },
    { id: 'cabanas', label: 'Cabañas / Unidades' },
    { id: 'conversaciones', label: 'Conversaciones / Chats' },
    { id: 'promociones', label: 'Promociones' },
    { id: 'huespedes', label: 'Huéspedes' },
    { id: 'gastos', label: 'Gastos' },
    { id: 'config', label: 'Config (Global)' },
    { id: 'configuracion', label: 'Configuración (Sistema)' },
    { id: 'servicios_adicionales', label: 'Servicios Adicionales' },
    { id: 'feedback', label: 'Feedback' }
];

export default function DataMigrationModal({ onClose, targetTenantId, targetTenantName }: DataMigrationModalProps) {
    const [selectedCollections, setSelectedCollections] = useState<string[]>(COLLECTIONS_TO_MIGRATE.map(c => c.id));
    const [migrating, setMigrating] = useState(false);
    const [progress, setProgress] = useState<string[]>([]);
    const [completed, setCompleted] = useState(false);

    const handleBackup = async () => {
        setMigrating(true);
        setProgress(prev => [...prev, '📦 Iniciando respaldo...']);

        try {
            const backupData: Record<string, any> = {};

            for (const colId of selectedCollections) {
                // Check for alias (same as migrate)
                let sourceColId = colId;
                if (colId === 'conversaciones') {
                    const check = await getDocs(collection(db, 'conversaciones'));
                    if (check.empty) {
                        const checkChats = await getDocs(collection(db, 'chats'));
                        if (!checkChats.empty) sourceColId = 'chats';
                    }
                }

                const snapshot = await getDocs(collection(db, sourceColId));
                backupData[colId] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })); // Store under original name 'conversaciones'
                setProgress(prev => [...prev, `📥 ${sourceColId} (como ${colId}): ${snapshot.size} docs guardados.`]);
            }

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-${targetTenantId}-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setProgress(prev => [...prev, '✅ Respaldo descargado exitosamente.']);
        } catch (error: any) {
            console.error('Backup error:', error);
            setProgress(prev => [...prev, `❌ Error al respaldar: ${error.message}`]);
        } finally {
            setMigrating(false);
        }
    };

    const handleMigrate = async () => {
        if (!confirm(`¿Estás seguro de COPIAR los datos al tenant "${targetTenantName}"?`)) return;

        setMigrating(true);
        setProgress([]);

        try {
            for (const colId of selectedCollections) {
                setProgress(prev => [...prev, `Leyendo colección: ${colId}...`]);

                // 1. Read from Root
                let sourceColId = colId;
                // Alias for conversations
                if (colId === 'conversaciones') {
                    const check = await getDocs(collection(db, 'conversaciones'));
                    if (check.empty) {
                        const checkChats = await getDocs(collection(db, 'chats'));
                        if (!checkChats.empty) {
                            sourceColId = 'chats';
                            setProgress(prev => [...prev, `ℹ Detectada colección 'chats', migrando como 'conversaciones'...`]);
                        }
                    }
                }

                const rootColRef = collection(db, sourceColId);
                const snapshot = await getDocs(rootColRef);

                if (snapshot.empty) {
                    setProgress(prev => [...prev, `⚠ Colección ${sourceColId} vacía, saltando.`]);
                    continue;
                }

                setProgress(prev => [...prev, `Migrando ${snapshot.size} documentos de ${colId}...`]);

                // 2. Write to Tenant (Batched)
                // Firestore batches max 500 ops
                const chunks = [];
                let currentChunk: any[] = [];

                snapshot.docs.forEach(docSnap => {
                    currentChunk.push({ id: docSnap.id, data: docSnap.data() });
                    if (currentChunk.length >= 450) { // Safe margin
                        chunks.push(currentChunk);
                        currentChunk = [];
                    }
                });
                if (currentChunk.length > 0) chunks.push(currentChunk);

                let batchCount = 0;
                for (const chunk of chunks) {
                    const batch = writeBatch(db);
                    chunk.forEach((item) => {
                        // Target: clients/{tenantId}/{colId}/{docId}
                        const targetRef = doc(db, 'clients', targetTenantId, colId, item.id);
                        batch.set(targetRef, item.data, { merge: true });
                    });
                    await batch.commit();
                    batchCount++;
                }

                setProgress(prev => [...prev, `✅ ${colId}: ${snapshot.size} docs migrados exitosamente.`]);
            }

            setCompleted(true);
            setProgress(prev => [...prev, '✨ Migración completada.']);

        } catch (error: any) {
            console.error('Migration error:', error);
            setProgress(prev => [...prev, `❌ Error crítico: ${error.message}`]);
        } finally {
            setMigrating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <h3 className="font-bold text-lg flex items-center gap-2">
                        <Database className="text-[#F59E0B]" size={20} />
                        Migrar Datos a Tenant
                    </h3>
                    <button onClick={onClose} disabled={migrating} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>

                <div className="p-6 space-y-4">
                    {!completed ? (
                        <>
                            <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl text-sm text-amber-800 flex gap-3">
                                <AlertTriangle className="shrink-0" size={20} />
                                <div>
                                    <p className="font-bold mb-1">Atención</p>
                                    <p>Esta acción copiará los documentos desde la raíz de la base de datos hacia el tenant <b>{targetTenantName}</b>.</p>
                                    <p className="mt-2 text-xs opacity-80">Los datos originales NO serán borrados.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-3">Colecciones a Migrar:</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {COLLECTIONS_TO_MIGRATE.map(col => (
                                        <label key={col.id} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                                            <input
                                                type="checkbox"
                                                checked={selectedCollections.includes(col.id)}
                                                onChange={e => {
                                                    if (e.target.checked) setSelectedCollections([...selectedCollections, col.id]);
                                                    else setSelectedCollections(selectedCollections.filter(c => c !== col.id));
                                                }}
                                                className="text-[#F59E0B] focus:ring-[#F59E0B]"
                                            />
                                            <span className="text-sm font-medium">{col.label}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={handleBackup}
                                    disabled={migrating || selectedCollections.length === 0}
                                    className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    {migrating ? <Loader2 className="animate-spin" /> : 'Descargar Respaldo JSON'}
                                </button>
                                <button
                                    onClick={handleMigrate}
                                    disabled={migrating || selectedCollections.length === 0}
                                    className="flex-1 py-3 bg-[#1A4D3E] text-white rounded-xl font-bold hover:bg-[#143d31] disabled:opacity-50 flex justify-center items-center gap-2"
                                >
                                    {migrating ? <Loader2 className="animate-spin" /> : 'Iniciar Migración'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle size={32} />
                            </div>
                            <h4 className="text-xl font-bold text-gray-800 mb-2">¡Migración Exitosa!</h4>
                            <p className="text-gray-500 text-sm mb-6">Los datos han sido copiados al entorno de {targetTenantName}.</p>
                            <button onClick={onClose} className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-2 px-6 rounded-lg">
                                Cerrar
                            </button>
                        </div>
                    )}

                    {/* Logs console */}
                    <div className="bg-gray-900 rounded-xl p-4 h-48 overflow-y-auto font-mono text-xs text-green-400 space-y-1">
                        {progress.length === 0 && <span className="text-gray-600">Esperando inicio...</span>}
                        {progress.map((log, i) => (
                            <div key={i}>{log}</div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
