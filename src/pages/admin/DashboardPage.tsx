import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  Inbox,
  MessageSquare,
  Settings,
  Sparkles,
  UserRound,
  Wifi,
  WifiOff
} from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../context/RealtimeContext';
import { useSettings } from '../../context/SettingsContext';
import { useCountUp } from '../../hooks/useCountUp';
import { formatDate, greeting } from '../../lib/utils';

const READY = [
  'Вход фотографа с защищённой сессией',
  'Каркас панели: сайдбар, шапка, мобильная навигация',
  'Подменю с анимированным переходом',
  'Уведомления и тосты с действиями',
  'Живое обновление данных без перезагрузки',
  'PWA: установка и офлайн-страница'
];

function MetricCard({
  icon: Icon,
  value,
  label,
  hint,
  tone,
  showNumber = true,
  onClick
}: {
  icon: ComponentType<{ className?: string }>;
  value: number | string;
  label: string;
  hint: string;
  tone: 'accent' | 'info' | 'warning' | 'success';
  showNumber?: boolean;
  onClick?: () => void;
}) {
  const count = useCountUp(typeof value === 'number' ? value : 0);
  return (
    <button
      type="button"
      className="metric card card--lift"
      onClick={onClick}
      style={{ textAlign: 'left', cursor: onClick ? 'pointer' : 'default' }}
    >
      <span className="metric__top">
        <span className="metric__icon" data-tone={tone}>
          <Icon />
        </span>
        <span className="badge badge--outline metric__badge">
          <span className="badge__dot" style={{ background: tone === 'success' ? 'var(--success)' : 'var(--accent)' }} />
          в реальном времени
        </span>
      </span>
      <span className="metric__value tnum">{showNumber ? Math.round(count) : value}</span>
      <span className="metric__label">{label}</span>
      <span className="metric__hint">{hint}</span>
    </button>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { badges, connected } = useRealtime();
  const { branding } = useSettings();
  const navigate = useNavigate();

  const today = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });
  const name = (user?.name || branding.photographerName || '').split(' ')[0];

  return (
    <div className="page">
      <PageHead
        title={`${greeting()}, ${name}`}
        subtitle={`${today.charAt(0).toUpperCase() + today.slice(1)} · ${branding.brandTagline}`}
        actions={
          <span className={`live-pill ${connected ? 'is-online' : ''}`}>
            {connected ? <Wifi /> : <WifiOff />}
            {connected ? 'На связи' : 'Подключение'}
          </span>
        }
        badge={<span className="badge badge--accent">Этап 1</span>}
      />

      <div className="stat-grid">
        <MetricCard
          icon={Inbox}
          value={badges.pendingBookings}
          label="Заявки в ожидании"
          hint="Появятся в разделе «Записи»"
          tone="accent"
          onClick={() => navigate('/admin/bookings')}
        />
        <MetricCard
          icon={MessageSquare}
          value={badges.unreadMessages}
          label="Непрочитанные сообщения"
          hint="Диалоги с клиентами"
          tone="info"
          onClick={() => navigate('/admin/messages')}
        />
        <MetricCard
          icon={BellRing}
          value={badges.unreadNotifications}
          label="Новые уведомления"
          hint="События студии"
          tone="warning"
          onClick={() => navigate('/admin/activity')}
        />
        <MetricCard
          icon={connected ? Wifi : WifiOff}
          value={connected ? 'онлайн' : '…'}
          label="Канал данных"
          hint="SSE · мгновенные обновления"
          tone="success"
          showNumber={false}
        />
      </div>

      <div className="grid-2">
        <section className="card card--pad">
          <div className="section-head">
            <div>
              <div className="panel-title">Каркас студии готов</div>
              <div className="panel-sub">Основа, на которой соберутся все разделы</div>
            </div>
            <span className="badge badge--success">{READY.length} из {READY.length}</span>
          </div>
          <div className="checklist">
            {READY.map((item) => (
              <div className="checklist__item" key={item}>
                <span className="checklist__dot">
                  <Check />
                </span>
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="card card--pad next-card">
          <div className="section-head">
            <div>
              <div className="panel-title">Дальше — дашборд с виджетами</div>
              <div className="panel-sub">Метрики, запись на сегодня и график дохода</div>
            </div>
            <span className="next-card__icon">
              <Sparkles />
            </span>
          </div>

          <div className="widget-preview" aria-hidden="true">
            <div className="widget-preview__row">
              {[0, 1, 2, 3].map((index) => (
                <div className="widget-preview__metric" key={index}>
                  <span className="skeleton" style={{ width: 26, height: 26, borderRadius: 9 }} />
                  <span className="skeleton" style={{ width: '68%', height: 18, marginTop: 10 }} />
                  <span className="skeleton" style={{ width: '46%', height: 9, marginTop: 8 }} />
                </div>
              ))}
            </div>
            <div className="widget-preview__row widget-preview__row--two">
              <div className="widget-preview__panel">
                <span className="skeleton" style={{ width: '40%', height: 10 }} />
                {[0, 1, 2].map((index) => (
                  <div key={index} className="widget-preview__line">
                    <span className="skeleton" style={{ width: 22, height: 22, borderRadius: 7 }} />
                    <span className="skeleton" style={{ flex: 1, height: 9 }} />
                    <span className="skeleton" style={{ width: 44, height: 9 }} />
                  </div>
                ))}
              </div>
              <div className="widget-preview__panel">
                <span className="skeleton" style={{ width: '52%', height: 10 }} />
                <div className="widget-preview__bars">
                  {[42, 66, 34, 78, 56, 88, 48].map((height, index) => (
                    <span key={index} style={{ height: `${height}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <p className="next-card__note">
            Виджеты можно будет переставлять перетаскиванием, скрывать и настраивать под себя.
          </p>
        </section>
      </div>

      <section className="card card--pad quick-links">
        <div className="section-head" style={{ marginBottom: 12 }}>
          <div className="panel-title">Быстрые переходы</div>
          <span className="panel-sub">Настройте студию под себя</span>
        </div>
        <div className="quick-links__grid">
          <button type="button" className="quick-link" onClick={() => navigate('/admin/settings/profile')}>
            <span className="quick-link__icon"><UserRound /></span>
            <span>
              <b>Профиль</b>
              <em>Имя, email и пароль</em>
            </span>
            <ArrowRight />
          </button>
          <button type="button" className="quick-link" onClick={() => navigate('/admin/settings/schedule')}>
            <span className="quick-link__icon"><CalendarDays /></span>
            <span>
              <b>Расписание</b>
              <em>Часы работы и слоты</em>
            </span>
            <ArrowRight />
          </button>
          <button type="button" className="quick-link" onClick={() => navigate('/admin/settings/appearance')}>
            <span className="quick-link__icon"><Settings /></span>
            <span>
              <b>Внешний вид</b>
              <em>Акцентный цвет и логотип</em>
            </span>
            <ArrowRight />
          </button>
        </div>
      </section>
    </div>
  );
}
