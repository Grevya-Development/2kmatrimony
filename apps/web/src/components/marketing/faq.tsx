import { Plus } from 'lucide-react';

/** Accessible FAQ using native disclosure elements. */
export function Faq({ items }: { items: { id: string; title: string; body: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="divide-y divide-line rounded-3xl border border-line bg-surface">
      {items.map((f) => (
        <details key={f.id} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-serif text-xl text-ink">
            {f.title}
            <Plus className="h-5 w-5 shrink-0 text-muted transition-transform duration-300 group-open:rotate-45" aria-hidden />
          </summary>
          <p className="mt-3 max-w-3xl text-[0.98rem] leading-relaxed text-ink-2 text-pretty">{f.body}</p>
        </details>
      ))}
    </div>
  );
}
