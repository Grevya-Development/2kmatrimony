import * as React from 'react';
import { cn } from '@/lib/utils';

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center', className)}>
      {icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-champagne-100 text-champagne-600 [&_svg]:size-5">{icon}</div>}
      <h3 className="font-serif text-2xl text-ink">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm text-muted text-pretty">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions, className }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="font-serif text-4xl leading-tight text-ink text-balance sm:text-5xl">{title}</h1>
        {description && <p className="mt-3 text-[1.02rem] text-muted text-pretty">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-danger/20 bg-danger-bg px-5 py-4 text-sm text-danger">
      {message}
      {onRetry && <button type="button" onClick={onRetry} className="ml-3 font-medium underline underline-offset-4">Try again</button>}
    </div>
  );
}

export function Notice({ tone = 'info', children, className }: { tone?: 'info' | 'warning' | 'success'; children: React.ReactNode; className?: string }) {
  const tones = { info: 'bg-info-bg text-info', warning: 'bg-warning-bg text-warning', success: 'bg-success-bg text-success' };
  return <div className={cn('rounded-xl px-4 py-3 text-sm', tones[tone], className)}>{children}</div>;
}
