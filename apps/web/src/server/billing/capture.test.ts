import { describe, expect, it, vi } from 'vitest';
import { ensureCaptured } from './capture';

const rzp = (over: Partial<{ capture: unknown; fetch: unknown }> = {}) =>
  ({ payments: { capture: vi.fn(), fetch: vi.fn(), ...over } }) as unknown as Parameters<typeof ensureCaptured>[0];

describe('ensureCaptured', () => {
  it('passes captured payments through without calling capture', async () => {
    const r = rzp();
    expect(await ensureCaptured(r, { id: 'pay_1', status: 'captured', method: 'upi' }, 100, 'INR')).toEqual({ status: 'captured', method: 'upi' });
    expect(r.payments.capture).not.toHaveBeenCalled();
  });
  it('captures authorized payments for the exact amount', async () => {
    const capture = vi.fn().mockResolvedValue({ status: 'captured', method: 'card' });
    expect(await ensureCaptured(rzp({ capture }), { id: 'pay_2', status: 'authorized' }, 49900, 'INR')).toEqual({ status: 'captured', method: 'card' });
    expect(capture).toHaveBeenCalledWith('pay_2', 49900, 'INR');
  });
  it('re-fetches when capture races with auto-capture', async () => {
    const capture = vi.fn().mockRejectedValue(new Error('already captured'));
    const fetch = vi.fn().mockResolvedValue({ status: 'captured', method: 'card' });
    expect((await ensureCaptured(rzp({ capture, fetch }), { id: 'pay_3', status: 'authorized' }, 1, 'INR')).status).toBe('captured');
  });
  it('reports non-captured outcomes (never treated as paid)', async () => {
    const capture = vi.fn().mockRejectedValue(new Error('timeout'));
    const fetch = vi.fn().mockResolvedValue({ status: 'authorized' });
    expect((await ensureCaptured(rzp({ capture, fetch }), { id: 'pay_4', status: 'authorized' }, 1, 'INR')).status).toBe('authorized');
    expect((await ensureCaptured(rzp(), { id: 'pay_5', status: 'failed' }, 1, 'INR')).status).toBe('failed');
  });
});
