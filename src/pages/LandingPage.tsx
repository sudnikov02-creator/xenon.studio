import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck2, CalendarPlus, MessageSquare, ShieldCheck, Sparkles } from 'lucide-react';
import { BrandMark } from '../components/ui/BrandMark';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

const CARDS = [
  {
    icon: CalendarCheck2,
    title: 'Запись без переписки',
    text: 'Свободные слоты, дополнения и стоимость — всё видно сразу.'
  },
  {
    icon: MessageSquare,
    title: 'Все сообщения рядом',
    text: 'Telegram и почта в одном месте, вместе с автоуведомлениями.'
  },
  {
    icon: ShieldCheck,
    title: 'Личные ссылки',
    text: 'Каждая съёмка доступна по отдельной защищённой ссылке.'
  }
];

export function LandingPage() {
  const { user } = useAuth();
  const { branding } = useSettings();
  const year = new Date().getFullYear();

  return (
    <div className="public">
      <nav className="public__nav">
        <BrandMark />
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 680, letterSpacing: '-0.03em' }}>{branding.siteName}</div>
          <div style={{ fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted-2)', fontWeight: 600 }}>
            студия фотографа
          </div>
        </div>
        <div className="public__nav-actions">
          <Link to="/booking" className="btn btn--soft">
            Записаться
            <CalendarPlus />
          </Link>
          <Link to={user ? '/admin' : '/login'} className="btn btn--ghost">
            {user ? 'Открыть панель' : 'Войти'}
            <ArrowRight />
          </Link>
        </div>
      </nav>

      <section className="public__hero">
        <span className="public__eyebrow">
          <Sparkles /> {branding.photographerName || 'Фотограф'} · {branding.brandTagline || 'естественный свет'}
        </span>
        <h1 className="public__title">
          Фотография, в которой
          <br />
          <em>вы настоящая</em>
        </h1>
        <p className="public__lead">
          Спокойные съёмки без спешки и неловких поз. Мягкий свет, живые эмоции и кадры, которые хочется
          пересматривать.
        </p>
        <div className="public__cta">
          <Link to="/booking" className="btn btn--primary btn--lg">
            Записаться на съёмку
            <ArrowRight />
          </Link>
          <Link to={user ? '/admin' : '/login'} className="btn btn--lg">
            {user ? 'Перейти в панель студии' : 'Войти в студию'}
          </Link>
        </div>
        <div className="public__note">
          <ShieldCheck /> Свободное время, стоимость и подтверждение — сразу на сайте
        </div>

        <div className="public__cards">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <article className="public__card" key={card.title}>
                <span className="public__card-icon">
                  <Icon />
                </span>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <footer className="public__foot">
        © {year} {branding.siteName} · сделано с вниманием к деталям
      </footer>
    </div>
  );
}
