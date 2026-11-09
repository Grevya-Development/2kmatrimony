import { randomUUID } from 'node:crypto';
import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { admin, completeProfileViaApi } from './support';

/**
 * Unlimited E2E members: email + password users created via the admin API,
 * signed in through the REAL login UI ("Use a password instead").
 * Emails end with @e2e.test so they can be cleaned up.
 */
export interface E2EUser { email: string; password: string; userId: string }

export async function createEmailUser(label: string): Promise<E2EUser> {
  const email = `${label}-${randomUUID().slice(0, 8)}@e2e.test`;
  const password = `Pw${randomUUID().slice(0, 12)}9`;
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  return { email, password, userId: data.user.id };
}

export async function signInWithEmail(page: Page, u: E2EUser, next = '/app'): Promise<void> {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  // The Mobile/Email tabs only appear when SMS sign-in is enabled for the project.
  const emailTab = page.getByRole('tab', { name: /email/i });
  const passwordToggle = page.getByRole('button', { name: /use a password instead/i });
  await emailTab.or(passwordToggle).first().waitFor();
  if (await emailTab.isVisible()) await emailTab.click();
  await passwordToggle.click();
  await page.getByLabel('Email').fill(u.email);
  await page.getByLabel('Password').fill(u.password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 90_000 });
}

/** New browser context with analytics consent pre-declined (banner never covers UI). */
export async function newMemberContext(browser: Browser): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ storageState: 'tests/e2e/storage-state.json' });
  return { ctx, page: await ctx.newPage() };
}

/**
 * A fully onboarded, active member (profile completed through the same APIs the
 * wizard uses). The wizard itself is covered by dedicated onboarding tests.
 */
export async function createActiveMember(browser: Browser, opts: { label: string; firstName: string; gender: 'female' | 'male'; seeking: 'female' | 'male'; city?: string; dob?: string }) {
  const user = await createEmailUser(opts.label);
  const { ctx, page } = await newMemberContext(browser);
  await signInWithEmail(page, user, '/onboarding');
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole('radio', { name: 'Myself' }).click();
  await page.locator('#terms').click();
  await page.getByRole('button', { name: /let.s begin/i }).click();
  await expect(page.getByLabel('First name')).toBeVisible({ timeout: 60_000 });
  await completeProfileViaApi(page, { firstName: opts.firstName, gender: opts.gender, seeking: opts.seeking, dob: opts.dob ?? '1995-06-15', city: opts.city ?? 'Bengaluru' });
  const { data: profile } = await admin().from('profiles').select('id, status').eq('owner_user_id', user.userId).single();
  expect(profile?.status).toBe('active');
  return { user, ctx, page, profileId: profile!.id as string };
}

/** Grant an admin role (MFA requirement off for this local test row). */
export async function makeE2EAdmin(userId: string, roleKey = 'super_admin'): Promise<void> {
  const { data: role } = await admin().from('admin_roles').select('id').eq('key', roleKey).single();
  await admin().from('admin_users').upsert({ user_id: userId, role_id: role!.id, display_name: `E2E ${roleKey}`, mfa_required: false });
}

export async function cleanupE2EUsers(): Promise<void> {
  const a = admin();
  for (let page = 1; page < 20; page++) {
    const { data } = await a.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    for (const u of users) {
      if (!u.email?.endsWith('@e2e.test')) continue;
      await a.from('admin_users').delete().eq('user_id', u.id);
      await a.auth.admin.deleteUser(u.id);
    }
    if (users.length < 200) break;
  }
}
