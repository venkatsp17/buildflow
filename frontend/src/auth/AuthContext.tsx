import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { login as apiLogin, me as apiMe, setUnauthorizedHandler, type User } from '@/api/client';
import { clearToken, getToken, setToken as persistToken } from '@/auth/tokenStorage';

type AuthContextValue = {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // On app start, restore a persisted token and re-fetch the user via the
  // protected /auth/me route (also proves the JWT middleware works end-to-end).
  useEffect(() => {
    (async () => {
      const stored = await getToken();
      if (stored) {
        try {
          const { user: fetchedUser } = await apiMe(stored);
          setToken(stored);
          setUser(fetchedUser);
        } catch {
          await clearToken();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  const logout = useCallback(async (reason?: 'expired') => {
    await clearToken();
    setToken(null);
    setUser(null);
    setSessionExpired(reason === 'expired');
  }, []);

  // Any authenticated API call that comes back 401 (expired/invalid token)
  // triggers this, which clears the session and bounces to the login screen
  // via the (app) layout's auth guard.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout('expired');
    });
  }, [logout]);

  const login = async (email: string, password: string) => {
    const { token: newToken, user: newUser } = await apiLogin(email, password);
    await persistToken(newToken);
    setToken(newToken);
    setUser(newUser);
    setSessionExpired(false);
  };

  const value = useMemo(
    () => ({ token, user, isLoading, sessionExpired, login, logout }),
    [token, user, isLoading, sessionExpired, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
