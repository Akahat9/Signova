import {
  buildCommunityPostPayload,
  getCommunityPostTimeLabel,
  normalizeCommunityPostFromFirestore,
} from './communityPostModel';

test('formats deterministic community post ages', () => {
  const now = Date.parse('2026-07-10T12:00:00Z');
  expect(getCommunityPostTimeLabel(now - 30_000, now)).toBe('Just now');
  expect(getCommunityPostTimeLabel(now - 12 * 60_000, now)).toBe('12 min ago');
  expect(getCommunityPostTimeLabel(now - 3 * 3_600_000, now)).toBe('3 hr ago');
  expect(getCommunityPostTimeLabel(now - 24 * 3_600_000, now)).toBe('Yesterday');
});

test('normalizes Firestore posts and keeps durable media metadata', () => {
  const snapshot = {
    id: 'post-1',
    data: () => ({
      authorUid: 'user-1',
      mediaType: 'video',
      contentKind: 'reel',
      mediaUrl: 'https://storage.example/video.mp4',
      mediaPath: 'community/user-1/video.mp4',
      thumbnailUrl: 'https://storage.example/poster.jpg',
      thumbnailPath: 'community/user-1/poster.jpg',
      createdAtMillis: 1_000,
      stats: { likes: '4', comments: 2 },
    }),
  };
  const post = normalizeCommunityPostFromFirestore(snapshot, ['post-1'], 61_000);
  expect(post).toMatchObject({ id: 'post-1', liked: true, mediaType: 'video', contentKind: 'reel' });
  expect(post.mediaPath).toBe('community/user-1/video.mp4');
  expect(post.thumbnailPath).toBe('community/user-1/poster.jpg');
  expect(post.stats).toEqual({ likes: 4, comments: 2, shares: 0 });
});

test('builds durable payloads and never persists local blob URLs', () => {
  const timestamps = [{ marker: 1 }, { marker: 2 }];
  const payload = buildCommunityPostPayload({
    text: 'Demo',
    media: { type: 'video', name: 'Hello.mp4', url: 'blob:local', path: 'community/u/video.mp4' },
    profile: { username: ' Demo User ' },
    user: { uid: 'u' },
    contentKind: 'reel',
  }, { now: () => 1234, serverTimestamp: () => timestamps.shift() });
  expect(payload).toMatchObject({
    authorUid: 'u', username: '@demouser', sign: 'Hello', mediaType: 'video',
    contentKind: 'reel', mediaPath: 'community/u/video.mp4', createdAtMillis: 1234,
  });
  expect(payload.mediaUrl).toBe('/signova-auth-avatar-connect.png');
  expect(payload.createdAt).toEqual({ marker: 1 });
  expect(payload.updatedAt).toEqual({ marker: 2 });
});
