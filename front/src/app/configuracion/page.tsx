'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    Save, MessageSquare, Sliders, CheckCircle, Briefcase, Heart, Smile, Zap,
    BookOpen, Users, Settings, Code, AlertTriangle, Copy, RotateCcw,
    Sparkles, Languages
} from 'lucide-react';

interface BotSettings {
    botName: string;
    tone: string;
    responseStyle: string;
    customInstructions: string;
    // New basic options
    greeting: string;
    farewell: string;
    unavailableMessage: string;
    maxResponseLength: number;
    useEmojis: boolean;
    mentionPrices: boolean;
    // Negotiation & Follow-up
    maxDiscount: number;
    enableReminders: boolean;
    reminderTimeMinutes: number;
    reminderMessage: string;
    // Advanced mode
    useAdvancedMode: boolean;
    systemPrompt: string;
}

const defaultSettings: BotSettings = {
    botName: 'Asistente Virtual',
    tone: 'profesional',
    responseStyle: 'conciso',
    customInstructions: '',
    greeting: '¡Hola! Soy {botName}, tu asistente de ventas de maquinaria. ¿En qué puedo ayudarte?',
    farewell: '¡Gracias por contactarnos! Si tienes más preguntas, no dudes en escribir.',
    unavailableMessage: 'En este momento ese equipo no está disponible. ¿Te gustaría consultar otras opciones?',
    maxResponseLength: 500,
    useEmojis: true,
    mentionPrices: true,
    maxDiscount: 10,
    enableReminders: false,
    reminderTimeMinutes: 30,
    reminderMessage: '¿Sigues ahí? Si tienes alguna duda sobre la maquinaria, estoy aquí para ayudarte. 🚜',
    useAdvancedMode: false,
    systemPrompt: ''
};

const DEFAULT_SYSTEM_PROMPT = `Eres {botName}, un asistente virtual especializado en venta de maquinaria agrícola e industrial.

## Tu Rol
- Ayudas a los clientes a consultar disponibilidad de equipos y solicitar cotizaciones
- Proporcionas información sobre la maquinaria, especificaciones técnicas y precios referenciales
- Eres amable, eficiente y profesional

## Reglas de Comportamiento
1. Siempre saluda cordialmente al inicio de la conversación
2. Responde de forma {tone} y {responseStyle}
3. Cuando un cliente quiere cotizar, solicita: tipo de equipo, aplicación específica y datos de contacto
4. Verifica disponibilidad en stock antes de confirmar tiempos de entrega
5. No inventes información sobre máquinas o especificaciones que no existan
6. Si no sabes algo, indica que consultarás y responderás pronto

## Maquinaria Disponible
{maquinarias}

## Servicios Adicionales
{servicios}

## Instrucciones Adicionales
{customInstructions}`;

