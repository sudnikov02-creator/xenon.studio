import { Camera, FileText, Mail, MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import type { ClientBookingView } from '../../types';

export function ClientHelp({ view }: { view: ClientBookingView }) {
  const { studio, permissions, schedule, agreement } = view;
  const contacts = studio.contacts || { phone: '', telegram: '', instagram: '', email: '' };
  const hasContacts = Boolean(contacts.phone || contacts.telegram || contacts.instagram || contacts.email);

  return (
    <div className="cp-cards">
      <article className="cp-card">
        <header className="cp-card__head">
          <span className="cp-card__icon">
            <MessageCircle />
          </span>
          <div>
            <h3>Связаться с фотографом</h3>
            <p className="cp-card__sub">{studio.photographerName || studio.siteName}</p>
          </div>
        </header>

        {hasContacts ? (
          <div className="cp-contacts">
            {contacts.telegram && (
              <a
                className="cp-contact cp-contact--accent"
                href={`https://t.me/${contacts.telegram.replace(/^@/, '')}`}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle />
                <span>
                  Написать в Telegram
                  <em>@{contacts.telegram.replace(/^@/, '')}</em>
                </span>
              </a>
            )}
            {contacts.phone && (
              <a className="cp-contact" href={`tel:${contacts.phone.replace(/[^\d+]/g, '')}`}>
                <Phone />
                <span>
                  Позвонить
                  <em>{contacts.phone}</em>
                </span>
              </a>
            )}
            {contacts.instagram && (
              <a
                className="cp-contact"
                href={`https://instagram.com/${contacts.instagram.replace(/^@/, '')}`}
                target="_blank"
                rel="noreferrer"
              >
                <Camera />
                <span>
                  Instagram
                  <em>@{contacts.instagram.replace(/^@/, '')}</em>
                </span>
              </a>
            )}
            {contacts.email && (
              <a className="cp-contact" href={`mailto:${contacts.email}`}>
                <Mail />
                <span>
                  Почта
                  <em>{contacts.email}</em>
                </span>
              </a>
            )}
          </div>
        ) : (
          <p className="cp-card__text">
            Контакты фотографа появятся здесь, как только студия их заполнит. Пока можно ответить на письмо с
            подтверждением записи.
          </p>
        )}
      </article>

      <article className="cp-card">
        <header className="cp-card__head">
          <span className="cp-card__icon">
            <ShieldCheck />
          </span>
          <div>
            <h3>Правила записи</h3>
            <p className="cp-card__sub">Коротко о главном</p>
          </div>
        </header>
        <ul className="cp-rules">
          <li>
            <b>Перенос</b>
            <span>
              {permissions.canReschedule
                ? `бесплатно не позднее чем за ${schedule.minNoticeHours} ч до съёмки`
                : permissions.rescheduleReason || 'по этой записи недоступен'}
            </span>
          </li>
          <li>
            <b>Отмена</b>
            <span>
              {permissions.canCancel
                ? 'в один клик на этой странице — фотограф получит уведомление'
                : permissions.cancelReason || 'по этой записи недоступна'}
            </span>
          </li>
          <li>
            <b>Оплата</b>
            <span>в день съёмки, наличными или переводом</span>
          </li>
          <li>
            <b>Кадры</b>
            <span>обработка до 14 дней, ссылка на галерею появится здесь же</span>
          </li>
        </ul>
      </article>

      {agreement.enabled && agreement.text && (
        <article className="cp-card">
          <header className="cp-card__head">
            <span className="cp-card__icon">
              <FileText />
            </span>
            <div>
              <h3>Условия съёмки</h3>
              <p className="cp-card__sub">Договорённости студии</p>
            </div>
          </header>
          <p className="cp-card__text cp-card__text--pre">{agreement.text}</p>
        </article>
      )}
    </div>
  );
}
