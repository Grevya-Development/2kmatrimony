'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import type { MeResponse } from '@2k/shared';
import { cn } from '@/lib/utils';
import { BrandLogo } from './brand';
import { NavIcon } from './icon';
import { MeProvider } from './me-context';
import { ADMIN_NAV } from './nav-config';

export function AdminShell({ me, children }: { me: MeResponse; children: React.ReactNode }) {
  const path = usePathname();
  const perms = new Set(me.admin?.permissions ?? []);
  const isSuper = perms.has('*');
  const can = (p?: string) => !p || isSuper || perms.has(p);
  const flagOn = (f?: string) => !f || me.featureFlags[f] === true;

  return (
    <MeProvider initial={me}>
      <div className="flex min-h-dvh bg-canvas">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
          <div className="px-6 py-5">
            <BrandLogo className="h-8" />
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-gold-600">Admin console</p>
            <p className="mt-0.5 text-xs capitalize text-muted">{me.admin?.role.replace(/_/g, ' ')}</p>
          </div>
          <nav aria-label="Admin" className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
            {ADMIN_NAV.map((group) => {
              const items = group.items.filter((i) => flagOn(i.flag) && (i.superOnly ? isSuper : can(i.permission)));
              if (items.length === 0) return null;
              return (
                <div key={group.section}>
                  <p className="px-3 pb-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted">{group.section}</p>
                  {items.map((i) => {
                    const active = i.href === '/admin' ? path === '/admin' : path.startsWith(i.href);
                    return (
                      <Link key={i.href} href={i.href} aria-current={active ? 'page' : undefined}
                        className={cn('flex items-center gap-3 rounded-xl px-3 py-2 text-sm', active ? 'bg-ink text-canvas' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
                        <NavIcon name={i.icon} className="h-4 w-4" />{i.label}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>
          <Link href="/app" className="flex items-center gap-2 border-t border-line px-6 py-4 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Back to member app</Link>
        </aside>
        <div className="min-w-0 flex-1">
          <div className="border-b border-line bg-surface px-4 py-3 lg:hidden">
            <select aria-label="Admin section" className="w-full rounded-xl border border-line bg-canvas px-3 py-2 text-sm" value={path} onChange={(e) => { window.location.href = e.target.value; }}>
              {ADMIN_NAV.flatMap((g) => g.items.filter((i) => flagOn(i.flag) && (i.superOnly ? isSuper : can(i.permission)))).map((i) => <option key={i.href} value={i.href}>{i.label}</option>)}
            </select>
          </div>
          <main id="main" className="mx-auto max-w-7xl px-4 py-8 sm:px-8">{children}</main>
        </div>
      </div>
    </MeProvider>
  );
}
