import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  CircleDollarSign,
  Clock3,
  Crown,
  Gift,
  Minus,
  Percent,
  RefreshCw,
  Ticket,
  TrendingUp,
  TriangleAlert,
  UserPlus,
  Users,
  Wallet
} from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { useCountUp } from '../../hooks/useCountUp';
import { useSettings } from '../../context/SettingsContext';
import { useRealtime } from '../../context/RealtimeContext';
import { api, ApiError } from '../../lib/api';
import { formatMoney, plural } from '../../lib/utils';
import type { AnalyticsPayload } from '../../types';

type IconType = typeof TrendingUp;

interface MetricSpec {
  id: string;
  label: string;
  value: number;
  trend: number | null;
  kind: 'money' | 'count' | 'percent';
  icon: IconType;
  tone: string;
  hint: string;
}

function ReadMetric({
  spec,
  currency,
  separator
}: {
  spec: MetricSpec;
  currency: string;
  separator: 'comma' | 'dot';
}) {
  const animated = useCountUp(spec.value, 850);
  const display =
    spec.kind === 'money'
      ? formatMoney(animated, currency, separator)
      : spec.kind === 'percent'
        ? `${Math.round(animated)} %`
        : Math.round(animated).toLocaleString('ru-RU');

  const trend = spec.trend;
  const direction = trend === null || trend === 0 ? 'flat' : trend > 0 ? 'up' : 'down';
  const TrendIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const trendLabel = trend === null ? '—' : `${trend > 0 ? '+' : trend < 0 ? '−' : ''}${Math.abs(Math.round(trend))}%`;

  return (
    <article className="acard card card--lift">
      <div className="acard__top">
        <span className="acard__icon" data-tone={spec.tone}>
          <spec.icon />
        </span>
        <span className="trend-badge" data-dir={direction} title="к предыдущему периоду">
          <TrendIcon />
          {trendLabel}
        </span>
      </div>
      <div className="acard__value tnum">{display}</div>
      <div className="acard__label">{spec.label}</div>
      <div className="acard__foot">{spec.hint}</div>
    </article>
  );
}

