import { expect, test, type Browser, type Page } from '@playwright/test';
import { completeProfileViaApi, signInWithPhone, trackPageErrors } from './support';

/**
 * Core journey: Registration → Onboarding → Profile → Discovery → Match →
 * Interest → Mutual connection → Messaging → Subscription page.
 * Two members (A: 9000000001, B: 9000000002) in separate browser contexts.
 */
test.describe.configure({ mode: 'serial' });

let a: Page;
let b: Page;
const errors: string[] = [];

async function member(browser: Browser) {
  const ctx = await browser.newContext({ storageState: 'tests/e2e/storage-state.json' });
  const page = await ctx.newPage();
  errors.push(...[]);
  const errs = trackPageErrors(page);
  page.on('close', () => errors.push(...errs));
  return { page, errs };
}

test('A registers by phone OTP and starts onboarding through the UI', async ({ browser }) => {
  const m = await member(browser);
  a = m.page;
  await signInWithPhone(a, '9000000001');
  await expect(a).toHaveURL(/\/onboarding/);
  await a.getByRole('radio', { name: 'Myself' }).click();
  await a.locator('#terms').click();
  await a.getByRole('button', { name: /let.s begin/i }).click();

  // Basics step through the UI
  await expect(a.getByLabel('First name')).toBeVisible();
  await a.getByLabel('First name').fill('Ananya');
  await a.getByLabel('Date of birth').fill('1996-04-12');
  await a.getByRole('radio', { name: 'Woman' }).click();
  await a.getByRole('radio', { name: 'Never married' }).click();
  await a.getByLabel('Current city').fill('Bengaluru');
  await a.getByRole('button', { name: 'Continue' }).click();
  await expect(a.getByText(/education/i).first()).toBeVisible();

  // Remaining sections via the same API the wizard calls
  const prefs = await completeProfileViaApi(a, { firstName: 'Ananya', gender: 'female', seeking: 'male', dob: '1996-04-12', city: 'Bengaluru' });
  expect(prefs.completion.canActivate).toBe(true);
  expect(m.errs, m.errs.join('\n')).toEqual([]);
});

test('B registers and completes a profile', async ({ browser }) => {
  const m = await member(browser);
  b = m.page;
  await signInWithPhone(b, '9000000002');
  await expect(b).toHaveURL(/\/onboarding/);
  await b.getByRole('radio', { name: 'Myself' }).click();
  await b.locator('#terms').click();
  await b.getByRole('button', { name: /let.s begin/i }).click();
  await expect(b.getByLabel('First name')).toBeVisible();
  const prefs = await completeProfileViaApi(b, { firstName: 'Rohan', gender: 'male', seeking: 'female', dob: '1994-09-03', city: 'Bengaluru' });
  expect(prefs.completion.canActivate).toBe(true);
});

test('A sees B in today\'s recommendations with a compatibility explanation', async () => {
  await a.goto('/app');
  await expect(a.getByText('Rohan').first()).toBeVisible();
  await a.getByText('Rohan').first().click();
  await expect(a).toHaveURL(/\/app\/profile\//);
  await expect(a.getByText(/not a prediction/i).first()).toBeVisible();
});

test('A expresses interest; B accepts and they are connected', async () => {
  await a.getByRole('button', { name: /express interest/i }).first().click();
  const dialogSend = a.getByRole('button', { name: /send interest/i });
  if (await dialogSend.isVisible().catch(() => false)) await dialogSend.click();
  await expect(a.getByText(/interest sent|withdraw/i).first()).toBeVisible();

  await b.goto('/app/interests');
  await expect(b.getByText('Ananya').first()).toBeVisible();
  await b.getByRole('button', { name: /accept/i }).first().click();
  await expect(b.getByText(/connected|message/i).first()).toBeVisible();
});

test('A and B exchange messages in real time', async () => {
  await b.goto('/app/messages');
  await b.getByText('Ananya').first().click();
  await expect(b).toHaveURL(/\/app\/messages\/.+/);
  const convoUrl = b.url();

  await a.goto(convoUrl.replace(/^https?:\/\/[^/]+/, ''));
  const box = a.getByRole('textbox').last();
  await box.fill('Hello Rohan! Lovely to connect.');
  await box.press('Enter');
  const logA = a.getByRole('log');
  const logB = b.getByRole('log');
  await expect(logA.getByText('Hello Rohan! Lovely to connect.')).toBeVisible();
  // B receives it without reloading (Supabase Realtime)
  await expect(logB.getByText('Hello Rohan! Lovely to connect.')).toBeVisible({ timeout: 20_000 });

  // ...and the reply flows back the other way
  const boxB = b.getByRole('textbox').last();
  await boxB.fill('Hi Ananya — likewise!');
  await boxB.press('Enter');
  await expect(logA.getByText('Hi Ananya — likewise!')).toBeVisible({ timeout: 20_000 });
});

test('the platform is free: no billing page, plans or upgrade prompts', async () => {
  await a.goto('/app/billing');
  await expect(a).toHaveURL(/\/app$/);
  await a.getByRole('button', { name: 'Account menu' }).click();
  await expect(a.getByRole('menu')).toBeVisible();
  await expect(a.getByRole('menu').getByText(/plans|billing/i)).toHaveCount(0);
  await a.keyboard.press('Escape');
  await expect(a.locator('body')).not.toContainText(/upgrade|premium plan|see plans/i);
});

test('no uncaught page errors during the journey', async () => {
  await a.close();
  await b.close();
  expect(errors, errors.join('\n')).toEqual([]);
});
