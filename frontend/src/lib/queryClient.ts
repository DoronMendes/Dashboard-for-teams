import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "@/services/apiClient";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retrying a 404 or a 409 just delays the error the user needs to see.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

export const queryKeys = {
  projects: (q?: string) => ["projects", { q: q?.trim() || "" }] as const,
  project: (id: string) => ["projects", id] as const,
};
