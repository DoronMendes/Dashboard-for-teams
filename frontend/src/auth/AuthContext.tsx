import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AUTH_UNAUTHORIZED_EVENT } from "@/auth/tokenStorage";
import { queryClient } from "@/lib/queryClient";
import {
  getCurrentUser,
  getGoogleLoginUrl,
  logoutSession,
  updateUserAvatar,
  updateUserPreferences,
} from "@/services/api";
import { ApiError } from "@/services/apiClient";
import type { User, UserPreferences } from "@/types";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: () => void;
  completeLogin: () => Promise<void>;
  logout: () => Promise<void>;
  setAvatar: (avatar: string | null) => Promise<void>;
  setPreferences: (preferences: UserPreferences) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clearClientSession = useCallback(() => {
    setUser(null);
    setIsLoading(false);
    queryClient.clear();
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutSession();
    } finally {
      clearClientSession();
    }
  }, [clearClientSession]);

  const loadUser = useCallback(async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadUser()
      .catch((error: unknown) => {
        if (!cancelled && error instanceof ApiError && error.status === 401) {
          clearClientSession();
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadUser, clearClientSession]);

  useEffect(() => {
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, clearClientSession);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, clearClientSession);
  }, [clearClientSession]);

  const loginWithGoogle = useCallback(() => {
    window.location.assign(getGoogleLoginUrl());
  }, []);

  const setAvatar = useCallback(async (avatar: string | null) => {
    setUser(await updateUserAvatar(avatar));
  }, []);

  const setPreferences = useCallback(async (preferences: UserPreferences) => {
    setUser(await updateUserPreferences(preferences));
  }, []);

  const completeLogin = useCallback(
    async () => {
      setIsLoading(true);
      try {
        await loadUser();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) clearClientSession();
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [loadUser, clearClientSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      loginWithGoogle,
      completeLogin,
      logout,
      setAvatar,
      setPreferences,
    }),
    [user, isLoading, loginWithGoogle, completeLogin, logout, setAvatar, setPreferences],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
