import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { BookingWizard } from '../components/booking/BookingWizard';
import { BrandMark } from '../components/ui/BrandMark';
import { useSettings } from '../context/SettingsContext';

export function BookingPage() {
  const { branding } = useSettings();

  return (
    <div className="booking-page">
      <header className="booking-page__bar">
        <Link to="/" className="booking-page__brand">
          <BrandMark size={32} title={branding.siteName} />
          <span>
            <b>{branding.photographerName}</b>
            <em>{branding.siteName}</em>
          </span>
        </Link>
        <Link to="/" className="btn btn--ghost btn--sm">
          <ArrowLeft /> На главную
        </Link>
      </header>

      <main className="booking-page__main">
        <BookingWizard variant="public" />
        <aside className="booking-page__aside">
          <div className="booking-page__card">
            <span className="booking-page__icon">
              <ShieldCheck />
            </span>
            <b>Спокойно и без переписки</b>
            <p>
              Свободное время показано только то, которое действительно свободно. Заявка занимает минуту, а
              подтверждение придёт уведомлением.
            </p>
          </div>
          <div className="booking-page__steps">
            <span>1</span>
            <p>Выберите услугу и время — стоимость считается сразу.</p>
            <span>2</span>
            <p>Подтвердите телефон кодом — так проще не потерять связь.</p>
            <span>3</span>
            <p>Фотограф подтвердит запись, ссылка на съёмку останется у вас.</p>
          </div>
        </aside>
      </main>

      <footer className="booking-page__foot">
        <span>{branding.siteName}</span>
        <span>·</span>
        <span>{branding.brandTagline}</span>
      </footer>
    </div>
  );
}
