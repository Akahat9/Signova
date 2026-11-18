const { test, expect } = require('@playwright/test');

test('main app navigation surfaces stay within phone, tablet, and desktop viewports', async ({ page }, testInfo) => {
  await page.goto('/?uiTest=app');
  const sizes = [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1536, height: 960 }];
  const surfaces = ['Home', 'Sign voice history', 'Library', 'Learn', 'Community', 'Settings'];

  for (const size of sizes) {
    await page.setViewportSize(size);
    for (const label of surfaces) {
      await page.getByRole('button', { name: label, exact: true }).click();
      await expect(page.locator('.messengerShell')).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        shell: document.querySelector('.messengerShell').getBoundingClientRect().width,
      }));
      expect(dimensions.document, `${label} overflows at ${size.width}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
      expect(dimensions.shell, `${label} shell exceeds ${size.width}px`).toBeLessThanOrEqual(dimensions.viewport + 1);
    }
  }
  await page.screenshot({ path: testInfo.outputPath('main-surfaces-responsive.png'), fullPage: true });
});
