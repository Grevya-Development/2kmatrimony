import * as React from 'react';
import { cn } from '@/lib/utils';

const base =
  'w-full rounded-xl border border-line bg-surface px-4 text-[0.95rem] text-ink placeholder:text-muted/70 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:opacity-60 aria-[invalid=true]:border-danger';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(base, 'h-12', className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, 'min-h-28 py-3 leading-relaxed', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(base, 'h-12 appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%278%27 fill=%27none%27><path d=%27M1 1.5l5 5 5-5%27 stroke=%27%2377706a%27 stroke-width=%271.5%27/></svg>")] bg-[right_1rem_center] bg-no-repeat pr-10', className)} {...props}>
    {children}
  </select>
));
NativeSelect.displayName = 'NativeSelect';
