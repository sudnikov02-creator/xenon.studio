import type { ReactNode } from 'react';

export function PageHead({
  title,
  subtitle,
  actions,
  badge
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h1 className="page-head__title">{title}</h1>
          {badge}
        </div>
        {subtitle && <p className="page-head__sub">{subtitle}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}
