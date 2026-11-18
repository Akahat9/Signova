function safeExtension(media) {
  const fromName = String(media?.name || '').split('.').pop()?.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return fromName || (media?.type === 'video' ? 'mp4' : 'jpg');
}

export async function cleanupCommunityMedia({ storage, media, makeRef, remove }) {
  if (!storage || !media || typeof makeRef !== 'function' || typeof remove !== 'function') return;
  const paths = [...new Set([media.path, media.thumbnailPath].filter(Boolean))];
  await Promise.all(paths.map((path) => remove(makeRef(storage, path)).catch(() => undefined)));
}

export async function uploadCommunityMedia({
  storage,
  media,
  ownerUid,
  makeRef,
  startResumableUpload,
  uploadBlob,
  getUrl,
  remove,
  createPoster,
  createId = () => window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  onTask,
  onProgress,
}) {
  if (!storage || !media?.file || !ownerUid) throw new Error('Community media upload is missing required input.');
  const uniqueId = createId();
  const path = `community/${ownerUid}/${uniqueId}.${safeExtension(media)}`;
  const mediaReference = makeRef(storage, path);
  const uploadTask = startResumableUpload(mediaReference, media.file, {
    contentType: media.file.type,
    customMetadata: { ownerUid },
  });
  onTask?.(uploadTask);
  await new Promise((resolve, reject) => {
    uploadTask.on('state_changed', (snapshot) => {
      const progress = snapshot.totalBytes > 0
        ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
        : 0;
      onProgress?.(progress);
    }, reject, resolve);
  });

  let uploaded = { ...media, url: await getUrl(mediaReference), path };
  if (media.type !== 'video') return uploaded;

  let thumbnailReference;
  try {
    const posterBlob = await createPoster(media.file);
    const thumbnailPath = `community/${ownerUid}/${uniqueId}-poster.jpg`;
    thumbnailReference = makeRef(storage, thumbnailPath);
    await uploadBlob(thumbnailReference, posterBlob, {
      contentType: 'image/jpeg',
      customMetadata: { ownerUid },
    });
    uploaded = { ...uploaded, thumbnailUrl: await getUrl(thumbnailReference), thumbnailPath };
  } catch {
    if (thumbnailReference) await remove(thumbnailReference).catch(() => undefined);
  }
  return uploaded;
}
