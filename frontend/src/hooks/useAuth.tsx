/** Auth context: token + current user, persisted in localStorage. */
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getCurrentUser, getToken, login as apiLogin, register as apiRegister, setToken } from "../services/api";
import type { User } from "../types";

interface AuthState {
  user: User | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = await getCurrentUser();
      if (!cancelled) {
        setUser(current);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { token, user: who } = await apiLogin(username, password);
    setToken(token);
    setUser(who);
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const { token, user: who } = await apiRegister(username, password);
    setToken(token);
    setUser(who);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, ready, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** True when a token exists but /me hasn't answered yet. */
export function hasStoredToken(): boolean {
  return Boolean(getToken());
}
