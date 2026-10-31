import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { formatMoney, formatMonthTitle } from '../../lib/utils';
import type { RevenueData } from '../../types';

export function RevenueWidget({ revenue, config }: { revenue: RevenueData | null; config: Record<string, boolean> }) {
  const { branding } = useSettings();
  const compare = config.compare !== false;

  if (!revenue) {
    return <div className="revenue revenue--loading" />;
  }

  const delta = revenue.previousTotal
    ? Math.round(((revenue.total - revenue.previousTotal) / revenue.previousTotal) * 100)
    : revenue.total > 0
      ? 100
      : 0;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const TrendIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const max = Math.max(1, ...revenue.weeks.map((week) => Math.max(week.current, compare ? week.previous : 0)));
  const money = (value: number) => formatMoney(value, branding.currencySymbol, branding.decimalSeparator);

  return (
    <div className="revenue">
      <div className="revenue__top">
        <div>
          <div className="revenue__total tnum">{money(revenue.total)}</div>
          <div className="revenue__caption">за {formatMonthTitle(revenue.month).toLowerCase()}</div>
        </div>
        <span className="trend-badge" data-dir={direction}>
          <TrendIcon />
          {delta > 0 ? '+' : ''}
          {delta}%
        </span>
      </div>

      <div className="revenue__legend">
        <span>
          <i className="revenue__swatch" /> этот месяц
        </span>
        {compare && (
          <span>
            <i className="revenue__swatch revenue__swatch--prev" /> прошлый
          </span>
        )}
      </div>

      <div className="revenue__chart" role="img" aria-label={`Доход по неделям: ${money(revenue.total)}`}>
        {revenue.weeks.map((week, index) => {
          const currentHeight = Math.max(3, Math.round((week.current / max) * 100));
          const previousHeight = Math.max(3, Math.round((week.previous / max) * 100));
          return (
            <div className="revenue__col" key={week.label}>
              <div className="revenue__bars">
                {compare && (
                  <span
                    className="revenue__bar revenue__bar--prev"
                    style={{ height: `${previousHeight}%`, animationDelay: `${index * 45}ms` }}
                  />
                )}
                <span
                  className="revenue__bar"
                  style={{ height: `${currentHeight}%`, animationDelay: `${90 + index * 45}ms` }}
                />
              </div>
              <span className="revenue__label">{week.label}</span>
              <div className="revenue__tip">
                <b>{money(week.current)}</b>
                <span>{week.label} число</span>
                {compare && <em>прошлый: {money(week.previous)}</em>}
              </div>
            </div>
          );
        })}
      </div>

      {revenue.total === 0 && (
        <div className="revenue__empty">
          <TrendingUp />
          В этом месяце пока нет дохода — данные появятся с первыми записями.
        </div>
      )}
    </div>
  );
}
