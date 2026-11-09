'use client';
import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import * as SliderPrimitive from '@radix-ui/react-slider';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Switch = React.forwardRef<React.ElementRef<typeof SwitchPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>>(
  ({ className, ...props }, ref) => (
    <SwitchPrimitive.Root ref={ref} className={cn('peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-line-strong transition-colors data-[state=checked]:bg-burgundy-600 disabled:opacity-50', className)} {...props}>
      <SwitchPrimitive.Thumb className="block h-5 w-5 rounded-full bg-white shadow-soft transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  ),
);
Switch.displayName = 'Switch';

export const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>>(
  ({ className, ...props }, ref) => (
    <CheckboxPrimitive.Root ref={ref} className={cn('peer h-5 w-5 shrink-0 rounded-md border border-line-strong bg-surface data-[state=checked]:border-burgundy-600 data-[state=checked]:bg-burgundy-600 data-[state=checked]:text-white', className)} {...props}>
      <CheckboxPrimitive.Indicator className="flex items-center justify-center"><Check className="h-3.5 w-3.5" strokeWidth={3} /></CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  ),
);
Checkbox.displayName = 'Checkbox';

export const Slider = React.forwardRef<React.ElementRef<typeof SliderPrimitive.Root>, React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & { thumbLabels?: string[] }>(
  ({ className, thumbLabels, ...props }, ref) => {
    const count = (props.value ?? props.defaultValue ?? [0]).length;
    return (
      <SliderPrimitive.Root ref={ref} className={cn('relative flex w-full touch-none select-none items-center py-2', className)} {...props}>
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-line">
          <SliderPrimitive.Range className="absolute h-full bg-burgundy-500" />
        </SliderPrimitive.Track>
        {Array.from({ length: count }).map((_, i) => (
          <SliderPrimitive.Thumb key={i} aria-label={thumbLabels?.[i]} className="block h-5 w-5 rounded-full border-2 border-burgundy-600 bg-white shadow-soft transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-burgundy-500" />
        ))}
      </SliderPrimitive.Root>
    );
  },
);
Slider.displayName = 'Slider';

export const Progress = ({ value, className, label }: { value: number; className?: string; label?: string }) => (
  <ProgressPrimitive.Root value={value} aria-label={label} className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-line', className)}>
    <ProgressPrimitive.Indicator className="h-full bg-burgundy-500 transition-transform duration-500 ease-(--ease-out-soft)" style={{ transform: `translateX(-${100 - Math.max(0, Math.min(100, value))}%)` }} />
  </ProgressPrimitive.Root>
);

export function Avatar({ src, name, className, blurred }: { src?: string | null; name: string; className?: string; blurred?: boolean }) {
  const initials = name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return (
    <AvatarPrimitive.Root className={cn('relative inline-flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-champagne-100', className)}>
      {src && <AvatarPrimitive.Image src={src} alt="" className="h-full w-full object-cover" />}
      <AvatarPrimitive.Fallback className={cn('flex h-full w-full items-center justify-center font-serif text-champagne-600', blurred && 'blur-[1px]')}>{initials || '·'}</AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

export const Tabs = TabsPrimitive.Root;
export const TabsList = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List className={cn('inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1', className)} {...props} />
);
export const TabsTrigger = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger className={cn('rounded-full px-4 py-1.5 text-sm font-medium text-muted transition-colors data-[state=active]:bg-ink data-[state=active]:text-canvas hover:text-ink', className)} {...props} />
);
export const TabsContent = ({ className, ...props }: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content className={cn('mt-6 focus-visible:outline-none', className)} {...props} />
);

export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content sideOffset={6} className="z-50 max-w-xs rounded-lg bg-ink px-3 py-2 text-xs text-canvas shadow-lift">{content}</TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

export const Skeleton = ({ className }: { className?: string }) => <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} aria-hidden />;

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return <span role="status" aria-label={label} className={cn('inline-block h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-burgundy-600', className)} />;
}
