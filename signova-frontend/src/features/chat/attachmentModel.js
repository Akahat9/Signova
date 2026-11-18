export const MAX_CHAT_ATTACHMENT_BYTES = 25 * 1024 * 1024;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm', 'audio/ogg']);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'txt', 'ppt', 'pptx', 'xls', 'xlsx']);
const DOCUMENT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
]);
const SAFE_STORAGE_NAME = /[^A-Za-z0-9._-]/g;

function extension(name = '') {
  const value = String(name).toLowerCase().split('.');
  return value.length > 1 ? value.pop() : '';
}

export function formatAttachmentFileSize(size = 0) {
  const bytes = Math.max(0, Number(size || 0));
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

export function validateChatAttachmentFile(file) {
  if (!file || typeof file.name !== 'string') throw new Error('Choose a valid attachment file.');
  const name = file.name.trim();
  const hasControlCharacter = Array.from(name).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
  if (!name || name.length > 160 || hasControlCharacter) throw new Error('Attachment filename is invalid.');
  const size = Number(file.size || 0);
  if (!Number.isSafeInteger(size) || size < 1) throw new Error(`${name} is empty.`);
  if (size > MAX_CHAT_ATTACHMENT_BYTES) throw new Error(`${name} exceeds the 25 MB attachment limit.`);
  const contentType = String(file.type || '').toLowerCase();
  const fileExtension = extension(name);
  let kind = '';
  if (IMAGE_TYPES.has(contentType)) kind = 'image';
  else if (AUDIO_TYPES.has(contentType)) kind = 'audio';
  else if (DOCUMENT_EXTENSIONS.has(fileExtension) && (!contentType || DOCUMENT_TYPES.has(contentType))) kind = 'document';
  if (!kind) throw new Error(`${name} uses an unsupported or unsafe file type.`);
  return { name, size, contentType: contentType || `application/x-${fileExtension}`, kind };
}

export function buildChatAttachmentMessage(file, { imageSendMode = 'High quality', url = '' } = {}) {
  const validated = validateChatAttachmentFile(file);
  if (!url) throw new Error('A local attachment preview URL is required.');
  const size = formatAttachmentFileSize(validated.size);
  if (validated.kind === 'image' && imageSendMode !== 'Send as document') {
    return {
      text: `Image: ${validated.name} · ${imageSendMode}`,
      attachmentType: 'image',
      attachmentData: {
        title: validated.name, url, mode: imageSendMode, quality: imageSendMode, size,
      },
    };
  }
  if (validated.kind === 'audio') {
    return {
      text: `Music / Audio Note: ${validated.name}`,
      attachmentType: 'audio',
      attachmentData: {
        title: validated.name, url, fileType: validated.contentType, size,
      },
    };
  }
  const asImageDocument = validated.kind === 'image';
  return {
    text: `Vault Document: ${validated.name}${asImageDocument ? ' · image document' : ''}`,
    attachmentType: 'document',
    attachmentData: {
      title: validated.name,
      url,
      fileType: asImageDocument ? 'image document' : validated.contentType,
      size,
    },
  };
}

export function sanitizeChatAttachmentStorageName(name = '') {
  const clean = String(name || '').trim().replace(SAFE_STORAGE_NAME, '_').replace(/_+/g, '_').slice(0, 120);
  return clean || 'attachment.bin';
}

export function buildDirectChatAttachmentDescriptor(file, { imageSendMode = 'High quality', url = '' } = {}) {
  const message = buildChatAttachmentMessage(file, { imageSendMode, url: url || 'pending://direct-attachment' });
  const validated = validateChatAttachmentFile(file);
  return {
    text: message.text,
    attachmentType: message.attachmentType,
    attachmentData: {
      ...message.attachmentData,
      url,
      previewExpired: !url,
      durable: Boolean(url),
    },
    storageName: sanitizeChatAttachmentStorageName(validated.name),
    contentType: validated.contentType,
    sizeBytes: validated.size,
  };
}
