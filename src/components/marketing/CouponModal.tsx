import { useEffect, useState } from 'react';
import { AlertCircle, Dices, Ticket } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Switch } from '../ui/Switch';
import { api } from '../../lib/api';
import type { CouponItem, DiscountItem } from '../../types';

interface Draft {
  code: string;
  title: string;
  kind: 'percent' | 'fixed';
  value: string;
  discountId: string;
  limitTotal: string;
  limitPerClient: string;
  minAmount: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
  note: string;
}

const EMPTY: Draft = {
  code: '',
  title: '',
  kind: 'percent',
  value: '10',
  discountId: '',
  limitTotal: '0',
  limitPerClient: '1',
  minAmount: '0',
  startsOn: '',
  endsOn: '',
  isActive: true,
  note: ''
};

export function CouponModal({
  open,
  coupon,
  discounts,
  saving,
  error,
  onClose,
  onSubmit
}: {
  open: boolean;
  coupon: CouponItem | null;
  discounts: DiscountItem[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(
      coupon
        ? {
            code: coupon.code,
            title: coupon.title || '',
            kind: coupon.kind,
            value: String(coupon.value),
            discountId: coupon.discountId ? String(coupon.discountId) : '',
            limitTotal: String(coupon.limitTotal),
            limitPerClient: String(coupon.limitPerClient),
            minAmount: String(coupon.minAmount),
            startsOn: coupon.startsOn || '',
            endsOn: coupon.endsOn || '',
            isActive: coupon.isActive,
            note: coupon.note || ''
          }
        : EMPTY
    );
  }, [open, coupon]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  const generate = async () => {
    setGenerating(true);
    try {
      const data = await api.get<{ code: string }>('/marketing/coupons/code');
      set('code', data.code);
    } catch {
      /* оставляем ручной ввод */
    } finally {
      setGenerating(false);
    }
  };

  const linked = discounts.find((item) => String(item.id) === draft.discountId) || null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={coupon ? 'Настройка промокода' : 'Новый промокод'}
      subtitle="Клиент вводит код на форме записи — скидка применяется сразу"
      icon={<Ticket />}
      size="medium"
      footer={
        <>
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <div className="spacer" />
          <button
            type="button"
            className={`btn btn--primary${saving ? ' btn--loading' : ''}`}
            disabled={saving || draft.code.trim().length < 3}
            onClick={() =>
              onSubmit({
                code: draft.code.trim().toUpperCase(),
                title: draft.title.trim(),
                kind: draft.kind,
                value: Number(draft.value) || 0,
                discountId: draft.discountId ? Number(draft.discountId) : null,
                limitTotal: Number(draft.limitTotal) || 0,
                limitPerClient: Number(draft.limitPerClient) || 1,
                minAmount: Number(draft.minAmount) || 0,
                startsOn: draft.startsOn || null,
                endsOn: draft.endsOn || null,
                isActive: draft.isActive,
                note: draft.note
              })
            }
          >
            {coupon ? 'Сохранить' : 'Создать промокод'}
          </button>
        </>
      }
    >
      <div className="mk-form">
        {error && (
          <div className="cl-form__error" role="alert">
            <AlertCircle />
            <span>{error}</span>
          </div>
        )}

        <label className="field">
          <span className="field__label">Код</span>
          <span className="mk-code-field">
            <input
              className="input mk-code-field__input"
              value={draft.code}
              maxLength={24}
              placeholder="SPRING15"
              onChange={(event) => set('code', event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
            />
            <button type="button" className={`btn btn--bordered${generating ? ' btn--loading' : ''}`} onClick={() => void generate()}>
              <Dices /> Сгенерировать
            </button>
          </span>
        </label>

        <label className="field">
          <span className="field__label">Название кампании</span>
          <input
            className="input"
            value={draft.title}
            maxLength={90}
            placeholder="Весенняя рассылка в Telegram"
            onChange={(event) => set('title', event.target.value)}
          />
        </label>

        <div className="mk-form__row">
          <label className="field">
            <span className="field__label">Скидка</span>
            <select className="select" value={draft.discountId} onChange={(event) => set('discountId', event.target.value)}>
              <option value="">Своя скидка</option>
              {discounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {!linked ? (
            <label className="field">
              <span className="field__label">{draft.kind === 'percent' ? 'Размер, %' : 'Сумма скидки'}</span>
              <span className="mk-inline">
                <select
                  className="select mk-inline__select"
                  value={draft.kind}
                  onChange={(event) => set('kind', event.target.value as 'percent' | 'fixed')}
                >
                  <option value="percent">%</option>
                  <option value="fixed">Сумма</option>
                </select>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={draft.value}
                  onChange={(event) => set('value', event.target.value)}
                />
              </span>
            </label>
          ) : (
            <div className="field">
              <span className="field__label">Из скидки</span>
              <div className="mk-param">
                <b className="tnum">{linked.kind === 'percent' ? `${linked.value}%` : linked.value}</b>
                <em>размер берётся из скидки «{linked.name}»</em>
              </div>
            </div>
          )}
        </div>

        <div className="mk-form__row">
          <label className="field">
            <span className="field__label">Лимит использований</span>
            <input
              className="input"
              type="number"
              min={0}
              value={draft.limitTotal}
              onChange={(event) => set('limitTotal', event.target.value)}
            />
            <span className="field__hint">0 — без ограничения</span>
          </label>
          <label className="field">
            <span className="field__label">Одному клиенту</span>
            <input
              className="input"
              type="number"
              min={1}
              value={draft.limitPerClient}
              onChange={(event) => set('limitPerClient', event.target.value)}
            />
            <span className="field__hint">сколько раз можно применить</span>
          </label>
        </div>

        <div className="mk-form__row">
          <label className="field">
            <span className="field__label">Действует с</span>
            <input className="input" type="date" value={draft.startsOn} onChange={(event) => set('startsOn', event.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Действует до</span>
            <input className="input" type="date" value={draft.endsOn} onChange={(event) => set('endsOn', event.target.value)} />
          </label>
        </div>

        <label className="field">
          <span className="field__label">Минимальная сумма записи</span>
          <input
            className="input"
            type="number"
            min={0}
            value={draft.minAmount}
            onChange={(event) => set('minAmount', event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Заметка</span>
          <input
            className="input"
            value={draft.note}
            maxLength={300}
            placeholder="Где разместили код, кто согласовал"
            onChange={(event) => set('note', event.target.value)}
          />
        </label>

        <div className="mk-switch-row">
          <span className="mk-switch-row__icon">
            <Ticket />
          </span>
          <div>
            <b>Промокод активен</b>
            <em>Выключенный код форма записи не принимает</em>
          </div>
          <Switch checked={draft.isActive} label="Промокод активен" onChange={(value) => set('isActive', value)} />
        </div>
      </div>
    </Modal>
  );
}
