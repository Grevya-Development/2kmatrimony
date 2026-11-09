import { describe, expect, it } from 'vitest';
import { hrefToRoute, splitLink } from './deeplinks';

describe('splitLink', () => {
  it('handles custom scheme, https and expo urls', () => {
    expect(splitLink('twokmatrimony://messages/abc?x=1')).toEqual({ path: 'messages/abc', query: 'x=1' });
    expect(splitLink('https://app.example.com/app/profile/123')).toEqual({ path: 'app/profile/123', query: '' });
    expect(splitLink('exp://192.168.1.2:8081/--/auth/callback?code=z')).toEqual({ path: 'auth/callback', query: 'code=z' });
    expect(splitLink('/app/interests')).toEqual({ path: 'app/interests', query: '' });
  });
});

describe('hrefToRoute', () => {
  it('maps web app paths used in notification data', () => {
    expect(hrefToRoute('/app')).toBe('/');
    expect(hrefToRoute('/app/interests')).toBe('/interests');
    expect(hrefToRoute('/app/messages/5b1c')).toBe('/chat/5b1c');
    expect(hrefToRoute('/app/profile/9f2a')).toBe('/member/9f2a');
    expect(hrefToRoute('/app/profile')).toBe('/me');
    expect(hrefToRoute('/app/connections/c1')).toBe('/connections/c1');
    expect(hrefToRoute('/app/dna')).toBe('/me/dna');
    expect(hrefToRoute('/app/readiness')).toBe('/readiness');
  });
  it('maps deep links', () => {
    expect(hrefToRoute('twokmatrimony://profile/abc')).toBe('/member/abc');
    expect(hrefToRoute('twokmatrimony://messages/abc')).toBe('/chat/abc');
    expect(hrefToRoute('twokmatrimony://family/accept?token=tok123')).toBe('/family/accept?token=tok123');
    expect(hrefToRoute('twokmatrimony://auth/callback?code=xyz')).toBe('/auth/callback?code=xyz');
  });
  it('rejects unknown or malformed links', () => {
    expect(hrefToRoute('/admin/users')).toBeNull();
    expect(hrefToRoute('twokmatrimony://profile/../etc')).toBeNull();
    expect(hrefToRoute(null)).toBeNull();
  });
});
