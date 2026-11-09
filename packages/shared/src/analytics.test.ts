import { describe, expect, it } from 'vitest';
import { sanitizeAnalyticsProps, scrubString } from './analytics';

describe('analytics privacy', () => {
  it('scrubs ids, emails and phone numbers from URLs', () => {
    expect(scrubString('/app/profile/3f2b8c1e-9a4d-4c2b-8f1e-1234567890ab?ref=x')).toBe('/app/profile/:id?ref=x');
    expect(scrubString('mailto:ananya@example.com')).toBe('mailto:[email]');
    expect(scrubString('call +91 98765 43210 now')).toBe('call [phone] now');
  });
  it('drops personal and sensitive keys and non-primitive values', () => {
    const out = sanitizeAnalyticsProps({
      plan: 'premium', count: 3, ok: true,
      email: 'a@b.com', first_name: 'A', message_body: 'hi', search_query: 'x', religion: 'y', income_range: 'z',
      nested: { a: 1 }, list: [1, 2],
      path: '/app/messages/3f2b8c1e-9a4d-4c2b-8f1e-1234567890ab',
    });
    expect(out).toEqual({ plan: 'premium', count: 3, ok: true, path: '/app/messages/:id' });
  });
  it('handles empty input', () => {
    expect(sanitizeAnalyticsProps(undefined)).toEqual({});
  });
});
