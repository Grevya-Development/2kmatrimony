import { expect, test } from '@playwright/test';
import { loadEnv } from './env';

loadEnv();
const configured = !!process.env.NEXT_PUBLIC_POSTHOG_KEY;

/** DPDP: no PostHog traffic before an explicit choice; the choice is remembered. */
test.describe('product analytics consent', () => {
  test.skip(!configured, 'PostHog key not configured for this build');
  test.use({ storageState: { cookies: [], origins: [] } });

  test('no analytics requests before consent or after declining', async ({ page }) => {
    const hits: string[] = [];
    page.on('request', (r) => { if (r.url().includes('/ingest/')) hits.push(r.url()); });
    await page.goto('/');
    const banner = page.getByRole('dialog', { name: /help us improve/i });
    await expect(banner).toBeVisible();
    await page.waitForTimeout(1000);
    expect(hits).toEqual([]);
    await page.getByRole('button', { name: 'No thanks' }).click();
    await expect(banner).toBeHidden();
    await page.goto('/pricing');
    await page.waitForTimeout(1000);
    expect(hits).toEqual([]);
    await expect(page.getByRole('dialog', { name: /help us improve/i })).toBeHidden();
  });

  test('allowing loads analytics through the first-party proxy only', async ({ page }) => {
    const urls: string[] = [];
    page.on('request', (r) => { if (/posthog|\/ingest\//.test(r.url())) urls.push(r.url()); });
    await page.goto('/');
    await page.getByRole('button', { name: 'Allow' }).click();
    await expect.poll(() => urls.length, { timeout: 10_000 }).toBeGreaterThan(0);
    expect(urls.every((u) => u.startsWith('http://localhost:3100/ingest/'))).toBe(true);
  });
});
