import { expect, test, type Browser, type Page } from '@playwright/test';
import { admin, completeProfileViaApi, signInWithPhone, trackPageErrors } from './support';

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
  await a.getByRole('button', { name: 'Continue', exact: true }).click();

  // The whole quick onboarding through the UI: essentials, who she hopes to meet, photo (skipped)
  await expect(a.getByText('Step 1 of 3')).toBeVisible();
  await a.getByLabel('First name').fill('Ananya');
  await a.getByLabel('Date of birth').fill('1996-04-12');
  await a.getByRole('radio', { name: 'Woman' }).click();
  await a.getByRole('radio', { name: 'Never married' }).click();
  await a.getByLabel('City you live in').fill('Bengaluru');
  await a.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(a.getByRole('heading', { name: /who are you hoping to meet/i })).toBeVisible();
  await expect(a.getByText('Step 2 of 3')).toBeVisible();
  await a.getByRole('button', { name: 'Continue', exact: true }).click(); // prefilled: men, age around hers

  await expect(a.getByRole('heading', { name: /add a photo/i })).toBeVisible();
  await a.getByRole('button', { name: 'Skip for now' }).click();

  await expect(a.getByText('Your profile is with our team')).toBeVisible();
  await expect(a.getByRole('heading', { name: /while you wait/i })).toBeVisible();
  await expect(a.getByRole('link', { name: /values & future plans/i })).toHaveAttribute('href', '/app/profile?edit=values');
  const { data: quick } = await admin().from('profiles').select('status').eq('first_name', 'Ananya').order('created_at', { ascending: false }).limit(1).single();
  expect(quick?.status).toBe('in_review');

  // A checklist item opens that section's editor directly
  await a.getByRole('link', { name: /values & future plans/i }).click();
  await expect(a).toHaveURL(/\/app\/profile\?edit=values/);
  await expect(a.getByRole('dialog', { name: 'Values & future' })).toBeVisible();
  await a.keyboard.press('Escape');
  await expect(a).toHaveURL(/\/app\/profile$/);
  await expect(a.locator('#photos')).toBeVisible();

  // Later: the rest of the profile, via the same APIs the profile editor calls
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
  await b.getByRole('button', { name: 'Continue', exact: true }).click();
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
