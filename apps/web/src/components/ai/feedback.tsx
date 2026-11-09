'use client';
import * as React from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import type { AiFeature } from '@2k/shared';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/** "Was this helpful?" thumbs, stored via POST /ai/feedback. */
export function AiFeedback({ feature, referenceId, className }: { feature: AiFeature; referenceId?: string; className?: string }) {
  const [sent, setSent] = React.useState<1 | -1 | null>(null);
  const [error, setError] = React.useState(false);
  const send = async (rating: 1 | -1) => {
    setSent(rating);
    setError(false);
    try {
      await api('/ai/feedback', { body: { feature, referenceId, rating } });
    } catch {
      setSent(null);
      setError(true);
    }
  };
  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted', className)} aria-live="polite">
      {sent ? <span>Thanks for the feedback.</span> : (
        <>
          <span>{error ? 'Could not save — try again?' : 'Was this helpful?'}</span>
          <button type="button" onClick={() => send(1)} className="rounded-full p-1.5 hover:bg-surface-2 hover:text-ink" aria-label="Helpful"><ThumbsUp className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => send(-1)} className="rounded-full p-1.5 hover:bg-surface-2 hover:text-ink" aria-label="Not helpful"><ThumbsDown className="h-3.5 w-3.5" /></button>
        </>
      )}
    </div>
  );
}
