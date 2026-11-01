import { Ban, CheckCheck, Mail, MessageSquare, Search, Send, Star, X } from 'lucide-react';
import { initials, relativeTime } from '../../lib/utils';
import type { ConversationSummary, MessageChannel } from '../../types';

const CHANNEL_ICON: Record<MessageChannel, typeof Send> = {
  telegram: Send,
  email: Mail,
  whatsapp: MessageSquare,
  sms: MessageSquare
};

const CHANNEL_LABEL: Record<MessageChannel, string> = {
  telegram: 'Telegram',
  email: 'Почта',
  whatsapp: 'WhatsApp',
  sms: 'SMS'
};

export function ConversationList({
  items,
  activeId,
  loading,
  query,
  onQuery,
  filter,
  onFilter,
  counts,
  onOpen
}: {
  items: ConversationSummary[];
  activeId: number | null;
  loading: boolean;
  query: string;
  onQuery: (value: string) => void;
  filter: string;
  onFilter: (value: string) => void;
  counts: { all: number; unread: number; unanswered: number };
  onOpen: (item: ConversationSummary) => void;
}) {
  return (
    <div className="msg-list">
      <div className="msg-list__search">
        <label className="input-wrap">
          <Search aria-hidden />
          <input
            className="input"
            type="search"
            value={query}
            placeholder="Имя, телефон, сообщение"
            aria-label="Поиск по сообщениям"
            onChange={(event) => onQuery(event.target.value)}
          />
          {query && (
            <button type="button" className="input-wrap__action" aria-label="Очистить" onClick={() => onQuery('')}>
              <X />
            </button>
          )}
        </label>
      </div>

      <div className="msg-filters" role="tablist" aria-label="Фильтр диалогов">
        {[
          { id: 'all', label: 'Все', count: counts.all },
          { id: 'unread', label: 'Непрочитанные', count: counts.unread },
          { id: 'unanswered', label: 'Ждут ответа', count: counts.unanswered }
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={filter === item.id}
            className="msg-filter"
            data-active={filter === item.id || undefined}
            onClick={() => onFilter(item.id)}
          >
            {item.label}
            {item.count > 0 && <b>{item.count}</b>}
          </button>
        ))}
      </div>

      <div className="msg-list__items" data-loading={loading || undefined}>
        {items.length === 0 && !loading && (
          <div className="msg-list__empty">
            <MessageSquare />
            <b>{query ? 'Ничего не найдено' : 'Диалогов пока нет'}</b>
            <span>
              {query
                ? 'Попробуйте другое имя или телефон.'
                : 'Сообщения появятся, когда клиент напишет в Telegram или на почту.'}
            </span>
          </div>
        )}

        {items.map((item) => {
          const Icon = CHANNEL_ICON[item.channel];
          const last = item.lastMessage;
          const preview = last ? (last.direction === 'out' ? `Вы: ${last.body}` : last.body) : 'Диалог создан';
          return (
            <button
              key={item.id}
              type="button"
              className="msg-row"
              data-active={activeId === item.id || undefined}
              data-unread={item.unread > 0 || undefined}
              onClick={() => onOpen(item)}
            >
              <span className="msg-row__avatar avatar avatar--soft" aria-hidden>
                {initials(item.client?.name || 'К')}
                {item.client?.isVip && (
                  <i className="msg-row__vip">
                    <Star />
                  </i>
                )}
              </span>
              <span className="msg-row__main">
                <span className="msg-row__top">
                  <b>{item.client?.name}</b>
                  <em>{item.lastMessageAt ? relativeTime(item.lastMessageAt) : ''}</em>
                </span>
                <span className="msg-row__bottom">
                  <span className="msg-row__preview" data-out={last?.direction === 'out' || undefined}>
                    {last?.direction === 'out' && <CheckCheck />}
                    {last?.direction === 'system' && <MessageSquare />}
                    {preview}
                  </span>
                  <span className="msg-row__meta">
                    {item.client?.isBlacklisted && (
                      <i className="msg-row__flag" title="Чёрный список">
                        <Ban />
                      </i>
                    )}
                    <i className="msg-row__channel" title={CHANNEL_LABEL[item.channel]}>
                      <Icon />
                    </i>
                    {item.unread > 0 && <b className="msg-row__unread">{item.unread}</b>}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
