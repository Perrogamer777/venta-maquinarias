'use client';

import { LucideIcon } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
        icon?: LucideIcon;
    };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="text-center py-12 px-6 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800">
            <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon size={32} className="text-gray-400" />
            </div>
            <h3 className="text-gray-900 dark:text-white font-semibold mb-2">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                {description}
            </p>
            {action && (
                <Button variant="primary" onClick={action.onClick}>
                    {action.icon && <action.icon size={18} />}
                    {action.label}
                </Button>
            )}
        </div>
    );
}
