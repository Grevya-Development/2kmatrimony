import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

export const Label = React.forwardRef<React.ElementRef<typeof LabelPrimitive.Root>, React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>>(
  ({ className, ...props }, ref) => <LabelPrimitive.Root ref={ref} className={cn('text-sm font-medium text-ink-2', className)} {...props} />,
);
Label.displayName = 'Label';

/** Label + control + hint/error, wired for accessibility. */
export function Field({ label, htmlFor, hint, error, optional, children, className }: {
  label: string; htmlFor: string; hint?: string; error?: string | null; optional?: boolean; children: React.ReactNode; className?: string;
}) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between">
        <Label htmlFor={htmlFor}>{label}</Label>
        {optional && <span className="text-xs text-muted">Optional</span>}
      </div>
      {React.isValidElement(children)
        ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, { id: htmlFor, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })
        : children}
      {error ? <p id={`${htmlFor}-error`} className="text-sm text-danger" role="alert">{error}</p>
        : hint ? <p id={`${htmlFor}-hint`} className="text-sm text-muted">{hint}</p> : null}
    </div>
  );
}
