import { useState } from 'react';
import {
  CalendarClock,
  Check,
  Copy,
  Gift,
  History,
  Lock,
  Send,
  Sparkles,
  Ticket,
  Unlock,
  User,
  Wallet
} from 'lucide-react';
import { formatMoney } from '../../lib/utils';
import type { CertificateItem } from '../../types';

const STATUS_LABEL: Record<CertificateItem['status'], string> = {
  active: 'активен',
  used: 'использован',
  expired: 'истёк',
  blocked: 'заблокирован'
};

function shortDate(value: string | null): string {
  if (!value) return 'без срока';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${value}T00:00:00.000Z`)
  );
}

export function CertificateCard({
  item,
  currencySymbol,
  decimalSeparator,
  onToggleBlock,
  onOpen
}: {
  item: CertificateItem;
  currencySymbol: string;
  decimalSeparator: 'comma' | 'dot';
  onToggleBlock: () => void;
  onOpen: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [copied, setCopied] = useState(false);
  const share = Math.round((item.spent / Math.max(item.amount, 1)) * 100);

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(item.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="cert-wrap" data-status={item.status}>
      <button
        type="button"
        className="cert-flip"
        data-flipped={flipped || undefined}
        onClick={() => setFlipped((value) => !value)}
        aria-label={flipped ? 'Показать лицевую сторону сертификата' : 'Показать детали сертификата'}
      >
        <span className="cert-face cert-face--front" aria-hidden={flipped}>
          <span className="cert-face__glow" aria-hidden />
          <span className="cert-face__top">
            <span className="cert-face__brand">
              <Gift /> xenon.studio
            </span>
            <span className="cert-face__status" data-status={item.status}>
              {STATUS_LABEL[item.status]}
            </span>
          </span>

          <span className="cert-face__value tnum">
            {item.kind === 'service'
              ? item.serviceName || 'Сертификат на услугу'
              : formatMoney(item.amount, currencySymbol, decimalSeparator)}
          </span>

          <span className="cert-face__recipient">
            <User />
            {item.recipient || 'Подарочный сертификат'}
          </span>

          {item.kind === 'amount' && item.spent > 0 && (
            <span className="cert-face__progress">
              <span className="cert-face__bar">
                <i style={{ width: `${share}%` }} />
              </span>
              <em>
                осталось {formatMoney(item.remaining, currencySymbol, decimalSeparator)} из{' '}
                {formatMoney(item.amount, currencySymbol, decimalSeparator)}
              </em>
            </span>
          )}

          <span className="cert-face__foot">
            <span className="cert-face__code">{item.code}</span>
            <span className="cert-face__date">
              <CalendarClock /> до {shortDate(item.expiresAt)}
            </span>
          </span>
        </span>

        <span className="cert-face cert-face--back" aria-hidden={!flipped}>
          <span className="cert-face__top">
            <span className="cert-face__brand">
              <History /> Детали
            </span>
            <span className="cert-face__status" data-status={item.status}>
              {STATUS_LABEL[item.status]}
            </span>
          </span>

          <span className="cert-back__rows">
            <span>
              <em>Номинал</em>
              <b className="tnum">{formatMoney(item.amount, currencySymbol, decimalSeparator)}</b>
            </span>
            <span>
              <em>Остаток</em>
              <b className="tnum">{formatMoney(item.remaining, currencySymbol, decimalSeparator)}</b>
            </span>
            <span>
              <em>Выпущен</em>
              <b>{shortDate(item.purchasedAt)}</b>
            </span>
            <span>
              <em>Списаний</em>
              <b>{item.history.length}</b>
            </span>
          </span>

          {item.history.length > 0 ? (
            <span className="cert-back__history">
              {item.history.slice(0, 2).map((row) => (
                <span key={row.id}>
                  <Wallet /> {formatMoney(row.amount, currencySymbol, decimalSeparator)}
                  <em>{row.startsAt ? shortDate(row.startsAt.slice(0, 10)) : ''}</em>
                </span>
              ))}
            </span>
          ) : (
            <span className="cert-back__empty">
              <Sparkles /> Ещё не использовался
            </span>
          )}

          <span className="cert-face__foot">
            <span className="cert-face__code">перевернуть назад</span>
          </span>
        </span>
      </button>

      <div className="cert-actions">
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => void copy()}>
          {copied ? <Check /> : <Copy />} {copied ? 'Скопировано' : 'Код'}
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={onOpen}>
          <Ticket /> Подробнее
        </button>
        {item.status === 'active' && (
          <button type="button" className="btn btn--icon btn--ghost cert-actions__block" onClick={onToggleBlock} aria-label="Заблокировать">
            <Lock />
          </button>
        )}
        {item.status === 'blocked' && (
          <button type="button" className="btn btn--icon btn--ghost" onClick={onToggleBlock} aria-label="Разблокировать">
            <Unlock />
          </button>
        )}
        {item.status === 'active' && item.phone && (
          <a
            className="btn btn--icon btn--ghost"
            href={`https://t.me/share/url?url=${encodeURIComponent(item.code)}&text=${encodeURIComponent(
              `Ваш сертификат xenon.studio: ${item.code}`
            )}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Отправить в Telegram"
          >
            <Send />
          </a>
        )}
      </div>
    </div>
  );
}
