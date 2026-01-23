import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000,      // 5 minutes
            gcTime: 10 * 60 * 1000,        // 10 minutes (previously cacheTime)
            refetchOnWindowFocus: false,   // Don't refetch on window focus
            retry: 1,                       // Retry failed requests once
            refetchOnMount: false,          // Don't refetch on component mount if data exists
        },
        mutations: {
            retry: 0,                       // Don't retry mutations
        },
    },
});
