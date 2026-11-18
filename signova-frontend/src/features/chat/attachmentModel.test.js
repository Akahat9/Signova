import {
  buildChatAttachmentMessage,
  buildDirectChatAttachmentDescriptor,
  formatAttachmentFileSize,
  MAX_CHAT_ATTACHMENT_BYTES,
  sanitizeChatAttachmentStorageName,
  validateChatAttachmentFile,
} from './attachmentModel';

const file = (name, type, size = 1024) => ({ name, type, size });

test('validates supported image, audio, and document attachments', () => {
  expect(validateChatAttachmentFile(file('photo.webp', 'image/webp')).kind).toBe('image');
  expect(validateChatAttachmentFile(file('voice.webm', 'audio/webm')).kind).toBe('audio');
  expect(validateChatAttachmentFile(file('notes.pdf', 'application/pdf')).kind).toBe('document');
  expect(validateChatAttachmentFile(file('offline.txt', '')).kind).toBe('document');
});

test('rejects empty, oversized, disguised, executable, and unsafe-name files', () => {
  expect(() => validateChatAttachmentFile(file('empty.txt', 'text/plain', 0))).toThrow(/empty/i);
  expect(() => validateChatAttachmentFile(file('huge.pdf', 'application/pdf', MAX_CHAT_ATTACHMENT_BYTES + 1))).toThrow(/25 MB/i);
  expect(() => validateChatAttachmentFile(file('fake.pdf', 'application/x-msdownload'))).toThrow(/unsupported/i);
  expect(() => validateChatAttachmentFile(file('payload.exe', 'application/octet-stream'))).toThrow(/unsupported/i);
  expect(() => validateChatAttachmentFile(file('bad\nname.txt', 'text/plain'))).toThrow(/filename/i);
});

test('builds stable image, image-document, audio, and document messages', () => {
  expect(buildChatAttachmentMessage(file('photo.png', 'image/png'), { url: 'blob:image', imageSendMode: 'High quality' }))
    .toMatchObject({ text: 'Image: photo.png · High quality', attachmentType: 'image', attachmentData: { size: '1 KB' } });
  expect(buildChatAttachmentMessage(file('photo.png', 'image/png'), { url: 'blob:image', imageSendMode: 'Send as document' }))
    .toMatchObject({ text: 'Vault Document: photo.png · image document', attachmentType: 'document' });
  expect(buildChatAttachmentMessage(file('voice.ogg', 'audio/ogg'), { url: 'blob:audio' }))
    .toMatchObject({ text: 'Music / Audio Note: voice.ogg', attachmentType: 'audio' });
  expect(buildChatAttachmentMessage(file('report.pdf', 'application/pdf'), { url: 'blob:doc' }))
    .toMatchObject({ text: 'Vault Document: report.pdf', attachmentType: 'document' });
});

test('formats boundary sizes consistently and requires a preview URL', () => {
  expect(formatAttachmentFileSize(1024)).toBe('1 KB');
  expect(formatAttachmentFileSize(1024 * 1024)).toBe('1.0 MB');
  expect(() => buildChatAttachmentMessage(file('report.pdf', 'application/pdf'))).toThrow(/preview URL/i);
});

test('builds direct-chat durable attachment descriptors with safe storage names', () => {
  expect(sanitizeChatAttachmentStorageName('bad name (1).pdf')).toBe('bad_name_1_.pdf');
  expect(buildDirectChatAttachmentDescriptor(file('report.pdf', 'application/pdf'), { url: 'blob:doc' }))
    .toMatchObject({
      text: 'Vault Document: report.pdf',
      attachmentType: 'document',
      storageName: 'report.pdf',
      contentType: 'application/pdf',
      sizeBytes: 1024,
      attachmentData: { url: 'blob:doc', durable: true },
    });
  expect(buildDirectChatAttachmentDescriptor(file('photo.png', 'image/png')))
    .toMatchObject({ attachmentType: 'image', attachmentData: { url: '', previewExpired: true, durable: false } });
});
