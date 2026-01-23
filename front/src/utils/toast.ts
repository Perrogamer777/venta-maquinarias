import { toast as sonnerToast } from 'sonner';

export const toast = {
    success: (message: string) => {
        sonnerToast.success(message, {
            duration: 3000,
            position: 'top-right',
        });
    },

    error: (message: string) => {
        sonnerToast.error(message, {
            duration: 4000,
            position: 'top-right',
        });
    },

    info: (message: string) => {
        sonnerToast.info(message, {
            duration: 3000,
            position: 'top-right',
        });
    },

    warning: (message: string) => {
        sonnerToast.warning(message, {
            duration: 3500,
            position: 'top-right',
        });
    },

    loading: (message: string) => {
        return sonnerToast.loading(message, {
            position: 'top-right',
        });
    },

    promise: <T,>(
        promise: Promise<T>,
        messages: {
            loading: string;
            success: string;
            error: string;
        }
    ) => {
        return sonnerToast.promise(promise, {
            loading: messages.loading,
            success: messages.success,
            error: messages.error,
            position: 'top-right',
        });
    },
};
