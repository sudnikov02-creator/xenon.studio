import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<(available: boolean) => void>();

function notify() {
  listeners.forEach((listener) => listener(Boolean(deferredPrompt)));
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(Boolean(deferredPrompt));
  const [installed, setInstalled] = useState(
    typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches
  );

  useEffect(() => {
    const listener = (available: boolean) => setCanInstall(available);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstalled(true);
      deferredPrompt = null;
      notify();
      return true;
    }
    return false;
  }, []);

  return { canInstall, installed, install };
}
