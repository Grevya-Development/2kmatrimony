import { useSyncExternalStore } from 'react';

/** Lightweight online/offline signal derived from API request outcomes. */
let online = true;
const listeners = new Set<() => void>();

export function setOnline(value: boolean) {
  if (online === value) return;
  online = value;
  listeners.forEach((l) => l());
}

export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    () => online,
    () => true,
  );
}
