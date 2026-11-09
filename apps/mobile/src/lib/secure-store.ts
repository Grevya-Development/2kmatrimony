import * as SecureStore from 'expo-secure-store';
import { createChunkedStorage, type KeyValueStore } from './secure-storage';

const options: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

const base: KeyValueStore = {
  getItem: (k) => SecureStore.getItemAsync(k, options),
  setItem: (k, v) => SecureStore.setItemAsync(k, v, options),
  removeItem: (k) => SecureStore.deleteItemAsync(k, options),
};

/** Encrypted (Keychain / Android Keystore) storage with chunking for large values. */
export const secureStorage = createChunkedStorage(base);

/** Small app preferences that should also live in secure storage. */
export const securePrefs = {
  get: (key: string) => SecureStore.getItemAsync(key, options),
  set: (key: string, value: string) => SecureStore.setItemAsync(key, value, options),
  remove: (key: string) => SecureStore.deleteItemAsync(key, options),
};
