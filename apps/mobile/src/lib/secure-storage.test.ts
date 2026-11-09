import { describe, expect, it } from 'vitest';
import { createChunkedStorage, sanitizeKey, type KeyValueStore } from './secure-storage';

function memoryStore() {
  const m = new Map<string, string>();
  const store: KeyValueStore = {
    getItem: async (k) => m.get(k) ?? null,
    setItem: async (k, v) => { if (!/^[\w.-]+$/.test(k)) throw new Error(`bad key ${k}`); m.set(k, v); },
    removeItem: async (k) => { m.delete(k); },
  };
  return { m, store };
}

describe('createChunkedStorage', () => {
  it('stores small values directly', async () => {
    const { m, store } = memoryStore();
    const s = createChunkedStorage(store, 10);
    await s.setItem('sb-auth', 'short');
    expect(m.get('sb-auth')).toBe('short');
    expect(await s.getItem('sb-auth')).toBe('short');
  });

  it('chunks large values and reassembles them', async () => {
    const { m, store } = memoryStore();
    const s = createChunkedStorage(store, 10);
    const big = 'x'.repeat(25) + 'END';
    await s.setItem('session', big);
    expect(m.get('session')).toBe('__chunked__:3');
    expect(m.get('session.0')).toHaveLength(10);
    expect(await s.getItem('session')).toBe(big);
  });

  it('cleans old chunks when overwritten with a smaller value and on remove', async () => {
    const { m, store } = memoryStore();
    const s = createChunkedStorage(store, 5);
    await s.setItem('k', 'abcdefghijkl');
    await s.setItem('k', 'abc');
    expect([...m.keys()]).toEqual(['k']);
    await s.setItem('k', 'abcdefghijkl');
    await s.removeItem('k');
    expect(m.size).toBe(0);
  });

  it('returns null when a chunk is missing', async () => {
    const { m, store } = memoryStore();
    const s = createChunkedStorage(store, 4);
    await s.setItem('k', '123456789');
    m.delete('k.1');
    expect(await s.getItem('k')).toBeNull();
  });

  it('sanitizes keys that SecureStore would reject', async () => {
    expect(sanitizeKey('sb-127.0.0.1:56321-auth-token')).toBe('sb-127.0.0.1_56321-auth-token');
    const { store } = memoryStore();
    const s = createChunkedStorage(store, 4);
    await s.setItem('a:b/c', 'value-that-is-long');
    expect(await s.getItem('a:b/c')).toBe('value-that-is-long');
  });
});
