/**
 * Chunked key/value storage. Expo SecureStore warns above ~2KB per value, while
 * a Supabase session (access + refresh token + user) is larger, so values are
 * split across numbered keys. Pure module: the underlying store is injected.
 */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const MARKER = '__chunked__:';

/** SecureStore keys may only contain alphanumerics, ".", "-" and "_". */
export const sanitizeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export function createChunkedStorage(store: KeyValueStore, chunkSize = 1800): KeyValueStore {
  const k = sanitizeKey;

  async function removeChunks(key: string): Promise<void> {
    const head = await store.getItem(k(key));
    if (head?.startsWith(MARKER)) {
      const n = Number(head.slice(MARKER.length)) || 0;
      for (let i = 0; i < n; i++) await store.removeItem(k(`${key}.${i}`));
    }
  }

  return {
    async getItem(key) {
      const head = await store.getItem(k(key));
      if (head === null || !head.startsWith(MARKER)) return head;
      const n = Number(head.slice(MARKER.length)) || 0;
      const parts: string[] = [];
      for (let i = 0; i < n; i++) {
        const part = await store.getItem(k(`${key}.${i}`));
        if (part === null) return null; // corrupted / partially written — treat as missing
        parts.push(part);
      }
      return parts.join('');
    },
    async setItem(key, value) {
      await removeChunks(key);
      if (value.length <= chunkSize) {
        await store.setItem(k(key), value);
        return;
      }
      const n = Math.ceil(value.length / chunkSize);
      for (let i = 0; i < n; i++) await store.setItem(k(`${key}.${i}`), value.slice(i * chunkSize, (i + 1) * chunkSize));
      await store.setItem(k(key), `${MARKER}${n}`);
    },
    async removeItem(key) {
      await removeChunks(key);
      await store.removeItem(k(key));
    },
  };
}
