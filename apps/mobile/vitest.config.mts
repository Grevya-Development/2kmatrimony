import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit tests cover pure logic in src/lib (no React Native imports in tested modules).
export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
});
