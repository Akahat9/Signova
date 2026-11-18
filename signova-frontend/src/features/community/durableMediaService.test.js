import { cleanupCommunityMedia, uploadCommunityMedia } from './durableMediaService';

function completedTask() {
  return { on: (_event, progress, _reject, complete) => { progress({ bytesTransferred: 5, totalBytes: 10 }); complete(); } };
}

const base = {
  storage: {}, ownerUid: 'user-1', makeRef: (_storage, path) => ({ path }),
  startResumableUpload: () => completedTask(), uploadBlob: async () => undefined,
  getUrl: async (reference) => `https://media.test/${reference.path}`,
  remove: async () => undefined, createPoster: async () => new Blob(['poster']),
  createId: () => 'fixed-id',
};

test('uploads creator-scoped media and reports resumable progress', async () => {
  const onProgress = jest.fn();
  const startResumableUpload = jest.fn(() => completedTask());
  const media = { name: 'hello.PNG', type: 'image', file: new File(['image'], 'hello.PNG', { type: 'image/png' }) };
  const result = await uploadCommunityMedia({ ...base, media, onProgress, startResumableUpload });
  expect(result.path).toBe('community/user-1/fixed-id.png');
  expect(result.url).toContain(result.path);
  expect(onProgress).toHaveBeenCalledWith(50);
  expect(startResumableUpload).toHaveBeenCalledWith(expect.anything(), media.file, expect.objectContaining({ customMetadata: { ownerUid: 'user-1' } }));
});

test('keeps a durable video when optional poster generation fails', async () => {
  const media = { name: 'sign.mp4', type: 'video', file: new File(['video'], 'sign.mp4', { type: 'video/mp4' }) };
  const result = await uploadCommunityMedia({ ...base, media, createPoster: jest.fn(async () => { throw new Error('decode failed'); }) });
  expect(result.path).toBe('community/user-1/fixed-id.mp4');
  expect(result.thumbnailPath).toBeUndefined();
});

test('cleanup removes both unique durable objects and tolerates missing objects', async () => {
  const remove = jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('not found'));
  await expect(cleanupCommunityMedia({
    storage: {}, media: { path: 'community/u/a.mp4', thumbnailPath: 'community/u/a-poster.jpg' },
    makeRef: (_storage, path) => ({ path }), remove,
  })).resolves.toBeUndefined();
  expect(remove).toHaveBeenCalledTimes(2);
});
