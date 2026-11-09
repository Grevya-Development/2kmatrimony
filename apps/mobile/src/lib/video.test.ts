import { describe, expect, it } from 'vitest';
import { checkVideoLength } from './video';

describe('checkVideoLength', () => {
  it('accepts videos within range and rounds to seconds', () => {
    expect(checkVideoLength(30_400, 15, 60)).toEqual({ ok: true, seconds: 30 });
    expect(checkVideoLength(14_600, 15, 60)).toEqual({ ok: true, seconds: 15 });
  });
  it('rejects too short, too long and unknown durations', () => {
    expect(checkVideoLength(9_000, 15, 60)).toMatchObject({ ok: false, seconds: 9 });
    expect(checkVideoLength(61_000, 15, 60)).toMatchObject({ ok: false, seconds: 61 });
    expect(checkVideoLength(null, 15, 60)).toMatchObject({ ok: false, seconds: null });
    expect(checkVideoLength(0, 15, 60).ok).toBe(false);
  });
});
