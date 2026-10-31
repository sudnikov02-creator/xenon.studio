import type { ReactNode } from 'react';
import { BellRing, CalendarCheck2, Smartphone, Sparkles, Wifi } from 'lucide-react';
import { BrandMark } from '../ui/BrandMark';
import { useSettings } from '../../context/SettingsContext';

const FEATURES = [
  { icon: CalendarCheck2, label: 'Онлайн-запись' },
  { icon: Wifi, label: 'Живые сообщения' },
  { icon: BellRing, label: 'Telegram и push' },
  { icon: Smartphone, label: 'PWA на телефон' }
];

export function AuthShell({ children }: { children: ReactNode }) {
  const { branding } = useSettings();
  const year = new Date().getFullYear();

  return (
    <div className="auth">
      <section className="auth__brand" aria-hidden="true">
        <span className="auth__orb auth__orb--1" />
        <span className="auth__orb auth__orb--2" />
        <span className="auth__orb auth__orb--3" />

        <div className="auth__brand-top">
          <BrandMark size={40} />
          <div>
            <div className="auth__brand-name">{branding.siteName}</div>
            <div className="auth__brand-caption">студия фотографа</div>
          </div>
        </div>

        <div className="auth__hero">
          <span className="auth__eyebrow">
            <Sparkles /> Личная студия · один фотограф
          </span>
          <h1 className="auth__headline">
            Свет, который
            <br />
            <em>остаётся с вами</em>
          </h1>
          <p className="auth__lead">
            Записи, клиенты, сообщения и маркетинг — в одной спокойной панели. Всё обновляется мгновенно, без
            перезагрузок и лишних движений.
          </p>
          <div className="auth__features">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <span className="auth__feature" key={feature.label}>
                  <Icon /> {feature.label}
                </span>
              );
            })}
          </div>
        </div>

        <div className="auth__brand-foot">
          <span>© {year} {branding.siteName}</span>
          <span className="dot" />
          <span>{branding.brandTagline || 'фотография на естественном свете'}</span>
        </div>
      </section>

      <section className="auth__panel">
        <div className="auth__form">
          <div className="auth__mobile-brand">
            <BrandMark size={40} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 680, letterSpacing: '-0.03em' }}>{branding.siteName}</div>
              <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-2)', fontWeight: 600 }}>
                студия фотографа
              </div>
            </div>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
