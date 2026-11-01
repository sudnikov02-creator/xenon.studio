import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { api } from '../lib/api';
import { useAuth } from './AuthContext';
import { useRealtime } from './RealtimeContext';
import type { Branding, StudioSettings } from '../types';

const DEFAULT_BRANDING: Branding = {
  siteName: 'xenon.studio',
  photographerName: '',
  brandTagline: '',
  accentColor: '#2563eb',
  logoUrl: null,
  faviconUrl: null,
  timezone: 'Europe/Minsk',
  currencySymbol: '₽',
  currencyCode: 'RUB',
  decimalSeparator: 'comma',
  locale: 'ru',
  contacts: { phone: '', telegram: '', instagram: '', email: '' },
  landingEnabled: false,
  seo: { title: 'xenon.studio', description: '', ogImage: null }
};

interface SettingsContextValue {
  branding: Branding;
  settings: StudioSettings | null;
  loading: boolean;
  refresh: () => Promise<void>;
  updateSettings: (patch: Partial<StudioSettings>) => Promise<StudioSettings>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function extractBranding(settings: StudioSettings, base: Branding): Branding {
  return {
    ...base,
    siteName: settings.siteName,
    photographerName: settings.photographerName,
    brandTagline: settings.brandTagline,
    accentColor: settings.accentColor,
    logoUrl: settings.logoUrl,
    faviconUrl: settings.faviconUrl,
    timezone: settings.timezone,
    currencySymbol: settings.currencySymbol,
    currencyCode: settings.currencyCode,
    decimalSeparator: settings.decimalSeparator,
    locale: settings.locale,
    contacts: settings.contacts || base.contacts,
    landingEnabled: settings.landingEnabled,
    seo: settings.seo
  };
}

function applyBranding(branding: Branding) {
  const root = document.documentElement;
  if (/^#[0-9a-f]{6}$/i.test(branding.accentColor || '')) {
    root.style.setProperty('--accent', branding.accentColor);
  }
  document.title = branding.seo?.title || branding.siteName || 'xenon.studio';

  const faviconHref = branding.faviconUrl || '/icons/favicon.svg';
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== faviconHref) link.setAttribute('href', faviconHref);

  const theme = document.querySelector('meta[name="theme-color"]');
  if (theme) theme.setAttribute('content', branding.accentColor || '#2563eb');

  const desc = document.querySelector('meta[name="description"]');
  if (desc && branding.seo?.description) desc.setAttribute('content', branding.seo.description);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const { subscribe } = useRealtime();
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [settings, setSettings] = useState<StudioSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBranding = useCallback(async () => {
    try {
      const data = await api.get<{ branding: Branding }>('/public/branding');
      setBranding({ ...DEFAULT_BRANDING, ...data.branding });
    } catch {
      /* keep defaults */
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const data = await api.get<{ settings: StudioSettings }>('/settings');
      setSettings(data.settings);
      setBranding((prev) => extractBranding(data.settings, prev));
    } catch {
      /* not authenticated yet */
    }
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    await loadBranding();
    if (user) await loadSettings();
    setLoading(false);
  }, [loadBranding, loadSettings, user]);

  useEffect(() => {
    if (status !== 'ready') return;
    let cancelled = false;
    (async () => {
      await loadBranding();
      if (user) await loadSettings();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [status, user, loadBranding, loadSettings]);

  useEffect(() => {
    applyBranding(branding);
  }, [branding]);

  const updateSettings = useCallback(async (patch: Partial<StudioSettings>) => {
    const data = await api.patch<{ settings: StudioSettings }>('/settings', patch);
    setSettings(data.settings);
    setBranding((prev) => extractBranding(data.settings, prev));
    return data.settings;
  }, []);

  useEffect(() => {
    return subscribe('settings', (payload) => {
      const next = payload as StudioSettings;
      if (!next || typeof next !== 'object') return;
      setSettings(next);
      setBranding((prev) => extractBranding(next, prev));
    });
  }, [subscribe]);

  const value = useMemo(
    () => ({ branding, settings, loading, refresh, updateSettings }),
    [branding, settings, loading, refresh, updateSettings]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
