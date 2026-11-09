'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Bell, LogOut, Shield } from 'lucide-react';
import type { MeResponse } from '@2k/shared';
import { Avatar } from '@/components/ui';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';
import { Brand } from './brand';
import { NavIcon } from './icon';
import { MeProvider, useMe } from './me-context';
import { MEMBER_MENU_NAV, MEMBER_PRIMARY_NAV, type NavItem } from './nav-config';

const isActive = (path: string, href: string) => (href === '/app' ? path === '/app' : path === href || path.startsWith(`${href}/`));
const visible = (items: NavItem[], flags: Record<string, boolean>) => items.filter((i) => !i.flag || flags[i.flag] !== false);

function Shell({ children }: { children: React.ReactNode }) {
  const { me } = useMe();
  const path = usePathname();
  const router = useRouter();
  const primary = visible(MEMBER_PRIMARY_NAV, me.featureFlags);
  const menu = visible(MEMBER_MENU_NAV, me.featureFlags);
  const name = me.profile?.firstName ?? me.user.fullName ?? 'You';

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Brand href="/app" logoClassName="h-10 sm:h-11" />
          <nav aria-label="Primary" className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {primary.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isActive(path, item.href) ? 'page' : undefined}
                className={cn('rounded-full px-4 py-2 text-sm transition-colors', isActive(path, item.href) ? 'bg-ink text-canvas' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1 md:ml-0">
            <Link href="/app/notifications" className="relative rounded-full p-2.5 text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={`Notifications${me.unreadNotifications ? `, ${me.unreadNotifications} unread` : ''}`}>
              <Bell className="h-5 w-5" />
              {me.unreadNotifications > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-600" />}
            </Link>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className="rounded-full p-1 hover:bg-surface-2" aria-label="Account menu">
                <Avatar src={me.profile?.primaryPhotoUrl} name={name} className="h-9 w-9" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-64 rounded-2xl border border-line bg-surface p-2 shadow-lift">
                  <div className="px-3 py-2">
                    <p className="font-serif text-lg leading-tight">{name}</p>
                    <p className="text-xs text-muted">{me.plan.name} plan{me.profile ? ` · ${me.profile.profileCode}` : ''}</p>
                  </div>
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                  {menu.map((item) => (
                    <DropdownMenu.Item key={item.href} asChild>
                      <Link href={item.href} className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-2 outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-ink">
                        <NavIcon name={item.icon} className="h-4 w-4" />{item.label}
                      </Link>
                    </DropdownMenu.Item>
                  ))}
                  {me.admin && (
                    <DropdownMenu.Item asChild>
                      <Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-emerald-700 outline-none data-[highlighted]:bg-emerald-50"><Shield className="h-4 w-4" />Admin panel</Link>
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                  <DropdownMenu.Item onSelect={signOut} className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-ink-2 outline-none data-[highlighted]:bg-surface-2">
                    <LogOut className="h-4 w-4" />Sign out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {primary.slice(0, 5).map((item) => (
            <Link key={item.href} href={item.href} aria-current={isActive(path, item.href) ? 'page' : undefined}
              className={cn('flex flex-col items-center gap-1 py-2.5 text-[0.68rem]', isActive(path, item.href) ? 'text-emerald-600' : 'text-muted')}>
              <NavIcon name={item.icon} className="h-5 w-5" />{item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export function AppShell({ me, children }: { me: MeResponse; children: React.ReactNode }) {
  return <MeProvider initial={me}><Shell>{children}</Shell></MeProvider>;
}
