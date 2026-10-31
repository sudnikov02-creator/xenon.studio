import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarOff, CalendarPlus, Check, Clock3, RotateCcw, Save, TriangleAlert, Trash2 } from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { Switch } from '../../components/ui/Switch';
import { useSettings } from '../../context/SettingsContext';
import { useToast } from '../../context/ToastContext';
import { ApiError } from '../../lib/api';
import {
  BUFFER_OPTIONS_MIN,
  DEFAULT_SCHEDULE,
  HORIZON_OPTIONS,
  NOTICE_OPTIONS,
  WEEKDAYS,
  dayMinutes,
  enabledDays,
  exceptionTitle,
  formatHours,
  minutesOf,
  normalizeScheduleClient,
  schedulesEqual,
  weekMinutes
} from '../../lib/schedule';
import type { Schedule, ScheduleDay, ScheduleException } from '../../types';

function TimeInput({
  value,
  onChange,
  label
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  label: string;
}) {
  return (
    <input
      type="time"
      className="input sched-time"
      value={value || ''}
      aria-label={label}
      onChange={(event) => onChange(event.target.value || null)}
    />
  );
}

export function SchedulePage() {
  const { settings, updateSettings } = useSettings();
  const { toast } = useToast();
  const saved = useMemo(() => normalizeScheduleClient(settings?.schedule), [settings?.schedule]);
  const [draft, setDraft] = useState<Schedule>(saved);
  const [saving, setSaving] = useState(false);
  const [invalid, setInvalid] = useState<string | null>(null);
  const lastSaved = useRef(JSON.stringify(saved));

  useEffect(() => {
    const nextJson = JSON.stringify(saved);
    if (nextJson === lastSaved.current) return;
    const previous = lastSaved.current;
    lastSaved.current = nextJson;
    setDraft((prev) => (JSON.stringify(prev) === previous ? saved : prev));
  }, [saved]);

  const dirty = !schedulesEqual(draft, saved);

  const updateDay = (day: number, patch: Partial<ScheduleDay>) => {
    setDraft((prev) => ({
      ...prev,
      week: prev.week.map((item) => (item.day === day ? { ...item, ...patch } : item))
    }));
  };

  const updateException = (date: string, patch: Partial<ScheduleException>) => {
    setDraft((prev) => ({
      ...prev,
      exceptions: prev.exceptions
        .map((item) => (item.date === date ? { ...item, ...patch } : item))
        .sort((a, b) => a.date.localeCompare(b.date))
    }));
  };

  const addException = () => {
    const base = new Date();
    base.setDate(base.getDate() + 7);
    let date = base.toISOString().slice(0, 10);
    const taken = new Set(draft.exceptions.map((item) => item.date));
    let guard = 0;
    while (taken.has(date) && guard < 60) {
      base.setDate(base.getDate() + 1);
      date = base.toISOString().slice(0, 10);
      guard += 1;
    }
    setDraft((prev) => ({
      ...prev,
      exceptions: [
        ...prev.exceptions,
        { date, closed: true, start: null, end: null, note: null }
      ].sort((a, b) => a.date.localeCompare(b.date))
    }));
  };

  const removeException = (date: string) => {
    setDraft((prev) => ({ ...prev, exceptions: prev.exceptions.filter((item) => item.date !== date) }));
  };

  const save = async () => {
    const broken = draft.week.find(
      (day) => day.enabled && (!day.start || !day.end || minutesOf(day.start) >= minutesOf(day.end))
    );
    if (broken) {
      setInvalid(`${WEEKDAYS.find((item) => item.day === broken.day)?.full}: начало должно быть раньше конца`);
      return;
    }
    setInvalid(null);
    setSaving(true);
    try {
      await updateSettings({ schedule: draft });
      toast({
        title: 'Расписание сохранено',
        subtitle: draft.accepting ? 'Клиенты могут записываться в рабочие часы' : 'Приём заявок приостановлен',
        variant: 'success'
      });
    } catch (err) {
      toast({
        title: 'Не удалось сохранить расписание',
        subtitle: err instanceof ApiError ? err.message : 'Попробуйте ещё раз',
        variant: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setDraft(saved);
    setInvalid(null);
  };

  const totalHours = formatHours(weekMinutes(draft));
  const workingDays = enabledDays(draft);
  const dayOff = WEEKDAYS.find(({ day }) => !draft.week.find((item) => item.day === day)?.enabled);

  return (
    <div className="page schedule-page">
      <PageHead
        title="Расписание"
        subtitle="Рабочие часы студии, перерывы и правила приёма заявок"
        badge={dirty ? <span className="badge badge--warning">Есть изменения</span> : undefined}
        actions={
          <>
            <button type="button" className="btn" onClick={reset} disabled={!dirty || saving}>
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

      {invalid && (
        <div className="card form-alert form-alert--page">
          <TriangleAlert />
          <span>{invalid}</span>
        </div>
      )}

      <div className="sched-layout">
        <div className="sched-main">
          <section className="card sched-card">
            <header className="sched-card__head">
              <div>
                <h2>Рабочая неделя</h2>
                <p>Отметьте дни, когда студия принимает клиентов, и укажите часы.</p>
              </div>
              <span className="badge">{totalHours} в неделю</span>
            </header>

            <div className="sched-week">
              {WEEKDAYS.map(({ day, short, full }) => {
                const value = draft.week.find((item) => item.day === day) || DEFAULT_SCHEDULE.week[day - 1];
                const breakSet = Boolean(value.breakStart && value.breakEnd);
                return (
                  <div className="sched-day" key={day} data-off={!value.enabled}>
                    <div className="sched-day__label">
                      <span className="sched-day__short">{short}</span>
                      <b>{full}</b>
                    </div>

                    <div className="sched-day__toggle">
                      <Switch
                        checked={value.enabled}
                        onChange={(checked) => updateDay(day, { enabled: checked })}
                        label={`Рабочий день: ${full}`}
                        size="sm"
                      />
                      <span>{value.enabled ? 'Работаем' : 'Выходной'}</span>
                    </div>

                    <div className="sched-day__times">
                      <TimeInput
                        value={value.start}
                        onChange={(next) => updateDay(day, { start: next || '10:00' })}
                        label={`Начало работы, ${full}`}
                      />
                      <span className="sched-day__dash">—</span>
                      <TimeInput
                        value={value.end}
                        onChange={(next) => updateDay(day, { end: next || '19:00' })}
                        label={`Конец работы, ${full}`}
                      />
                    </div>

                    <div className="sched-day__break">
                      {breakSet ? (
                        <>
                          <span className="sched-day__break-label">Перерыв</span>
                          <TimeInput
                            value={value.breakStart}
                            onChange={(next) => updateDay(day, { breakStart: next })}
                            label={`Начало перерыва, ${full}`}
                          />
                          <span className="sched-day__dash">—</span>
                          <TimeInput
                            value={value.breakEnd}
                            onChange={(next) => updateDay(day, { breakEnd: next })}
                            label={`Конец перерыва, ${full}`}
                          />
                          <button
                            type="button"
                            className="btn btn--icon btn--sm sched-day__break-remove"
                            aria-label={`Убрать перерыв, ${full}`}
                            onClick={() => updateDay(day, { breakStart: null, breakEnd: null })}
                          >
                            <Trash2 />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="sched-day__break-add"
                          onClick={() => updateDay(day, { breakStart: '14:00', breakEnd: '15:00' })}
                        >
                          <CalendarPlus /> Добавить перерыв
                        </button>
                      )}
                    </div>

                    <span className="sched-day__hours">{value.enabled ? formatHours(dayMinutes(value)) : '—'}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card sched-card">
            <header className="sched-card__head">
              <div>
                <h2>Правила записи</h2>
                <p>Насколько заранее клиент может выбрать время и сколько времени нужно на подготовку.</p>
              </div>
            </header>

            <div className="sched-rules">
              <div className="sched-rule">
                <div>
                  <b>Приём заявок</b>
                  <span>{draft.accepting ? 'Форма записи открыта для клиентов' : 'Заявки временно не принимаются'}</span>
                </div>
                <Switch
                  checked={draft.accepting}
                  onChange={(checked) => setDraft((prev) => ({ ...prev, accepting: checked }))}
                  label="Приём заявок открыт"
                />
              </div>

              <label className="sched-rule sched-rule--field">
                <div>
                  <b>Минимальное уведомление</b>
                  <span>Раньше этого срока записаться нельзя</span>
                </div>
                <select
                  className="select"
                  value={draft.minNoticeHours}
                  onChange={(event) => setDraft((prev) => ({ ...prev, minNoticeHours: Number(event.target.value) }))}
                >
                  {NOTICE_OPTIONS.map((hours) => (
                    <option key={hours} value={hours}>
                      {hours === 0 ? 'Без ограничений' : `${hours} ч`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="sched-rule sched-rule--field">
                <div>
                  <b>Горизонт записи</b>
                  <span>На сколько вперёд открыт календарь</span>
                </div>
                <select
                  className="select"
                  value={draft.horizonDays}
                  onChange={(event) => setDraft((prev) => ({ ...prev, horizonDays: Number(event.target.value) }))}
                >
                  {HORIZON_OPTIONS.map((days) => (
                    <option key={days} value={days}>
                      {days} дн.
                    </option>
                  ))}
                </select>
              </label>

              <label className="sched-rule sched-rule--field">
                <div>
                  <b>Буфер между съёмками</b>
                  <span>Время на смену локации и подготовку</span>
                </div>
                <select
                  className="select"
                  value={draft.bufferMin}
                  onChange={(event) => setDraft((prev) => ({ ...prev, bufferMin: Number(event.target.value) }))}
                >
                  {BUFFER_OPTIONS_MIN.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes === 0 ? 'Без буфера' : `${minutes} мин`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="card sched-card">
            <header className="sched-card__head">
              <div>
                <h2>Исключения</h2>
                <p>Отпуск, командировка или съёмка на выезде — закройте день целиком или задайте другие часы.</p>
              </div>
              <button type="button" className="btn btn--sm btn--soft" onClick={addException}>
                <CalendarPlus /> Добавить дату
              </button>
            </header>

            {draft.exceptions.length === 0 ? (
              <div className="sched-exceptions__empty">
                <CalendarOff />
                <b>Особых дат нет</b>
                <span>Студия работает по обычному недельному графику.</span>
              </div>
            ) : (
              <div className="sched-exceptions">
                {draft.exceptions.map((item) => (
                  <div className="sched-exception" key={item.date}>
                    <div className="sched-exception__date">
                      <input
                        type="date"
                        className="input"
                        value={item.date}
                        aria-label="Дата исключения"
                        onChange={(event) => {
                          const next = event.target.value;
                          if (!next) return;
                          if (draft.exceptions.some((entry) => entry.date === next && entry.date !== item.date)) {
                            toast({ title: 'Такая дата уже есть', variant: 'error' });
                            return;
                          }
                          updateException(item.date, { date: next });
                        }}
                      />
                      <span>{exceptionTitle(item)}</span>
                    </div>

                    <div className="sched-exception__mode">
                      <button
                        type="button"
                        className={`srv-filter${item.closed ? ' is-active' : ''}`}
                        onClick={() => updateException(item.date, { closed: true, start: null, end: null })}
                      >
                        Выходной
                      </button>
                      <button
                        type="button"
                        className={`srv-filter${item.closed ? '' : ' is-active'}`}
                        onClick={() =>
                          updateException(item.date, {
                            closed: false,
                            start: item.start || '10:00',
                            end: item.end || '16:00'
                          })
                        }
                      >
                        Другие часы
                      </button>
                    </div>

                    {!item.closed && (
                      <div className="sched-exception__times">
                        <TimeInput
                          value={item.start}
                          onChange={(next) => updateException(item.date, { start: next })}
                          label="Начало работы в этот день"
                        />
                        <span className="sched-day__dash">—</span>
                        <TimeInput
                          value={item.end}
                          onChange={(next) => updateException(item.date, { end: next })}
                          label="Конец работы в этот день"
                        />
                      </div>
                    )}

                    <input
                      className="input sched-exception__note"
                      value={item.note || ''}
                      maxLength={80}
                      placeholder="Заметка"
                      aria-label="Заметка к исключению"
                      onChange={(event) => updateException(item.date, { note: event.target.value })}
                    />

                    <button
                      type="button"
                      className="btn btn--icon sched-exception__remove"
                      onClick={() => removeException(item.date)}
                      aria-label={`Удалить исключение ${item.date}`}
                    >
                      <Trash2 />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="sched-side">
          <div className="card sched-summary">
            <h3>Итоги недели</h3>
            <div className="sched-summary__row">
              <span>Рабочих дней</span>
              <b>{workingDays} из 7</b>
            </div>
            <div className="sched-summary__row">
              <span>Часов в неделю</span>
              <b>{totalHours}</b>
            </div>
            <div className="sched-summary__row">
              <span>Выходной</span>
              <b>{dayOff ? dayOff.full : 'нет'}</b>
            </div>
            <div className="sched-summary__row">
              <span>Запись не позднее</span>
              <b>{draft.minNoticeHours === 0 ? 'в день съёмки' : `за ${draft.minNoticeHours} ч`}</b>
            </div>
            <div className="sched-summary__row">
              <span>Горизонт</span>
              <b>{draft.horizonDays} дн.</b>
            </div>
            <div className="sched-summary__hint">
              <Check />
              <span>
                Заявки вне рабочих часов попадают в ожидание: клиент увидит ближайшее доступное время.
              </span>
            </div>
          </div>

          <div className="card sched-preview">
            <h3>Клиент увидит</h3>
            <p>
              «Записаться можно
              {draft.minNoticeHours === 0
                ? ' на любое свободное время'
                : ` не позднее чем за ${draft.minNoticeHours} ч до съёмки`}
              , календарь открыт на {draft.horizonDays} дней вперёд».
            </p>
            <div className="sched-preview__chips">
              <span>
                <Clock3 /> {totalHours} в неделю
              </span>
              <span>{draft.accepting ? 'Приём открыт' : 'Приём закрыт'}</span>
            </div>
          </div>
        </aside>
      </div>

      {dirty && (
        <div className="sched-savebar">
          <div>
            <b>Несохранённые изменения</b>
            <span>Новый график появится у клиентов сразу после сохранения.</span>
          </div>
          <button type="button" className="btn" onClick={reset} disabled={saving}>
            Отменить
          </button>
          <button
            type="button"
            className={`btn btn--primary${saving ? ' btn--loading' : ''}`}
            onClick={() => void save()}
            disabled={saving}
          >
            <Save /> Сохранить
          </button>
        </div>
      )}
    </div>
  );
}
