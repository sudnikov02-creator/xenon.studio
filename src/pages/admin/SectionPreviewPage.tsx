import { Link } from 'react-router-dom';
import { ArrowRight, Check, Compass, Sparkles } from 'lucide-react';
import { PageHead } from '../../components/ui/PageHead';
import { SECTIONS } from '../../app/sections';
import { useSettings } from '../../context/SettingsContext';
import { useCountUp } from '../../hooks/useCountUp';

export function SectionPreviewPage({ sectionKey }: { sectionKey: string }) {
  const info = SECTIONS[sectionKey];
  const { branding } = useSettings();
  const ready = useCountUp(6.25, 700);

  if (!info) return null;
  const Icon = info.icon;

  const cards =
    info.cards && info.cards.length > 0
      ? info.cards
      : [
          { title: 'Дизайн в едином стиле', text: 'Все элементы — часть общей системы: анимации, отступы и типографика.' },
          { title: 'Живые данные', text: 'Изменения появляются мгновенно, без перезагрузки страницы.' }
        ];

  return (
    <div className="page">
      <PageHead
        title={info.title}
        subtitle={info.eyebrow}
        badge={<span className="badge badge--accent">Готовится</span>}
        actions={
          <Link to="/admin" className="btn">
            На дашборд
          </Link>
        }
      />

      <div className="preview">
        <section className="preview__hero">
          <div className="preview__chip">
            <Sparkles /> Раздел в разработке
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <span
              className="metric__icon"
              style={{ width: 46, height: 46, borderRadius: 14 }}
            >
              <Icon />
            </span>
            <div>
              <h2 className="preview__title">Что появится здесь</h2>
              <div style={{ fontSize: 12.5, color: 'var(--muted-2)', marginTop: 3 }}>
                {branding.siteName} · {info.eyebrow}
              </div>
            </div>
          </div>
          <p className="preview__text">{info.description}</p>

          <div className="preview__list">
            {info.features.map((feature) => (
              <div className="preview__item" key={feature}>
                <span className="preview__item-icon">
                  <Check />
                </span>
                {feature}
              </div>
            ))}
          </div>

          <div className="preview__progress">
            <div className="preview__progress-top">
              <span>Раздел в очереди · этап 1 из 16</span>
              <b className="tnum">{Math.round(ready)}%</b>
            </div>
            <div className="preview__progress-bar">
              <span style={{ width: `${ready}%` }} />
            </div>
          </div>
        </section>

        <aside className="preview__side">
          {cards.map((card) => (
            <div className="preview__card" key={card.title}>
              <h4>{card.title}</h4>
              <p>{card.text}</p>
            </div>
          ))}

          <div className="preview__card">
            <h4>Как устроена студия</h4>
            <p>Разделы открываются в общем каркасе, а данные приходят в реальном времени.</p>
            {info.links && info.links.length > 0 && (
              <div className="preview__links">
                {info.links.map((link) => (
                  <Link key={link.path} to={link.path} className="preview__link">
                    {link.label} <ArrowRight />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="preview__hint">
            <span className="preview__hint-icon">
              <Compass />
            </span>
            <div>
              <b>Раздел подключается в следующем обновлении</b>
              <span>Данные и настройки уже сохраняются в защищённой базе студии.</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