export default function ConfiguracionPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');
    const [settings, setSettings] = useState<BotSettings>(defaultSettings);

    useEffect(() => {
        async function fetchSettings() {
            try {
                const docRef = doc(db, 'config', 'bot_settings');
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setSettings({ ...defaultSettings, ...data });
                    if (data.useAdvancedMode) {
                        setActiveTab('advanced');
                    }
                }
            } catch (error) {
                console.error('Error fetching settings:', error);
            } finally {
                setLoading(false);
            }
        }

        fetchSettings();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            const docRef = doc(db, 'config', 'bot_settings');
            await setDoc(docRef, settings, { merge: true });

            setSuccessMessage('Configuración guardada correctamente');
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error('Error saving settings:', error);
            alert('Error al guardar la configuración');
        } finally {
            setSaving(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setSuccessMessage('Copiado al portapapeles');
        setTimeout(() => setSuccessMessage(''), 2000);
    };

    const resetToDefault = () => {
        if (confirm('¿Estás seguro de restablecer a la configuración por defecto?')) {
            setSettings(defaultSettings);
        }
    };

    const generateSystemPrompt = () => {
        const prompt = DEFAULT_SYSTEM_PROMPT
            .replace('{botName}', settings.botName)
            .replace('{tone}', settings.tone)
            .replace('{responseStyle}', settings.responseStyle)
            .replace('{customInstructions}', settings.customInstructions || 'Ninguna instrucción adicional.');
        return prompt;
    };

    return (
        <DashboardLayout>
            <div className="animate-fade-in max-w-4xl mx-auto">
                <div className="mb-5 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configuración del Agente</h1>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mt-0.5">Personaliza la identidad y comportamiento de tu chatbot</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={resetToDefault}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                        >
                            <RotateCcw size={16} />
                            Restablecer
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || loading}
                            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium disabled:opacity-70 shadow-md shadow-emerald-500/20"
                        >
                            {saving ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save size={16} />
                            )}
                            <span>{saving ? 'Guardando...' : 'Guardar'}</span>
                        </button>
                    </div>
                </div>

                {successMessage && (
                    <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl flex items-center gap-3 animate-fade-in border border-green-200 dark:border-green-800">
                        <CheckCircle size={20} />
                        {successMessage}
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-2 mb-6 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
                    <button
                        onClick={() => {
                            setActiveTab('basic');
                            setSettings({ ...settings, useAdvancedMode: false });
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'basic' ? 'bg-white dark:bg-gray-900 shadow text-emerald-600 dark:text-emerald-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        <Settings size={18} />
                        Configuración Básica
                    </button>
                    <button
                        onClick={() => {
                            setActiveTab('advanced');
                            setSettings({ ...settings, useAdvancedMode: true });
                        }}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${activeTab === 'advanced' ? 'bg-white dark:bg-gray-900 shadow text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                    >
                        <Code size={18} />
                        Modo Avanzado (Prompt)
                    </button>
                </div>

                {loading ? (
                    <div className="space-y-6">
                        <div className="h-64 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
                        <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-2xl animate-pulse" />
                    </div>
                ) : activeTab === 'basic' ? (
                    /* BASIC TAB */
                    <div className="grid grid-cols-1 gap-6">

                        {/* Identidad del Agente */}
                        <div className="glass rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <MessageSquare className="text-emerald-500" />
                                Identidad del Agente
                            </h2>

                            <div className="max-w-md">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Nombre del Asistente
                                </label>
                                <input
                                    type="text"
                                    value={settings.botName}
                                    onChange={(e) => setSettings({ ...settings, botName: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all dark:text-white"
                                    placeholder="Ej: Sofía, Asistente Virtual"
                                />
                                <p className="text-xs text-gray-500 mt-2">Este nombre aparecerá cuando el agente se presente</p>
                            </div>
                        </div>

                        {/* Mensajes Predefinidos */}
                        <div className="glass rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <Languages className="text-blue-500" />
                                Mensajes Predefinidos
                            </h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Mensaje de Bienvenida
                                    </label>
                                    <textarea
                                        value={settings.greeting}
                                        onChange={(e) => setSettings({ ...settings, greeting: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white resize-none h-20"
                                        placeholder="Usa {botName} para insertar el nombre del bot"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Usa {'{botName}'} para insertar el nombre del asistente</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Mensaje de Despedida
                                    </label>
                                    <textarea
                                        value={settings.farewell}
                                        onChange={(e) => setSettings({ ...settings, farewell: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white resize-none h-20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Mensaje de No Disponibilidad
                                    </label>
                                    <textarea
                                        value={settings.unavailableMessage}
                                        onChange={(e) => setSettings({ ...settings, unavailableMessage: e.target.value })}
                                        className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none dark:text-white resize-none h-20"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Personalidad y Tono */}
                        <div className="glass rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <Sliders className="text-pink-500" />
                                Personalidad y Comportamiento
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Tono de la Conversación
                                    </label>
                                    <div className="space-y-2">
                                        {[
                                            { id: 'profesional', label: 'Profesional', icon: <Briefcase size={18} className="text-blue-500" />, desc: 'Serio y formal' },
                                            { id: 'amable', label: 'Amable', icon: <Heart size={18} className="text-pink-500" />, desc: 'Cálido, usa emojis' },
                                            { id: 'entusiasta', label: 'Entusiasta', icon: <Smile size={18} className="text-amber-500" />, desc: 'Enérgico y alegre' }
                                        ].map((option) => (
                                            <div
                                                key={option.id}
                                                onClick={() => setSettings({ ...settings, tone: option.id })}
                                                className={`p-3 rounded-xl border cursor-pointer transition-all ${settings.tone === option.id
                                                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 ring-1 ring-emerald-500'
                                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-emerald-200'
                                                    } `}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {option.icon}
                                                    <span className="font-medium text-gray-900 dark:text-white text-sm">{option.label}</span>
                                                    <span className="text-xs text-gray-500">- {option.desc}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Longitud de Respuestas
                                    </label>
                                    <div className="space-y-2">
                                        {[
                                            { id: 'conciso', label: 'Breve', icon: <Zap size={18} className="text-yellow-500" />, desc: 'Respuestas cortas' },
                                            { id: 'detallado', label: 'Detallado', icon: <BookOpen size={18} className="text-blue-500" />, desc: 'Explica con detalle' },
                                            { id: 'humanizado', label: 'Natural', icon: <Users size={18} className="text-green-500" />, desc: 'Como persona real' }
                                        ].map((option) => (
                                            <div
                                                key={option.id}
                                                onClick={() => setSettings({ ...settings, responseStyle: option.id })}
                                                className={`p-3 rounded-xl border cursor-pointer transition-all ${settings.responseStyle === option.id
                                                    ? 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 ring-1 ring-purple-500'
                                                    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-purple-200'
                                                    } `}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {option.icon}
                                                    <span className="font-medium text-gray-900 dark:text-white text-sm">{option.label}</span>
                                                    <span className="text-xs text-gray-500">- {option.desc}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Opciones de Comportamiento */}
                        <div className="glass rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                                <Sparkles className="text-amber-500" />
                                Opciones de Comportamiento
                            </h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={settings.useEmojis}
                                        onChange={(e) => setSettings({ ...settings, useEmojis: e.target.checked })}
                                        className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                                    />
                                    <div>
                                        <span className="font-medium text-gray-900 dark:text-white text-sm">Usar Emojis</span>
                                        <p className="text-xs text-gray-500">Incluir emojis en respuestas</p>
                                    </div>
                                </label>

                                <label className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={settings.mentionPrices}
                                        onChange={(e) => setSettings({ ...settings, mentionPrices: e.target.checked })}
                                        className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500"
                                    />
                                    <div>
                                        <span className="font-medium text-gray-900 dark:text-white text-sm">Mencionar Precios</span>
                                        <p className="text-xs text-gray-500">Incluir precios automáticamente</p>
                                    </div>
                                </label>
                            </div>

                            {/* Opciones de Negociación y Seguimiento */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        💰 Tope de Descuento (%)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={settings.maxDiscount === 0 ? '' : settings.maxDiscount}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setSettings({ ...settings, maxDiscount: val === '' ? 0 : parseInt(val) })
                                            }}
                                            className="w-24 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white"
                                            placeholder="0"
                                        />
                                        <span className="text-sm text-gray-500">%</span>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">Máximo descuento que el agente puede ofrecer si el cliente insiste.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        ⏰ Recordatorio Automático
                                    </label>
                                    <div className="flex items-center gap-3 mb-3">
                                        <input
                                            type="checkbox"
                                            checked={settings.enableReminders || false}
                                            onChange={(e) => setSettings({ ...settings, enableReminders: e.target.checked })}
                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Activar seguimiento</span>
                                    </div>
                                    {settings.enableReminders && (
                                        <div className="space-y-3 animate-fade-in">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-gray-500">Enviar a los</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={settings.reminderTimeMinutes || ''}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        // If empty, set to 0 temporarily (handled by value prop logic) or keep as 0. 
                                                        // But to be valid, it should probably be > 0. 
                                                        // However, for typing, we must allow 0 or empty.
                                                        setSettings({ ...settings, reminderTimeMinutes: val === '' ? 0 : parseInt(val) })
                                                    }}
                                                    className="w-20 px-2 py-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white text-sm"
                                                    placeholder="30"
                                                />
                                                <span className="text-sm text-gray-500">minutos sin respuesta.</span>
                                            </div>
                                            <textarea
                                                value={settings.reminderMessage || ''}
                                                onChange={(e) => setSettings({ ...settings, reminderMessage: e.target.value })}
                                                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none dark:text-white text-sm h-20 resize-none"
                                                placeholder="Mensaje de recordatorio..."
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Instrucciones Adicionales */}
                        <div className="glass rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                                <MessageSquare className="text-emerald-500" />
                                Instrucciones Adicionales
                            </h2>
                            <p className="text-sm text-gray-500 mb-4">
                                Reglas específicas que el agente debe seguir obligatoriamente.
                            </p>
                            <textarea
                                value={settings.customInstructions}
                                onChange={(e) => setSettings({ ...settings, customInstructions: e.target.value })}
                                className="w-full h-32 px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all dark:text-white resize-y text-sm"
                                placeholder="Ej: Nunca mencionar competidores. Siempre ofrecer el servicio de tinaja cuando haya disponibilidad."
                            />
                        </div>
                    </div>
                ) : (
                    /* ADVANCED TAB */
                    <div className="space-y-6">
                        {/* Warning */}
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3">
                            <AlertTriangle className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" size={20} />
                            <div>
                                <h4 className="font-semibold text-amber-800 dark:text-amber-300">Modo Avanzado</h4>
                                <p className="text-sm text-amber-700 dark:text-amber-400">
                                    En este modo, tienes control total sobre el comportamiento del agente mediante un prompt personalizado.
                                    Los cambios realizados aquí sobrescriben la configuración básica.
                                </p>
                            </div>
                        </div>

                        {/* Prompt Editor */}
                        <div className="glass rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                                    <Code className="text-purple-500" />
                                    System Prompt Personalizado
                                </h2>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSettings({ ...settings, systemPrompt: generateSystemPrompt() })}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                                    >
                                        <Sparkles size={14} />
                                        Generar desde Básico
                                    </button>
                                    <button
                                        onClick={() => copyToClipboard(settings.systemPrompt || generateSystemPrompt())}
                                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <Copy size={14} />
                                        Copiar
                                    </button>
                                </div>
                            </div>

                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                Escribe el prompt completo que define cómo debe comportarse el agente.
                                Puedes usar las variables: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{maquinarias}'}</code>,
                                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded ml-1">{'{servicios}'}</code>,
                                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded ml-1">{'{fecha_actual}'}</code>
                            </p>

                            <textarea
                                value={settings.systemPrompt || ''}
                                onChange={(e) => setSettings({ ...settings, systemPrompt: e.target.value })}
                                className="w-full h-96 px-4 py-3 bg-gray-900 dark:bg-gray-950 text-green-400 font-mono text-sm border border-gray-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all resize-y"
                                placeholder={generateSystemPrompt()}
                                spellCheck={false}
                            />

                            <div className="mt-4 flex items-center justify-between text-sm">
                                <span className="text-gray-500">
                                    {(settings.systemPrompt || '').length} caracteres
                                </span>
                                <span className="text-gray-500">
                                    ~{Math.ceil((settings.systemPrompt || '').length / 4)} tokens estimados
                                </span>
                            </div>
                        </div>

                        {/* Variables Reference */}
                        <div className="glass rounded-2xl p-6 border border-gray-100 dark:border-gray-800">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Variables Disponibles</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                {[
                                    { var: '{maquinarias}', desc: 'Lista de maquinarias con descripciones y precios' },
                                    { var: '{servicios}', desc: 'Lista de servicios adicionales disponibles' },
                                    { var: '{fecha_actual}', desc: 'Fecha y hora actual del sistema' },
                                    { var: '{cliente_nombre}', desc: 'Nombre del cliente (si está disponible)' },
                                    { var: '{historial}', desc: 'Historial de la conversación actual' },
                                    { var: '{ventas_cliente}', desc: 'Ventas previas del cliente' },
                                ].map((item) => (
                                    <div key={item.var} className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                        <code className="text-purple-600 dark:text-purple-400 font-mono bg-purple-50 dark:bg-purple-900/30 px-2 py-0.5 rounded">
                                            {item.var}
                                        </code>
                                        <span className="text-gray-600 dark:text-gray-400">{item.desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
