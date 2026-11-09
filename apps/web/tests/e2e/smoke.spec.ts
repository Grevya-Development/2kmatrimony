import { expect, test } from '@playwright/test';
import { admin, completeProfileViaApi, signInWithPhone, trackPageErrors } from './support';

const PUBLIC = ['/', '/legal/terms', '/legal/privacy', '/login'];
const MEMBER = ['/app', '/app/discover', '/app/matchmaker', '/app/interests', '/app/messages', '/app/connections', '/app/shortlist',
  '/app/notifications', '/app/profile', '/app/dna', '/app/readiness', '/app/family', '/app/verification', '/app/billing', '/app/settings', '/app/support'];
const ADMIN = ['/admin', '/admin/users', '/admin/screening', '/admin/introductions', '/admin/profiles', '/admin/verification', '/admin/moderation', '/admin/support', '/admin/matching',
  '/admin/ai', '/admin/analytics', '/admin/subscriptions', '/admin/payments', '/admin/content', '/admin/notifications', '/admin/config', '/admin/audit', '/admin/super'];

const crashText = /Application error|Something went wrong|Unhandled Runtime Error|This page could not be found/i;

test('public pages render', async ({ page }) => {
  const errs = trackPageErrors(page);
  for (const path of PUBLIC) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBeLessThan(400);
    await expect(page.locator('body')).not.toHaveText(crashText);
  }
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Hand-picked matches. A meaningful beginning.' })).toBeVisible();
  await expect(page.getByRole('form', { name: 'Start your search' })).toBeVisible();
  const pricing = await page.goto('/pricing');
  expect(new URL(pricing!.url()).pathname).toBe('/'); // pricing removed: permanent redirect home
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Find Your Match' }).first()).toBeVisible();
  expect(errs, errs.join('\n')).toEqual([]);
});

test('signed-out visitors are redirected from protected areas', async ({ page }) => {
  for (const path of ['/app', '/admin', '/onboarding']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
});

test('every member and admin page renders for a super admin member', async ({ page }) => {
  const errs = trackPageErrors(page);
  await signInWithPhone(page, '9000000003');
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole('radio', { name: 'Myself' }).click();
  await page.locator('#terms').click();
  await page.getByRole('button', { name: /let.s begin/i }).click();
  await expect(page.getByLabel('First name')).toBeVisible();
  await completeProfileViaApi(page, { firstName: 'Meera', gender: 'female', seeking: 'male', dob: '1993-01-20', city: 'Chennai' });

  // Promote to super admin (MFA requirement disabled for this local test admin row)
  const a = admin();
  const { data: user } = await a.from('app_users').select('id').eq('phone', '919000000003').single();
  const { data: role } = await a.from('admin_roles').select('id').eq('key', 'super_admin').single();
  await a.from('admin_users').upsert({ user_id: user!.id, role_id: role!.id, display_name: 'E2E Admin', mfa_required: false });

  const failures: string[] = [];
  for (const path of [...MEMBER, ...ADMIN]) {
    const res = await page.goto(path);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    const status = res?.status() ?? 0;
    const crashed = await page.locator('body').getByText(crashText).count();
    if (status >= 400 || crashed > 0) failures.push(`${path} status=${status} crash=${crashed}`);
  }
  expect(failures, failures.join('\n')).toEqual([]);
  expect(errs, errs.join('\n')).toEqual([]);
});
