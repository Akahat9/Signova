const { test, expect } = require('@playwright/test');

test('community feed fills the page and stays inside phone, tablet, and desktop viewports', async ({ page }, testInfo) => {
  await page.goto('/?uiTest=app');
  await page.getByRole('button', { name: 'Community', exact: true }).click();
  const feed = page.locator('.communityPage');
  await expect(feed).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Community feed filters' })).toBeVisible();

  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1536, height: 960 }]) {
    await page.setViewportSize(viewport);
    const metrics = await page.evaluate(() => {
      const feedElement = document.querySelector('.communityPage');
      const rail = document.querySelector('.communityMode .appRail');
      const bounds = feedElement.getBoundingClientRect();
      return {
        viewportWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        feedWidth: bounds.width,
        feedBottom: bounds.bottom,
        viewportHeight: window.innerHeight,
        railPosition: getComputedStyle(rail).position,
        railBottom: rail.getBoundingClientRect().bottom,
      };
    });
    expect(metrics.documentWidth, `${viewport.width}px page overflow`).toBeLessThanOrEqual(metrics.viewportWidth + 1);
    expect(metrics.feedWidth).toBeGreaterThan(0);
    expect(metrics.feedBottom).toBeGreaterThan(Math.min(metrics.viewportHeight * 0.55, 460));
    if (viewport.width < 500) {
      expect(metrics.railPosition).toBe('fixed');
      expect(metrics.railBottom).toBeGreaterThanOrEqual(metrics.viewportHeight - 1);
    }
    await page.screenshot({ path: testInfo.outputPath(`community-${viewport.width}px.png`), fullPage: true });
  }
});

