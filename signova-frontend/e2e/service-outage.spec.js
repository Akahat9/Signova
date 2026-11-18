const { test, expect } = require('@playwright/test');

test('service outage is announced and retry recovers without reloading the app', async ({ page }, testInfo) => {
  let healthy = false;
  let healthChecks = 0;
  await page.route('http://127.0.0.1:5000/api/health', async (route) => {
    healthChecks += 1;
    if (!healthy) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Service temporarily unavailable' }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        service: 'Signova Backend',
        apiSource: 'backend',
        ai: { status: 'ok', sequence_models: {} },
      }),
    });
  });

  await page.goto('/?uiTest=app');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Signova services are unavailable');
  await expect(alert.getByRole('button', { name: 'Retry services' })).toBeVisible();

  const accessibility = await alert.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const button = element.querySelector('button').getBoundingClientRect();
    return {
      insideViewport: bounds.left >= 0 && bounds.right <= window.innerWidth,
      buttonHeight: button.height,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(accessibility.insideViewport).toBe(true);
  expect(accessibility.buttonHeight).toBeGreaterThanOrEqual(testInfo.project.name === 'mobile-chromium' ? 43.5 : 39.5);
  expect(accessibility.pageOverflow).toBeLessThanOrEqual(1);

  healthy = true;
  await alert.getByRole('button', { name: 'Retry services' }).click();
  await expect(alert).toBeHidden();
  await expect.poll(() => healthChecks).toBeGreaterThanOrEqual(2);

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /About Signova/ }).click();
  await expect(page.locator('[data-setting-section="about"] .connectionMetric')).toContainText('Connected');
});
