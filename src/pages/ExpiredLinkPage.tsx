import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, Home, MessageSquare } from 'lucide-react';
import { BrandMark } from '../components/ui/BrandMark';
import { useSettings } from '../context/SettingsContext';

export function ExpiredLinkPage() {
  const { branding } = useSettings();
  return (
    <div className="statuspage">
      <div className="statuspage__card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <BrandMark size={46} title={branding.siteName} />
        </div>
        <div className="statuspage__icon">
          <Clock />
        </div>
        <h1 className="statuspage__title">Ссылка больше не активна</h1>
        <p className="statuspage__text">
          Срок действия этой ссылки истёк или запись была удалена. Напишите фотографу — подскажем актуальную
          информацию о вашей сессии.
        </p>
        <div className="statuspage__actions">
          <Link to="/" className="btn btn--primary">
            <Home /> На главную
          </Link>
          <a className="btn" href="mailto:studio@xenon.studio">
            <MessageSquare /> Написать фотографу
          </a>
        </div>
        <div className="statuspage__hint">
          <ArrowLeft /> Если вы перешли по старой ссылке — запросите новую у студии
        </div>
      </div>
    </div>
  );
}
