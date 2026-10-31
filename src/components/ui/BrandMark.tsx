import { cn } from '../../lib/utils';

export function BrandMark({
  size = 38,
  className,
  title
}: {
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <div className={cn('brandmark', className)} style={{ width: size, height: size, borderRadius: Math.round(size * 0.29) }}>
      <svg viewBox="0 0 64 64" fill="none" role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
        {title && <title>{title}</title>}
        <circle cx="32" cy="32" r="15.5" stroke="currentColor" strokeWidth="2.6" opacity="0.96" />
        <path
          d="M32 22.2 40.5 27v9.6L32 41.4 23.5 36.6V27z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          opacity="0.86"
        />
        <circle cx="32" cy="32" r="2.2" fill="currentColor" />
      </svg>
    </div>
  );
}
