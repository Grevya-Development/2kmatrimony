import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-redirect';

const ORIGIN = 'https://app.example.com';

describe('safeNextPath', () => {
  it.each([
    ['/\\evil.com'],
    ['/%5Cevil.com'],
    ['/%5cevil.com'],
    ['//evil.com'],
    ['/%2Fevil.com'],
    ['https://evil.com'],
    ['http:evil.com'],
    ['javascript:alert(1)'],
    ['/\tevil.com'],
    ['/\t/evil.com'],
    ['/\n/evil.com'],
    ['/%09/evil.com'],
    ['/%0A/evil.com'],
    ['evil.com'],
    ['%E0%A4%A'], // malformed escape
    [''],
  ])('rejects %j', (input) => {
    expect(safeNextPath(input, ORIGIN)).toBe('/app');
  });

  it('falls back when missing', () => {
    expect(safeNextPath(null, ORIGIN)).toBe('/app');
    expect(safeNextPath(undefined, ORIGIN, '/login')).toBe('/login');
  });

  it.each([
    ['/app', '/app'],
    ['/app/billing', '/app/billing'],
    ['/family/accept?token=abc%2Fdef', '/family/accept?token=abc%2Fdef'],
    ['/app/messages/123#latest', '/app/messages/123#latest'],
    ['/auth/reset', '/auth/reset'],
  ])('keeps same-origin path %j', (input, expected) => {
    const out = safeNextPath(input, ORIGIN);
    expect(out).toBe(expected);
    expect(new URL(out, ORIGIN).origin).toBe(ORIGIN);
  });
});
