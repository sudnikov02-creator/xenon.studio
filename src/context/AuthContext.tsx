import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react';
import { api } from '../lib/api';
import type { AuthStatusResponse, User } from '../types';

interface AuthContextValue {
  status: 'loading' | 'ready';
  user: User | null;
  hasAccount: boolean;
  demoHint: { email: string; password: string } | null;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [hasAccount, setHasAccount] = useState(true);
  const [demoHint, setDemoHint] = useState<AuthStatusResponse['demoHint']>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.get<AuthStatusResponse>('/auth/status');
      if (!mounted.current) return;
      setUser(data.user);
      setHasAccount(data.hasAccount);
      setDemoHint(data.demoHint);
    } catch {
      if (mounted.current) setUser(null);
    } finally {
      if (mounted.current) setStatus('ready');
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('xenon:unauthorized', handler);
    return () => window.removeEventListener('xenon:unauthorized', handler);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ user: User }>('/auth/login', { email, password });
    setUser(data.user);
    setHasAccount(true);
    return data.user;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await api.post<{ user: User }>('/auth/register', { name, email, password });
    setUser(data.user);
    setHasAccount(true);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, hasAccount, demoHint, login, register, logout, refresh: loadStatus }),
    [status, user, hasAccount, demoHint, login, register, logout, loadStatus]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
