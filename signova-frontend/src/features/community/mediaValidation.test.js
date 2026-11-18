import { detectCommunityMediaType, validateCommunityMediaFile } from './mediaValidation';

test('detects supported image and video signatures', () => {
  expect(detectCommunityMediaType(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
  expect(detectCommunityMediaType(new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70]))).toBe('video/mp4');
  expect(detectCommunityMediaType(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toBe('video/webm');
});

test('rejects a MIME type that does not match file contents', async () => {
  const file = new File([new Uint8Array([0xff, 0xd8, 0xff, 0x00])], 'fake.png', { type: 'image/png' });
  await expect(validateCommunityMediaFile(file)).resolves.toMatchObject({ valid: false, detectedType: 'image/jpeg' });
});

