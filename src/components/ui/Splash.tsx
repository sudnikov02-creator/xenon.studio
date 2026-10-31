import { BrandMark } from './BrandMark';

export function Splash({ label = 'Загружаем студию' }: { label?: string }) {
  return (
    <div className="splash">
      <div className="splash__inner">
        <BrandMark size={46} className="splash__mark" />
        <div style={{ fontSize: 12.5, color: 'var(--muted-2)', letterSpacing: '0.02em' }}>{label}</div>
        <div className="splash__bar" />
      </div>
    </div>
  );
}
