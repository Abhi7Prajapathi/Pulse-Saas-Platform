import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as authApi from "../api/auth";
import { orgStore, tokenStore } from "../api/client";
import type { User } from "../types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: authApi.RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      if (!tokenStore.getAccess()) {
        setIsLoading(false);
        return;
      }
      try {
        const me = await authApi.fetchMe();
        setUser(me);
      } catch {
        tokenStore.clear();
      } finally {
        setIsLoading(false);
      }
    };
    bootstrap();
  }, []);

  const handleLogin = async (email: string, password: string) => {
    const payload = await authApi.login(email, password);
    tokenStore.set(payload.access, payload.refresh);
    setUser(payload.user);
  };

  const handleRegister = async (input: authApi.RegisterInput) => {
    const payload = await authApi.register(input);
    tokenStore.set(payload.access, payload.refresh);
    setUser(payload.user);
  };

  const handleLogout = async () => {
    const refresh = tokenStore.getRefresh();
    try {
      if (refresh) await authApi.logout(refresh);
    } catch {
      // best-effort — clear local state regardless
    }
    tokenStore.clear();
    orgStore.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
