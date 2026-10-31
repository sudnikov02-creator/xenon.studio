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
import { useAuth } from './AuthContext';
import type { Badges } from '../types';

type Listener = (payload: unknown) => void;

interface RealtimeContextValue {
  connected: boolean;
  badges: Badges;
  subscribe: (event: string, listener: Listener) => () => void;
  refreshBadges: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

const EMPTY_BADGES: Badges = { unreadNotifications: 0, unreadMessages: 0, pendingBookings: 0 };

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const [badges, setBadges] = useState<Badges>(EMPTY_BADGES);
  const listeners = useRef(new Map<string, Set<Listener>>());
  const sourceRef = useRef<EventSource | null>(null);
  const lastBadgePing = useRef(0);

  const emit = useCallback((event: string, payload: unknown) => {
    listeners.current.get(event)?.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.error('[realtime] listener error', err);
      }
    });
  }, []);

  const subscribe = useCallback((event: string, listener: Listener) => {
    if (!listeners.current.has(event)) listeners.current.set(event, new Set());
    listeners.current.get(event)!.add(listener);
    return () => {
      listeners.current.get(event)?.delete(listener);
    };
  }, []);

  const refreshBadges = useCallback(() => {
    if (!user) return;
    const now = Date.now();
    if (now - lastBadgePing.current < 800) return;
    lastBadgePing.current = now;
    fetch('/api/badges', { credentials: 'same-origin' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Badges | null) => {
        if (data) setBadges(data);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!user) {
      setConnected(false);
      setBadges(EMPTY_BADGES);
      sourceRef.current?.close();
      sourceRef.current = null;
      return;
    }

    refreshBadges();
    const source = new EventSource('/api/events', { withCredentials: true });
    sourceRef.current = source;

    source.addEventListener('open', () => setConnected(true));
    source.addEventListener('error', () => setConnected(false));
    source.addEventListener('hello', () => {
      setConnected(true);
      refreshBadges();
    });

    const badgesHandler = (event: MessageEvent) => {
      try {
        setBadges(JSON.parse(event.data) as Badges);
      } catch {}
    };
    source.addEventListener('badges', badgesHandler);

    const forward = (name: string) => (event: MessageEvent) => {
      let payload: unknown = null;
      try {
        payload = JSON.parse(event.data);
      } catch {
        payload = event.data;
      }
      emit(name, payload);
      if (name !== 'settings' && name !== 'hello') refreshBadges();
    };

    const forwarded = ['notification', 'settings', 'activity', 'booking', 'message', 'client', 'status'];
    const handlers = forwarded.map((name) => [name, forward(name)] as const);
    handlers.forEach(([name, handler]) => source.addEventListener(name, handler));

    return () => {
      handlers.forEach(([name, handler]) => source.removeEventListener(name, handler));
      source.removeEventListener('badges', badgesHandler);
      source.close();
      sourceRef.current = null;
      setConnected(false);
    };
  }, [user, emit, refreshBadges]);

  const value = useMemo(
    () => ({ connected, badges, subscribe, refreshBadges }),
    [connected, badges, subscribe, refreshBadges]
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used within RealtimeProvider');
  return ctx;
}
