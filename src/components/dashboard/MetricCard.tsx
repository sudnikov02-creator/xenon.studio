import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { useCountUp } from '../../hooks/useCountUp';
import { METRIC_META } from '../../lib/dashboard';
import { formatMoney } from '../../lib/utils';
import type { MetricKey, MetricValue } from '../../types';

export function MetricCard({
  metricKey,
  metric,
  currencySymbol,
  decimalSeparator
}: {
  metricKey: MetricKey;
  metric: MetricValue;
  currencySymbol: string;
  decimalSeparator: 'comma' | 'dot';
}) {
  const meta = METRIC_META[metricKey];
  const Icon = meta.icon;
  const animated = useCountUp(metric.value, 850);
  const display =
    meta.kind === 'money'
      ? formatMoney(animated, currencySymbol, decimalSeparator)
      : Math.round(animated).toLocaleString('ru-RU');

  const direction = metric.delta > 0 ? 'up' : metric.delta < 0 ? 'down' : 'flat';
  const TrendIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus;
  const cappedDelta = Math.min(999, Math.abs(metric.delta));
  const deltaLabel = `${metric.delta > 0 ? '+' : metric.delta < 0 ? '-' : ''}${cappedDelta}%`;

  return (
    <article className="mcard card card--lift">
      <div className="mcard__top">
        <span className="mcard__icon" data-tone={meta.tone}>
          <Icon />
        </span>
        <span className="trend-badge" data-dir={direction} title={`${deltaLabel} к прошлому месяцу`}>
          <TrendIcon />
          {deltaLabel}
        </span>
      </div>
      <div className="mcard__value tnum" aria-label={`${meta.label}: ${display}`}>
        {display}
      </div>
      <div className="mcard__label">{meta.label}</div>
      <div className="mcard__foot">
        к прошлому месяцу
        <span aria-hidden>·</span>
        было {meta.kind === 'money' ? formatMoney(metric.previous, currencySymbol, decimalSeparator) : metric.previous}
      </div>
    </article>
  );
}
