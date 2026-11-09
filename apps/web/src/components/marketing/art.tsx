/** Decorative line-art and illustrative visuals for marketing pages (aria-hidden, no real member data). */
import { DNA_DIMENSION_META, SCORE_DIMENSION_LABELS } from '@2k/shared';

export function RingsArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 420" fill="none" className={className} aria-hidden>
      <circle cx="205" cy="210" r="150" stroke="var(--color-champagne-400)" strokeWidth="1.25" />
      <circle cx="315" cy="210" r="150" stroke="var(--color-burgundy-500)" strokeWidth="1.25" />
      <circle cx="205" cy="210" r="112" stroke="var(--color-champagne-200)" strokeWidth="1" strokeDasharray="2 6" />
      <circle cx="315" cy="210" r="112" stroke="var(--color-burgundy-200)" strokeWidth="1" strokeDasharray="2 6" />
      <path d="M260 85c32 33 50 77 50 125s-18 92-50 125c-32-33-50-77-50-125s18-92 50-125Z" fill="var(--color-champagne-100)" fillOpacity="0.7" />
      <circle cx="260" cy="210" r="5" fill="var(--color-burgundy-600)" />
      <circle cx="260" cy="85" r="3" fill="var(--color-champagne-600)" />
      <circle cx="260" cy="335" r="3" fill="var(--color-champagne-600)" />
    </svg>
  );
}

/** Illustrative compatibility card (labelled as an illustration; no member data). */
export function CompatibilityIllustration() {
  const rows: { key: keyof typeof SCORE_DIMENSION_LABELS; you: number; them: number }[] = [
    { key: 'values', you: 92, them: 88 },
    { key: 'future', you: 84, them: 90 },
    { key: 'lifestyle', you: 76, them: 71 },
    { key: 'family', you: 68, them: 80 },
  ];
  return (
    <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-6 shadow-lift" aria-label="Illustration of a mutual compatibility summary" role="img">
      <div className="flex items-center justify-between">
        <p className="eyebrow">Illustration</p>
        <span className="rounded-full bg-burgundy-50 px-3 py-1 text-xs font-medium text-burgundy-700">Strong alignment</span>
      </div>
      <p className="mt-4 font-serif text-2xl leading-snug">Measured in both directions</p>
      <div className="mt-5 space-y-4">
        {rows.map((r) => (
          <div key={r.key}>
            <div className="mb-1.5 flex justify-between text-xs text-muted"><span>{SCORE_DIMENSION_LABELS[r.key]}</span><span>for you · for them</span></div>
            <div className="flex gap-1.5">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-burgundy-500" style={{ width: `${r.you}%` }} /></div>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-champagne-400" style={{ width: `${r.them}%` }} /></div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">
        <p className="font-medium text-ink">Worth discussing</p>
        <p className="mt-1">Different plans for where to settle long-term.</p>
      </div>
    </div>
  );
}

/** Mini Relationship DNA spectrum visual. */
export function DnaSpectrumIllustration() {
  const dims: { key: keyof typeof DNA_DIMENSION_META; a: number; b: number }[] = [
    { key: 'communication', a: 62, b: 70 },
    { key: 'independence', a: 40, b: 48 },
    { key: 'career_ambition', a: 78, b: 64 },
    { key: 'lifestyle_pace', a: 35, b: 58 },
  ];
  return (
    <div className="space-y-5" role="img" aria-label="Illustration of Relationship DNA spectrums">
      {dims.map((d) => {
        const meta = DNA_DIMENSION_META[d.key];
        return (
          <div key={d.key}>
            <p className="mb-2 text-sm font-medium text-ink">{meta.label}</p>
            <div className="relative h-1.5 rounded-full bg-line">
              <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-burgundy-600 shadow-soft" style={{ left: `${d.a}%` }} />
              <span className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-champagne-400 shadow-soft" style={{ left: `${d.b}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between text-xs text-muted"><span>{meta.left}</span><span>{meta.right}</span></div>
          </div>
        );
      })}
      <div className="flex gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-burgundy-600" />You</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-champagne-400" />A connection</span>
      </div>
    </div>
  );
}
