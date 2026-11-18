const { test, expect } = require('@playwright/test');

test('settings uses the premium dark split layout on desktop and native grouped flow on mobile', async ({ page }, testInfo) => {
  await page.goto('/?uiTest=app');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  const isDesktop = testInfo.project.name === 'desktop-chromium';

  const theme = await page.locator('.settingsPanel').evaluate((element) => ({
    background: getComputedStyle(element).backgroundColor,
    width: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(theme.background).toBe('rgb(9, 11, 15)');
  expect(theme.width).toBeLessThanOrEqual(theme.clientWidth + 1);

  if (isDesktop) {
    await expect(page.locator('.settingsDesktopSidebar')).toBeVisible();
    await expect(page.locator('.settingsContextCard')).toBeVisible();
    await expect(page.getByRole('button', { name: /General/ })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('[data-setting-section="general"]')).toBeVisible();
    await page.getByRole('button', { name: /Appearance/ }).click();
    await expect(page.locator('[data-setting-section="display"]')).toBeVisible();
    await page.getByRole('button', { name: /Privacy & Security/ }).click();
    const headerWidth = await page.locator('.settingsSubPageHeader > div').evaluate((element) => element.getBoundingClientRect().width);
    expect(headerWidth).toBeGreaterThan(300);
    await expect(page.locator('label.settingSwitch').filter({ hasText: 'Two-factor authentication unavailable' }).locator('input')).toBeDisabled();
    await expect(page.locator('label.settingSwitch').filter({ hasText: 'Global app lock unavailable' }).locator('input')).toBeDisabled();
  } else {
    await expect(page.locator('.settingsDesktopSidebar')).toBeHidden();
    await expect(page.locator('.settingsChooser')).toBeVisible();
    const appearance = page.getByRole('button', { name: /Appearance/ });
    await appearance.click();
    await expect(page.locator('[data-setting-section="display"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to settings' })).toBeVisible();
    const mobileRail = await page.locator('.appRail').evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(mobileRail).not.toBe('rgba(255, 255, 255, 0.94)');
  }

  await page.screenshot({ path: testInfo.outputPath('settings-dark-responsive.png'), fullPage: true });
});

test('settings controls expose touch/focus-safe dimensions and no horizontal overflow', async ({ page }, testInfo) => {
  await page.goto('/?uiTest=app');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  if (testInfo.project.name === 'mobile-chromium') {
    await page.getByRole('button', { name: /Accessibility/ }).click();
  }
  const result = await page.locator('.settingsPanel').evaluate((panel) => {
    const controls = Array.from(panel.querySelectorAll('button, input:not([type="checkbox"]):not([type="range"]), select')).filter((item) => {
      const style = getComputedStyle(item);
      const bounds = item.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && bounds.width > 0 && bounds.height > 0;
    });
    return {
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      smallestControl: controls.reduce((minimum, item) => Math.min(minimum, item.getBoundingClientRect().height), Infinity),
    };
  });
  expect(result.pageOverflow).toBeLessThanOrEqual(1);
  expect(result.smallestControl).toBeGreaterThanOrEqual(39.5);
});

test('refresh recovers from local settings backup without leaving the startup skeleton stuck', async ({ page }) => {
  await page.goto('/?uiTest=app');
  await page.evaluate(() => {
    window.localStorage.setItem('signova-settings-v1', JSON.stringify({
      version: 2,
      settings: {
        camera: { resolution: '1440p' },
        device: { compactMode: true },
        display: { theme: 'dark' },
      },
    }));
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Preparing your workspace…')).toBeHidden({ timeout: 9_500 });
  await expect(page.locator('.messengerShell')).toBeVisible();

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.locator('.settingsPanel')).toBeVisible();
  await page.getByRole('button', { name: /Audio & Video/ }).click();

  const cameraResolution = page.locator('label.settingField').filter({ hasText: 'Resolution' }).locator('select');
  await expect(cameraResolution).toHaveValue('1440p');
});
