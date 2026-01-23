'use client';

import { useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function VerifyMigrationPage() {
    const [results, setResults] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const verify = async () => {
        setLoading(true);
        setResults([]);
        const tenantId = 'jEleBBATgGm8u9SWdBpo';
        const logs: string[] = [];

        const colecciones = [
            'reservas',
            'cabanas',
            'conversaciones',
            'promociones',
            'config',
            'configuracion',
            'servicios_adicionales',
            'feedback'
        ];

        for (const col of colecciones) {
            try {
                const ref = collection(db, 'clients', tenantId, col);
                const snapshot = await getDocs(ref);

                logs.push(`✅ ${col}: ${snapshot.size} documentos`);

                if (snapshot.size > 0) {
                    const ids = snapshot.docs.slice(0, 3).map(d => d.id);
                    logs.push(`   IDs: ${ids.join(', ')}`);
                }
            } catch (error: any) {
                logs.push(`❌ ${col}: ${error.message}`);
            }
        }

        setResults(logs);
        setLoading(false);
    };

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-4">Verificar Migración</h1>

            <button
                onClick={verify}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
            >
                {loading ? 'Verificando...' : 'Verificar Datos Migrados'}
            </button>

            <div className="mt-6 bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
                {results.length === 0 ? (
                    <p>Presiona el botón para verificar...</p>
                ) : (
                    results.map((line, i) => (
                        <div key={i}>{line}</div>
                    ))
                )}
            </div>
        </div>
    );
}
