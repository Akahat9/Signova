export function createAttachmentObjectUrlRegistry({
  revokeObjectURL = (url) => URL.revokeObjectURL(url),
} = {}) {
  const owned = new Set();
  const isObjectUrl = (url) => typeof url === 'string' && url.startsWith('blob:');
  return {
    track(url) {
      if (isObjectUrl(url)) owned.add(url);
      return url;
    },
    release(url) {
      if (!owned.delete(url)) return false;
      revokeObjectURL(url);
      return true;
    },
    releaseMessage(message) {
      return this.release(message?.attachmentData?.url);
    },
    releaseMessages(messages = []) {
      let released = 0;
      messages.forEach((message) => { if (this.releaseMessage(message)) released += 1; });
      return released;
    },
    releaseAll() {
      const urls = [...owned];
      urls.forEach((url) => this.release(url));
      return urls.length;
    },
    get size() {
      return owned.size;
    },
  };
}

export function sanitizeAttachmentMessagesForPersistence(messages = []) {
  return messages.map((message) => {
    const url = message?.attachmentData?.url;
    if (typeof url !== 'string' || !url.startsWith('blob:')) return message;
    return {
      ...message,
      attachmentData: {
        ...message.attachmentData,
        url: '',
        previewExpired: true,
      },
    };
  });
}
