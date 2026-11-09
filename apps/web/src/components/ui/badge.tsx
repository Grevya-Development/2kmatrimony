import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium [&_svg]:size-3.5', {
  variants: {
    tone: {
      neutral: 'bg-surface-2 text-ink-2',
      emerald: 'bg-emerald-50 text-emerald-700',
      gold: 'bg-gold-100 text-gold-600',
      success: 'bg-success-bg text-success',
      warning: 'bg-warning-bg text-warning',
      danger: 'bg-danger-bg text-danger',
      info: 'bg-info-bg text-info',
      outline: 'border border-line text-ink-2',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export const Badge = ({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) => (
  <span className={cn(badgeVariants({ tone }), className)} {...props} />
);
