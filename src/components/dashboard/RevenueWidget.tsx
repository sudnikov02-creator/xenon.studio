import { ArrowDownRight, ArrowUpRight, ChartNoAxesColumn, Minus } from 'lucide-react';
import { formatMoney, formatMonthTitle, plural } from '../../lib/utils';
import type { RevenueData } from '../../types';

export function RevenueWidget({
  revenue,
  currencySymbol,
  decimalSeparator,
  compare
}: {
  revenue: RevenueData | null;
  currencySymbol: string;
  decimalSeparator: 'comma' | 'dot';
  compare: boolean;
}) {
  if (!revenue) {
    return (
      <div className="revenue">
        <span className="skeleton" style={{ height: 30, width: '48%' }} />
        <span className="skeleton" style={{ height: 132, marginTop: 18, borderRadius: 12 }} />
      </div>
    );
  }

  const max = Math.max(
    1,
    ...revenue.weeks.map((week) => Math.max(week.current, compare ? week.previous : 0))
  );
  const delta = revenue.previousTotal > 0 ? Math.round(((revenue.total - revenue.previousTotal) / revenue.previousTotal) * 100) : revenue.total > 0 ? 100 : 0;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const TrendIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;

  return (
    <div className="revenue">
      <div className="revenue__top">
        <div>
          <div className="revenue__total tnum">{formatMoney(revenue.total, currencySymbol, decimalSeparator)}</div>
          <div className="revenue__caption">за {formatMonthTitle(revenue.month).toLowerCase()}</div>
        </div>
        <span className="trend-badge" data-dir={direction}>
          <TrendIcon />
          {delta > 0 ? '+' : delta < 0 ? '-' : ''}
          {Math.min(999, Math.abs(delta))}%
        </span>
      </div>

      <div className="revenue__legend">
        <span>
          <i className="revenue__legend-dot" /> Этот месяц
        </span>
        {compare && (
          <span>
            <i className="revenue__legend-dot revenue__legend-dot--muted" /> Прошлый
          </span>
        )}
        <span className="revenue__legend-count">
          {revenue.bookingCount} {plural(revenue.bookingCount, 'съёмка', 'съёмки', 'съёмок')}
        </span>
      </div>

      <div className="revenue__chart" role="img" aria-label={`Доход по неделям: ${formatMoney(revenue.total, currencySymbol, decimalSeparator)}`}>
        {revenue.weeks.map((week, index) => (
          <div className="revenue__col" key={week.label}>
            <div className="revenue__bars">
              {compare && (
                <span
                  className="revenue__bar revenue__bar--muted"
                  style={{ height: `${Math.max(2, (week.previous / max) * 100)}%`, animationDelay: `${index * 45}ms` }}
                >
                  <span className="revenue__tip">
                    <b>{formatMoney(week.previous, currencySymbol, decimalSeparator)}</b>
                    <em>прошлый месяц</em>
                  </span>
                </span>
              )}
              <span
                className="revenue__bar"
                style={{ height: `${Math.max(2, (week.current / max) * 100)}%`, animationDelay: `${70 + index * 45}ms` }}
              >
                <span className="revenue__tip">
                  <b>{formatMoney(week.current, currencySymbol, decimalSeparator)}</b>
                  <em>этот месяц</em>
                </span>
              </span>
            </div>
            <span className="revenue__label">{week.label}</span>
          </div>
        ))}
      </div>

      {revenue.total === 0 && (
        <div className="revenue__empty">
          <ChartNoAxesColumn />
          <span>В этом месяце пока нет оплаченных съёмок — данные появятся после первых записей.</span>
        </div>
      )}
    </div>
  );
}
