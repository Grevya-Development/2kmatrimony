import { defineConfig, devices } from '@playwright/test';

const HOSTED = process.env.E2E_TARGET === 'hosted';
const PORT = Number(process.env.E2E_PORT ?? (HOSTED ? 3300 : 3100));

/**
 * E2E against a production build (`npm run build` first) and the LOCAL Supabase
 * stack. Uses the locally installed Google Chrome (channel: 'chrome').
 * Phone sign-in uses the fixed local test OTP numbers from supabase/config.toml.
 *
 * HOSTED mode (`E2E_TARGET=hosted`, after `npm run build:hosted`): runs only
 * hosted.spec.ts against the hosted Supabase project with email users that are
 * created and deleted by the test itself.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: HOSTED ? undefined : './tests/e2e/global-setup.ts',
  ...(HOSTED ? { testMatch: /hosted\.spec\.ts$/ } : { testIgnore: /hosted\.spec\.ts$/ }),
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: 'chrome',
    // Analytics consent already decided (declined) so the banner never covers UI under test.
    storageState: 'tests/e2e/storage-state.json',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: 'chrome' } },
  ],
  webServer: {
    command: HOSTED ? `npm run start:hosted` : `npx next start -p ${PORT}`,
    env: { PORT: String(PORT) },
    url: `http://localhost:${PORT}/api/v1/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
