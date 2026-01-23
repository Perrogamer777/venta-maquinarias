'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Notification {
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
    timestamp: number;
}

interface AppState {
    // UI State
    sidebarCollapsed: boolean;
    toggleSidebar: () => void;

    // User Preferences
    itemsPerPage: number;
    setItemsPerPage: (count: number) => void;

    // Notifications
    notifications: Notification[];
    addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
    removeNotification: (id: string) => void;
    clearNotifications: () => void;
}

export const useAppStore = create<AppState>()(
    persist(
        (set) => ({
            // UI State
            sidebarCollapsed: false,
            toggleSidebar: () => set((state) => ({
                sidebarCollapsed: !state.sidebarCollapsed
            })),

            // User Preferences
            itemsPerPage: 20,
            setItemsPerPage: (count) => set({ itemsPerPage: count }),

            // Notifications
            notifications: [],
            addNotification: (notification) => set((state) => ({
                notifications: [
                    ...state.notifications,
                    {
                        ...notification,
                        id: Math.random().toString(36).substring(7),
                        timestamp: Date.now(),
                    },
                ],
            })),
            removeNotification: (id) => set((state) => ({
                notifications: state.notifications.filter((n) => n.id !== id),
            })),
            clearNotifications: () => set({ notifications: [] }),
        }),
        {
            name: 'dashboard-storage',
            partialize: (state) => ({
                sidebarCollapsed: state.sidebarCollapsed,
                itemsPerPage: state.itemsPerPage,
            }),
        }
    )
);
