import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Mail,
  MessageSquare,
  Send,
  Sparkles,
  Star,
  TriangleAlert,
  UserRound,
  Zap
} from 'lucide-react';
import { BookingStatusPill } from '../bookings/BookingStatusPill';
import { formatDayLabel, formatMoney, formatTimeIn, initials } from '../../lib/utils';
import type { ConversationDetailPayload, MessageChannel } from '../../types';

const QUICK_REPLIES = [
  'Здравствуйте! Спасибо за сообщение — отвечу в течение часа.',
  'Давайте созвонимся, так быстрее всё обсудим.',
  'Подскажите, пожалуйста, сколько человек будет на съёмке?',
  'Напоминаю: встречаемся за 10 минут до начала.'
];

export function ChatThread({
  detail,
  loading,
  sending,
  error,
  timezone,
  currencySymbol,
  decimalSeparator,
  onSend,
  onBack,
  onOpenClient,
  onOpenBooking
}: {
  detail: ConversationDetailPayload | null;
  loading: boolean;
  sending: boolean;
  error: string | null;
  timezone: string;
  currencySymbol: string;
  decimalSeparator: 'comma' | 'dot';
  onSend: (body: string, channel: MessageChannel) => Promise<boolean>;
  onBack: () => void;
  onOpenClient: (clientId: number) => void;
  onOpenBooking: (code: string) => void;
}) {
  /* Черновик и канал привязаны к диалогу: при переключении старый текст не «переезжает». */
  const [draftFor, setDraftFor] = useState<{ id: number | null; text: string }>({ id: null, text: '' });
  const [channelFor, setChannelFor] = useState<{ id: number | null; channel: MessageChannel } | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  const client = detail?.conversation.client || null;
  const messages = detail?.messages || [];
  const conversationId = detail?.conversation.id ?? null;

  const draft = draftFor.id === conversationId ? draftFor.text : '';
  const channel: MessageChannel =
    channelFor && channelFor.id === conversationId ? channelFor.channel : detail?.conversation.channel || 'telegram';
  const setDraft = (text: string) => setDraftFor({ id: conversationId, text });
  const setChannel = (value: MessageChannel) => setChannelFor({ id: conversationId, channel: value });

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages.length, detail?.conversation.id]);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(area.scrollHeight, 132)}px`;
  }, [draft]);

  const groups = useMemo(() => {
    const result: { day: string; items: typeof messages }[] = [];
    for (const message of messages) {
      const day = formatDayLabel(message.createdAt, timezone);
      const last = result[result.length - 1];
      if (last && last.day === day) last.items.push(message);
      else result.push({ day, items: [message] });
    }
    return result;
  }, [messages, timezone]);

  const canEmail = Boolean(client?.email);
  const blacklisted = Boolean(client?.isBlacklisted);

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending || blacklisted) return;
    const ok = await onSend(body, channel);
    if (ok) {
      setDraftFor({ id: conversationId, text: '' });
      setQuickOpen(false);
    }
  };

  return (
    <section className="msg-chat" data-empty={!detail || undefined}>
      {loading && !detail && (
        <div className="msg-chat__loading">
          <span className="skeleton" style={{ height: 46, width: '62%' }} />
          <span className="skeleton" style={{ height: 46, width: '48%', alignSelf: 'flex-end' }} />
          <span className="skeleton" style={{ height: 46, width: '56%' }} />
        </div>
      )}

      {!loading && !detail && (
        <div className="msg-chat__placeholder">
          <span className="msg-chat__placeholder-icon">
            <MessageSquare />
          </span>
          <b>Выберите диалог</b>
          <span>Переписка с клиентом откроется здесь — история, вложения и быстрые ответы под рукой.</span>
        </div>
      )}

      {detail && client && (
        <>
          <header className="msg-chat__head">
            <button type="button" className="btn btn--icon btn--ghost msg-chat__back" onClick={onBack} aria-label="Назад">
              <ArrowLeft />
            </button>
            <span className="msg-chat__avatar avatar avatar--soft" aria-hidden>
              {initials(client.name)}
              {client.isVip && (
                <i className="msg-row__vip">
                  <Star />
                </i>
              )}
            </span>
            <div className="msg-chat__who">
              <b>
                {client.name}
                {client.isVip && <span className="msg-chat__tag">VIP</span>}
                {blacklisted && (
                  <span className="msg-chat__tag msg-chat__tag--danger">
                    <Ban /> в чёрном списке
                  </span>
                )}
              </b>
              <span>
                {channel === 'email' ? <Mail /> : <Send />}
                {channel === 'email' ? client.email : client.telegram ? `@${client.telegram.replace('@', '')}` : 'Telegram'}
              </span>
            </div>
            <button
              type="button"
              className="btn btn--bordered btn--sm msg-chat__profile"
              onClick={() => onOpenClient(client.id)}
            >
              <UserRound /> <span>Карточка</span>
            </button>
          </header>

          <div className="msg-chat__scroll" ref={scrollRef}>
            {groups.map((group) => (
              <div className="msg-day" key={group.day}>
                <span className="msg-day__label">{group.day}</span>
                {group.items.map((message) => {
                  if (message.direction === 'system') {
                    return (
                      <div className="msg-sys" key={message.id}>
                        <Sparkles />
                        <span>{message.body}</span>
                      </div>
                    );
                  }
                  const out = message.direction === 'out';
                  return (
                    <div className="msg-bubble-wrap" key={message.id} data-out={out || undefined}>
                      <div className="msg-bubble" data-out={out || undefined}>
                        {message.subject && <b className="msg-bubble__subject">{message.subject}</b>}
                        <p>{message.body}</p>
                        <span className="msg-bubble__meta">
                          {message.channel === 'email' ? <Mail /> : null}
                          {formatTimeIn(message.createdAt, timezone)}
                          {out && <CheckCheck />}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {detail.bookings.length > 0 && (
              <div className="msg-context">
                <span className="msg-context__title">
                  <CalendarDays /> Записи клиента
                </span>
                <div className="msg-context__list">
                  {detail.bookings.slice(0, 3).map((booking) => (
                    <button
                      key={booking.id}
                      type="button"
                      className="msg-booking"
                      onClick={() => onOpenBooking(booking.code)}
                    >
                      <span className="msg-booking__date">
                        <b>{booking.localDate.slice(8, 10)}</b>
                        <em>
                          {new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: 'UTC' })
                            .format(new Date(`${booking.localDate}T00:00:00.000Z`))
                            .replace('.', '')}
                        </em>
                      </span>
                      <span className="msg-booking__main">
                        <b>{booking.service}</b>
                        <em>{formatMoney(booking.price, currencySymbol, decimalSeparator)}</em>
                      </span>
                      <BookingStatusPill status={booking.status} size="sm" />
                      <ChevronRight />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="msg-chat__error" role="alert">
              <TriangleAlert /> {error}
            </div>
          )}

          {blacklisted ? (
            <div className="msg-chat__blocked">
              <Ban />
              <span>Клиент в чёрном списке — отправка сообщений отключена.</span>
            </div>
          ) : (
            <footer className="msg-composer">
              {quickOpen && (
                <div className="msg-quick">
                  {QUICK_REPLIES.map((text) => (
                    <button
                      key={text}
                      type="button"
                      className="msg-quick__item"
                      onClick={() => {
                        setDraft(draft ? `${draft} ${text}` : text);
                        setQuickOpen(false);
                        areaRef.current?.focus();
                      }}
                    >
                      {text}
                    </button>
                  ))}
                </div>
              )}

              <div className="msg-composer__row">
                <button
                  type="button"
                  className="btn btn--icon btn--bordered msg-composer__quick"
                  onClick={() => setQuickOpen((value) => !value)}
                  aria-label="Быстрые ответы"
                  aria-expanded={quickOpen}
                >
                  <Zap />
                </button>
                <textarea
                  ref={areaRef}
                  className="msg-composer__input"
                  rows={1}
                  value={draft}
                  placeholder="Написать сообщение…"
                  maxLength={2000}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void submit();
                    }
                  }}
                />
                <button
                  type="button"
                  className={`btn btn--primary msg-composer__send${sending ? ' btn--loading' : ''}`}
                  onClick={() => void submit()}
                  disabled={sending || !draft.trim()}
                  aria-label="Отправить сообщение"
                >
                  <Send />
                </button>
              </div>

              <div className="msg-composer__foot">
                <div className="msg-channel" role="group" aria-label="Канал отправки">
                  <button
                    type="button"
                    className="msg-channel__btn"
                    data-active={channel === 'telegram' || undefined}
                    onClick={() => setChannel('telegram')}
                  >
                    <Send /> Telegram
                  </button>
                  <button
                    type="button"
                    className="msg-channel__btn"
                    data-active={channel === 'email' || undefined}
                    disabled={!canEmail}
                    onClick={() => setChannel('email')}
                  >
                    <Mail /> Почта
                  </button>
                </div>
                <span className="msg-composer__hint">
                  <Check /> Enter — отправить, Shift + Enter — новая строка
                </span>
              </div>
            </footer>
          )}
        </>
      )}
    </section>
  );
}
