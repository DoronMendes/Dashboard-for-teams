import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AUTH_UNAUTHORIZED_EVENT,
  clearStoredAccessToken,
  getStoredAccessToken,
  storeAccessToken,
} from "@/auth/tokenStorage";
import { queryClient } from "@/lib/queryClient";
import { getCurrentUser, getGoogleLoginUrl } from "@/services/api";
import type { User } from "@/types";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginWithGoogle: () => void;
  completeLogin: (accessToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(() => Boolean(getStoredAccessToken()));

  const logout = useCallback(() => {
    clearStoredAccessToken();
    setUser(null);
    setIsLoading(false);
    queryClient.clear();
  }, []);

  const loadUser = useCallback(async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  }, []);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    void loadUser()
      .catch(() => {
        if (!cancelled) logout();
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loadUser, logout]);

  useEffect(() => {
    window.addEventListener(AUTH_UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(AUTH_UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  const loginWithGoogle = useCallback(() => {
    window.location.assign(getGoogleLoginUrl());
  }, []);

  const completeLogin = useCallback(
    async (accessToken: string) => {
      storeAccessToken(accessToken);
      setIsLoading(true);
      try {
        await loadUser();
      } catch (error) {
        logout();
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [loadUser, logout],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      loginWithGoogle,
      completeLogin,
      logout,
    }),
    [user, isLoading, loginWithGoogle, completeLogin, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
