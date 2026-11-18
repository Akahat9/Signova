import { getDownloadURL, ref as storageRef, uploadBytesResumable } from 'firebase/storage';

export async function uploadDirectChatAttachment({
  storage,
  file,
  path,
  contentType,
  metadata = {},
  makeRef = storageRef,
  startResumableUpload = uploadBytesResumable,
  getUrl = getDownloadURL,
  onTask,
  onProgress,
} = {}) {
  if (!storage || !file || !path) throw new Error('Direct attachment upload is missing required input.');
  const reference = makeRef(storage, path);
  const task = startResumableUpload(reference, file, {
    contentType: contentType || file.type || 'application/octet-stream',
    customMetadata: metadata,
  });
  onTask?.(task);
  await new Promise((resolve, reject) => {
    task.on('state_changed', (snapshot) => {
      const progress = snapshot.totalBytes > 0
        ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
        : 0;
      onProgress?.(progress, snapshot);
    }, reject, resolve);
  });
  return { path, url: await getUrl(reference) };
}