export function AnalyticsPage() {
  const { branding } = useSettings();
  const { subscribe } = useRealtime();

  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const payload = await api.get<AnalyticsPayload>(`/analytics?period=${period}`);
        setData(payload);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить аналитику');
      } finally {
        setLoading(false);
      }
    },
    [period]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const off = subscribe('booking', () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(true), 400);
    });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      off();
    };
  }, [subscribe, load]);

  const symbol = data?.currency.symbol || branding.currencySymbol;
  const separator = data?.currency.separator || branding.decimalSeparator;
  const money = useCallback(
    (value: number) => formatMoney(value, symbol, separator),
    [symbol, separator]
  );

  const metrics: MetricSpec[] = useMemo(() => {
    if (!data) return [];
    const m = data.metrics;
    return [
      {
        id: 'revenue',
        label: 'Выручка',
        value: m.revenue,
        trend: m.revenueTrend,
        kind: 'money',
        icon: CircleDollarSign,
        tone: 'blue',
        hint: `${m.paid} ${plural(m.paid, 'оплаченная запись', 'оплаченные записи', 'оплаченных записей')}`
      },
      {
        id: 'bookings',
        label: 'Записей',
        value: m.bookings,
        trend: m.bookingsTrend,
        kind: 'count',
        icon: CalendarCheck,
        tone: 'violet',
        hint: `${Math.round(m.hours)} ${plural(Math.round(m.hours), 'час', 'часа', 'часов')} съёмок`
      },
      {
        id: 'avg',
        label: 'Средний чек',
        value: m.avgCheck,
        trend: m.avgCheckTrend,
        kind: 'money',
        icon: Wallet,
        tone: 'green',
        hint: 'выручка на одну запись'
      },
      {
        id: 'load',
        label: 'Загрузка',
        value: m.load,
        trend: null,
        kind: 'percent',
        icon: TrendingUp,
        tone: 'amber',
        hint: 'от рабочих часов графика'
      },
      {
        id: 'new',
        label: 'Новые клиенты',
        value: m.newClients,
        trend: null,
        kind: 'count',
        icon: UserPlus,
        tone: 'blue',
        hint: `${m.returning} ${plural(m.returning, 'вернулся', 'вернулись', 'вернулись')} повторно`
      },
      {
        id: 'cancel',
        label: 'Отмены',
        value: m.cancelRate,
        trend: null,
        kind: 'percent',
        icon: Percent,
        tone: m.cancelRate > 15 ? 'rose' : 'slate',
        hint: `${m.cancelled} ${plural(m.cancelled, 'отменённая запись', 'отменённые записи', 'отменённых записей')}`
      }
    ];
  }, [data]);

  const maxBar = Math.max(1, data?.maxRevenue || 0);
  const totalTop = data?.topItems.reduce((sum, item) => sum + item.count, 0) || 0;

  return (
    <div className="page an-page">
      <PageHead
        title="Аналитика"
        subtitle={
          data
            ? `${money(data.metrics.revenue)} за период · ${data.metrics.bookings} ${plural(
                data.metrics.bookings,
                'запись',
                'записи',
                'записей'
              )} · загрузка ${Math.round(data.metrics.load)} %`
            : 'Считаем показатели'
        }
        actions={
          <button type="button" className="btn btn--icon btn--bordered" onClick={() => void load()} aria-label="Обновить">
            <RefreshCw />
          </button>
        }
      />

      <div className="an-periods" role="tablist" aria-label="Период">
        {(data?.periods || [
          { id: '7d', label: '7 дней' },
          { id: '30d', label: '30 дней' },
          { id: '90d', label: '90 дней' },
          { id: '365d', label: 'Год' }
        ]).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={period === item.id}
            className="an-period"
            data-active={period === item.id || undefined}
            onClick={() => setPeriod(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && !loading && (
        <div className="cal-error" role="alert">
          <TriangleAlert /> <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="an-cards">
          {Array.from({ length: 6 }).map((_, index) => (
            <div className="skeleton an-skeleton" key={index} />
          ))}
        </div>
      )}

      {data && (
        <>
          <div className="an-cards">
            {metrics.map((spec) => (
              <ReadMetric key={spec.id} spec={spec} currency={symbol} separator={separator} />
            ))}
          </div>

          <div className="an-grid">
            <section className="card an-chart">
              <div className="an-chart__head">
                <div>
                  <h3>
                    <BarChart3 /> Выручка по {data.bucket === 'day' ? 'дням' : data.bucket === 'week' ? 'неделям' : 'месяцам'}
                  </h3>
                  <p>Максимум {money(maxBar)}</p>
                </div>
                <span className="an-chart__legend">
                  <i /> выручка
                </span>
              </div>

              <div className="an-bars" style={{ ['--bars' as string]: data.series.length }}>
                {data.series.map((point) => (
                  <div className="an-bar" key={point.key} title={`${point.label}: ${money(point.revenue)} · ${point.bookings} записей`}>
                    <span className="an-bar__value tnum">{point.revenue > 0 ? money(point.revenue) : ''}</span>
                    <span className="an-bar__track">
                      <span
                        className="an-bar__fill"
                        style={{ height: `${Math.max(point.revenue > 0 ? 4 : 0, (point.revenue / maxBar) * 100)}%` }}
                      />
                    </span>
                    <span className="an-bar__label">{point.label}</span>
                  </div>
                ))}
                {data.series.length === 0 && <span className="an-empty">За этот период записей не было</span>}
              </div>
            </section>

            <section className="card an-panel">
              <h3>
                <Gift /> Скидки и бонусы
              </h3>
              <div className="an-promo">
                <div className="an-promo__row">
                  <span>
                    <Ticket /> Промокоды
                  </span>
                  <b className="tnum">{money(data.promo.coupons.amount)}</b>
                  <em>
                    {data.promo.coupons.count} {plural(data.promo.coupons.count, 'применение', 'применения', 'применений')}
                  </em>
                </div>
                <div className="an-promo__row">
                  <span>
                    <Gift /> Сертификаты
                  </span>
                  <b className="tnum">{money(data.promo.certificates.amount)}</b>
                  <em>
                    {data.promo.certificates.count}{' '}
                    {plural(data.promo.certificates.count, 'погашение', 'погашения', 'погашений')}
                  </em>
                </div>
                <div className="an-promo__row">
                  <span>
                    <Percent /> Бонусы списано
                  </span>
                  <b className="tnum">{money(data.promo.bonusSpent)}</b>
                  <em>баллами клиентов</em>
                </div>
              </div>
              <div className="an-promo__total">
                <span>Скидки за период</span>
                <b className="tnum">{money(data.promo.saved || data.metrics.discounts)}</b>
              </div>
            </section>
          </div>

          <div className="an-grid an-grid--three">
            <section className="card an-panel">
              <h3>
                <TrendingUp /> Услуги и пакеты
              </h3>
              {data.topItems.length === 0 ? (
                <span className="an-empty">Пока нет данных</span>
              ) : (
                <ul className="an-rank">
                  {data.topItems.map((item) => (
                    <li key={item.name}>
                      <div className="an-rank__top">
                        <b>{item.name}</b>
                        <span className="tnum">{money(item.revenue)}</span>
                      </div>
                      <div className="an-rank__track">
                        <span style={{ width: `${Math.max(3, totalTop ? (item.count / totalTop) * 100 : 0)}%` }} />
                      </div>
                      <div className="an-rank__meta">
                        <span>
                          {item.count} {plural(item.count, 'запись', 'записи', 'записей')}
                        </span>
                        <span>{Math.round(item.minutes / 60)} ч · {Math.round(item.share)} % выручки</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card an-panel">
              <h3>
                <Users /> Постоянные клиенты
              </h3>
              {data.topClients.length === 0 ? (
                <span className="an-empty">Пока нет данных</span>
              ) : (
                <ul className="an-clients">
                  {data.topClients.map((client, index) => (
                    <li key={client.id}>
                      <span className="an-clients__rank">{index + 1}</span>
                      <span className="an-clients__name">
                        {client.name}
                        {client.isVip && <Crown aria-label="VIP" />}
                      </span>
                      <span className="an-clients__meta">
                        {client.count} {plural(client.count, 'съёмка', 'съёмки', 'съёмок')}
                      </span>
                      <b className="tnum">{money(client.revenue)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card an-panel">
              <h3>
                <Clock3 /> Статусы и источники
              </h3>
              <div className="an-statuses">
                {data.statuses.map((status) => (
                  <div className="an-status" key={status.name}>
                    <span className="an-status__dot" style={{ background: status.color }} />
                    <span className="an-status__name">{status.name}</span>
                    <b className="tnum">{status.count}</b>
                  </div>
                ))}
                {data.statuses.length === 0 && <span className="an-empty">Пока нет данных</span>}
              </div>
              <div className="an-sources">
                {data.sources.map((source) => (
                  <span className="an-source" key={source.id}>
                    {source.label}
                    <b className="tnum">{source.count}</b>
                  </span>
                ))}
              </div>
            </section>
          </div>

          <p className="an-note">
            Новые клиенты — те, чья первая запись попала в период. Загрузка считается от рабочих часов графика за выбранный
            период.
          </p>
        </>
      )}
    </div>
  );
}
