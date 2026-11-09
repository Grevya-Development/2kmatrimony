import { Brand } from '@/components/shell/brand';

/** Minimal shell for family-circle pages (invitees may not have a profile of their own). */
export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-line/70 bg-canvas/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6"><Brand /></div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
