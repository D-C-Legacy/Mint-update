import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { createApiClient, createLocalStorageTokenStore, ApiError } from '../lib/api-client';

type AdminUser = { id: string; displayName: string; role: string };

const USER_STORAGE_KEY = 'shopaflo-admin.user';

function loadStoredUser(): AdminUser | null {
  try {
    const raw = localStorage.getItem(USER_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AdminUser) : null;
  } catch {
    return null;
  }
}

const tokenStore = createLocalStorageTokenStore();
export const apiClient = createApiClient({ tokens: tokenStore });

// For the WS handshake (realtime.ts) — Socket.IO auth needs a raw access token, not a request
// the api-client's own request() wrapper can make.
export function getAccessToken(): string | undefined {
  return tokenStore.get()?.accessToken;
}

type AuthContextValue = {
  user: AdminUser | null;
  login(email: string, password: string): Promise<void>;
  logout(): void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(() => (tokenStore.get() ? loadStoredUser() : null));

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      async login(email: string, password: string) {
        const result = await apiClient.login(email, password);
        // The real enforcement is the backend's RolesGuard on every /admin/* route — this is
        // just a clearer client-side message than letting a non-admin hit 403s on every page.
        if (result.user.role !== 'ADMIN') {
          apiClient.logout();
          throw new ApiError({
            code: 'FORBIDDEN',
            status: 403,
            message: 'This account does not have admin access.',
          });
        }
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(result.user));
        setUser(result.user);
      },
      logout() {
        apiClient.logout();
        localStorage.removeItem(USER_STORAGE_KEY);
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
