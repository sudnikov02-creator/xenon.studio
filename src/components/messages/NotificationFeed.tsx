import { Bell, CalendarDays, CheckCheck, ChevronRight, MessageSquare, Sparkles, Star } from 'lucide-react';
import { relativeTime } from '../../lib/utils';
import type { NotificationFeedPayload, NotificationItem } from '../../types';

const KINDS = [
  { id: 'all', label: 'Все', icon: Bell },
  { id: 'booking', label: 'Записи', icon: CalendarDays },
  { id: 'message', label: 'Сообщения', icon: MessageSquare },
  { id: 'review', label: 'Отзывы', icon: Star },
  { id: 'system', label: 'Системные', icon: Sparkles }
] as const;

const KIND_ICON = {
  booking: CalendarDays,
  message: MessageSquare,
  review: Star,
  system: Sparkles
} as const;

export function NotificationFeed({
  data,
  loading,
  kind,
  onKind,
  filter,
  onFilter,
  onOpen,
  onReadAll,
  marking
}: {
  data: NotificationFeedPayload | null;
  loading: boolean;
  kind: string;
  onKind: (value: string) => void;
  filter: 'all' | 'unread';
  onFilter: (value: 'all' | 'unread') => void;
  onOpen: (item: NotificationItem) => void;
  onReadAll: () => void;
  marking: boolean;
}) {
  const items = data?.items || [];
  const counts = data?.counts;

  return (
    <div className="feed">
      <div className="feed__bar">
        <div className="feed__kinds" role="tablist" aria-label="Тип уведомлений">
          {KINDS.map((item) => {
            const Icon = item.icon;
            const count = item.id === 'all' ? counts?.all : counts?.byKind?.[item.id];
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={kind === item.id}
                className="feed__kind"
                data-active={kind === item.id || undefined}
                onClick={() => onKind(item.id)}
              >
                <Icon />
                {item.label}
                {count ? <b>{count}</b> : null}
              </button>
            );
          })}
        </div>

        <div className="feed__actions">
          <div className="msg-channel" role="group" aria-label="Показать">
            <button
              type="button"
              className="msg-channel__btn"
              data-active={filter === 'all' || undefined}
              onClick={() => onFilter('all')}
            >
              Все
            </button>
            <button
              type="button"
              className="msg-channel__btn"
              data-active={filter === 'unread' || undefined}
              onClick={() => onFilter('unread')}
            >
              Непрочитанные
            </button>
          </div>
          <button
            type="button"
            className={`btn btn--bordered btn--sm${marking ? ' btn--loading' : ''}`}
            onClick={onReadAll}
            disabled={marking || !counts?.unread}
          >
            <CheckCheck /> Прочитать все
          </button>
        </div>
      </div>

      {loading && items.length === 0 && (
        <div className="feed__list">
          {Array.from({ length: 5 }).map((_, index) => (
            <span className="skeleton feed__skeleton" key={index} />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="bookings-empty">
          <span className="bookings-empty__icon">
            <Bell />
          </span>
          <b>{filter === 'unread' ? 'Всё прочитано' : 'Уведомлений пока нет'}</b>
          <span>Новые заявки, сообщения и напоминания появятся здесь автоматически.</span>
        </div>
      )}

      {items.length > 0 && (
        <div className="feed__list">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind as keyof typeof KIND_ICON] || Bell;
            return (
              <button
                key={item.id}
                type="button"
                className="feed-item"
                data-kind={item.kind}
                data-unread={!item.isRead || undefined}
                onClick={() => onOpen(item)}
              >
                <span className="feed-item__icon">
                  <Icon />
                </span>
                <span className="feed-item__main">
                  <span className="feed-item__title">
                    {!item.isRead && <i className="feed-item__dot" aria-hidden />}
                    {item.title}
                  </span>
                  {item.subtitle && <span className="feed-item__text">{item.subtitle}</span>}
                  <span className="feed-item__meta">
                    {relativeTime(item.createdAt)}
                    {item.actionLabel && <em>{item.actionLabel}</em>}
                  </span>
                </span>
                <span className="feed-item__go">
                  <ChevronRight />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
