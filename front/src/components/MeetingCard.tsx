'use client';

import { Meeting } from '@/types';
import { ESTADOS_REUNION } from '@/lib/businessTypes';
import { Phone, Mail, Calendar, Clock, MessageSquare, Video, CheckCircle, X } from 'lucide-react';
import { useState } from 'react';

interface MeetingCardProps {
    meeting: Meeting;
    onUpdateStatus: (meetingId: string, newStatus: string) => Promise<void>;
    onUpdateNotes: (meetingId: string, notes: string) => Promise<void>;
}

export default function MeetingCard({ meeting, onUpdateStatus, onUpdateNotes }: MeetingCardProps) {
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notes, setNotes] = useState(meeting.notes || '');
    const [isUpdating, setIsUpdating] = useState(false);

    const estadoConfig = ESTADOS_REUNION.find(e => e.value === meeting.status);
    const IconComponent = estadoConfig?.icon || Clock;

    const handleStatusChange = async (newStatus: string) => {
        setIsUpdating(true);
        try {
            await onUpdateStatus(meeting.id, newStatus);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleSaveNotes = async () => {
        setIsUpdating(true);
        try {
            await onUpdateNotes(meeting.id, notes);
            setIsEditingNotes(false);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-gray-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-all duration-300">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4 flex-1">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${estadoConfig?.color.split(' ')[0] || 'bg-gray-100'}/20`}>
                        <IconComponent size={24} className={estadoConfig?.color.split(' ')[1] || 'text-gray-600'} />
                    </div>
                    <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">
                            {meeting.client_name || 'Cliente'}
                        </h3>
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${estadoConfig?.color || 'bg-gray-100 text-gray-800'}`}>
                            <IconComponent size={12} strokeWidth={3} />
                            {estadoConfig?.label || meeting.status}
                        </span>
                    </div>
                </div>
            </div>

            {/* Contact Info */}
            <div className="space-y-3 mb-4">
                <div className="flex items-center gap-3 text-sm">
                    <Phone size={16} className="text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">{meeting.phone}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">{meeting.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                    {meeting.type === 'videollamada' ? (
                        <Video size={16} className="text-gray-400" />
                    ) : (
                        <Phone size={16} className="text-gray-400" />
                    )}
                    <span className="text-gray-700 dark:text-gray-300 capitalize">{meeting.type}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                    <Clock size={16} className="text-gray-400" />
                    <span className="text-gray-700 dark:text-gray-300">{meeting.preferred_time}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                    <Calendar size={16} className="text-gray-400" />
                    <span className="text-gray-500 dark:text-gray-400">
                        Creada: {new Date(meeting.created_at).toLocaleDateString('es-CL', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })}
                    </span>
                </div>
            </div>

            {/* Notes Section */}
            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <MessageSquare size={16} />
                        Notas
                    </label>
                    {!isEditingNotes && (
                        <button
                            onClick={() => setIsEditingNotes(true)}
                            className="text-xs text-green-600 hover:text-green-700 font-medium"
                        >
                            Editar
                        </button>
                    )}
                </div>
                {isEditingNotes ? (
                    <div className="space-y-2">
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
                            rows={3}
                            placeholder="Agregar notas sobre la reunión..."
                        />
                        <div className="flex gap-2">
                            <button
                                onClick={handleSaveNotes}
                                disabled={isUpdating}
                                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                            >
                                <CheckCircle size={14} />
                                Guardar
                            </button>
                            <button
                                onClick={() => {
                                    setIsEditingNotes(false);
                                    setNotes(meeting.notes || '');
                                }}
                                disabled={isUpdating}
                                className="px-3 py-1.5 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-medium hover:bg-gray-300 dark:hover:bg-slate-600 disabled:opacity-50 flex items-center gap-1"
                            >
                                <X size={14} />
                                Cancelar
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-slate-800 rounded-xl p-3">
                        {meeting.notes || 'Sin notas'}
                    </p>
                )}
            </div>

            {/* Action Buttons */}
            {meeting.status !== 'completada' && meeting.status !== 'cancelada' && (
                <div className="flex gap-2 flex-wrap">
                    {meeting.status === 'pendiente' && (
                        <button
                            onClick={() => handleStatusChange('confirmada')}
                            disabled={isUpdating}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            Confirmar
                        </button>
                    )}
                    {(meeting.status === 'pendiente' || meeting.status === 'confirmada') && (
                        <>
                            <button
                                onClick={() => handleStatusChange('completada')}
                                disabled={isUpdating}
                                className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                            >
                                Marcar Completada
                            </button>
                            <button
                                onClick={() => handleStatusChange('cancelada')}
                                disabled={isUpdating}
                                className="px-4 py-2 bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-300 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
                            >
                                Cancelar
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
