import { Check } from 'lucide-react';
import { STEP_TITLES } from '../../lib/booking';

export function BookingStepper({
  step,
  skipped = []
}: {
  step: number;
  skipped?: number[];
}) {
  return (
    <ol className="stepper" aria-label="Шаги оформления записи">
      {STEP_TITLES.map((title, index) => {
        const state = index < step ? 'done' : index === step ? 'active' : 'next';
        const isSkipped = skipped.includes(index);
        return (
          <li className="stepper__item" data-state={state} key={title} aria-current={state === 'active' ? 'step' : undefined}>
            <span className="stepper__dot">{state === 'done' ? <Check /> : index + 1}</span>
            <span className="stepper__label">{isSkipped ? 'Без кода' : title}</span>
            {index < STEP_TITLES.length - 1 && <span className="stepper__bar" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}
