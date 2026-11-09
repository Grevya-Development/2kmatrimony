/** Video intro length validation (pure — unit tested). Picker durations are in milliseconds. */
export type VideoLengthCheck = { ok: true; seconds: number } | { ok: false; seconds: number | null; message: string };

export function checkVideoLength(durationMs: number | null | undefined, minSeconds: number, maxSeconds: number): VideoLengthCheck {
  if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) {
    return { ok: false, seconds: null, message: 'We couldn’t read this video’s length. Please try a different video.' };
  }
  const seconds = Math.round(durationMs / 1000);
  if (seconds < minSeconds || seconds > maxSeconds) {
    return { ok: false, seconds, message: `Introduction videos should be ${minSeconds}–${maxSeconds} seconds. This one is ${seconds}s.` };
  }
  return { ok: true, seconds };
}
