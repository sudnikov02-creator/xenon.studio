import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Home, Sparkles } from 'lucide-react';
import { BrandMark } from '../components/ui/BrandMark';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

export function NotFoundPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { branding } = useSettings();

  return (
    <div className="statuspage">
      <div className="statuspage__card">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
          <BrandMark size={46} title={branding.siteName} />
        </div>
        <div className="statuspage__code">404</div>
        <div className="statuspage__icon" style={{ marginTop: 8 }}>
          <Camera />
        </div>
        <h1 className="statuspage__title">Кадр не найден</h1>
        <p className="statuspage__text">
          Такой страницы нет или она была перемещена. Возможно, ссылка устарела — вернитесь на главную и
          попробуйте снова.
        </p>
        <div className="statuspage__actions">
          <Link to="/" className="btn btn--primary">
            <Home /> На главную
          </Link>
          {user ? (
            <Link to="/admin" className="btn">
              <Sparkles /> В панель студии
            </Link>
          ) : (
            <button type="button" className="btn" onClick={() => navigate(-1)}>
              <ArrowLeft /> Назад
            </button>
          )}
        </div>
        <div className="statuspage__hint">
          <Sparkles /> {branding.siteName}
        </div>
      </div>
    </div>
  );
}
