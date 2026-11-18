import {
  normalizePresenceSnapshot,
  presenceLabel,
  subscribeUserPresence,
  writeUserPresence,
} from './presenceService';

test('normalizes online, away, stale offline, and hidden presence states', () => {
  const now = Date.parse('2026-07-14T10:00:00Z');
  expect(normalizePresenceSnapshot({
    id: 'user-a',
    data: () => ({ state: 'online', lastActiveAt: now - 30_000, deviceLabel: 'Desktop' }),
  }, { now })).toMatchObject({ uid: 'user-a', state: 'online', deviceLabel: 'Desktop' });
  expect(normalizePresenceSnapshot({
    id: 'user-a',
    data: () => ({ state: 'online', lastActiveAt: now - 120_000 }),
  }, { now })).toMatchObject({ state: 'away' });
  expect(normalizePresenceSnapshot({
    id: 'user-a',
    data: () => ({ state: 'online', lastActiveAt: now - 10 * 60_000 }),
  }, { now })).toMatchObject({ state: 'offline' });
  expect(normalizePresenceSnapshot({
    id: 'user-a',
    data: () => ({ state: 'hidden', lastActiveAt: now }),
  }, { now })).toMatchObject({ state: 'hidden' });
});

test('formats presence labels without inventing online state', () => {
  expect(presenceLabel({ state: 'online', deviceLabel: 'Web' })).toMatchObject({ status: 'Online', tone: 'online' });
  expect(presenceLabel({ state: 'away', deviceLabel: 'Web' })).toMatchObject({ status: 'Away', tone: 'away' });
  expect(presenceLabel({ state: 'offline', lastActiveAtMs: Date.parse('2026-07-14T09:42:00Z') }, { showLastSeen: true }).detail).toMatch(/Last seen/);
  expect(presenceLabel({ state: 'hidden' })).toMatchObject({ status: 'Hidden', tone: 'offline' });
});

test('writes owner-scoped presence with bounded fields', async () => {
  const write = jest.fn(async () => undefined);
  await expect(writeUserPresence({
    firestore: {},
    uid: 'user-a',
    state: 'online',
    deviceLabel: 'Desktop Browser',
    makeDoc: (db, ...segments) => segments.join('/'),
    write,
    timestamp: () => 'server-time',
  })).resolves.toEqual({ uid: 'user-a', state: 'online' });
  expect(write).toHaveBeenCalledWith('userPresence/user-a', {
    uid: 'user-a',
    state: 'online',
    deviceLabel: 'Desktop Browser',
    lastActiveAt: 'server-time',
    updatedAt: 'server-time',
  }, { merge: true });
});

test('subscribes to one user presence document', () => {
  const subscribe = jest.fn((ref, next) => {
    next({ id: 'user-a', data: () => ({ state: 'online', lastActiveAt: 1000 }) });
    return 'unsubscribe-presence';
  });
  const onPresence = jest.fn();
  expect(subscribeUserPresence({
    firestore: {},
    uid: 'user-a',
    onPresence,
    makeDoc: (db, ...segments) => segments.join('/'),
    subscribe,
    now: () => 1000,
  })).toBe('unsubscribe-presence');
  expect(onPresence).toHaveBeenCalledWith(expect.objectContaining({ uid: 'user-a', state: 'online' }));
});
