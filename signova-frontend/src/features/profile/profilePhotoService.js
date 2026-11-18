import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { validateCommunityMediaFile } from '../community/mediaValidation';

export const PROFILE_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_EXTENSIONS = Object.freeze({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' });

function validateOwnerUid(ownerUid) {
  const uid = String(ownerUid || '').trim();
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(uid)) throw new Error('Invalid profile owner');
  return uid;
}

export async function uploadDurableProfilePhoto({
  file,
  ownerUid,
  previousPath = '',
  storage,
  firestore,
  idFactory = () => (typeof window !== 'undefined' && window.crypto?.randomUUID?.()) || `${Date.now()}`,
  validateFile = validateCommunityMediaFile,
  makeStorageRef = storageRef,
  upload = uploadBytes,
  getUrl = getDownloadURL,
  remove = deleteObject,
  makeProfileRef = (database, uid) => doc(database, 'users', uid),
  writeProfile = setDoc,
  timestamp = serverTimestamp,
} = {}) {
  const uid = validateOwnerUid(ownerUid);
  if (!file || !storage || !firestore) throw new Error('Profile photo upload is unavailable');
  if (!Number.isFinite(file.size) || file.size <= 0 || file.size > PROFILE_PHOTO_MAX_BYTES) {
    throw new Error('Profile photo must be between 1 byte and 10 MB');
  }
  const validation = await validateFile(file);
  const extension = IMAGE_EXTENSIONS[validation?.detectedType];
  if (!validation?.valid || !extension) throw new Error(validation?.error || 'Choose a JPEG, PNG, or WebP image');
  const objectPath = `users/${uid}/profile/avatar-${String(idFactory()).replace(/[^A-Za-z0-9._-]/g, '')}.${extension}`;
  const objectRef = makeStorageRef(storage, objectPath);
  let uploaded = false;
  try {
    await upload(objectRef, file, { contentType: validation.detectedType, cacheControl: 'public,max-age=3600' });
    uploaded = true;
    const profilePhotoUrl = await getUrl(objectRef);
    await writeProfile(makeProfileRef(firestore, uid), {
      profilePhotoUrl,
      profilePhotoPath: objectPath,
      updatedAt: timestamp(),
    }, { merge: true });
    const ownerPrefix = `users/${uid}/profile/`;
    if (previousPath && previousPath !== objectPath && previousPath.startsWith(ownerPrefix)) {
      await remove(makeStorageRef(storage, previousPath)).catch(() => undefined);
    }
    return { profilePhotoUrl, profilePhotoPath: objectPath };
  } catch (error) {
    if (uploaded) await remove(objectRef).catch(() => undefined);
    throw error;
  }
}
