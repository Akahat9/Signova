const { test, expect } = require('@playwright/test');
const admin = require('../../Backend (Node.js)/node_modules/firebase-admin');

const projectId = 'signova-6e929';
const users = [
  { uid: 'call-peer-a-e2e', email: 'call-peer-a@example.test', displayName: 'Call Peer A' },
  { uid: 'call-peer-b-e2e', email: 'call-peer-b@example.test', displayName: 'Call Peer B' },
];
test.setTimeout(180_000);

test.beforeAll(async () => {
  process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  if (!admin.apps.length) admin.initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
  for (const user of users) {
    await admin.auth().createUser({ ...user, password: 'Signova-call-test-2026!', emailVerified: true })
      .catch(async (error) => {
        if (error.code !== 'auth/uid-already-exists' && error.code !== 'auth/email-already-exists') throw error;
        await admin.auth().updateUser(user.uid, { password: 'Signova-call-test-2026!', emailVerified: true, displayName: user.displayName });
      });
  }
});

test('two verified users exchange a realtime Firestore text message', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The authenticated realtime transport runs once; responsive chat layout is covered separately.');
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const message = `Realtime hello ${Date.now()}`;
  try {
    await Promise.all([
      pageA.goto('/?uiTest=call&callRole=a'),
      pageB.goto('/?uiTest=call&callRole=b'),
    ]);
    await expect(pageA.locator('.messengerShell')).toHaveAttribute('data-e2e-auth-uid', users[0].uid, { timeout: 30_000 });
    await expect(pageB.locator('.messengerShell')).toHaveAttribute('data-e2e-auth-uid', users[1].uid, { timeout: 30_000 });
    await expect(pageA.getByPlaceholder('Type a message')).toBeVisible({ timeout: 20_000 });
    await expect(pageB.getByPlaceholder('Type a message')).toBeVisible({ timeout: 20_000 });
    await expect(pageA.locator('.messengerShell')).toHaveAttribute('data-e2e-chat-status', 'ready', { timeout: 30_000 });
    await expect(pageB.locator('.messengerShell')).toHaveAttribute('data-e2e-chat-status', 'ready', { timeout: 30_000 });

    await pageA.getByPlaceholder('Type a message').fill(message);
    await pageA.getByRole('button', { name: /Send message/ }).click();
    await expect(pageB.getByText(message, { exact: true })).toBeVisible({ timeout: 30_000 });

    await expect.poll(async () => {
      const chats = await admin.firestore().collection('chats').where('memberIds', 'array-contains', users[0].uid).get();
      const direct = chats.docs.find((item) => item.data().memberIds?.includes(users[1].uid));
      if (!direct) return '';
      const messages = await direct.ref.collection('messages').get();
      const stored = messages.docs.find((item) => item.data().text === message);
      return stored?.data().senderUid || '';
    }, { timeout: 30_000 }).toBe(users[0].uid);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test('two verified users negotiate, receive remote media, and end a WebRTC call', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The two-peer negotiation runs once; mobile responsive behavior is covered separately.');
  const contextA = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const contextB = await browser.newContext({ permissions: ['camera', 'microphone'] });
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  try {
    await Promise.all([
      pageA.goto('/?uiTest=call&callRole=a'),
      pageB.goto('/?uiTest=call&callRole=b'),
    ]);
    await expect(pageA.locator('.messengerShell')).toHaveAttribute('data-e2e-auth-uid', users[0].uid, { timeout: 30_000 });
    await expect(pageB.locator('.messengerShell')).toHaveAttribute('data-e2e-auth-uid', users[1].uid, { timeout: 30_000 });
    await expect(pageA.getByRole('button', { name: 'Start Video Sign Chat' })).toBeVisible({ timeout: 20_000 });
    await expect(pageB.getByRole('button', { name: 'Start Video Sign Chat' })).toBeVisible({ timeout: 20_000 });
    await pageA.getByRole('button', { name: 'Start Video Sign Chat' }).click();
    const incoming = pageB.getByRole('region', { name: 'Incoming Signova call' });
    await expect(incoming).toBeVisible({ timeout: 30_000 });
    await incoming.getByRole('button', { name: 'Accept' }).click();

    let room;
    await expect.poll(async () => {
      const snapshot = await admin.firestore().collection('callRooms').where('callerUid', '==', users[0].uid).get();
      room = snapshot.docs.sort((left, right) => Number(right.data().expiresAtMillis) - Number(left.data().expiresAtMillis))[0];
      return room?.data().status;
    }, { timeout: 30_000 }).toBe('connected');
    await expect.poll(async () => {
      const candidates = await room.ref.collection('candidates').get();
      return new Set(candidates.docs.map((item) => item.data().ownerUid)).size;
    }, { timeout: 30_000 }).toBe(2);
    await expect(pageA.locator('.messengerShell')).toHaveAttribute('data-e2e-remote-tracks', /video/, { timeout: 45_000 });
    await expect(pageB.locator('.messengerShell')).toHaveAttribute('data-e2e-remote-tracks', /video/, { timeout: 45_000 });

    await pageA.locator('.unifiedEndCallButton').click();
    await expect.poll(async () => (await room.ref.get()).data()?.status, { timeout: 20_000 }).toBe('ended');
    await expect(pageB.locator('.conversationPane.callWorkspaceActive')).toHaveCount(0, { timeout: 20_000 });
    await expect(pageB.getByRole('button', { name: 'Start Video Sign Chat' })).toBeVisible();
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test('camera denial fails closed before call signaling starts', async ({ browser }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium', 'The media-permission failure path is browser-engine behavior, not responsive layout.');
  const context = await browser.newContext();
  await context.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => { throw new DOMException('Permission denied by E2E', 'NotAllowedError'); },
    });
  });
  const page = await context.newPage();
  try {
    await page.goto('/?uiTest=call&callRole=a');
    await expect(page.locator('.messengerShell')).toHaveAttribute('data-e2e-auth-uid', users[0].uid, { timeout: 30_000 });
    const roomsBefore = await admin.firestore().collection('callRooms').where('callerUid', '==', users[0].uid).get();

    await page.getByRole('button', { name: 'Start Video Sign Chat' }).click();
    await expect(page.getByText('Camera permission required for WebRTC')).toBeVisible({ timeout: 15_000 });
    await expect.poll(async () => {
      const roomsAfter = await admin.firestore().collection('callRooms').where('callerUid', '==', users[0].uid).get();
      return roomsAfter.size;
    }, { timeout: 5_000 }).toBe(roomsBefore.size);
  } finally {
    await context.close();
  }
});
