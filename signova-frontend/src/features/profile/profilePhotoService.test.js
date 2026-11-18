import { PROFILE_PHOTO_MAX_BYTES, uploadDurableProfilePhoto } from './profilePhotoService';

function dependencies(overrides = {}) {
  return {
    file: { size: 128 },
    ownerUid: 'user-a',
    storage: {},
    firestore: {},
    idFactory: () => 'photo-id',
    validateFile: jest.fn(async () => ({ valid: true, detectedType: 'image/png' })),
    makeStorageRef: jest.fn((storage, path) => ({ path })),
    upload: jest.fn(async () => undefined),
    getUrl: jest.fn(async () => 'https://storage.example/avatar'),
    remove: jest.fn(async () => undefined),
    makeProfileRef: jest.fn(() => ({ profile: true })),
    writeProfile: jest.fn(async () => undefined),
    timestamp: jest.fn(() => 'server-time'),
    ...overrides,
  };
}

test('uploads validated media, commits profile metadata, then removes the previous owned object', async () => {
  const options = dependencies({ previousPath: 'users/user-a/profile/old.jpg' });
  await expect(uploadDurableProfilePhoto(options)).resolves.toEqual({
    profilePhotoUrl: 'https://storage.example/avatar',
    profilePhotoPath: 'users/user-a/profile/avatar-photo-id.png',
  });
  expect(options.writeProfile).toHaveBeenCalledWith({ profile: true }, expect.objectContaining({ profilePhotoPath: 'users/user-a/profile/avatar-photo-id.png' }), { merge: true });
  expect(options.remove).toHaveBeenCalledWith({ path: 'users/user-a/profile/old.jpg' });
});

test('rolls back the new object when profile metadata cannot be committed', async () => {
  const options = dependencies({ writeProfile: jest.fn(async () => { throw new Error('firestore failed'); }) });
  await expect(uploadDurableProfilePhoto(options)).rejects.toThrow('firestore failed');
  expect(options.remove).toHaveBeenCalledWith({ path: 'users/user-a/profile/avatar-photo-id.png' });
});

test('never deletes a previous object outside the authenticated owner prefix', async () => {
  const options = dependencies({ previousPath: 'users/user-b/profile/avatar.jpg' });
  await uploadDurableProfilePhoto(options);
  expect(options.remove).not.toHaveBeenCalled();
});

test('rejects invalid owners, unsupported signatures, empty files, and oversized files before upload', async () => {
  await expect(uploadDurableProfilePhoto(dependencies({ ownerUid: '../user' }))).rejects.toThrow('Invalid profile owner');
  await expect(uploadDurableProfilePhoto(dependencies({ file: { size: 0 } }))).rejects.toThrow('between 1 byte and 10 MB');
  await expect(uploadDurableProfilePhoto(dependencies({ file: { size: PROFILE_PHOTO_MAX_BYTES + 1 } }))).rejects.toThrow('between 1 byte and 10 MB');
  const invalid = dependencies({ validateFile: jest.fn(async () => ({ valid: false, detectedType: '', error: 'bad image' })) });
  await expect(uploadDurableProfilePhoto(invalid)).rejects.toThrow('bad image');
  expect(invalid.upload).not.toHaveBeenCalled();
});

