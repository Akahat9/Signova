const { test, expect } = require('@playwright/test');
const path = require('node:path');
const admin = require('../../Backend (Node.js)/node_modules/firebase-admin');

const projectId = 'signova-6e929';
const ownerUid = 'media-owner-e2e';
test.describe.configure({ timeout: 90_000 });
test.setTimeout(90_000);

test.beforeAll(async () => {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.STORAGE_EMULATOR_HOST = 'http://127.0.0.1:9199';
  if (!admin.apps.length) admin.initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
  await admin.auth().createUser({ uid: ownerUid, email: 'media-owner@example.test', password: 'Signova-media-test-2026!', emailVerified: true, displayName: 'Media Owner' })
    .catch(async (error) => {
      if (error.code !== 'auth/uid-already-exists' && error.code !== 'auth/email-already-exists') throw error;
      await admin.auth().updateUser(ownerUid, { password: 'Signova-media-test-2026!', emailVerified: true, displayName: 'Media Owner' });
    });
});

test('verified creator uploads, plays, and deletes durable community video', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'One authenticated desktop journey is sufficient; responsive layout has separate coverage.');
  await page.goto('/?uiTest=media');
  await expect(page.getByRole('button', { name: 'Community', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Community', exact: true }).click();
  const fileInput = page.locator('input[type="file"][accept*="video"]').last();
  await fileInput.setInputFiles(path.resolve(__dirname, '../public/community-app-logo-video.mp4'));
  await expect(page.getByText('Verification points', { exact: true })).toBeVisible({ timeout: 20_000 });
  const caption = `Durable media browser QA ${testInfo.project.name}`;
  await page.getByLabel('Community post caption').fill(caption);
  await page.getByLabel(/I reviewed the caption, consent, and media quality/i).check();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();

  const post = page.locator('.communitySocialPost').filter({ hasText: caption }).first();
  await expect(post).toBeVisible({ timeout: 30_000 });
  let published;
  await expect.poll(async () => {
    const snapshot = await admin.firestore().collection('publicCommunityPosts').where('authorUid', '==', ownerUid).get();
    published = snapshot.docs.find((item) => item.data().text === caption);
    return Boolean(published?.data().mediaPath);
  }).toBe(true);
  const mediaPath = published.data().mediaPath;
  const video = post.locator('video');
  await expect(video).toBeVisible();
  await video.evaluate(async (element) => { await element.play(); });
  await expect.poll(() => video.evaluate((element) => !element.paused)).toBe(true);

  await post.getByRole('button', { name: /More post options/i }).click();
  await post.getByRole('menuitem', { name: 'Delete post' }).click();
  await expect(post).toHaveCount(0, { timeout: 20_000 });
  await expect.poll(async () => (await published.ref.get()).exists).toBe(false);
  await expect.poll(async () => {
    const [files] = await admin.storage().bucket().getFiles({ prefix: mediaPath });
    return files.some((file) => file.name === mediaPath);
  }).toBe(false);
});
