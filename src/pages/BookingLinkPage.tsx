import { Link, useParams } from 'react-router-dom';
import { CalendarDays, Home, Link2 } from 'lucide-react';
import { BrandMark } from '../components/ui/BrandMark';
import { useSettings } from '../context/SettingsContext';

export function BookingLinkPage() {
  const { code } = useParams<{ code: string }>();
  const { branding } = useSettings();

  return (
    <div className="statuspage">
      <div className="statuspage__card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <BrandMark size={46} title={branding.siteName} />
        </div>
        <div className="statuspage__icon">
          <CalendarDays />
        </div>
        <h1 className="statuspage__title">Страница вашей съёмки</h1>
        <p className="statuspage__text">
          Здесь появятся детали сессии, актуальный статус и действия. Страница обновляется мгновенно, когда
          фотограф подтверждает запись.
        </p>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 18,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: 12.5,
            color: 'var(--muted)'
          }}
        >
          <Link2 style={{ width: 14, height: 14 }} />
          {code}
        </div>
        <div className="statuspage__actions">
          <Link to="/" className="btn btn--primary">
            <Home /> На главную
          </Link>
        </div>
        <div className="statuspage__hint">Личная ссылка · {branding.siteName}</div>
      </div>
    </div>
  );
}
