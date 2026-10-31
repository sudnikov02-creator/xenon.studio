import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Check, ExternalLink, RotateCcw, Save, ShieldCheck, Sparkles, TriangleAlert } from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { Switch } from '../../components/ui/Switch';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { ApiError } from '../../lib/api';

interface BookingFormConfig {
  requireVerification: boolean;
  slotStepMin: number;
  askNote: boolean;
  askInstagram: boolean;
  introText: string;
}

const DEFAULTS: BookingFormConfig = {
  requireVerification: true,
  slotStepMin: 30,
  askNote: true,
  askInstagram: false,
  introText: ''
};

const STEP_OPTIONS = [15, 30, 45, 60];

function normalize(input: unknown): BookingFormConfig {
  const source = (input && typeof input === 'object' ? input : {}) as Partial<BookingFormConfig>;
  return {
    requireVerification: source.requireVerification !== false,
    slotStepMin: STEP_OPTIONS.includes(Number(source.slotStepMin)) ? Number(source.slotStepMin) : 30,
    askNote: source.askNote !== false,
    askInstagram: source.askInstagram === true,
    introText: String(source.introText || '').slice(0, 240)
  };
}

export function BookingFormSettingsPage() {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const saved = useMemo(() => normalize(settings?.bookingForm), [settings?.bookingForm]);
  const [draft, setDraft] = useState<BookingFormConfig>(saved);
  const [saving, setSaving] = useState(false);
  const lastSaved = useRef(JSON.stringify(saved));

  useEffect(() => {
    const next = JSON.stringify(saved);
    if (next === lastSaved.current) return;
    lastSaved.current = next;
    setDraft((prev) => (JSON.stringify(prev) === next ? prev : saved));
  }, [saved]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const update = (patch: Partial<BookingFormConfig>) => setDraft((prev) => ({ ...prev, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      await updateSettings({ bookingForm: draft });
      toast({
        title: 'Форма записи обновлена',
        subtitle: 'Изменения уже видны клиентам',
        variant: 'success'
      });
    } catch (err) {
      toast({
        title: 'Не удалось сохранить',
        subtitle: err instanceof ApiError ? err.message : 'Попробуйте ещё раз',
        variant: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <PageHead
        title="Форма записи"
        subtitle="Пять шагов, которые проходит клиент: услуга, время, детали, контакты, подтверждение"
        badge={dirty ? <span className="badge badge--warning">Есть изменения</span> : undefined}
        actions={
          <>
            <a className="btn" href="/booking" target="_blank" rel="noreferrer">
              <ExternalLink /> Открыть форму
            </a>
            <button type="button" className="btn" onClick={() => setDraft(saved)} disabled={!dirty || saving}>
              <RotateCcw /> Сбросить
            </button>
            <button
              type="button"
              className={`btn btn--primary${saving ? ' btn--loading' : ''}`}
              onClick={() => void save()}
              disabled={saving || !dirty}
            >
              <Save /> Сохранить
            </button>
          </>
        }
      />

      <div className="bf-grid">
        <section className="card sched-card">
          <header className="sched-card__head">
            <div>
              <h2>Подтверждение и поля</h2>
              <p>Код на телефон защищает от случайных заявок, дополнительные поля можно отключить.</p>
            </div>
            <span className="badge">
              <ShieldCheck /> {draft.requireVerification ? 'Код включён' : 'Без кода'}
            </span>
          </header>

          <div className="bf-rows">
            <div className="bf-row">
              <div>
                <b>Код подтверждения телефона</b>
                <span>Клиент получает шестизначный код и вводит его на последнем шаге.</span>
              </div>
              <Switch
                checked={draft.requireVerification}
                onChange={(value) => update({ requireVerification: value })}
                label="Код подтверждения телефона"
              />
            </div>

            <div className="bf-row">
              <div>
                <b>Пожелания к съёмке</b>
                <span>Свободное поле на шаге «Детали» — до 600 символов.</span>
              </div>
              <Switch checked={draft.askNote} onChange={(value) => update({ askNote: value })} label="Пожелания к съёмке" />
            </div>

            <div className="bf-row">
              <div>
                <b>Поле Instagram</b>
                <span>Необязательное поле на шаге контактов — удобно для портфолио клиента.</span>
              </div>
              <Switch
                checked={draft.askInstagram}
                onChange={(value) => update({ askInstagram: value })}
                label="Поле Instagram"
              />
            </div>

            <div className="bf-row bf-row--stack">
              <div>
                <b>Шаг времени</b>
                <span>Как часто предлагать время начала съёмки.</span>
              </div>
              <div className="bf-segmented" role="group" aria-label="Шаг времени">
                {STEP_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option}
                    data-active={draft.slotStepMin === option || undefined}
                    onClick={() => update({ slotStepMin: option })}
                  >
                    {option} мин
                  </button>
                ))}
              </div>
            </div>

            <label className="bf-row bf-row--stack">
              <div>
                <b>Вступление на первом шаге</b>
                <span>Короткая фраза под заголовком формы. До 240 символов.</span>
              </div>
              <textarea
                className="textarea"
                rows={3}
                maxLength={240}
                placeholder="Например: съёмки без спешки, помогу с образами и подберу свет"
                value={draft.introText}
                onChange={(event) => update({ introText: event.target.value })}
              />
            </label>
          </div>
        </section>

        <div className="bf-side">
          <section className="card bf-preview">
            <span className="bf-preview__eyebrow">
              <Sparkles /> Как это выглядит
            </span>
            <h3>Пять шагов записи</h3>
            <ol className="bf-preview__steps">
              <li data-on="true">
                <Check /> Услуга или пакет
              </li>
              <li data-on="true">
                <Check /> Дата и свободное время
              </li>
              <li data-on={draft.askNote || undefined}>
                <Check /> Дополнения{draft.askNote ? ' и пожелания' : ''}
              </li>
              <li data-on="true">
                <Check /> Контакты{draft.askInstagram ? ' и Instagram' : ''}
              </li>
              <li data-on={draft.requireVerification || undefined}>
                <Check /> {draft.requireVerification ? 'Код из сообщения' : 'Отправка заявки'}
              </li>
            </ol>
            <a className="btn btn--soft btn--block" href="/booking" target="_blank" rel="noreferrer">
              Пройти форму как клиент <ExternalLink />
            </a>
          </section>

          <section className="card bf-tip">
            <span className="bf-tip__icon">
              <CalendarClock />
            </span>
            <div>
              <b>Свободное время берётся из расписания</b>
              <p>
                Часы, перерывы, выходные и буфер между съёмками настраиваются отдельно. Если день закрыт —
                форма просто не предложит это время.
              </p>
              <a className="btn btn--ghost btn--sm" href="/admin/settings/schedule">
                Настроить расписание <ExternalLink />
              </a>
            </div>
          </section>

          {!draft.requireVerification && (
            <div className="form-alert">
              <TriangleAlert />
              <span>Без кода заявку может отправить любой — проверяйте номера вручную.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
