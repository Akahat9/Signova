const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  outputDir: './test-results/playwright-artifacts',
  timeout: 180_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  // Authenticated media suites share the local Firebase emulator project.
  // Keep them serial so one suite cannot reset users/data while another is active.
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : 'line',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'retain-on-failure' : 'off',
  },
  webServer: [
    {
      command: 'python -m http.server 4173 --bind 127.0.0.1 --directory build',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: 'firebase emulators:start --config ../firebase.json --project signova-6e929 --only auth,firestore,storage',
      url: 'http://127.0.0.1:9099',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1536, height: 960 },
        launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
        ...(process.env.CI ? {} : { channel: 'msedge' }),
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
        ...(process.env.CI ? {} : { channel: 'msedge' }),
      },
    },
  ],
});
