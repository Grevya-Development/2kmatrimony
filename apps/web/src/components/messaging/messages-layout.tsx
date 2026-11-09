'use client';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ConversationList } from './conversation-list';

/** Two panes on desktop; on mobile the list and the thread are separate screens. */
export function MessagesLayout({ children }: { children: React.ReactNode }) {
  const inThread = usePathname() !== '/app/messages';
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <ConversationList className={cn(inThread && 'hidden lg:flex')} />
      <section className={cn('min-w-0', !inThread && 'hidden lg:block')}>{children}</section>
    </div>
  );
}
