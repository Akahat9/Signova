const { test, expect } = require('@playwright/test');
const admin = require('../../Backend (Node.js)/node_modules/firebase-admin');

const projectId = 'signova-6e929';
const password = 'Signova-auth-e2e-2026!';

async function getOobCodes() {
  const response = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/oobCodes`);
  if (!response.ok) throw new Error(`Auth emulator OOB lookup failed with ${response.status}`);
  return (await response.json()).oobCodes || [];
}

test('real signup, verification gate, login, logout, and password recovery use Firebase Auth', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'Authentication behavior runs once; mobile auth layout is covered separately.');
  test.setTimeout(120_000);
  if (!admin.apps.length) admin.initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

  const suffix = `${Date.now()}-${testInfo.workerIndex}`;
  const email = `auth-flow-${suffix}@example.test`;
  const username = `@auth.flow.${String(Date.now()).slice(-6)}`;

  await page.goto('/?uiTest=auth&authFlow=real');
  await expect(page.getByRole('main', { name: 'Signova authentication' })).toBeVisible();
  await page.getByPlaceholder('Your Signova name').fill('Auth Flow User');
  await page.getByPlaceholder('@your.signova').fill(username);
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.getByPlaceholder('Confirm your password').fill(password);
  await page.getByRole('button', { name: /Create account/ }).click();
  await expect(page.getByText(/Account created\. Verify the link sent to your email|Account created\. Verification email was sent/)).toBeVisible({ timeout: 30_000 });

  let createdUser;
  await expect.poll(async () => {
    createdUser = await admin.auth().getUserByEmail(email).catch(() => null);
    return createdUser?.emailVerified;
  }, { timeout: 15_000 }).toBe(false);
  const profile = await admin.firestore().collection('users').doc(createdUser.uid).get();
  expect(profile.exists).toBe(true);
  expect(profile.data().username).toBe(username);
  await expect.poll(async () => (await getOobCodes()).some((code) => (
    code.email === email && code.requestType === 'VERIFY_EMAIL'
  )), { timeout: 10_000 }).toBe(true);

  await admin.auth().updateUser(createdUser.uid, { emailVerified: true });
  await page.locator('.signovaAuthTabs').getByRole('button', { name: 'Login', exact: true }).click();
  await page.getByPlaceholder('Enter your email').fill(email);
  await page.getByPlaceholder('Enter your password').fill(password);
  await page.locator('.signovaAuthForm .signovaAuthPrimary').click();
  await expect(page.getByLabel('Signova app navigation')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.messengerShell')).toHaveAttribute('data-e2e-auth-uid', createdUser.uid);

  await page.getByRole('button', { name: 'Settings', exact: true }).first().click();
  await page.locator('.settingsDesktopSidebar').getByRole('button', { name: /Account/ }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page.getByText('Welcome Back!', { exact: false })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: 'Forgot Password?', exact: true }).click();
  await page.getByPlaceholder('Enter your account email').fill(email);
  await page.getByRole('button', { name: /Send recovery email/ }).click();
  await expect(page.getByText('If this account exists, a password reset email has been sent.')).toBeVisible();
  await expect.poll(async () => (await getOobCodes()).some((code) => (
    code.email === email && code.requestType === 'PASSWORD_RESET'
  )), { timeout: 10_000 }).toBe(true);
});
