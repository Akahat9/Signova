const { test, expect } = require('@playwright/test');

function watchRuntimeErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    const text = message.text();
    const isExpectedOfflineApi = text.includes("http://127.0.0.1:5000/api/") && text.includes('CORS policy');
    if (message.type() === 'error' && !text.startsWith('Failed to load resource:') && !isExpectedOfflineApi) errors.push(text);
  });
  page.on('requestfailed', (request) => {
    const url = new URL(request.url());
    if (url.origin === 'http://127.0.0.1:4173') errors.push(`Same-origin resource failed: ${url.pathname}`);
  });
  return errors;
}

test('authentication shell switches between signup, login, and recovery without runtime errors', async ({ page }, testInfo) => {
  test.setTimeout(45_000);
  const runtimeErrors = watchRuntimeErrors(page);
  await page.goto('/?uiTest=auth');
  await expect(page.getByRole('main', { name: 'Signova authentication' })).toBeVisible();
  await expect(page.getByText('Create your Signova account', { exact: false })).toBeVisible();
  await expect(page.getByPlaceholder('Your Signova name')).toBeVisible();

  await page.locator('.signovaAuthTabs').getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByText('Welcome Back!', { exact: false })).toBeVisible();
  await expect(page.getByPlaceholder('Enter your email')).toBeVisible();
  await expect(page.getByPlaceholder('Enter your password')).toBeVisible();

  await page.getByRole('button', { name: 'Forgot Password?', exact: true }).click();
  await expect(page.getByText('Recover Signova access', { exact: false })).toBeVisible();
  await expect(page.getByPlaceholder('Enter your account email')).toBeVisible();
  await expect(page.getByText('Voice recovery unavailable', { exact: true })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText('PIN recovery unavailable', { exact: true })).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText('Email reset link', { exact: true })).toHaveAttribute('aria-disabled', 'false');

  await page.screenshot({ path: testInfo.outputPath('auth-shell.png'), fullPage: true });
  expect(runtimeErrors).toEqual([]);
});

test('authentication layout has no horizontal page overflow on desktop or mobile', async ({ page }) => {
  await page.goto('/?uiTest=auth');
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
});
