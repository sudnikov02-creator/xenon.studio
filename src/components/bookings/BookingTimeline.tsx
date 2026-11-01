import {
  CalendarClock,
  CalendarPlus,
  CircleDot,
  MessageSquare,
  StickyNote,
  XCircle,
  type LucideIcon
} from 'lucide-react';
import { formatDayTime, relativeTime } from '../../lib/utils';
import type { BookingEventItem } from '../../types';

const ICONS: Record<string, LucideIcon> = {
  created: CalendarPlus,
  status: CircleDot,
  reschedule: CalendarClock,
  cancel: XCircle,
  note: StickyNote,
  message: MessageSquare
};

const ACTORS: Record<string, string> = {
  client: 'Клиент',
  photographer: 'Фотограф',
  system: 'Система'
};

export function BookingTimeline({ events, timezone }: { events: BookingEventItem[]; timezone: string }) {
  if (events.length === 0) {
    return <p className="bd-empty-note">Событий пока нет — история появится после первого действия.</p>;
  }

  return (
    <ol className="btl">
      {events.map((event, index) => {
        const Icon = ICONS[event.type] || CircleDot;
        const last = index === events.length - 1;
        return (
          <li className="btl__item" data-type={event.type} key={event.id ?? index}>
            <span className="btl__dot" aria-hidden>
              <Icon />
            </span>
            <div className="btl__body">
              <b>{event.title}</b>
              {event.message && <p>{event.message}</p>}
              <span className="btl__meta">
                {formatDayTime(event.createdAt, timezone)} · {ACTORS[event.actor] || event.actor} ·{' '}
                {relativeTime(event.createdAt)}
              </span>
            </div>
            {!last && <span className="btl__line" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
