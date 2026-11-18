import { uploadDirectChatAttachment } from './directAttachmentUpload';

function completedTask() {
  return {
    on: (_event, progress, _reject, complete) => {
      progress({ bytesTransferred: 3, totalBytes: 6 });
      complete();
    },
  };
}

test('uploads direct chat attachments with resumable progress and returns a member-resolved URL', async () => {
  const onProgress = jest.fn();
  const onTask = jest.fn();
  const task = completedTask();
  const startResumableUpload = jest.fn(() => task);
  const file = new File(['abc'], 'hello.png', { type: 'image/png' });
  const result = await uploadDirectChatAttachment({
    storage: {},
    file,
    path: 'chatAttachments/chat-a/user-a/message-a/hello.png',
    contentType: 'image/png',
    metadata: { chatId: 'chat-a', senderUid: 'user-a', messageId: 'message-a' },
    makeRef: (_storage, path) => ({ path }),
    startResumableUpload,
    getUrl: async (reference) => `https://storage.test/${reference.path}`,
    onProgress,
    onTask,
  });

  expect(result).toEqual({
    path: 'chatAttachments/chat-a/user-a/message-a/hello.png',
    url: 'https://storage.test/chatAttachments/chat-a/user-a/message-a/hello.png',
  });
  expect(onTask).toHaveBeenCalledWith(task);
  expect(onProgress).toHaveBeenCalledWith(50, expect.any(Object));
  expect(startResumableUpload).toHaveBeenCalledWith(expect.anything(), file, {
    contentType: 'image/png',
    customMetadata: { chatId: 'chat-a', senderUid: 'user-a', messageId: 'message-a' },
  });
});

test('surfaces cancellation or upload failures from the resumable task', async () => {
  const error = Object.assign(new Error('cancelled'), { code: 'storage/canceled' });
  const task = { on: (_event, _progress, reject) => reject(error), cancel: jest.fn() };
  await expect(uploadDirectChatAttachment({
    storage: {},
    file: new File(['abc'], 'hello.png', { type: 'image/png' }),
    path: 'chatAttachments/chat-a/user-a/message-a/hello.png',
    makeRef: (_storage, path) => ({ path }),
    startResumableUpload: () => task,
  })).rejects.toMatchObject({ code: 'storage/canceled' });
});
