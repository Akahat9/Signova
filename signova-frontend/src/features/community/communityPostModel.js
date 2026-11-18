import { serverTimestamp } from 'firebase/firestore';
import { normalizeUsername } from '../auth/identityValidation';

export const PUBLIC_COMMUNITY_POSTS_COLLECTION = 'publicCommunityPosts';

export function getCommunityPostTimeLabel(value, now = Date.now()) {
  const millis = typeof value?.toMillis === 'function'
    ? value.toMillis()
    : typeof value === 'number'
      ? value
      : Date.parse(value || '');
  if (!Number.isFinite(millis)) return 'Just now';
  const minutes = Math.max(0, Math.floor((now - millis) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

export function normalizeCommunityPostFromFirestore(snapshot, likedPostIds = [], now = Date.now()) {
  const data = snapshot.data() || {};
  const stats = data.stats && typeof data.stats === 'object' ? data.stats : {};
  return {
    id: snapshot.id,
    name: data.name || 'Signova Creator',
    username: data.username || '@signova.creator',
    level: data.level || 'Community Creator',
    avatar: data.avatar || 'S',
    avatarImage: data.avatarImage || '',
    avatarTone: data.avatarTone || 'cyan',
    isPremium: Boolean(data.isPremium),
    authorUid: data.authorUid || '',
    time: getCommunityPostTimeLabel(data.createdAt || data.createdAtMillis, now),
    text: data.text || 'Shared a new sign media update.',
    tags: Array.isArray(data.tags) && data.tags.length ? data.tags : ['Community'],
    sign: data.sign || 'Shared Sign',
    duration: data.duration || 'Practice',
    confidence: data.confidence || 'Live',
    mediaType: data.mediaType === 'video' ? 'video' : 'image',
    contentKind: data.contentKind === 'reel' ? 'reel' : 'post',
    mediaUrl: data.mediaUrl || '/signova-auth-avatar-connect.png',
    mediaPath: data.mediaPath || '',
    thumbnailUrl: data.thumbnailUrl || '',
    thumbnailPath: data.thumbnailPath || '',
    mediaName: data.mediaName || '',
    learningTip: data.learningTip || 'Practice slowly first, then try it at conversation speed.',
    following: Boolean(data.following),
    liked: likedPostIds.includes(snapshot.id),
    stats: {
      likes: Number(stats.likes) || 0,
      comments: Number(stats.comments) || 0,
      shares: Number(stats.shares) || 0,
    },
  };
}

export function buildCommunityPostPayload({ text, media, profile = {}, initials, difficulty, isPremium, user, contentKind = 'post' }, clocks = {}) {
  const now = clocks.now || Date.now;
  const firestoreTimestamp = clocks.serverTimestamp || serverTimestamp;
  const safeMediaUrl = media?.url && !media.url.startsWith('blob:') ? media.url : '';
  const signName = media?.name ? media.name.replace(/\.[^.]+$/, '') : 'Shared Clip';
  return {
    authorUid: user?.uid || '',
    name: (profile.name || user?.displayName || 'Signova Creator').slice(0, 80),
    username: normalizeUsername(profile.username || user?.email?.split('@')[0] || '@signova.creator').slice(0, 40),
    level: difficulty === 'advanced' ? 'Advanced' : difficulty === 'intermediate' ? 'Intermediate' : 'Beginner',
    avatar: initials || 'S',
    avatarImage: profile.avatarImage || '',
    avatarTone: profile.avatarTone || 'cyan',
    isPremium: Boolean(isPremium),
    text: (text || 'Shared a new sign media update.').slice(0, 600),
    tags: ['Practice', 'Community'],
    sign: signName.slice(0, 80),
    duration: media?.type === 'video' ? 'Video' : '0:12',
    confidence: 'Live',
    mediaType: media?.type === 'video' ? 'video' : 'image',
    contentKind: contentKind === 'reel' ? 'reel' : 'post',
    mediaUrl: safeMediaUrl || profile.avatarImage || '/signova-auth-avatar-connect.png',
    mediaPath: media?.path || '',
    thumbnailUrl: media?.thumbnailUrl || '',
    thumbnailPath: media?.thumbnailPath || '',
    mediaName: media?.name || '',
    learningTip: 'Community update shared by the creator.',
    following: true,
    stats: { likes: 0, comments: 0, shares: 0 },
    createdAt: firestoreTimestamp(),
    createdAtMillis: now(),
    updatedAt: firestoreTimestamp(),
  };
}
