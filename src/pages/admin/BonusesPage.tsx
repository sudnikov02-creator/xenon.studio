import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  Coins,
  Copy,
  Gift,
  Handshake,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Trophy,
  UserPlus,
  X
} from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { Modal } from '../../components/ui/Modal';
import { Switch } from '../../components/ui/Switch';
import { useRealtime } from '../../context/RealtimeContext';
import { useToast } from '../../context/ToastContext';
import { useSettings } from '../../context/SettingsContext';
import { api, ApiError } from '../../lib/api';
import { formatDate, formatMoney, plural } from '../../lib/utils';
import type {
  BonusClient,
  BonusHistory,
  LoyaltyMode,
  LoyaltyOverview,
  LoyaltySettings,
  ReferralItem,
  ReferralListPayload
} from '../../types';

const REFERRAL_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'pending', label: 'Ожидают' },
  { id: 'rewarded', label: 'Начислено' },
  { id: 'cancelled', label: 'Отменены' }
] as const;

const STATUS_LABEL: Record<ReferralItem['status'], string> = {
  pending: 'ждём съёмку',
  rewarded: 'вознаграждение начислено',
  cancelled: 'отменена'
};

function points(value: number): string {
  return `${value > 0 ? '+' : ''}${new Intl.NumberFormat('ru-RU').format(value)}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function BonusesPage() {
  const { subscribe } = useRealtime();
  const { toast } = useToast();
  const { branding } = useSettings();

  const [overview, setOverview] = useState<LoyaltyOverview | null>(null);
  const [clients, setClients] = useState<BonusClient[]>([]);
  const [referrals, setReferrals] = useState<ReferralListPayload | null>(null);
  const [filter, setFilter] = useState<(typeof REFERRAL_FILTERS)[number]['id']>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [switching, setSwitching] = useState<LoyaltyMode | null>(null);

  const [rulesOpen, setRulesOpen] = useState(false);
  const [draft, setDraft] = useState<LoyaltySettings | null>(null);
  const [savingRules, setSavingRules] = useState(false);

  const [detail, setDetail] = useState<BonusHistory | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustBusy, setAdjustBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [inviterId, setInviterId] = useState<number | null>(null);
  const [invitedName, setInvitedName] = useState('');
  const [invitedPhone, setInvitedPhone] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const [nextOverview, nextClients] = await Promise.all([
          api.get<LoyaltyOverview>('/marketing/loyalty'),
          api.get<{ items: BonusClient[] }>('/marketing/loyalty/bonus')
        ]);
        setOverview(nextOverview);
        setClients(nextClients.items);
        setDraft((prev) => prev ?? nextOverview.settings);
        if (nextOverview.mode === 'referral') {
          const list = await api.get<ReferralListPayload>('/marketing/loyalty/referrals');
          setReferrals(list);
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Не удалось загрузить программу лояльности');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const off = subscribe('marketing', () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void load(true), 250);
    });
    return () => {
      if (timer.current) clearTimeout(timer.current);
      off();
    };
  }, [subscribe, load]);

  const mode = overview?.mode || 'bonus';

  const switchMode = async (next: LoyaltyMode) => {
    if (next === mode || switching) return;
    setSwitching(next);
    try {
      const data = await api.patch<{ settings: LoyaltySettings }>('/marketing/loyalty', { mode: next });
      setDraft(data.settings);
      await load(true);
      toast({
        title: next === 'bonus' ? 'Включены бонусы' : 'Включены рефералы',
        subtitle: next === 'bonus' ? 'Баллы начисляются за съёмки' : 'Клиенты приводят друзей по ссылке',
        variant: 'success'
      });
    } catch (err) {
      toast({
        title: 'Не удалось переключить программу',
        subtitle: err instanceof ApiError ? err.message : undefined,
        variant: 'error'
      });
    } finally {
      setSwitching(null);
    }
  };

  const saveRules = async () => {
    if (!draft) return;
    setSavingRules(true);
    try {
      const data = await api.patch<{ settings: LoyaltySettings }>('/marketing/loyalty', {
        mode: draft.mode,
        bonus: draft.bonus,
        referral: draft.referral
      });
      setDraft(data.settings);
      setRulesOpen(false);
      toast({ title: 'Правила сохранены', subtitle: 'Настройки применятся к новым записям', variant: 'success' });
      await load(true);
    } catch (err) {
      toast({
        title: 'Не удалось сохранить правила',
        subtitle: err instanceof ApiError ? err.message : undefined,
        variant: 'error'
      });
    } finally {
      setSavingRules(false);
    }
  };

  const openDetail = async (client: BonusClient) => {
    setDetailOpen(true);
    setDetail(null);
    setAdjustAmount('');
    setAdjustReason('');
    try {
      const data = await api.get<BonusHistory>(`/marketing/loyalty/bonus/${client.id}`);
      setDetail(data);
    } catch (err) {
      toast({ title: 'Не удалось открыть счёт', subtitle: err instanceof ApiError ? err.message : undefined, variant: 'error' });
      setDetailOpen(false);
    }
  };

  const adjust = async (sign: 1 | -1) => {
    if (!detail) return;
    const value = Math.abs(Math.round(Number(adjustAmount) || 0));
    if (!value) {
      toast({ title: 'Укажите количество баллов', variant: 'error' });
      return;
    }
    setAdjustBusy(true);
    try {
      await api.post(`/marketing/loyalty/bonus/${detail.client.id}/adjust`, {
        amount: sign * value,
        reason: adjustReason.trim() || (sign > 0 ? 'Начисление вручную' : 'Списание вручную')
      });
      const fresh = await api.get<BonusHistory>(`/marketing/loyalty/bonus/${detail.client.id}`);
      setDetail(fresh);
      setAdjustAmount('');
      setAdjustReason('');
      toast({
        title: sign > 0 ? 'Баллы начислены' : 'Баллы списаны',
        subtitle: `${detail.client.name} · ${points(sign * value)}`,
        variant: 'success'
      });
      await load(true);
    } catch (err) {
      toast({
        title: 'Не удалось изменить баланс',
        subtitle: err instanceof ApiError ? err.message : undefined,
        variant: 'error'
      });
    } finally {
      setAdjustBusy(false);
    }
  };

  const reloadReferrals = useCallback(async () => {
    const list = await api.get<ReferralListPayload>('/marketing/loyalty/referrals');
    setReferrals(list);
  }, []);

  const reward = async (item: ReferralItem) => {
    setBusyId(item.id);
    try {
      await api.post(`/marketing/loyalty/referrals/${item.id}/reward`, {});
      toast({
        title: 'Вознаграждение начислено',
        subtitle: `${item.inviter?.name || 'Клиент'} · ${points(item.rewardInviter)}`,
        variant: 'success'
      });
      await reloadReferrals();
      await load(true);
    } catch (err) {
      toast({ title: 'Не удалось начислить', subtitle: err instanceof ApiError ? err.message : undefined, variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const cancel = async (item: ReferralItem) => {
    setBusyId(item.id);
    try {
      await api.post(`/marketing/loyalty/referrals/${item.id}/cancel`, {});
      toast({ title: 'Рекомендация отменена', subtitle: item.invited.name, variant: 'success' });
      await reloadReferrals();
      await load(true);
    } catch (err) {
      toast({ title: 'Не удалось отменить', subtitle: err instanceof ApiError ? err.message : undefined, variant: 'error' });
    } finally {
      setBusyId(null);
    }
  };

  const createReferral = async () => {
    if (!inviterId) {
      setFormError('Выберите клиента, который рекомендует');
      return;
    }
    if (invitedName.trim().length < 2) {
      setFormError('Укажите имя приглашённого');
      return;
    }
    setCreateBusy(true);
    setFormError(null);
    try {
      await api.post('/marketing/loyalty/referrals', {
        inviterClientId: inviterId,
        invitedName: invitedName.trim(),
        invitedPhone: invitedPhone.trim(),
        note: adjustReason.trim() || undefined
      });
      setCreateOpen(false);
      setInviterId(null);
      setInvitedName('');
      setInvitedPhone('');
      toast({ title: 'Рекомендация добавлена', subtitle: 'Начислим вознаграждение после съёмки', variant: 'success' });
      await reloadReferrals();
      await load(true);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Не удалось добавить рекомендацию');
    } finally {
      setCreateBusy(false);
    }
  };

  const referralLink = (code: string | null) => {
    if (!code) return '';
    return `${window.location.origin}/booking?ref=${code}`;
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied(null), 1600);
      toast({ title: 'Скопировано', subtitle: value, variant: 'success' });
    } catch {
      toast({ title: 'Не удалось скопировать', variant: 'error' });
    }
  };

  const filteredClients = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter((client) =>
      [client.name, client.phone, client.email, client.refCode]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [clients, query]);

  const filteredReferrals = useMemo(() => {
    const items = referrals?.items || [];
    const term = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter !== 'all' && item.status !== filter) return false;
      if (!term) return true;
      return [item.inviter?.name, item.invited.name, item.invited.phone, item.code]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [referrals, filter, query]);

  const money = (value: number) => formatMoney(value, branding.currencySymbol, branding.decimalSeparator);

  const subtitle =
    mode === 'bonus'
      ? `${overview ? overview.bonus.active : 0} ${plural(
          overview?.bonus.active || 0,
          'клиент копит баллы',
          'клиента копят баллы',
          'клиентов копят баллы'
        )} · ${money(overview?.bonus.balance || 0)} в обороте`
      : `${overview?.referral.all || 0} ${plural(
          overview?.referral.all || 0,
          'рекомендация',
          'рекомендации',
          'рекомендаций'
        )} · ${overview?.referral.pending || 0} ждут съёмки`;

  return (
    <div className="page marketing-page loyalty-page">
      <PageHead
        title="Бонусы и рефералы"
        subtitle={subtitle}
        actions={
          <>
            <button type="button" className="btn btn--icon btn--bordered" onClick={() => void load()} aria-label="Обновить">
              <RefreshCw />
            </button>
            <button type="button" className="btn btn--bordered" onClick={() => setRulesOpen(true)}>
              <Settings2 /> <span>Правила</span>
            </button>
            {mode === 'referral' && (
              <button type="button" className="btn btn--primary" onClick={() => setCreateOpen(true)}>
                <UserPlus /> <span>Добавить рекомендацию</span>
              </button>
            )}
          </>
        }
      />

      <div className="mk-mode" role="tablist" aria-label="Программа лояльности">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'bonus'}
          className="mk-mode__btn"
          data-active={mode === 'bonus' || undefined}
          disabled={Boolean(switching)}
          onClick={() => void switchMode('bonus')}
        >
          <Coins />
          <span>
            <b>Бонусы</b>
            <em>кешбэк баллами за съёмки</em>
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'referral'}
          className="mk-mode__btn"
          data-active={mode === 'referral' || undefined}
          disabled={Boolean(switching)}
          onClick={() => void switchMode('referral')}
        >
          <Handshake />
          <span>
            <b>Рефералы</b>
            <em>клиенты приводят друзей</em>
          </span>
        </button>
      </div>

      {error && !loading && (
        <div className="mk-hint mk-hint--error" role="alert">
          <X />
          <span>{error}</span>
        </div>
      )}

      {loading && !overview && (
        <div className="mk-stats mk-stats--three">
          {Array.from({ length: 3 }).map((_, index) => (
            <span className="skeleton mk-stat-skeleton" key={index} />
          ))}
        </div>
      )}

      {overview && mode === 'bonus' && (
        <>
          <div className="mk-stats mk-stats--three">
            <div className="mk-stat">
              <span className="mk-stat__icon">
                <Coins />
              </span>
              <div>
                <em>Баллы в обороте</em>
                <b className="tnum">{new Intl.NumberFormat('ru-RU').format(overview.bonus.balance)}</b>
                <span>
                  начислено {new Intl.NumberFormat('ru-RU').format(overview.bonus.issued)} · списано{' '}
                  {new Intl.NumberFormat('ru-RU').format(overview.bonus.spent)}
                </span>
              </div>
            </div>
            <div className="mk-stat">
              <span className="mk-stat__icon">
                <Sparkles />
              </span>
              <div>
                <em>Начислено за месяц</em>
                <b className="tnum">{new Intl.NumberFormat('ru-RU').format(overview.bonus.monthIssued)}</b>
                <span>
                  {overview.bonus.active} {plural(overview.bonus.active, 'активный счёт', 'активных счёта', 'активных счетов')}
                </span>
              </div>
            </div>
            <div className="mk-stat">
              <span className="mk-stat__icon">
                <Trophy />
              </span>
              <div>
                <em>Средний баланс</em>
                <b className="tnum">{new Intl.NumberFormat('ru-RU').format(overview.bonus.average)}</b>
                <span>{overview.bonus.accounts} всего счетов</span>
              </div>
            </div>
          </div>

          <div className="card mk-toolbar">
            <div className="mk-rules-strip">
              <span>
                <b>{overview.settings.bonus.percent}%</b> кешбэк с записи
              </span>
              <span>
                до <b>{overview.settings.bonus.maxPerBooking}</b> баллов за раз
              </span>
              <span>
                оплата баллами до <b>{overview.settings.bonus.redeemPercent}%</b> чека
              </span>
              <span>
                срок жизни — <b>{overview.settings.bonus.expireDays || '∞'}</b>
                {overview.settings.bonus.expireDays ? ' дн.' : ''}
              </span>
            </div>

            <label className="input-wrap mk-search">
              <Search aria-hidden />
              <input
                className="input"
                type="search"
                value={query}
                placeholder="Клиент или телефон"
                aria-label="Поиск клиентов"
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button type="button" className="input-wrap__action" aria-label="Очистить" onClick={() => setQuery('')}>
                  <X />
                </button>
              )}
            </label>
          </div>

          {filteredClients.length === 0 ? (
            <div className="bookings-empty">
              <span className="bookings-empty__icon">
                <Coins />
              </span>
              <b>{query ? 'Ничего не найдено' : 'Счетов пока нет'}</b>
              <span>Баллы начислятся автоматически, когда запись клиента перейдёт в финальный статус.</span>
            </div>
          ) : (
            <div className="bonus-list">
              {filteredClients.map((client) => (
                <button
                  type="button"
                  className="bonus-row"
                  key={client.id}
                  data-empty={client.balance === 0 || undefined}
                  onClick={() => void openDetail(client)}
                >
                  <span className="bonus-row__avatar">{initials(client.name)}</span>
                  <span className="bonus-row__main">
                    <b>{client.name}</b>
                    <em>
                      {client.phone || 'без телефона'} · {client.bookings}{' '}
                      {plural(client.bookings, 'съёмка', 'съёмки', 'съёмок')}
                    </em>
                  </span>
                  {client.refCode && mode === 'bonus' && (
                    <span className="bonus-row__code" title="Реферальный код">
                      {client.refCode}
                    </span>
                  )}
                  <span className="bonus-row__balance tnum">
                    <b>{new Intl.NumberFormat('ru-RU').format(client.balance)}</b>
                    <em>баллов</em>
                  </span>
                  <ArrowRight className="bonus-row__chev" />
                </button>
              ))}
            </div>
          )}

          {(overview.topClients.length > 0 || overview.referral.all > 0) && (
            <div className="mk-hint">
              <Gift />
              <span>
                При включённых рефералах рекомендации приносят баллы на тот же счёт — переключение режима не обнуляет
                историю.
              </span>
            </div>
          )}
        </>
      )}

      {overview && mode === 'referral' && (
        <>
          <div className="mk-stats mk-stats--three">
            <div className="mk-stat">
              <span className="mk-stat__icon">
                <Handshake />
              </span>
              <div>
                <em>Рекомендаций</em>
                <b className="tnum">{overview.referral.all}</b>
                <span>
                  {overview.referral.pending} ждут · {overview.referral.cancelled} отменено
                </span>
              </div>
            </div>
            <div className="mk-stat">
              <span className="mk-stat__icon">
                <Check />
              </span>
              <div>
                <em>Начислено вознаграждений</em>
                <b className="tnum">{new Intl.NumberFormat('ru-RU').format(overview.referral.rewardTotal)}</b>
                <span>конверсия {overview.referral.share}%</span>
              </div>
            </div>
            <div className="mk-stat">
              <span className="mk-stat__icon">
                <Sparkles />
              </span>
              <div>
                <em>Ожидает начисления</em>
                <b className="tnum">{new Intl.NumberFormat('ru-RU').format(overview.referral.pendingReward)}</b>
                <span>баллов после съёмок</span>
              </div>
            </div>
          </div>

          <div className="card mk-toolbar">
            <div className="mk-filters" role="tablist" aria-label="Фильтр рекомендаций">
              {REFERRAL_FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  className="mk-filter"
                  data-active={filter === item.id || undefined}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label className="input-wrap mk-search">
              <Search aria-hidden />
              <input
                className="input"
                type="search"
                value={query}
                placeholder="Клиент или код"
                aria-label="Поиск рекомендаций"
                onChange={(event) => setQuery(event.target.value)}
              />
              {query && (
                <button type="button" className="input-wrap__action" aria-label="Очистить" onClick={() => setQuery('')}>
                  <X />
                </button>
              )}
            </label>
          </div>

          {filteredReferrals.length === 0 ? (
            <div className="bookings-empty">
              <span className="bookings-empty__icon">
                <Handshake />
              </span>
              <b>{query ? 'Ничего не найдено' : 'Рекомендаций пока нет'}</b>
              <span>
                Отправьте клиенту его ссылку — друг, пришедший по ней, автоматически попадёт в список рекомендаций.
              </span>
            </div>
          ) : (
            <div className="ref-list">
              {filteredReferrals.map((item) => (
                <article className="ref-card" key={item.id} data-status={item.status}>
                  <div className="ref-card__flow">
                    <span className="ref-card__avatar">{initials(item.inviter?.name || 'К')}</span>
                    <div>
                      <b>{item.inviter?.name || 'Клиент'}</b>
                      <em>рекомендовал</em>
                    </div>
                    <ArrowRight className="ref-card__arrow" />
                    <div>
                      <b>{item.invited.name}</b>
                      <em>{item.invited.phone || 'без телефона'}</em>
                    </div>
                  </div>

                  <span className="ref-card__status" data-status={item.status}>
                    {STATUS_LABEL[item.status]}
                  </span>

                  <div className="ref-card__rewards">
                    <span className="tnum">{points(item.rewardInviter)} пригласившему</span>
                    <span className="tnum">{points(item.rewardInvited)} приглашённому</span>
                  </div>

                  <div className="ref-card__meta">
                    {formatDate(item.createdAt, { day: 'numeric', month: 'short' })}
                    {item.status === 'pending' && ` · ждём ${item.waitingDays} ${plural(item.waitingDays, 'день', 'дня', 'дней')}`}
                    {item.note && ` · ${item.note}`}
                  </div>

                  <div className="ref-card__actions">
                    {item.code && (
                      <button
                        type="button"
                        className="btn btn--icon btn--ghost"
                        aria-label={`Скопировать ссылку ${item.inviter?.name || ''}`}
                        title="Скопировать реферальную ссылку"
                        onClick={() => void copy(referralLink(item.inviter?.refCode || item.code))}
                      >
                        {copied === referralLink(item.inviter?.refCode || item.code) ? <Check /> : <Copy />}
                      </button>
                    )}
                    {item.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          disabled={busyId === item.id}
                          onClick={() => void cancel(item)}
                        >
                          Отменить
                        </button>
                        <button
                          type="button"
                          className="btn btn--primary"
                          disabled={busyId === item.id}
                          onClick={() => void reward(item)}
                        >
                          Начислить
                        </button>
                      </>
                    )}
                    {item.status === 'rewarded' && item.rewardedAt && (
                      <span className="ref-card__date">{formatDate(item.rewardedAt, { day: 'numeric', month: 'long' })}</span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          <div className="mk-hint">
            <Copy />
            <span>
              Ссылка вида <b>/booking?ref=КОД</b> запоминает, кто привёл клиента. Вознаграждение начисляется, когда
              запись приглашённого доходит до финального статуса.
            </span>
          </div>
        </>
      )}

      <Modal
        open={rulesOpen}
        onClose={() => setRulesOpen(false)}
        title="Правила программы"
        subtitle={mode === 'bonus' ? 'Кешбэк и списание баллами' : 'Вознаграждения за рекомендации'}
        icon={<Settings2 />}
        size="medium"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setRulesOpen(false)} disabled={savingRules}>
              Отмена
            </button>
            <div className="spacer" />
            <button type="button" className="btn btn--primary" disabled={savingRules} onClick={() => void saveRules()}>
              Сохранить правила
            </button>
          </>
        }
      >
        {draft && (
          <div className="mk-form">
            <div className="mk-switch-row">
              <div>
                <b>{draft.mode === 'bonus' ? 'Бонусы включены' : 'Рефералы включены'}</b>
                <span>Выключите, чтобы программа перестала начислять и списывать</span>
              </div>
              <Switch
                checked={draft.mode === 'bonus' ? draft.bonus.enabled : draft.referral.enabled}
                label="Программа включена"
                onChange={(value) =>
                  setDraft((prev) =>
                    prev
                      ? {
                          ...prev,
                          bonus: { ...prev.bonus, enabled: prev.mode === 'bonus' ? value : prev.bonus.enabled },
                          referral: {
                            ...prev.referral,
                            enabled: prev.mode === 'referral' ? value : prev.referral.enabled
                          }
                        }
                      : prev
                  )
                }
              />
            </div>

            {draft.mode === 'bonus' ? (
              <>
                <div className="mk-form__row">
                  <label className="field">
                    <span className="field__label">Кешбэк, % от записи</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={50}
                      value={draft.bonus.percent}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, bonus: { ...prev.bonus, percent: Number(event.target.value) } } : prev
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Не больше баллов за запись</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={draft.bonus.maxPerBooking}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, bonus: { ...prev.bonus, maxPerBooking: Number(event.target.value) } } : prev
                        )
                      }
                    />
                  </label>
                </div>
                <div className="mk-form__row">
                  <label className="field">
                    <span className="field__label">Оплата баллами, % от чека</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={100}
                      value={draft.bonus.redeemPercent}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, bonus: { ...prev.bonus, redeemPercent: Number(event.target.value) } } : prev
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Срок жизни баллов, дней</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={3650}
                      value={draft.bonus.expireDays}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, bonus: { ...prev.bonus, expireDays: Number(event.target.value) } } : prev
                        )
                      }
                    />
                  </label>
                </div>
                <div className="mk-form__row">
                  <label className="field">
                    <span className="field__label">Приветственные баллы</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={draft.bonus.welcome}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, bonus: { ...prev.bonus, welcome: Number(event.target.value) } } : prev
                        )
                      }
                    />
                    <span className="field__hint">Начисляются вручную из карточки клиента</span>
                  </label>
                  <label className="field">
                    <span className="field__label">Минимальная сумма записи</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={draft.bonus.minSpend}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, bonus: { ...prev.bonus, minSpend: Number(event.target.value) } } : prev
                        )
                      }
                    />
                  </label>
                </div>
              </>
            ) : (
              <>
                <div className="mk-form__row">
                  <label className="field">
                    <span className="field__label">Баллы пригласившему</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={draft.referral.rewardInviter}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, referral: { ...prev.referral, rewardInviter: Number(event.target.value) } } : prev
                        )
                      }
                    />
                  </label>
                  <label className="field">
                    <span className="field__label">Баллы приглашённому</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={draft.referral.rewardInvited}
                      onChange={(event) =>
                        setDraft((prev) =>
                          prev ? { ...prev, referral: { ...prev.referral, rewardInvited: Number(event.target.value) } } : prev
                        )
                      }
                    />
                  </label>
                </div>
                <label className="field">
                  <span className="field__label">Скидка приглашённому на первую съёмку</span>
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={draft.referral.discountInvited}
                    onChange={(event) =>
                      setDraft((prev) =>
                        prev ? { ...prev, referral: { ...prev.referral, discountInvited: Number(event.target.value) } } : prev
                      )
                    }
                  />
                  <span className="field__hint">Применяется автоматически в форме записи</span>
                </label>
                <div className="field">
                  <span className="field__label">Когда начислять</span>
                  <div className="mk-toggle">
                    <button
                      type="button"
                      className="mk-toggle__btn"
                      data-active={draft.referral.trigger === 'first_visit' || undefined}
                      onClick={() =>
                        setDraft((prev) => (prev ? { ...prev, referral: { ...prev.referral, trigger: 'first_visit' } } : prev))
                      }
                    >
                      После съёмки
                    </button>
                    <button
                      type="button"
                      className="mk-toggle__btn"
                      data-active={draft.referral.trigger === 'signup' || undefined}
                      onClick={() =>
                        setDraft((prev) => (prev ? { ...prev, referral: { ...prev.referral, trigger: 'signup' } } : prev))
                      }
                    >
                      Сразу при записи
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detail ? detail.client.name : 'Счёт клиента'}
        subtitle={detail ? `Баланс: ${new Intl.NumberFormat('ru-RU').format(detail.balance)} баллов` : 'Загружаем историю'}
        icon={<Coins />}
        size="medium"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setDetailOpen(false)}>
              Закрыть
            </button>
            <div className="spacer" />
            <button
              type="button"
              className="btn btn--bordered"
              disabled={adjustBusy}
              onClick={() => void adjust(-1)}
            >
              Списать
            </button>
            <button type="button" className="btn btn--primary" disabled={adjustBusy} onClick={() => void adjust(1)}>
              Начислить
            </button>
          </>
        }
      >
        {!detail ? (
          <span className="skeleton mk-skeleton" />
        ) : (
          <div className="bonus-detail">
            {detail.client.refCode && (
              <button
                type="button"
                className="bonus-detail__link"
                onClick={() => void copy(referralLink(detail.client.refCode))}
              >
                <Copy />
                {referralLink(detail.client.refCode)}
              </button>
            )}

            <div className="bonus-detail__form">
              <label className="field">
                <span className="field__label">Сколько баллов</span>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={adjustAmount}
                  placeholder="Например, 500"
                  onChange={(event) => setAdjustAmount(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Причина</span>
                <input
                  className="input"
                  value={adjustReason}
                  maxLength={160}
                  placeholder="Подарок за отзыв"
                  onChange={(event) => setAdjustReason(event.target.value)}
                />
              </label>
            </div>

            <div className="bonus-detail__list">
              {detail.items.length === 0 && (
                <div className="bonus-detail__empty">Пока нет ни начислений, ни списаний</div>
              )}
              {detail.items.map((item) => (
                <div className="bonus-tx" key={item.id} data-kind={item.amount > 0 ? 'in' : 'out'}>
                  <span className="bonus-tx__sign">{item.amount > 0 ? '+' : '−'}</span>
                  <div>
                    <b>{item.reason || (item.amount > 0 ? 'Начисление' : 'Списание')}</b>
                    <em>
                      {formatDate(item.createdAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                      {item.expiresAt && item.amount > 0 ? ` · до ${formatDate(item.expiresAt, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}
                    </em>
                  </div>
                  <span className="bonus-tx__amount tnum">{points(item.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Новая рекомендация"
        subtitle="Кто привёл клиента и как его зовут"
        icon={<UserPlus />}
        size="narrow"
        footer={
          <>
            <button type="button" className="btn btn--ghost" onClick={() => setCreateOpen(false)} disabled={createBusy}>
              Отмена
            </button>
            <div className="spacer" />
            <button type="button" className="btn btn--primary" disabled={createBusy} onClick={() => void createReferral()}>
              Добавить
            </button>
          </>
        }
      >
        <div className="mk-form">
          {formError && <div className="cl-form__error">{formError}</div>}
          <label className="field">
            <span className="field__label">Кто рекомендует</span>
            <select
              className="input"
              value={inviterId ?? ''}
              onChange={(event) => setInviterId(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Выберите клиента</option>
              {clients.map((client) => (
                <option value={client.id} key={client.id}>
                  {client.name}
                  {client.phone ? ` · ${client.phone}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Имя приглашённого</span>
            <input
              className="input"
              value={invitedName}
              maxLength={80}
              placeholder="Например, Наталья"
              onChange={(event) => setInvitedName(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">
              Телефон <span className="mk-optional">необязательно</span>
            </span>
            <input
              className="input"
              value={invitedPhone}
              placeholder="+375 29 000-00-00"
              onChange={(event) => setInvitedPhone(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Комментарий</span>
            <input
              className="input"
              value={adjustReason}
              maxLength={160}
              placeholder="Например, порекомендовала в Telegram"
              onChange={(event) => setAdjustReason(event.target.value)}
            />
          </label>
        </div>
      </Modal>

      {overview && (
        <div className="loyalty-foot">
          <Gift />
          <span>
            {mode === 'bonus'
              ? 'Баллы начисляются, когда запись переходит в финальный статус. Списание доступно на шаге подтверждения записи.'
              : 'Скидка приглашённому применяется автоматически. Вознаграждение приходит на бонусный счёт после съёмки.'}
          </span>
        </div>
      )}
    </div>
  );
}
