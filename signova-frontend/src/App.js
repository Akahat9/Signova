import './App.css';
import './mobileDesktop.css';
import './desktopPageFixes.css';
import './uiPerformanceFixes.css';
import './appShellAuthority.css';
import './premiumDarkSystem.css';
import { Fragment, lazy, Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import {
  createUserWithEmailAndPassword,
  browserLocalPersistence,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { firebaseAuth, firestoreDb, isFirebaseReady } from './firebase';
import { deleteUserDoc, loadUserCollection, resetDatabaseSession, saveUserDoc, startDatabaseSession } from './signovaDb';
import AppNavigationRail from './components/AppNavigationRail';
import EncryptionStatusNotice from './components/EncryptionStatusNotice';
import ProgressScrollRail from './components/ProgressScrollRail';
import useAppViewport from './hooks/useAppViewport';
import { conversationE2EE } from './securityCapabilities';

const Signova3DAvatar = lazy(() => import('./Signova3DAvatar'));
const LearnStudio = lazy(() => import('./LearnStudio'));

const API_URL = process.env.REACT_APP_SIGNOVA_API_URL || (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:5000' : '');
const CHAT_SIDEBAR_MIN_WIDTH = 260;
const CHAT_SIDEBAR_MAX_WIDTH = 480;
const CHAT_SIDEBAR_DEFAULT_WIDTH = 320;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_PHONE_PATTERN = /^\+[1-9]\d{7,14}$/;
const RESERVED_USERNAMES = new Set(['admin', 'administrator', 'support', 'moderator', 'official', 'verified', 'firebase', 'google', 'signova', 'signovaai', 'signova.ai', 'system', 'root']);
const BLOCKED_PROFILE_WORDS = [
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'nude', 'porn', 'sex',
  'chutiya', 'madarchod', 'bhenchod', 'bsdk', 'gandu', 'randi', 'harami',
];
const BLOCKED_EMAIL_DOMAINS = new Set(['mailinator.com', 'tempmail.com', '10minutemail.com', 'guerrillamail.com', 'yopmail.com', 'trashmail.com']);
const SIGNOVA_AVATAR_ASSETS = [
  {
    id: 'male-coach',
    label: 'Male coach',
    image: '/signova-auth-avatar-ai.png',
    tone: 'cyan',
    mood: 'smile',
    accessory: 'none',
  },
  {
    id: 'female-learner',
    label: 'Female learner',
    image: '/signova-auth-avatar-learning.png',
    tone: 'purple',
    mood: 'smile',
    accessory: 'none',
  },
  {
    id: 'community-duo',
    label: 'Community duo',
    image: '/signova-auth-avatar-connect.png',
    tone: 'green',
    mood: 'smile',
    accessory: 'none',
  },
];

function getDesktopCallWindowMode() {
  if (typeof window === 'undefined') return '';
  const mode = new URLSearchParams(window.location.search).get('signovaCall');
  return mode === 'voice' ? 'voice' : mode === 'video' ? 'video' : '';
}

function clampChatSidebarWidth(value) {
  return Math.min(CHAT_SIDEBAR_MAX_WIDTH, Math.max(CHAT_SIDEBAR_MIN_WIDTH, value));
}

function normalizeAuthIdentity(value = '') {
  return String(value).trim().toLowerCase().replace(/\s+/g, '');
}

function normalizeAuthUsername(value = '') {
  const clean = normalizeAuthIdentity(value).replace(/^@+/, '').replace(/[^a-z0-9._-]/g, '');
  return `@${clean || 'signova.user'}`;
}

function normalizeAuthPhone(value = '') {
  const trimmed = String(value).trim();
  const digits = trimmed.replace(/[^\d+]/g, '');
  if (/^\d{10}$/.test(digits)) return `+91${digits}`;
  return digits.startsWith('+') ? digits : digits ? `+${digits}` : '';
}

function splitAuthName(name = 'Signova User') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || 'Signova',
    lastName: parts.slice(1).join(' ') || 'User',
  };
}

function hasBlockedProfileLanguage(value = '') {
  const normalized = String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  return BLOCKED_PROFILE_WORDS.some((word) => normalized.split(/\s+/).includes(word));
}

function validateAuthEmail(email) {
  const normalized = normalizeAuthIdentity(email);
  if (!EMAIL_PATTERN.test(normalized)) throw new Error('Enter a valid email address.');
  const domain = normalized.split('@')[1];
  if (BLOCKED_EMAIL_DOMAINS.has(domain)) throw new Error('Temporary email addresses are not allowed.');
  return normalized;
}

function validateAuthPhone(phone) {
  const normalized = normalizeAuthPhone(phone);
  if (!E164_PHONE_PATTERN.test(normalized)) {
    throw new Error('Enter a valid phone number with country code, like +91XXXXXXXXXX.');
  }
  return normalized;
}

function getFriendlyFirebaseAuthError(error, fallback = 'Authentication failed. Please try again.') {
  const code = error?.code || '';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a few minutes, then try again.';
  if (code === 'auth/quota-exceeded') return 'Firebase email quota/rate limit reached. Wait, then try again from one device.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'Email or password is incorrect.';
  if (code === 'auth/operation-not-allowed') return 'Firebase Email/Password provider is not enabled for this project.';
  if (code === 'auth/unauthorized-continue-uri' || code === 'auth/invalid-continue-uri') return 'Firebase authorized domain/action URL is not configured for this public website.';
  if (code === 'auth/missing-continue-uri') return 'Verification link settings are missing a continue URL.';
  if (code === 'auth/email-already-in-use') return 'This email already has a Signova account. Use Login or resend verification.';
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (code === 'auth/network-request-failed') return 'Network issue while contacting Firebase. Check connection and try again.';
  return error?.message || fallback;
}

function validateAuthUsername(username) {
  const normalized = normalizeAuthUsername(username);
  const raw = normalized.replace(/^@/, '');
  if (!/^[a-z0-9][a-z0-9._-]{1,18}[a-z0-9]$/.test(raw)) {
    throw new Error('Username must be 3-20 characters and use only letters, numbers, dot, underscore, or dash.');
  }
  if (/[._-]{2,}/.test(raw)) throw new Error('Username cannot use repeated symbols.');
  if (RESERVED_USERNAMES.has(raw) || raw.includes('signova')) throw new Error('This username is reserved.');
  if (hasBlockedProfileLanguage(raw)) throw new Error('Choose a respectful username.');
  return normalized;
}

function validateAuthName(name) {
  const trimmed = String(name || '').trim().replace(/\s+/g, ' ');
  if (trimmed.length < 2 || trimmed.length > 40) throw new Error('Name must be 2-40 characters.');
  if (/https?:\/\//i.test(trimmed) || EMAIL_PATTERN.test(trimmed) || /\+?\d{7,}/.test(trimmed)) {
    throw new Error('Name cannot contain links, emails, or phone numbers.');
  }
  if (!/^[\p{L}\p{M}' .-]+$/u.test(trimmed)) throw new Error('Name can use letters, spaces, apostrophe, dot, or dash only.');
  if (hasBlockedProfileLanguage(trimmed)) throw new Error('Choose a respectful display name.');
  return trimmed;
}

async function hashChatSecret(secret, salt) {
  const value = `${salt}:${secret}`;
  if (typeof window !== 'undefined' && window.crypto?.subtle) {
    const data = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return `fallback-${Math.abs(hash)}`;
}

const DEFAULT_SIGNS = [
  { label: 'palm', sign: 'Hello', hint: 'Open palm', source: 'landmark_dataset' },
  { label: 'stop', sign: 'Stop', hint: 'Open palm forward', source: 'landmark_dataset' },
  { label: 'ok', sign: 'OK', hint: 'Circle with thumb and finger', source: 'landmark_dataset' },
  { label: 'call', sign: 'Call me', hint: 'Phone hand near face', source: 'landmark_dataset' },
  { label: 'mute', sign: 'I cannot speak', hint: 'Muted mouth gesture', source: 'landmark_dataset' },
  { label: 'like', sign: 'I like it', hint: 'Thumb up', source: 'landmark_dataset' },
  { label: 'dislike', sign: 'I dislike it', hint: 'Thumb down', source: 'landmark_dataset' },
  { label: 'peace', sign: 'Peace', hint: 'Two fingers up', source: 'landmark_dataset' },
  { label: 'one', sign: 'One', hint: 'One finger up', source: 'landmark_dataset' },
  { label: 'two_up', sign: 'Two', hint: 'Two fingers up', source: 'landmark_dataset' },
  { label: 'fist', sign: 'Fist', hint: 'Closed fist', source: 'landmark_dataset' },
  { label: 'four', sign: 'Four', hint: 'Four fingers up', source: 'landmark_dataset' },
  { label: 'peace_inverted', sign: 'Peace', hint: 'Two fingers, palm inward', source: 'landmark_dataset' },
  { label: 'rock', sign: 'Rock', hint: 'Rock hand gesture', source: 'landmark_dataset' },
  { label: 'stop_inverted', sign: 'Stop', hint: 'Stop sign, palm inward', source: 'landmark_dataset' },
  { label: 'three', sign: 'Three', hint: 'Three fingers up', source: 'landmark_dataset' },
  { label: 'three2', sign: 'Three', hint: 'Three fingers variant', source: 'landmark_dataset' },
  { label: 'two_up_inverted', sign: 'Two', hint: 'Two fingers, palm inward', source: 'landmark_dataset' },
];

const MEDIAPIPE_HANDS_VERSION = '0.4.1675469240';
const MEDIAPIPE_DRAWING_VERSION = '0.3.1675466124';
const MEDIAPIPE_HANDS_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/hands@${MEDIAPIPE_HANDS_VERSION}`;
const SCRIPTS = [
  `${MEDIAPIPE_HANDS_BASE_URL}/hands.js`,
  `https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@${MEDIAPIPE_DRAWING_VERSION}/drawing_utils.js`,
];

const PREDICTION_INTERVAL_MS = 150;
const ACCEPT_COOLDOWN_MS = 280;
const MIN_ACCEPT_CONFIDENCE = 0.55;
const MIN_SIGN_STABLE_FRAMES = 3;
const MIN_CONFIDENCE_MARGIN = 0.12;
const REQUEST_TIMEOUT_MS = 900;
const TEMPORAL_BUFFER_SIZE = 8;
const ENGINE_NAME = 'Signova AI Synapse Engine';
const SIGNOVA_SETTINGS_STORAGE_KEY = 'signova-settings-v1';

function mergeSignovaSettings(defaults, saved) {
  if (!saved || typeof saved !== 'object') return defaults;
  return Object.entries(defaults).reduce((merged, [key, value]) => {
    const savedValue = saved[key];
    if (
      value
      && typeof value === 'object'
      && !Array.isArray(value)
      && savedValue
      && typeof savedValue === 'object'
      && !Array.isArray(savedValue)
    ) {
      merged[key] = { ...value, ...savedValue };
    } else {
      merged[key] = savedValue === undefined ? value : savedValue;
    }
    return merged;
  }, {});
}

const NAV_ITEMS = [
  { id: 'chats', icon: 'home', label: 'Home' },
  { id: 'translate', icon: 'voiceHistory', label: 'Sign voice history' },
  { id: 'library', icon: 'library', label: 'Library' },
  { id: 'learn', icon: 'learn', label: 'Learn' },
  { id: 'community', icon: 'community', label: 'Community' },
  { id: 'settings', icon: 'settings', label: 'Settings' },
];

const INITIAL_CONTACTS = [
  {
    id: 'signova-ai',
    name: 'Signova Interpreter',
    number: '+91 00000 00000',
    username: '@signova.ai',
    avatarChoice: 'signova',
    showUsername: true,
    showNumber: false,
  },
];

const LEARN_MISSIONS = [
  {
    id: 'check-in',
    title: 'Check on a friend',
    phrase: 'Are you okay?',
    meaning: 'A gentle check-in asking whether someone feels safe or well.',
    handshape: 'Open hands, relaxed fingers',
    motion: 'Move slightly forward toward the person',
    expression: 'Soft eyebrows and a concerned, calm face',
    example: 'Use it when a friend looks worried, tired, or uncomfortable.',
    context: 'Use a calm face, open posture, and a clear question expression.',
    level: 'Beginner',
    minutes: 6,
    tone: 'cyan',
  },
  {
    id: 'help',
    title: 'Ask for help',
    phrase: 'Please help me',
    meaning: 'A clear request asking another person for support.',
    handshape: 'Support one hand with the other',
    motion: 'Lift both hands together toward your chest',
    expression: 'Direct eye contact with a clear requesting face',
    example: 'Use it when you need assistance at home, school, work, or outside.',
    context: 'Practice an urgent but clear request that works in daily situations.',
    level: 'Beginner',
    minutes: 7,
    tone: 'coral',
  },
  {
    id: 'introduction',
    title: 'Introduce yourself',
    phrase: 'Hello, my name is...',
    meaning: 'A friendly greeting followed by your name.',
    handshape: 'Greeting hand, then fingerspell your name',
    motion: 'Wave once, point to yourself, then spell',
    expression: 'Warm smile and natural eye contact',
    example: 'Use it when meeting a new person or joining a conversation.',
    context: 'Combine greeting, fingerspelling, eye contact, and natural pacing.',
    level: 'Intermediate',
    minutes: 9,
    tone: 'violet',
  },
];

const GESTURE_LOOP_STEPS = [
  ['Understand', 'Learn the meaning, situation, and expression before copying movement.'],
  ['Observe', 'Watch normal speed, slow motion, hand focus, and body posture.'],
  ['Shadow', 'Sign with the guide while Signova tracks rhythm and movement path.'],
  ['AI Coach', 'Receive focused feedback for handshape, orientation, location, and expression.'],
  ['Conversation', 'Use the sign naturally inside a short real-life interaction.'],
  ['Recall', 'Repeat later without the guide so the skill moves into memory.'],
];

const PRACTICAL_LEARN_MODES = [
  ['shadow', 'practice', 'Watch & Shadow', 'Follow a guided sign without interruption.'],
  ['coach', 'voiceHistory', 'AI Coach', 'Get one useful correction after every attempt.'],
  ['conversation', 'conversations', 'Conversation Mission', 'Respond naturally instead of repeating a fixed answer.'],
  ['expression', 'community', 'Expression Lab', 'Train face, head movement, and body posture.'],
];

const EMPTY_CONTACT_FORM = {
  name: '',
  countryCode: '+91',
  number: '',
  username: '',
  avatarChoice: 'signova',
  showUsername: true,
  showNumber: false,
};

const CONTACT_COUNTRIES = [
  { code: '+91', country: 'India', flag: 'IN', digits: 10 },
  { code: '+1', country: 'United States / Canada', flag: 'US', digits: 10 },
  { code: '+44', country: 'United Kingdom', flag: 'GB', digits: 10 },
  { code: '+61', country: 'Australia', flag: 'AU', digits: 9 },
  { code: '+971', country: 'United Arab Emirates', flag: 'AE', digits: 9 },
  { code: '+49', country: 'Germany', flag: 'DE', digits: 10 },
  { code: '+33', country: 'France', flag: 'FR', digits: 9 },
];

const EMPTY_GROUP_FORM = {
  name: '',
  purpose: 'Sign language learning',
  category: 'learning',
  description: '',
  privacy: 'private',
  members: '',
  allowMeetings: true,
  enableAudiencePolls: true,
  enableMediaDrive: true,
  adminApproval: false,
  postingPermission: 'members',
  memberListVisibility: 'members',
  notifications: 'important',
  autoCaptions: true,
  encryptedRequired: true,
};

const COMMUNITY_POSTS = [
  {
    id: 'post-signova-logo-video',
    name: 'Signova Creator',
    username: '@signova.creator',
    level: 'Verified Creator',
    avatar: 'S',
    avatarImage: '/signova-auth-avatar-ai.png',
    avatarTone: 'cyan',
    time: 'Just now',
    text: 'New Signova visual identity motion post. This is the app logo video added to the community feed for learners and creators.',
    tags: ['Signova', 'Community', 'Video'],
    sign: 'Signova App Logo',
    duration: '0:06',
    confidence: 'Featured',
    mediaType: 'video',
    mediaUrl: '/community-app-logo-video.mp4',
    learningTip: 'Creator videos can be used for announcements, sign demos, and community learning posts.',
    following: true,
    stats: { likes: 120, comments: 12, shares: 18 },
  },
  {
    id: 'post-need-help',
    name: 'Aarav Mehta',
    username: '@aarav.signs',
    level: 'Verified Creator',
    avatar: 'AM',
    avatarImage: '/signova-auth-avatar-learning.png',
    avatarTone: 'purple',
    time: '18 min ago',
    text: 'A clear ISL sign for asking for help. Keep your expression calm and make the forward movement easy to see.',
    tags: ['ISL', 'Emergency', 'Beginner'],
    sign: 'Need Help',
    duration: '0:08',
    confidence: '98%',
    mediaType: 'image',
    mediaUrl: '/signova-auth-avatar-learning.png',
    learningTip: 'Pause at the final position for one second so the meaning stays clear.',
    following: true,
    stats: { likes: 284, comments: 31, shares: 46 },
  },
  {
    id: 'post-thank-you',
    name: 'Meera Joshi',
    username: '@meeracommunicates',
    level: 'Community Mentor',
    avatar: 'MJ',
    avatarImage: '/signova-auth-avatar-connect.png',
    avatarTone: 'green',
    time: '1 hr ago',
    text: 'Today we are learning a friendly everyday sign. Try it slowly first, then repeat it at a natural conversation speed.',
    tags: ['ISL', 'Daily Use', 'Word'],
    sign: 'Thank You',
    duration: '0:06',
    confidence: '96%',
    mediaType: 'image',
    mediaUrl: '/signova-auth-avatar-connect.png',
    learningTip: 'Your facial expression should match the warmth of the message.',
    following: true,
    stats: { likes: 518, comments: 67, shares: 102 },
  },
  {
    id: 'post-introduction',
    name: 'Kabir Singh',
    username: '@kabir.learns',
    level: 'Rising Creator',
    avatar: 'KS',
    avatarImage: '/signova-auth-avatar-ai.png',
    avatarTone: 'orange',
    time: 'Yesterday',
    text: 'My first full sentence sign. Feedback on hand placement and pacing is welcome.',
    tags: ['ASL', 'Introduction', 'Sentence'],
    sign: 'Nice to meet you',
    duration: '0:12',
    confidence: 'Community review',
    mediaType: 'image',
    mediaUrl: '/signova-auth-avatar-ai.png',
    learningTip: 'Watch the complete sentence once before practicing each movement.',
    stats: { likes: 193, comments: 42, shares: 21 },
  },
];
const COMMUNITY_CONTRIBUTORS = [];
const COMMUNITY_SIGNS = [];
const COMMUNITY_GROUPS = [];
const PUBLIC_COMMUNITY_POSTS_COLLECTION = 'publicCommunityPosts';

function getCommunityPostTimeLabel(value) {
  const millis = typeof value?.toMillis === 'function'
    ? value.toMillis()
    : typeof value === 'number'
      ? value
      : Date.parse(value || '');
  if (!Number.isFinite(millis)) return 'Just now';
  const minutes = Math.max(0, Math.floor((Date.now() - millis) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

function normalizeCommunityPostFromFirestore(snapshot, likedPostIds = []) {
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
    time: getCommunityPostTimeLabel(data.createdAt || data.createdAtMillis),
    text: data.text || 'Shared a new sign media update.',
    tags: Array.isArray(data.tags) && data.tags.length ? data.tags : ['Community'],
    sign: data.sign || 'Shared Sign',
    duration: data.duration || 'Practice',
    confidence: data.confidence || 'Live',
    mediaType: data.mediaType === 'video' ? 'video' : 'image',
    mediaUrl: data.mediaUrl || '/signova-auth-avatar-connect.png',
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

function buildCommunityPostPayload({ text, media, profile, initials, difficulty, isPremium, user }) {
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
    mediaUrl: safeMediaUrl || profile.avatarImage || '/signova-auth-avatar-connect.png',
    mediaName: media?.name || '',
    learningTip: 'Community update shared by the creator.',
    following: true,
    stats: { likes: 0, comments: 0, shares: 0 },
    createdAt: serverTimestamp(),
    createdAtMillis: Date.now(),
    updatedAt: serverTimestamp(),
  };
}

const CAMERA_RESOLUTIONS = {
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '1440p': { width: 2560, height: 1440 },
};

const PERFORMANCE_PROFILES = {
  lowLatency: { label: 'Low Latency', detection: 0.5, tracking: 0.5, frameModulo: 2 },
  balanced: { label: 'Balanced', detection: 0.58, tracking: 0.58, frameModulo: 1 },
  highAccuracy: { label: 'High Accuracy', detection: 0.68, tracking: 0.68, frameModulo: 1 },
};

const MESSAGE_QUICK_REACTIONS = ['👍', '👏', '💙', '❤️', '😂'];
const MESSAGE_EMOJI_REACTIONS = [
  '👍', '👏', '💙', '❤️', '😂', '😮', '🙏', '🔥', '✅', '✨',
  '😍', '🥰', '😊', '😎', '🤝', '👌', '💯', '🎉', '🌟', '🙌',
  '😢', '😄', '🤗', '😇', '💪', '🫶', '🤟', '👋', '🙃', '🥳',
];

const GESTURE_STICKERS = [
  { emoji: '👋', label: 'Hello wave', note: 'Friendly greeting for starting a conversation.' },
  { emoji: '🙏', label: 'Thank you', note: 'Polite appreciation sticker.' },
  { emoji: '🤝', label: 'Agreed', note: 'Use when both sides understand.' },
  { emoji: '🤟', label: 'Sign love', note: 'Supportive sign-language sticker.' },
  { emoji: '💪', label: 'Keep practicing', note: 'Motivation for learning signs.' },
  { emoji: '🧠', label: 'I understand', note: 'Clear understanding signal.' },
  { emoji: '❓', label: 'Need help', note: 'Ask for support or clarification.' },
  { emoji: '📞', label: 'Call me', note: 'Quick request to switch to call.' },
  { emoji: '✅', label: 'Practice done', note: 'Confirm lesson or sign practice completion.' },
  { emoji: '🌟', label: 'Great sign', note: 'Positive feedback for a good sign.' },
  { emoji: '⏳', label: 'Wait please', note: 'Ask the other person to pause.' },
  { emoji: '🔁', label: 'Repeat sign', note: 'Request the sign again.' },
];

const COMPOSER_EMOJIS = ['😀', '😂', '😊', '😍', '🙏', '👍', '👏', '💙', '❤️', '🔥', '✨', '✅', '🎉', '🤝', '🤟', '👋', '💪', '🌟', '😮', '🥳'];

function SpecialMessageCard({
  message,
  isOutgoing,
  onEditContact,
  onAddContact,
  onVotePoll,
  onEditMeet,
  onSaveMeetDetail,
  audioSpeed = 1,
  onAudioSpeedChange,
}) {
  const audioRef = useRef(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const data = message.attachmentData || {};
  const type = message.attachmentType;

  const audioProgress = audioDuration ? Math.min(100, Math.max(0, audioCurrentTime / audioDuration * 100)) : 0;
  const audioClock = (seconds = 0) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = Number(audioSpeed) || 1;
    }
  }, [audioSpeed]);

  async function toggleAudioPlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try {
        await audio.play();
        setAudioPlaying(true);
      } catch (error) {
        setAudioPlaying(false);
      }
      return;
    }
    audio.pause();
    setAudioPlaying(false);
  }

  if (!type) return null;

  if (type === 'document') {
    return (
      <div className="specialMessageCard specialDocumentCard">
        <Attach3DIcon type="document" />
        <div>
          <span>Vault Document</span>
          <strong>{data.title || 'Document'}</strong>
          <small>{data.fileType || 'File'} · {data.size || 'Ready'} · secure attachment</small>
        </div>
        <div className="specialCardActions">
          {data.url ? <a href={data.url} target="_blank" rel="noopener noreferrer">Preview</a> : <button type="button">Preview</button>}
          {data.url ? <a href={data.url} download={data.title}>Download</a> : <button type="button">Download</button>}
        </div>
      </div>
    );
  }

  if (type === 'image') {
    return (
      <div className="specialMessageCard specialImageCard">
        {data.url ? <img src={data.url} alt={data.title || 'Shared visual'} /> : <Attach3DIcon type="gallery" />}
        <div>
          <span>{data.mode || 'Image'}</span>
          <strong>{data.title || 'Shared image'}</strong>
          <small>{data.quality || 'Simple'} · image sent as image</small>
        </div>
        <div className="specialCardActions">
          {data.url ? <a href={data.url} target="_blank" rel="noopener noreferrer">Preview</a> : <button type="button">Preview</button>}
          {data.url ? <a href={data.url} download={data.title}>Download</a> : null}
        </div>
      </div>
    );
  }

  if (type === 'audio') {
    return (
      <div className="specialMessageCard specialAudioCard">
        <Attach3DIcon type="audio" />
        <div>
          <span>Music / Audio Note</span>
          <strong>{data.title || 'Audio note'}</strong>
          {data.url ? (
            <div className="audioListenPanel">
              <button type="button" className="audioPlayButton" onClick={toggleAudioPlayback} aria-label={audioPlaying ? 'Pause voice note' : 'Play voice note'}>
                {audioPlaying ? 'Ⅱ' : '▶'}
              </button>
              <div className="audioWavePanel">
                <span style={{ '--audio-progress': `${audioProgress}%` }} />
                <small>{audioClock(audioCurrentTime)} / {audioClock(audioDuration || Number(data.durationSeconds || 0))}</small>
              </div>
              <audio
                ref={audioRef}
                src={data.url}
                preload="metadata"
                onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration || 0)}
                onTimeUpdate={(event) => setAudioCurrentTime(event.currentTarget.currentTime || 0)}
                onPlay={() => setAudioPlaying(true)}
                onPause={() => setAudioPlaying(false)}
                onEnded={() => {
                  setAudioPlaying(false);
                  setAudioCurrentTime(0);
                }}
              />
            </div>
          ) : <small className="audioMissingNotice">Audio unavailable - record or upload again</small>}
          <div className="audioSpeedControls">
            <button type="button" className={audioSpeed === 1 ? 'activeAudioSpeed' : ''} onClick={() => onAudioSpeedChange(1)}>1x</button>
            <button type="button" className={audioSpeed === 2 ? 'activeAudioSpeed' : ''} onClick={() => onAudioSpeedChange(2)}>2x</button>
            <button type="button" onClick={() => onAudioSpeedChange('custom')}>Custom</button>
          </div>
        </div>
      </div>
    );
  }

  if (type === 'cameraClip') {
    return (
      <div className="specialMessageCard specialCameraCard">
        <Attach3DIcon type="camera" />
        <div>
          <span>Live Camera Clip</span>
          <strong>{data.title || 'Snap-style camera clip'}</strong>
          <small>{data.camera || 'Front camera'} · switch camera supported</small>
        </div>
        <button type="button">Open</button>
      </div>
    );
  }

  if (type === 'meet') {
    return (
      <div className="specialMessageCard specialMeetCard">
        <Attach3DIcon type="event" />
        <div>
          <span>Meet Moment</span>
          <strong>{data.title || 'Signova Meet Moment'}</strong>
          <small>{data.date} · {data.time} · Reminder {data.reminder}</small>
          <em>{isOutgoing ? 'You can edit this meet moment after sending.' : 'Save this to notes, reminders, calendar, or alarms.'}</em>
        </div>
        {isOutgoing ? (
          <button type="button" onClick={onEditMeet}>Edit</button>
        ) : (
          <div className="meetReceiverActions">
            <button type="button" onClick={() => onSaveMeetDetail('notes')}>Notes</button>
            <button type="button" onClick={() => onSaveMeetDetail('reminder')}>Reminder</button>
            <button type="button" onClick={() => onSaveMeetDetail('calendar')}>Calendar</button>
            <button type="button" onClick={() => onSaveMeetDetail('alarm')}>Alarm</button>
          </div>
        )}
      </div>
    );
  }

  if (type === 'poll') {
    const options = data.options || [];
    const votes = data.votes || options.map(() => 0);
    const totalVotes = votes.reduce((total, vote) => total + Number(vote || 0), 0);
    return (
      <div className="specialMessageCard specialPollCard">
        <Attach3DIcon type="poll" />
        <div>
          <span>Audience Poll</span>
          <strong>{data.title || 'Poll'}</strong>
          <div className="specialPollOptions">
            {options.map((option, index) => (
              <button
                type="button"
                className={data.selectedOption === index ? 'selectedPollOption' : ''}
                key={`${option}-${index}`}
                onClick={() => onVotePoll(index)}
              >
                <span>{index + 1}. {option}</span>
                <i style={{ '--poll-percent': `${totalVotes ? Math.round((votes[index] || 0) / totalVotes * 100) : 0}%` }} />
                <small>{votes[index] || 0} vote{(votes[index] || 0) === 1 ? '' : 's'} · {totalVotes ? Math.round((votes[index] || 0) / totalVotes * 100) : 0}%</small>
              </button>
            ))}
          </div>
          <small>{totalVotes ? `${totalVotes} audience response${totalVotes === 1 ? '' : 's'} collected` : 'Waiting for audience responses'}</small>
        </div>
      </div>
    );
  }

  if (type === 'contact') {
    return (
      <div className="specialMessageCard specialContactCard">
        <Attach3DIcon type="contact" />
        <div>
          <span>Signova Contact</span>
          <strong>{data.title || 'Contact'}</strong>
          <small>{data.username}{data.number ? ` · ${data.number}` : ''}</small>
        </div>
        <button type="button" onClick={isOutgoing ? onEditContact : onAddContact}>{isOutgoing ? 'Edit' : 'Add'}</button>
      </div>
    );
  }

  if (type === 'sticker') {
    return (
      <div className="specialMessageCard specialStickerCard">
        <Attach3DIcon type="sticker" />
        <div>
          <span>Gesture Sticker</span>
          <strong>{data.title}</strong>
          <small>{data.note}</small>
        </div>
      </div>
    );
  }

  return null;
}

function bytesToBase64(bytes) {
  return window.btoa(String.fromCharCode(...new Uint8Array(bytes)));
}

function base64ToBytes(base64) {
  return Uint8Array.from(window.atob(base64), (char) => char.charCodeAt(0));
}

async function createChatKey() {
  return window.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  );
}

async function encryptMessage(key, text) {
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(text);
  const cipher = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    cipherText: bytesToBase64(cipher),
    iv: bytesToBase64(iv),
  };
}

async function decryptMessage(key, payload) {
  const decoded = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(payload.iv) },
    key,
    base64ToBytes(payload.cipherText),
  );
  return new TextDecoder().decode(decoded);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing?.dataset.loaded === 'true') {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener('load', resolve, { once: true });
      existing.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error('Required Signova media script failed to load'));
    document.body.appendChild(script);
  });
}

async function loadMediaPipeScripts() {
  for (const src of SCRIPTS) {
    await loadScript(src);
  }
  if (typeof window.Hands !== 'function') {
    throw new Error('MediaPipe Hands unavailable');
  }
}

async function fetchJson(path, options = {}) {
  const predictPath = path.includes('/predict');
  const controller = new AbortController();
  const timeoutMs = predictPath ? REQUEST_TIMEOUT_MS : 2500;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    const activeUser = firebaseAuth?.currentUser;
    if (activeUser && !headers.has('Authorization')) {
      const token = await activeUser.getIdToken();
      headers.set('Authorization', `Bearer ${token}`);
    }
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Request failed with ${response.status}`);
    }
    return { ...data, apiSource: 'backend' };
  } finally {
    window.clearTimeout(timeout);
  }
}

function resolveSpeechLang(language = 'English') {
  if (language === 'Hindi') return 'hi-IN';
  if (language === 'Hinglish') return 'hi-IN';
  return 'en-IN';
}

function speak(text, language = 'English') {
  if (!text || !window.speechSynthesis) return;
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = resolveSpeechLang(language);
  const voices = window.speechSynthesis.getVoices?.() || [];
  const matchingVoice = voices.find((voice) => voice.lang === utterance.lang)
    || voices.find((voice) => voice.lang?.startsWith(utterance.lang.slice(0, 2)));
  if (matchingVoice) utterance.voice = matchingVoice;
  utterance.rate = 1.12;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function formatConfidence(value) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value * 100)}%`;
}

function normalizeUsername(value) {
  const clean = value.trim().replace(/^@+/, '').replace(/[^a-zA-Z0-9._]/g, '').toLowerCase();
  return clean ? `@${clean}` : '';
}

function validateUsername(username) {
  const clean = normalizeUsername(username);
  if (!clean) return { valid: false, username: '', error: 'Username required hai.' };
  if (!/^@[a-z0-9](?:[a-z0-9._]{2,28}[a-z0-9])$/.test(clean)) {
    return {
      valid: false,
      username: clean,
      error: 'Username 4-30 characters ka hona chahiye, sirf letters, numbers, dot, underscore. Start/end letter ya number se ho.',
    };
  }
  if (clean.includes('..') || clean.includes('__') || clean.includes('._') || clean.includes('_.')) {
    return { valid: false, username: clean, error: 'Username me repeated dot/underscore pattern allowed nahi hai.' };
  }
  return { valid: true, username: clean, error: '' };
}

function normalizePhoneNumber(countryCode, number) {
  const selectedCountry = CONTACT_COUNTRIES.find((item) => item.code === countryCode) || CONTACT_COUNTRIES[0];
  const digits = String(number || '').replace(/\D/g, '');
  if (!digits) return { valid: true, countryCode: selectedCountry.code, nationalNumber: '', fullNumber: '', country: selectedCountry.country, error: '' };
  if (digits.length < 7 || digits.length > 15) {
    return { valid: false, countryCode: selectedCountry.code, nationalNumber: digits, fullNumber: '', country: selectedCountry.country, error: 'Phone number 7-15 digits ka hona chahiye.' };
  }
  return {
    valid: true,
    countryCode: selectedCountry.code,
    nationalNumber: digits,
    fullNumber: `${selectedCountry.code} ${digits}`,
    country: selectedCountry.country,
    error: '',
  };
}

function normalizeContactRecord(contact) {
  const phone = normalizePhoneNumber(contact.countryCode || '+91', contact.nationalNumber || contact.number || '');
  return {
    ...contact,
    countryCode: phone.countryCode,
    country: contact.country || phone.country,
    nationalNumber: phone.nationalNumber,
    number: phone.fullNumber || contact.number || '',
    username: normalizeUsername(contact.username || ''),
    showUsername: contact.showUsername !== false,
    showNumber: Boolean(contact.showNumber && (phone.fullNumber || contact.number)),
  };
}

function contactInitial(contact) {
  return (contact?.name || contact?.username || 'S').trim().charAt(0).toUpperCase();
}

function formatMetricPercent(value) {
  if (!Number.isFinite(value)) return 'N/A';
  const percent = value > 1 ? value : value * 100;
  return `${percent.toFixed(percent >= 10 ? 1 : 2)}%`;
}

function formatPracticeTime(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0m';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes % 60);
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
}

function radarPolygonPoints(values, radius = 76, center = 100) {
  return values.map((value, index) => {
    const angle = (-90 + (index * 360) / values.length) * (Math.PI / 180);
    const scaledRadius = radius * (Math.max(0, Math.min(100, value)) / 100);
    return `${center + Math.cos(angle) * scaledRadius},${center + Math.sin(angle) * scaledRadius}`;
  }).join(' ');
}

function inferSignLanguage(sign = {}, fallback = 'ISL') {
  const source = `${sign.source || ''} ${sign.sources || ''} ${sign.language || ''} ${sign.label || ''} ${sign.sign || ''}`.toLowerCase();
  if (source.includes('asl')) return 'ASL';
  if (source.includes('isl') || source.includes('cslrt')) return 'ISL';
  if (source.includes('bsl')) return 'BSL';
  if (source.includes('alphabet')) return 'English';
  return fallback;
}

function normalizeSignText(value = '') {
  return String(value).replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function getSignTokenCount(sign = {}) {
  const phrase = normalizeSignText(sign.sign || sign.label || '');
  if (!phrase) return 0;
  return phrase.split(/\s+/).filter(Boolean).length;
}

function getSignBookType(sign = {}) {
  const label = normalizeSignText(sign.label || sign.sign || '');
  const source = `${sign.source || ''} ${sign.language || ''}`.toLowerCase();
  const phrase = normalizeSignText(sign.sign || sign.label || '');
  const tokenCount = getSignTokenCount(sign);

  if (
    source.includes('alphabet')
    || /^[a-z]$/i.test(label)
    || /^[a-z]$/i.test(phrase)
    || ['space', 'del', 'delete'].includes(label.toLowerCase())
  ) {
    return 'letters';
  }

  if (
    source.includes('sentence')
    || source.includes('isl')
    || source.includes('cslrt')
    || tokenCount >= 3
  ) {
    return 'sentences';
  }

  return 'words';
}

function buildSignUsage(sign = {}, bookType = 'words') {
  const phrase = normalizeSignText(sign.sign || sign.label || 'this sign');
  if (bookType === 'letters') {
    return `Use ${phrase} for fingerspelling, spelling names, and building community-created words.`;
  }
  if (bookType === 'sentences') {
    return `Use this sentence sign when the full meaning is needed in one steady gesture.`;
  }
  return `Use ${phrase} as daily vocabulary in word mode before joining it into a sentence.`;
}

function buildSignPurpose(sign = {}, bookType = 'words') {
  if (bookType === 'letters') {
    return 'Purpose: trains handshape accuracy and helps users create new signs step by step.';
  }
  if (bookType === 'sentences') {
    return 'Purpose: supports sentence-mode practice for clearer call captions and voice output.';
  }
  return 'Purpose: turns one useful concept into text or voice during live translation.';
}

function toPointArray(points = []) {
  return points.map((point) => [point.x, point.y, point.z || 0]);
}

function ContactAvatar({ contact, className = 'avatar', presenceTone = '' }) {
  const initial = contactInitial(contact);
  const avatarChoice = contact?.avatarChoice || 'signova';
  const presenceIndicator = presenceTone ? <i className={`avatarPresenceIndicator ${presenceTone}`} aria-hidden="true" /> : null;
  if (contact?.profileImage) {
    return (
      <span className={`${className} contactAvatar uploadedContactAvatar`}>
        <img src={contact.profileImage} alt="" />
        {presenceIndicator}
      </span>
    );
  }

  if (avatarChoice === 'initial') {
    return <span className={`${className} contactAvatar initialContactAvatar`}>{initial}{presenceIndicator}</span>;
  }

  return (
    <span className={`${className} contactAvatar signovaContactAvatar`}>
      <img src="/app-logo.png" alt="" />
      <em>{initial}</em>
      {presenceIndicator}
    </span>
  );
}

function ContactMetaLine({ contact, activityStatus = '', activityItems = [], fallback = 'Private contact' }) {
  const items = [
    contact?.showUsername !== false ? contact?.username : null,
    contact?.showNumber ? contact?.number : null,
  ].filter(Boolean);
  const liveItems = activityItems.length ? activityItems : (activityStatus ? [activityStatus] : []);

  if (!items.length && !liveItems.length) return <small className="contactMetaLine">{fallback}</small>;

  return (
    <small className="contactMetaLine">
      {items.map((item, index) => (
        <Fragment key={`${item}-${index}`}>
          {index > 0 ? <i aria-hidden="true">·</i> : null}
          <b>{item}</b>
        </Fragment>
      ))}
      {liveItems.length ? (
        <>
          {items.length ? <i aria-hidden="true">·</i> : null}
          <span className="headerActivityTicker" aria-label={liveItems[0]}>
            {liveItems.slice(0, 3).map((item, index) => <em key={`${item}-${index}`}>{item}</em>)}
          </span>
        </>
      ) : null}
    </small>
  );
}

function VoiceSignChatIcon() {
  return (
    <svg className="minimalHeaderSvg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.75a3 3 0 0 0-3 3v4.5a3 3 0 0 0 6 0v-4.5a3 3 0 0 0-3-3Z" />
      <path d="M6.5 10.5a5.5 5.5 0 0 0 11 0" />
      <path d="M12 16v3.25" />
      <path d="M15.75 14.5h2.4a2.1 2.1 0 0 1 0 4.2h-.65l-1.75 1.3v-1.3a2.1 2.1 0 0 1 0-4.2Z" />
    </svg>
  );
}

function VideoSignChatIcon() {
  return (
    <svg className="minimalHeaderSvg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.75" y="6.5" width="11.5" height="8.8" rx="2.2" />
      <path d="M15.25 9.2 20.25 7v7.8l-5-2.2" />
      <path d="M9 18.7v-4.1" />
      <path d="M12 18.35v-4.8" />
      <path d="M6.75 18.4c1.55 1.5 5.6 1.75 7.9-.2" />
    </svg>
  );
}

function HeaderSearchIcon() {
  return (
    <svg className="minimalHeaderSvg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="10.8" cy="10.8" r="5.9" />
      <path d="M15.2 15.2 20 20" />
    </svg>
  );
}

function HeaderMoreIcon() {
  return (
    <svg className="minimalHeaderSvg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="6.8" r="1.25" />
      <circle cx="12" cy="12" r="1.25" />
      <circle cx="12" cy="17.2" r="1.25" />
    </svg>
  );
}

function getCallHistoryPresentation(type = '') {
  const normalizedType = String(type).toLowerCase();
  if (normalizedType === 'video-sign-chat' || normalizedType === 'video-sign' || normalizedType === 'video') {
    return { label: 'Video Sign Chat', tone: 'video', translation: 'Sign translation used' };
  }
  if (normalizedType === 'voice-sign-chat' || normalizedType === 'voice-sign' || normalizedType === 'voice') {
    return { label: 'Voice Sign Chat', tone: 'voice', translation: 'Voice translation used' };
  }
  if (['meeting', 'videomeeting', 'voicemeeting', 'webrtc'].includes(normalizedType)) {
    return { label: 'Video Sign Chat', tone: 'video', translation: 'Sign translation used' };
  }
  return { label: 'Normal Call', tone: 'normal', translation: 'No translation' };
}

function Attach3DIcon({ type }) {
  const id = useId().replace(/:/g, '');
  const colors = {
    document: ['#4f46e5', '#38bdf8'],
    home: ['#22d3ee', '#2563eb'],
    learn: ['#8b5cf6', '#38bdf8'],
    practice: ['#14b8a6', '#0f766e'],
    community: ['#fb7185', '#ec4899'],
    settings: ['#93c5fd', '#2563eb'],
    archive: ['#38bdf8', '#1d4ed8'],
    gallery: ['#0ea5e9', '#22d3ee'],
    camera: ['#ec4899', '#f43f5e'],
    audio: ['#fb923c', '#f97316'],
    contact: ['#06b6d4', '#0f766e'],
    poll: ['#fbbf24', '#f59e0b'],
    event: ['#ef4444', '#db2777'],
    sticker: ['#14b8a6', '#10b981'],
    search: ['#60a5fa', '#2563eb'],
    more: ['#93c5fd', '#2563eb'],
    info: ['#38bdf8', '#1d4ed8'],
    select: ['#818cf8', '#4f46e5'],
    mute: ['#fb923c', '#f97316'],
    pin: ['#22d3ee', '#0891b2'],
    heart: ['#fb7185', '#e11d48'],
    lock: ['#64748b', '#334155'],
    share: ['#06b6d4', '#0f766e'],
    link: ['#2dd4bf', '#0f766e'],
    translate: ['#38bdf8', '#4f46e5'],
    report: ['#f59e0b', '#dc2626'],
    block: ['#f87171', '#991b1b'],
    clear: ['#94a3b8', '#475569'],
    trash: ['#f43f5e', '#be123c'],
    copy: ['#38bdf8', '#2563eb'],
    forward: ['#2dd4bf', '#0f766e'],
    retry: ['#60a5fa', '#4f46e5'],
    edit: ['#fbbf24', '#f97316'],
    unsend: ['#fb7185', '#be123c'],
  };
  const [start, end] = colors[type] || colors.document;
  const iconPaths = {
    document: <path d="M20 11h13l7 7v25H20zM32 11v9h8M25 28h10M25 34h10" />,
    home: <path d="M14 27 28 15l14 12v15H18V29M24 42V31h8v11" />,
    learn: <path d="M15 18c7-3 13-2 13 3v23c-4-4-8-5-13-3zM28 21c0-5 6-6 13-3v23c-5-2-9-1-13 3zM28 21v23" />,
    practice: <path d="M28 14a14 14 0 1 0 0 28 14 14 0 0 0 0-28zM28 20v8l6 4M18 28h4M34 18l3-3M39 28h4" />,
    community: <path d="M22 17a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM38 20a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM13 43c2-7 6-10 12-10 4 0 7 1.6 9 5M33 42c1.5-4 4-6 8-6 3 0 5.5 1.2 7 4" />,
    settings: <path d="M28 19a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM28 12v5M28 39v5M16 18l4 4M36 36l4 4M12 28h5M39 28h5M16 40l4-4M36 20l4-4" />,
    archive: <path d="M15 18h26l-2 7H17zM18 25h20v17H18zM24 31h8M22 14h14" />,
    gallery: <path d="M14 19h27v20H14zM18 34l6-7 5 5 4-4 6 6M22 24h.1" />,
    camera: <path d="M13 21h8l3-4h9l3 4h7v18H13zM28 26a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" />,
    audio: <path d="M28 12a5 5 0 0 0-5 5v11a5 5 0 0 0 10 0V17a5 5 0 0 0-5-5zM17 27c0 7 4.5 12 11 12s11-5 11-12M28 39v6" />,
    contact: <path d="M28 14a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16 42c2-7 6.5-10 12-10s10 3 12 10M38 17h7M41.5 13.5v7" />,
    poll: <path d="M16 39h5V27h-5zM26 39h5V18h-5zM36 39h5V23h-5zM14 43h29" />,
    event: <path d="M16 18h26v25H16zM16 25h26M22 13v8M36 13v8M23 31h5M32 31h5M23 37h5" />,
    sticker: <path d="M17 14h24v17L30 42H17zM30 42V31h11M23 24h.1M34 24h.1M23 32c3 3 8 3 11 0" />,
    search: <path d="M25 16a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM33 33l8 8" />,
    more: <path d="M28 18h.1M28 28h.1M28 38h.1" />,
    info: <path d="M28 17h.1M25 25h4v13M23 38h10M28 12a16 16 0 1 0 0 32 16 16 0 0 0 0-32z" />,
    select: <path d="M16 16h24v24H16zM21 28l5 5 10-12" />,
    mute: <path d="M17 31h6l8 7V18l-8 7h-6zM38 24l5 8M43 24l-5 8" />,
    pin: <path d="M22 14h14l-4 10 6 6H18l6-6zM28 30v12" />,
    heart: <path d="M28 42s-13-7.5-13-17a7 7 0 0 1 12-5 7 7 0 0 1 12 5c0 9.5-11 17-11 17z" />,
    lock: <path d="M18 25h20v17H18zM23 25v-6a5 5 0 0 1 10 0v6M28 32v4" />,
    share: <path d="M22 24a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM16 42c1.5-7 5-10 10-10M34 18h9M38.5 13.5v9M33 32l9 9M42 32l-9 9" />,
    link: <path d="M23 21l-3 3a7 7 0 0 0 10 10l3-3M33 25l3-3a7 7 0 0 0-10-10l-3 3M24 32l8-8" />,
    translate: <path d="M15 17h16M23 13v20M17 33c6-3 10-9 12-16M31 39l4-10 4 10M32.5 35h5" />,
    report: <path d="M28 14l15 27H13zM28 23v8M28 36h.1" />,
    block: <path d="M28 13a15 15 0 1 0 0 30 15 15 0 0 0 0-30zM18 38l20-20" />,
    clear: <path d="M17 20h25M22 20l3-5h10l3 5M22 25l2 15h14l2-15M26 30h8" />,
    trash: <path d="M17 20h22M22 20l2-5h10l2 5M21 25l2 17h12l2-17M26 30v7M32 30v7" />,
    copy: <path d="M18 19h18v18H18zM24 13h18v18" />,
    forward: <path d="M17 29h21M31 20l9 9-9 9" />,
    retry: <path d="M39 22a13 13 0 1 0 2 10M39 15v7h-7" />,
    edit: <path d="M18 38l3-9 15-15 6 6-15 15zM32 18l6 6M18 38l9-3" />,
    unsend: <path d="M39 21H21M21 21l8-8M21 21l8 8M18 35h20" />,
  };
  return (
    <span className={`attachIcon3d attachIcon3d-${type}`} aria-hidden="true">
      <svg viewBox="0 0 56 56" focusable="false">
        <defs>
          <linearGradient id={`attach-${id}`} x1="12" y1="8" x2="44" y2="48">
            <stop stopColor={start} />
            <stop offset="1" stopColor={end} />
          </linearGradient>
          <filter id={`attach-shadow-${id}`} x="-30%" y="-20%" width="160%" height="160%">
            <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor={end} floodOpacity="0.26" />
          </filter>
        </defs>
        <rect x="8" y="8" width="40" height="40" rx="13" fill={`url(#attach-${id})`} filter={`url(#attach-shadow-${id})`} />
        <path d="M16 14c7-5 18-5 25 0" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.38" fill="none" />
        <g fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          {iconPaths[type] || iconPaths.document}
        </g>
      </svg>
    </span>
  );
}

function RailIcon({ type }) {
  const uniqueId = useId().replace(/:/g, '');
  const iconId = `rail-${type}-${uniqueId}`;
  const icons = {
    home: (
      <>
        <path d="M8 23.5 24 9l16 14.5v16c0 1.3-1 2.3-2.3 2.3h-9.2V30.5h-9v11.3h-9.2C9 41.8 8 40.8 8 39.5v-16Z" fill={`url(#${iconId}-main)`} />
        <path d="M5.8 24.2 24 7.8l18.2 16.4" stroke={`url(#${iconId}-accent)`} strokeWidth="5.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15 22.6c5.4-4.7 12.5-5.2 18.1-1.2" className="iconShine" />
        <rect x="20.2" y="30" width="7.6" height="11.7" rx="2.2" fill="#f8fbff" opacity="0.94" />
      </>
    ),
    practice: (
      <>
        <circle cx="24" cy="24" r="17" fill={`url(#${iconId}-main)`} />
        <circle cx="24" cy="24" r="11" fill="#edf7ff" opacity="0.96" />
        <circle cx="24" cy="24" r="5.4" fill={`url(#${iconId}-accent)`} />
        <path d="M24 4v7M24 37v7M4 24h7M37 24h7" stroke={`url(#${iconId}-accent)`} strokeWidth="4" strokeLinecap="round" />
        <path d="M14 13c4.8-4 12.2-5.2 18.4-1.6" className="iconShine" />
      </>
    ),
    camera: (
      <>
        <rect x="7.5" y="13" width="28" height="23" rx="7" fill={`url(#${iconId}-main)`} />
        <path d="m35 20 7-4v17l-7-4V20Z" fill={`url(#${iconId}-accent)`} />
        <circle cx="21.5" cy="24.5" r="7.2" fill="#eff9ff" opacity="0.96" />
        <circle cx="21.5" cy="24.5" r="3.8" fill={`url(#${iconId}-accent)`} />
        <path d="M12 17c4.5-3 12.4-3.4 18.3-.4" className="iconShine" />
      </>
    ),
    conversations: (
      <>
        <path d="M9 21c0-7.2 6.6-13 14.8-13s14.8 5.8 14.8 13-6.6 13-14.8 13c-1.8 0-3.5-.3-5.1-.8L10 38l2.7-7.2C10.4 28.4 9 24.9 9 21Z" fill={`url(#${iconId}-main)`} />
        <path d="M14 15c4.8-4 13.8-4.6 19.2.2" className="iconShine" />
        <circle cx="18" cy="21" r="2.2" fill="#fff" opacity="0.94" />
        <circle cx="24" cy="21" r="2.2" fill="#fff" opacity="0.94" />
        <circle cx="30" cy="21" r="2.2" fill="#fff" opacity="0.94" />
      </>
    ),
    voiceHistory: (
      <>
        <path d="M8.6 20.2c0-7.1 6.4-12.4 15.1-12.4 8.5 0 15.2 5.3 15.2 12.2 0 6.7-6.5 12.1-14.8 12.1-1.6 0-3.2-.2-4.7-.7l-7.5 4.6 2.1-6.5c-3.3-2.2-5.4-5.5-5.4-9.3Z" fill={`url(#${iconId}-main)`} />
        <path d="M27.6 15.4a4.3 4.3 0 0 0-8.6 0v5.1a4.3 4.3 0 0 0 8.6 0v-5.1Z" fill="#f8fbff" opacity="0.96" />
        <path d="M16.1 19.5c0 4.8 3.2 8.1 7.2 8.1s7.2-3.3 7.2-8.1" className="voiceHistoryMicArc" />
        <path d="M23.3 27.4v4.4" className="voiceHistoryMicArc" />
        <path d="M19.5 31.8h7.6" className="voiceHistoryMicArc" />
        <path d="M35.6 26.3a7.7 7.7 0 1 1-6.4 12" fill="none" stroke={`url(#${iconId}-accent)`} strokeWidth="4" strokeLinecap="round" />
        <path d="M35.5 26.3v6.2h-6.2" fill="none" stroke={`url(#${iconId}-accent)`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <g className="voiceHistoryWaveBars">
          <rect x="14.5" y="18" width="2.5" height="6.5" rx="1.25" fill={`url(#${iconId}-accent)`} />
          <rect x="31.1" y="16.5" width="2.5" height="9.5" rx="1.25" fill={`url(#${iconId}-accent)`} />
          <rect x="35" y="18.4" width="2.4" height="5.7" rx="1.2" fill="#ffffff" opacity="0.9" />
        </g>
        <path d="M14.2 14.2c4.7-3.5 13.2-4.1 19.5.2" className="iconShine" />
      </>
    ),
    translate: (
      <>
        <rect x="8" y="10" width="22" height="20" rx="6" fill={`url(#${iconId}-main)`} />
        <rect x="18" y="18" width="22" height="20" rx="6" fill={`url(#${iconId}-accent)`} opacity="0.92" />
        <path d="M12 15h13" className="iconShine" />
        <path d="M15 23h8M19 16v14M14 30c4.2-2.2 7.2-6.4 8.2-11" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M27 31l3-7 3 7M28.3 28.4h3.4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </>
    ),
    learn: (
      <>
        <path d="M8 13c4.8-2.2 10.4-1.8 15 1.4v24c-4.5-3.3-9.8-3.7-15-1.4V13Z" fill={`url(#${iconId}-main)`} />
        <path d="M25 14.4c4.6-3.2 10.2-3.6 15-1.4v24c-5.2-2.3-10.5-1.9-15 1.4v-24Z" fill={`url(#${iconId}-accent)`} />
        <path d="M12 15.5c3.2-.8 6-.3 8.4 1.4M29 16.8c2.6-1.2 5.2-1.5 7.8-.7" className="iconShine" />
        <path d="M14 20h6M14 26h6M30 20h6M30 26h6" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" opacity="0.88" />
      </>
    ),
    library: (
      <>
        <g className="libraryBookStack">
          <rect className="libraryBook3d libraryBookBack" x="9.5" y="13.5" width="8.6" height="25.5" rx="3" fill={`url(#${iconId}-main)`} />
          <rect className="libraryBook3d libraryBookMiddle" x="19.6" y="9.5" width="9.2" height="29.5" rx="3.2" fill={`url(#${iconId}-accent)`} />
          <rect className="libraryBook3d libraryBookFront" x="30.3" y="15" width="8.4" height="24" rx="3" fill={`url(#${iconId}-main)`} />
          <path className="libraryShelfLine" d="M8.6 39.4h31.8" stroke="#0f766e" strokeWidth="4.2" strokeLinecap="round" opacity="0.5" />
          <path d="M12.7 18.2h2.2M22.6 14.4h3.4M33.2 19.4h2.2M12.7 32.7h2.2M22.6 33.8h3.4M33.2 32.7h2.2" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity="0.86" />
          <path d="M11.8 16.7c1.2-.9 3.1-1 4.5-.2M21.7 12.5c1.5-.9 3.9-1 5.5-.1M32.2 18c1.2-.7 2.8-.8 4-.1" className="iconShine" />
        </g>
      </>
    ),
    progress: (
      <>
        <path d="M10 36h28" stroke="#0f766e" strokeWidth="4" strokeLinecap="round" opacity="0.45" />
        <rect x="11" y="25" width="7" height="11" rx="3" fill={`url(#${iconId}-main)`} />
        <rect x="22" y="18" width="7" height="18" rx="3" fill={`url(#${iconId}-main)`} />
        <rect x="33" y="11" width="7" height="25" rx="3" fill={`url(#${iconId}-accent)`} />
        <path d="M10 23l8-7 7 5 12-13" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M34 8h7v7" stroke="#10b981" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 27h4M24 20h4M35 13h3" className="iconShine" />
      </>
    ),
    community: (
      <>
        <circle cx="20" cy="17" r="6" fill={`url(#${iconId}-main)`} />
        <circle cx="32" cy="19" r="5" fill={`url(#${iconId}-accent)`} opacity="0.92" />
        <path d="M10 37c1.2-7.2 5.4-11 10-11s8.8 3.8 10 11H10Z" fill={`url(#${iconId}-main)`} />
        <path d="M26 37c.8-5.8 3.5-9 7-9 3.7 0 6.4 3.2 7 9H26Z" fill={`url(#${iconId}-accent)`} opacity="0.9" />
        <path d="M16 13.5c2.2-1.4 5.2-1.1 7 .6" className="iconShine" />
      </>
    ),
    communityFeed: (
      <>
        <rect x="8" y="9" width="32" height="30" rx="9" fill={`url(#${iconId}-main)`} />
        <rect x="13" y="14" width="22" height="6" rx="3" fill="#fff" opacity="0.88" />
        <rect x="13" y="23" width="16" height="4.8" rx="2.4" fill="#fff" opacity="0.68" />
        <rect x="13" y="31" width="11" height="4.8" rx="2.4" fill="#fff" opacity="0.58" />
        <circle cx="33" cy="32" r="8" fill={`url(#${iconId}-accent)`} />
        <path d="M29.6 32.4 32 34.8l4.6-5.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 13c5.8-3.1 14.8-3.2 21 .8" className="iconShine" />
      </>
    ),
    communityGroups: (
      <>
        <circle cx="18" cy="17" r="6" fill={`url(#${iconId}-main)`} />
        <circle cx="31" cy="17" r="6" fill={`url(#${iconId}-accent)`} opacity="0.94" />
        <circle cx="24.5" cy="28" r="6.4" fill={`url(#${iconId}-main)`} />
        <path d="M8 40c1-6.4 4.5-10.2 9.5-10.2 4.8 0 8.2 3.6 9.1 10.2H8Z" fill={`url(#${iconId}-main)`} opacity="0.92" />
        <path d="M21 40c1-6.7 4.8-10.6 10-10.6S39.8 33.3 41 40H21Z" fill={`url(#${iconId}-accent)`} opacity="0.9" />
        <path d="M15 13.2c2.6-1.6 6.4-1.2 8.8 1" className="iconShine" />
      </>
    ),
    settings: (
      <>
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <rect
            key={angle}
            x="20.4"
            y="4.6"
            width="7.2"
            height="12.2"
            rx="3.2"
            fill={`url(#${iconId}-main)`}
            transform={`rotate(${angle} 24 24)`}
          />
        ))}
        <circle cx="24" cy="24" r="14.2" fill={`url(#${iconId}-main)`} />
        <circle cx="24" cy="24" r="9.2" fill="#eef6ff" />
        <circle cx="24" cy="24" r="4.8" fill={`url(#${iconId}-accent)`} />
        <path d="M15.8 15.6c4.7-3.6 11.6-3.8 16.4-.1" className="iconShine" />
      </>
    ),
  };

  return (
    <span className={`railIcon3d ${type}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" role="img" focusable="false">
        <defs>
          <linearGradient id={`${iconId}-main`} x1="8" y1="6" x2="39" y2="42" gradientUnits="userSpaceOnUse">
            <stop stopColor={type === 'progress' ? '#34d399' : type === 'settings' ? '#9aa8bd' : type === 'communityFeed' ? '#60a5fa' : type === 'communityGroups' ? '#a78bfa' : type === 'voiceHistory' ? '#38bdf8' : '#51d7ff'} />
            <stop offset="0.48" stopColor={['conversations', 'community', 'communityFeed', 'communityGroups', 'voiceHistory'].includes(type) ? '#7c5cff' : type === 'settings' ? '#64748b' : '#2f7df6'} />
            <stop offset="1" stopColor={type === 'progress' ? '#059669' : type === 'settings' ? '#475569' : type === 'communityFeed' ? '#1d4ed8' : type === 'communityGroups' ? '#6d28d9' : '#1d4f9a'} />
          </linearGradient>
          <linearGradient id={`${iconId}-accent`} x1="10" y1="8" x2="38" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor={type === 'progress' ? '#6ee7b7' : type === 'communityGroups' ? '#f0abfc' : type === 'voiceHistory' ? '#e0f2fe' : '#eff6ff'} />
            <stop offset="1" stopColor={type === 'progress' ? '#10b981' : type === 'communityGroups' ? '#8b5cf6' : type === 'voiceHistory' ? '#06b6d4' : '#2563eb'} />
          </linearGradient>
          <linearGradient id={`${iconId}-gloss`} x1="12" y1="8" x2="26" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" stopOpacity="0.88" />
            <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <filter id={`${iconId}-shadow`} x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#1d4f9a" floodOpacity="0.22" />
          </filter>
        </defs>
        <ellipse className="iconGroundShadow" cx="24" cy="42" rx="14" ry="3.4" />
        <g className="iconShape" filter={`url(#${iconId}-shadow)`}>{icons[type] || icons.settings}</g>
        <path className="iconGlassSweep" d="M12 8c8 4 16.5 4 24 0" stroke={`url(#${iconId}-gloss)`} strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function SignovaOpeningAnimation({ activePanel = 'community', className = '' }) {
  return (
    <div className={`fullSignovaIntro activeFullSignovaIntro ${className}`} aria-hidden="true">
      <span className="tributeGlow" />
      <span className="tributeIcon tributeIconHome"><RailIcon type="home" /></span>
      <span className="tributeIcon tributeIconChat"><RailIcon type="voiceHistory" /></span>
      <span className="tributeIcon tributeIconLibrary"><RailIcon type="library" /></span>
      <span className="tributeIcon tributeIconLearn"><RailIcon type="learn" /></span>
      <span className="tributeIcon tributeIconCommunity"><RailIcon type={activePanel === 'communityGroups' ? 'communityGroups' : 'communityFeed'} /></span>
      <span className="tributeIcon tributeIconSettings"><RailIcon type="settings" /></span>
      <span className="tributeLogoReveal">
        <span className="openingLogoCore"><img src="/app-logo.png" alt="" /></span>
        <span className="openingBrandCopy">
          <strong>Signova</strong>
          <small>Every Gesture, Give a Voice</small>
        </span>
      </span>
    </div>
  );
}

function AppStartupSkeleton() {
  return (
    <div className="appStartupSkeleton" role="status" aria-live="polite" aria-label="Loading your Signova workspace">
      <aside>
        <span className="startupLogoSkeleton" />
        {[0, 1, 2, 3, 4].map((item) => <i key={item} />)}
      </aside>
      <main>
        <header><span /><i /><i /></header>
        <section className="startupSkeletonWorkspace">
          <div className="startupSkeletonList">
            <b />
            {[0, 1, 2, 3].map((item) => <span key={item}><i /><em /></span>)}
          </div>
          <div className="startupSkeletonContent">
            <b />
            <span />
            <span />
            <span />
            <footer><i /><em /></footer>
          </div>
        </section>
      </main>
      <p>Preparing your workspace…</p>
    </div>
  );
}

function CommunityFeedVideo({ src, label }) {
  const feedVideoRef = useRef(null);

  useEffect(() => {
    const video = feedVideoRef.current;
    if (!video || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || entry.intersectionRatio < 0.2) {
        video.pause();
      }
    }, {
      root: document.querySelector('.communityPostStream'),
      rootMargin: '120px 0px',
      threshold: [0, 0.2],
    });

    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  function handlePlay() {
    document.querySelectorAll('.performanceCommunityVideo').forEach((video) => {
      if (video !== feedVideoRef.current) video.pause();
    });
  }

  return (
    <video
      ref={feedVideoRef}
      className="performanceCommunityVideo"
      src={src}
      controls
      muted
      playsInline
      preload="metadata"
      controlsList="nodownload"
      aria-label={label}
      onPlay={handlePlay}
    />
  );
}

function App() {
  useAppViewport();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const streamRef = useRef(null);
  const communityCaptureVideoRef = useRef(null);
  const communityCaptureStreamRef = useRef(null);
  const communityCaptureRecorderRef = useRef(null);
  const communityCaptureChunksRef = useRef([]);
  const communityCaptureTimerRef = useRef(null);
  const peerRefs = useRef([]);
  const captionChannelRef = useRef(null);
  const handsRef = useRef(null);
  const animationFrameRef = useRef(null);
  const cameraLoopTimerRef = useRef(null);
  const lastSentAt = useRef(0);
  const lastSpoken = useRef('');
  const lastRemoteSpoken = useRef('');
  const lastSentenceBuildAt = useRef(0);
  const predictionInFlightRef = useRef(false);
  const temporalFramesRef = useRef([]);
  const sentenceRef = useRef([]);
  const voiceEnabledRef = useRef(true);
  const synapseEnabledRef = useRef(true);
  const confidenceThresholdRef = useRef(MIN_ACCEPT_CONFIDENCE);
  const frameSettingsRef = useRef({ frameSkipping: true, frameRate: 30, performanceMode: 'balanced' });
  const runtimeSettingsRef = useRef({ translationMode: 'sentence', storeHistory: true });
  const signsByLabelRef = useRef({});
  const stablePredictionRef = useRef({ label: '', count: 0, acceptedAt: 0 });
  const handPresenceRef = useRef(null);
  const chatKeyRef = useRef(null);
  const chatCallDragRef = useRef(null);
  const callControlsTimerRef = useRef(null);
  const cameraControlClickTimerRef = useRef(null);
  const startCameraRef = useRef(null);
  const chatLongPressRef = useRef(null);
  const railLogoClickTimerRef = useRef(null);
  const railTributeTimerRef = useRef(null);
  const communityRailTapTimerRef = useRef(null);
  const communityFeedTabsRef = useRef(null);
  const signToolsPaneRef = useRef(null);
  const fullIntroTimerRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const sendLongPressRef = useRef(null);
  const sendLongPressTriggeredRef = useRef(false);
  const voiceRecorderRef = useRef(null);
  const voiceRecorderChunksRef = useRef([]);
  const voiceRecorderStreamRef = useRef(null);
  const pageFlipAudioContextRef = useRef(null);
  const profileQrScanInputRef = useRef(null);
  const desktopCallWindowStartedRef = useRef(false);
  const chatCallScreenRef = useRef(null);
  const rtmwSessionIdRef = useRef('');
  const rtmwLastSentAtRef = useRef(0);
  const rtmwInFlightRef = useRef(false);
  const rtmwIntervalRef = useRef(1000);
  const rtmwSnapshotCanvasRef = useRef(null);
  const mediaPipeCropCanvasRef = useRef(null);
  const activeSignerRoiRef = useRef(null);
  const currentMediaPipeRoiRef = useRef(null);
  const rtmwActivePersonIdRef = useRef('');

  const [authStage, setAuthStage] = useState(() => {
    if (process.env.NODE_ENV === 'test') return 'app';
    return 'checking';
  });
  const [authForm, setAuthForm] = useState({ name: '', username: '', phone: '', email: '', pin: '', confirmPin: '', phoneOtp: '', hidePhone: true });
  const [authMode, setAuthMode] = useState('signup');
  const [authRecoveryOpen, setAuthRecoveryOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState({ type: '', text: '' });
  const [accountSettingsMessage, setAccountSettingsMessage] = useState({ type: '', text: '' });
  const [authenticatedFirebaseUser, setAuthenticatedFirebaseUser] = useState(null);
  const [authVerificationCooldownUntil, setAuthVerificationCooldownUntil] = useState(0);
  const [authCooldownNow, setAuthCooldownNow] = useState(() => Date.now());
  const [, setAuthPhoneChallenge] = useState(null);
  const desktopCallWindowMode = getDesktopCallWindowMode();
  const [caption, setCaption] = useState('Waiting for signs');
  const [remoteCaption, setRemoteCaption] = useState('Waiting for remote caption');
  const [captionChannelStatus, setCaptionChannelStatus] = useState('Caption sync ready');
  const [status, setStatus] = useState('Starting camera');
  const [callStatus, setCallStatus] = useState('WebRTC ready');
  const [callExperience, setCallExperience] = useState('videoSignChat');
  const [callElapsedSeconds, setCallElapsedSeconds] = useState(0);
  const [chatCallScreen, setChatCallScreen] = useState(null);
  chatCallScreenRef.current = chatCallScreen;
  const [chatCallMinimized, setChatCallMinimized] = useState(false);
  const [chatCallExpanded, setChatCallExpanded] = useState(false);
  const [chatCallInfoOpen, setChatCallInfoOpen] = useState(false);
  const [chatCallMoreOpen, setChatCallMoreOpen] = useState(false);
  const [callControlsVisible, setCallControlsVisible] = useState(true);
  const [chatCallSettingsTab, setChatCallSettingsTab] = useState('general');
  const [chatCallHistoryOpen, setChatCallHistoryOpen] = useState(false);
  const [chatCallFocus, setChatCallFocus] = useState('local');
  const [chatCallPosition, setChatCallPosition] = useState({ x: 24, y: 24 });
  const [remoteMediaState, setRemoteMediaState] = useState({ camera: true, mic: true, translation: true });
  const [cameraQuality, setCameraQuality] = useState({ label: 'Camera standby', width: 0, height: 0, fps: 0 });
  const [callTranscript, setCallTranscript] = useState([]);
  const [callSignTelemetry, setCallSignTelemetry] = useState({
    attempts: 0,
    accepted: 0,
    uncertain: 0,
    unique: [],
    last: null,
  });
  const [apiRecovery, setApiRecovery] = useState({ active: false, message: '' });
  const [history, setHistory] = useState([]);
  const [sentence, setSentence] = useState('Waiting for signs');
  const [signLibrary, setSignLibrary] = useState(DEFAULT_SIGNS);
  const [signApiStatus, setSignApiStatus] = useState('Loading signs');
  const [, setEngineStatus] = useState(ENGINE_NAME);
  const [aiMetrics, setAiMetrics] = useState({ status: 'Loading metrics', models: {} });
  const [apiConnection, setApiConnection] = useState({
    status: 'checking',
    backend: 'Checking',
    ai: 'Checking',
    source: 'unknown',
    detail: 'Checking Signova services',
    models: {},
  });
  const [synapseEnabled, setSynapseEnabled] = useState(true);
  const [liveSign, setLiveSign] = useState(null);
  const [learningFeedback, setLearningFeedback] = useState('Keep your hand inside the frame.');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [activePanel, setActivePanel] = useState('community');
  const [selectedProgressMetric, setSelectedProgressMetric] = useState('Overall Progress');
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const [signSearch, setSignSearch] = useState('');
  const [openLibraryBookId, setOpenLibraryBookId] = useState('');
  const [libraryOpeningBookId, setLibraryOpeningBookId] = useState('');
  const [libraryBookView, setLibraryBookView] = useState('cover');
  const [libraryPageFlip, setLibraryPageFlip] = useState('');
  const [libraryReaderPage, setLibraryReaderPage] = useState(0);
  const [savedLearningItems, setSavedLearningItems] = useState([]);
  const [learnMissionId, setLearnMissionId] = useState(LEARN_MISSIONS[0].id);
  const [learnLoopStep, setLearnLoopStep] = useState(0);
  const [learnPracticeMode, setLearnPracticeMode] = useState('shadow');
  const [learnTrainerActive, setLearnTrainerActive] = useState(false);
  const [learnTrainerExpanded, setLearnTrainerExpanded] = useState(false);
  const [learnAttemptCount, setLearnAttemptCount] = useState(0);
  const [learnFeedbackSubmitted, setLearnFeedbackSubmitted] = useState(false);
  const [learnTextPrompt, setLearnTextPrompt] = useState(LEARN_MISSIONS[0].phrase);
  const [learnAvatarDemoKey, setLearnAvatarDemoKey] = useState(0);
  const [clearHistoryConfirmId, setClearHistoryConfirmId] = useState('');
  const [railTributeActive, setRailTributeActive] = useState(false);
  const [fullIntroActive, setFullIntroActive] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [premiumDarkMode, setPremiumDarkMode] = useState(false);
  const [activeSettingsSection, setActiveSettingsSection] = useState('');
  const [settingsSearch, setSettingsSearch] = useState('');
  const [settings, setSettings] = useState(() => {
    const defaults = {
    account: {
      name: 'Signova User',
      firstName: 'Signova',
      lastName: 'User',
      username: '@signova.user',
      email: '',
      phone: '',
      city: '',
      country: 'India',
      preferredLanguage: 'English',
      about: 'I am learning Indian Sign Language for daily communication.',
      subscription: 'Free learning plan',
      proStatus: 'trial',
      proPlan: 'Signova Pro Trial',
      proTrialMonths: 2,
      proStartedAt: '',
      proExpiresAt: '',
      studentVerified: false,
      studentIdFileName: '',
      studentInstitution: '',
      profilePhoto: '',
      phoneVerified: true,
      emailVerified: true,
      twoFactor: false,
      connectedDevices: 'Web, Android ready',
      userType: 'Sign Language Learner',
      preferredSignLanguage: 'ISL',
      signSkillLevel: 'Beginner',
      supportNotes: '',
      emergencyContact: '',
      healthNotes: '',
      avatarInitials: 'SU',
      avatarTone: 'cyan',
      avatarMode: '3d',
      avatarMood: 'calm',
      avatarAccessory: 'none',
    },
    camera: {
      facingMode: 'user',
      resolution: '1080p',
      fps: 30,
    },
    microphone: {
      inputDevice: 'default',
      noiseSuppression: true,
    },
    translation: {
      enabled: true,
      mode: 'sentence',
      language: 'English',
      outputType: 'textVoice',
      confidenceThreshold: MIN_ACCEPT_CONFIDENCE,
    },
    lighting: {
      autoLowLight: true,
      ringLight: false,
      brightness: 62,
      aiEnhancement: true,
    },
    filters: {
      enabled: true,
      backgroundBlur: false,
      contrastEnhancement: true,
      skinOptimization: true,
      beautyLevel: 28,
      preset: 'natural',
    },
    display: {
      theme: 'system',
      highContrast: false,
      largeText: false,
      subtitleSize: 'medium',
      textSize: 'medium',
      visualFeedback: true,
      vibrationAlerts: false,
      signovaLock: false,
      signovaLockFace: true,
      signovaLockFingerprint: true,
      signovaLockPin: true,
    },
    security: {
      twoFactorAuthorization: false,
      loginAlerts: true,
      trustedDevice: true,
      requirePasswordForSensitiveActions: true,
      autoLockMinutes: 15,
      hideSensitivePreviews: true,
      childSafetyMode: false,
      dpdpNoticeAccepted: false,
    },
    notifications: {
      practiceReminders: true,
      learningAlerts: true,
      achievements: true,
    },
    ai: {
      performanceMode: 'balanced',
      frameRate: 30,
      frameSkipping: true,
      model: 'mixed',
    },
    privacy: {
      saveVideoData: false,
      storeHistory: true,
      dataSharing: false,
      cameraProcessing: true,
      communityPublicProfile: true,
      showUsername: true,
      showNumber: true,
      showProfilePhoto: true,
      showDeafStatus: false,
      showLearningProgress: true,
      qrSharing: true,
      showOnlineStatus: true,
      showLastSeen: true,
      readReceipts: true,
      saveChatHistory: true,
    },
    feedback: {
      realTimeCorrection: true,
      errorHighlighting: true,
      learningSuggestions: true,
    },
    practice: {
      difficulty: 'beginner',
      reminders: true,
      dailyGoal: 15,
    },
    device: {
      dataSaver: false,
      reduceMotion: false,
      compactMode: false,
      autoMediaQuality: true,
      offlineCache: true,
    },
    };
    if (typeof window === 'undefined') return defaults;
    try {
      const saved = JSON.parse(window.localStorage.getItem(SIGNOVA_SETTINGS_STORAGE_KEY) || 'null');
      return mergeSignovaSettings(defaults, saved);
    } catch {
      return defaults;
    }
  });
  const [chatDraft, setChatDraft] = useState('');
  const [composerSending, setComposerSending] = useState(false);
  const [typingContactId, setTypingContactId] = useState('');
  const [composerPickerOpen, setComposerPickerOpen] = useState(false);
  const [composerPickerTab, setComposerPickerTab] = useState('emoji');
  const [scheduleComposerOpen, setScheduleComposerOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ date: '', time: '', note: '' });
  const [voiceNote, setVoiceNote] = useState({ active: false, paused: false, seconds: 0 });
  const [driveItems, setDriveItems] = useState([]);
  const [contacts, setContacts] = useState(INITIAL_CONTACTS);
  const [selectedChatId, setSelectedChatId] = useState(INITIAL_CONTACTS[0]?.id || null);
  const [mobileChatListOpen, setMobileChatListOpen] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth <= 760 : false
  ));
  const [chatSidebarWidth, setChatSidebarWidth] = useState(() => {
    if (typeof window === 'undefined') return CHAT_SIDEBAR_DEFAULT_WIDTH;
    const storedWidth = Number(window.localStorage.getItem('signova-chat-sidebar-width'));
    return Number.isFinite(storedWidth) ? clampChatSidebarWidth(storedWidth) : CHAT_SIDEBAR_DEFAULT_WIDTH;
  });
  const [contactForm, setContactForm] = useState(EMPTY_CONTACT_FORM);
  const [contactFormError, setContactFormError] = useState('');
  const [databaseStatus, setDatabaseStatus] = useState({ mode: 'checking', detail: 'Connecting database' });
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [passwordModal, setPasswordModal] = useState({
    open: false,
    contactId: null,
    mode: 'create',
    value: '',
    error: '',
    methods: { face: true, fingerprint: true, pin: true },
  });
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachMiniWindow, setAttachMiniWindow] = useState('');
  const [attachmentAccept, setAttachmentAccept] = useState('');
  const [imageSendMode, setImageSendMode] = useState('Simple image');
  const [cameraClipFacing, setCameraClipFacing] = useState('Front camera');
  const [audioPlaybackRates, setAudioPlaybackRates] = useState({});
  const [pollForm, setPollForm] = useState({ question: '', options: ['Yes', 'No'] });
  const [meetForm, setMeetForm] = useState({ title: '', date: '', time: '', reminder: '15 min before' });
  const [selectedShareContactId, setSelectedShareContactId] = useState(INITIAL_CONTACTS[0]?.id || '');
  const [chatSearch, setChatSearch] = useState('');
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState('');
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [reactionMessageId, setReactionMessageId] = useState('');
  const [toolMessageId, setToolMessageId] = useState('');
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState('');
  const [messageInfoId, setMessageInfoId] = useState('');
  const [messageTranslateMenu, setMessageTranslateMenu] = useState('');
  const [chatFilter, setChatFilter] = useState('all');
  const [callHistorySearch, setCallHistorySearch] = useState('');
  const [callHistoryFilter, setCallHistoryFilter] = useState('all');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [callHistory, setCallHistory] = useState([]);
  const [customChatCategories, setCustomChatCategories] = useState([]);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [categoryComposerOpen, setCategoryComposerOpen] = useState(false);
  const [chatFlags, setChatFlags] = useState({});
  const [chatMenu, setChatMenu] = useState({ visible: false, contactId: null, x: 0, y: 0 });
  const [chatHeaderMenuOpen, setChatHeaderMenuOpen] = useState(false);
  const [conversationInfoMenuOpen, setConversationInfoMenuOpen] = useState(false);
  const [conversationCategoryOpen, setConversationCategoryOpen] = useState(false);
  const [conversationCategory, setConversationCategory] = useState('all');
  const [contactInfoOpen, setContactInfoOpen] = useState(false);
  const [chatSidebarMenu, setChatSidebarMenu] = useState({ visible: false, x: 0, y: 0 });
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupForm, setGroupForm] = useState(EMPTY_GROUP_FORM);
  const [groupCreationContext, setGroupCreationContext] = useState('chat');
  const [communityGroupRecords, setCommunityGroupRecords] = useState([]);
  const [communityGroupProfileOpen, setCommunityGroupProfileOpen] = useState(false);
  const [communityDraft, setCommunityDraft] = useState('');
  const [communityComposerMedia, setCommunityComposerMedia] = useState(null);
  const [communityFeedFilter, setCommunityFeedFilter] = useState('For You');
  const [communityPostMenu, setCommunityPostMenu] = useState({ postId: '', reportOpen: false });
  const [communityGroupSearch, setCommunityGroupSearch] = useState('');
  const [communityGroupCategory, setCommunityGroupCategory] = useState('all');
  const [communityGroupCategories, setCommunityGroupCategories] = useState([]);
  const [communityGroupCategoryDraft, setCommunityGroupCategoryDraft] = useState('');
  const [communityGroupCategoryComposerOpen, setCommunityGroupCategoryComposerOpen] = useState(false);
  const [selectedCommunityGroupId, setSelectedCommunityGroupId] = useState('');
  const [communityGroupToolOpen, setCommunityGroupToolOpen] = useState('');
  const [communityGroupDraft, setCommunityGroupDraft] = useState('');
  const [communityGroupPosts, setCommunityGroupPosts] = useState([]);
  const [communityGroupEmojiOpen, setCommunityGroupEmojiOpen] = useState(false);
  const [communityGroupVoice, setCommunityGroupVoice] = useState({ active: false, seconds: 0 });
  const [communityProfile, setCommunityProfile] = useState({
    name: 'Signova Creator',
    username: '@signova.creator',
    bio: 'Public creator profile for Signova community.',
    avatarInitials: 'SC',
    avatarTone: 'cyan',
    avatarMode: '3d',
    avatarMood: 'calm',
    avatarAccessory: 'none',
    avatarImage: '/signova-auth-avatar-ai.png',
  });
  const [communityPosts, setCommunityPosts] = useState(COMMUNITY_POSTS);
  const [communityLikedPostIds, setCommunityLikedPostIds] = useState([]);
  const [communitySigns, setCommunitySigns] = useState(COMMUNITY_SIGNS);
  const [communitySignForm, setCommunitySignForm] = useState({
    title: '',
    type: 'letter',
    language: 'ISL',
    meaning: '',
    steps: '',
    buildFrom: '',
    category: 'Daily Use',
    difficulty: 'Beginner',
    videoUrl: '',
    imageUrls: [],
    selectedThumbnail: 0,
    handShape: '',
    motion: 'Moving',
    facialExpression: '',
    bodyPosition: 'Neutral',
    usageNotes: '',
    commonMistakes: '',
    exampleSentence: '',
    visibility: 'Public',
    rulesAccepted: false,
    rightsConfirmed: false,
    publishCommunity: true,
    addToLibrary: true,
    allowAiTraining: false,
    showCreatorName: true,
  });
  const [communitySignDraftSaved, setCommunitySignDraftSaved] = useState(false);
  const [communitySignPipelineStep, setCommunitySignPipelineStep] = useState(0);
  const [communitySignPipelineUnlocked, setCommunitySignPipelineUnlocked] = useState(0);
  const [communityCaptureOpen, setCommunityCaptureOpen] = useState(false);
  const [communityCaptureMode, setCommunityCaptureMode] = useState('video');
  const [communityCaptureRecording, setCommunityCaptureRecording] = useState(false);
  const [communityCaptureSeconds, setCommunityCaptureSeconds] = useState(0);
  const [communityCaptureError, setCommunityCaptureError] = useState('');
  const [communityMediaQuality, setCommunityMediaQuality] = useState({
    status: 'idle',
    title: 'No media checked',
    checks: [],
  });
  const [communityNotificationsOpen, setCommunityNotificationsOpen] = useState(false);
  const [dismissedCommunityNotificationIds, setDismissedCommunityNotificationIds] = useState([]);
  const [communityAvatarOpen, setCommunityAvatarOpen] = useState(false);
  const [communityIdentityEditing, setCommunityIdentityEditing] = useState(false);
  const [profileQrDataUrl, setProfileQrDataUrl] = useState('');
  const [profileQrOpen, setProfileQrOpen] = useState(false);
  const [profileQrManualValue, setProfileQrManualValue] = useState('');
  const [profileQrMessage, setProfileQrMessage] = useState('');
  const [avatarUndoStack, setAvatarUndoStack] = useState([]);
  const [avatarRedoStack, setAvatarRedoStack] = useState([]);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      direction: 'incoming',
      text: 'Hi, I am ready for Signova live translation.',
      time: 'Now',
      sentAt: 'Now',
      deliveredAt: 'Now',
      readAt: 'Now',
      status: 'read',
      encrypted: true,
      reactions: [],
      createdAt: Date.now(),
      liveActivity: 'Local preview message',
      seenGlow: true,
    },
  ]);
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [encryptionStatus, setEncryptionStatus] = useState('Creating local session key');
  const [, setSecureCallStatus] = useState('WebRTC DTLS-SRTP ready');
  const libraryReaderRef = useRef(null);
  const communityGroupKeysRef = useRef(new Map());
  const communityGroupRecorderRef = useRef(null);
  const communityGroupVoiceStreamRef = useRef(null);
  const libraryFlipTimeoutRef = useRef(null);
  const authVerificationCooldownSeconds = Math.max(0, Math.ceil((authVerificationCooldownUntil - authCooldownNow) / 1000));

  const latestHistory = useMemo(() => history.slice(0, 5), [history]);
  const signsByLabel = useMemo(
    () => Object.fromEntries(signLibrary.map((item) => [item.label, item])),
    [signLibrary],
  );
  const filteredSigns = useMemo(() => {
    const query = signSearch.trim().toLowerCase();
    if (!query) return signLibrary;
    return signLibrary.filter((item) => (
      String(item.sign || '').toLowerCase().includes(query)
      || String(item.label || '').toLowerCase().includes(query)
      || String(item.hint || '').toLowerCase().includes(query)
      || String(item.language || '').toLowerCase().includes(query)
    ));
  }, [signLibrary, signSearch]);
  const categorizedLibrarySigns = useMemo(() => {
    const fallbackLanguage = settings.translation.language === 'ISL Gloss' ? 'ISL' : settings.translation.language;
    return filteredSigns.reduce((books, item) => {
      const bookType = getSignBookType(item);
      const phrase = normalizeSignText(item.sign || item.label);
      const annotatedSign = {
        ...item,
        sign: phrase,
        bookType,
        language: inferSignLanguage(item, fallbackLanguage),
        usage: item.usage || buildSignUsage(item, bookType),
        purpose: item.purpose || buildSignPurpose(item, bookType),
      };
      books[bookType].push(annotatedSign);
      return books;
    }, { letters: [], words: [], sentences: [] });
  }, [filteredSigns, settings.translation.language]);
  const libraryBooks = useMemo(() => {
    const letterFallback = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => ({
      label: letter.toLowerCase(),
      sign: letter,
      language: 'English',
      usage: `Use ${letter} for fingerspelling, spelling names, initials, and building new custom words.`,
      purpose: 'Purpose: trains handshape accuracy before joining letters into names or community-created signs.',
    })).concat([
      {
        label: 'space',
        sign: 'Space',
        language: 'English',
        usage: 'Use Space to separate spelled words while fingerspelling names or custom phrases.',
        purpose: 'Purpose: keeps fingerspelled communication readable and structured.',
      },
      {
        label: 'delete',
        sign: 'Delete',
        language: 'English',
        usage: 'Use Delete when correcting a fingerspelled letter or removing a mistaken sign.',
        purpose: 'Purpose: helps learners repair spelling mistakes during live signing.',
      },
    ]);
    const wordFallback = [
      ['Hello', 'Open palm greeting used to start friendly communication.', 'Purpose: starts daily conversations and live translation politely.'],
      ['Stop', 'Open palm forward to pause, reject, or stop an action.', 'Purpose: gives a clear safety signal in daily life.'],
      ['OK', 'Circle with thumb and finger to confirm that something is fine.', 'Purpose: gives fast confirmation during chat or calls.'],
      ['Thank You', 'A simple gratitude sign for polite communication.', 'Purpose: helps complete conversations with respect.'],
      ['Call me', 'Phone-hand near face to request a call or voice chat.', 'Purpose: connects text, voice, and sign communication.'],
    ].map(([sign, usage, purpose]) => ({ label: sign.toLowerCase(), sign, language: 'English', usage, purpose }));
    const sentenceFallback = [
      ['How are you?', 'Use this sentence when greeting someone and checking how they feel.', 'Purpose: supports full conversation instead of single-word replies.'],
      ['I need help', 'Use this sentence when you need support, guidance, or urgent assistance.', 'Purpose: makes important needs clear in calls and captions.'],
      ['Are you free today?', 'Use this sentence to ask if someone has time to meet, chat, or practice.', 'Purpose: helps plan real communication with complete meaning.'],
      ['I cannot speak', 'Use this sentence when voice communication is not possible.', 'Purpose: lets the app convert intent into readable captions or voice output.'],
    ].map(([sign, usage, purpose]) => ({ label: sign.toLowerCase(), sign, language: 'ISL', usage, purpose }));
    const toPages = (items, fallback) => {
      const source = items.length ? items : fallback;
      return source.map((item, index) => ({
        ...item,
        pageNumber: index + 1,
        language: item.language || 'English',
        usage: item.usage || buildSignUsage(item, getSignBookType(item)),
        purpose: item.purpose || buildSignPurpose(item, getSignBookType(item)),
      }));
    };

    return [
      {
        id: 'letters',
        eyebrow: 'A-Z',
        title: 'Letter Signs Book',
        coverTitle: 'Letter Signs Book (A-Z)',
        subtitle: 'Alphabet signs for fingerspelling, spelling names, and creating community words.',
        note: 'Community note: go to the Community section to create, save, or share your own signs.',
        icon: 'A',
        tone: 'blue',
        pages: toPages(categorizedLibrarySigns.letters, letterFallback),
      },
      {
        id: 'words',
        eyebrow: 'Words',
        title: 'Word Level Signs Book',
        coverTitle: 'Word Level Signs Book',
        subtitle: 'Useful vocabulary signs for word mode, practice, and quick live translation.',
        note: 'Word signs are best for quick daily communication before joining ideas into complete sentences.',
        icon: '...',
        tone: 'cyan',
        pages: toPages(categorizedLibrarySigns.words, wordFallback),
      },
      {
        id: 'sentences',
        eyebrow: 'Sentences',
        title: 'Sentence Level Signs Book',
        coverTitle: 'Sentence Level Signs Book',
        subtitle: 'Full-meaning signs for sentence practice, captions, and voice output.',
        note: 'Sentence signs help Signova produce clearer live captions and complete communication.',
        icon: '""',
        tone: 'violet',
        pages: toPages(categorizedLibrarySigns.sentences, sentenceFallback),
      },
    ];
  }, [categorizedLibrarySigns]);
  const openLibraryBook = useMemo(
    () => libraryBooks.find((book) => book.id === openLibraryBookId) || null,
    [libraryBooks, openLibraryBookId],
  );
  const currentLibraryBookPage = openLibraryBook?.pages?.[libraryReaderPage] || null;
  const nextLibraryBookPage = openLibraryBook?.pages?.[Math.min(libraryReaderPage + 1, Math.max(0, (openLibraryBook?.pages?.length || 1) - 1))] || currentLibraryBookPage;
  const openLearningBook = useCallback((bookId) => {
    setLibraryOpeningBookId(bookId);
    setOpenLibraryBookId(bookId);
    setLibraryBookView('cover');
    setLibraryPageFlip('');
    setLibraryReaderPage(0);
  }, []);
  const closeLearningBook = useCallback(() => {
    setLibraryOpeningBookId('');
    setOpenLibraryBookId('');
    setLibraryBookView('cover');
    setLibraryPageFlip('');
    setLibraryReaderPage(0);
  }, []);
  const playPageFlipSound = useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const context = pageFlipAudioContextRef.current || new AudioContextClass();
    pageFlipAudioContextRef.current = context;

    const startSound = () => {
      const now = context.currentTime;
      const noiseLength = Math.floor(context.sampleRate * 0.18);
      const buffer = context.createBuffer(1, noiseLength, context.sampleRate);
      const data = buffer.getChannelData(0);

      for (let index = 0; index < noiseLength; index += 1) {
        const fade = 1 - index / noiseLength;
        data[index] = (Math.random() * 2 - 1) * fade * fade;
      }

      const noise = context.createBufferSource();
      const noiseFilter = context.createBiquadFilter();
      const noiseGain = context.createGain();
      noise.buffer = buffer;
      noiseFilter.type = 'highpass';
      noiseFilter.frequency.setValueAtTime(450, now);
      noiseGain.gain.setValueAtTime(0.0001, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.08, now + 0.025);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(context.destination);
      noise.start(now);
      noise.stop(now + 0.22);

      const click = context.createOscillator();
      const clickGain = context.createGain();
      click.type = 'triangle';
      click.frequency.setValueAtTime(360, now);
      click.frequency.exponentialRampToValueAtTime(180, now + 0.09);
      clickGain.gain.setValueAtTime(0.0001, now);
      clickGain.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      click.connect(clickGain);
      clickGain.connect(context.destination);
      click.start(now);
      click.stop(now + 0.14);
    };

    if (context.state === 'suspended') {
      context.resume().then(startSound).catch(() => {});
    } else {
      startSound();
    }
  }, []);
  const turnLibraryPage = useCallback((direction) => {
    if (!openLibraryBook || libraryPageFlip) return;
    const total = openLibraryBook.pages?.length || 1;
    const nextPage = Math.min(Math.max(libraryReaderPage + direction, 0), total - 1);
    if (nextPage === libraryReaderPage) return;
    const flipDirection = direction > 0 ? 'next' : 'previous';
    playPageFlipSound();
    setLibraryPageFlip(flipDirection);
    window.clearTimeout(libraryFlipTimeoutRef.current);
    libraryFlipTimeoutRef.current = window.setTimeout(() => {
      setLibraryReaderPage(nextPage);
      window.setTimeout(() => setLibraryPageFlip(''), 240);
    }, 620);
  }, [libraryPageFlip, libraryReaderPage, openLibraryBook, playPageFlipSound]);
  useEffect(() => {
    if (!libraryOpeningBookId) return undefined;
    const timer = window.setTimeout(() => setLibraryOpeningBookId(''), 900);
    return () => window.clearTimeout(timer);
  }, [libraryOpeningBookId]);
  useEffect(() => {
    if (!openLibraryBookId || libraryBookView !== 'reader' || !libraryReaderRef.current) return undefined;
    const timer = window.setTimeout(() => {
      libraryReaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 280);
    return () => window.clearTimeout(timer);
  }, [libraryBookView, openLibraryBookId]);
  useEffect(() => () => window.clearTimeout(libraryFlipTimeoutRef.current), []);
  useEffect(() => {
    if (activePanel === 'communityCreate') return undefined;
    if (communityCaptureTimerRef.current) window.clearInterval(communityCaptureTimerRef.current);
    communityCaptureTimerRef.current = null;
    communityCaptureStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    communityCaptureStreamRef.current = null;
    communityCaptureRecorderRef.current = null;
    setCommunityCaptureOpen(false);
    setCommunityCaptureRecording(false);
    return undefined;
  }, [activePanel]);
  useEffect(() => {
    if (!communityCaptureOpen || !communityCaptureVideoRef.current || !communityCaptureStreamRef.current) return undefined;
    const video = communityCaptureVideoRef.current;
    video.srcObject = communityCaptureStreamRef.current;
    video.play().catch(() => {
      setCommunityCaptureError('Camera opened, but preview was blocked. Tap the preview to start it.');
    });
    return () => {
      if (video.srcObject === communityCaptureStreamRef.current) video.srcObject = null;
    };
  }, [communityCaptureOpen, communityCaptureMode]);
  useEffect(() => () => {
    if (communityCaptureTimerRef.current) window.clearInterval(communityCaptureTimerRef.current);
    communityCaptureStreamRef.current?.getTracks?.().forEach((track) => track.stop());
  }, []);
  useEffect(() => {
    if (!openLibraryBookId) return undefined;
    function handleLibraryBookKey(event) {
      if (event.key === 'Escape') {
        closeLearningBook();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (libraryBookView === 'reader') turnLibraryPage(1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (libraryBookView === 'reader') turnLibraryPage(-1);
      } else if ((event.key === 'Enter' || event.key === ' ') && libraryBookView === 'cover') {
        event.preventDefault();
        setLibraryBookView('reader');
      }
    }
    window.addEventListener('keydown', handleLibraryBookKey);
    return () => window.removeEventListener('keydown', handleLibraryBookKey);
  }, [closeLearningBook, libraryBookView, openLibraryBookId, turnLibraryPage]);
  const dailyLearningSigns = useMemo(() => {
    const usage = history.reduce((counts, item) => {
      counts[item.label] = (counts[item.label] || 0) + 1;
      return counts;
    }, {});
    const recommended = Object.entries(usage)
      .sort((a, b) => b[1] - a[1])
      .map(([label, count]) => ({ ...signsByLabel[label], count }))
      .filter((item) => item.label);
    const fallback = signLibrary.slice(0, 6).map((item) => ({ ...item, count: 0 }));
    const merged = [...recommended, ...fallback.filter((item) => !recommended.some((rec) => rec.label === item.label))];
    return merged.slice(0, 6);
  }, [history, signLibrary, signsByLabel]);
  const trendingSigns = useMemo(() => {
    const usage = history.reduce((counts, item) => {
      counts[item.label] = (counts[item.label] || 0) + 1;
      return counts;
    }, {});
    savedLearningItems.forEach((item) => {
      item.labels.forEach((label) => {
        usage[label] = (usage[label] || 0) + 2;
      });
    });

    return signLibrary
      .map((item, index) => ({
        label: item.label,
        title: item.sign,
        language: inferSignLanguage(item, settings.translation.language === 'ISL Gloss' ? 'ISL' : settings.translation.language),
        uses: usage[item.label] || 0,
        createdBy: savedLearningItems.some((saved) => saved.labels.includes(item.label)) ? communityProfile.name : 'Signova Library',
      }))
      .filter((item) => item.uses > 0 || savedLearningItems.some((saved) => saved.labels.includes(item.label)))
      .sort((a, b) => b.uses - a.uses)
      .slice(0, 3);
  }, [communityProfile.name, history, savedLearningItems, settings.translation.language, signLibrary]);
  const topContributors = useMemo(() => {
    const currentUserCreated = savedLearningItems.length;
    const currentUserUsage = history.length + savedLearningItems.length + driveItems.length;
    const currentUser = {
      name: communityProfile.name || 'Signova Creator',
      label: settings.practice.difficulty === 'advanced' ? 'Advanced' : settings.practice.difficulty === 'intermediate' ? 'Intermediate' : 'Beginner',
      subscription: settings.account.subscription,
      appUseHours: currentUserUsage,
      signsCreated: currentUserCreated,
      avatar: (communityProfile.avatarInitials || communityProfile.name || 'SC').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
    };

    return [currentUser, ...COMMUNITY_CONTRIBUTORS]
      .sort((a, b) => (b.appUseHours * 2 + b.signsCreated * 5) - (a.appUseHours * 2 + a.signsCreated * 5))
      .slice(0, 3)
      .map((item, index) => ({ ...item, rank: index + 1 }));
  }, [communityProfile.avatarInitials, communityProfile.name, driveItems.length, history.length, savedLearningItems.length, settings.account.subscription, settings.practice.difficulty]);
  const visibleCommunityPosts = useMemo(() => {
    return communityFeedFilter === 'For You'
      ? communityPosts
      : communityFeedFilter === 'Following'
        ? communityPosts.filter((post) => post.following)
        : communityPosts.filter((post) => post.tags.some((tag) => tag.toLowerCase() === communityFeedFilter.toLowerCase()));
  }, [communityFeedFilter, communityPosts]);
  const communityGroups = useMemo(() => {
    const fallbackGroups = COMMUNITY_GROUPS.map((group, index) => ({
      id: `template-group-${index}`,
      ...group,
      memberCount: Number(String(group.members || '').replace(/\D/g, '')) || 0,
      language: 'ISL + English',
      level: 'Beginner friendly',
      focus: 'Daily signs and feedback',
      allowMeetings: true,
      enableAudiencePolls: true,
      enableMediaDrive: true,
      adminApproval: false,
    }));
    return [...communityGroupRecords, ...fallbackGroups];
  }, [communityGroupRecords]);
  const communityGroupCategoryOptions = useMemo(() => (
    [...new Set([
      ...communityGroups.map((group) => String(group.category || '').trim()).filter(Boolean),
      ...communityGroupCategories,
    ])]
  ), [communityGroupCategories, communityGroups]);
  const visibleCommunityGroups = useMemo(() => {
    const query = communityGroupSearch.trim().toLowerCase();
    return communityGroups.filter((group) => {
      if (group.blocked) return false;
      if (communityGroupCategory === 'archived' && !group.archived) return false;
      if (communityGroupCategory !== 'archived' && group.archived) return false;
      if (communityGroupCategory === 'joined' && group.id.startsWith('template-group-')) return false;
      if (communityGroupCategory === 'live' && Number(group.online || 0) < 1) return false;
      if (communityGroupCategory.startsWith('category:') && String(group.category || '').toLowerCase() !== communityGroupCategory.slice(9)) return false;
      if (!query) return true;
      return [
        group.name,
        group.username,
        group.latest,
        group.category,
        group.focus,
        group.language,
      ].join(' ').toLowerCase().includes(query);
    });
  }, [communityGroupCategory, communityGroupSearch, communityGroups]);
  const selectedCommunityGroup = useMemo(() => (
    visibleCommunityGroups.find((group) => group.id === selectedCommunityGroupId)
    || visibleCommunityGroups[0]
    || null
  ), [selectedCommunityGroupId, visibleCommunityGroups]);
  const appProgressStats = useMemo(() => {
    const detectedSigns = history.length;
    const savedItems = savedLearningItems.length;
    const storedFiles = driveItems.length;
    const createdSigns = communitySigns.length;
    const completedActions = detectedSigns + savedItems + storedFiles + createdSigns;
    const dailyGoal = Math.max(1, Number(settings.practice.dailyGoal) || 1);
    const goalProgress = Math.min(100, Math.round((completedActions / dailyGoal) * 100));
    const avgConfidence = history.length
      ? history.reduce((total, item) => total + Number(item.confidence || 0), 0) / history.length
      : (liveSign?.confidence || 0);
    const uniqueDetected = new Set(history.map((item) => item.label)).size;
    const libraryProgress = signLibrary.length ? Math.round((uniqueDetected / signLibrary.length) * 100) : 0;
    const practiceMinutes = Math.round(detectedSigns * 0.5 + savedItems * 1 + storedFiles * 2 + createdSigns * 2);
    return {
      avgConfidence,
      completedActions,
      createdSigns,
      dailyGoal,
      detectedSigns,
      goalProgress,
      libraryProgress,
      practiceMinutes,
      savedItems,
      storedFiles,
      uniqueDetected,
    };
  }, [communitySigns.length, driveItems.length, history, liveSign, savedLearningItems.length, settings.practice.dailyGoal, signLibrary.length]);
  const progressSkillMetrics = useMemo(() => ([
    ['Library', appProgressStats.libraryProgress, 'blue'],
    ['Detected', Math.min(100, appProgressStats.detectedSigns * 10), 'green'],
    ['Saved', Math.min(100, appProgressStats.savedItems * 10), 'purple'],
    ['Uploads', Math.min(100, appProgressStats.storedFiles * 20), 'orange'],
    ['Sentences', Math.min(100, savedLearningItems.filter((item) => item.type === 'sentence').length * 20), 'red'],
    ['Community', Math.min(100, appProgressStats.createdSigns * 15), 'cyan'],
  ]), [appProgressStats, savedLearningItems]);
  const progressRadarPoints = useMemo(
    () => radarPolygonPoints(progressSkillMetrics.map(([, value]) => value)),
    [progressSkillMetrics],
  );
  const progressAchievements = useMemo(() => ([
    ['🌱', appProgressStats.detectedSigns ? 'First Detection' : 'No Detection', appProgressStats.detectedSigns ? 'green' : 'locked'],
    ['🔥', appProgressStats.completedActions ? 'Session Started' : 'No Session', appProgressStats.completedActions ? 'orange' : 'locked'],
    ['⚡', appProgressStats.savedItems ? 'Saved Sign' : 'No Saved Sign', appProgressStats.savedItems ? 'blue' : 'locked'],
    ['✦', appProgressStats.storedFiles ? 'Content Stored' : 'No Uploads', appProgressStats.storedFiles ? 'purple' : 'locked'],
    ['🎯', appProgressStats.avgConfidence ? 'AI Confidence' : 'No Accuracy', appProgressStats.avgConfidence ? 'pink' : 'locked'],
    ['🔒', appProgressStats.createdSigns ? 'Creator' : 'No Created Sign', appProgressStats.createdSigns ? 'green' : 'locked'],
  ]), [appProgressStats]);
  const activeLearnMission = useMemo(
    () => LEARN_MISSIONS.find((mission) => mission.id === learnMissionId) || LEARN_MISSIONS[0],
    [learnMissionId],
  );
  const learnAttemptNeedsReview = Boolean(liveSign && (
    liveSign.isUncertain
    || Number(liveSign.confidence || 0) < settings.translation.confidenceThreshold
    || Number(liveSign.stability || 0) < 0.55
  ));
  const unseenChatCount = useMemo(() => (
    contacts.reduce((total, contact) => total + (chatFlags[contact.id]?.unread ? 1 : 0), 0)
  ), [chatFlags, contacts]);
  const visibleContacts = useMemo(() => {
    const query = chatSearch.trim().toLowerCase();
    const filtered = contacts.filter((contact, index) => {
      const flags = chatFlags[contact.id] || {};
      const matchesCategory = (() => {
        if (flags.hidden && chatFilter !== 'hidden') return false;
        if (chatFilter === 'unread') return index === 0 || flags.unread;
        if (chatFilter === 'favourites') return flags.favourite || contact.id === 'signova-ai';
        if (chatFilter === 'groups') return flags.group;
        if (chatFilter === 'archived') return flags.archived;
        if (chatFilter === 'hidden') return flags.hidden;
        if (chatFilter.startsWith('custom:')) return flags.category === chatFilter.slice(7);
        return !flags.archived;
      })();
      if (!matchesCategory) return false;
      if (!query) return true;
      return contact.name.toLowerCase().includes(query)
        || contact.username.toLowerCase().includes(query)
        || contact.number.toLowerCase().includes(query);
    });

    return filtered.sort((a, b) => Number(Boolean(chatFlags[b.id]?.pinned)) - Number(Boolean(chatFlags[a.id]?.pinned)));
  }, [chatFilter, chatFlags, chatSearch, contacts]);
  const selectedChatContact = useMemo(() => (
    contacts.find((contact) => contact.id === selectedChatId) || null
  ), [contacts, selectedChatId]);
  const selectedChatFlags = useMemo(() => (
    selectedChatId ? (chatFlags[selectedChatId] || {}) : {}
  ), [chatFlags, selectedChatId]);
  const menuChatFlags = useMemo(() => (
    chatMenu.contactId ? (chatFlags[chatMenu.contactId] || {}) : {}
  ), [chatFlags, chatMenu.contactId]);
  const sidebarMenuContactId = selectedChatId || visibleContacts[0]?.id || contacts[0]?.id || null;
  const sidebarMenuFlags = useMemo(() => (
    sidebarMenuContactId ? (chatFlags[sidebarMenuContactId] || {}) : {}
  ), [chatFlags, sidebarMenuContactId]);
  const activeCallLog = useMemo(() => (
    callHistory.find((item) => item.status === 'active') || null
  ), [callHistory]);
  const selectedChatPresence = useMemo(() => {
    if (!selectedChatContact) return null;
    const isActive = activeCallLog?.contactId === selectedChatContact.id;
    const online = selectedChatContact.id === 'signova-ai' || isActive;
    return {
      status: online ? 'Online' : 'Offline',
      detail: online ? 'Active now · Using Web' : 'Last seen today at 09:42',
      device: online ? 'Web + Android ready' : 'Offline mode',
      tone: online ? 'online' : 'offline',
    };
  }, [activeCallLog, selectedChatContact]);
  const selectedHeaderActivity = useMemo(() => {
    if (!selectedChatPresence) return [];
    if (!settings.privacy.showOnlineStatus) return ['Status hidden'];
    const isTyping = Boolean(selectedChatContact?.id && typingContactId === selectedChatContact.id);
    if (isTyping) return ['Typing...'];
    if (selectedChatPresence.tone === 'online') {
      return [
        settings.privacy.showLastSeen ? selectedChatPresence.detail : selectedChatPresence.status,
        activeCallLog ? 'In live call' : 'Available now',
        selectedChatPresence.device,
      ];
    }
    return [
      settings.privacy.showLastSeen ? selectedChatPresence.detail : selectedChatPresence.status,
      'Messages delivered quietly',
      'Offline mode',
    ];
  }, [activeCallLog, selectedChatContact, selectedChatPresence, settings.privacy.showLastSeen, settings.privacy.showOnlineStatus, typingContactId]);
  const incomingMessageCount = useMemo(() => (
    messages.filter((message) => message.direction === 'incoming' && !message.deleted).length
  ), [messages]);
  const visibleChatMessages = useMemo(() => {
    const query = messageSearch.trim().toLowerCase();
    if (!query) return messages;
    return messages.filter((message) => (
      String(message.text || '').toLowerCase().includes(query)
      || String(message.status || '').toLowerCase().includes(query)
      || String(message.time || '').toLowerCase().includes(query)
    ));
  }, [messageSearch, messages]);
  const conversationHistoryContacts = useMemo(() => {
    const query = callHistorySearch.trim().toLowerCase();
    return contacts
      .map((contact) => {
        const logs = callHistory.filter((item) => item.contactId === contact.id);
        const lastCall = logs[0] || null;
        const status = activeCallLog?.contactId === contact.id ? 'online' : 'offline';
        return { ...contact, calls: logs, lastCall, status };
      })
      .filter((contact) => {
        if (callHistoryFilter === 'active' && contact.status !== 'online') return false;
        if (callHistoryFilter === 'completed' && !contact.calls.some((item) => item.status === 'completed')) return false;
        if (callHistoryFilter === 'no-history' && contact.calls.length) return false;
        if (!query) return true;
        return contact.name.toLowerCase().includes(query)
          || contact.username.toLowerCase().includes(query)
          || contact.number.toLowerCase().includes(query);
      });
  }, [activeCallLog, callHistory, callHistoryFilter, callHistorySearch, contacts]);
  const selectedConversation = useMemo(() => (
    conversationHistoryContacts.find((contact) => contact.id === selectedConversationId)
    || contacts.find((contact) => contact.id === selectedConversationId)
    || null
  ), [contacts, conversationHistoryContacts, selectedConversationId]);
  const selectedConversationCalls = useMemo(() => (
    callHistory.filter((item) => item.contactId === selectedConversationId)
  ), [callHistory, selectedConversationId]);
  const visibleConversationCalls = useMemo(() => (
    selectedConversationCalls.filter((item) => {
      if (conversationCategory === 'all') return true;
      return getCallHistoryPresentation(item.type).tone === conversationCategory;
    })
  ), [conversationCategory, selectedConversationCalls]);
  const communityNotifications = useMemo(() => {
    const items = [];
    if (unseenChatCount) {
      items.push({ id: 'unseen-chats', icon: '✉', title: `${unseenChatCount} unseen chat${unseenChatCount > 1 ? 's' : ''}`, detail: 'Open chats to review unread messages.', tone: 'blue' });
    }
    if (communityPosts.length) {
      items.push({ id: 'community-posts', icon: 'P', title: `${communityPosts.length} community post${communityPosts.length > 1 ? 's' : ''}`, detail: 'New real posts created in this session.', tone: 'purple' });
    }
    if (communitySigns.length) {
      items.push({ id: 'community-signs', icon: 'S', title: `${communitySigns.length} created sign${communitySigns.length > 1 ? 's' : ''}`, detail: 'Community sign drafts available for review.', tone: 'cyan' });
    }
    if (activeCallLog) {
      items.push({ id: 'active-call', icon: 'C', title: 'Active conversation running', detail: activeCallLog.startedLabel, tone: 'green' });
    }
    if (liveSign) {
      items.push({ id: 'live-sign', icon: 'AI', title: `Detected ${liveSign.phrase || liveSign.label}`, detail: `Confidence ${formatConfidence(liveSign.confidence)}`, tone: 'cyan' });
    }
    return items.filter((item) => !dismissedCommunityNotificationIds.includes(item.id));
  }, [activeCallLog, communityPosts.length, communitySigns.length, dismissedCommunityNotificationIds, liveSign, unseenChatCount]);
  const accountAvatarInitials = useMemo(() => (
    (settings.account.avatarInitials || settings.account.name || 'You')
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  ), [settings.account.avatarInitials, settings.account.name]);
  const communityAvatarInitials = useMemo(() => (
    (communityProfile.avatarInitials || communityProfile.name || 'SC')
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  ), [communityProfile.avatarInitials, communityProfile.name]);
  const profileShareHandle = useMemo(() => (
    String(settings.account.username || '@signova.user').replace(/^@+/, '').trim() || 'signova.user'
  ), [settings.account.username]);
  const profileShareUrl = useMemo(() => {
    const origin = typeof window === 'undefined' ? 'https://signova-6e929.web.app' : window.location.origin;
    return `${origin}/#/profile/${encodeURIComponent(profileShareHandle)}`;
  }, [profileShareHandle]);
  const profileQrPayload = useMemo(() => JSON.stringify({
    type: 'signova.profile',
    version: 1,
    name: settings.account.name,
    username: settings.account.username,
    preferredSignLanguage: settings.account.preferredSignLanguage,
    url: profileShareUrl,
  }), [profileShareUrl, settings.account.name, settings.account.preferredSignLanguage, settings.account.username]);
  const profileCompletion = useMemo(() => {
    const fields = [
      settings.account.profilePhoto,
      settings.account.firstName,
      settings.account.lastName,
      settings.account.username,
      settings.account.email,
      settings.account.phone,
      settings.account.city,
      settings.account.country,
      settings.account.about,
      settings.account.userType,
      settings.account.preferredSignLanguage,
      settings.account.signSkillLevel,
    ];
    const complete = fields.filter((value) => String(value || '').trim()).length;
    return Math.round((complete / fields.length) * 100);
  }, [settings.account.about, settings.account.city, settings.account.country, settings.account.email, settings.account.firstName, settings.account.lastName, settings.account.phone, settings.account.preferredSignLanguage, settings.account.profilePhoto, settings.account.signSkillLevel, settings.account.userType, settings.account.username]);
  const profileStats = useMemo(() => {
    const completed = savedLearningItems.length + Math.max(8, history.length);
    const streak = Math.max(3, Math.min(30, Math.ceil((history.length + savedLearningItems.length) / 2)));
    const accuracy = liveSign?.confidence ? Math.round(liveSign.confidence * 100) : 82;
    const favoriteSigns = signLibrary.slice(0, 4).map((sign) => sign.sign || sign.label);
    const weakSigns = signLibrary.slice(-3).map((sign) => sign.sign || sign.label);
    return { completed, streak, accuracy, favoriteSigns, weakSigns };
  }, [history.length, liveSign, savedLearningItems.length, signLibrary]);
  const isSignovaProActive = ['trial', 'active', 'student'].includes(settings.account.proStatus);
  const signovaProEndsAt = useMemo(() => {
    if (settings.account.proExpiresAt) return settings.account.proExpiresAt;
    const trialEnd = new Date();
    trialEnd.setMonth(trialEnd.getMonth() + Number(settings.account.proTrialMonths || 2));
    return trialEnd.toISOString();
  }, [settings.account.proExpiresAt, settings.account.proTrialMonths]);
  const signovaProDaysLeft = useMemo(() => {
    const diff = new Date(signovaProEndsAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  }, [signovaProEndsAt]);
  const signovaProBadgeLabel = settings.account.studentVerified ? 'Student Pro' : settings.account.proStatus === 'active' ? 'Signova Pro' : '2 months free Pro';
  const activeModelMetrics = useMemo(() => {
    const models = aiMetrics.models || {};
    return models[settings.ai.model] || models.mixed || {};
  }, [aiMetrics.models, settings.ai.model]);
  const callConfidencePercent = Math.round((liveSign?.confidence || 0) * 100);
  const selectedModeBook = ['alphabet', 'letter', 'spell', 'spelling'].includes(settings.translation.mode)
    ? 'Letter Signs Book'
    : settings.translation.mode === 'sentence'
      ? 'Sentence Level Signs Book'
      : 'Word Level Signs Book';
  const callVocabularySize = Number(liveSign?.vocabularySize || activeModelMetrics.classes || 0);
  const currentSignNumber = Number(liveSign?.signNumber || 0);
  const currentSignModel = liveSign?.activeModel || liveSign?.source || liveSign?.fallbackFrom || settings.ai.model || 'Waiting';
  const activeCallLanguage = liveSign?.activeLanguage || ({ asl: 'ASL', asl_top300: 'ASL', asl_top500: 'ASL', isl: 'ISL', mixed: 'Mixed signs', basic: 'Quick gestures' }[settings.ai.model] || settings.translation.language);
  const activeCallBook = liveSign?.activeBook || selectedModeBook;
  const vocabularyContext = liveSign?.vocabularyContext || `${activeCallLanguage} · ${currentSignModel}`;
  const currentSignReference = currentSignNumber
    ? `Sign #${currentSignNumber} of ${callVocabularySize}`
    : liveSign?.label
      ? `Quick gesture · ${vocabularyContext}`
      : '';
  const callVideoFilterStyle = {
    '--call-video-brightness': `${Math.max(65, settings.lighting.brightness + (settings.lighting.ringLight ? 18 : 0))}%`,
    '--call-video-contrast': settings.filters.enabled && settings.filters.contrastEnhancement ? '108%' : '100%',
    '--call-video-saturation': settings.filters.enabled
      ? `${({ natural: 104, clear: 112, warm: 108, cool: 96 }[settings.filters.preset] || 104) + Math.round((settings.filters.beautyLevel || 0) * 0.08)}%`
      : '100%',
    '--call-video-hue': settings.filters.enabled ? ({ natural: '0deg', clear: '0deg', warm: '-5deg', cool: '7deg' }[settings.filters.preset] || '0deg') : '0deg',
    '--call-video-softness': settings.filters.enabled && settings.filters.skinOptimization
      ? `${Math.min(0.55, Number(settings.filters.beautyLevel || 0) / 180)}px`
      : '0px',
  };
  const callQualityState = useMemo(() => {
    if (!cameraEnabled) {
      return {
        tone: 'standby',
        title: 'Camera standby',
        detail: 'Start camera to begin live translation.',
      };
    }
    if (!synapseEnabled) {
      return {
        tone: 'warning',
        title: 'Synapse paused',
        detail: 'Turn Synapse on to detect signs.',
      };
    }
    if (!liveSign) {
      return {
        tone: 'listening',
        title: 'Listening...',
        detail: 'Keep your hand inside the frame.',
      };
    }
    if (liveSign.isStable) {
      return {
        tone: 'stable',
        title: `Detected: ${liveSign.phrase}`,
        detail: voiceEnabled && settings.translation.outputType !== 'text' ? 'Text and voice ready.' : 'Text caption ready.',
      };
    }
    if (liveSign.isUncertain) {
      return {
        tone: 'warning',
        title: 'Hold steady',
        detail: 'Candidate is visible. Waiting for stable frames before sending.',
      };
    }
    return {
      tone: 'listening',
      title: `Possible: ${liveSign.phrase}`,
      detail: 'Repeat once smoothly to lock the translation.',
    };
  }, [cameraEnabled, liveSign, settings.translation.outputType, synapseEnabled, voiceEnabled]);
  const detectedDeviceProfile = useMemo(() => {
    if (typeof window === 'undefined') {
      return {
        deviceType: 'Web device',
        network: 'Unknown',
        performance: 'Standard',
        motion: 'Default',
      };
    }
    const nav = window.navigator || {};
    const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || '') || window.innerWidth <= 760;
    const cores = nav.hardwareConcurrency || 0;
    const memory = nav.deviceMemory || 0;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    return {
      deviceType: isMobileDevice ? 'Phone layout' : 'Desktop layout',
      network: nav.onLine ? 'Online' : 'Offline',
      performance: cores >= 8 || memory >= 8 ? 'High performance' : cores >= 4 || memory >= 4 ? 'Balanced' : 'Battery friendly',
      motion: reducedMotion ? 'Reduced motion preferred' : 'Motion allowed',
    };
  }, []);
  const settingsSections = useMemo(() => [
    { id: 'account', icon: '○', title: 'Profile', detail: 'Name, photo, account identity' },
    { id: 'security', icon: '⌾', title: 'Security', detail: settings.security?.twoFactorAuthorization || settings.account.twoFactor ? '2FA and app lock on' : '2FA, app lock, login safety' },
    { id: 'privacy', icon: '⌕', title: 'Privacy', detail: settings.privacy.storeHistory ? 'History and visibility controls' : 'History off' },
    { id: 'display', icon: '◐', title: 'Appearance', detail: settings.display.theme === 'dark' ? 'Dark mode' : settings.display.theme === 'light' ? 'Light mode' : 'System theme' },
    { id: 'camera', icon: '▣', title: 'Video & Voice', detail: cameraEnabled ? `${settings.camera.resolution} · Camera on` : 'Camera, microphone, quality' },
    { id: 'translation', icon: '◇', title: 'Sign Language', detail: `${settings.translation.language} · ${settings.translation.mode} mode` },
    { id: 'practice', icon: '✓', title: 'Learning', detail: `${settings.practice.dailyGoal} min daily goal` },
    { id: 'notifications', icon: '⌁', title: 'Notifications', detail: settings.notifications.practiceReminders ? 'Practice reminders on' : 'Reminders off' },
    { id: 'device', icon: '▤', title: 'Device & Performance', detail: `${detectedDeviceProfile.deviceType} · ${detectedDeviceProfile.performance}` },
    { id: 'about', icon: 'i', title: 'About', detail: 'Copyright, developer, version health' },
  ], [cameraEnabled, detectedDeviceProfile, settings]);
  const activeSettingsMeta = useMemo(
    () => settingsSections.find((item) => item.id === activeSettingsSection),
    [activeSettingsSection, settingsSections],
  );
  const filteredSettingsSections = useMemo(() => {
    const query = settingsSearch.trim().toLowerCase();
    if (!query) return settingsSections;
    return settingsSections.filter((section) => (
      section.title.toLowerCase().includes(query)
      || section.detail.toLowerCase().includes(query)
      || section.id.toLowerCase().includes(query)
    ));
  }, [settingsSearch, settingsSections]);
  useEffect(() => () => {
    window.clearTimeout(callControlsTimerRef.current);
    window.clearTimeout(cameraControlClickTimerRef.current);
  }, []);

  useEffect(() => {
    if (chatCallMoreOpen) {
      window.clearTimeout(callControlsTimerRef.current);
      setCallControlsVisible(true);
    }
  }, [chatCallMoreOpen]);

  useEffect(() => {
    if (authStage !== 'opening') return undefined;
    stopCamera();
    setChatCallScreen(null);
    setChatCallMinimized(false);
    setChatCallExpanded(false);
    setChatCallInfoOpen(false);
    const timer = window.setTimeout(() => setAuthStage('app'), 3150);
    return () => window.clearTimeout(timer);
  }, [authStage]);

  useEffect(() => {
    voiceEnabledRef.current = voiceEnabled;
  }, [voiceEnabled]);

  useEffect(() => {
    const isMediaPipeAssetError = (event) => {
      const message = String(event?.message || event?.reason?.message || event?.error?.message || event?.reason || '');
      return message.includes('hands_solution_packed_assets') || message.includes('@mediapipe/hands');
    };

    const handleMediaPipeError = (event) => {
      if (!isMediaPipeAssetError(event)) return;
      event.preventDefault?.();
      setStatus('Hand tracking assets are retrying safely');
    };

    window.addEventListener('error', handleMediaPipeError);
    window.addEventListener('unhandledrejection', handleMediaPipeError);
    return () => {
      window.removeEventListener('error', handleMediaPipeError);
      window.removeEventListener('unhandledrejection', handleMediaPipeError);
    };
  }, []);

  useEffect(() => {
    synapseEnabledRef.current = synapseEnabled;
  }, [synapseEnabled]);

  useEffect(() => {
    function handleMobileShellResize() {
      if (window.innerWidth > 760) {
        setMobileChatListOpen(false);
        return;
      }
      if (activePanel === 'chats' || activePanel === 'translate') {
        setMobileChatListOpen(true);
      }
    }

    handleMobileShellResize();
    window.addEventListener('resize', handleMobileShellResize);
    return () => window.removeEventListener('resize', handleMobileShellResize);
  }, [activePanel]);

  useEffect(() => {
    if (activePanel !== 'community') return;
    const tabs = communityFeedTabsRef.current;
    if (!tabs) return;
    tabs.scrollTo?.({ left: 0, behavior: 'auto' });
    if (typeof tabs.scrollTo !== 'function') tabs.scrollLeft = 0;
  }, [activePanel]);

  useEffect(() => {
    window.localStorage.setItem('signova-chat-sidebar-width', String(chatSidebarWidth));
  }, [chatSidebarWidth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth <= 760 && (activePanel === 'chats' || activePanel === 'translate')) {
      setMobileChatListOpen(true);
      return;
    }
    if (activePanel !== 'chats' && activePanel !== 'translate') {
      setMobileChatListOpen(false);
    }
  }, [activePanel]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') return undefined;
    if (!firebaseAuth) {
      setAuthStage('auth');
      return undefined;
    }
    let cancelled = false;
    let unsubscribe = () => {};

    async function startFirebaseAuthWatcher() {
      try {
        await setPersistence(firebaseAuth, browserLocalPersistence);
      } catch {
        // Firebase still falls back to its default persistence. We keep the
        // app usable and let the auth listener decide the visible screen.
      }
      if (cancelled) return;

      unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
        if (cancelled) return;
        setAuthenticatedFirebaseUser(user || null);
        if (!user) {
          setPersistenceReady(false);
          setAuthStage('auth');
          return;
        }

        try {
          await user.reload();
        } catch {
          // Offline/session restore should not force a logout screen.
        }
        if (cancelled) return;

        if (!user.email || !user.emailVerified) {
          setAuthStage('auth');
          setAuthMode('login');
          setAuthMessage({
            type: 'error',
            text: 'Email is not verified yet. Open the verification link from your inbox, then refresh or login again.',
          });
          return;
        }

        const fallbackProfile = {
          name: user.displayName || 'Signova User',
          username: normalizeAuthUsername(user.email?.split('@')[0] || 'signova.user'),
          email: user.email || '',
          showNumber: false,
        };
        const profile = await loadAuthProfile(user, fallbackProfile);
        if (cancelled) return;
        applyAuthenticatedProfile(profile);
        resetDatabaseSession();
        setAuthMessage({ type: '', text: '' });
        setAuthStage((stage) => (stage === 'checking' || stage === 'app' ? 'app' : 'opening'));
      });
    }

    startFirebaseAuthWatcher();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const storageKey = authenticatedFirebaseUser?.uid
      ? `signova-community-liked-posts-${authenticatedFirebaseUser.uid}`
      : 'signova-community-liked-posts-guest';
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || '[]');
      setCommunityLikedPostIds(Array.isArray(saved) ? saved.filter(Boolean) : []);
    } catch {
      setCommunityLikedPostIds([]);
    }
  }, [authenticatedFirebaseUser?.uid]);

  useEffect(() => {
    const storageKey = authenticatedFirebaseUser?.uid
      ? `signova-community-liked-posts-${authenticatedFirebaseUser.uid}`
      : 'signova-community-liked-posts-guest';
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(communityLikedPostIds));
    } catch {
      // Ignore storage failures; community likes still work for the current session.
    }
  }, [authenticatedFirebaseUser?.uid, communityLikedPostIds]);

  useEffect(() => {
    if (!firestoreDb || process.env.NODE_ENV === 'test') {
      return undefined;
    }
    const postsQuery = query(
      collection(firestoreDb, PUBLIC_COMMUNITY_POSTS_COLLECTION),
      orderBy('createdAtMillis', 'desc'),
      limit(40),
    );
    const unsubscribe = onSnapshot(
      postsQuery,
      (snapshot) => {
        const livePosts = snapshot.docs.map((postSnap) => normalizeCommunityPostFromFirestore(postSnap, communityLikedPostIds));
        const liveIds = new Set(livePosts.map((post) => post.id));
        const fallbackPosts = COMMUNITY_POSTS
          .filter((post) => !liveIds.has(post.id))
          .map((post) => ({ ...post, liked: communityLikedPostIds.includes(post.id) }));
        setCommunityPosts([...livePosts, ...fallbackPosts]);
      },
      () => {
        setCommunityPosts(COMMUNITY_POSTS.map((post) => ({ ...post, liked: communityLikedPostIds.includes(post.id) })));
      },
    );
    return unsubscribe;
  }, [authenticatedFirebaseUser?.uid, communityLikedPostIds]);

  useEffect(() => {
    if (authStage !== 'app') return undefined;
    let cancelled = false;
    setPersistenceReady(false);

    async function loadPersistedData() {
      const startedAt = Date.now();
      try {
        const session = await startDatabaseSession();
        if (cancelled) return;
        setDatabaseStatus({
          mode: session.mode,
          detail: session.mode === 'firestore' ? 'Firestore database connected' : `Local database active${session.reason ? ` - ${session.reason}` : ''}`,
        });

        const [savedContacts, savedChatState, savedCalls] = await Promise.all([
          loadUserCollection('contacts'),
          loadUserCollection('chatState'),
          loadUserCollection('callHistory'),
        ]);
        if (cancelled) return;

        if (savedContacts.length) {
          const normalizedContacts = savedContacts.map(normalizeContactRecord);
          setContacts([
            ...normalizedContacts,
            ...INITIAL_CONTACTS.filter((initial) => !normalizedContacts.some((contact) => contact.id === initial.id)),
          ]);
          setSelectedChatId((current) => current || normalizedContacts[0]?.id || INITIAL_CONTACTS[0]?.id || null);
        }

        const messageState = savedChatState.find((item) => item.id === 'messages');
        if (Array.isArray(messageState?.items) && messageState.items.length) {
          setMessages(messageState.items);
        }

        const flagState = savedChatState.find((item) => item.id === 'chatFlags');
        if (flagState?.items && typeof flagState.items === 'object') {
          setChatFlags(flagState.items);
        }

        if (savedCalls.length) {
          const restoredAt = new Date();
          setCallHistory(savedCalls.map((item) => {
            if (item.status !== 'active') return item;
            const started = Date.parse(item.startedAt);
            return {
              ...item,
              status: 'completed',
              endedAt: restoredAt.toISOString(),
              endedLabel: restoredAt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
              durationSeconds: Number.isFinite(started) ? Math.max(0, Math.round((restoredAt.getTime() - started) / 1000)) : 0,
            };
          }));
        }
      } catch (error) {
        if (!cancelled) {
          setDatabaseStatus({ mode: 'local', detail: 'Offline workspace ready with local data' });
        }
      } finally {
        const remainingSkeletonTime = Math.max(0, 420 - (Date.now() - startedAt));
        if (remainingSkeletonTime) await new Promise((resolve) => window.setTimeout(resolve, remainingSkeletonTime));
        if (!cancelled) setPersistenceReady(true);
      }
    }

    loadPersistedData();
    return () => {
      cancelled = true;
    };
  }, [authStage]);

  useEffect(() => {
    if (authStage !== 'app' || !desktopCallWindowMode || desktopCallWindowStartedRef.current) return;
    desktopCallWindowStartedRef.current = true;
    setCallExperience(desktopCallWindowMode === 'voice' ? 'voiceSignChat' : 'videoSignChat');
    setChatCallScreen(desktopCallWindowMode);
    setChatCallMinimized(false);
    updateSynapseEnabled(true);
    if (desktopCallWindowMode === 'voice') {
      setMicEnabled(true);
      setSecureCallStatus('Voice Sign Chat ready');
      setCallStatus('Voice Sign Chat ringing · encrypted voice and sign captions ready');
    } else {
      setSecureCallStatus('Video Sign Chat ready');
      setCallStatus('Video Sign Chat ringing · camera and sign language ready');
      startCameraRef.current?.();
    }
  }, [authStage, desktopCallWindowMode]);

  useEffect(() => {
    if (!persistenceReady) return;
    saveUserDoc('chatState', { id: 'messages', items: messages.slice(-120), savedAt: Date.now() }).catch(() => {});
  }, [messages, persistenceReady]);

  useEffect(() => {
    if (!persistenceReady) return;
    saveUserDoc('chatState', { id: 'chatFlags', items: chatFlags, savedAt: Date.now() }).catch(() => {});
  }, [chatFlags, persistenceReady]);

  useEffect(() => {
    if (!persistenceReady) return;
    callHistory.forEach((item) => {
      if (item?.id) saveUserDoc('callHistory', item).catch(() => {});
    });
  }, [callHistory, persistenceReady]);

  useEffect(() => {
    confidenceThresholdRef.current = settings.translation.confidenceThreshold;
    frameSettingsRef.current = {
      frameSkipping: settings.ai.frameSkipping,
      frameRate: settings.ai.frameRate,
      performanceMode: settings.ai.performanceMode,
    };
    runtimeSettingsRef.current = {
      translationMode: settings.translation.mode,
      outputLanguage: settings.translation.language,
      recognitionModel: settings.ai.model,
      storeHistory: settings.privacy.storeHistory,
    };
  }, [
    settings.ai.frameRate,
    settings.ai.frameSkipping,
    settings.ai.model,
    settings.ai.performanceMode,
    settings.privacy.storeHistory,
    settings.translation.confidenceThreshold,
    settings.translation.language,
    settings.translation.mode,
  ]);

  useEffect(() => {
    if (!synapseEnabled) {
      predictionInFlightRef.current = false;
      temporalFramesRef.current = [];
      setLiveSign(null);
      setCaption('Waiting for signs');
      setLearningFeedback('Signova AI Synapse Engine is off.');
      setStatus(cameraEnabled ? 'Camera active - Synapse off' : 'Camera off - Synapse off');
    } else {
      setStatus(cameraEnabled ? 'Camera active - Synapse on' : 'Synapse ready');
      setLearningFeedback('Keep your hand inside the frame.');
    }
  }, [synapseEnabled, cameraEnabled]);

  useEffect(() => {
    if ((activePanel === 'translate' || activePanel === 'library' || learnTrainerActive || chatCallScreen) && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [activePanel, cameraEnabled, chatCallScreen, learnTrainerActive]);

  useEffect(() => {
    signsByLabelRef.current = signsByLabel;
  }, [signsByLabel]);

  useEffect(() => {
    if (!voiceNote.active || voiceNote.paused) return undefined;
    const timer = window.setInterval(() => {
      setVoiceNote((current) => ({ ...current, seconds: current.seconds + 1 }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [voiceNote.active, voiceNote.paused]);

  useEffect(() => {
    if (!communityGroupVoice.active) return undefined;
    const timer = window.setInterval(() => {
      setCommunityGroupVoice((current) => ({ ...current, seconds: current.seconds + 1 }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [communityGroupVoice.active]);

  useEffect(() => {
    async function setupEncryption() {
      if (!window.crypto?.subtle) {
        setEncryptionStatus('Encryption unavailable in this browser');
        return;
      }

      const key = await createChatKey();
      chatKeyRef.current = key;
      setEncryptionStatus('Local session protection active');
    }

    setupEncryption();
  }, []);

  async function addEncryptedMessage(text, direction = 'outgoing', extra = {}) {
    const cleanText = text.trim();
    if (!cleanText) return;
    const sentAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const createdAt = Date.now();
    const baseStatus = direction === 'outgoing' ? 'sending' : 'receiving';
    const messageId = `${createdAt}-${Math.random().toString(36).slice(2, 7)}`;

    if (!chatKeyRef.current) {
      setMessages((items) => [
        ...items,
        {
          id: messageId,
          direction,
          text: cleanText,
          time: sentAt,
          sentAt,
          deliveredAt: direction === 'outgoing' ? '' : 'Now',
          readAt: '',
          status: direction === 'outgoing' ? 'sending' : 'read',
          encrypted: false,
          reactions: [],
          createdAt,
          liveActivity: baseStatus,
          seenGlow: false,
          ...extra,
        },
      ]);
      if (direction === 'outgoing') {
        window.setTimeout(() => {
          setMessages((items) => items.map((message) => (
            message.id === messageId && message.status !== 'deleted'
              ? { ...message, status: 'delivered', deliveredAt: sentAt, liveActivity: 'Delivered securely' }
              : message
          )));
        }, 280);
        window.setTimeout(() => {
          setMessages((items) => items.map((message) => (
            message.id === messageId && message.status !== 'deleted'
              ? { ...message, status: settings.privacy.readReceipts ? 'read' : 'delivered', readAt: settings.privacy.readReceipts ? sentAt : '', liveActivity: settings.privacy.readReceipts ? 'Seen with Signova glow' : 'Delivered securely', seenGlow: settings.privacy.readReceipts }
              : message
          )));
        }, 900);
      }
      return;
    }

    const encryptedPayload = await encryptMessage(chatKeyRef.current, cleanText);
    const decryptedText = await decryptMessage(chatKeyRef.current, encryptedPayload);
    setMessages((items) => [
      ...items,
      {
        id: messageId,
        direction,
        text: decryptedText,
        time: sentAt,
        sentAt,
        deliveredAt: direction === 'outgoing' ? '' : 'Now',
        readAt: '',
        status: direction === 'outgoing' ? 'sending' : 'read',
        encrypted: true,
        encryptedPayload,
        reactions: [],
        createdAt,
        liveActivity: baseStatus,
        seenGlow: false,
        ...extra,
      },
    ]);

    if (direction === 'outgoing') {
      window.setTimeout(() => {
        setMessages((items) => items.map((message) => (
          message.id === messageId && message.status !== 'deleted'
            ? { ...message, status: 'delivered', deliveredAt: sentAt, liveActivity: 'Delivered securely' }
            : message
        )));
      }, 280);
      window.setTimeout(() => {
        setMessages((items) => items.map((message) => (
          message.id === messageId && message.status !== 'deleted'
            ? { ...message, status: settings.privacy.readReceipts ? 'read' : 'delivered', readAt: settings.privacy.readReceipts ? sentAt : '', liveActivity: settings.privacy.readReceipts ? 'Seen with Signova glow' : 'Delivered securely', seenGlow: settings.privacy.readReceipts }
            : message
        )));
      }, 900);
    } else {
      window.setTimeout(() => {
        setMessages((items) => items.map((message) => (
          message.id === messageId && message.status !== 'deleted'
            ? { ...message, liveActivity: 'Ready for voice, sign, or language translate' }
            : message
        )));
      }, 600);
    }
  }

  function reactToMessage(messageId, reaction) {
    setMessages((items) => items.map((message) => (
      message.id === messageId
        ? { ...message, reactions: message.reactions?.includes(reaction) ? message.reactions.filter((item) => item !== reaction) : [...(message.reactions || []), reaction] }
        : message
    )));
  }

  function markMessageDeleted(messageId) {
    setMessages((items) => items.map((message) => (
      message.id === messageId
        ? { ...message, text: 'Message deleted', status: 'deleted', deleted: true }
        : message
    )));
  }

  function canModifyMessage(message) {
    if (message.direction !== 'outgoing' || message.deleted) return false;
    return Date.now() - Number(message.createdAt || 0) <= 30 * 60 * 1000;
  }

  function messageReceiptLabel(message) {
    if (message.direction !== 'outgoing') return '';
    if (message.status === 'read') return '✓✓';
    if (message.status === 'delivered') return '✓✓';
    if (message.status === 'sending') return '◌';
    return '✓';
  }

  function handleMessageClick(message) {
    if (message.deleted) return;
    setToolMessageId('');
    setReactionMessageId('');
    setEmojiPickerMessageId('');
    const phrase = message.text || '';
    const translated = liveSign?.phrase || liveSign?.label || phrase;
    const spokenText = `Translate: ${phrase}`;
    if (settings.translation.outputType !== 'textOnly') speakText(spokenText);
    setStatus(`Signova translate ready: "${translated}" to voice, sign, or regional language.`);
  }

  function speakText(text, lang = 'en-IN') {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.96;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  function closeMessageMiniWindows() {
    setReactionMessageId('');
    setToolMessageId('');
    setEmojiPickerMessageId('');
    setMessageInfoId('');
    setMessageTranslateMenu('');
  }

  function openReactionWindow(event, messageId) {
    event.preventDefault();
    setToolMessageId('');
    setMessageTranslateMenu('');
    setReactionMessageId((currentId) => (currentId === messageId ? '' : messageId));
    setEmojiPickerMessageId('');
  }

  function openToolWindow(event, messageId) {
    event.preventDefault();
    setReactionMessageId('');
    setEmojiPickerMessageId('');
    setMessageTranslateMenu('');
    setToolMessageId((currentId) => (currentId === messageId ? '' : messageId));
  }

  function reactFromWindow(messageId, reaction, keepOpen = false) {
    reactToMessage(messageId, reaction);
    setStatus(`Reacted ${reaction}`);
    if (!keepOpen) closeMessageMiniWindows();
  }

  function runMessageTool(action) {
    action();
    setToolMessageId('');
  }

  function translateEnglishToHindi(text) {
    const phrase = String(text || '').trim();
    const normalized = phrase.toLowerCase();
    const phraseMap = {
      hi: 'नमस्ते',
      hii: 'नमस्ते',
      hello: 'नमस्ते',
      hey: 'नमस्ते',
      'how are you': 'आप कैसे हैं?',
      'i am fine': 'मैं ठीक हूँ',
      thanks: 'धन्यवाद',
      'thank you': 'धन्यवाद',
      yes: 'हाँ',
      no: 'नहीं',
      help: 'मदद',
      call: 'कॉल',
      meeting: 'मीटिंग',
      sign: 'संकेत',
      'sign language': 'सांकेतिक भाषा',
      'good morning': 'सुप्रभात',
      'good night': 'शुभ रात्रि',
      sorry: 'माफ़ कीजिए',
      please: 'कृपया',
    };
    if (phraseMap[normalized]) return phraseMap[normalized];
    return phrase
      .split(/\s+/)
      .map((word) => phraseMap[word.toLowerCase().replace(/[^\w]/g, '')] || word)
      .join(' ');
  }

  function translateMessage(message, targetLanguage = 'Hindi') {
    if (!message?.text || message.deleted) return;
    const translatedText = targetLanguage === 'Hindi'
      ? translateEnglishToHindi(message.text)
      : message.text;
    const translatedAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((items) => items.map((item) => (
      item.id === message.id
        ? {
          ...item,
          translatedText,
          translatedLanguage: targetLanguage,
          translatedAt,
        }
        : item
    )));
    speakText(translatedText, targetLanguage === 'Hindi' ? 'hi-IN' : 'en-IN');
    closeMessageMiniWindows();
    setStatus(`Translated to ${targetLanguage}: ${translatedText}`);
  }

  async function copyMessage(message) {
    if (!message.text || message.deleted) return;
    try {
      await navigator.clipboard.writeText(message.text);
      setStatus('Message copied securely.');
    } catch (error) {
      setStatus('Copy unavailable in this browser.');
    }
  }

  function forwardMessage(message) {
    if (!message.text || message.deleted) return;
    setChatDraft((draft) => `${draft ? `${draft} ` : ''}Forwarded: ${message.text}`);
    setStatus('Message added to composer for forwarding.');
  }

  function toggleSelectMessage(messageId) {
    setSelectedMessageIds((ids) => (
      ids.includes(messageId) ? ids.filter((id) => id !== messageId) : [...ids, messageId]
    ));
  }

  function toggleMessageFlag(messageId, flag) {
    setMessages((items) => items.map((message) => (
      message.id === messageId ? { ...message, [flag]: !message[flag] } : message
    )));
    setStatus(flag === 'pinned' ? 'Message pin updated.' : 'Message star updated.');
  }

  function editMessage(message) {
    if (!canModifyMessage(message)) {
      setStatus('Edit window expired. Messages can be edited for 30 minutes.');
      return;
    }
    const nextText = window.prompt('Edit Signova message', message.text);
    if (!nextText || !nextText.trim()) return;
    setMessages((items) => items.map((item) => (
      item.id === message.id
        ? { ...item, text: nextText.trim(), editedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), edited: true }
        : item
    )));
  }

  function unsendMessage(message) {
    if (!canModifyMessage(message)) {
      setStatus('Unsend window expired. Messages can be unsent for 30 minutes.');
      return;
    }
    setMessages((items) => items.map((item) => (
      item.id === message.id
        ? { ...item, text: 'You unsent this message', status: 'deleted', deleted: true, unsent: true }
        : item
    )));
  }

  function retryMessage(messageId) {
    const retryAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((items) => items.map((message) => (
      message.id === messageId
        ? { ...message, status: settings.privacy.readReceipts ? 'read' : 'delivered', sentAt: retryAt, deliveredAt: retryAt, readAt: settings.privacy.readReceipts ? retryAt : '' }
        : message
    )));
  }

  async function sendDraftMessage() {
    const outgoingText = chatDraft.trim();
    if (!outgoingText) return false;
    const replyContactId = selectedChatId;
    setComposerSending(true);
    await addEncryptedMessage(outgoingText);
    setChatDraft('');
    window.setTimeout(() => setComposerSending(false), 720);
    setTypingContactId(replyContactId || '');
    window.setTimeout(() => {
      addEncryptedMessage(buildAssistantReply(outgoingText), 'incoming');
      setTypingContactId((currentId) => (currentId === replyContactId ? '' : currentId));
    }, 420);
    return true;
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    await sendDraftMessage();
  }

  function formatVoiceTime(seconds = 0) {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  async function startVoiceNote() {
    setComposerPickerOpen(false);
    setScheduleComposerOpen(false);
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      setStatus('Voice recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceRecorderChunksRef.current = [];
      voiceRecorderStreamRef.current = stream;
      voiceRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) voiceRecorderChunksRef.current.push(event.data);
      };
      recorder.start(250);
    } catch (error) {
      setStatus('Mic permission is needed to record a voice note.');
      return;
    }
    setVoiceNote({ active: true, paused: false, seconds: 0 });
    setStatus('Voice note recording started');
  }

  function toggleVoicePause() {
    setVoiceNote((current) => {
      const nextPaused = !current.paused;
      const recorder = voiceRecorderRef.current;
      if (recorder?.state === 'recording' && nextPaused) recorder.pause();
      if (recorder?.state === 'paused' && !nextPaused) recorder.resume();
      return { ...current, paused: nextPaused };
    });
  }

  function deleteVoiceNote() {
    if (voiceRecorderRef.current && voiceRecorderRef.current.state !== 'inactive') {
      voiceRecorderRef.current.onstop = null;
      voiceRecorderRef.current.stop();
    }
    voiceRecorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceRecorderRef.current = null;
    voiceRecorderChunksRef.current = [];
    voiceRecorderStreamRef.current = null;
    setVoiceNote({ active: false, paused: false, seconds: 0 });
    setStatus('Voice note deleted');
  }

  function addVoiceNote() {
    const duration = formatVoiceTime(voiceNote.seconds);
    const finishVoiceNote = () => {
      const mimeType = voiceRecorderChunksRef.current[0]?.type || 'audio/webm';
      const blob = new Blob(voiceRecorderChunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      addEncryptedMessage(`Music / Audio Note: Voice note ${duration}`, 'outgoing', {
        attachmentType: 'audio',
        attachmentData: {
          title: `Voice note ${duration}`,
          url,
          fileType: mimeType,
          size: duration,
          durationSeconds: voiceNote.seconds,
        },
      });
      voiceRecorderStreamRef.current?.getTracks().forEach((track) => track.stop());
      voiceRecorderRef.current = null;
      voiceRecorderChunksRef.current = [];
      voiceRecorderStreamRef.current = null;
      setVoiceNote({ active: false, paused: false, seconds: 0 });
      setStatus('Voice note added to chat and ready to play');
    };

    const recorder = voiceRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = finishVoiceNote;
      recorder.requestData?.();
      recorder.stop();
    } else if (voiceRecorderChunksRef.current.length) {
      finishVoiceNote();
    } else {
      setStatus('No voice audio was recorded.');
    }
  }

  function startSendLongPress() {
    sendLongPressTriggeredRef.current = false;
    window.clearTimeout(sendLongPressRef.current);
    sendLongPressRef.current = window.setTimeout(() => {
      sendLongPressTriggeredRef.current = true;
      setScheduleComposerOpen(true);
      setComposerPickerOpen(false);
      setStatus('Schedule send opened');
    }, 520);
  }

  function stopSendLongPress() {
    window.clearTimeout(sendLongPressRef.current);
  }

  async function handleSendIconClick() {
    if (sendLongPressTriggeredRef.current) {
      sendLongPressTriggeredRef.current = false;
      return;
    }
    await sendDraftMessage();
  }

  async function scheduleDraftMessage() {
    const outgoingText = chatDraft.trim();
    if (!outgoingText || !scheduleForm.date || !scheduleForm.time) {
      setStatus('Add message, date, and time before scheduling');
      return;
    }
    await addEncryptedMessage(`Scheduled: ${outgoingText}`, 'outgoing', {
      scheduledFor: `${scheduleForm.date} ${scheduleForm.time}`,
      scheduledNote: scheduleForm.note,
    });
    setChatDraft('');
    setScheduleForm({ date: '', time: '', note: '' });
    setScheduleComposerOpen(false);
    setStatus('Message scheduled');
  }

  function buildAssistantReply(text) {
    const clean = text.toLowerCase();
    if (clean.includes('sign') || clean.includes('translate')) {
      return `I can help with live sign translation. Open Translate or Call and start the camera when you are ready.`;
    }
    if (clean.includes('library') || clean.includes('learn')) {
      return `Signova Library has ${signLibrary.length} supported signs. You can search signs or type text to build matching signs.`;
    }
    if (clean.includes('call') || clean.includes('meeting')) {
      return 'Meeting mode is ready. You can turn camera and mic on or off before starting WebRTC.';
    }
    return 'I am Signova AI Assistant. I can help with signs, calls, contacts, media drive, and secure chat.';
  }

  function choosePredictionPhrase(prediction, fallbackPhrase, preferredLanguage) {
    const language = preferredLanguage || runtimeSettingsRef.current.outputLanguage || settings.translation.language || 'English';
    const translations = prediction?.translations || {};
    if (language === 'Hindi') return translations.hindi || fallbackPhrase;
    if (language === 'Hinglish') return translations.hinglish || translations.hindi || fallbackPhrase;
    if (language === 'ISL Gloss') return prediction?.gloss || translations.gloss || fallbackPhrase;
    return translations.english || fallbackPhrase;
  }

  function translateStoredSign(item, language = settings.translation.language) {
    if (!item) return 'Waiting for signs';
    if (item.translations || item.gloss) {
      return choosePredictionPhrase(item, item.phrase || item.label || 'Unknown gesture', language);
    }
    const librarySign = signsByLabelRef.current[item.label];
    return librarySign?.sign || item.phrase || item.label?.replace('_', ' ') || 'Waiting for signs';
  }

  function isLetterOnlyPrediction(prediction, label, phrase) {
    const normalizedLabel = String(label || '').trim().toLowerCase();
    const normalizedPhrase = String(phrase || '').trim().toLowerCase();
    const stage = String(prediction?.stage || prediction?.type || prediction?.mode || '').toLowerCase();
    return stage === 'letter'
      || stage === 'alphabet'
      || /^[a-z]$/.test(normalizedLabel)
      || /^[a-z]$/.test(normalizedPhrase)
      || normalizedLabel.startsWith('alphabet_')
      || normalizedLabel.startsWith('letter_');
  }

  async function buildSentenceFromLabels(labels) {
    const now = Date.now();
    if (now - lastSentenceBuildAt.current < 500) {
      setSentence(labels.map((item) => item.replace('_', ' ')).join(' '));
      return;
    }
    lastSentenceBuildAt.current = now;

    try {
      const data = await fetchJson('/api/sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels, output_language: runtimeSettingsRef.current.outputLanguage || settings.translation.language }),
      });
      setSentence(data.sentence || labels.join(' '));
    } catch {
      setSentence(labels.map((item) => item.replace('_', ' ')).join(' '));
    }
  }

  function getFreshActiveSignerRoi() {
    const roi = activeSignerRoiRef.current;
    if (!roi || Date.now() - roi.receivedAt > Math.max(2600, rtmwIntervalRef.current * 2.5)) return null;
    return roi;
  }

  function mapLandmarksFromSignerRoi(landmarks, roi) {
    if (!roi) return landmarks;
    return landmarks.map((point) => ({
      ...point,
      x: roi.x + (point.x * roi.width),
      y: roi.y + (point.y * roi.height),
    }));
  }

  function updateActiveSignerRoi(data) {
    rtmwActivePersonIdRef.current = data.active_person_id || '';
    const active = data.people?.find((person) => person.person_id === data.active_person_id);
    if (!active?.bbox || active.bbox.length !== 4) {
      if (!data.people_count) activeSignerRoiRef.current = null;
      return;
    }
    const [left, top, right, bottom] = active.bbox.map(Number);
    const width = Math.max(0.05, right - left);
    const height = Math.max(0.05, bottom - top);
    const padX = width * 0.32;
    const padY = height * 0.28;
    const x = Math.max(0, left - padX);
    const y = Math.max(0, top - padY);
    activeSignerRoiRef.current = {
      personId: data.active_person_id,
      x,
      y,
      width: Math.min(1 - x, width + (padX * 2)),
      height: Math.min(1 - y, height + (padY * 2)),
      receivedAt: Date.now(),
    };
  }

  async function sendRtmwSnapshot(video) {
    if (!chatCallScreenRef.current || rtmwInFlightRef.current || video.readyState < 2) return;
    const now = Date.now();
    if (now - rtmwLastSentAtRef.current < rtmwIntervalRef.current) return;
    rtmwLastSentAtRef.current = now;
    rtmwInFlightRef.current = true;
    try {
      const sourceWidth = video.videoWidth || 640;
      const sourceHeight = video.videoHeight || 360;
      const width = Math.min(640, sourceWidth);
      const height = Math.max(1, Math.round(width * sourceHeight / sourceWidth));
      const canvas = rtmwSnapshotCanvasRef.current || document.createElement('canvas');
      rtmwSnapshotCanvasRef.current = canvas;
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d', { alpha: false }).drawImage(video, 0, 0, width, height);
      if (!rtmwSessionIdRef.current) {
        rtmwSessionIdRef.current = `call-${window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
      }
      const data = await fetchJson('/api/wholebody/frame', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: rtmwSessionIdRef.current,
          image: canvas.toDataURL('image/jpeg', 0.55),
          include_landmarks: false,
          predict: false,
          timestamp: Date.now() / 1000,
        }),
      });
      rtmwIntervalRef.current = Math.min(1800, Math.max(450, Number(data.recommended_interval_ms || 1000)));
      updateActiveSignerRoi(data);
    } catch {
      rtmwIntervalRef.current = Math.min(2500, rtmwIntervalRef.current + 350);
    } finally {
      rtmwInFlightRef.current = false;
    }
  }

  function getMediaPipeInput(video) {
    const roi = getFreshActiveSignerRoi();
    if (!roi) {
      currentMediaPipeRoiRef.current = null;
      return video;
    }
    const sourceWidth = video.videoWidth || 640;
    const sourceHeight = video.videoHeight || 360;
    const sx = Math.round(roi.x * sourceWidth);
    const sy = Math.round(roi.y * sourceHeight);
    const sw = Math.max(1, Math.round(roi.width * sourceWidth));
    const sh = Math.max(1, Math.round(roi.height * sourceHeight));
    const canvas = mediaPipeCropCanvasRef.current || document.createElement('canvas');
    mediaPipeCropCanvasRef.current = canvas;
    canvas.width = Math.min(640, sw);
    canvas.height = Math.max(1, Math.round(canvas.width * sh / sw));
    canvas.getContext('2d', { alpha: false }).drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    currentMediaPipeRoiRef.current = roi;
    return canvas;
  }

  function recordCallSignTelemetry(prediction, label) {
    if (!chatCallScreenRef.current) return;
    const accepted = Boolean(prediction?.telemetry?.accepted) && !prediction?.is_uncertain;
    setCallSignTelemetry((current) => ({
      attempts: current.attempts + 1,
      accepted: current.accepted + Number(accepted),
      uncertain: current.uncertain + Number(!accepted),
      unique: current.unique.includes(label) ? current.unique : [...current.unique, label],
      last: {
        label,
        signNumber: Number(prediction?.sign_number || 0),
        vocabularySize: Number(prediction?.vocabulary_size || 0),
        model: prediction?.selected_model || prediction?.source || 'unknown',
        trackingSource: prediction?.tracking_source || 'local_active_signer_crop',
        accepted,
      },
    }));
  }

  async function handleHandsResults(results) {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d');
    const width = video.videoWidth || canvas.clientWidth || 640;
    const height = video.videoHeight || canvas.clientHeight || 480;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);

    const resultRoi = currentMediaPipeRoiRef.current;
    const mappedHandLandmarks = results.multiHandLandmarks?.map((landmarks) => mapLandmarksFromSignerRoi(landmarks, resultRoi)) || [];
    if (!mappedHandLandmarks.length) {
      if (handPresenceRef.current !== false) {
        handPresenceRef.current = false;
        setStatus('No hand detected');
        setCaption('Waiting for signs');
        setLiveSign(null);
        setLearningFeedback('Show your hand clearly inside the camera frame.');
      }
      temporalFramesRef.current = [];
      return;
    }
    handPresenceRef.current = true;

    mappedHandLandmarks.forEach((landmarks) => {
      if (window.drawConnectors && window.HAND_CONNECTIONS) {
        window.drawConnectors(context, landmarks, window.HAND_CONNECTIONS, { color: '#0ea5e9', lineWidth: 4 });
      }
      if (window.drawLandmarks) {
        window.drawLandmarks(context, landmarks, { color: '#14b8a6', lineWidth: 2, radius: 3 });
      }
    });

    if (!synapseEnabledRef.current) {
      setStatus('Camera active - turn on Synapse for signs');
      setLearningFeedback('Synapse Engine is off. Turn it on to translate signs.');
      return;
    }

    const now = Date.now();
    if (now - lastSentAt.current < PREDICTION_INTERVAL_MS || predictionInFlightRef.current) return;
    lastSentAt.current = now;
    predictionInFlightRef.current = true;

    const landmarks = toPointArray(mappedHandLandmarks[0]);
    temporalFramesRef.current = [
      ...temporalFramesRef.current,
      {
        landmarks,
        hands: mappedHandLandmarks.map(toPointArray),
        handedness: results.multiHandedness?.map((item) => item.label) || [],
        timestamp: now,
      },
    ].slice(-TEMPORAL_BUFFER_SIZE);

    try {
      const routingOptions = {
        mode: runtimeSettingsRef.current.translationMode,
        language: runtimeSettingsRef.current.outputLanguage || settings.translation.language,
        model: runtimeSettingsRef.current.recognitionModel === 'mixed' ? '' : runtimeSettingsRef.current.recognitionModel,
      };
      let prediction = null;
      if (chatCallScreenRef.current && rtmwSessionIdRef.current && rtmwActivePersonIdRef.current) {
        try {
          prediction = await fetchJson('/api/predict-sequence-v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: rtmwSessionIdRef.current,
              person_id: rtmwActivePersonIdRef.current,
              ...routingOptions,
            }),
          });
          prediction.tracking_source = 'rtmw_active_signer';
        } catch {
          // RTMW needs a few sampled frames before its tracked sequence is ready.
        }
      }
      if (!prediction) {
        prediction = await fetchJson('/api/predict-sequence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frames: temporalFramesRef.current,
            ...routingOptions,
          }),
        });
        prediction.tracking_source = 'local_active_signer_crop';
      }
      if (apiRecovery.active) setApiRecovery({ active: false, message: '' });

      const sequenceConfidence = Number(prediction.confidence || 0);
      const sequenceLooksWeak = String(prediction.source || prediction.selected_model || '').includes('transformer')
        && (prediction.is_uncertain || sequenceConfidence < 0.15);
      const quickFallbackAllowed = runtimeSettingsRef.current.recognitionModel === 'basic'
        || runtimeSettingsRef.current.recognitionModel === 'mixed';
      if ((sequenceLooksWeak && quickFallbackAllowed) || runtimeSettingsRef.current.recognitionModel === 'basic') {
        try {
          const quickPrediction = await fetchJson('/api/predict-landmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              landmarks,
              mode: runtimeSettingsRef.current.translationMode,
              language: runtimeSettingsRef.current.outputLanguage || settings.translation.language,
              model: 'basic',
            }),
          });
          const quickConfidence = Number(quickPrediction.confidence || 0);
          if (settings.ai.model === 'basic' || quickConfidence >= sequenceConfidence || sequenceConfidence < 0.1) {
            prediction = {
              ...quickPrediction,
              source: `${quickPrediction.source || 'landmarks'}_direct`,
              fallback_from: prediction.selected_model || prediction.source || 'sequence',
              sequence_candidate: {
                label: prediction.label,
                phrase: prediction.phrase,
                confidence: sequenceConfidence,
                source: prediction.source || prediction.selected_model,
              },
            };
          }
        } catch {
          // Keep the sequence prediction visible if direct quick fallback is unavailable.
        }
      }

      const rawPhrase = prediction.phrase || prediction.label || 'Unknown gesture';
      const label = prediction.label || rawPhrase.toLowerCase();
      recordCallSignTelemetry(prediction, label);
      const librarySign = signsByLabelRef.current[label];
      const phrase = choosePredictionPhrase(prediction, librarySign?.sign || rawPhrase);
      const hint = librarySign?.hint || 'Hold your hand steady inside the camera frame';
      const confidence = Number(prediction.confidence || 0);
      const callReadyContext = activePanel === 'translate' || Boolean(chatCallScreen);
      const quickFallbackActive = String(prediction.source || '').includes('landmark') || prediction.fallback_from;
      const basicTestingMode = settings.ai.model === 'basic' && quickFallbackActive;
      const threshold = basicTestingMode ? 0.03 : quickFallbackActive ? Math.min(confidenceThresholdRef.current, 0.45) : confidenceThresholdRef.current;
      const confidenceMargin = Number(prediction.confidence_margin ?? 1);
      const isTooUncertain = (!basicTestingMode && prediction.is_uncertain) || confidence < threshold || confidenceMargin < MIN_CONFIDENCE_MARGIN;

      if (callReadyContext && isLetterOnlyPrediction(prediction, label, phrase)) {
        stablePredictionRef.current = { label: '', count: 0, acceptedAt: stablePredictionRef.current.acceptedAt };
        setStatus(`Letter ${String(phrase || label).toUpperCase()} ignored in live call`);
        setLearningFeedback('Letters are reserved for community sign creation. Live calls accept word and sentence-level signs only.');
        setLiveSign({
          label,
          phrase: 'Letter draft ignored',
          hint: 'Create letters in Community, then promote word/sentence signs for calls.',
          confidence,
          qualityScore: Number(prediction.quality_score || 0),
          stability: Number(prediction.stability || 0),
          sequenceLength: Number(prediction.sequence_length || 1),
          stableCount: 0,
          isStable: false,
          isUncertain: true,
          source: prediction.source || prediction.selected_model || '',
          signNumber: prediction.sign_number,
          vocabularySize: prediction.vocabulary_size,
          activeBook: prediction.active_book,
          activeLanguage: prediction.active_language,
          activeMode: prediction.active_mode,
          activeModel: prediction.active_model,
          vocabularyContext: prediction.vocabulary_context,
          modelMetrics: prediction.model_metrics || {},
        });
        return;
      }

      if (callReadyContext && isTooUncertain) {
        if (stablePredictionRef.current.label === label) stablePredictionRef.current.count += 1;
        else stablePredictionRef.current = { label, count: 1, acceptedAt: stablePredictionRef.current.acceptedAt };
        setStatus(`Unclear sign - ${formatConfidence(confidence)} confidence`);
        setLearningFeedback(`Candidate: ${phrase}. Confidence is low, so Signova is waiting for a steadier repeat before sending text or voice.`);
        setLiveSign({
          label,
          phrase: `Possible: ${phrase}`,
          hint: `Source: ${prediction.source || prediction.selected_model || 'model'} · label: ${label}`,
          confidence,
          qualityScore: Number(prediction.quality_score || 0),
          stability: Number(prediction.stability || 0),
          sequenceLength: Number(prediction.sequence_length || 1),
          stableCount: stablePredictionRef.current.count,
          isStable: false,
          isUncertain: true,
          translations: prediction.translations || {},
          gloss: prediction.gloss || '',
          alternatives: prediction.alternatives || [],
          source: prediction.source || prediction.selected_model || '',
          signNumber: prediction.sign_number,
          vocabularySize: prediction.vocabulary_size,
          activeBook: prediction.active_book,
          activeLanguage: prediction.active_language,
          activeMode: prediction.active_mode,
          activeModel: prediction.active_model,
          vocabularyContext: prediction.vocabulary_context,
          modelMetrics: prediction.model_metrics || {},
        });
        return;
      }

      const stablePrediction = stablePredictionRef.current;

      if (stablePrediction.label === label) stablePrediction.count += 1;
      else {
        stablePrediction.label = label;
        stablePrediction.count = 1;
      }

      setStatus(`${label} - ${formatConfidence(confidence)} via ${prediction.apiSource || 'api'}`);
      if (prediction.engine) setEngineStatus(prediction.engine);
      const uncertaintyFeedback = confidence < threshold
        ? `Uncertain prediction. Confidence is below your ${formatConfidence(threshold)} threshold. Hold the sign steady and improve lighting.`
        : quickFallbackActive
          ? 'Quick gesture fallback active because the transformer is not confident enough.'
          : prediction.feedback?.join(' ') || hint;
      setLearningFeedback(uncertaintyFeedback);
      setLiveSign({
        label,
        phrase,
        hint,
        confidence,
        qualityScore: Number(prediction.quality_score || 0),
        stability: Number(prediction.stability || 0),
        sequenceLength: Number(prediction.sequence_length || 1),
        stableCount: stablePrediction.count,
        isStable: stablePrediction.count >= MIN_SIGN_STABLE_FRAMES && confidence >= threshold,
        isUncertain: confidence < threshold,
        translations: prediction.translations || {},
        gloss: prediction.gloss || '',
        alternatives: prediction.alternatives || [],
        fallbackFrom: prediction.fallback_from || '',
        source: prediction.source || prediction.selected_model || '',
        signNumber: prediction.sign_number,
        vocabularySize: prediction.vocabulary_size,
        activeBook: prediction.active_book,
        activeLanguage: prediction.active_language,
        activeMode: prediction.active_mode,
        activeModel: prediction.active_model,
        vocabularyContext: prediction.vocabulary_context,
        modelMetrics: prediction.model_metrics || {},
      });

      const isStable = stablePrediction.count >= MIN_SIGN_STABLE_FRAMES && confidence >= threshold && confidenceMargin >= MIN_CONFIDENCE_MARGIN;
      const canAccept = now - stablePrediction.acceptedAt > ACCEPT_COOLDOWN_MS;

      if (isStable && canAccept && confidence >= threshold) {
        stablePrediction.acceptedAt = now;
        const runtimeSettings = runtimeSettingsRef.current;
        const sentAsVoice = voiceEnabledRef.current && phrase !== lastSpoken.current && settings.translation.outputType !== 'text';
        setCaption(phrase);
        const captionSynced = sendCaptionSync({
          caption: phrase,
          sentence: runtimeSettings.translationMode === 'word' ? phrase : sentence,
          label,
          confidence,
          voiceStatus: sentAsVoice ? 'voice' : 'text',
          mode: runtimeSettings.translationMode,
          language: runtimeSettings.outputLanguage || settings.translation.language,
        });
        addTranscriptEntry({
          label,
          text: phrase,
          confidence,
          voiceStatus: sentAsVoice ? 'Voice sent' : 'Text sent',
          remoteStatus: captionSynced ? 'Remote synced' : 'Local only',
        });
        if (runtimeSettings.storeHistory) {
          setHistory((items) => [
            {
              label,
              phrase,
              confidence,
              translations: prediction.translations || {},
              gloss: prediction.gloss || '',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
            ...items.filter((item) => item.label !== label),
          ].slice(0, 8));
        }
        if (runtimeSettings.translationMode === 'word') {
          sentenceRef.current = [label];
          setSentence(phrase);
        } else {
          sentenceRef.current = [label, ...sentenceRef.current.filter((item) => item !== label)].slice(0, 8);
          buildSentenceFromLabels(sentenceRef.current);
        }

        if (sentAsVoice) {
          lastSpoken.current = phrase;
          speak(phrase, runtimeSettings.outputLanguage || settings.translation.language);
        } else {
        }
      }
    } catch (error) {
      setApiRecovery({ active: true, message: error.message || 'request failed' });
      setStatus(`Sign API offline: ${error.message || 'request failed'}`);
    } finally {
      predictionInFlightRef.current = false;
    }
  }

  async function startCamera(facingModeOverride = null, restartStream = false) {
    if (process.env.NODE_ENV === 'test') {
      setStatus('Camera disabled in tests');
      return false;
    }
    if (restartStream && streamRef.current) {
      if (cameraLoopTimerRef.current) window.clearTimeout(cameraLoopTimerRef.current);
      cameraLoopTimerRef.current = null;
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      handsRef.current?.close?.();
      handsRef.current = null;
    }
    if (streamRef.current) return true;

    try {
      await loadMediaPipeScripts();
      setStatus('MediaPipe loaded');
      const performanceProfile = PERFORMANCE_PROFILES[settings.ai.performanceMode] || PERFORMANCE_PROFILES.balanced;
      const cameraResolution = CAMERA_RESOLUTIONS[settings.camera.resolution] || CAMERA_RESOLUTIONS['720p'];
      const hands = new window.Hands({ locateFile: (file) => `${MEDIAPIPE_HANDS_BASE_URL}/${file}` });
      hands.setOptions({
        selfieMode: false,
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: performanceProfile.detection,
        minTrackingConfidence: performanceProfile.tracking,
      });
      hands.onResults(handleHandsResults);
      handsRef.current = hands;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: cameraResolution.width },
          height: { ideal: cameraResolution.height },
          frameRate: { ideal: settings.camera.fps, max: Math.max(settings.camera.fps, 30) },
          facingMode: facingModeOverride || settings.camera.facingMode,
          aspectRatio: { ideal: 16 / 9 },
          resizeMode: 'none',
        },
        audio: settings.microphone.inputDevice === 'default'
          ? { noiseSuppression: settings.microphone.noiseSuppression }
          : {
            deviceId: { exact: settings.microphone.inputDevice },
            noiseSuppression: settings.microphone.noiseSuppression,
          },
      });
      stream.getAudioTracks().forEach((track) => { track.enabled = micEnabled; });
      const [videoTrack] = stream.getVideoTracks();
      if (videoTrack) {
        videoTrack.contentHint = 'detail';
        try {
          await videoTrack.applyConstraints({
            width: { ideal: cameraResolution.width },
            height: { ideal: cameraResolution.height },
            frameRate: { ideal: settings.camera.fps },
            advanced: [
              { width: cameraResolution.width, height: cameraResolution.height },
              { frameRate: settings.camera.fps },
              { aspectRatio: 16 / 9 },
            ],
          });
        } catch {
          // Browser/camera may not support exact HD constraints; keep the best stream it provided.
        }
        const actual = videoTrack.getSettings?.() || {};
        const actualWidth = Number(actual.width || cameraResolution.width);
        const actualHeight = Number(actual.height || cameraResolution.height);
        const actualFps = Number(actual.frameRate || settings.camera.fps);
        setCameraQuality({
          label: actualWidth >= 1920 ? 'Full HD' : actualWidth >= 1280 ? 'HD' : actualWidth >= 854 ? 'SD+' : 'Basic',
          width: actualWidth,
          height: actualHeight,
          fps: Math.round(actualFps),
        });
      }
      streamRef.current = stream;
      setCameraEnabled(true);
      setStatus('Camera active');
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      let sendingFrame = false;
      let frameCount = 0;
      let lastProcessedAt = 0;
      let loopStopped = false;
      async function processFrame() {
        if (!streamRef.current || loopStopped) return;
        const frameConfig = frameSettingsRef.current;
        const targetFrameRate = Math.max(1, Number(frameConfig.frameRate || settings.ai.frameRate || 30));
        const minFrameGap = 1000 / targetFrameRate;
        if (!videoRef.current) {
          cameraLoopTimerRef.current = window.setTimeout(processFrame, minFrameGap);
          return;
        }
        const frameModulo = frameConfig.frameSkipping
          ? (PERFORMANCE_PROFILES[frameConfig.performanceMode] || PERFORMANCE_PROFILES.balanced).frameModulo
          : 1;
        const now = performance.now();
        frameCount += 1;
        const shouldProcess = frameCount % frameModulo === 0 && now - lastProcessedAt >= minFrameGap;
        if (!sendingFrame && shouldProcess && videoRef.current.readyState >= 2) {
          lastProcessedAt = now;
          sendingFrame = true;
          try {
            void sendRtmwSnapshot(videoRef.current);
            await hands.send({ image: getMediaPipeInput(videoRef.current) });
          } catch (error) {
            setStatus('MediaPipe frame skipped');
            if (String(error?.message || '').includes('hands_solution_packed_assets.data')) {
            }
          } finally {
            sendingFrame = false;
          }
        }
        const elapsed = performance.now() - now;
        const nextDelay = Math.max(8, minFrameGap - elapsed);
        cameraLoopTimerRef.current = window.setTimeout(processFrame, nextDelay);
      }
      cameraLoopTimerRef.current = window.setTimeout(processFrame, 1000 / Math.max(1, settings.ai.frameRate || 30));
      return true;
    } catch (error) {
      setStatus(error?.message === 'MediaPipe Hands unavailable' ? 'Hand tracking unavailable. Camera can still be used.' : 'Camera or MediaPipe failed to start');
      return false;
    }
  }

  startCameraRef.current = startCamera;

  function stopCamera() {
    if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    if (cameraLoopTimerRef.current) window.clearTimeout(cameraLoopTimerRef.current);
    cameraLoopTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    handsRef.current?.close?.();
    handsRef.current = null;
    const rtmwSessionId = rtmwSessionIdRef.current;
    if (rtmwSessionId) {
      void fetchJson('/api/wholebody/session/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: rtmwSessionId }),
      }).catch(() => {});
    }
    rtmwSessionIdRef.current = '';
    rtmwLastSentAtRef.current = 0;
    rtmwInFlightRef.current = false;
    rtmwIntervalRef.current = 1000;
    rtmwActivePersonIdRef.current = '';
    activeSignerRoiRef.current = null;
    currentMediaPipeRoiRef.current = null;
    setCameraEnabled(false);
    setMicEnabled(false);
    setCameraQuality({ label: 'Camera standby', width: 0, height: 0, fps: 0 });
    setStatus('Camera off');
  }

  useEffect(() => () => {
    window.clearTimeout(railLogoClickTimerRef.current);
    window.clearTimeout(railTributeTimerRef.current);
    window.clearTimeout(communityRailTapTimerRef.current);
    window.clearTimeout(fullIntroTimerRef.current);
    window.clearTimeout(cameraControlClickTimerRef.current);
    stopCamera();
    if (communityGroupRecorderRef.current) {
      communityGroupRecorderRef.current.onstop = null;
      communityGroupRecorderRef.current.stop?.();
    }
    communityGroupVoiceStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    captionChannelRef.current?.close?.();
    captionChannelRef.current = null;
    peerRefs.current.forEach((peer) => peer.close());
  }, []);

  useEffect(() => {
    function handleChatEscape(event) {
      if (event.key !== 'Escape') return;
      if (attachMenuOpen) {
        event.preventDefault();
        setAttachMenuOpen(false);
        return;
      }
      if (passwordModal.open) {
        event.preventDefault();
        setPasswordModal({ open: false, contactId: null, mode: 'create', value: '', error: '', methods: { face: true, fingerprint: true, pin: true } });
        return;
      }
      if (contactModalOpen) {
        event.preventDefault();
        setContactModalOpen(false);
        return;
      }
      if (conversationInfoMenuOpen) {
        event.preventDefault();
        setConversationInfoMenuOpen(false);
        return;
      }
      if (conversationCategoryOpen) {
        event.preventDefault();
        setConversationCategoryOpen(false);
        return;
      }
      if (activePanel === 'translate' && selectedConversationId) {
        event.preventDefault();
        setSelectedConversationId('');
        setMobileChatListOpen(true);
        setStatus('Call history');
        return;
      }
      if (activePanel !== 'chats') return;

      event.preventDefault();
      window.clearTimeout(chatLongPressRef.current);
      chatLongPressRef.current = null;
      setChatMenu({ visible: false, contactId: null, x: 0, y: 0 });
      setChatSidebarMenu({ visible: false, x: 0, y: 0 });
      setCategoryComposerOpen(false);
      setCategoryDraft('');
      setChatSearch('');
      setChatDraft('');
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setSelectedChatId(null);
      setStatus('Chat unselected');
    }

    window.addEventListener('keydown', handleChatEscape);
    return () => window.removeEventListener('keydown', handleChatEscape);
  }, [activePanel, attachMenuOpen, contactModalOpen, conversationCategoryOpen, conversationInfoMenuOpen, passwordModal.open, selectedConversationId]);

  useEffect(() => {
    async function loadSigns() {
      try {
        const data = await fetchJson('/api/signs');
        if (Array.isArray(data.signs) && data.signs.length) {
          setSignLibrary(data.signs);
          setSignApiStatus(`Loaded ${data.signs.length} signs from ${data.apiSource}`);
          return;
        }
        setSignApiStatus('Using fallback signs');
      } catch {
        setSignLibrary(DEFAULT_SIGNS);
        setSignApiStatus('Using fallback signs');
      }
    }

    loadSigns();
  }, []);

  useEffect(() => {
    async function loadMetrics() {
      try {
        const data = await fetchJson('/api/metrics');
        setAiMetrics({
          status: data.primary_metric ? `Primary: ${data.primary_metric.replace('_', ' ')}` : 'Metrics ready',
          models: data.metrics || {},
        });
      } catch {
        setAiMetrics({ status: 'Metrics unavailable', models: {} });
      }
    }

    loadMetrics();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function checkConnection() {
      try {
        const data = await fetchJson('/api/health');
        if (cancelled) return;
        const aiPayload = data.ai || data;
        const cameThroughBackend = data.service === 'Signova Backend' && data.apiSource === 'backend';
        const models = aiPayload.sequence_models || {};
        setApiConnection({
          status: aiPayload.status === 'ok' ? 'connected' : 'degraded',
          backend: cameThroughBackend ? 'Connected' : 'Bypassed',
          ai: aiPayload.status === 'ok' ? 'Connected' : 'Degraded',
          source: data.apiSource || (cameThroughBackend ? 'backend' : 'ai-service'),
          detail: cameThroughBackend ? 'Frontend → Backend → AI service' : 'Frontend connected directly to AI service',
          models,
        });
      } catch (error) {
        if (cancelled) return;
        setApiConnection({
          status: 'offline',
          backend: 'Offline',
          ai: 'Offline',
          source: 'none',
          detail: error.message || 'Signova services unreachable',
          models: {},
        });
      }
    }

    checkConnection();
    const interval = window.setInterval(checkConnection, 12000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  function applyRemoteCaptionPayload(payload) {
    if (!payload || typeof payload !== 'object') return;
    if (payload.mediaState) {
      setRemoteMediaState((current) => ({ ...current, ...payload.mediaState }));
      if (payload.type === 'signova-media-state') return;
    }
    const nextCaption = payload.caption || payload.sentence || 'Remote sign received';
    setRemoteCaption(nextCaption);
    setCaptionChannelStatus(payload.confidence
      ? `Synced ${formatConfidence(Number(payload.confidence))}`
      : 'Caption synced');
    const voiceOutputAllowed = voiceEnabledRef.current && settings.translation.outputType !== 'text';
    const spokenKey = `${nextCaption}-${payload.language || settings.translation.language}`;
    if (voiceOutputAllowed && nextCaption !== 'Waiting for signs' && spokenKey !== lastRemoteSpoken.current) {
      lastRemoteSpoken.current = spokenKey;
      speak(nextCaption, payload.language || settings.translation.language);
    } else {
    }
    addTranscriptEntry({
      label: payload.label || 'remote',
      text: nextCaption,
      confidence: Number(payload.confidence || 0),
      voiceStatus: payload.voiceStatus === 'voice' ? 'Remote voice' : 'Remote text',
      remoteStatus: 'Received',
    });
  }

  function sendCaptionSync(override = {}) {
    const channel = captionChannelRef.current;
    if (!channel || channel.readyState !== 'open') return false;
    const payload = {
      type: 'signova-caption',
      caption,
      sentence,
      label: liveSign?.label || '',
      confidence: liveSign?.confidence || 0,
      language: settings.translation.language,
      mode: settings.translation.mode,
      mediaState: {
        camera: cameraEnabled,
        mic: micEnabled,
        translation: synapseEnabledRef.current,
      },
      sentAt: Date.now(),
      ...override,
    };
    channel.send(JSON.stringify(payload));
    return true;
  }

  useEffect(() => {
    if (caption === 'Waiting for signs') return;
    const channel = captionChannelRef.current;
    if (!channel || channel.readyState !== 'open') return;
    channel.send(JSON.stringify({
      type: 'signova-caption',
      caption,
      sentence,
      label: liveSign?.label || '',
      confidence: liveSign?.confidence || 0,
      language: settings.translation.language,
      mode: settings.translation.mode,
      mediaState: { camera: cameraEnabled, mic: micEnabled, translation: synapseEnabled },
      sentAt: Date.now(),
    }));
  }, [cameraEnabled, caption, liveSign, micEnabled, sentence, settings.translation.language, settings.translation.mode, synapseEnabled]);

  useEffect(() => {
    if (!chatCallScreen) return;
    const channel = captionChannelRef.current;
    if (!channel || channel.readyState !== 'open') return;
    channel.send(JSON.stringify({
      type: 'signova-media-state',
      mediaState: { camera: cameraEnabled, mic: micEnabled, translation: synapseEnabled },
      sentAt: Date.now(),
    }));
  }, [cameraEnabled, chatCallScreen, micEnabled, synapseEnabled]);

  async function startWebRtcPreview() {
    startConversationLog('webrtc');
    if (!streamRef.current && !videoRef.current?.srcObject) {
      setCallStatus('Starting camera for WebRTC...');
      const cameraStarted = await startCamera();
      if (!cameraStarted) {
        setCallStatus('Camera permission required for WebRTC');
        return;
      }
    }

    const localStream = streamRef.current || videoRef.current?.srcObject;
    if (!localStream) {
      setCallStatus('Start camera first');
      return;
    }

    peerRefs.current.forEach((peer) => peer.close());
    captionChannelRef.current?.close?.();
    captionChannelRef.current = null;
    lastRemoteSpoken.current = '';
    setRemoteCaption('Waiting for remote caption');
    setCaptionChannelStatus('Opening caption sync...');

    const localPeer = new RTCPeerConnection();
    const remotePeer = new RTCPeerConnection();
    peerRefs.current = [localPeer, remotePeer];
    const captionChannel = localPeer.createDataChannel('signova-caption-sync', { ordered: true });
    captionChannelRef.current = captionChannel;

    captionChannel.onopen = () => {
      setCaptionChannelStatus('Caption sync connected');
      sendCaptionSync({ caption, sentence });
    };
    captionChannel.onclose = () => {
      setCaptionChannelStatus('Caption sync closed');
    };
    captionChannel.onerror = () => {
      setCaptionChannelStatus('Caption sync error');
    };

    remotePeer.ondatachannel = ({ channel }) => {
      if (channel.label !== 'signova-caption-sync') return;
      channel.onmessage = (event) => {
        try {
          applyRemoteCaptionPayload(JSON.parse(event.data));
        } catch {
          setRemoteCaption(String(event.data || 'Remote sign received'));
          setCaptionChannelStatus('Caption synced');
        }
      };
      channel.onopen = () => setCaptionChannelStatus('Caption sync connected');
      channel.onclose = () => setCaptionChannelStatus('Caption sync closed');
    };

    localPeer.onicecandidate = ({ candidate }) => {
      if (candidate) remotePeer.addIceCandidate(candidate);
    };
    remotePeer.onicecandidate = ({ candidate }) => {
      if (candidate) localPeer.addIceCandidate(candidate);
    };
    remotePeer.ontrack = ({ streams }) => {
      remoteStreamRef.current = streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = streams[0];
      }
    };

    localStream.getTracks().forEach((track) => {
      const sender = localPeer.addTrack(track, localStream);
      if (track.kind === 'video') {
        try {
          const parameters = sender.getParameters();
          parameters.degradationPreference = 'maintain-resolution';
          parameters.encodings = parameters.encodings?.length ? parameters.encodings : [{}];
          parameters.encodings[0] = {
            ...parameters.encodings[0],
            maxBitrate: settings.camera.resolution === '1440p' ? 6500000 : settings.camera.resolution === '1080p' ? 4500000 : settings.camera.resolution === '720p' ? 2500000 : 1200000,
            maxFramerate: settings.camera.fps,
          };
          sender.setParameters(parameters);
        } catch {
          // Some browsers do not allow sender tuning before negotiation.
        }
      }
    });
    const offer = await localPeer.createOffer();
    await localPeer.setLocalDescription(offer);
    await remotePeer.setRemoteDescription(offer);
    const answer = await remotePeer.createAnswer();
    await remotePeer.setLocalDescription(answer);
    await localPeer.setRemoteDescription(answer);
    setCallStatus('WebRTC connected');
  }

  function resetWebRtcPreview() {
    captionChannelRef.current?.close?.();
    captionChannelRef.current = null;
    lastRemoteSpoken.current = '';
    peerRefs.current.forEach((peer) => peer.close());
    peerRefs.current = [];
    remoteStreamRef.current = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setRemoteCaption('Waiting for remote caption');
    setRemoteMediaState({ camera: true, mic: true, translation: true });
    setCaptionChannelStatus('Caption sync ready');
    setCallStatus('WebRTC ready');
  }

  async function endCallSession(event) {
    event?.stopPropagation();
    completeActiveConversationLog();
    resetWebRtcPreview();
    stopCamera();
    setSecureCallStatus('Call ended');
    setCallStatus('Call ended');
    setChatCallScreen(null);
    setChatCallMinimized(false);
    setChatCallExpanded(false);
    setChatCallInfoOpen(false);
    setChatCallMoreOpen(false);
    setChatCallHistoryOpen(false);
    setChatCallFocus('local');
    setCallTranscript([]);
    setCallSignTelemetry({ attempts: 0, accepted: 0, uncertain: 0, unique: [], last: null });
    clearSentence();
    if (desktopCallWindowMode && window.signovaDesktop?.close) {
      window.signovaDesktop.close();
      return;
    }
  }

  function clearSentence() {
    sentenceRef.current = [];
    setSentence('Waiting for signs');
  }

  async function copySentence() {
    if (!navigator.clipboard || sentence === 'Waiting for signs') return;
    await navigator.clipboard.writeText(sentence);
  }

  function useTranslationAsMessage() {
    if (sentence !== 'Waiting for signs') {
      setChatDraft(sentence);
      setComposerPickerOpen(false);
      return;
    }
    if (caption !== 'Waiting for signs') {
      setChatDraft(caption);
      setComposerPickerOpen(false);
    }
  }

  function appendToChatDraft(value) {
    setChatDraft((draft) => `${draft}${draft && !draft.endsWith(' ') ? ' ' : ''}${value}`);
  }

  function selectComposerEmoji(emoji) {
    appendToChatDraft(emoji);
  }

  function selectComposerSign(sign) {
    appendToChatDraft(sign.sign || sign.label);
    setComposerPickerOpen(false);
  }

  function selectComposerSticker(sticker) {
    sendGestureSticker(sticker);
    setComposerPickerOpen(false);
  }

  function updateSynapseEnabled(nextValue) {
    setSynapseEnabled((current) => {
      const value = typeof nextValue === 'function' ? nextValue(current) : nextValue;
      synapseEnabledRef.current = value;
      return value;
    });
  }

  function toggleCallTranslation() {
    revealCallControls();
    updateSynapseEnabled((enabled) => {
      const nextEnabled = !enabled;
      setStatus(nextEnabled ? 'Live translation resumed' : 'Live translation paused');
      return nextEnabled;
    });
  }

  function openPanel(panel) {
    if (panel === 'contacts') {
      setContactModalOpen(true);
      window.setTimeout(() => document.querySelector('.contactMiniModal input')?.focus(), 80);
      return;
    }
    if (typeof window !== 'undefined' && window.innerWidth <= 760 && (panel === 'chats' || panel === 'translate')) {
      setMobileChatListOpen(true);
    }
    setActivePanel(panel);
    if (settings.translation.enabled && (panel === 'translate' || panel === 'library')) {
      synapseEnabledRef.current = true;
      updateSynapseEnabled(true);
    }
  }

  function startChatSidebarResize(event) {
    if (window.innerWidth <= 760) return;
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = chatSidebarWidth;
    document.body.classList.add('resizingChatSidebar');

    function handlePointerMove(moveEvent) {
      const nextWidth = clampChatSidebarWidth(startWidth + moveEvent.clientX - startX);
      setChatSidebarWidth(nextWidth);
    }

    function stopPointerMove() {
      document.body.classList.remove('resizingChatSidebar');
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopPointerMove);
      window.removeEventListener('pointercancel', stopPointerMove);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopPointerMove);
    window.addEventListener('pointercancel', stopPointerMove);
  }

  function getPrimaryContactId() {
    return visibleContacts[0]?.id || contacts[0]?.id || 'signova-ai';
  }

  function startConversationLog(type = 'call', requestedContactId = '') {
    const contactId = requestedContactId || selectedChatId || getPrimaryContactId();
    const now = new Date();
    setSelectedConversationId(contactId);
    setCallHistory((items) => {
      const activeForContact = items.find((item) => item.contactId === contactId && item.status === 'active');
      if (activeForContact) return items;
      return [
        {
          id: `call-${Date.now()}`,
          contactId,
          type,
          status: 'active',
          startedAt: now.toISOString(),
          startedLabel: now.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
          endedAt: '',
          endedLabel: '',
          durationSeconds: 0,
        },
        ...items,
      ];
    });
  }

  function completeActiveConversationLog() {
    const now = new Date();
    setCallHistory((items) => items.map((item) => {
      if (item.status !== 'active') return item;
      const started = Date.parse(item.startedAt);
      const durationSeconds = Number.isFinite(started) ? Math.max(0, Math.round((now.getTime() - started) / 1000)) : 0;
      return {
        ...item,
        status: 'completed',
        endedAt: now.toISOString(),
        endedLabel: now.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }),
        durationSeconds,
      };
    }));
  }

  function playRailTribute() {
    window.clearTimeout(railTributeTimerRef.current);
    setRailTributeActive(false);
    window.requestAnimationFrame(() => setRailTributeActive(true));
    railTributeTimerRef.current = window.setTimeout(() => setRailTributeActive(false), 2500);
  }

  function playFullSignovaIntro() {
    window.clearTimeout(railLogoClickTimerRef.current);
    window.clearTimeout(fullIntroTimerRef.current);
    setFullIntroActive(false);
    window.requestAnimationFrame(() => setFullIntroActive(true));
    fullIntroTimerRef.current = window.setTimeout(() => setFullIntroActive(false), 3150);
  }

  function applyAuthenticatedProfile(profile) {
    const nextName = profile.name || 'Signova User';
    const nameParts = splitAuthName(nextName);
    const nextUsername = normalizeAuthUsername(profile.username || profile.email?.split('@')[0] || 'signova.user');
    setSettings((current) => ({
      ...current,
      account: {
        ...current.account,
        name: nextName,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        email: profile.email || current.account.email,
        username: nextUsername,
        phone: profile.phone || current.account.phone,
        emailVerified: Boolean(profile.emailVerified ?? current.account.emailVerified),
        phoneVerified: Boolean(profile.phoneVerified ?? current.account.phoneVerified),
      },
      privacy: {
        ...current.privacy,
        showNumber: Boolean(profile.showNumber),
      },
    }));
    setCommunityProfile((current) => ({
      ...current,
      name: profile.communityName || profile.name || current.name,
      username: normalizeUsername(profile.communityUsername || nextUsername || current.username),
      bio: profile.communityBio || current.bio,
      avatarInitials: profile.communityAvatarInitials || profile.avatarInitials || current.avatarInitials,
      avatarTone: profile.communityAvatarTone || profile.avatarTone || current.avatarTone,
      avatarMode: profile.communityAvatarMode || profile.avatarMode || current.avatarMode,
      avatarMood: profile.communityAvatarMood || profile.avatarMood || current.avatarMood,
      avatarAccessory: profile.communityAvatarAccessory || profile.avatarAccessory || current.avatarAccessory,
      avatarImage: profile.communityAvatarImage || profile.avatarImage || current.avatarImage,
    }));
  }

  async function saveAuthProfile(user, profile) {
    if (!firestoreDb || !user?.uid) return;
    const username = normalizeAuthUsername(profile.username);
    const phone = normalizeAuthPhone(profile.phone);
    const profilePayload = {
      name: profile.name,
      username,
      email: profile.email,
      phone,
      showNumber: Boolean(profile.showNumber),
      communityName: profile.communityName || profile.name,
      communityUsername: normalizeUsername(profile.communityUsername || username),
      communityBio: profile.communityBio || 'Public creator profile for Signova community.',
      communityAvatarInitials: profile.communityAvatarInitials || '',
      communityAvatarTone: profile.communityAvatarTone || 'cyan',
      communityAvatarMode: profile.communityAvatarMode || '3d',
      communityAvatarMood: profile.communityAvatarMood || 'calm',
      communityAvatarAccessory: profile.communityAvatarAccessory || 'none',
      communityAvatarImage: profile.communityAvatarImage || '',
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(firestoreDb, 'users', user.uid), profilePayload, { merge: true });
  }

  async function saveCommunityProfileToFirestore(profile = communityProfile) {
    if (!firestoreDb || !authenticatedFirebaseUser?.uid || !authenticatedFirebaseUser.emailVerified) {
      setStatus('Login with verified email to save your community profile.');
      return false;
    }
    const payload = {
      communityName: profile.name || 'Signova Creator',
      communityUsername: normalizeUsername(profile.username || '@signova.creator'),
      communityBio: profile.bio || '',
      communityAvatarInitials: profile.avatarInitials || '',
      communityAvatarTone: profile.avatarTone || 'cyan',
      communityAvatarMode: profile.avatarMode || '3d',
      communityAvatarMood: profile.avatarMood || 'calm',
      communityAvatarAccessory: profile.avatarAccessory || 'none',
      communityAvatarImage: profile.avatarImage || '',
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(firestoreDb, 'users', authenticatedFirebaseUser.uid), payload, { merge: true });
    setStatus('Community profile saved.');
    return true;
  }

  async function loadAuthProfile(user, fallback = {}) {
    if (!firestoreDb || !user?.uid) {
      return {
        ...fallback,
        email: user?.email || fallback.email,
        emailVerified: Boolean(user?.emailVerified),
      };
    }
    const profileSnap = await getDoc(doc(firestoreDb, 'users', user.uid));
    return {
      ...fallback,
      ...(profileSnap.exists() ? profileSnap.data() : {}),
      email: user.email || fallback.email,
      emailVerified: Boolean(user.emailVerified),
    };
  }

  function getEmailVerificationSettings() {
    if (typeof window === 'undefined') return undefined;
    const configuredPublicUrl = process.env.REACT_APP_PUBLIC_SITE_URL?.trim();
    const verificationUrl = configuredPublicUrl || window.location.origin;
    return {
      url: `${verificationUrl.replace(/\/$/, '')}/`,
      handleCodeInApp: false,
    };
  }

  async function sendSignovaEmailVerification(user) {
    try {
      await sendEmailVerification(user, getEmailVerificationSettings());
      return { usedDefaultFirebaseLink: false };
    } catch (error) {
      const code = error?.code || '';
      const canFallbackToFirebaseDefaultLink = [
        'auth/unauthorized-continue-uri',
        'auth/invalid-continue-uri',
        'auth/missing-continue-uri',
      ].includes(code);
      if (!canFallbackToFirebaseDefaultLink) throw error;
      await sendEmailVerification(user);
      return { usedDefaultFirebaseLink: true };
    }
  }

  async function finishFirebaseAuth(user, fallbackProfile = {}) {
    const profile = await loadAuthProfile(user, fallbackProfile);
    applyAuthenticatedProfile(profile);
    resetDatabaseSession();
    setAuthMessage({ type: 'success', text: 'Authentication complete. Opening Signova...' });
    setAuthStage('opening');
  }

  async function startSignovaAuthentication(event) {
    event.preventDefault();
    if (!isFirebaseReady || !firebaseAuth || !firestoreDb) {
      setAuthMessage({ type: 'error', text: 'Firebase config missing. Add your Signova Firebase project config first.' });
      return;
    }

    setAuthBusy(true);
    setAuthMessage({ type: '', text: '' });
    try {
      const password = authForm.pin.trim();

      if (authMode === 'signup') {
        if (password.length < 6) throw new Error('Password must be at least 6 characters.');
        const email = validateAuthEmail(authForm.email);
        const username = validateAuthUsername(authForm.username);
        const phone = validateAuthPhone(authForm.phone);
        const name = validateAuthName(authForm.name);
        if (password !== authForm.confirmPin.trim()) throw new Error('Confirm password does not match.');
        const credential = await createUserWithEmailAndPassword(firebaseAuth, email, password);
        await updateProfile(credential.user, { displayName: name });
        const profile = {
          name,
          username,
          email,
          phone,
          showNumber: !authForm.hidePhone,
          phoneVerified: false,
        };
        await saveAuthProfile(credential.user, profile);
        setAuthPhoneChallenge(null);
        const verificationSend = await sendSignovaEmailVerification(credential.user);
        await signOut(firebaseAuth);
        setAuthMessage({
          type: 'success',
          text: verificationSend.usedDefaultFirebaseLink
            ? 'Account created. Verification email was sent using Firebase default link because the public return URL needs console setup. Check Inbox, Spam, and Promotions.'
            : 'Account created. Verify the link sent to your email, then login.',
        });
        return;
      }

      if (password.length < 6) throw new Error('Password must be at least 6 characters.');
      const email = validateAuthEmail(authForm.email);
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      if (!credential.user.emailVerified) {
        await signOut(firebaseAuth);
        setAuthMessage({ type: 'error', text: 'Email is not verified yet. No new email was sent on this login. Click “Send verification email / check status” below once, then check Inbox, Spam, and Promotions.' });
        return;
      }
      await finishFirebaseAuth(credential.user, { email: credential.user.email || '' });
    } catch (error) {
      setAuthMessage({ type: 'error', text: getFriendlyFirebaseAuthError(error) });
    } finally {
      setAuthBusy(false);
    }
  }

  async function resendAuthVerificationFromForm() {
    if (!isFirebaseReady || !firebaseAuth || !firestoreDb) {
      setAuthMessage({ type: 'error', text: 'Firebase config missing. Email verification is unavailable.' });
      return;
    }
    if (authVerificationCooldownSeconds > 0) {
      setAuthMessage({ type: 'error', text: `Please wait ${authVerificationCooldownSeconds}s before requesting another verification email.` });
      return;
    }
    setAuthBusy(true);
    setAuthMessage({ type: '', text: '' });
    try {
      const email = validateAuthEmail(authForm.email);
      const password = authForm.pin.trim();
      if (password.length < 6) throw new Error('Enter your password, then resend/check verification.');
      const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
      await credential.user.reload();
      if (credential.user.emailVerified) {
        await finishFirebaseAuth(credential.user, { email: credential.user.email || '' });
        return;
      }
      const verificationSend = await sendSignovaEmailVerification(credential.user);
      await signOut(firebaseAuth);
      setAuthCooldownNow(Date.now());
      setAuthVerificationCooldownUntil(Date.now() + 60000);
      setAuthMessage({
        type: 'success',
        text: verificationSend.usedDefaultFirebaseLink
          ? 'Verification email request sent using Firebase default link. Add the public domain in Firebase Authorized domains, then future emails can return directly to Signova. Check Inbox, Spam, and Promotions.'
          : 'Verification email request sent. Wait at least 60 seconds before trying again. Check Inbox, Spam, and Promotions. If it still does not arrive, check Firebase email template and authorized domains.',
      });
    } catch (error) {
      if (error?.code === 'auth/too-many-requests') {
        setAuthCooldownNow(Date.now());
        setAuthVerificationCooldownUntil(Date.now() + 10 * 60 * 1000);
      }
      setAuthMessage({ type: 'error', text: getFriendlyFirebaseAuthError(error, 'Could not resend verification email.') });
    } finally {
      setAuthBusy(false);
    }
  }

  async function handleSignovaLogout() {
    setAuthBusy(true);
    try {
      stopCamera();
      setChatCallScreen(null);
      resetDatabaseSession();
      if (firebaseAuth) {
        await signOut(firebaseAuth);
      }
      setAuthenticatedFirebaseUser(null);
      setPersistenceReady(false);
      setAuthMode('login');
      setAuthRecoveryOpen(false);
      setAuthMessage({ type: 'success', text: 'Signed out. Login again when you want to open Signova.' });
      setAuthStage('auth');
    } catch (error) {
      setAuthMessage({ type: 'error', text: getFriendlyFirebaseAuthError(error, 'Could not sign out. Please try again.') });
      setAuthStage('auth');
    } finally {
      setAuthBusy(false);
    }
  }

  async function saveAccountSettings() {
    setAccountSettingsMessage({ type: '', text: '' });
    try {
      const name = validateAuthName(settings.account.name);
      const username = validateAuthUsername(settings.account.username);
      const phone = settings.account.phone.trim() ? validateAuthPhone(settings.account.phone) : '';
      const nextProfile = {
        ...settings.account,
        name,
        username,
        phone,
        showNumber: settings.privacy.showNumber,
      };
      const nameParts = splitAuthName(name);
      setSettings((current) => ({
        ...current,
        account: {
          ...current.account,
          name,
          firstName: nameParts.firstName,
          lastName: nameParts.lastName,
          username,
          phone,
        },
      }));
      if (authenticatedFirebaseUser && firebaseAuth?.currentUser) {
        await updateProfile(firebaseAuth.currentUser, { displayName: name });
        await saveAuthProfile(authenticatedFirebaseUser, nextProfile);
      }
      setAccountSettingsMessage({ type: 'success', text: 'Profile changes saved.' });
      setStatus('Profile changes saved.');
    } catch (error) {
      setAccountSettingsMessage({ type: 'error', text: error?.message || 'Could not save profile changes.' });
    }
  }

  async function sendAccountPasswordReset() {
    setAccountSettingsMessage({ type: '', text: '' });
    try {
      if (!isFirebaseReady || !firebaseAuth) throw new Error('Firebase Auth is not ready.');
      const email = validateAuthEmail(settings.account.email || authenticatedFirebaseUser?.email || '');
      await sendPasswordResetEmail(firebaseAuth, email);
      setAccountSettingsMessage({ type: 'success', text: 'Password change email sent. Check Inbox or Spam.' });
      setStatus('Password change email sent.');
    } catch (error) {
      setAccountSettingsMessage({ type: 'error', text: getFriendlyFirebaseAuthError(error, 'Could not send password change email.') });
    }
  }

  async function addAnotherAccount() {
    await handleSignovaLogout();
    setAuthMode('signup');
    setAuthRecoveryOpen(false);
    setAuthForm({ name: '', username: '', phone: '', email: '', pin: '', confirmPin: '', phoneOtp: '', hidePhone: true });
    setAuthMessage({ type: 'success', text: 'Create or login with another Signova account.' });
  }

  async function sendAuthRecovery(event) {
    event.preventDefault();
    if (!isFirebaseReady || !firebaseAuth || !firestoreDb) {
      setAuthMessage({ type: 'error', text: 'Firebase config missing. Password recovery is unavailable.' });
      return;
    }
    setAuthBusy(true);
    setAuthMessage({ type: '', text: '' });
    try {
      const email = validateAuthEmail(authForm.email);
      await sendPasswordResetEmail(firebaseAuth, email);
      setAuthMessage({ type: 'success', text: 'If this account exists, a password reset email has been sent.' });
    } catch (error) {
      setAuthMessage({ type: 'error', text: getFriendlyFirebaseAuthError(error, 'Could not send recovery email.') });
    } finally {
      setAuthBusy(false);
    }
  }

  function handleRailLogoClick() {
    window.clearTimeout(railLogoClickTimerRef.current);
    railLogoClickTimerRef.current = window.setTimeout(() => playRailTribute(), 220);
  }

  function handleRailLogoDoubleClick(event) {
    event.preventDefault();
    window.clearTimeout(railLogoClickTimerRef.current);
    playFullSignovaIntro();
  }

  function handleCommunityRailTap() {
    if (communityRailTapTimerRef.current) {
      window.clearTimeout(communityRailTapTimerRef.current);
      communityRailTapTimerRef.current = null;
      openPanel(activePanel === 'communityGroups' ? 'community' : 'communityGroups');
      return;
    }
    communityRailTapTimerRef.current = window.setTimeout(() => {
      communityRailTapTimerRef.current = null;
      openPanel('community');
    }, 260);
  }

  function toggleCameraTrack() {
    const videoTrack = streamRef.current?.getVideoTracks()[0];
    if (!videoTrack) {
      startCamera();
      return;
    }
    videoTrack.enabled = !videoTrack.enabled;
    setCameraEnabled(videoTrack.enabled);
    setStatus(videoTrack.enabled ? 'Camera active' : 'Camera muted');
  }

  function handleCameraControlClick(event) {
    event?.stopPropagation();
    window.clearTimeout(cameraControlClickTimerRef.current);
    cameraControlClickTimerRef.current = window.setTimeout(() => toggleCameraTrack(), 230);
  }

  async function flipCameraFacingMode(event) {
    event?.preventDefault();
    event?.stopPropagation();
    window.clearTimeout(cameraControlClickTimerRef.current);
    const nextFacingMode = settings.camera.facingMode === 'environment' ? 'user' : 'environment';
    updateSetting('camera', 'facingMode', nextFacingMode);
    setStatus(`Switching to ${nextFacingMode === 'environment' ? 'back' : 'front'} camera`);
    const switched = await startCamera(nextFacingMode, true);
    setStatus(switched ? `${nextFacingMode === 'environment' ? 'Back' : 'Front'} camera active` : 'Camera flip unavailable on this device');
  }

  function toggleMicTrack() {
    const audioTrack = streamRef.current?.getAudioTracks()[0];
    if (!audioTrack) {
      setMicEnabled((enabled) => !enabled);
      return;
    }
    audioTrack.enabled = !audioTrack.enabled;
    setMicEnabled(audioTrack.enabled);
  }

  function handleDriveUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const items = files.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Date.now()}`,
      name: file.name,
      type: file.type || 'document',
      size: file.size,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
    setDriveItems((current) => [...items, ...current]);
    event.target.value = '';
    files.forEach((file) => sendFileAsSpecialMessage(file));
  }

  function formatFileSize(size = 0) {
    if (size > 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    if (size > 1024) return `${Math.round(size / 1024)} KB`;
    return `${size} B`;
  }

  function sendFileAsSpecialMessage(file) {
    const url = URL.createObjectURL(file);
    const fileType = file.type || 'file';
    if (fileType.startsWith('image/')) {
      if (imageSendMode === 'Send as document') {
        addEncryptedMessage(`Vault Document: ${file.name} · image document`, 'outgoing', {
          attachmentType: 'document',
          attachmentData: {
            title: file.name,
            url,
            fileType: 'image document',
            size: formatFileSize(file.size),
          },
        });
        return;
      }
      addEncryptedMessage(`Image: ${file.name} · ${imageSendMode}`, 'outgoing', {
        attachmentType: 'image',
        attachmentData: {
          title: file.name,
          url,
          mode: imageSendMode,
          quality: imageSendMode,
          size: formatFileSize(file.size),
        },
      });
      return;
    }
    if (fileType.startsWith('audio/')) {
      addEncryptedMessage(`Music / Audio Note: ${file.name}`, 'outgoing', {
        attachmentType: 'audio',
        attachmentData: {
          title: file.name,
          url,
          fileType,
          size: formatFileSize(file.size),
        },
      });
      return;
    }
    addEncryptedMessage(`Vault Document: ${file.name}`, 'outgoing', {
      attachmentType: 'document',
      attachmentData: {
        title: file.name,
        url,
        fileType,
        size: formatFileSize(file.size),
      },
    });
  }

  function openAttachmentPicker(accept = '') {
    setAttachmentAccept(accept);
    setAttachMenuOpen(false);
    setAttachMiniWindow('');
    window.setTimeout(() => attachmentInputRef.current?.click(), 40);
  }

  function handleAttachmentAction(action) {
    if (action === 'document') return openAttachmentPicker('.pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx');
    if (action === 'gallery') {
      setAttachMenuOpen(false);
      setAttachMiniWindow('imageMode');
      return undefined;
    }
    if (action === 'camera') {
      setAttachMenuOpen(false);
      setAttachMiniWindow('cameraClip');
      return undefined;
    }
    if (action === 'audio') return openAttachmentPicker('audio/*');
    if (action === 'contact') {
      setAttachMenuOpen(false);
      setSelectedShareContactId(selectedChatId || contacts[0]?.id || '');
      setAttachMiniWindow('contact');
      return undefined;
    }
    if (action === 'poll') {
      setAttachMenuOpen(false);
      setAttachMiniWindow('poll');
      return undefined;
    } else if (action === 'event') {
      setAttachMenuOpen(false);
      setAttachMiniWindow('event');
      return undefined;
    } else if (action === 'sticker') {
      setAttachMenuOpen(false);
      setAttachMiniWindow('sticker');
      return undefined;
    }
    setAttachMenuOpen(false);
    return undefined;
  }

  function shareSignovaContact(event) {
    event.preventDefault();
    const contact = contacts.find((item) => item.id === selectedShareContactId) || selectedChatContact || contacts[0];
    if (!contact) return;
    addEncryptedMessage(`Signova Contact: ${contact.name} · ${contact.username}${contact.number ? ` · ${contact.number}` : ''}`, 'outgoing', {
      attachmentType: 'contact',
      attachmentData: {
        title: contact.name,
        username: contact.username,
        number: contact.number,
        note: 'Shared Signova identity card for secure contact exchange.',
      },
    });
    setAttachMiniWindow('');
    setStatus('Signova contact shared');
  }

  function createPulsePoll(event) {
    event.preventDefault();
    const question = pollForm.question.trim();
    const options = pollForm.options.map((option) => option.trim()).filter(Boolean);
    if (!question || options.length < 2) return;
    addEncryptedMessage(`Audience Poll: ${question} · ${options.map((option, index) => `${index + 1}. ${option}`).join(' · ')}`, 'outgoing', {
      attachmentType: 'poll',
      attachmentData: {
        title: question,
        options,
        votes: options.map(() => 0),
        selectedOption: null,
        note: 'Collect quick replies from this conversation.',
      },
    });
    setPollForm({ question: '', options: ['Yes', 'No'] });
    setAttachMiniWindow('');
    setStatus('Audience poll shared');
  }

  function createMeetMoment(event) {
    event.preventDefault();
    const title = meetForm.title.trim() || 'Signova Meet Moment';
    if (!meetForm.date || !meetForm.time) return;
    addEncryptedMessage(`Meet Moment: ${title} · ${meetForm.date} ${meetForm.time} · Reminder ${meetForm.reminder}`, 'outgoing', {
      attachmentType: 'meet',
      attachmentData: {
        title,
        date: meetForm.date,
        time: meetForm.time,
        reminder: meetForm.reminder,
        note: 'Important event shared with reminder context.',
      },
    });
    setMeetForm({ title: '', date: '', time: '', reminder: '15 min before' });
    setAttachMiniWindow('');
    setStatus('Meet moment saved to chat');
  }

  function sendGestureSticker(sticker) {
    const stickerLabel = typeof sticker === 'string' ? sticker : sticker.label;
    const stickerEmoji = typeof sticker === 'string' ? '🤟' : sticker.emoji;
    addEncryptedMessage(`Gesture Sticker: ${stickerEmoji} ${stickerLabel}`, 'outgoing', {
      attachmentType: 'sticker',
      attachmentData: {
        title: `${stickerEmoji} ${stickerLabel}`,
        note: typeof sticker === 'string' ? 'Gesture sticker shared from Signova Attach.' : sticker.note,
      },
    });
    setAttachMiniWindow('');
    setStatus('Gesture sticker sent');
  }

  function voteAudiencePoll(message, optionIndex) {
    setMessages((items) => items.map((item) => {
      if (item.id !== message.id) return item;
      const options = item.attachmentData?.options || [];
      const votes = [...(item.attachmentData?.votes || options.map(() => 0))];
      const previous = item.attachmentData?.selectedOption;
      if (Number.isInteger(previous) && votes[previous] > 0) votes[previous] -= 1;
      votes[optionIndex] = (votes[optionIndex] || 0) + 1;
      return {
        ...item,
        attachmentData: {
          ...item.attachmentData,
          votes,
          selectedOption: optionIndex,
        },
      };
    }));
    setStatus('Audience poll response saved');
  }

  function editMeetMoment(message) {
    const current = message.attachmentData || {};
    const nextTitle = window.prompt('Edit meet title', current.title || 'Signova Meet Moment');
    if (!nextTitle?.trim()) return;
    setMessages((items) => items.map((item) => (
      item.id === message.id
        ? {
          ...item,
          text: `Meet Moment: ${nextTitle.trim()} · ${current.date} ${current.time} · Reminder ${current.reminder}`,
          attachmentData: { ...item.attachmentData, title: nextTitle.trim() },
          edited: true,
        }
        : item
    )));
    setStatus('Meet moment edited');
  }

  function saveMeetDetail(message, target) {
    const labels = {
      notes: 'saved to notes',
      reminder: 'added to reminders',
      calendar: 'added to calendar',
      alarm: 'added to alarms',
    };
    setMessages((items) => items.map((item) => (
      item.id === message.id
        ? {
          ...item,
          attachmentData: {
            ...item.attachmentData,
            savedTargets: Array.from(new Set([...(item.attachmentData?.savedTargets || []), target])),
          },
        }
        : item
    )));
    setStatus(`Meet moment ${labels[target] || 'saved'}`);
  }

  function updateAudioPlaybackRate(messageId, rate) {
    let nextRate = rate;
    if (rate === 'custom') {
      const customValue = window.prompt('Audio speed: enter 0.5 to 3', String(audioPlaybackRates[messageId] || 1));
      if (!customValue) return;
      nextRate = Number(customValue);
    }
    const normalizedRate = Math.min(3, Math.max(0.5, Number(nextRate) || 1));
    setAudioPlaybackRates((rates) => ({ ...rates, [messageId]: normalizedRate }));
    setStatus(`Audio speed set to ${normalizedRate}x`);
  }

  function sendCameraClip() {
    addEncryptedMessage(`Live Camera Clip: ${cameraClipFacing}`, 'outgoing', {
      attachmentType: 'cameraClip',
      attachmentData: {
        title: 'Live camera clip',
        camera: cameraClipFacing,
        note: 'Snap-style clip captured from Signova camera.',
      },
    });
    setAttachMiniWindow('');
    setStatus('Live camera clip shared');
  }

  function addSharedContact(message) {
    const data = message.attachmentData || {};
    const phone = normalizePhoneNumber(data.countryCode || '+91', data.nationalNumber || data.number || '');
    setContactForm({
      name: data.title || '',
      countryCode: phone.countryCode,
      number: phone.nationalNumber,
      username: data.username || '',
      avatarChoice: 'signova',
      showUsername: true,
      showNumber: Boolean(phone.fullNumber || data.number),
    });
    setContactFormError('');
    setContactModalOpen(true);
    setStatus('Shared contact opened for adding');
  }

  function editSharedContact(message) {
    const currentName = message.attachmentData?.title || '';
    const nextName = window.prompt('Edit shared contact name', currentName);
    if (!nextName?.trim()) return;
    setMessages((items) => items.map((item) => (
      item.id === message.id
        ? {
          ...item,
          text: `Signova Contact: ${nextName.trim()} · ${item.attachmentData?.username || ''}${item.attachmentData?.number ? ` · ${item.attachmentData.number}` : ''}`,
          attachmentData: { ...item.attachmentData, title: nextName.trim() },
          edited: true,
        }
        : item
    )));
    setStatus('Shared contact edited');
  }

  async function addContact(event) {
    event.preventDefault();
    const name = contactForm.name.trim();
    const usernameCheck = validateUsername(contactForm.username);
    const phone = normalizePhoneNumber(contactForm.countryCode, contactForm.number);
    if (!name) {
      setContactFormError('Contact name required hai.');
      return;
    }
    if (!usernameCheck.valid) {
      setContactFormError(usernameCheck.error);
      return;
    }
    if (!phone.valid) {
      setContactFormError(phone.error);
      return;
    }
    const alreadyExists = contacts.some((contact) => contact.username === usernameCheck.username);
    if (alreadyExists) {
      setContactFormError('Ye username already contact list me hai.');
      return;
    }
    const id = `${usernameCheck.username.replace('@', 'user-')}-${Date.now()}`;
    const nextContact = normalizeContactRecord({
      id,
      name,
      countryCode: phone.countryCode,
      country: phone.country,
      nationalNumber: phone.nationalNumber,
      number: phone.fullNumber,
      username: usernameCheck.username,
      avatarChoice: contactForm.avatarChoice,
      showUsername: contactForm.showUsername,
      showNumber: contactForm.showNumber && Boolean(phone.fullNumber),
      createdAt: Date.now(),
    });
    setContacts((items) => [nextContact, ...items]);
    await saveUserDoc('contacts', nextContact).catch(() => {});
    setSelectedChatId(id);
    setContactForm(EMPTY_CONTACT_FORM);
    setContactFormError('');
    setContactModalOpen(false);
    setStatus(databaseStatus.mode === 'firestore' ? 'Contact saved to database' : 'Contact saved locally');
  }

  function showChatMenu(event, contactId) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 198;
    const menuHeight = 456;
    const margin = 10;
    const preferredX = event.clientX || rect.right - 8;
    const preferredY = event.clientY || rect.top + 8;
    setChatMenu({
      visible: true,
      contactId,
      x: Math.max(margin, Math.min(preferredX, window.innerWidth - menuWidth - margin)),
      y: Math.max(margin, Math.min(preferredY, window.innerHeight - menuHeight - margin)),
    });
  }

  function showChatSidebarMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = Math.min(232, window.innerWidth - 24);
    const menuHeight = 300;
    const margin = 12;
    const x = Math.max(
      margin,
      Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - margin),
    );
    const below = rect.bottom + 8;
    const y = below + menuHeight <= window.innerHeight - margin
      ? below
      : Math.max(margin, rect.top - menuHeight - 8);
    setChatSidebarMenu((menu) => ({
      visible: !menu.visible,
      x,
      y,
    }));
  }

  function toggleHeaderMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    setChatHeaderMenuOpen((open) => !open);
  }

  function saveCustomChatCategory(event) {
    event?.preventDefault();
    const cleanName = categoryDraft.trim();
    if (!cleanName) return;
    const id = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `category-${Date.now()}`;
    setCustomChatCategories((items) => (
      items.some((item) => item.id === id)
        ? items
        : [...items, { id, label: cleanName }]
    ));
    setChatFilter(`custom:${id}`);
    setCategoryDraft('');
    setCategoryComposerOpen(false);
    setStatus(`Category added: ${cleanName}`);
  }

  function openCategoryComposer() {
    setCategoryComposerOpen(true);
    window.setTimeout(() => document.querySelector('.categoryComposerCard input')?.focus(), 80);
  }

  function startChatLongPress(event, contactId) {
    if (event.pointerType === 'mouse') return;
    window.clearTimeout(chatLongPressRef.current);
    chatLongPressRef.current = window.setTimeout(() => showChatMenu(event, contactId), 720);
  }

  function clearChatLongPress() {
    window.clearTimeout(chatLongPressRef.current);
    chatLongPressRef.current = null;
  }

  function openPasswordModal(contactId, mode = 'create') {
    if (!contactId) return;
    const flags = chatFlags[contactId] || {};
    setPasswordModal({
      open: true,
      contactId,
      mode,
      value: '',
      error: '',
      methods: {
        face: flags.lockMethods?.face ?? true,
        fingerprint: flags.lockMethods?.fingerprint ?? true,
        pin: flags.lockMethods?.pin ?? true,
      },
    });
    window.setTimeout(() => document.querySelector('.passwordMiniModal input')?.focus(), 80);
  }

  async function submitPasswordModal(event) {
    event.preventDefault();
    const contactId = passwordModal.contactId;
    const password = passwordModal.value.trim();
    if (!contactId) return;
    if (!password) {
      setPasswordModal((modal) => ({ ...modal, error: 'Password required' }));
      return;
    }
    const flags = chatFlags[contactId] || {};
    if (passwordModal.mode === 'unlock') {
      const salt = flags.passwordSalt || contactId;
      const passwordHash = await hashChatSecret(password, salt);
      const validLegacyPassword = flags.password && password === flags.password;
      if (flags.passwordSet && !validLegacyPassword && passwordHash !== flags.passwordHash) {
        setPasswordModal((modal) => ({ ...modal, error: 'Wrong password' }));
        setStatus('Wrong chat password');
        return;
      }
      setChatFlags((current) => ({
        ...current,
        [contactId]: (() => {
          const { password: _legacyPassword, ...existingFlags } = current[contactId] || {};
          return {
            ...existingFlags,
            ...(validLegacyPassword ? { passwordHash, passwordSalt: salt } : {}),
            locked: false,
          };
        })(),
      }));
      setStatus('Chat unlocked');
    } else {
      const passwordSalt = `${contactId}-${window.crypto?.randomUUID?.() || Date.now()}`;
      const passwordHash = await hashChatSecret(password, passwordSalt);
      setChatFlags((current) => ({
        ...current,
        [contactId]: (() => {
          const { password: _legacyPassword, ...existingFlags } = current[contactId] || {};
          return {
            ...existingFlags,
            passwordHash,
            passwordSalt,
            lockMethods: passwordModal.methods,
            passwordSet: true,
            locked: true,
          };
        })(),
      }));
      setStatus(flags.passwordSet ? 'Chat password updated' : 'Password added and chat locked');
    }
    setPasswordModal({ open: false, contactId: null, mode: 'create', value: '', error: '', methods: { face: true, fingerprint: true, pin: true } });
  }

  function applyContactChatAction(contactId, action) {
    if (!contactId) return false;
    if (action === 'delete') {
      setContacts((items) => items.filter((item) => item.id !== contactId));
      deleteUserDoc('contacts', contactId).catch(() => {});
      setSelectedChatId((current) => (current === contactId ? null : current));
      setStatus('Chat deleted');
      return true;
    }
    if (action === 'clear') {
      setMessages((items) => items.filter((item) => item.id === 'welcome'));
      setStatus('Chat cleared locally');
      return true;
    }
    if (action === 'list') {
      const name = window.prompt('Add chat to list/category');
      const cleanName = name?.trim();
      if (!cleanName) return false;
      const id = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `category-${Date.now()}`;
      setCustomChatCategories((items) => (
        items.some((item) => item.id === id)
          ? items
          : [...items, { id, label: cleanName }]
      ));
      setChatFlags((current) => ({
        ...current,
        [contactId]: {
          ...(current[contactId] || {}),
          category: id,
        },
      }));
      setChatFilter(`custom:${id}`);
      setStatus(`Chat added to ${cleanName}`);
      return true;
    }
    if (action === 'password') {
      openPasswordModal(contactId, 'create');
      return true;
    }
    if (action === 'locked') {
      openPasswordModal(contactId, chatFlags[contactId]?.locked ? 'unlock' : 'create');
      return true;
    }

    const labels = {
      muted: 'Notifications muted',
      pinned: chatFlags[contactId]?.pinned ? 'Chat unpinned' : 'Chat pinned',
      hidden: chatFlags[contactId]?.hidden ? 'Chat unhidden' : 'Chat hidden',
      archived: 'Chat archived',
      starred: chatFlags[contactId]?.starred ? 'Star removed' : 'Message starred',
      unread: 'Marked as unread',
      favourite: 'Added to favourites',
      blocked: 'Chat blocked',
    };
    setChatFlags((current) => ({
      ...current,
      [contactId]: {
        ...(current[contactId] || {}),
        [action]: !(current[contactId]?.[action]),
      },
    }));
    setStatus(labels[action] || 'Chat updated');
    return true;
  }

  function handleChatAction(action) {
    const contactId = chatMenu.contactId;
    if (!contactId) return;
    const changed = applyContactChatAction(contactId, action);
    if (changed) setChatMenu({ visible: false, contactId: null, x: 0, y: 0 });
  }

  function handleHeaderChatAction(action) {
    const contactId = selectedChatId || contacts[0]?.id;
    if (!contactId) return;
    if (action === 'video-call') {
      startVideoSignChat(true);
    } else if (action === 'voice-call') {
      startVoiceSignChat(true);
    } else if (action === 'info') {
      setContactInfoOpen(true);
    } else if (action === 'search') {
      setMessageSearchOpen(true);
      window.setTimeout(() => document.querySelector('.chatHeaderSearch input')?.focus(), 60);
    } else if (action === 'select') {
      setStatus('Select messages mode ready');
    } else if (action === 'disappearing') {
      setChatFlags((current) => ({
        ...current,
        [contactId]: {
          ...(current[contactId] || {}),
          disappearing: !(current[contactId]?.disappearing),
        },
      }));
      setStatus(chatFlags[contactId]?.disappearing ? 'Disappearing messages off' : 'Disappearing messages on');
    } else if (action === 'close') {
      setSelectedChatId(null);
    } else if (action === 'call-link' || action === 'video-link') {
      addEncryptedMessage(`Signova call link: signova://call/${contactId}`);
    } else if (action === 'share-contact') {
      setSelectedShareContactId(contactId);
      setAttachMiniWindow('contact');
    } else if (action === 'translate') {
      openPanel('translate');
    } else if (action === 'schedule-call') {
      setAttachMiniWindow('event');
    } else if (action === 'new-group-call') {
      handleSidebarChatAction('new-group');
    } else if (action === 'report') {
      setStatus('Report saved locally for review');
    } else {
      applyContactChatAction(contactId, action);
    }
    setChatHeaderMenuOpen(false);
  }

  function handleSidebarChatAction(action) {
    if (action === 'new-group') {
      setChatSidebarMenu({ visible: false, x: 0, y: 0 });
      setGroupCreationContext('chat');
      setGroupModalOpen(true);
      return;
    }

    const contactId = selectedChatId || visibleContacts[0]?.id || contacts[0]?.id;
    if (!contactId) {
      setStatus('No chat selected');
      setChatSidebarMenu({ visible: false, x: 0, y: 0 });
      return;
    }

    const changed = applyContactChatAction(contactId, action);
    if (changed) setChatSidebarMenu({ visible: false, x: 0, y: 0 });
  }

  function createSignovaGroup(event) {
    event.preventDefault();
    const cleanName = groupForm.name.trim();
    if (!cleanName) {
      setStatus('Group name required');
      return;
    }
    const groupId = `group-${Date.now()}`;
    const username = `@${cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'signova.group'}`;
    const members = groupForm.members.split(',').map((item) => item.trim()).filter(Boolean);
    if (groupCreationContext === 'community') {
      const communityRecord = {
        id: `community-${groupId}`,
        name: cleanName,
        username,
        latest: groupForm.description || `${groupForm.purpose} community ready`,
        members: `${Math.max(1, members.length + 1)} members`,
        memberCount: Math.max(1, members.length + 1),
        online: 1,
        language: settings.translation.language || 'ISL + English',
        level: settings.practice.difficulty === 'advanced' ? 'Advanced practice' : settings.practice.difficulty === 'intermediate' ? 'Intermediate friendly' : 'Beginner friendly',
        focus: groupForm.purpose,
        privacy: groupForm.privacy,
        category: groupForm.category,
        allowMeetings: groupForm.allowMeetings,
        enableAudiencePolls: groupForm.enableAudiencePolls,
        enableMediaDrive: groupForm.enableMediaDrive,
        adminApproval: groupForm.adminApproval,
        postingPermission: groupForm.postingPermission,
        memberListVisibility: groupForm.memberListVisibility,
        notifications: groupForm.notifications,
        autoCaptions: groupForm.autoCaptions,
        encryptedRequired: groupForm.encryptedRequired,
        membersList: members,
        owner: settings.account.username || '@signova.user',
        createdAt: Date.now(),
      };
      setCommunityGroupRecords((items) => [communityRecord, ...items]);
      setSelectedCommunityGroupId(communityRecord.id);
      if (window.crypto?.subtle) {
        createChatKey().then((key) => communityGroupKeysRef.current.set(communityRecord.id, key)).catch(() => {});
      }
      setGroupModalOpen(false);
      setGroupForm(EMPTY_GROUP_FORM);
      setCommunityGroupToolOpen('group-created');
      setStatus(`Community group created: ${cleanName}`);
      return;
    }
    setContacts((items) => [{
      id: groupId,
      name: cleanName,
      number: 'Signova Group',
      username,
      avatarChoice: 'signova',
      showUsername: true,
      showNumber: false,
    }, ...items]);
    setChatFlags((current) => ({
      ...current,
      [groupId]: {
        ...(current[groupId] || {}),
        group: true,
        pinned: true,
        category: groupForm.category,
        purpose: groupForm.purpose,
        description: groupForm.description,
        privacy: groupForm.privacy,
        members,
        allowMeetings: groupForm.allowMeetings,
        enableAudiencePolls: groupForm.enableAudiencePolls,
        enableMediaDrive: groupForm.enableMediaDrive,
        adminApproval: groupForm.adminApproval,
      },
    }));
    setChatFilter('groups');
    setSelectedChatId(groupId);
    setSelectedCommunityGroupId(groupId);
    setGroupModalOpen(false);
    setGroupForm(EMPTY_GROUP_FORM);
    if (activePanel === 'communityGroups') setCommunityGroupToolOpen('group-created');
    setStatus(`New ${groupForm.purpose} group created: ${cleanName}`);
  }

  async function postCommunityGroupNote(event) {
    event?.preventDefault?.();
    const text = communityGroupDraft.trim();
    if (!text || !selectedCommunityGroup?.id) return;
    let key = communityGroupKeysRef.current.get(selectedCommunityGroup.id);
    if (!key && window.crypto?.subtle) {
      key = await createChatKey();
      communityGroupKeysRef.current.set(selectedCommunityGroup.id, key);
    }
    const encryptedPayload = key ? await encryptMessage(key, text) : null;
    setCommunityGroupPosts((posts) => [{
      id: `group-note-${Date.now()}`,
      groupId: selectedCommunityGroup.id,
      text,
      encrypted: Boolean(encryptedPayload),
      encryptedPayload,
      author: settings.account.name || 'Signova member',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }, ...posts]);
    setCommunityGroupDraft('');
    setStatus('Group note posted.');
  }

  async function toggleCommunityGroupVoice() {
    if (communityGroupVoice.active) {
      communityGroupRecorderRef.current?.stop?.();
      communityGroupVoiceStreamRef.current?.getTracks?.().forEach((track) => track.stop());
      communityGroupRecorderRef.current = null;
      communityGroupVoiceStreamRef.current = null;
      setCommunityGroupVoice({ active: false, seconds: 0 });
      return;
    }
    if (!selectedCommunityGroup || !navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      setStatus('Voice messages are not available on this device.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];
      const startedAt = Date.now();
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        const duration = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
        const audioUrl = chunks.length ? URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' })) : '';
        let key = communityGroupKeysRef.current.get(selectedCommunityGroup.id);
        if (!key && window.crypto?.subtle) {
          key = await createChatKey();
          communityGroupKeysRef.current.set(selectedCommunityGroup.id, key);
        }
        const label = `Voice message · ${formatVoiceTime(duration)}`;
        const encryptedPayload = key ? await encryptMessage(key, label) : null;
        setCommunityGroupPosts((posts) => [{
          id: `group-voice-${Date.now()}`,
          groupId: selectedCommunityGroup.id,
          text: label,
          audioUrl,
          encrypted: Boolean(encryptedPayload),
          encryptedPayload,
          author: settings.account.name || 'Signova member',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }, ...posts]);
        setStatus('Local community voice preview added. It is not uploaded or end-to-end encrypted.');
      };
      recorder.start();
      communityGroupRecorderRef.current = recorder;
      communityGroupVoiceStreamRef.current = stream;
      setCommunityGroupVoice({ active: true, seconds: 0 });
      setCommunityGroupEmojiOpen(false);
    } catch {
      setStatus('Microphone permission is required for a voice message.');
    }
  }

  function handleCommunityGroupChatAction(action) {
    if (!selectedCommunityGroup?.id || selectedCommunityGroup.id.startsWith('template-group-')) {
      setStatus('Create or select your own community group to use this action.');
      return;
    }
    if (action === 'clear') {
      setCommunityGroupPosts((posts) => posts.filter((post) => post.groupId !== selectedCommunityGroup.id));
      setStatus('Community group conversation cleared.');
    } else if (action === 'archive') {
      setCommunityGroupRecords((groups) => groups.map((group) => group.id === selectedCommunityGroup.id ? { ...group, archived: true } : group));
      setSelectedCommunityGroupId('');
      setStatus('Community group archived.');
    } else if (action === 'delete') {
      setCommunityGroupRecords((groups) => groups.filter((group) => group.id !== selectedCommunityGroup.id));
      setCommunityGroupPosts((posts) => posts.filter((post) => post.groupId !== selectedCommunityGroup.id));
      communityGroupKeysRef.current.delete(selectedCommunityGroup.id);
      setSelectedCommunityGroupId('');
      setStatus('Community group deleted from this device.');
    } else if (action === 'block') {
      setCommunityGroupRecords((groups) => groups.map((group) => group.id === selectedCommunityGroup.id ? { ...group, blocked: true } : group));
      setSelectedCommunityGroupId('');
      setStatus('Community group blocked.');
    } else if (action === 'categorize') {
      setCommunityGroupCategoryComposerOpen(true);
      setStatus('Create a category to add this group to another community collection.');
    }
    setCommunityGroupToolOpen('');
  }

  function createCommunityGroupCategory(event) {
    event?.preventDefault?.();
    const label = communityGroupCategoryDraft.trim().slice(0, 24);
    if (!label) return;
    setCommunityGroupCategories((items) => (
      items.some((item) => item.toLowerCase() === label.toLowerCase()) ? items : [...items, label]
    ));
    if (selectedCommunityGroup?.id && !selectedCommunityGroup.id.startsWith('template-group-')) {
      setCommunityGroupRecords((groups) => groups.map((group) => (
        group.id === selectedCommunityGroup.id ? { ...group, category: label } : group
      )));
    }
    setCommunityGroupCategory(`category:${label.toLowerCase()}`);
    setCommunityGroupCategoryDraft('');
    setCommunityGroupCategoryComposerOpen(false);
    setStatus(`${label} group category created.`);
  }

  function unlockSelectedChat() {
    if (!selectedChatId) return;
    openPasswordModal(selectedChatId, 'unlock');
  }

  async function publishCommunityPost() {
    const text = communityDraft.trim();
    if (!text && !communityComposerMedia) return;
    const payload = buildCommunityPostPayload({
      text,
      media: communityComposerMedia,
      profile: communityProfile,
      initials: communityAvatarInitials,
      difficulty: settings.practice.difficulty,
      isPremium: isSignovaProActive,
      user: authenticatedFirebaseUser,
    });
    if (firestoreDb && authenticatedFirebaseUser?.uid && authenticatedFirebaseUser.emailVerified) {
      await addDoc(collection(firestoreDb, PUBLIC_COMMUNITY_POSTS_COLLECTION), payload).catch(() => {
        setCommunityPosts((posts) => [{ id: `post-${Date.now()}`, ...payload, time: 'Just now' }, ...posts]);
        setStatus('Post saved locally. Firestore publish failed, so it is visible only on this device.');
      });
    } else {
      setCommunityPosts((posts) => [{ id: `post-${Date.now()}`, ...payload, time: 'Just now' }, ...posts]);
      setStatus('Login with verified email to publish live community posts. Saved locally for now.');
    }
    setCommunityDraft('');
    setCommunityComposerMedia(null);
    if (firestoreDb && authenticatedFirebaseUser?.uid && authenticatedFirebaseUser.emailVerified) {
      setStatus(communityComposerMedia?.url?.startsWith('blob:')
        ? 'Community post published. Media upload is local-preview for now; Storage upload can be added next.'
        : 'Community post published live.');
    }
  }

  function addCommunityComposerMedia(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setStatus('Please choose an image or video file for the community post.');
      event.target.value = '';
      return;
    }
    setCommunityComposerMedia({
      name: file.name,
      type: isVideo ? 'video' : 'image',
      url: URL.createObjectURL(file),
    });
    setStatus(`${isVideo ? 'Video' : 'Image'} attached to your community post.`);
    event.target.value = '';
  }

  async function toggleCommunityPostLike(postId) {
    const targetPost = communityPosts.find((post) => post.id === postId);
    const wasLiked = communityLikedPostIds.includes(postId) || Boolean(targetPost?.liked);
    const nextLikedIds = wasLiked
      ? communityLikedPostIds.filter((id) => id !== postId)
      : [...new Set([...communityLikedPostIds, postId])];
    setCommunityLikedPostIds(nextLikedIds);
    setCommunityPosts((posts) => posts.map((post) => (
      post.id === postId
        ? { ...post, liked: !wasLiked, stats: { ...post.stats, likes: Math.max(0, post.stats.likes + (wasLiked ? -1 : 1)) } }
        : post
    )));
    if (!firestoreDb || !authenticatedFirebaseUser?.uid || !authenticatedFirebaseUser.emailVerified) return;
    await fetchJson('/api/community/posts/action', {
      method: 'POST',
      body: JSON.stringify({ postId, action: 'toggle-like' }),
    }).catch(() => {
      setStatus('Like saved locally. Live sync failed.');
    });
  }

  async function shareCommunityPost(postId) {
    setCommunityPosts((posts) => posts.map((post) => (
      post.id === postId ? { ...post, stats: { ...post.stats, shares: post.stats.shares + 1 } } : post
    )));
    if (authenticatedFirebaseUser?.uid && authenticatedFirebaseUser.emailVerified) {
      await fetchJson('/api/community/posts/action', {
        method: 'POST',
        body: JSON.stringify({ postId, action: 'share' }),
      }).catch(() => {});
    }
    setStatus('Sign post shared.');
  }

  async function openCommunityPostComments(post) {
    setStatus(`Comments opened for ${post.sign}.`);
  }

  function downloadCommunityPost(post) {
    if (!post?.mediaUrl) {
      setStatus('This post has no downloadable media.');
      return;
    }
    const link = document.createElement('a');
    link.href = post.mediaUrl;
    link.download = `${post.sign || 'signova-community-post'}.${post.mediaType === 'video' ? 'mp4' : 'jpg'}`;
    link.rel = 'noopener';
    link.click();
    setCommunityPostMenu({ postId: '', reportOpen: false });
    setStatus(`${post.sign} download started.`);
  }

  function handleCommunityPostReport(post, action) {
    if (action === 'remove' || action === 'not-interested') {
      setCommunityPosts((posts) => posts.filter((item) => item.id !== post.id));
    }
    setCommunityPostMenu({ postId: '', reportOpen: false });
    setStatus(action === 'remove' ? 'Content removed from your feed.' : 'You will see fewer posts like this.');
  }

  function toggleCommunityCreatorFollow(postId) {
    setCommunityPosts((posts) => posts.map((post) => (post.id === postId ? { ...post, following: !post.following } : post)));
  }

  function createCommunitySign(event, action = 'publish') {
    event?.preventDefault?.();
    const title = communitySignForm.title.trim();
    const meaning = communitySignForm.meaning.trim();
    const steps = communitySignForm.steps.trim();
    if (!title || !meaning || !steps) {
      setStatus('Add sign title, meaning, and detailed description before publishing.');
      return;
    }
    const stage = communitySignForm.type;
    const callReady = stage === 'sentence';
    const buildFrom = communitySignForm.buildFrom.trim();

    const newSign = {
      id: `community-sign-${Date.now()}`,
      title,
      type: stage,
      stage,
      callReady,
      language: communitySignForm.language,
      meaning,
      steps,
      buildFrom,
      category: communitySignForm.category,
      difficulty: communitySignForm.difficulty,
      handShape: communitySignForm.handShape,
      motion: communitySignForm.motion,
      facialExpression: communitySignForm.facialExpression,
      bodyPosition: communitySignForm.bodyPosition,
      usageNotes: communitySignForm.usageNotes,
      commonMistakes: communitySignForm.commonMistakes,
      exampleSentence: communitySignForm.exampleSentence,
      creator: communityProfile.name || 'Signova Creator',
      creatorUsername: communityProfile.username || '@signova.creator',
      videoUrl: communitySignForm.videoUrl,
      imageUrls: communitySignForm.imageUrls,
      visibility: communitySignForm.visibility.toLowerCase(),
      trainingConsent: communitySignForm.allowAiTraining,
      verificationStatus: 'Verified Creator',
      level: settings.practice.difficulty === 'advanced' ? 'Advanced' : settings.practice.difficulty === 'intermediate' ? 'Intermediate' : 'Beginner',
      uses: 1,
    };
    if (communitySignForm.visibility !== 'Private' && communitySignForm.publishCommunity && action !== 'library') {
      setCommunitySigns((items) => [newSign, ...items]);
    }
    if (communitySignForm.addToLibrary || action === 'library') {
      setSignLibrary((items) => [{
        label: title.toLowerCase().replace(/\s+/g, '_'),
        sign: title,
        phrase: meaning,
        hint: steps,
        language: communitySignForm.language,
        type: stage,
        stage,
        category: communitySignForm.category,
        difficulty: communitySignForm.difficulty,
        creator: communityProfile.username || '@signova.creator',
        videoUrl: communitySignForm.videoUrl,
        imageUrls: communitySignForm.imageUrls,
        description: steps,
        buildFrom,
        visibility: communitySignForm.visibility.toLowerCase(),
        trainingConsent: communitySignForm.allowAiTraining,
        verificationStatus: 'Verified Creator',
      }, ...items]);
    }
    setSavedLearningItems((items) => [
      {
        id: `community-${Date.now()}`,
        type: stage,
        value: meaning,
        labels: [title.toLowerCase().replace(/\s+/g, '_')],
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      ...items,
    ].slice(0, 24));
    setStatus(action === 'library'
      ? `${title} added to ${stage === 'letter' ? 'Letter Signs Book' : stage === 'word' ? 'Word Level Signs Book' : 'Sentence Level Signs Book'}.`
      : callReady ? 'Sentence-level community sign is ready for calls' : `${stage} saved for community learning. Create sentence level before using in calls.`);
    setCommunitySignDraftSaved(false);
    setActivePanel(action === 'library' ? 'library' : 'community');
  }

  function saveCommunitySignDraft() {
    setCommunitySignDraftSaved(true);
    setStatus('Community sign draft saved locally.');
  }

  function advanceCommunitySignPipeline(step) {
    const requirements = [
      communitySignForm.title.trim() && communitySignForm.meaning.trim(),
      communitySignForm.handShape && communitySignForm.motion && communitySignForm.steps.trim(),
      true,
    ];
    if (!requirements[step]) {
      setStatus(step === 0
        ? 'Add a title and meaning to unlock sign guidance.'
        : 'Choose a hand shape and motion, then add clear instructions.');
      return;
    }
    const nextStep = Math.min(step + 1, 3);
    setCommunitySignPipelineUnlocked((current) => Math.max(current, nextStep));
    setCommunitySignPipelineStep(nextStep);
  }

  function stopCommunityCapture() {
    if (communityCaptureTimerRef.current) {
      window.clearInterval(communityCaptureTimerRef.current);
      communityCaptureTimerRef.current = null;
    }
    if (communityCaptureRecorderRef.current?.state === 'recording') {
      communityCaptureRecorderRef.current.stop();
    }
    communityCaptureStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    communityCaptureStreamRef.current = null;
    communityCaptureRecorderRef.current = null;
    setCommunityCaptureRecording(false);
    setCommunityCaptureSeconds(0);
    setCommunityCaptureOpen(false);
  }

  async function inspectCommunityImage(blob) {
    const bitmap = await createImageBitmap(blob);
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    const sampleWidth = Math.min(160, bitmap.width);
    const sampleHeight = Math.max(1, Math.round(sampleWidth * (bitmap.height / bitmap.width)));
    const canvas = document.createElement('canvas');
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, sampleWidth, sampleHeight);
    const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    let luminanceTotal = 0;
    let luminanceSquared = 0;
    for (let index = 0; index < pixels.length; index += 16) {
      const luminance = (pixels[index] * 0.2126) + (pixels[index + 1] * 0.7152) + (pixels[index + 2] * 0.0722);
      luminanceTotal += luminance;
      luminanceSquared += luminance * luminance;
    }
    bitmap.close?.();
    const samples = Math.max(1, pixels.length / 16);
    const brightness = luminanceTotal / samples;
    const contrast = Math.sqrt(Math.max(0, (luminanceSquared / samples) - (brightness * brightness)));
    const checks = [
      { label: `${sourceWidth}×${sourceHeight} resolution`, pass: sourceWidth >= 640 && sourceHeight >= 480 },
      { label: brightness < 45 ? 'Scene is too dark' : brightness > 225 ? 'Scene is overexposed' : 'Lighting is usable', pass: brightness >= 45 && brightness <= 225 },
      { label: contrast < 18 ? 'Hands may blend into the background' : 'Hand/background contrast is usable', pass: contrast >= 18 },
    ];
    return { status: checks.every((check) => check.pass) ? 'ready' : 'review', title: checks.every((check) => check.pass) ? 'Training-quality frame' : 'Capture needs improvement', checks };
  }

  function inspectCommunityVideo(file) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        const checks = [
          { label: `${video.videoWidth}×${video.videoHeight} resolution`, pass: video.videoWidth >= 640 && video.videoHeight >= 480 },
          { label: `${Math.ceil(video.duration)}s duration`, pass: video.duration > 0 && video.duration <= 15.2 },
          { label: 'Supported video format', pass: video.canPlayType(file.type || 'video/webm') !== '' },
        ];
        URL.revokeObjectURL(url);
        resolve({
          accepted: checks[1].pass,
          quality: {
            status: checks.every((check) => check.pass) ? 'ready' : 'review',
            title: checks.every((check) => check.pass) ? 'Training-quality clip' : 'Video needs improvement',
            checks,
          },
        });
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ accepted: false, quality: { status: 'review', title: 'Video could not be inspected', checks: [{ label: 'Use MP4 or WebM video', pass: false }] } });
      };
      video.src = url;
    });
  }

  async function handleCommunitySignMedia(event, kind) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (kind === 'video') {
      const result = await inspectCommunityVideo(files[0]);
      setCommunityMediaQuality(result.quality);
      if (!result.accepted) {
        setStatus('Video must be 15 seconds or shorter.');
        event.target.value = '';
        return;
      }
    } else {
      const quality = await inspectCommunityImage(files[0]);
      setCommunityMediaQuality(quality);
    }
    const urls = files.map((file) => URL.createObjectURL(file));
    setCommunitySignForm((form) => ({
      ...form,
      ...(kind === 'video' ? { videoUrl: urls[0] } : { imageUrls: [...form.imageUrls, ...urls].slice(0, 4) }),
    }));
  }

  async function openCommunityCapture(mode) {
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = window.isSecureContext
        ? 'Camera capture is not supported by this browser or device.'
        : 'Camera requires HTTPS or localhost. Open Signova from a secure address.';
      setCommunityCaptureError(message);
      setStatus(message);
      return;
    }
    stopCommunityCapture();
    setCommunityCaptureError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      communityCaptureStreamRef.current = stream;
      setCommunityCaptureMode(mode);
      setCommunityCaptureOpen(true);
    } catch (error) {
      const messages = {
        NotAllowedError: 'Camera permission was denied. Allow camera access in browser settings and try again.',
        NotFoundError: 'No camera was found on this device.',
        NotReadableError: 'Camera is already being used by another app.',
        OverconstrainedError: 'This camera does not support the requested capture settings.',
        SecurityError: 'Camera access is blocked by browser security settings.',
      };
      const message = messages[error?.name] || `Camera could not be opened${error?.message ? `: ${error.message}` : '.'}`;
      setCommunityCaptureError(message);
      setStatus(message);
    }
  }

  function captureCommunityPhoto() {
    const video = communityCaptureVideoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const quality = await inspectCommunityImage(blob);
      const url = URL.createObjectURL(blob);
      setCommunityMediaQuality(quality);
      setCommunitySignForm((form) => ({ ...form, imageUrls: [...form.imageUrls, url].slice(-4) }));
      setStatus(quality.status === 'ready' ? 'Photo captured and passed technical quality checks.' : 'Photo captured, but review the quality suggestions.');
    }, 'image/jpeg', 0.92);
  }

  function stopCommunityVideoRecording() {
    if (communityCaptureRecorderRef.current?.state === 'recording') communityCaptureRecorderRef.current.stop();
  }

  function recordCommunityVideo() {
    const stream = communityCaptureStreamRef.current;
    if (!stream || typeof MediaRecorder === 'undefined') {
      setStatus('Video recording is not supported on this device.');
      return;
    }
    const preferredType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
    communityCaptureChunksRef.current = [];
    communityCaptureRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => event.data.size && communityCaptureChunksRef.current.push(event.data);
    recorder.onstop = async () => {
      if (communityCaptureTimerRef.current) window.clearInterval(communityCaptureTimerRef.current);
      communityCaptureTimerRef.current = null;
      setCommunityCaptureRecording(false);
      const blob = new Blob(communityCaptureChunksRef.current, { type: recorder.mimeType || 'video/webm' });
      const result = await inspectCommunityVideo(blob);
      setCommunityMediaQuality(result.quality);
      if (result.accepted) {
        setCommunitySignForm((form) => ({ ...form, videoUrl: URL.createObjectURL(blob) }));
        setStatus('Video recorded and checked.');
      }
      setCommunityCaptureSeconds(0);
    };
    recorder.start(250);
    setCommunityCaptureRecording(true);
    setCommunityCaptureSeconds(0);
    communityCaptureTimerRef.current = window.setInterval(() => {
      setCommunityCaptureSeconds((seconds) => {
        if (seconds >= 14) {
          window.setTimeout(stopCommunityVideoRecording, 0);
          return 15;
        }
        return seconds + 1;
      });
    }, 1000);
  }

  function formatCallTimer(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  }

  function startVideoSignChat(stayInChat = false) {
    if (stayInChat === true && !desktopCallWindowMode && window.signovaDesktop?.openCallWindow) {
      startConversationLog('video-sign-chat');
      window.signovaDesktop.openCallWindow('video');
      return;
    }
    setCallExperience('videoSignChat');
    setChatCallScreen('video');
    setChatCallMinimized(false);
    setChatCallFocus('local');
    setChatCallHistoryOpen(false);
    setChatCallMoreOpen(false);
    setCameraEnabled(true);
    startCameraRef.current?.();
    startConversationLog('video-sign-chat');
    setSecureCallStatus('Video Sign Chat ready');
    setCallStatus('Video Sign Chat ringing · camera and sign language ready');
  }

  function startConversationInfoCall(contact, type = 'video') {
    if (!contact?.id) return;
    setSelectedChatId(contact.id);
    setSelectedConversationId(contact.id);
    setMobileChatListOpen(false);
    setActivePanel('chats');
    if (type === 'voice') {
      setCallExperience('voiceSignChat');
      setChatCallScreen('voice');
      setMicEnabled(true);
      updateSynapseEnabled(true);
      updateSettingAndTrack('translation', 'outputType', 'textVoice');
      startConversationLog('voice-sign-chat', contact.id);
    } else {
      setCallExperience('videoSignChat');
      setChatCallScreen('video');
      setCameraEnabled(true);
      startCameraRef.current?.();
      startConversationLog('video-sign-chat', contact.id);
    }
    setChatCallMinimized(false);
    setChatCallFocus('local');
    setCallStatus(`${type === 'voice' ? 'Voice' : 'Video'} Sign Chat started with ${contact.name}`);
  }

  function clearConversationHistory(contactId) {
    if (clearHistoryConfirmId !== contactId) {
      setClearHistoryConfirmId(contactId);
      setStatus('Press Clear history again to confirm.');
      return;
    }
    setCallHistory((items) => items.filter((item) => item.contactId !== contactId || item.status === 'active'));
    setClearHistoryConfirmId('');
    setStatus('Completed call history cleared.');
  }

  function startVoiceSignChat(stayInChat = false) {
    if (stayInChat === true && !desktopCallWindowMode && window.signovaDesktop?.openCallWindow) {
      startConversationLog('voice-sign-chat');
      window.signovaDesktop.openCallWindow('voice');
      return;
    }
    setCallExperience('voiceSignChat');
    setChatCallScreen('voice');
    setChatCallMinimized(false);
    setChatCallFocus('local');
    setChatCallHistoryOpen(false);
    setChatCallMoreOpen(false);
    setMicEnabled(true);
    updateSynapseEnabled(true);
    updateSettingAndTrack('translation', 'outputType', 'textVoice');
    startConversationLog('voice-sign-chat');
    setSecureCallStatus('Voice Sign Chat ready');
    setCallStatus('Voice Sign Chat ringing · live voice mail and voice-to-sign captions');
  }

  function attachRemoteCallVideo(node) {
    remoteVideoRef.current = node;
    if (node && remoteStreamRef.current && node.srcObject !== remoteStreamRef.current) {
      node.srcObject = remoteStreamRef.current;
      node.play?.().catch(() => {});
    }
  }

  function attachLocalTrackingVideo(node) {
    videoRef.current = node;
    if (node && streamRef.current && node.srcObject !== streamRef.current) {
      node.srcObject = streamRef.current;
      node.play?.().catch(() => {});
    }
  }

  function startChatCallMove(event) {
    if (!chatCallMinimized) return;
    if (event.target.closest('button, input, select, a')) return;
    event.preventDefault();
    event.stopPropagation();
    const card = event.currentTarget.closest('.minimizedUnifiedChatCallWindow');
    const rect = card?.getBoundingClientRect();
    chatCallDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      x: rect?.left ?? chatCallPosition.x,
      y: rect?.top ?? chatCallPosition.y,
    };

    function moveCallCard(moveEvent) {
      const drag = chatCallDragRef.current;
      if (!drag) return;
      const width = card?.offsetWidth || 390;
      const height = card?.offsetHeight || 94;
      setChatCallPosition({
        x: Math.max(8, Math.min(window.innerWidth - width - 8, drag.x + moveEvent.clientX - drag.startX)),
        y: Math.max(8, Math.min(window.innerHeight - height - 8, drag.y + moveEvent.clientY - drag.startY)),
      });
    }

    function stopCallCardMove() {
      chatCallDragRef.current = null;
      window.removeEventListener('pointermove', moveCallCard);
      window.removeEventListener('pointerup', stopCallCardMove);
      window.removeEventListener('pointercancel', stopCallCardMove);
    }

    window.addEventListener('pointermove', moveCallCard);
    window.addEventListener('pointerup', stopCallCardMove);
    window.addEventListener('pointercancel', stopCallCardMove);
  }

  function startMeetingMode(type = 'video') {
    if (type === 'voice') startVoiceSignChat(true);
    else startVideoSignChat(true);
    setCallExperience(type === 'voice' ? 'voiceMeeting' : 'videoMeeting');
    setSecureCallStatus(type === 'voice' ? 'Voice meeting room ready' : 'Video meeting room ready');
    setCallStatus(type === 'voice' ? 'Voice meeting ready · camera optional' : 'Video meeting ready · camera and signs active');
    if (type === 'voice') {
      setMicEnabled(true);
    }
  }

  function updateSetting(group, key, value) {
    setSettings((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [key]: value,
      },
    }));
    const readableKey = String(key).replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
    setStatus(`${readableKey} updated`);
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(SIGNOVA_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Keep the app usable if private browsing or storage limits block saving.
    }
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(profileQrPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 7,
      color: {
        dark: premiumDarkMode ? '#f5f2ea' : '#0f2540',
        light: premiumDarkMode ? '#121a1e' : '#ffffff',
      },
    })
      .then((url) => {
        if (!cancelled) setProfileQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setProfileQrDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [premiumDarkMode, profileQrPayload]);

  async function copyProfileShareLink() {
    try {
      await navigator.clipboard?.writeText(profileShareUrl);
      setProfileQrMessage('Profile link copied.');
      setStatus('Profile link copied.');
    } catch {
      setProfileQrMessage('Copy unavailable. Select and copy the link manually.');
    }
  }

  async function shareProfileQr() {
    const shareData = {
      title: `${settings.account.name} on Signova`,
      text: `Open ${settings.account.name}'s Signova public profile.`,
      url: profileShareUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        setProfileQrMessage('Profile share sheet opened.');
      } else {
        await copyProfileShareLink();
      }
    } catch (error) {
      if (error?.name !== 'AbortError') setProfileQrMessage('Share cancelled or unavailable.');
    }
  }

  function downloadProfileQr() {
    if (!profileQrDataUrl) return;
    const link = document.createElement('a');
    link.href = profileQrDataUrl;
    link.download = `${profileShareHandle}-signova-qr.png`;
    link.click();
    setProfileQrMessage('QR code downloaded.');
  }

  function openScannedProfile(value) {
    const cleanValue = String(value || '').trim();
    if (!cleanValue) {
      setProfileQrMessage('No QR profile data found.');
      return;
    }
    try {
      const parsed = JSON.parse(cleanValue);
      if (parsed?.type === 'signova.profile' && parsed.url) {
        setProfileQrMessage(`Profile found: ${parsed.username || parsed.name || 'Signova user'}`);
        window.location.hash = parsed.url.split('#')[1] ? `#${parsed.url.split('#')[1]}` : `#/profile/${encodeURIComponent(String(parsed.username || '').replace(/^@+/, ''))}`;
        openPanel('profile');
        return;
      }
    } catch {
      // Value may be a direct URL.
    }
    if (/^https?:\/\//i.test(cleanValue) || cleanValue.startsWith('#/profile/')) {
      setProfileQrMessage('Profile link scanned.');
      if (cleanValue.startsWith('#/profile/')) window.location.hash = cleanValue;
      else if (cleanValue.includes('#/profile/')) window.location.hash = cleanValue.slice(cleanValue.indexOf('#/profile/'));
      openPanel('profile');
      return;
    }
    setProfileQrMessage('This QR does not look like a Signova profile.');
  }

  async function scanProfileQrImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (!('BarcodeDetector' in window)) {
        setProfileQrMessage('QR scan is not supported in this browser. Paste the profile link instead.');
        return;
      }
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      bitmap.close?.();
      openScannedProfile(codes[0]?.rawValue || '');
    } catch {
      setProfileQrMessage('Could not scan this image. Try a clearer QR or paste the link.');
    }
  }

  function revealCallControls(keepOpen = false) {
    window.clearTimeout(callControlsTimerRef.current);
    setCallControlsVisible(true);
    if (!keepOpen) {
      callControlsTimerRef.current = window.setTimeout(() => {
        if (!chatCallMoreOpen) setCallControlsVisible(false);
      }, 2600);
    }
  }

  function handleProfilePhotoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateSetting('account', 'profilePhoto', reader.result);
      setStatus('Profile photo updated');
    };
    reader.readAsDataURL(file);
  }

  function addTranscriptEntry(entry) {
    setCallTranscript((items) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ...entry,
      },
      ...items,
    ].slice(0, 12));
  }

  function startGestureLoopPractice(mode = learnPracticeMode) {
    setLearnPracticeMode(mode);
    setLearnLoopStep(mode === 'conversation' ? 4 : mode === 'coach' ? 3 : mode === 'expression' ? 3 : 2);
    setLearnTrainerActive(true);
    setLearnTrainerExpanded((expanded) => learnTrainerActive ? expanded : false);
    setLearnAttemptCount((count) => count + 1);
    setLearnFeedbackSubmitted(false);
    updateSynapseEnabled(true);
    updateSettingAndTrack('translation', 'enabled', true);
    if (!cameraEnabled) startCameraRef.current?.();
    setLearningFeedback(`${activeLearnMission.phrase}: keep the full gesture visible, then Signova will give one focused correction.`);
    setStatus(`${activeLearnMission.title} · guided ${mode} practice active`);
  }

  function presentLearnTextAsSign() {
    const prompt = learnTextPrompt.trim();
    if (!prompt) {
      setStatus('Enter a word or sentence to learn.');
      return;
    }
    const matchingMission = LEARN_MISSIONS.find((mission) => (
      mission.phrase.toLowerCase().includes(prompt.toLowerCase())
      || prompt.toLowerCase().includes(mission.phrase.toLowerCase())
    ));
    if (matchingMission) setLearnMissionId(matchingMission.id);
    setLearnLoopStep(0);
    setLearnAvatarDemoKey((key) => key + 1);
    setLearningFeedback(`Avatar is presenting “${prompt}”. Watch the handshape, motion, and expression together.`);
    setStatus(`${prompt} is ready for guided sign practice.`);
  }

  function closeLearnTrainer() {
    setLearnTrainerActive(false);
    setLearnTrainerExpanded(false);
    setStatus('Guided sign trainer closed');
  }

  async function submitLearnWeakSignFeedback(reason = 'needs-review') {
    if (!settings.privacy.dataSharing) {
      setStatus('Enable Data sharing consent in Privacy settings before sending model feedback.');
      return;
    }

    const feedbackItem = {
      id: `learn-feedback-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      pseudonymous: true,
      consent: true,
      reason,
      expectedPhrase: activeLearnMission.phrase,
      predictedLabel: liveSign?.label || '',
      predictedPhrase: liveSign?.phrase || '',
      confidence: Number(liveSign?.confidence || 0),
      stability: Number(liveSign?.stability || 0),
      qualityScore: Number(liveSign?.qualityScore || 0),
      model: liveSign?.activeModel || liveSign?.source || settings.ai.model,
      language: liveSign?.activeLanguage || settings.account.preferredSignLanguage,
      practiceMode: learnPracticeMode,
      activeBook: liveSign?.activeBook || '',
      createdAt: Date.now(),
    };

    try {
      await saveUserDoc('weakSignFeedback', feedbackItem);
      setLearnFeedbackSubmitted(true);
      setStatus('Weak-sign feedback added for model review.');
    } catch {
      setStatus('Feedback could not be saved. Please try again.');
    }
  }

  function advanceGestureLoop() {
    setLearnLoopStep((step) => Math.min(GESTURE_LOOP_STEPS.length - 1, step + 1));
    setStatus('Gesture Loop moved to the next step');
  }

  function changeTranslationLanguage(language) {
    updateSetting('translation', 'language', language);
    runtimeSettingsRef.current = {
      ...runtimeSettingsRef.current,
      outputLanguage: language,
    };

    const currentSign = liveSign && !liveSign.isUncertain ? liveSign : history[0];
    if (!currentSign) return;
    const translated = translateStoredSign(currentSign, language);
    if (!translated || translated === 'Waiting for signs') return;

    setCaption(translated);
    if (settings.translation.mode === 'word') {
      setSentence(translated);
    } else if (sentenceRef.current.length) {
      fetchJson('/api/sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels: sentenceRef.current, output_language: language }),
      })
        .then((data) => setSentence(data.sentence || translated))
        .catch(() => setSentence(translated));
    } else {
      setSentence(translated);
    }

    sendCaptionSync({
      caption: translated,
      sentence: translated,
      label: currentSign.label || '',
      confidence: currentSign.confidence || 0,
      language,
      mode: settings.translation.mode,
    });
  }

  function updateAvatarSetting(key, value) {
    setCommunityProfile((current) => {
      setAvatarUndoStack((items) => [...items.slice(-9), current]);
      setAvatarRedoStack([]);
      return {
        ...current,
        [key]: value,
      };
    });
  }

  async function saveAvatarCustomization() {
    setCommunityAvatarOpen(false);
    setCommunityIdentityEditing(false);
    setAvatarUndoStack([]);
    setAvatarRedoStack([]);
    await saveCommunityProfileToFirestore(communityProfile).catch(() => {
      setStatus('Profile saved locally. Firestore profile sync failed.');
    });
  }

  function applyCommunityAvatarPreset(preset) {
    setCommunityProfile((current) => {
      setAvatarUndoStack((items) => [...items.slice(-9), current]);
      setAvatarRedoStack([]);
      return {
        ...current,
        avatarMode: '3d',
        avatarTone: preset.tone,
        avatarMood: preset.mood,
        avatarAccessory: preset.accessory,
        avatarImage: preset.image ?? current.avatarImage,
      };
    });
  }

  function generateCommunityAvatarFromAssets() {
    const source = SIGNOVA_AVATAR_ASSETS[Math.floor(Math.random() * SIGNOVA_AVATAR_ASSETS.length)] || SIGNOVA_AVATAR_ASSETS[0];
    const tones = ['cyan', 'purple', 'green', 'orange', 'pink'];
    const accessories = ['none', 'glasses', 'headset'];
    applyCommunityAvatarPreset({
      ...source,
      tone: tones[Math.floor(Math.random() * tones.length)] || source.tone,
      accessory: accessories[Math.floor(Math.random() * accessories.length)] || source.accessory,
      mood: Math.random() > 0.28 ? 'smile' : 'calm',
    });
  }

  function deleteAvatarCustomization() {
    setCommunityProfile((current) => {
      setAvatarUndoStack((items) => [...items.slice(-9), current]);
      setAvatarRedoStack([]);
      return {
        ...current,
        avatarInitials: '',
        avatarTone: 'cyan',
        avatarMode: '3d',
        avatarMood: 'calm',
        avatarAccessory: 'none',
        avatarImage: '',
      };
    });
  }

  function undoAvatarCustomization() {
    setCommunityProfile((current) => {
      const previous = avatarUndoStack[avatarUndoStack.length - 1];
      if (!previous) return current;
      setAvatarUndoStack((items) => items.slice(0, -1));
      setAvatarRedoStack((items) => [...items.slice(-9), current]);
      return previous;
    });
  }

  function redoAvatarCustomization() {
    setCommunityProfile((current) => {
      const next = avatarRedoStack[avatarRedoStack.length - 1];
      if (!next) return current;
      setAvatarRedoStack((items) => items.slice(0, -1));
      setAvatarUndoStack((items) => [...items.slice(-9), current]);
      return next;
    });
  }

  function updateSettingAndTrack(group, key, value) {
    updateSetting(group, key, value);
    if (group === 'translation' && key === 'enabled') {
      updateSynapseEnabled(value);
    }
    if (group === 'translation' && key === 'outputType') {
      setVoiceEnabled(value !== 'text');
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const theme = settings.display.theme || 'system';
      const systemIsDark = Boolean(mediaQuery?.matches);
      const shouldUseDark = theme === 'dark' || (theme === 'system' && systemIsDark);
      setPremiumDarkMode(shouldUseDark);
      document.documentElement.dataset.signovaTheme = shouldUseDark ? 'dark' : 'light';
      document.body.dataset.signovaTheme = shouldUseDark ? 'dark' : 'light';
      document.documentElement.classList.toggle('signovaPremiumDarkPage', shouldUseDark);
      document.body.classList.toggle('signovaPremiumDarkPage', shouldUseDark);
      document.documentElement.style.colorScheme = shouldUseDark ? 'dark' : 'light';
      document.body.style.colorScheme = shouldUseDark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', shouldUseDark ? '#0d1117' : '#1d4f9a');
    };
    applyTheme();
    mediaQuery?.addEventListener?.('change', applyTheme);
    return () => {
      mediaQuery?.removeEventListener?.('change', applyTheme);
      document.documentElement.classList.remove('signovaPremiumDarkPage');
      document.body.classList.remove('signovaPremiumDarkPage');
      delete document.documentElement.dataset.signovaTheme;
      delete document.body.dataset.signovaTheme;
      document.documentElement.style.colorScheme = '';
      document.body.style.colorScheme = '';
    };
  }, [settings.display.theme]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const reduceMotion = Boolean(settings.device?.reduceMotion);
    const compactMode = Boolean(settings.device?.compactMode);
    const dataSaver = Boolean(settings.device?.dataSaver);
    const autoMediaQuality = Boolean(settings.device?.autoMediaQuality);
    const offlineCache = Boolean(settings.device?.offlineCache);
    document.documentElement.classList.toggle('signovaReduceMotion', reduceMotion);
    document.body.classList.toggle('signovaReduceMotion', reduceMotion);
    document.documentElement.classList.toggle('signovaCompactMode', compactMode);
    document.body.classList.toggle('signovaCompactMode', compactMode);
    document.documentElement.classList.toggle('signovaDataSaver', dataSaver);
    document.body.classList.toggle('signovaDataSaver', dataSaver);
    document.documentElement.classList.toggle('signovaAutoMediaQuality', autoMediaQuality);
    document.body.classList.toggle('signovaAutoMediaQuality', autoMediaQuality);
    document.documentElement.classList.toggle('signovaOfflineCache', offlineCache);
    document.body.classList.toggle('signovaOfflineCache', offlineCache);
    return () => {
      document.documentElement.classList.remove('signovaReduceMotion', 'signovaCompactMode', 'signovaDataSaver', 'signovaAutoMediaQuality', 'signovaOfflineCache');
      document.body.classList.remove('signovaReduceMotion', 'signovaCompactMode', 'signovaDataSaver', 'signovaAutoMediaQuality', 'signovaOfflineCache');
    };
  }, [settings.device?.autoMediaQuality, settings.device?.compactMode, settings.device?.dataSaver, settings.device?.offlineCache, settings.device?.reduceMotion]);

  function clearSignovaData() {
    setHistory([]);
    setSavedLearningItems([]);
    clearSentence();
    setCaption('Waiting for signs');
    setStatus('Local Signova history cleared');
  }

  function exportSignovaData() {
    const payload = {
      exportedAt: new Date().toISOString(),
      translationHistory: history,
      savedLearningItems,
      settings,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'signova-data-export.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  function deleteAccountPreview() {
    setContacts(INITIAL_CONTACTS);
    setMessages([]);
    clearSignovaData();
    setSecureCallStatus('Account data reset locally');
  }

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const pageClasses = {
      library: 'signovaLibraryPage',
      learn: 'signovaLearnPage',
      community: 'signovaCommunityFeedPage',
      communityGroups: 'signovaCommunityGroupsPage',
      drive: 'signovaProgressPage',
      communityCreate: 'signovaCreateSignPage',
      profile: 'signovaProfilePage',
      signovaPro: 'signovaProfilePage',
      settings: 'signovaSettingsPage',
    };
    Object.entries(pageClasses).forEach(([panel, className]) => {
      root.classList.toggle(className, activePanel === panel);
      body.classList.toggle(className, activePanel === panel);
    });
    return () => {
      Object.values(pageClasses).forEach((className) => {
        root.classList.remove(className);
        body.classList.remove(className);
      });
    };
  }, [activePanel]);

  useEffect(() => {
    if (!authVerificationCooldownUntil || authVerificationCooldownUntil <= Date.now()) return undefined;
    const timer = window.setInterval(() => {
      const now = Date.now();
      setAuthCooldownNow(now);
      if (authVerificationCooldownUntil <= now) {
        setAuthVerificationCooldownUntil(0);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [authVerificationCooldownUntil]);

  useEffect(() => {
    if (!chatCallScreen) {
      setCallElapsedSeconds(0);
      return undefined;
    }
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setCallElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [callExperience, chatCallScreen]);

  if (authStage !== 'app') {
    return (
      <main className={`signovaAuthShell ${authStage === 'opening' ? 'signovaAuthOpening' : ''}`} aria-label="Signova authentication">
        {authStage === 'auth' && (
          <section className="signovaAuthPanel">
            <div className="signovaAuthStory">
              <div className="signovaAuthBrand">
                <span className="signovaAuthLogo"><img src="/app-logo.png" alt="" /></span>
                <div>
                  <strong>Signova</strong>
                  <small>AI-powered sign language translation & learning platform</small>
                </div>
              </div>
              <div className="signovaAuthHeadline">
                <strong>Giving Every<br />Gesture, <span>a Voice.</span></strong>
                <p>AI-powered sign language translation and learning for a more inclusive world.</p>
              </div>
              <div className="signovaAuthFeatureList">
                <span>Real-time sign language translation</span>
                <span>Interactive learning & practice</span>
                <span>Accessible communication for everyone</span>
              </div>
              <div className="signovaAuthAvatarStage" aria-label="Signova learning and communication preview">
                <article className="authAvatarCard avatarLearning">
                  <img src="/signova-auth-avatar-learning.png" alt="Female Signova learning avatar in a blue hoodie" />
                  <span>Practice naturally</span>
                </article>
                <article className="authAvatarCard avatarAi">
                  <img src="/signova-auth-avatar-ai.png" alt="Male Signova AI learning avatar in a blue hoodie" />
                  <span>Learn with AI</span>
                </article>
                <article className="authAvatarCard avatarConnect">
                  <img src="/signova-auth-avatar-connect.png" alt="Signova communication avatar with users connecting" />
                  <span>Connect without limits</span>
                </article>
              </div>
              <div className="signovaAuthQuote">
                <b>“</b>
                <span>Communication is not a barrier, <strong>understanding is.</strong></span>
                <em>♡</em>
              </div>
            </div>

            <div className={authRecoveryOpen ? 'signovaAuthCard recoveryMode' : 'signovaAuthCard'}>
              {!authRecoveryOpen ? (
                <div className="signovaAuthCardPane authMainPane">
                  <header className="signovaAuthCardHeader">
                    <strong>{authMode === 'login' ? 'Welcome Back!' : 'Create your Signova account'} <span aria-hidden="true">👋</span></strong>
                    <small>{authMode === 'login' ? 'Login with your Firebase email and password' : 'Free-plan signup with email verification; phone is optional profile information'}</small>
                  </header>
                  <div className="signovaAuthTabs" role="tablist" aria-label="Authentication mode">
                    <button type="button" className={authMode === 'login' ? 'activeAuthTab' : ''} onClick={() => { setAuthMode('login'); setAuthRecoveryOpen(false); setAuthPhoneChallenge(null); setAuthMessage({ type: '', text: '' }); }}>Login</button>
                    <button type="button" className={authMode === 'signup' ? 'activeAuthTab' : ''} onClick={() => { setAuthMode('signup'); setAuthRecoveryOpen(false); setAuthPhoneChallenge(null); setAuthMessage({ type: '', text: '' }); }}>Sign Up</button>
                  </div>
                  <form className={authMode === 'signup' ? 'signovaAuthForm signupAuthForm' : 'signovaAuthForm'} onSubmit={startSignovaAuthentication}>
                    {authMode === 'signup' ? (
                      <div className="signupFieldGrid">
                        <label>
                          <span>Full Name</span>
                          <input value={authForm.name} onChange={(event) => setAuthForm((form) => ({ ...form, name: event.target.value }))} placeholder="Your Signova name" autoComplete="name" />
                        </label>
                        <label>
                          <span>Create Username</span>
                          <input value={authForm.username} onChange={(event) => setAuthForm((form) => ({ ...form, username: event.target.value }))} placeholder="@your.signova" autoComplete="username" />
                        </label>
                        <label>
                          <span>Phone Number</span>
                          <input type="tel" value={authForm.phone} onChange={(event) => setAuthForm((form) => ({ ...form, phone: event.target.value }))} placeholder="+91XXXXXXXXXX" autoComplete="tel" />
                          <small className="authFieldHint">Phone is saved as profile info. Firebase SMS OTP is not enabled in this build.</small>
                        </label>
                        <label>
                          <span>Email Address</span>
                          <input type="text" value={authForm.email} onChange={(event) => setAuthForm((form) => ({ ...form, email: event.target.value }))} placeholder="Enter your email" autoComplete="email" />
                        </label>
                        <label className={authForm.pin.trim() ? '' : 'passwordWideField'}>
                          <span>Password</span>
                          <input type="password" value={authForm.pin} onChange={(event) => setAuthForm((form) => ({ ...form, pin: event.target.value }))} placeholder="Enter your password" autoComplete="new-password" />
                        </label>
                        {authForm.pin.trim() && (
                          <label className="confirmPasswordField">
                            <span>Confirm Password</span>
                            <input type="password" value={authForm.confirmPin} onChange={(event) => setAuthForm((form) => ({ ...form, confirmPin: event.target.value }))} placeholder="Confirm your password" autoComplete="new-password" />
                          </label>
                        )}
                      </div>
                    ) : (
                      <>
                        <label>
                          <span>Email Address</span>
                          <input type="email" value={authForm.email} onChange={(event) => setAuthForm((form) => ({ ...form, email: event.target.value }))} placeholder="Enter your email" autoComplete="email" />
                        </label>
                        <label>
                          <span>Password</span>
                          <input type="password" value={authForm.pin} onChange={(event) => setAuthForm((form) => ({ ...form, pin: event.target.value }))} placeholder="Enter your password" autoComplete="current-password" />
                        </label>
                        <small className="authLoginMethodHint">Email/password authentication works on Firebase Spark without SMS billing.</small>
                        <small className="authLoginMethodHint">Login does not auto-send email. Use the verification button once if needed.</small>
                      </>
                    )}
                    {authMode === 'signup' ? (
                      <div className="signovaAuthOptions authPrivacyChoice">
                        <label className="authRemember"><input type="checkbox" checked={authForm.hidePhone} onChange={(event) => setAuthForm((form) => ({ ...form, hidePhone: event.target.checked }))} />Hide phone number</label>
                        <label className="authRemember"><input type="checkbox" defaultChecked />Remember me</label>
                      </div>
                    ) : (
                      <div className="signovaAuthRow">
                        <label className="authRemember"><input type="checkbox" defaultChecked />Remember me</label>
                        <button type="button" onClick={() => setAuthRecoveryOpen(true)}>Forgot Password?</button>
                      </div>
                    )}
                    {authMode === 'signup' && (
                      <div className="signovaQrCard">
                        <span className="qrScanBox" aria-hidden="true"><i /><b /><em /></span>
                        <span><strong>Personal QR Connect</strong><small>Profile QR for sharing and quick contacts.</small></span>
                        <button type="button">Link QR</button>
                      </div>
                    )}
                    {authMessage.text && <p className={`signovaAuthMessage ${authMessage.type === 'success' ? 'success' : 'error'}`}>{authMessage.text}</p>}
                    {authMode === 'login' && (
                      <button type="button" className="authVerificationAction" onClick={resendAuthVerificationFromForm} disabled={authBusy || authVerificationCooldownSeconds > 0 || !authForm.email.trim() || authForm.pin.trim().length < 6}>
                        {authVerificationCooldownSeconds > 0 ? `Wait ${authVerificationCooldownSeconds}s to resend` : 'Send verification email / check status'}
                      </button>
                    )}
                    <button type="submit" className="signovaAuthPrimary" disabled={authBusy}>{authBusy ? 'Working...' : authMode === 'login' ? 'Login' : 'Create account'} <span aria-hidden="true">→</span></button>
                  </form>
                  <div className="signovaSecureNote">
                    <Attach3DIcon type="lock" />
                    <span><strong>Secure sign-in</strong><small>Firebase Authentication protects account access. Message E2EE is not yet available.</small></span>
                  </div>
                  <div className="signovaAuthStatus" aria-label="Signova trust signals">
                    <span><Attach3DIcon type="lock" /><b>Secure Authentication</b><small>Your data is protected</small></span>
                    <span><Attach3DIcon type="select" /><b>Privacy First</b><small>You're in control</small></span>
                    <span><Attach3DIcon type="contact" /><b>Accessibility First</b><small>Built for everyone</small></span>
                  </div>
                  <p className="signovaAuthSwitch">{authMode === 'login' ? "Don't have an account?" : 'Already have an account?'} <button type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'signup' : 'login'); setAuthRecoveryOpen(false); setAuthPhoneChallenge(null); }}>{authMode === 'login' ? 'Sign Up' : 'Login'}</button></p>
                </div>
              ) : (
                <div className="signovaAuthCardPane authRecoveryPane">
                  <button type="button" className="authBackButton" onClick={() => { setAuthRecoveryOpen(false); setAuthMessage({ type: '', text: '' }); }}>← Back to login</button>
                  <header className="signovaAuthCardHeader">
                    <strong>Recover Signova access</strong>
                    <small>Enter your username, email, or phone number. We will send a secure reset step.</small>
                  </header>
                  <form className="signovaAuthForm" onSubmit={sendAuthRecovery}>
                    <label>
                      <span>Account Identity</span>
                      <input type="text" value={authForm.email} onChange={(event) => setAuthForm((form) => ({ ...form, email: event.target.value }))} placeholder="@username, email, or phone number" autoComplete="username" />
                    </label>
                    <div className="signovaRecoveryMethods">
                      <span><Attach3DIcon type="document" />Email reset link</span>
                      <span><Attach3DIcon type="audio" />Voice support ready</span>
                      <span><Attach3DIcon type="lock" />PIN recovery</span>
                    </div>
                    {authMessage.text && <p className={`signovaAuthMessage ${authMessage.type === 'success' ? 'success' : 'error'}`}>{authMessage.text}</p>}
                    <button type="submit" className="signovaAuthPrimary" disabled={authBusy}>{authBusy ? 'Sending...' : 'Send recovery email'} <span aria-hidden="true">→</span></button>
                  </form>
                  <div className="signovaSecureNote recoverySecureNote">
                    <Attach3DIcon type="info" />
                    <span><strong>Private recovery</strong><small>Signova never asks for your password during recovery. Use only the secure reset step.</small></span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
        {authStage === 'opening' && (
          <SignovaOpeningAnimation activePanel={activePanel} className="authFullSignovaIntro" />
        )}
        {authStage === 'checking' && <AppStartupSkeleton />}
      </main>
    );
  }

  const communitySignPipeline = [
    { label: 'Basics', note: 'Identity' },
    { label: 'Guidance', note: 'Movement' },
    { label: 'Demo', note: 'Media' },
    { label: 'Publish', note: 'Review' },
  ];
  const communitySignPipelineProgress = (communitySignPipelineUnlocked / (communitySignPipeline.length - 1)) * 100;

  return (
    <div
      className={`${premiumDarkMode ? 'messengerShell premiumDarkMode' : 'messengerShell'} ${isSignovaProActive ? 'signovaProMember' : ''} ${activePanel === 'chats' ? 'chatMode' : ''} ${activePanel === 'translate' ? 'conversationHistoryMode' : ''} ${activePanel === 'learn' ? 'learnMode' : ''} ${activePanel === 'library' ? 'libraryMode' : ''} ${activePanel === 'drive' ? 'progressMode' : ''} ${['profile', 'signovaPro'].includes(activePanel) ? 'profileMode' : ''} ${activePanel === 'settings' ? 'settingsMode' : ''} ${activePanel === 'contacts' ? 'contactsMode' : ''} ${['community', 'communityGroups', 'communityCreate'].includes(activePanel) ? 'communityMode' : ''} ${mobileChatListOpen ? 'mobileChatListOpen' : 'mobileChatRoomOpen'} ${settings.display.highContrast ? 'highContrastMode' : ''} ${settings.display.largeText ? 'largeTextMode' : ''} subtitle-${settings.display.subtitleSize}`}
      style={{ '--chat-sidebar-width': `${chatSidebarWidth}px` }}
    >
      {!persistenceReady && <AppStartupSkeleton />}
      <AppNavigationRail
        activePanel={activePanel}
        accountAvatarInitials={accountAvatarInitials}
        encryptionStatus={encryptionStatus}
        engineName={ENGINE_NAME}
        fullIntro={fullIntroActive ? <SignovaOpeningAnimation activePanel={activePanel} /> : null}
        isProActive={isSignovaProActive}
        navItems={NAV_ITEMS}
        onCommunityOpen={handleCommunityRailTap}
        onLogoClick={handleRailLogoClick}
        onLogoDoubleClick={handleRailLogoDoubleClick}
        onOpenPanel={openPanel}
        railIcon={RailIcon}
        railTributeActive={railTributeActive}
        signApiStatus={signApiStatus}
      />

      <aside className="chatSidebar resizableChatSidebar">
        {activePanel === 'translate' ? (
          <>
            <div className="chatSidebarTop conversationHistoryTop">
              <strong>Conversation history</strong>
            </div>
            <label className={callHistorySearch ? 'searchBox activeSearchBox' : 'searchBox'}>
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={callHistorySearch}
                onChange={(event) => setCallHistorySearch(event.target.value)}
                placeholder="Search call history"
                aria-label="Search conversation history"
              />
              <i aria-hidden="true" />
            </label>
            <div className="chatCategoryRow conversationHistoryCategories" aria-label="Conversation history filters">
              {[
                ['all', 'All'],
                ['active', 'Online'],
                ['completed', 'Completed'],
                ['no-history', 'No calls'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={callHistoryFilter === id ? 'activeChatFilter' : ''}
                  onClick={() => setCallHistoryFilter(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mobileListSummary">
              <span>People & calls</span>
              <small>{conversationHistoryContacts.length} conversation{conversationHistoryContacts.length === 1 ? '' : 's'}</small>
            </div>
            <div className="chatList conversationHistoryList">
              {conversationHistoryContacts.length ? conversationHistoryContacts.map((contact) => (
                <button
                  className={selectedConversationId === contact.id ? 'chatListItem conversationHistoryItem activeChat' : 'chatListItem conversationHistoryItem'}
                  type="button"
                  key={contact.id}
                  onClick={() => {
                    setSelectedConversationId(contact.id);
                    setMobileChatListOpen(false);
                  }}
                >
                  <ContactAvatar contact={contact} className={contact.status === 'online' ? 'avatar onlineConversationAvatar' : 'avatar'} />
                  <span>
                    <strong>{contact.name}</strong>
                    <small>{contact.lastCall ? `${contact.lastCall.type} · ${contact.lastCall.startedLabel}` : 'No call history yet'}</small>
                    <em className="conversationPresence">
                      <b>{contact.status === 'online' ? 'Online' : 'Offline'}</b>
                      <b>{contact.calls.length} calls</b>
                    </em>
                  </span>
                </button>
              )) : <p className="emptyChatState">No conversation history found.</p>}
            </div>
          </>
        ) : (
          <>
          <div className="chatSidebarTop">
          <strong>Chats</strong>
          <div className="chatSidebarActions">
            <button type="button" className="chatTopAction addContactAction" onClick={() => openPanel('contacts')} aria-label="New chat"><span>＋</span></button>
            <button
              type="button"
              className="chatTopAction moreChatAction"
              onClick={showChatSidebarMenu}
              aria-label="Chat options"
              aria-haspopup="menu"
              aria-expanded={chatSidebarMenu.visible}
            >
              <span>⋮</span>
            </button>
          </div>
        </div>
        <label className={chatSearch ? 'searchBox activeSearchBox' : 'searchBox'}>
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={chatSearch}
            onChange={(event) => setChatSearch(event.target.value)}
            placeholder="Search or start a new chat"
            aria-label="Search chats"
          />
          <i aria-hidden="true" />
        </label>
        <div className="chatCategoryRow" aria-label="Chat filters">
          {[
            ['all', 'All'],
            ['unread', unseenChatCount ? `Unseen ${unseenChatCount}` : 'Unseen'],
            ['favourites', 'Favourites'],
            ['groups', 'Groups'],
            ['archived', 'Archived'],
            ...customChatCategories.map((category) => [`custom:${category.id}`, category.label]),
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={chatFilter === id ? 'activeChatFilter' : ''}
              onClick={() => setChatFilter(id)}
            >
              {label}
            </button>
          ))}
          <button type="button" className="addChatChip" onClick={openCategoryComposer} aria-label="Add custom category">+</button>
        </div>
        {categoryComposerOpen && (
          <form className="categoryComposerCard" onSubmit={saveCustomChatCategory}>
            <div className="categoryComposerHeader">
              <span>＋</span>
              <div>
                <strong>New category</strong>
                <small>Organize chats your way</small>
              </div>
            </div>
            <input
              type="text"
              value={categoryDraft}
              onChange={(event) => setCategoryDraft(event.target.value)}
              placeholder="Family, Classmates, Practice..."
              aria-label="Custom category name"
            />
            <div className="categoryComposerActions">
              <button type="button" onClick={() => { setCategoryComposerOpen(false); setCategoryDraft(''); }}>Cancel</button>
              <button type="submit" className="primaryCategoryButton">Add</button>
            </div>
          </form>
        )}
        {chatSidebarMenu.visible && createPortal((
          <div
            className={premiumDarkMode ? 'chatSidebarMenuLayer premiumDarkMode' : 'chatSidebarMenuLayer'}
            role="presentation"
            onPointerDown={() => setChatSidebarMenu({ visible: false, x: 0, y: 0 })}
          >
            <div
              className="chatActionMenu sidebarChatMenu chatSidebarOptionsMenu"
              style={{
                '--chat-sidebar-menu-x': `${chatSidebarMenu.x}px`,
                '--chat-sidebar-menu-y': `${chatSidebarMenu.y}px`,
              }}
              role="menu"
              aria-label="Chat options"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="chatMenuBrand">
                <img src="/app-logo.png" alt="" />
                <span>
                  <strong>Signova Chats</strong>
                  <small>Focused chat controls</small>
                </span>
              </div>
              <button type="button" role="menuitem" onClick={() => handleSidebarChatAction('locked')}><Attach3DIcon type="lock" />{sidebarMenuFlags.locked ? 'Unlock chat' : 'Lock chat'}</button>
              <button type="button" role="menuitem" onClick={() => handleSidebarChatAction('pinned')}><Attach3DIcon type="pin" />{sidebarMenuFlags.pinned ? 'Unpin chat' : 'Pin chat'}</button>
              <button type="button" role="menuitem" onClick={() => handleSidebarChatAction('hidden')}><Attach3DIcon type="clear" />{sidebarMenuFlags.hidden ? 'Unhide chat' : 'Hide chat'}</button>
              <button type="button" role="menuitem" onClick={() => handleSidebarChatAction('starred')}><Attach3DIcon type="heart" />{sidebarMenuFlags.starred ? 'Remove star' : 'Star chat'}</button>
              <button type="button" role="menuitem" className="newGroupMenuItem" onClick={() => handleSidebarChatAction('new-group')}><Attach3DIcon type="contact" />Create group</button>
            </div>
          </div>
        ), document.body)}
        <div className="mobileListSummary">
          <span>Recent conversations</span>
          <small>{visibleContacts.length} chat{visibleContacts.length === 1 ? '' : 's'}</small>
        </div>
        <div className="chatList">
          {visibleContacts.length ? visibleContacts.map((contact, index) => {
            const flags = chatFlags[contact.id] || {};
            const isOnline = contact.id === 'signova-ai' || activeCallLog?.contactId === contact.id;
            const isChatOpen = selectedChatId === contact.id;
            const isTyping = typingContactId === contact.id;
            const listActivityItems = isTyping
              ? ['Typing...']
              : [
                isOnline ? 'Active now' : 'Last seen today at 09:42',
                activeCallLog?.contactId === contact.id ? 'In live call' : 'Available',
                isOnline ? 'Web + Android ready' : 'Offline mode',
              ];
            const messageCount = isChatOpen ? 0 : (contact.id === 'signova-ai' ? incomingMessageCount : (flags.unread ? 1 : 0));
            return (
            <button
              className={isChatOpen ? 'chatListItem activeChat' : 'chatListItem'}
              type="button"
              key={contact.id}
              onClick={() => {
                setSelectedChatId(contact.id);
                setMobileChatListOpen(false);
                setChatFlags((current) => ({
                  ...current,
                  [contact.id]: {
                    ...(current[contact.id] || {}),
                    unread: false,
                  },
                }));
              }}
              onContextMenu={(event) => showChatMenu(event, contact.id)}
              onPointerDown={(event) => startChatLongPress(event, contact.id)}
              onPointerUp={clearChatLongPress}
              onPointerLeave={clearChatLongPress}
              onPointerCancel={clearChatLongPress}
            >
              <ContactAvatar contact={contact} presenceTone={isOnline ? 'online' : 'offline'} />
              <span>
                <strong>
                  <span>{contact.name}</span>
                  {messageCount ? <b className="chatMessageCountBadge">{messageCount}</b> : null}
                </strong>
                <small className="chatListMetaActivity">
                  {contact.showUsername !== false ? <b>{contact.username}</b> : null}
                  {contact.showNumber ? <><i aria-hidden="true">·</i><b>{contact.number}</b></> : null}
                  {!isChatOpen ? (
                    <>
                      {(contact.showUsername !== false || contact.showNumber) ? <i aria-hidden="true">·</i> : null}
                      <span className="headerActivityTicker" aria-label={listActivityItems[0]}>
                        {listActivityItems.map((item, itemIndex) => <em key={`${contact.id}-${item}-${itemIndex}`}>{item}</em>)}
                      </span>
                    </>
                  ) : null}
                </small>
                {(flags.locked || flags.pinned || flags.hidden || flags.archived || flags.starred || flags.muted || flags.unread || flags.favourite || flags.blocked) && (
                  <em className="chatBadges">
                    {flags.locked && <b>Locked</b>}
                    {flags.pinned && <b>Pinned</b>}
                    {flags.hidden && <b>Hidden</b>}
                    {flags.archived && <b>Archived</b>}
                    {flags.starred && <b>Starred</b>}
                    {flags.muted && <b>Muted</b>}
                    {flags.unread && <b>Unread</b>}
                    {flags.favourite && <b>Favourite</b>}
                    {flags.blocked && <b>Blocked</b>}
                  </em>
                )}
              </span>
            </button>
            );
          }) : <p className="emptyChatState">No chats in this category.</p>}
        </div>
        </>
        )}
        {chatMenu.visible && createPortal((
          <div
            className="chatActionMenu"
            style={{ '--chat-menu-x': `${chatMenu.x}px`, '--chat-menu-y': `${chatMenu.y}px` }}
            role="menu"
            onMouseLeave={() => setChatMenu((menu) => ({ ...menu, visible: false }))}
          >
            <button type="button" role="menuitem" onClick={() => handleChatAction('archived')}><Attach3DIcon type="archive" />{menuChatFlags.archived ? 'Unarchive' : 'Archive'}</button>
            <button type="button" role="menuitem" onClick={() => handleChatAction('muted')}><Attach3DIcon type="mute" />{menuChatFlags.muted ? 'Unmute' : 'Mute'}</button>
            <button type="button" role="menuitem" onClick={() => handleChatAction('pinned')}><Attach3DIcon type="pin" />{menuChatFlags.pinned ? 'Unpin' : 'Pin'}</button>
            <button type="button" role="menuitem" onClick={() => handleChatAction('unread')}><Attach3DIcon type="document" />Unread</button>
            <button type="button" role="menuitem" onClick={() => handleChatAction('favourite')}><Attach3DIcon type="heart" />{menuChatFlags.favourite ? 'Unfavourite' : 'Favourite'}</button>
            <button type="button" role="menuitem" onClick={() => handleChatAction('list')}><Attach3DIcon type="select" />Add list</button>
            <div className="chatMenuSeparator" />
            <button type="button" role="menuitem" onClick={() => handleChatAction('locked')}><Attach3DIcon type="lock" />{menuChatFlags.locked ? 'Unlock' : 'Lock chat'}</button>
            <button type="button" role="menuitem" onClick={() => handleChatAction('hidden')}><Attach3DIcon type="clear" />{menuChatFlags.hidden ? 'Unhide' : 'Hide'}</button>
            <button type="button" role="menuitem" onClick={() => handleChatAction('blocked')}><Attach3DIcon type="block" />Block</button>
            <button type="button" role="menuitem" onClick={() => handleChatAction('clear')}><Attach3DIcon type="clear" />Clear</button>
            <button type="button" role="menuitem" className="dangerChatAction" onClick={() => handleChatAction('delete')}><Attach3DIcon type="trash" />Delete</button>
          </div>
        ), document.body)}
        <button
          type="button"
          className="chatSidebarResizeHandle"
          onPointerDown={startChatSidebarResize}
          aria-label="Resize chat sidebar"
          title="Drag to resize sidebar"
        />
      </aside>

      <main className={chatCallScreen && !chatCallMinimized ? 'conversationPane callWorkspaceActive' : 'conversationPane'}>
        {activePanel === 'translate' ? (
          <section className="conversationInfoPage" aria-label="Conversation info">
            {selectedConversation ? (
              <>
                <header className="conversationInfoHeader">
                  <button
                    type="button"
                    className="mobileChatBackButton conversationInfoBackButton"
                    onClick={() => setMobileChatListOpen(true)}
                    aria-label="Back to call history"
                  >
                    ‹
                  </button>
                  <ContactAvatar
                    contact={selectedConversation}
                    className={activeCallLog?.contactId === selectedConversation.id ? 'avatar onlineConversationAvatar' : 'avatar'}
                  />
                  <div className="conversationInfoIdentity">
                    <div className="conversationInfoNameLine">
                      <strong>{selectedConversation.name}</strong>
                      <span>{selectedConversation.username}</span>
                    </div>
                    <small>{activeCallLog?.contactId === selectedConversation.id ? 'Online now' : 'Offline'}</small>
                  </div>
                  <div className="conversationInfoHeaderActions">
                    <button
                      type="button"
                      className="chatCallGlassButton premiumHeaderButton premiumCallButton videoSignChatButton"
                      onClick={() => startConversationInfoCall(selectedConversation, 'video')}
                      aria-label={`Start Video Sign Chat with ${selectedConversation.name}`}
                      title="Video Sign Chat"
                    >
                      <VideoSignChatIcon />
                      <span className="visuallyHidden">Video Sign Chat</span>
                    </button>
                    <button
                      type="button"
                      className="chatCallGlassButton premiumHeaderButton premiumCallButton voiceSignChatButton"
                      onClick={() => startConversationInfoCall(selectedConversation, 'voice')}
                      aria-label={`Start Voice Sign Chat with ${selectedConversation.name}`}
                      title="Voice Sign Chat"
                    >
                      <VoiceSignChatIcon />
                      <span className="visuallyHidden">Voice Sign Chat</span>
                    </button>
                    <div className="chatHeaderMenuWrap conversationInfoMenuWrap">
                      <button
                        type="button"
                        className="chatCallGlassButton premiumHeaderButton chatMoreIconButton"
                        onClick={() => {
                          setConversationCategoryOpen(false);
                          setConversationInfoMenuOpen((open) => !open);
                        }}
                        aria-label="Conversation actions"
                        aria-expanded={conversationInfoMenuOpen}
                      >
                        <HeaderMoreIcon />
                        <span className="visuallyHidden">Conversation actions</span>
                      </button>
                      {conversationInfoMenuOpen && (
                        <div className="chatActionMenu headerChatActionMenu conversationInfoActionMenu" role="menu" onMouseLeave={() => setConversationInfoMenuOpen(false)}>
                          <button type="button" role="menuitem" onClick={() => {
                            setSelectedChatId(selectedConversation.id);
                            setActivePanel('chats');
                            setMobileChatListOpen(false);
                            setConversationInfoMenuOpen(false);
                          }}>
                            <Attach3DIcon type="chat" />Open chat
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="dangerChatAction"
                            onClick={() => {
                              clearConversationHistory(selectedConversation.id);
                              if (clearHistoryConfirmId === selectedConversation.id) setConversationInfoMenuOpen(false);
                            }}
                          >
                            <Attach3DIcon type="trash" />
                            {clearHistoryConfirmId === selectedConversation.id ? 'Confirm clear history' : 'Clear call history'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </header>
                <div className="conversationInfoStats">
                  <span><strong>{selectedConversationCalls.length}</strong><small>Total calls</small></span>
                  <span><strong>{selectedConversationCalls[0]?.startedLabel || 'No calls'}</strong><small>Last call</small></span>
                  <span><strong>{activeCallLog?.contactId === selectedConversation.id ? 'Active' : 'Idle'}</strong><small>Status</small></span>
                  <div className="conversationCategoryPicker">
                    <button
                      type="button"
                      className={conversationCategoryOpen ? 'conversationCategoryButton activeConversationCategoryButton' : 'conversationCategoryButton'}
                      onClick={() => {
                        setConversationInfoMenuOpen(false);
                        setConversationCategoryOpen((open) => !open);
                      }}
                      aria-haspopup="menu"
                      aria-expanded={conversationCategoryOpen}
                    >
                      <span>
                        <small>Category</small>
                        <strong>{conversationCategory === 'all' ? 'All calls' : conversationCategory === 'video' ? 'Video Sign' : conversationCategory === 'voice' ? 'Voice Sign' : 'Normal'}</strong>
                      </span>
                      <b aria-hidden="true">⌄</b>
                    </button>
                    {conversationCategoryOpen && (
                      <div className="conversationCategoryMenu" role="menu">
                        {[
                          ['all', 'All calls'],
                          ['video', 'Video Sign Chat'],
                          ['voice', 'Voice Sign Chat'],
                          ['normal', 'Normal call'],
                        ].map(([id, label]) => (
                          <button
                            type="button"
                            role="menuitemradio"
                            aria-checked={conversationCategory === id}
                            className={conversationCategory === id ? 'activeConversationCategory' : ''}
                            key={id}
                            onClick={() => {
                              setConversationCategory(id);
                              setConversationCategoryOpen(false);
                            }}
                          >
                            <i aria-hidden="true" />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="conversationInfoTimeline">
                  {visibleConversationCalls.length ? visibleConversationCalls.map((item) => {
                    const presentation = getCallHistoryPresentation(item.type);
                    return (
                      <article className="conversationInfoCall" key={item.id}>
                        <div>
                          <strong>{item.status === 'active' ? 'Active call' : 'Completed call'}</strong>
                          <small><b>{presentation.label}</b> · {presentation.translation} · {item.startedLabel}{item.endedLabel ? ` → ${item.endedLabel}` : ''}</small>
                        </div>
                        <em>{item.status === 'active' ? 'Live' : formatPracticeTime(Math.round(item.durationSeconds / 60))}</em>
                      </article>
                    );
                  }) : <p className="emptyChatState">{selectedConversationCalls.length ? 'No calls in this category.' : 'No calls with this person yet.'}</p>}
                </div>
              </>
            ) : (
              <div className="conversationInfoEmpty callHistoryBlankState">
                <button
                  type="button"
                  className="mobileChatBackButton conversationInfoBackButton"
                  onClick={() => setMobileChatListOpen(true)}
                  aria-label="Back to call history"
                >
                  ‹
                </button>
                <div className="callHistoryBlankAnimation" aria-hidden="true">
                  <span className="callHistoryBlankRing" />
                  <VideoSignChatIcon />
                  <span className="callHistoryBlankWave callHistoryBlankWaveOne" />
                  <span className="callHistoryBlankWave callHistoryBlankWaveTwo" />
                </div>
                <strong>Select a call</strong>
                <small>Choose a person to view call type, time, and translation status.</small>
                <div className="callHistoryEscapeHint">
                  <kbd>Esc</kbd>
                  <span>Back to call history</span>
                </div>
              </div>
            )}
          </section>
        ) : activePanel === 'chats' && !selectedChatContact ? (
          <section className="chatBlankCanvas" aria-label="No chat selected">
            <div className="chatBlankAnimation" aria-hidden="true">
              <span className="blankOrbit blankOrbitOne" />
              <span className="blankOrbit blankOrbitTwo" />
              <span className="blankGestureCore">S</span>
              <span className="blankWave blankWaveOne" />
              <span className="blankWave blankWaveTwo" />
            </div>
            <div>
              <span>Signova Chats</span>
              <strong>Select a chat to begin</strong>
              <small>Press Esc anytime to unselect the current chat and return here.</small>
            </div>
          </section>
        ) : (
        <>
          <header className="chatHeader">
          <button
            type="button"
            className="mobileChatBackButton"
            onClick={() => setMobileChatListOpen(true)}
            aria-label="Back to chats"
          >
            ‹
          </button>
          <button type="button" className="chatIdentity chatIdentityButton" onClick={() => setContactInfoOpen(true)} aria-label="Open contact profile">
            <ContactAvatar
              contact={selectedChatContact || { name: 'Signova', username: '@signova.ai', avatarChoice: 'signova' }}
              presenceTone={selectedChatPresence?.tone || 'online'}
            />
            <div>
              <strong>{selectedChatContact?.name || 'Signova Interpreter'}</strong>
              {selectedChatContact ? (
                <ContactMetaLine contact={selectedChatContact} activityItems={selectedHeaderActivity} />
              ) : (
                <small className="contactMetaLine"><b>{status}</b><i aria-hidden="true">·</i><span className="headerActivityTicker"><em>{selectedHeaderActivity[0] || 'Active now'}</em></span></small>
              )}
            </div>
          </button>
          <div className="headerActions">
            <EncryptionStatusNotice capability={conversationE2EE} />
            {activeCallLog?.contactId === selectedChatContact?.id ? (
              <span className="chatHeaderCallStatus">
                <b>{callExperience.includes('voice') ? 'Voice call' : 'Video call'}</b>
                <small>{callStatus}</small>
              </span>
            ) : null}
            <button
              type="button"
              className={`chatCallGlassButton premiumHeaderButton premiumCallButton videoSignChatButton ${activeCallLog?.contactId === selectedChatContact?.id && !callExperience.includes('voice') ? 'activePremiumCallButton' : ''}`}
              onClick={() => startVideoSignChat(true)}
              aria-label="Start Video Sign Chat"
              title="Video Sign Chat"
              data-tooltip="Video Sign Chat"
            >
              <VideoSignChatIcon />
              <span className="visuallyHidden">Video Sign Chat</span>
            </button>
            <button
              type="button"
              className={`chatCallGlassButton premiumHeaderButton premiumCallButton voiceSignChatButton ${activeCallLog?.contactId === selectedChatContact?.id && callExperience.includes('voice') ? 'activePremiumCallButton' : ''}`}
              onClick={() => startVoiceSignChat(true)}
              aria-label="Start Voice Sign Chat"
              title="Voice Sign Chat"
              data-tooltip="Voice Sign Chat"
            >
              <VoiceSignChatIcon />
              <span className="visuallyHidden">Voice Sign Chat</span>
            </button>
            <button
              type="button"
              className="chatCallGlassButton premiumHeaderButton chatSearchIconButton"
              onClick={() => {
                setMessageSearchOpen((open) => !open);
                window.setTimeout(() => document.querySelector('.chatHeaderSearch input')?.focus(), 60);
              }}
              aria-label="Search in chat"
              title="Search"
            >
              <HeaderSearchIcon />
              <span className="visuallyHidden">Search</span>
            </button>
            <div className="chatHeaderMenuWrap">
              <button
                type="button"
                className="chatCallGlassButton premiumHeaderButton chatMoreIconButton"
                onClick={toggleHeaderMenu}
                aria-label="Chat menu"
              title="More"
              aria-expanded={chatHeaderMenuOpen}
            >
                <HeaderMoreIcon />
                <span className="visuallyHidden">Chat menu</span>
              </button>
              {chatHeaderMenuOpen && (
                <div className="chatActionMenu headerChatActionMenu" role="menu" onMouseLeave={() => setChatHeaderMenuOpen(false)}>
                  {[
                    ['video-call', 'camera', 'Video Sign Chat'],
                    ['voice-call', 'audio', 'Voice Sign Chat'],
                    ['info', 'info', 'Contact profile'],
                    ['search', 'search', 'Search messages'],
                    ['select', 'select', 'Select messages'],
                    ['muted', 'mute', selectedChatFlags.muted ? 'Unmute alerts' : 'Mute alerts'],
                    ['pinned', 'pin', selectedChatFlags.pinned ? 'Unpin chat' : 'Pin chat'],
                    ['favourite', 'heart', selectedChatFlags.favourite ? 'Remove favourite' : 'Favourite chat'],
                    ['locked', 'lock', selectedChatFlags.locked ? 'Unlock private chat' : 'Lock private chat'],
                    ['share-contact', 'share', 'Share Signova contact'],
                    ['video-link', 'link', 'Send sign-chat link'],
                    ['translate', 'translate', 'Open translation'],
                    ['report', 'report', 'Report safety issue'],
                    ['blocked', 'block', selectedChatFlags.blocked ? 'Unblock contact' : 'Block contact'],
                    ['clear', 'clear', 'Clear chat'],
                    ['delete', 'trash', 'Delete chat'],
                  ].map(([action, iconType, label]) => (
                    <button
                      type="button"
                      role="menuitem"
                      className={['report', 'blocked', 'clear', 'delete'].includes(action) ? 'dangerChatAction' : ''}
                      key={action}
                      onClick={() => handleHeaderChatAction(action)}
                    >
                      <Attach3DIcon type={iconType} />{label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {messageSearchOpen && (
          <label className="chatHeaderSearch">
            <span aria-hidden="true">⌕</span>
            <input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Search messages" aria-label="Search messages in this chat" />
            <button type="button" onClick={() => { setMessageSearch(''); setMessageSearchOpen(false); }} aria-label="Close message search">×</button>
          </label>
        )}
        {chatCallScreen && (
          <section
            className={`unifiedChatCallWindow dedicatedChatCallWindow ${chatCallMinimized ? 'minimizedUnifiedChatCallWindow' : ''} ${chatCallExpanded ? 'expandedUnifiedChatCallWindow' : ''} ${chatCallScreen === 'voice' ? 'voiceUnifiedChatCallWindow' : ''} ${chatCallInfoOpen ? 'callInfoDrawerOpen' : ''}`}
            aria-label={chatCallScreen === 'voice' ? 'Voice Sign Chat' : 'Video Sign Chat'}
            style={chatCallMinimized ? { '--chat-call-x': `${chatCallPosition.x}px`, '--chat-call-y': `${chatCallPosition.y}px` } : undefined}
            onPointerDown={startChatCallMove}
          >
            <header className="unifiedCallHeader">
              <div className="unifiedCallBrand"><img src="/app-logo.png" alt="" /><span><strong>Signova</strong><small>Every Gesture, A Voice.</small></span></div>
              <div className="unifiedCallTitle">
                <span><i />Live</span>
                <strong>{chatCallScreen === 'voice' ? 'Signova Voice Chat' : 'Signova Video Chat'}</strong>
                <small>{formatCallTimer(callElapsedSeconds)} · Secure transport preview</small>
                <div className={`unifiedCallConnectionBar ${callStatus.includes('connected') ? 'connectedCallSignal' : 'connectingCallSignal'}`} aria-label="Live connection quality">
                  <i /><i /><i /><i />
                  <em>{callStatus.includes('connected') ? 'Live secure connection' : 'Connecting securely'}</em>
                </div>
              </div>
              {!chatCallMinimized && <div className="unifiedCallWindowActions">
                <button type="button" className="unifiedCallInfoToggle" onClick={() => setChatCallInfoOpen((open) => !open)} aria-label="Toggle call status panel">ⓘ</button>
                <button
                  type="button"
                  className="unifiedCallMinimizeButton"
                  onClick={() => {
                    if (desktopCallWindowMode) {
                      setChatCallPosition({ x: 8, y: 8 });
                      window.signovaDesktop?.compactCallWindow?.();
                    }
                    setChatCallMinimized(true);
                    setChatCallExpanded(false);
                    setChatCallInfoOpen(false);
                    setChatCallMoreOpen(false);
                    setChatCallHistoryOpen(false);
                    setChatCallPosition({
                      x: Math.max(8, window.innerWidth - 508),
                      y: Math.max(8, window.innerHeight - 293),
                    });
                  }}
                  aria-label="Minimize call"
                >
                  −
                </button>
                <button type="button" className="unifiedCallExpandButton" onClick={async () => {
                  if (desktopCallWindowMode && window.signovaDesktop?.toggleMaximize) {
                    setChatCallExpanded(Boolean(await window.signovaDesktop.toggleMaximize()));
                    return;
                  }
                  setChatCallExpanded((expanded) => !expanded);
                }} aria-label={chatCallExpanded ? 'Restore call window' : 'Expand call window'}>{chatCallExpanded ? '▣' : '□'}</button>
                <button type="button" className="unifiedCallCloseButton" onClick={endCallSession} aria-label="Close call">×</button>
              </div>}
            </header>
            {chatCallMinimized && (
              <div className="unifiedMinimizedCallBody">
                <div className="unifiedMinimizedParticipants">
                  <button type="button" className="unifiedMinimizedParticipant unifiedMinimizedLocalParticipant" onClick={() => { window.signovaDesktop?.restoreCallWindow?.(); setChatCallMinimized(false); setChatCallFocus('local'); }} aria-label="Open your video">
                    {chatCallScreen === 'video' && cameraEnabled ? (
                      <video autoPlay playsInline muted ref={(node) => {
                        if (node && streamRef.current && node.srcObject !== streamRef.current) {
                          node.srcObject = streamRef.current;
                          node.play?.().catch(() => {});
                        }
                      }} />
                    ) : chatCallScreen === 'video' ? (
                      <span className="unifiedMinimizedCameraOffAvatar localCameraOffAvatar">
                        {settings.account.profilePhoto ? <img src={settings.account.profilePhoto} alt="" /> : <b>{accountAvatarInitials}</b>}
                        <small>Your camera is off</small>
                      </span>
                    ) : (
                      <div className="unifiedMinimizedVoicePulse" aria-hidden="true"><i /><i /><i /><i /><i /></div>
                    )}
                    <span><i />You</span>
                  </button>
                  <button type="button" className="unifiedMinimizedParticipant unifiedMinimizedPartnerParticipant" onClick={() => { window.signovaDesktop?.restoreCallWindow?.(); setChatCallMinimized(false); setChatCallFocus('remote'); }} aria-label="Open partner video">
                    {chatCallScreen === 'video' && remoteMediaState.camera ? (
                      <video ref={attachRemoteCallVideo} autoPlay playsInline />
                    ) : chatCallScreen === 'video' ? (
                      <span className="unifiedMinimizedCameraOffAvatar partnerCameraOffAvatar">
                        <ContactAvatar contact={selectedChatContact || { name: 'Partner', avatarChoice: 'initial' }} className="unifiedMinimizedProfileAvatar" />
                        <small>Camera off</small>
                      </span>
                    ) : <div className="unifiedMinimizedVoicePulse partnerVoicePulse" aria-hidden="true"><i /><i /><i /><i /><i /></div>}
                    <span><i />{selectedChatContact?.name || 'Partner'}</span>
                  </button>
                </div>
                {(!remoteMediaState.camera || !remoteMediaState.mic || !remoteMediaState.translation) && (
                  <div className="unifiedMinimizedStatusNotices" aria-live="polite">
                    {!remoteMediaState.camera && <span><b>Camera off</b>{selectedChatContact?.name || 'Partner'} turned off camera</span>}
                    {!remoteMediaState.mic && <span><b>Mic off</b>{selectedChatContact?.name || 'Partner'} muted microphone</span>}
                    {!remoteMediaState.translation && <span><b>Translation off</b>{selectedChatContact?.name || 'Partner'} paused translation</span>}
                  </div>
                )}
                <div className="unifiedMinimizedTranslation">
                  <span>Live translation <b>{settings.translation.language === 'ISL Gloss' ? 'ISL' : settings.translation.language}</b></span>
                  <strong>{chatCallScreen === 'voice' ? remoteCaption : liveSign?.phrase || 'Waiting for signs'}</strong>
                  <small>{currentSignReference ? `${currentSignReference} · ${activeCallBook}` : `${activeCallBook} · ${captionChannelStatus}`}</small>
                </div>
                <div className="unifiedMinimizedCallControls">
                  <button type="button" className="mini3dCallControl miniRestoreCallControl" onClick={() => { window.signovaDesktop?.restoreCallWindow?.(); setChatCallMinimized(false); }} aria-label="Restore call window"><span className="miniWindowGlyph">□</span></button>
                  <button type="button" className="mini3dCallControl miniCloseCallControl" onClick={endCallSession} aria-label="Close call window"><span className="miniWindowGlyph">×</span></button>
                  <button type="button" className={`mini3dCallControl miniCameraCallControl ${cameraEnabled ? 'activeMiniCallControl' : 'inactiveMiniCallControl'}`} onClick={handleCameraControlClick} onDoubleClick={flipCameraFacingMode} title="Click: camera on/off · Double-click: flip camera" aria-label={cameraEnabled ? 'Turn camera off. Double-click to flip camera.' : 'Turn camera on. Double-click to flip camera.'}><span className="miniCamera3dIcon" aria-hidden="true"><i /><b /></span></button>
                  <button type="button" className={`mini3dCallControl ${micEnabled ? 'activeMiniCallControl' : ''}`} onClick={toggleMicTrack} aria-label={micEnabled ? 'Mute microphone' : 'Turn microphone on'}><RailIcon type="voiceHistory" /></button>
                  <button type="button" className={`mini3dCallControl miniTranslationCallControl ${synapseEnabled ? 'activeMiniCallControl' : 'inactiveMiniCallControl'}`} onClick={toggleCallTranslation} title={synapseEnabled ? 'Pause live translation' : 'Resume live translation'} aria-pressed={synapseEnabled} aria-label={synapseEnabled ? 'Pause live translation' : 'Resume live translation'}><RailIcon type="translate" /></button>
                  <button type="button" className="unifiedMiniEndCall mini3dCallControl" onClick={endCallSession} aria-label="End call"><span className="miniWindowGlyph">☎</span></button>
                </div>
              </div>
            )}
            <div className="unifiedCallLayout">
              <aside className="unifiedCallModeRail" aria-label="Call sections">
                <nav>
                  <button type="button" title="Video Chat" aria-label="Video Chat" className={chatCallScreen === 'video' ? 'activeCallModeRailItem' : ''} onClick={() => setChatCallScreen('video')}><RailIcon type="camera" /><span>Video Chat</span></button>
                  <button type="button" title="Voice Chat" aria-label="Voice Chat" className={chatCallScreen === 'voice' ? 'activeCallModeRailItem' : ''} onClick={() => setChatCallScreen('voice')}><RailIcon type="voiceHistory" /><span>Voice Chat</span></button>
                  <button type="button" title="Library" aria-label="Library" onClick={() => { setChatCallMinimized(true); openPanel('library'); }}><RailIcon type="library" /><span>Library</span></button>
                  <button type="button" title="Call History" aria-label="Call History" className={chatCallHistoryOpen ? 'activeCallModeRailItem' : ''} onClick={() => { setChatCallHistoryOpen((open) => !open); setChatCallMoreOpen(false); }}><RailIcon type="voiceHistory" /><span>Call History</span></button>
                  <button type="button" title="Call Settings" aria-label="Call Settings" className={chatCallMoreOpen ? 'activeCallModeRailItem' : ''} aria-expanded={chatCallMoreOpen} onClick={() => { revealCallControls(true); setChatCallSettingsTab('general'); setChatCallMoreOpen((open) => !open); setChatCallHistoryOpen(false); }}><RailIcon type="settings" /><span>Call Settings</span></button>
                </nav>
                <button type="button" title="Profile" aria-label="Profile" className="unifiedCallRailProfile" onClick={() => { setChatCallMinimized(true); openPanel('profile'); }}><b>S</b><span>Profile</span></button>
              </aside>
              <main className="unifiedCallMain">
                <div className={`unifiedCallVideoStage ${settings.lighting.ringLight ? 'unifiedRingLightActive' : ''}`} style={callVideoFilterStyle} onMouseMove={() => revealCallControls()} onClick={() => revealCallControls()} onFocus={() => revealCallControls(true)}>
                  {chatCallScreen === 'video' ? (
                    chatCallFocus === 'local' ? (
                      cameraEnabled ? (
                        <>
                          <video className="unifiedLocalCallVideo unifiedFilteredCallVideo" autoPlay playsInline muted ref={attachLocalTrackingVideo} />
                          <canvas ref={canvasRef} className={`unifiedHandTrackerOverlay ${settings.feedback.realTimeCorrection ? '' : 'trackerPointsHidden'}`} aria-label="Live hand tracking landmarks" />
                        </>
                      ) : (
                        <div className="unifiedLargeCameraOffFallback">
                          {settings.account.profilePhoto ? <img src={settings.account.profilePhoto} alt="" /> : <b>{accountAvatarInitials}</b>}
                          <strong>Your camera is off</strong>
                        </div>
                      )
                    ) : remoteMediaState.camera ? (
                      <video className="unifiedLocalCallVideo unifiedRemoteCallVideo" autoPlay playsInline ref={attachRemoteCallVideo} />
                    ) : (
                      <div className="unifiedLargeCameraOffFallback partnerLargeCameraOffFallback">
                        <ContactAvatar contact={selectedChatContact || { name: 'Partner', avatarChoice: 'initial' }} className="unifiedLargeProfileAvatar" />
                        <strong>{selectedChatContact?.name || 'Partner'} turned off camera</strong>
                      </div>
                    )
                  ) : (
                    <div className="unifiedVoiceCallSurface"><div className="chatVoiceOrb" aria-hidden="true"><span /><b>Voice</b><em /></div><div className="chatVoicePulse" aria-hidden="true"><i /><i /><i /><i /><i /></div><strong>Voice-to-sign translation active</strong><small>Speak naturally. Signova prepares captions and sign responses.</small></div>
                  )}
                  <span className="unifiedLocalLabel"><i />{chatCallFocus === 'local' ? 'You' : selectedChatContact?.name || 'Partner'}</span>
                  {chatCallScreen === 'video' && (
                    <button type="button" className="unifiedPartnerPreview" onClick={() => setChatCallFocus((focus) => focus === 'local' ? 'remote' : 'local')} aria-label={chatCallFocus === 'local' ? 'Show partner full screen' : 'Show your camera full screen'}>
                      {chatCallFocus === 'local' ? (
                        remoteMediaState.camera ? <video ref={attachRemoteCallVideo} autoPlay playsInline /> : (
                          <span className="unifiedLargePreviewCameraOff">
                            <ContactAvatar contact={selectedChatContact || { name: 'Partner', avatarChoice: 'initial' }} className="unifiedLargePreviewProfileAvatar" />
                          </span>
                        )
                      ) : cameraEnabled ? (
                        <>
                          <video className="unifiedFilteredCallVideo" autoPlay playsInline muted ref={attachLocalTrackingVideo} />
                          <canvas ref={canvasRef} className={`unifiedHandTrackerOverlay unifiedPreviewHandTrackerOverlay ${settings.feedback.realTimeCorrection ? '' : 'trackerPointsHidden'}`} aria-label="Live hand tracking landmarks" />
                        </>
                      ) : (
                        <span className="unifiedLargePreviewCameraOff">
                          {settings.account.profilePhoto ? <img src={settings.account.profilePhoto} alt="" /> : <b>{accountAvatarInitials}</b>}
                        </span>
                      )}
                      <span><i />{chatCallFocus === 'local' ? selectedChatContact?.name || 'Partner' : 'You'}</span><b>{callStatus.includes('connected') ? 'Live' : 'Ready'}</b>
                    </button>
                  )}
                  {(!remoteMediaState.camera || !remoteMediaState.mic || !remoteMediaState.translation) && (
                    <div className="unifiedLargeStatusNotices" aria-live="polite">
                      {!remoteMediaState.camera && <span><b>Camera off</b>{selectedChatContact?.name || 'Partner'} turned off camera</span>}
                      {!remoteMediaState.mic && <span><b>Mic off</b>{selectedChatContact?.name || 'Partner'} muted microphone</span>}
                      {!remoteMediaState.translation && <span><b>Translation off</b>{selectedChatContact?.name || 'Partner'} paused translation</span>}
                    </div>
                  )}
                  <div className={`unifiedTranslationCaption ${callControlsVisible || chatCallMoreOpen ? 'captionAboveCallControls' : 'captionAtVideoBottom'}`} aria-live="polite"><span>Live translation <b>{activeCallLanguage}</b></span><strong>{chatCallScreen === 'voice' ? remoteCaption : liveSign?.phrase || 'Waiting for signs'}</strong><small>{currentSignReference ? `${currentSignReference} · ${activeCallBook}` : `${activeCallBook} · ${captionChannelStatus}`}</small></div>
                </div>
                <div className={`unifiedCallControls unifiedGlassCallControls ${callControlsVisible || chatCallMoreOpen ? 'visibleUnifiedCallControls' : 'hiddenUnifiedCallControls'}`} aria-label="Call controls" onMouseEnter={() => revealCallControls(true)} onMouseLeave={() => revealCallControls()} onFocus={() => revealCallControls(true)}>
                  <button type="button" className={`unifiedTranslationCallControl ${synapseEnabled ? 'activeUnifiedCallControl' : 'inactiveUnifiedCallControl'}`} onClick={toggleCallTranslation} title={synapseEnabled ? 'Pause live translation' : 'Resume live translation'} aria-pressed={synapseEnabled}><RailIcon type="translate" /><span>Translate</span><small>{synapseEnabled ? 'On' : 'Paused'}</small></button>
                  <button type="button" className={`unifiedMediaCallControl ${cameraEnabled ? 'mediaCallControlOn activeUnifiedCallControl' : 'mediaCallControlOff'}`} onClick={handleCameraControlClick} onDoubleClick={flipCameraFacingMode} title="Click: camera on/off · Double-click: flip front/back camera" aria-label={cameraEnabled ? 'Turn camera off. Double-click to flip camera.' : 'Turn camera on. Double-click to flip camera.'}><span className="unifiedCameraStateIcon" aria-hidden="true"><i /><b /></span><span>Camera</span><small>{cameraEnabled ? 'On' : 'Off'}</small></button>
                  <button type="button" className={`unifiedMediaCallControl ${micEnabled ? 'mediaCallControlOn activeUnifiedCallControl' : 'mediaCallControlOff'}`} onClick={toggleMicTrack} aria-label={micEnabled ? 'Mute microphone' : 'Turn microphone on'}><span className="unifiedMicStateIcon" aria-hidden="true"><i /><b /></span><span>Mic</span><small>{micEnabled ? 'On' : 'Muted'}</small></button>
                  {chatCallMoreOpen && createPortal((
                      <div className={`unifiedMoreCallPopover ${premiumDarkMode ? 'premiumDarkMode' : ''}`} role="dialog" aria-label="Call translation settings">
                        <header><span>Call settings</span><button type="button" onClick={() => setChatCallMoreOpen(false)} aria-label="Close call settings">×</button></header>
                        <nav className="unifiedCallSettingsTabs">
                          {[['general', 'Language'], ['light', 'Light'], ['filter', 'Filter']].map(([tab, label]) => <button type="button" key={tab} className={chatCallSettingsTab === tab ? 'activeCallSettingsTab' : ''} onClick={() => setChatCallSettingsTab(tab)}>{label}</button>)}
                        </nav>
                        {chatCallSettingsTab === 'general' && (
                          <div className="unifiedCallSettingsPane">
                            <label><span>Translation language</span><select value={settings.translation.language} onChange={(event) => changeTranslationLanguage(event.target.value)}><option>English</option><option>Hindi</option><option>Hinglish</option><option>ISL Gloss</option></select></label>
                            <label><span>Recognition model</span><select value={settings.ai.model} onChange={(event) => updateSetting('ai', 'model', event.target.value)}><option value="mixed">Auto mixed model</option><option value="isl">ISL sentence model</option><option value="asl">ASL production hierarchy</option><option value="asl_top300">ASL Top 300 model</option><option value="asl_top500">ASL Top 500 model</option><option value="basic">Quick gesture model</option></select></label>
                            <label><span>Translation mode</span><select value={settings.translation.mode} onChange={(event) => updateSetting('translation', 'mode', event.target.value)}><option value="word">Word · Word Level Signs Book</option><option value="sentence">Sentence · Sentence Level Signs Book</option></select></label>
                            <label className="unifiedCallToggle"><input type="checkbox" checked={voiceEnabled} onChange={(event) => setVoiceEnabled(event.target.checked)} /><span>Voice output</span></label>
                            <label className="unifiedCallToggle"><input type="checkbox" checked={settings.feedback.realTimeCorrection} onChange={(event) => updateSetting('feedback', 'realTimeCorrection', event.target.checked)} /><span>Hand tracking points</span></label>
                          </div>
                        )}
                        {chatCallSettingsTab === 'light' && (
                          <div className="unifiedCallSettingsPane">
                            <label className="unifiedCallToggle"><input type="checkbox" checked={settings.lighting.ringLight} onChange={(event) => updateSetting('lighting', 'ringLight', event.target.checked)} /><span>Ring light</span></label>
                            <label className="unifiedCallRange"><span>Brightness <b>{settings.lighting.brightness}%</b></span><input type="range" min="20" max="100" value={settings.lighting.brightness} onChange={(event) => updateSetting('lighting', 'brightness', Number(event.target.value))} /></label>
                            <label className="unifiedCallToggle"><input type="checkbox" checked={settings.lighting.autoLowLight} onChange={(event) => updateSetting('lighting', 'autoLowLight', event.target.checked)} /><span>Auto low-light correction</span></label>
                            <label className="unifiedCallToggle"><input type="checkbox" checked={settings.lighting.aiEnhancement} onChange={(event) => updateSetting('lighting', 'aiEnhancement', event.target.checked)} /><span>AI hand-edge enhancement</span></label>
                          </div>
                        )}
                        {chatCallSettingsTab === 'filter' && (
                          <div className="unifiedCallSettingsPane">
                            <label className="unifiedCallToggle"><input type="checkbox" checked={settings.filters.enabled} onChange={(event) => updateSetting('filters', 'enabled', event.target.checked)} /><span>Enable camera filters</span></label>
                            <div className="unifiedCallPresetGrid">{['natural', 'clear', 'warm', 'cool'].map((preset) => <button type="button" key={preset} className={settings.filters.preset === preset ? 'activeCallPreset' : ''} onClick={() => updateSetting('filters', 'preset', preset)}>{preset}</button>)}</div>
                            <label className="unifiedCallRange"><span>Beauty smoothing <b>{settings.filters.beautyLevel || 0}%</b></span><input type="range" min="0" max="100" value={settings.filters.beautyLevel || 0} onChange={(event) => updateSetting('filters', 'beautyLevel', Number(event.target.value))} /></label>
                            <label className="unifiedCallToggle"><input type="checkbox" checked={settings.filters.contrastEnhancement} onChange={(event) => updateSetting('filters', 'contrastEnhancement', event.target.checked)} /><span>Contrast enhancement</span></label>
                            <label className="unifiedCallToggle"><input type="checkbox" checked={settings.filters.skinOptimization} onChange={(event) => updateSetting('filters', 'skinOptimization', event.target.checked)} /><span>Skin and hand optimization</span></label>
                          </div>
                        )}
                      </div>
                  ), document.body)}
                  <button type="button" className="unifiedEndCallButton" onClick={endCallSession}><span>☎</span><b>End call</b></button>
                </div>
              </main>
              <aside className="unifiedCallInfoPanel">
                {chatCallHistoryOpen ? (
                  <section className="unifiedCallTemporaryHistory"><span>Current call translations</span><small>Cleared automatically when the call ends.</small>{callTranscript.length ? callTranscript.map((item) => <div key={item.id}><strong>{item.text}</strong><small>{item.voiceStatus} · {item.time}</small></div>) : <p>No translations yet.</p>}</section>
                ) : (
                  <>
                    <section><span>Sign accuracy</span><strong>{formatConfidence(liveSign?.confidence || 0)}</strong><div className="unifiedAccuracyBar"><i style={{ width: `${callConfidencePercent}%` }} /></div><div className="unifiedAccuracyMetrics"><span><b>{formatConfidence(liveSign?.qualityScore || 0)}</b>Hand</span><span><b>{formatConfidence(liveSign?.stability || 0)}</b>Stable</span><span><b>{liveSign?.sequenceLength || 0}/{TEMPORAL_BUFFER_SIZE}</b>Sequence</span></div></section>
                    <section className="unifiedCallSignTelemetry">
                      <span>Sign model telemetry</span>
                      <strong>{liveSign?.label ? `${currentSignNumber ? `#${currentSignNumber} · ` : ''}${liveSign.label}` : 'Waiting for sign'}</strong>
                      <small>{callVocabularySize || 0} {activeCallLanguage} signs available · {currentSignModel}</small>
                      <em className="unifiedActiveBook">{activeCallBook}</em>
                      <div className="unifiedTelemetryMetrics">
                        <span><b>{callSignTelemetry.attempts}</b>Attempts</span>
                        <span><b>{callSignTelemetry.accepted}</b>Accepted</span>
                        <span><b>{callSignTelemetry.uncertain}</b>Weak</span>
                        <span><b>{callSignTelemetry.unique.length}</b>Unique</span>
                      </div>
                    </section>
                    <section><span>Call quality</span><strong>{callQualityState.title}</strong><small>{cameraQuality.label} · {cameraQuality.width || 1920}×{cameraQuality.height || 1080} · {settings.camera.fps}fps</small></section>
                    <section><span>Connection</span><strong>{captionChannelRef.current ? 'Secure & synced' : 'Secure & encrypted'}</strong><small>{captionChannelStatus}</small><button type="button" onClick={startWebRtcPreview}>{callStatus.includes('connected') ? 'Reconnect' : 'Connect WebRTC'}</button></section>
                    <section><span>Participants</span><div className="unifiedParticipant"><b>S</b><span><strong>You</strong><small>{micEnabled ? 'Speaking ready' : 'Muted'}</small></span><em>Local</em></div><div className="unifiedParticipant"><b>P</b><span><strong>{selectedChatContact?.name || 'Partner'}</strong><small>{callStatus}</small></span><em>Remote</em></div></section>
                  </>
                )}
              </aside>
            </div>
          </section>
        )}
        {selectedChatFlags.locked ? (
          <section className="chatLockedCanvas" aria-label="Locked chat">
            <div className="chatLockOrb" aria-hidden="true">
              <span />
              <b>🔒</b>
            </div>
            <span>Private Chat</span>
            <strong>{selectedChatContact?.name || 'This chat'} is locked</strong>
            <small>{selectedChatFlags.passwordSet ? 'Enter the chat password to continue messaging.' : 'Unlock this chat from the menu or use the button below to continue messaging.'}</small>
            <button type="button" onClick={unlockSelectedChat}>Unlock chat</button>
          </section>
        ) : (
        <>
        <section className="messageThread" aria-label="Signova chat">
          {visibleChatMessages.map((message) => {
            const isOutgoing = message.direction === 'outgoing';
            const selected = selectedMessageIds.includes(message.id);
            const mutable = canModifyMessage(message);
            const reactionOpen = reactionMessageId === message.id;
            const toolOpen = toolMessageId === message.id;
            const emojiOpen = emojiPickerMessageId === message.id;
            const isTextMessage = !message.attachmentType;
            const canCopyMessage = isTextMessage || ['contact', 'meet', 'poll', 'sticker'].includes(message.attachmentType);
            const canTranslateMessage = isTextMessage;
            const canEditTextMessage = isOutgoing && mutable && isTextMessage;
            const canUnsendMessage = isOutgoing && mutable;
            return (
              <article
                className={[
                  'messageBubble',
                  isOutgoing ? 'outgoingBubble' : 'incomingBubble',
                  reactionOpen || toolOpen || emojiOpen ? 'activeMessageBubble' : '',
                  selected ? 'selectedMessageBubble' : '',
                  message.pinned ? 'pinnedMessageBubble' : '',
                  message.starred ? 'starredMessageBubble' : '',
                ].filter(Boolean).join(' ')}
                key={message.id}
                onClick={() => handleMessageClick(message)}
                onDoubleClick={(event) => openReactionWindow(event, message.id)}
                onContextMenu={(event) => openToolWindow(event, message.id)}
              >
                <div className="messageBubbleTopline" aria-hidden={!message.pinned && !message.starred && !message.forwarded && !message.edited}>
                  {message.pinned ? <span><Attach3DIcon type="pin" />Pinned</span> : null}
                  {message.starred ? <span><Attach3DIcon type="heart" />Starred</span> : null}
                  {message.forwarded ? <span>Forwarded</span> : null}
                  {message.edited ? <span>Edited {message.editedAt}</span> : null}
                </div>
                {message.attachmentType ? (
                  <SpecialMessageCard
                    message={message}
                    isOutgoing={isOutgoing}
                    onEditContact={() => editSharedContact(message)}
                    onAddContact={() => addSharedContact(message)}
                    onVotePoll={(optionIndex) => voteAudiencePoll(message, optionIndex)}
                    onEditMeet={() => editMeetMoment(message)}
                    onSaveMeetDetail={(target) => saveMeetDetail(message, target)}
                    audioSpeed={audioPlaybackRates[message.id] || 1}
                    onAudioSpeedChange={(rate) => updateAudioPlaybackRate(message.id, rate)}
                  />
                ) : (
                  <p>{message.text}</p>
                )}
                {message.translatedText ? (
                  <div className="messageTranslationResult">
                    <span>{message.translatedLanguage}</span>
                    <strong>{message.translatedText}</strong>
                    <small>Voice played · {message.translatedAt}</small>
                  </div>
                ) : null}
                {isOutgoing ? (
                  <small className="outgoingReceiptLine">
                    <span className="outgoingActivityTicker">
                      <em>{message.encrypted ? 'Local session protected' : 'Not protected'}</em>
                      <em>{message.status || 'sent'}</em>
                      <em>{message.sentAt || message.time}</em>
                    </span>
                    <span className="outgoingSeenState">
                      <b className={message.seenGlow ? 'receiptTicks readReceiptTicks' : 'receiptTicks'}>{messageReceiptLabel(message)}</b>
                      <strong>{settings.privacy.readReceipts && message.readAt ? `Seen ${message.readAt}` : 'Not seen'}</strong>
                    </span>
                  </small>
                ) : (
                  <small className="messageLiveActivity">
                    <span className="incomingActivityTicker">
                      <em>{message.encrypted ? 'Local session protected' : 'Not protected'}</em>
                      <em>{message.liveActivity || message.status || 'Live activity ready'}</em>
                      <em>{message.time}</em>
                    </span>
                  </small>
                )}
                {message.reactions?.length ? <em className="messageReactionLine">{message.reactions.join(' ')}</em> : null}
                {reactionOpen ? (
                  <div className="messageReactionWindow" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="React to message">
                    {MESSAGE_QUICK_REACTIONS.map((reaction) => (
                      <button type="button" key={reaction} title={`React ${reaction}`} aria-label={`React ${reaction}`} onClick={() => reactFromWindow(message.id, reaction)}>
                        {reaction}
                      </button>
                    ))}
                    <button type="button" className="moreEmojiButton" title="More reactions" aria-label="More reactions" onClick={() => setEmojiPickerMessageId((currentId) => (currentId === message.id ? '' : message.id))}>+</button>
                  </div>
                ) : null}
                {emojiOpen ? (
                  <div className="messageEmojiPicker" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Emoji reactions">
                    {MESSAGE_EMOJI_REACTIONS.map((reaction) => (
                      <button type="button" key={reaction} title={`React ${reaction}`} aria-label={`React ${reaction}`} onClick={() => reactFromWindow(message.id, reaction)}>
                        {reaction}
                      </button>
                    ))}
                  </div>
                ) : null}
                {toolOpen ? (
                <div className="messageToolWindow" onClick={(event) => event.stopPropagation()} role="menu" aria-label="Message tools">
                  {canCopyMessage ? <button type="button" title="Copy" aria-label="Copy message" onClick={() => runMessageTool(() => copyMessage(message))}><Attach3DIcon type="copy" /></button> : null}
                  <button type="button" title="Forward" aria-label="Forward message" onClick={() => runMessageTool(() => forwardMessage({ ...message, forwarded: true }))}><Attach3DIcon type="forward" /></button>
                  <button type="button" title={selected ? 'Unselect' : 'Select'} aria-label={selected ? 'Unselect message' : 'Select message'} onClick={() => runMessageTool(() => toggleSelectMessage(message.id))}><Attach3DIcon type="select" /></button>
                  {canTranslateMessage ? <button
                    type="button"
                    title="Translate"
                    aria-label="Translate message"
                    onClick={() => setMessageTranslateMenu((currentId) => (currentId === message.id ? '' : message.id))}
                  >
                    <Attach3DIcon type="translate" />
                  </button> : null}
                  <button type="button" title={message.pinned ? 'Unpin' : 'Pin'} aria-label={message.pinned ? 'Unpin message' : 'Pin message'} onClick={() => runMessageTool(() => toggleMessageFlag(message.id, 'pinned'))}><Attach3DIcon type="pin" /></button>
                  <button type="button" title={message.starred ? 'Unstar' : 'Star'} aria-label={message.starred ? 'Unstar message' : 'Star message'} onClick={() => runMessageTool(() => toggleMessageFlag(message.id, 'starred'))}><Attach3DIcon type="heart" /></button>
                  {isOutgoing ? (
                    <button
                      type="button"
                      title="Message info"
                      aria-label="Message info"
                      onMouseEnter={() => setMessageInfoId(message.id)}
                      onMouseLeave={() => setMessageInfoId('')}
                      onFocus={() => setMessageInfoId(message.id)}
                      onBlur={() => setMessageInfoId('')}
                      onClick={(event) => {
                        event.stopPropagation();
                        setMessageInfoId((currentId) => (currentId === message.id ? '' : message.id));
                      }}
                    >
                      <Attach3DIcon type="info" />
                    </button>
                  ) : null}
                  {message.status === 'failed' && <button type="button" title="Retry" aria-label="Retry message" onClick={() => runMessageTool(() => retryMessage(message.id))}><Attach3DIcon type="retry" /></button>}
                  {canEditTextMessage ? <button type="button" title="Edit" aria-label="Edit message" onClick={() => runMessageTool(() => editMessage(message))}><Attach3DIcon type="edit" /></button> : null}
                  {canUnsendMessage ? <button type="button" title="Unsend" aria-label="Unsend message" onClick={() => runMessageTool(() => unsendMessage(message))}><Attach3DIcon type="unsend" /></button> : null}
                  <button type="button" title="Delete" aria-label="Delete message" onClick={() => runMessageTool(() => markMessageDeleted(message.id))}><Attach3DIcon type="trash" /></button>
                </div>
                ) : null}
                {messageInfoId === message.id ? (
                  <div className="messageInfoPopover" onMouseEnter={() => setMessageInfoId(message.id)} onMouseLeave={() => setMessageInfoId('')} onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Message live activity information">
                    <span>Message info</span>
                    <strong>{message.status === 'read' ? 'Read by receiver' : message.status === 'delivered' ? 'Delivered to receiver' : 'Sending securely'}</strong>
                    <small>Sent: {message.sentAt || message.time || 'Now'}</small>
                    <small>Delivered: {message.deliveredAt || 'Waiting'}</small>
                    <small>Read: {settings.privacy.readReceipts && message.readAt ? message.readAt : 'Not seen yet'}</small>
                    <small>Receiver: {selectedChatPresence?.status || 'Offline'} · {selectedChatPresence?.detail || 'Last seen unavailable'}</small>
                    <small>Security: {message.encrypted ? 'Protected by a temporary local-session key; not E2EE' : 'Not protected'}</small>
                  </div>
                ) : null}
                {messageTranslateMenu === message.id ? (
                  <div className="messageTranslatePopover" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Translate message">
                    <span>Translate message</span>
                    <button type="button" onClick={() => translateMessage(message, 'Hindi')}>
                      <Attach3DIcon type="translate" />
                      <strong>English to Hindi</strong>
                      <small>Translate + voice</small>
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>

        <form className={composerSending ? 'chatComposer composerSending' : 'chatComposer'} onSubmit={sendChatMessage}>
          {scheduleComposerOpen && (
            <section className="scheduleSendPanel" aria-label="Schedule message">
              <div>
                <span>Schedule send</span>
                <strong>When should this message go?</strong>
              </div>
              <input type="date" value={scheduleForm.date} onChange={(event) => setScheduleForm({ ...scheduleForm, date: event.target.value })} />
              <input type="time" value={scheduleForm.time} onChange={(event) => setScheduleForm({ ...scheduleForm, time: event.target.value })} />
              <input type="text" value={scheduleForm.note} onChange={(event) => setScheduleForm({ ...scheduleForm, note: event.target.value })} placeholder="Optional note" />
              <button type="button" onClick={scheduleDraftMessage}>Schedule</button>
              <button type="button" onClick={() => setScheduleComposerOpen(false)}>Close</button>
            </section>
          )}
          {chatDraft.trim() ? (
            <div className="composerLiveActivity" aria-live="polite">
              <span>Encrypting before send</span>
              <b>{chatDraft.length > 48 ? `${chatDraft.slice(0, 48)}...` : chatDraft}</b>
            </div>
          ) : null}
          {composerPickerOpen && (
            <section className="composerPickerPanel" aria-label="Signova composer picker">
              <nav className="composerPickerTabs" aria-label="Composer picker categories">
                {[
                  ['emoji', 'Emoji', '😊'],
                  ['signs', 'Signs', '🤟'],
                  ['stickers', 'Stickers', '✨'],
                ].map(([tab, label, icon]) => (
                  <button type="button" className={composerPickerTab === tab ? 'activeComposerPickerTab' : ''} key={tab} onClick={() => setComposerPickerTab(tab)}>
                    <span>{icon}</span>
                    <strong>{label}</strong>
                  </button>
                ))}
              </nav>
              {composerPickerTab === 'emoji' && (
                <div className="composerEmojiGrid">
                  {COMPOSER_EMOJIS.map((emoji) => (
                    <button type="button" key={emoji} onClick={() => selectComposerEmoji(emoji)}>{emoji}</button>
                  ))}
                </div>
              )}
              {composerPickerTab === 'signs' && (
                <div className="composerSignGrid">
                  <button type="button" className="composerUseLiveSign" onClick={useTranslationAsMessage}>
                    <Attach3DIcon type="translate" />
                    <span>Use live sign</span>
                    <small>{sentence !== 'Waiting for signs' ? sentence : caption}</small>
                  </button>
                  {signLibrary.slice(0, 12).map((sign) => (
                    <button type="button" key={`${sign.label}-${sign.sign}`} onClick={() => selectComposerSign(sign)}>
                      <span>{String(sign.sign || sign.label).slice(0, 2).toUpperCase()}</span>
                      <strong>{sign.sign || sign.label}</strong>
                      <small>{sign.hint || sign.source || 'Signova sign'}</small>
                    </button>
                  ))}
                </div>
              )}
              {composerPickerTab === 'stickers' && (
                <div className="composerStickerGrid">
                  {GESTURE_STICKERS.map((sticker) => (
                    <button type="button" key={sticker.label} onClick={() => selectComposerSticker(sticker)}>
                      <b>{sticker.emoji}</b>
                      <span>{sticker.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
          <div className="attachMenuWrap">
            <button
              type="button"
              className={attachMenuOpen ? 'attachButton activeAttachButton' : 'attachButton'}
              title="Open Signova attachments"
              aria-label="Open Signova attachments"
              aria-expanded={attachMenuOpen}
              onClick={() => setAttachMenuOpen((open) => !open)}
            >
              +
            </button>
            <input
              ref={attachmentInputRef}
              className="hiddenAttachmentInput"
              type="file"
              multiple
              accept={attachmentAccept}
              onChange={handleDriveUpload}
            />
            {attachMenuOpen && (
              <div className="signovaAttachMenu" role="menu" aria-label="Signova attachment options">
                <div className="signovaAttachBrand" aria-hidden="true">
                  <Attach3DIcon type="sticker" />
                  <div>
                    <strong>Signova Attach</strong>
                  </div>
                </div>
                {[
                  ['document', 'Vault Docs'],
                  ['gallery', 'Memory Gallery'],
                  ['camera', 'Live Camera Clip'],
                  ['audio', 'Music / Audio Note'],
                  ['contact', 'Signova Contact'],
                  ['poll', 'Audience Poll'],
                  ['event', 'Meet Moment'],
                  ['sticker', 'Gesture Sticker'],
                ].map(([action, label]) => (
                  <button type="button" role="menuitem" key={action} onClick={() => handleAttachmentAction(action)}>
                    <Attach3DIcon type={action} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className={composerPickerOpen ? 'composerSignButton activeComposerSignButton' : 'composerSignButton'}
            onClick={() => setComposerPickerOpen((open) => !open)}
            aria-label="Open emoji signs and stickers"
            title="Emoji, signs, stickers"
          >
            <span className="composerReactionFamilyIcon" aria-hidden="true">
              <i>😊</i>
              <i>🤟</i>
              <i>✨</i>
              <i>💬</i>
            </span>
          </button>
          <button type="button" className="voiceComposerButton" onClick={voiceNote.active ? toggleVoicePause : startVoiceNote} aria-label="Record voice note" title="Voice note">
            <Attach3DIcon type="audio" />
          </button>
          {voiceNote.active ? (
            <div className="voiceNoteComposerBar" aria-label="Voice note recording">
              <span className={voiceNote.paused ? 'pausedVoiceDot' : 'recordingVoiceDot'} />
              <strong>{formatVoiceTime(voiceNote.seconds)}</strong>
              <small>{voiceNote.paused ? 'Paused' : 'Recording'}</small>
              <button type="button" onClick={toggleVoicePause}>{voiceNote.paused ? 'Resume' : 'Pause'}</button>
              <button type="button" onClick={addVoiceNote}>Add</button>
              <button type="button" className="voiceDeleteButton" onClick={deleteVoiceNote}>Delete</button>
            </div>
          ) : (
            <input
              value={chatDraft}
              onChange={(event) => setChatDraft(event.target.value)}
              placeholder="Type a message"
              aria-label="Message"
            />
          )}
          <button
            type="button"
            className="sendIconButton"
            onPointerDown={startSendLongPress}
            onPointerUp={stopSendLongPress}
            onPointerLeave={stopSendLongPress}
            onPointerCancel={stopSendLongPress}
            onClick={handleSendIconClick}
            aria-label="Send message. Long press to schedule."
            title="Send. Long press to schedule."
          >
            <span className="signovaSendGlyph" aria-hidden="true">
              <i />
            </span>
          </button>
        </form>
        </>
        )}
        </>
        )}
      </main>

      {activePanel !== 'chats' && activePanel !== 'translate' && (
      <aside ref={signToolsPaneRef} className="signToolsPane">
        {activePanel === 'drive' && <ProgressScrollRail targetRef={signToolsPaneRef} />}
        <div className="workRail">
          {activePanel === 'profile' && (
            <section className="profilePage" aria-label="Signova profile page">
              <header className="profileHeroCard">
                <div className="profilePhotoBlock">
                  <label className={isSignovaProActive ? 'profilePhoto proProfilePhoto' : 'profilePhoto'} title="Upload profile photo">
                    {settings.account.profilePhoto ? (
                      <img src={settings.account.profilePhoto} alt={`${settings.account.name} profile`} />
                    ) : (
                      <span>{accountAvatarInitials}</span>
                    )}
                    <input type="file" accept="image/*" onChange={handleProfilePhotoUpload} aria-label="Upload profile photo" />
                    <em aria-hidden="true">+</em>
                    {isSignovaProActive && <b className="profileProCrown" aria-label={signovaProBadgeLabel}>PRO</b>}
                  </label>
                  <div className="profileCompletionRing" style={{ '--profile-completion': `${profileCompletion}%` }}>
                    <strong>{profileCompletion}%</strong>
                    <small>Complete</small>
                  </div>
                </div>
                <div className="profileHeroText">
                  <span>Signova Profile</span>
                  <strong>{settings.account.name}</strong>
                  <small>{settings.account.username} · {settings.account.preferredSignLanguage} learner {isSignovaProActive ? `· ${signovaProBadgeLabel}` : ''}</small>
                  {isSignovaProActive && <div className="profileProBadge"><span>✦</span><strong>{signovaProBadgeLabel}</strong><small>{signovaProDaysLeft} days left</small></div>}
                  <label className="profileAboutNote">
                    <span>About Me</span>
                    <textarea
                      value={settings.account.about}
                      onChange={(event) => updateSetting('account', 'about', event.target.value)}
                      placeholder="I am learning Indian Sign Language..."
                    />
                  </label>
                </div>
                <aside className="profileQrCard realProfileQrCard" aria-label="QR profile sharing">
                  <button type="button" className="profileQrPreviewButton" onClick={() => setProfileQrOpen((open) => !open)} aria-expanded={profileQrOpen}>
                    {profileQrDataUrl ? <img src={profileQrDataUrl} alt={`${settings.account.name} Signova profile QR code`} /> : (
                      <div className="qrArt signovaProfileQrCode" aria-hidden="true">
                        <span /><span /><span /><i /><i /><i />
                      </div>
                    )}
                  </button>
                  <strong>Profile QR</strong>
                  <em>{settings.account.username}</em>
                  <small>{settings.privacy.qrSharing ? 'Scan to open public profile.' : 'QR sharing is private.'}</small>
                  <div className="profileQrActions">
                    <button type="button" onClick={copyProfileShareLink}>Copy</button>
                    <button type="button" onClick={shareProfileQr}>Share</button>
                    <button type="button" onClick={downloadProfileQr} disabled={!profileQrDataUrl}>Save</button>
                  </div>
                  <button type="button" className="profileQrScanButton" onClick={() => setProfileQrOpen((open) => !open)}>
                    Scan QR
                  </button>
                  {profileQrOpen && (
                    <div className="profileQrScanPanel">
                      <input ref={profileQrScanInputRef} type="file" accept="image/*" onChange={scanProfileQrImage} aria-label="Upload QR image to scan" hidden />
                      <button type="button" onClick={() => profileQrScanInputRef.current?.click()}>Upload QR image</button>
                      <label>
                        <span>Paste profile link</span>
                        <input value={profileQrManualValue} onChange={(event) => setProfileQrManualValue(event.target.value)} placeholder="https://.../#/profile/username" />
                      </label>
                      <button type="button" onClick={() => openScannedProfile(profileQrManualValue)}>Open scanned profile</button>
                      {profileQrMessage && <small>{profileQrMessage}</small>}
                    </div>
                  )}
                </aside>
              </header>

              <div className="profileLayout">
                <div className="profileColumn">
                  <section className="profileCard">
                    <div className="profileCardHeader">
                      <span>Basic Info</span>
                      <strong>Your identity details</strong>
                    </div>
                    <div className="profileFormGrid">
                      <label><span>First name</span><input value={settings.account.firstName} onChange={(event) => updateSetting('account', 'firstName', event.target.value)} /></label>
                      <label><span>Last name</span><input value={settings.account.lastName} onChange={(event) => updateSetting('account', 'lastName', event.target.value)} /></label>
                      <label><span>Username</span><input value={settings.account.username} onChange={(event) => updateSetting('account', 'username', normalizeUsername(event.target.value))} /></label>
                      <label><span>Preferred language</span><select value={settings.account.preferredLanguage} onChange={(event) => updateSetting('account', 'preferredLanguage', event.target.value)}><option>English</option><option>Hindi</option><option>Hinglish</option><option>ISL Gloss</option></select></label>
                      <label><span>City</span><input value={settings.account.city} onChange={(event) => updateSetting('account', 'city', event.target.value)} /></label>
                      <label><span>Country</span><input value={settings.account.country} onChange={(event) => updateSetting('account', 'country', event.target.value)} /></label>
                    </div>
                  </section>

                  <section className="profileCard">
                    <div className="profileCardHeader">
                      <span>Sign Language Profile</span>
                      <strong>How Signova should support you</strong>
                    </div>
                    <label className="profileFieldWide"><span>User type</span><select value={settings.account.userType} onChange={(event) => updateSetting('account', 'userType', event.target.value)}><option>Deaf</option><option>Hard of Hearing</option><option>Mute</option><option>Sign Language Learner</option><option>Interpreter</option><option>Teacher</option><option>Parent</option><option>General User</option></select></label>
                    <div className="profileChipGroup" aria-label="Preferred sign language">
                      {['ISL', 'ASL', 'BSL', 'Other'].map((language) => (
                        <button type="button" key={language} className={settings.account.preferredSignLanguage === language ? 'activeProfileChip' : ''} onClick={() => updateSetting('account', 'preferredSignLanguage', language)}>{language}</button>
                      ))}
                    </div>
                    <div className="profileChipGroup" aria-label="Skill level">
                      {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
                        <button type="button" key={level} className={settings.account.signSkillLevel === level ? 'activeProfileChip' : ''} onClick={() => updateSetting('account', 'signSkillLevel', level)}>{level}</button>
                      ))}
                    </div>
                  </section>

                </div>

                <div className="profileColumn">
                  <section className="profileCard signovaProProfileCard">
                    <div className="profileCardHeader">
                      <span>Signova Pro</span>
                      <strong>{isSignovaProActive ? signovaProBadgeLabel : 'Unlock premium access'}</strong>
                    </div>
                    <div className="signovaProMiniIcon" aria-hidden="true"><i /><b /><em>PRO</em></div>
                    <p>First 2 months are free for everyone. Pro badge appears on your public profile after activation.</p>
                    <div className="profileStatusList">
                      <span><b>{settings.account.proPlan || '2 months free Pro'}</b><small>Current plan</small></span>
                      <span><b>{isSignovaProActive ? `${signovaProDaysLeft} days` : 'Ready'}</b><small>Trial / access remaining</small></span>
                      <span><b>{settings.account.studentVerified ? 'Verified' : 'Not verified'}</b><small>Student ID</small></span>
                    </div>
                    <button type="button" className="profilePrimaryAction" onClick={() => openPanel('signovaPro')}>Open Signova Pro</button>
                  </section>

                  <section className="profileCard">
                    <div className="profileCardHeader">
                      <span>Learning Progress</span>
                      <strong>Practice growth</strong>
                    </div>
                    <div className="profileProgressGrid">
                      <span><strong>{profileStats.completed}</strong><small>Lessons</small></span>
                      <span><strong>{profileStats.streak}</strong><small>Day streak</small></span>
                      <span><strong>{profileStats.accuracy}%</strong><small>Accuracy</small></span>
                    </div>
                    <div className="profileTagBlock">
                      <span>Favorite signs</span>
                      <div>{profileStats.favoriteSigns.map((sign) => <b key={sign}>{sign}</b>)}</div>
                    </div>
                    <div className="profileTagBlock weakSignsBlock">
                      <span>Weak signs</span>
                      <div>{profileStats.weakSigns.map((sign) => <b key={sign}>{sign}</b>)}</div>
                    </div>
                    <div className="profileBadges">
                      <b>First Lesson</b>
                      <b>Streak Builder</b>
                      <b>ISL Explorer</b>
                    </div>
                  </section>

                </div>
              </div>
            </section>
          )}

          {activePanel === 'signovaPro' && (
            <section className="signovaProPage" aria-label="Signova Pro subscription page">
              <header className="signovaProHero">
                <button type="button" onClick={() => openPanel('profile')} aria-label="Back to profile">‹</button>
                <div>
                  <span>Signova Pro</span>
                  <strong>Premium access for sign language communication.</strong>
                  <small>First 2 months are free for everyone. Student ID verification unlocks student Pro identity.</small>
                </div>
                <div className={isSignovaProActive ? 'signovaProHeroBadge activeProHeroBadge' : 'signovaProHeroBadge'}>
                  <i aria-hidden="true" />
                  <b>{isSignovaProActive ? 'PRO' : 'FREE'}</b>
                  <small>{isSignovaProActive ? `${signovaProDaysLeft} days left` : '2 months free'}</small>
                </div>
              </header>

              <main className="signovaProLayout">
                <section className="signovaProCard signovaProPlanCard">
                  <div className="signovaProMiniIcon largeProIcon" aria-hidden="true"><i /><b /><em>PRO</em></div>
                  <span>Recommended</span>
                  <strong>2 months free Pro</strong>
                  <p>Start without payment, show Pro status on profile, and unlock advanced Signova learning tools.</p>
                  <div className="signovaProFeatureGrid">
                    <b>Unlimited practice</b>
                    <b>AI feedback</b>
                    <b>Video sign chat</b>
                    <b>Profile Pro badge</b>
                    <b>Priority learning tools</b>
                    <b>Certificates ready</b>
                  </div>
                  <button type="button" className="signovaProPrimaryButton" disabled title="Server-side subscriptions are not connected yet">
                    Subscriptions coming later
                  </button>
                </section>

                <section className="signovaProCard">
                  <div className="profileCardHeader">
                    <span>Student verification</span>
                    <strong>Verify student ID</strong>
                  </div>
                  <p>Upload a student ID card. In production this should go to secure storage and be reviewed or verified with your institution rules.</p>
                  <label className="studentIdUploadCard">
                    <input type="file" accept="image/*,.pdf" disabled />
                    <span>▣</span>
                    <strong>{settings.account.studentVerified ? 'Student ID verified' : 'Verification unavailable'}</strong>
                    <small>{settings.account.studentIdFileName || 'Secure verification service is not connected yet'}</small>
                  </label>
                  <label className="profileFieldWide">
                    <span>Institution name</span>
                    <input value={settings.account.studentInstitution} onChange={(event) => updateSetting('account', 'studentInstitution', event.target.value)} placeholder="School / college / university" />
                  </label>
                  <div className="profileStatusList">
                    <span><b>{settings.account.studentVerified ? 'Verified' : 'Pending'}</b><small>Student status</small></span>
                    <span><b>{settings.account.studentVerified ? 'Student Pro' : 'Upload required'}</b><small>Discount profile</small></span>
                  </div>
                </section>

                <section className="signovaProCard">
                  <div className="profileCardHeader">
                    <span>Pricing after trial</span>
                    <strong>Simple plan ladder</strong>
                  </div>
                  <div className="signovaPricingRows">
                    <span><b>Free</b><strong>₹0</strong><small>Basic learning and limited practice</small></span>
                    <span><b>Student Pro</b><strong>₹99/mo</strong><small>Verified student identity + Pro badge</small></span>
                    <span><b>Signova Pro</b><strong>₹199/mo</strong><small>AI feedback, video sign chat, progress tools</small></span>
                    <span><b>Institution</b><strong>₹2,999+</strong><small>Bulk dashboards for schools and NGOs</small></span>
                  </div>
                  <button type="button" className="profilePrimaryAction" disabled title="Payment verification must be completed by the server">
                    Payment service not connected
                  </button>
                </section>

                <section className="signovaProCard signovaProPublicCard">
                  <div className="profileCardHeader">
                    <span>Public visibility</span>
                    <strong>How others see your Pro status</strong>
                  </div>
                  <div className="proPublicPreview">
                    <span className="communityAvatar proCommunityAvatar"><em>{communityAvatarInitials}</em><b className="communityProMark">PRO</b></span>
                    <div>
                      <strong>{communityProfile.name}</strong>
                      <small>{communityProfile.username} · {signovaProBadgeLabel}</small>
                    </div>
                  </div>
                  <p>After Pro activation, your public avatar and posts show a clean Pro badge with a soft animated ring.</p>
                </section>
              </main>
            </section>
          )}

          {activePanel === 'translate' && (
            <>
              <section className="toolSummary">
                <div>
                  <span>Synapse Engine</span>
                  <strong>{synapseEnabled ? 'Active for signs' : 'Off for normal video'}</strong>
                </div>
                <button type="button" onClick={() => updateSynapseEnabled((enabled) => !enabled)}>
                  {synapseEnabled ? 'Deactivate' : 'Activate'}
                </button>
              </section>
              <section className="panel livePanel">
                <div className="panelHeader">
                  <span>Live detection</span>
                  <strong>{liveSign?.phrase || 'Waiting for hands'}</strong>
                </div>
                <div className="confidenceTrack" aria-label="Current prediction confidence">
                  <span style={{ width: liveSign ? `${Math.min(100, Math.round(liveSign.confidence * 100))}%` : '0%' }} />
                </div>
                <p className="liveHint">
                  {liveSign?.isStable ? 'Sign locked. It is added to your sentence.' : learningFeedback}
                </p>
                <div className="signalGrid">
                  <span>Sequence {liveSign?.sequenceLength || 0}/{TEMPORAL_BUFFER_SIZE}</span>
                  <span>Stability {formatConfidence(liveSign?.stability || 0)}</span>
                  <span>Frame {formatConfidence(liveSign?.qualityScore || 0)}</span>
                </div>
              </section>

              <section className="panel sentencePanel">
                <div className="panelHeader">
                  <span>Sentence</span>
                  <strong>{sentence}</strong>
                </div>
                <div className="actionRow">
                  <button type="button" onClick={copySentence}>Copy</button>
                  <button type="button" className="secondaryButton" onClick={clearSentence}>Clear</button>
                </div>
              </section>

              <section className="panel historyPanel">
                <div className="panelHeader">
                  <span>Recent signs</span>
                  <strong>{latestHistory.length ? `${latestHistory.length} detected` : 'Listening'}</strong>
                </div>
                <div className="historyList">
                  {latestHistory.length ? latestHistory.map((item) => (
                    <div className="historyItem" key={`${item.label}-${item.time}`}>
                      <span>{item.phrase}</span>
                      <small>{formatConfidence(item.confidence)} - {item.time}</small>
                    </div>
                  )) : <p>No predictions yet</p>}
                </div>
              </section>
            </>
          )}

          {activePanel === 'library' && (
            <section className={`libraryDashboard ${openLibraryBook ? 'libraryDashboardModalOpen' : ''}`} aria-label="Signova full library">
              <header className="libraryTopBar">
                <div className="libraryTopIdentity">
                  <span>Signova Library</span>
                </div>
                <div className="libraryTopActions">
                  <label className="librarySearch">
                    <span className="librarySearchIcon" aria-hidden="true">
                      <i />
                    </span>
                    <input
                      type="search"
                      value={signSearch}
                      onChange={(event) => setSignSearch(event.target.value)}
                      placeholder="Search signs and lessons"
                      aria-label="Search Signova library"
                    />
                    <em>{filteredSigns.length}</em>
                  </label>
                  <button type="button" className="libraryIconButton" onClick={() => setActivePanel('learn')} aria-label="Open Learn page">
                    <span className="librarySketchLearnIcon" aria-hidden="true">
                      <i />
                    </span>
                    <small>Learn</small>
                  </button>
                </div>
              </header>

              <section className="libraryHeroSpace">
                <div className="libraryHeroCopy">
                  <span className="libraryHeroEyebrow">Your sign-learning shelf</span>
                  <h2>What do you want to learn?</h2>
                  <p>Browse the alphabet, build everyday vocabulary, or practise complete signed sentences.</p>
                  <div className="libraryHeroStats" aria-label="Library lesson counts">
                    {libraryBooks.map((book) => (
                      <span key={`stat-${book.id}`}>
                        <b>{book.pages.length}</b>
                        <small>{book.eyebrow} lessons</small>
                      </span>
                    ))}
                  </div>
                  <div className="libraryHeroActions">
                    <button type="button" onClick={() => openLearningBook('letters')}>Start reading</button>
                    <button type="button" className="libraryBrowseButton" onClick={() => document.querySelector('.learningBookStage')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Browse all books</button>
                  </div>
                </div>
              </section>

              <div className="libraryContentGrid">
                <main className="libraryMainShelf">
                  <section className="librarySectionHeader learningBooksHeader">
                    <div>
                      <span>Learning Shelf</span>
                      <strong>Letters, Words, and Sentences Books</strong>
                    </div>
                    <small>Tap a closed book to open the reader.</small>
                  </section>

                  <section className="learningBookStage" aria-label="Interactive Signova learning books">
                    <div className={`learningBookShelf ${libraryOpeningBookId ? 'hasOpeningBook' : ''}`} role="list">
                      {libraryBooks.map((book, index) => (
                        <motion.button
                          type="button"
                          className={`learningBookCover ${book.tone} ${openLibraryBookId === book.id ? 'activeLearningBook' : ''} ${libraryOpeningBookId === book.id ? 'openingLearningBook' : ''}`}
                          key={book.id}
                          onClick={() => openLearningBook(book.id)}
                          layoutId={`signova-book-${book.id}`}
                          style={{ '--book-delay': `${index * 90}ms` }}
                          aria-pressed={openLibraryBookId === book.id}
                        >
                          <span className="bookSpine" aria-hidden="true" />
                          <span className="bookCoverLabel">{book.eyebrow}</span>
                          <strong>{book.coverTitle}</strong>
                          <i aria-hidden="true">{book.icon}</i>
                          <small>{book.subtitle}</small>
                          <em>{book.pages.length} lessons</em>
                        </motion.button>
                      ))}
                    </div>

                    <aside className="learningBookHint">
                      <strong>Closed books are ready.</strong>
                      <small>Open any module to read signs one page at a time.</small>
                    </aside>
                  </section>
                </main>
              </div>
            </section>
          )}

          {activePanel === 'library' && openLibraryBook && currentLibraryBookPage && createPortal((
              <motion.div
                key={`signs-book-overlay-${openLibraryBook.id}`}
                className="signsBookOverlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.28 }}
                role="dialog"
                aria-modal="true"
                aria-label={`${openLibraryBook.title} opened`}
              >
                <motion.div
                  className="signsBookBackdrop"
                  onClick={closeLearningBook}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                />
                <motion.section
                  key={`signs-book-modal-${openLibraryBook.id}-${libraryBookView}`}
                  className={`signsBookModal ${openLibraryBook.tone} ${libraryBookView === 'reader' ? 'readerMode' : 'coverMode'}`}
                  initial={{ y: 42, scale: 0.88, opacity: 0, rotateX: 8 }}
                  animate={{ y: 0, scale: 1, opacity: 1, rotateX: 0, filter: 'none' }}
                  transition={{ type: 'spring', stiffness: 220, damping: 24, mass: 0.85 }}
                  style={{ filter: 'none' }}
                >
                  <button type="button" className="signsBookClose" onClick={closeLearningBook} aria-label="Close book">×</button>
                  {libraryBookView === 'cover' ? (
                    <button type="button" className={`signsBookCoverModal ${openLibraryBook.tone}`} onClick={() => setLibraryBookView('reader')}>
                      <span>{openLibraryBook.eyebrow}</span>
                      <strong>{openLibraryBook.coverTitle}</strong>
                      <i aria-hidden="true">{openLibraryBook.icon}</i>
                      <p>{openLibraryBook.subtitle}</p>
                      <em>{openLibraryBook.pages.length} lessons</em>
                      <small>Click cover to open</small>
                    </button>
                  ) : (
                    <article
                      className={`signsBookReader3d ${libraryPageFlip ? `isFlipping ${libraryPageFlip}` : ''}`}
                      ref={libraryReaderRef}
                      aria-live="polite"
                    >
                      <button type="button" className="signsBookBack" onClick={() => setLibraryBookView('cover')} aria-label="Back to cover">←</button>
                      <div className="signsBookStack leftStack" aria-hidden="true" />
                      <div className="signsBookStack rightStack" aria-hidden="true" />
                      <div className="signsBookSpine" aria-hidden="true" />
                      <section className="signsBookPage signsBookLeftPage">
                        <span>{openLibraryBook.eyebrow}</span>
                        <div className="signBookHandArt" aria-hidden="true">
                          <b>{currentLibraryBookPage.sign.slice(0, 2).toUpperCase()}</b>
                          <i />
                        </div>
                        <h3>{currentLibraryBookPage.sign}</h3>
                        <p>{currentLibraryBookPage.usage}</p>
                        <button type="button" onClick={() => speak(currentLibraryBookPage.sign, currentLibraryBookPage.language)}>Practice sign</button>
                      </section>
                      <button type="button" className="signsBookPage signsBookRightPage" onClick={() => turnLibraryPage(1)} aria-label="Turn to next page">
                        <span>{nextLibraryBookPage?.language || currentLibraryBookPage.language}</span>
                        <div className="signBookHandArt nextHandArt" aria-hidden="true">
                          <b>{nextLibraryBookPage?.sign?.slice(0, 2).toUpperCase() || currentLibraryBookPage.sign.slice(0, 2).toUpperCase()}</b>
                          <i />
                        </div>
                        <h3>{nextLibraryBookPage?.sign || currentLibraryBookPage.sign}</h3>
                        <p>{nextLibraryBookPage?.usage || currentLibraryBookPage.usage}</p>
                        <small>Tap page for next</small>
                      </button>
                      <div className="turningPage" aria-hidden="true">
                        <span>{nextLibraryBookPage?.sign || currentLibraryBookPage.sign}</span>
                      </div>
                      <footer className="signsBookControls">
                        <button type="button" onClick={() => turnLibraryPage(-1)} disabled={libraryReaderPage === 0}>Previous</button>
                        <button type="button" onClick={() => speak(currentLibraryBookPage.sign, currentLibraryBookPage.language)}>Play Sign</button>
                        <span>{libraryReaderPage + 1} / {openLibraryBook.pages.length}</span>
                        <button type="button" onClick={() => turnLibraryPage(1)} disabled={libraryReaderPage >= openLibraryBook.pages.length - 1}>Next page</button>
                      </footer>
                    </article>
                  )}
                </motion.section>
              </motion.div>
          ), document.body)}

          {activePanel === 'learn' && (
            <Suspense fallback={<div className="signova3DAvatarLoading">Preparing Signova Learn…</div>}>
              <LearnStudio
                cameraEnabled={cameraEnabled}
                liveSign={liveSign}
                learningFeedback={learningFeedback}
                onOpenLibrary={() => openPanel('library')}
                onOpenProgress={() => openPanel('drive')}
                onStartCamera={() => {
                  updateSynapseEnabled(true);
                  updateSettingAndTrack('translation', 'enabled', true);
                  startCameraRef.current?.();
                }}
                onStopCamera={stopCamera}
                onSpeak={(text) => speak(text, settings.account.preferredLanguage)}
                videoRef={attachLocalTrackingVideo}
                canvasRef={canvasRef}
              />
            </Suspense>
          )}

          {activePanel === '__legacy-learn' && (
            <section className="learnDashboard gestureLearnStudio" aria-label="Signova Gesture Loop learning studio">
              <header className="learnTopBar gestureLearnTopBar">
                <div>
                  <strong>Learning Studio</strong>
                </div>
                <div className="learnHeaderActions">
                  <button type="button" className="learnCornerAction" onClick={() => openPanel('library')} aria-label="Open Signova Library">
                    <span className="learnSketchLibraryIcon" aria-hidden="true"><i /></span>
                    <small>Library</small>
                  </button>
                  <button type="button" className="learnCornerAction" onClick={() => openPanel('drive')} aria-label="Open learning progress">
                    <span className="learnSketchProgressIcon" aria-hidden="true"><i /></span>
                    <small>Progress</small>
                  </button>
                </div>
              </header>

              <main className="gestureLearnLayout">
                <section className="liveLearnWorkspace">
                  <div className="learnAvatarLesson">
                    <div className="learnAvatarToolbar">
                      <span>Avatar coach</span>
                      <div>
                        <button type="button" onClick={() => setLearnAvatarDemoKey((key) => key + 1)}>Replay</button>
                        <button type="button" onClick={() => speak(learnTextPrompt || activeLearnMission.phrase, settings.account.preferredLanguage)}>Voice</button>
                      </div>
                    </div>
                    <div className={`learnAvatarCanvas missionTone-${activeLearnMission.tone}`}>
                      <i className="learnAvatarLight" aria-hidden="true" />
                      <Suspense fallback={<div className="signova3DAvatarLoading">Preparing 3D coach…</div>}>
                        <Signova3DAvatar
                          replayKey={learnAvatarDemoKey}
                          step={learnLoopStep}
                          label={`3D human avatar demonstrating ${learnTextPrompt || activeLearnMission.phrase}`}
                        />
                      </Suspense>
                      <div className="learnAvatarCaption">
                        <span>{GESTURE_LOOP_STEPS[learnLoopStep][0]}</span>
                        <strong>{learnTextPrompt || activeLearnMission.phrase}</strong>
                        <small>{activeLearnMission.handshape} · {activeLearnMission.motion}</small>
                      </div>
                    </div>
                    <div className="learnPlaybackBar" aria-label="Avatar demonstration controls">
                      <button type="button" onClick={() => setLearnLoopStep((step) => Math.max(0, step - 1))} disabled={learnLoopStep === 0}>‹</button>
                      <i><em style={{ width: `${((learnLoopStep + 1) / GESTURE_LOOP_STEPS.length) * 100}%` }} /></i>
                      <span>{learnLoopStep + 1}/{GESTURE_LOOP_STEPS.length}</span>
                      <button type="button" onClick={advanceGestureLoop}>›</button>
                    </div>
                  </div>

                  <div className="learnInteractivePanel">
                    <div className="learnModeTabs" role="tablist" aria-label="Learning mode">
                      <button type="button" className="activeLearnModeTab">Text → Sign</button>
                      <button type="button" onClick={() => startGestureLoopPractice('coach')}>Sign → Text + Voice</button>
                    </div>

                    <div className="learnPromptComposer">
                      <label htmlFor="learn-sign-prompt">What do you want to sign?</label>
                      <div>
                        <input
                          id="learn-sign-prompt"
                          type="text"
                          value={learnTextPrompt}
                          onChange={(event) => setLearnTextPrompt(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') presentLearnTextAsSign();
                          }}
                          placeholder="Type a word or sentence"
                        />
                        <button type="button" onClick={presentLearnTextAsSign}>Show sign</button>
                      </div>
                    </div>

                    <article className="learnMeaningCard">
                      <span>Meaning</span>
                      <strong>{activeLearnMission.meaning}</strong>
                      <p>{activeLearnMission.context}</p>
                    </article>

                    <div className="learnMovementCues">
                      <span><b>1</b><strong>Handshape</strong><small>{activeLearnMission.handshape}</small></span>
                      <span><b>2</b><strong>Movement</strong><small>{activeLearnMission.motion}</small></span>
                      <span><b>3</b><strong>Expression</strong><small>{activeLearnMission.expression}</small></span>
                    </div>

                    <div className="learnTryPanel">
                      <div>
                        <span>Try it yourself</span>
                        <strong>Camera checks your sign privately</strong>
                        <small>No practice video is stored.</small>
                      </div>
                      <button type="button" className="learnCameraAction" onClick={() => startGestureLoopPractice('coach')}>
                        <Attach3DIcon type="camera" /> Start camera
                      </button>
                    </div>

                    <div className={`learnLiveResult ${liveSign?.isStable ? 'stableLearnResult' : ''}`}>
                      <div>
                        <span>Sign → Text + Voice</span>
                        <strong>{liveSign?.phrase || 'Waiting for your sign'}</strong>
                        <small>{liveSign ? `${formatConfidence(liveSign.confidence)} confidence · ${learningFeedback}` : 'Start the camera and sign inside the frame.'}</small>
                      </div>
                      <button type="button" disabled={!liveSign?.phrase} onClick={() => speak(liveSign?.phrase, settings.account.preferredLanguage)} aria-label="Speak recognized sign">
                        <Attach3DIcon type="audio" />
                      </button>
                    </div>
                  </div>
                </section>

                {learnTrainerActive && createPortal((
                  <section
                    className={`guidedSignTrainer ${learnTrainerExpanded ? 'expandedGuidedSignTrainer' : 'miniGuidedSignTrainer'}`}
                    aria-label="Guided sign trainer"
                    role="dialog"
                    aria-modal={learnTrainerExpanded}
                    tabIndex={learnTrainerExpanded ? undefined : 0}
                    onClick={(event) => {
                      if (!learnTrainerExpanded && !event.target.closest('button')) setLearnTrainerExpanded(true);
                    }}
                    onKeyDown={(event) => {
                      if (!learnTrainerExpanded && (event.key === 'Enter' || event.key === ' ')) setLearnTrainerExpanded(true);
                    }}
                  >
                    <header className="guidedTrainerHeader">
                      <div>
                        <span>{learnTrainerExpanded ? 'Sign practice workspace' : 'Mini sign practice'}</span>
                        <strong>{activeLearnMission.phrase}</strong>
                        <small>{GESTURE_LOOP_STEPS[learnLoopStep][0]} · {learnPracticeMode} mode · attempt {learnAttemptCount}</small>
                      </div>
                      <div className="guidedTrainerStatus">
                        <b className={cameraEnabled ? 'trainerReadyStatus' : ''}>{cameraEnabled ? 'Camera ready' : 'Starting camera'}</b>
                        <b className={liveSign?.isStable ? 'trainerReadyStatus' : ''}>{liveSign?.isStable ? 'Sign locked' : 'AI observing'}</b>
                        <button type="button" onClick={() => setLearnTrainerExpanded((expanded) => !expanded)} aria-label={learnTrainerExpanded ? 'Minimize sign trainer' : 'Expand sign trainer'}>
                          {learnTrainerExpanded ? '−' : '□'}
                        </button>
                        <button type="button" onClick={closeLearnTrainer} aria-label="Close guided trainer">×</button>
                      </div>
                    </header>

                    <div className="guidedTrainerGrid">
                      <div className="guidedTrainerCamera">
                        {cameraEnabled ? (
                          <>
                            <video className="guidedTrainerVideo" autoPlay playsInline muted ref={attachLocalTrackingVideo} />
                            <canvas ref={canvasRef} className={`guidedTrainerOverlay ${settings.feedback.realTimeCorrection ? '' : 'trackerPointsHidden'}`} aria-label="Live hand tracking landmarks" />
                          </>
                        ) : (
                          <button type="button" className="guidedTrainerStartCamera" onClick={() => startCameraRef.current?.()}>
                            <Attach3DIcon type="camera" />
                            <span><strong>Start camera</strong><small>Your practice stays on this Learn page.</small></span>
                          </button>
                        )}
                        <div className="guidedTrainerPrompt">
                          <span>Target sign</span>
                          <strong>{activeLearnMission.phrase}</strong>
                          <small>{activeLearnMission.meaning}</small>
                        </div>
                        <div className="miniTrainerHint">
                          <span><b>Hand</b>{activeLearnMission.handshape}</span>
                          <span><b>Move</b>{activeLearnMission.motion}</span>
                        </div>
                      </div>

                      <aside className="guidedTrainerCoach">
                        <div className="guidedSignMeaning">
                          <div className="guidedHandDiagram" aria-hidden="true">
                            <i className="guidedPalm" />
                            <i className="guidedFinger guidedFingerOne" />
                            <i className="guidedFinger guidedFingerTwo" />
                            <i className="guidedFinger guidedFingerThree" />
                            <i className="guidedFinger guidedFingerFour" />
                            <i className="guidedThumb" />
                            <span>→</span>
                          </div>
                          <div>
                            <span>What this sign means</span>
                            <strong>{activeLearnMission.meaning}</strong>
                            <small>{activeLearnMission.example}</small>
                          </div>
                        </div>

                        <div className="guidedPracticalCues">
                          <span><b>Handshape</b><small>{activeLearnMission.handshape}</small></span>
                          <span><b>Movement</b><small>{activeLearnMission.motion}</small></span>
                          <span><b>Expression</b><small>{activeLearnMission.expression}</small></span>
                        </div>

                        <div className="guidedTrainerLesson">
                          <span>How to perform it</span>
                          <strong>{GESTURE_LOOP_STEPS[learnLoopStep][0]}</strong>
                          <p>{GESTURE_LOOP_STEPS[learnLoopStep][1]}</p>
                        </div>

                        <div className="guidedTrainerChecklist" aria-label="Live coaching checklist">
                          <span className={cameraEnabled ? 'completedTrainerCheck' : ''}><b>1</b><em>Keep your upper body and both hands visible.</em></span>
                          <span className={Number(liveSign?.stability || 0) >= 0.55 ? 'completedTrainerCheck' : ''}><b>2</b><em>Hold the final position until the motion is stable.</em></span>
                          <span className={liveSign?.isStable ? 'completedTrainerCheck' : ''}><b>3</b><em>Use the sign inside the mission situation.</em></span>
                        </div>

                        <div className="guidedTrainerMetrics">
                          <span><small>Confidence</small><strong>{liveSign ? formatConfidence(liveSign.confidence) : '0%'}</strong></span>
                          <span><small>Stability</small><strong>{Math.round(Number(liveSign?.stability || 0) * 100)}%</strong></span>
                          <span><small>Quality</small><strong>{Math.round(Number(liveSign?.qualityScore || 0) * 100)}%</strong></span>
                        </div>

                        <div className={`guidedTrainerReview ${learnAttemptNeedsReview ? 'trainerReviewNeeded' : ''}`}>
                          <div>
                            <strong>{learnAttemptNeedsReview ? 'Help improve this weak sign' : 'Model feedback'}</strong>
                            <small>Model scores only. No video, landmarks, profile fields, or transcript is saved.</small>
                          </div>
                          {settings.privacy.dataSharing ? (
                            <button
                              type="button"
                              disabled={learnFeedbackSubmitted || !liveSign}
                              onClick={() => submitLearnWeakSignFeedback(learnAttemptNeedsReview ? 'weak-or-uncertain' : 'user-review')}
                            >
                              {learnFeedbackSubmitted ? 'Feedback sent' : 'Send for review'}
                            </button>
                          ) : (
                            <button type="button" onClick={() => { setActiveSettingsSection('privacy'); openPanel('settings'); }}>
                              Enable consent
                            </button>
                          )}
                        </div>
                      </aside>
                    </div>

                    <footer className="guidedTrainerActions">
                      <button type="button" onClick={() => setLearnTrainerExpanded(false)}>Minimize</button>
                      <button type="button" onClick={() => setLearnLoopStep((step) => Math.max(0, step - 1))} disabled={learnLoopStep === 0}>Previous</button>
                      <button type="button" onClick={() => startGestureLoopPractice(learnPracticeMode)}>Try again</button>
                      <button type="button" className="guidedTrainerNext" onClick={advanceGestureLoop} disabled={learnLoopStep >= GESTURE_LOOP_STEPS.length - 1}>Next coaching step</button>
                    </footer>
                  </section>
                ), document.body)}

                <section className="gestureLoopSection">
                  <div className="gestureSectionHeading">
                    <div><span>Practice path</span><strong>Learn it in six clear steps</strong></div>
                    <small>Current step {learnLoopStep + 1} of {GESTURE_LOOP_STEPS.length}</small>
                  </div>
                  <div className="gestureLoopTrack">
                    {GESTURE_LOOP_STEPS.map(([title, detail], index) => (
                      <button
                        type="button"
                        className={`${index === learnLoopStep ? 'activeGestureStep' : ''} ${index < learnLoopStep ? 'completedGestureStep' : ''}`}
                        key={title}
                        onClick={() => setLearnLoopStep(index)}
                      >
                        <span>{index < learnLoopStep ? '✓' : index + 1}</span>
                        <strong>{title}</strong>
                        <small>{detail}</small>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="gesturePracticeGrid">
                  <section className="gesturePracticeModes">
                    <div className="gestureSectionHeading">
                      <div><span>Try it now</span><strong>Choose a practice mode</strong></div>
                    </div>
                    <div className="gestureModeGrid">
                      {PRACTICAL_LEARN_MODES.map(([id, icon, title, detail]) => (
                        <button
                          type="button"
                          className={learnPracticeMode === id ? 'activeGestureMode' : ''}
                          key={id}
                          onClick={() => startGestureLoopPractice(id)}
                        >
                          <RailIcon type={icon} />
                          <span><strong>{title}</strong><small>{detail}</small></span>
                          <em>{learnPracticeMode === id ? 'Active' : 'Start'}</em>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section className="gestureCoachScore">
                    <div className="gestureSectionHeading">
                      <div><span>Live feedback</span><strong>Improve one thing at a time</strong></div>
                    </div>
                    <div className="coachScoreList">
                      {[
                        ['Handshape', liveSign?.qualityScore || appProgressStats.avgConfidence],
                        ['Palm orientation', liveSign?.stability || 0.68],
                        ['Movement path', liveSign?.confidence || 0.74],
                        ['Location', liveSign?.qualityScore || 0.81],
                        ['Expression', Math.max(0.42, (liveSign?.confidence || 0.62) - 0.12)],
                      ].map(([label, score]) => (
                        <span key={label}>
                          <b>{label}</b>
                          <i><em style={{ width: `${Math.round(Math.min(1, score || 0) * 100)}%` }} /></i>
                          <strong>{Math.round(Math.min(1, score || 0) * 100)}%</strong>
                        </span>
                      ))}
                    </div>
                    <p>{learningFeedback}</p>
                  </section>
                </section>

                <section className="gestureMissionShelf">
                  <div className="gestureSectionHeading">
                    <div><span>More practice</span><strong>Choose another real-life mission</strong></div>
                  </div>
                  <div className="gestureMissionCards">
                    {LEARN_MISSIONS.map((mission) => (
                      <button
                        type="button"
                        className={`${learnMissionId === mission.id ? 'activeMissionCard' : ''} missionTone-${mission.tone}`}
                        key={mission.id}
                        onClick={() => { setLearnMissionId(mission.id); setLearnLoopStep(0); }}
                      >
                        <span>{mission.level}</span>
                        <strong>{mission.title}</strong>
                        <b>{mission.phrase}</b>
                        <small>{mission.context}</small>
                        <em>{mission.minutes} min practical</em>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="gestureRecallStrip">
                  <div>
                    <span>Memory check</span>
                    <strong>{profileStats.weakSigns[0] || dailyLearningSigns[0]?.sign || 'Hello'} needs a quick recall today.</strong>
                    <small>Sign it without a guide, then use it inside one short sentence.</small>
                  </div>
                  <button type="button" onClick={() => startGestureLoopPractice('coach')}>Start recall</button>
                  <button type="button" onClick={() => openPanel('drive')}>View progress</button>
                </section>
              </main>
            </section>
          )}

          {activePanel === 'drive' && (
            <section className="progressDashboard" aria-label="Signova progress dashboard">
              <div className="progressHeroGrid">
                <section
                  className={`overallProgressCard ${selectedProgressMetric === 'Overall Progress' ? 'activeProgressMetric' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedProgressMetric('Overall Progress')}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedProgressMetric('Overall Progress'); }}
                >
                  <div className="bigProgressRing" style={{ '--progress-angle': `${appProgressStats.goalProgress * 3.6}deg` }}>
                    <strong>{appProgressStats.goalProgress}%</strong>
                    <span>Completed</span>
                  </div>
                  <div>
                    <span>Overall Progress</span>
                    <strong>{appProgressStats.completedActions ? 'Real practice is being tracked.' : 'No practice data yet.'}</strong>
                    <small>{appProgressStats.completedActions ? 'These numbers come from current app activity.' : 'Start camera, save signs, or upload content to build progress.'}</small>
                  </div>
                </section>

                {[ 
                  ['practice', 'Practice Time', formatPracticeTime(appProgressStats.practiceMinutes), `${appProgressStats.detectedSigns} detections`, 'blue'],
                  ['select', 'Activities Done', String(appProgressStats.completedActions), `${appProgressStats.savedItems} saved items`, 'green'],
                  ['progress', 'Current Streak', appProgressStats.completedActions ? '1 Session' : '0 Sessions', `${driveItems.length} uploads`, 'orange'],
                  ['info', 'Avg Confidence', formatConfidence(appProgressStats.avgConfidence), `${appProgressStats.uniqueDetected} unique signs`, 'yellow'],
                ].map(([icon, label, value, delta, tone]) => (
                  <section
                    className={`progressStatCard ${tone} ${selectedProgressMetric === label ? 'activeProgressMetric' : ''}`}
                    key={label}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedProgressMetric(label)}
                    onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedProgressMetric(label); }}
                  >
                    <span className="progressStatIcon3d"><RailIcon type={icon} /></span>
                    <small>{label}</small>
                    <strong>{value}</strong>
                    <em>{delta}</em>
                  </section>
                ))}
              </div>

              <div className="progressAnalyticsGrid">
                <section className="skillsOverviewCard">
                  <div className="progressSectionHeader">
                    <strong>Skills Overview</strong>
                    <small>{selectedProgressMetric} · Built from current detections, saved items, uploads, and community signs.</small>
                  </div>
                  <div className="skillsContent">
                    <div className="radarChart" aria-label="Skills radar chart">
                      <svg viewBox="0 0 200 200" role="img" aria-label="Live skills spider chart">
                        {[25, 50, 75, 100].map((value) => <polygon key={value} points={radarPolygonPoints([value, value, value, value, value, value])} className="radarGridPolygon" />)}
                        {[0, 1, 2, 3, 4, 5].map((index) => {
                          const point = radarPolygonPoints([100, 100, 100, 100, 100, 100]).split(' ')[index].split(',');
                          return <line key={index} x1="100" y1="100" x2={point[0]} y2={point[1]} className="radarAxis" />;
                        })}
                        <polygon points={progressRadarPoints} className="radarDataPolygon" />
                        {progressRadarPoints.split(' ').map((point, index) => {
                          const [x, y] = point.split(',');
                          return <circle key={progressSkillMetrics[index][0]} cx={x} cy={y} r="4" className="radarDataPoint" />;
                        })}
                      </svg>
                      {progressSkillMetrics.map(([label], index) => (
                        <em className={`radarLabel radarLabel${index + 1}`} key={label}>{label}</em>
                      ))}
                    </div>
                    <div className="skillBars">
                      {progressSkillMetrics.map(([label, value, tone]) => (
                        <div className={`skillBar ${tone} ${selectedProgressMetric === label ? 'activeSkillBar' : ''}`} key={label} role="button" tabIndex={0} onClick={() => setSelectedProgressMetric(label)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedProgressMetric(label); }}>
                          <span><b>{label}</b><em>{value}%</em></span>
                          <i><strong style={{ width: `${value}%` }} /></i>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <section className="weeklyActivityCard">
                  <div className="progressSectionHeader">
                    <strong>Weekly Activity</strong>
                    <small>Live session activity from current Signova data.</small>
                  </div>
                  <div className="lineChart" aria-label="Weekly activity line chart">
                    <svg viewBox="0 0 520 230" role="img" aria-label="Weekly learning activity">
                      <defs>
                        <linearGradient id="activityFill" x1="0" x2="0" y1="0" y2="1">
                          <stop stopColor="#2563eb" stopOpacity="0.22" />
                          <stop offset="1" stopColor="#2563eb" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      {[40, 80, 120, 160].map((y) => <line key={y} x1="34" x2="500" y1={y} y2={y} className="chartGrid" />)}
                      <path d={`M45 ${190 - Math.min(130, appProgressStats.detectedSigns * 12)} L115 ${190 - Math.min(130, appProgressStats.savedItems * 18)} L185 ${190 - Math.min(130, appProgressStats.storedFiles * 25)} L255 ${190 - Math.min(130, appProgressStats.createdSigns * 25)} L325 ${190 - Math.min(130, Math.round(appProgressStats.avgConfidence * 100))} L395 ${190 - Math.min(130, appProgressStats.uniqueDetected * 18)} L465 ${190 - Math.min(130, appProgressStats.completedActions * 10)} L465 204 L45 204 Z`} fill="url(#activityFill)" />
                      <path d={`M45 ${190 - Math.min(130, appProgressStats.detectedSigns * 12)} L115 ${190 - Math.min(130, appProgressStats.savedItems * 18)} L185 ${190 - Math.min(130, appProgressStats.storedFiles * 25)} L255 ${190 - Math.min(130, appProgressStats.createdSigns * 25)} L325 ${190 - Math.min(130, Math.round(appProgressStats.avgConfidence * 100))} L395 ${190 - Math.min(130, appProgressStats.uniqueDetected * 18)} L465 ${190 - Math.min(130, appProgressStats.completedActions * 10)}`} className="chartLine" />
                      {[
                        [45, 190 - Math.min(130, appProgressStats.detectedSigns * 12), 'Detect'],
                        [115, 190 - Math.min(130, appProgressStats.savedItems * 18), 'Saved'],
                        [185, 190 - Math.min(130, appProgressStats.storedFiles * 25), 'Files'],
                        [255, 190 - Math.min(130, appProgressStats.createdSigns * 25), 'Signs'],
                        [325, 190 - Math.min(130, Math.round(appProgressStats.avgConfidence * 100)), 'Conf'],
                        [395, 190 - Math.min(130, appProgressStats.uniqueDetected * 18), 'Unique'],
                        [465, 190 - Math.min(130, appProgressStats.completedActions * 10), 'Total'],
                      ].map(([x, y, day]) => (
                        <g key={day}>
                          <circle cx={x} cy={y} r="6" className="chartPoint" />
                          <text x={x} y="222" textAnchor="middle">{day}</text>
                        </g>
                      ))}
                    </svg>
                  </div>
                </section>
              </div>

              <div className="progressBottomGrid">
                <section className="achievementCard">
                  <div className="progressSectionHeader inlineHeader">
                    <div>
                      <strong>Achievements</strong>
                      <small>{appProgressStats.completedActions} real actions · {driveItems.length} practice clips saved</small>
                    </div>
                    <button type="button" onClick={() => setShowAllAchievements((show) => !show)}>{showAllAchievements ? 'Show Less' : 'View All'}</button>
                  </div>
                  <div className="achievementGrid">
                    {progressAchievements.slice(0, showAllAchievements ? progressAchievements.length : 4).map(([icon, label, tone]) => (
                      <button type="button" className={`achievementBadge ${tone}`} key={label} onClick={() => setStatus(`${label} achievement ${tone === 'locked' ? 'is still locked.' : 'is complete.'}`)}>
                        <span>{icon}</span>
                        <strong>{label}</strong>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="milestoneCard">
                  <div>
                    <span>Next Milestone</span>
                    <strong>Complete today’s goal</strong>
                    <small>{Math.max(0, appProgressStats.dailyGoal - appProgressStats.completedActions)} actions left.</small>
                  </div>
                  <div className="milestoneProgress">
                    <span><b>{appProgressStats.completedActions} / {appProgressStats.dailyGoal}</b><em>{appProgressStats.goalProgress}%</em></span>
                    <i><strong style={{ width: `${appProgressStats.goalProgress}%` }} /></i>
                  </div>
                  <div className="trophyArt" aria-hidden="true">🏆</div>
                </section>
              </div>
            </section>
          )}

          {activePanel === 'contacts' && (
            <section className="panel contactsPanel">
              <div className="panelHeader">
                <span>Add Contact</span>
                <strong>Number + username identification</strong>
              </div>
              <form className="contactForm" onSubmit={addContact}>
                <input className="signSearch" value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} placeholder="Full name" />
                <div className="contactPhoneRow">
                  <select className="signSearch" value={contactForm.countryCode} onChange={(event) => setContactForm({ ...contactForm, countryCode: event.target.value })} aria-label="Country code">
                    {CONTACT_COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>{country.flag} {country.code}</option>
                    ))}
                  </select>
                  <input className="signSearch" value={contactForm.number} onChange={(event) => setContactForm({ ...contactForm, number: event.target.value.replace(/\D/g, '') })} placeholder="Phone number (optional)" inputMode="numeric" />
                </div>
                <input className="signSearch" value={contactForm.username} onChange={(event) => setContactForm({ ...contactForm, username: event.target.value })} placeholder="@username" />
                {contactFormError ? <small className="contactFormError">{contactFormError}</small> : null}
                <small className="contactIdentityNote">Username is the default identity. Phone number is optional in profile view.</small>
                <div className="contactAvatarOptions" aria-label="Contact avatar view">
                  <button type="button" className={contactForm.avatarChoice === 'signova' ? 'activeContactAvatarOption' : ''} onClick={() => setContactForm({ ...contactForm, avatarChoice: 'signova' })}>
                    <span className="contactAvatar signovaContactAvatar"><img src="/app-logo.png" alt="" /><em>{contactForm.name.trim().charAt(0).toUpperCase() || 'S'}</em></span>
                    Signova icon
                  </button>
                  <button type="button" className={contactForm.avatarChoice === 'initial' ? 'activeContactAvatarOption' : ''} onClick={() => setContactForm({ ...contactForm, avatarChoice: 'initial' })}>
                    <span className="contactAvatar initialContactAvatar">{contactForm.name.trim().charAt(0).toUpperCase() || 'S'}</span>
                    First name
                  </button>
                </div>
                <div className="contactVisibilityGrid">
                  <label><input type="checkbox" checked={contactForm.showUsername} onChange={(event) => setContactForm({ ...contactForm, showUsername: event.target.checked })} /> Show username</label>
                  <label><input type="checkbox" checked={contactForm.showNumber} onChange={(event) => setContactForm({ ...contactForm, showNumber: event.target.checked })} /> Show number</label>
                </div>
                <button type="submit">Add contact</button>
              </form>
            </section>
          )}

          {activePanel === 'communityCreate' && (
            <section className="communityCreateSignPage minimalSignCreatorPage" aria-label="Create a Community Sign">
              <form className="minimalSignCreator" onSubmit={(event) => createCommunitySign(event, 'publish')}>
                <header className="minimalSignCreatorHeader">
                  <div><span>Community</span><strong>Create a sign</strong><small>Share one clear, useful sign with learners.</small></div>
                  <button type="button" onClick={() => setActivePanel('community')} aria-label="Close create sign">×</button>
                </header>

                <nav className="communitySignPipeline" aria-label="Sign creation progress">
                  <span className="communitySignPipelineTrack" aria-hidden="true">
                    <i style={{ '--pipeline-progress': `${communitySignPipelineProgress}%` }} />
                  </span>
                  {communitySignPipeline.map((stage, index) => {
                    const state = index === communitySignPipelineStep ? 'active' : index <= communitySignPipelineUnlocked ? 'complete' : 'locked';
                    return (
                      <button
                        type="button"
                        key={stage.label}
                        className={`communitySignPipelineStage ${state}`}
                        disabled={index > communitySignPipelineUnlocked}
                        onClick={() => index <= communitySignPipelineUnlocked && setCommunitySignPipelineStep(index)}
                        aria-current={state === 'active' ? 'step' : undefined}
                      >
                        <span>{state === 'complete' ? '✓' : state === 'locked' ? '⌁' : index + 1}</span>
                        <strong>{stage.label}</strong>
                        <small>{state === 'active' ? 'Live now' : state === 'complete' ? 'Complete' : stage.note}</small>
                      </button>
                    );
                  })}
                </nav>

                <div className="minimalSignCreatorLayout">
                  <main className="minimalSignCreatorForm">
                    <fieldset className={`minimalSignSection pipelineSignSection ${communitySignPipelineStep === 0 ? 'activePipelineSection' : 'completePipelineSection'}`} disabled={communitySignPipelineStep !== 0}>
                      <header><span>01</span><div><strong>Basics</strong><small>Name and classify the sign.</small></div></header>
                      <div className="minimalSignFieldGrid">
                        <label><span>Title *</span><input required value={communitySignForm.title} onChange={(event) => setCommunitySignForm({ ...communitySignForm, title: event.target.value })} placeholder="Need help" /></label>
                        <label><span>Meaning *</span><input required value={communitySignForm.meaning} onChange={(event) => setCommunitySignForm({ ...communitySignForm, meaning: event.target.value })} placeholder="Request assistance" /></label>
                        <label><span>Language</span><select value={communitySignForm.language} onChange={(event) => setCommunitySignForm({ ...communitySignForm, language: event.target.value })}><option value="ISL">Indian Sign Language</option><option value="ASL">American Sign Language</option><option value="BSL">British Sign Language</option><option value="Other">Other</option></select></label>
                        <label><span>Category</span><select value={communitySignForm.category} onChange={(event) => setCommunitySignForm({ ...communitySignForm, category: event.target.value })}>{['Daily Use', 'Emergency', 'Education', 'Family', 'Medical', 'Emotion', 'Travel', 'General'].map((item) => <option key={item}>{item}</option>)}</select></label>
                      </div>
                      <div className="minimalSignChoiceRow" aria-label="Sign type">{['letter', 'word', 'sentence'].map((type) => <button type="button" className={communitySignForm.type === type ? 'activeMinimalChoice' : ''} onClick={() => setCommunitySignForm({ ...communitySignForm, type })} key={type}>{type}</button>)}</div>
                      <button type="button" className="pipelineContinueButton" onClick={() => advanceCommunitySignPipeline(0)}>Continue to guidance <span>→</span></button>
                    </fieldset>

                    <fieldset className={`minimalSignSection pipelineSignSection ${communitySignPipelineStep === 1 ? 'activePipelineSection' : communitySignPipelineUnlocked >= 1 ? 'completePipelineSection' : 'lockedPipelineSection'}`} disabled={communitySignPipelineStep !== 1}>
                      <header><span>02</span><div><strong>How to sign it</strong><small>Describe the movement learners should copy.</small></div></header>
                      <div className="minimalSignFieldGrid">
                        <label><span>Hand shape</span><select value={communitySignForm.handShape} onChange={(event) => setCommunitySignForm({ ...communitySignForm, handShape: event.target.value })}><option value="">Select hand shape</option><option>Open Palm</option><option>Fist</option><option>Pointing</option><option>Curved Hand</option><option>Two Hands</option></select></label>
                        <label><span>Expression</span><select value={communitySignForm.facialExpression} onChange={(event) => setCommunitySignForm({ ...communitySignForm, facialExpression: event.target.value })}><option value="">Select expression</option><option>Neutral</option><option>Helpful</option><option>Happy</option><option>Concerned</option><option>Questioning</option></select></label>
                      </div>
                      <div className="minimalSignChoiceRow" aria-label="Motion">{['Static', 'Moving', 'Repetitive'].map((motion) => <button type="button" className={communitySignForm.motion === motion ? 'activeMinimalChoice' : ''} onClick={() => setCommunitySignForm({ ...communitySignForm, motion })} key={motion}>{motion}</button>)}</div>
                      <label className="minimalSignWideField"><span>Instructions *</span><textarea required maxLength="1000" value={communitySignForm.steps} onChange={(event) => setCommunitySignForm({ ...communitySignForm, steps: event.target.value })} placeholder="Describe hand position, direction, movement, and expression…" /><small>{communitySignForm.steps.length}/1000</small></label>
                      <label className="minimalSignWideField"><span>Usage note</span><textarea maxLength="500" value={communitySignForm.usageNotes} onChange={(event) => setCommunitySignForm({ ...communitySignForm, usageNotes: event.target.value })} placeholder="When should someone use this sign?" /></label>
                      <button type="button" className="pipelineContinueButton" onClick={() => advanceCommunitySignPipeline(1)}>Continue to demo <span>→</span></button>
                    </fieldset>

                    <fieldset className={`minimalSignSection pipelineSignSection ${communitySignPipelineStep === 2 ? 'activePipelineSection' : communitySignPipelineUnlocked >= 2 ? 'completePipelineSection' : 'lockedPipelineSection'}`} disabled={communitySignPipelineStep !== 2}>
                      <header><span>03</span><div><strong>Demonstration</strong><small>Add media only if it makes the sign clearer.</small></div></header>
                      <div className="minimalMediaActions">
                        <button type="button" onClick={() => openCommunityCapture('video')}>◉ Record video</button>
                        <button type="button" onClick={() => openCommunityCapture('photo')}>▣ Take photo</button>
                        <label><input type="file" accept="video/mp4,video/webm" onChange={(event) => handleCommunitySignMedia(event, 'video')} /><span>＋ Upload video</span></label>
                        <label><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => handleCommunitySignMedia(event, 'images')} /><span>＋ Upload images</span></label>
                        <small>Video limit: 15 seconds · Up to four images.</small>
                      </div>
                      {communityCaptureError && <p className="communityCaptureError" role="alert">{communityCaptureError}</p>}
                      {communityCaptureOpen && (
                        <div className="communitySignCapture">
                          <header>
                            <span><strong>{communityCaptureMode === 'video' ? 'Record demonstration' : 'Capture training frame'}</strong><small>Keep face, upper body, and both hands visible.</small></span>
                            <button type="button" onClick={stopCommunityCapture} aria-label="Close camera">×</button>
                          </header>
                          <div className="communitySignCaptureView">
                            <video ref={communityCaptureVideoRef} muted autoPlay playsInline onClick={(event) => event.currentTarget.play().catch(() => {})} />
                            <span className="communityCaptureGuide" aria-hidden="true" />
                            {communityCaptureRecording && <b className="communityCaptureTimer">REC 00:{String(communityCaptureSeconds).padStart(2, '0')} / 00:15</b>}
                          </div>
                          <footer>
                            <small>Even light · plain background · hands inside guide</small>
                            {communityCaptureMode === 'video'
                              ? <button type="button" className={communityCaptureRecording ? 'stopCaptureButton' : ''} onClick={communityCaptureRecording ? stopCommunityVideoRecording : recordCommunityVideo}>{communityCaptureRecording ? 'Stop recording' : 'Start 15s recording'}</button>
                              : <button type="button" onClick={captureCommunityPhoto}>Capture photo</button>}
                          </footer>
                        </div>
                      )}
                      <div className={`communityMediaQuality ${communityMediaQuality.status}`}>
                        <span aria-hidden="true">{communityMediaQuality.status === 'ready' ? '✓' : communityMediaQuality.status === 'review' ? '!' : 'i'}</span>
                        <div>
                          <strong>{communityMediaQuality.title}</strong>
                          {communityMediaQuality.checks.length > 0
                            ? <ul>{communityMediaQuality.checks.map((check) => <li className={check.pass ? 'pass' : 'fail'} key={check.label}>{check.pass ? '✓' : '×'} {check.label}</li>)}</ul>
                            : <small>Capture or upload media to check resolution, duration, lighting, and contrast.</small>}
                          <small>Technical quality only. Sign correctness still requires model or human review. AI training use remains off unless you explicitly consent.</small>
                        </div>
                      </div>
                      {communitySignForm.imageUrls.length > 0 && <div className="minimalMediaStrip">{communitySignForm.imageUrls.map((url, index) => <button type="button" className={communitySignForm.selectedThumbnail === index ? 'activeMinimalMedia' : ''} onClick={() => setCommunitySignForm({ ...communitySignForm, selectedThumbnail: index })} key={url}><img src={url} alt="" /></button>)}</div>}
                      <button type="button" className="pipelineContinueButton" onClick={() => advanceCommunitySignPipeline(2)}>Review publishing <span>→</span></button>
                    </fieldset>

                    <fieldset className={`minimalSignSection minimalPublishSection pipelineSignSection ${communitySignPipelineStep === 3 ? 'activePipelineSection' : communitySignPipelineUnlocked >= 3 ? 'completePipelineSection' : 'lockedPipelineSection'}`} disabled={communitySignPipelineStep !== 3}>
                      <header><span>04</span><div><strong>Publishing</strong><small>Choose visibility and confirm your rights.</small></div></header>
                      <div className="minimalSignChoiceRow" aria-label="Visibility">{['Public', 'Community', 'Private'].map((visibility) => <button type="button" className={communitySignForm.visibility === visibility ? 'activeMinimalChoice' : ''} onClick={() => setCommunitySignForm({ ...communitySignForm, visibility })} key={visibility}>{visibility}</button>)}</div>
                      <label className="minimalConsentRow"><input type="checkbox" checked={communitySignForm.showCreatorName} onChange={(event) => setCommunitySignForm({ ...communitySignForm, showCreatorName: event.target.checked })} /><span><strong>Show creator credit</strong><small>Display {communityProfile.username} with this sign.</small></span></label>
                      <label className="minimalConsentRow"><input type="checkbox" checked={communitySignForm.allowAiTraining} onChange={(event) => setCommunitySignForm({ ...communitySignForm, allowAiTraining: event.target.checked })} /><span><strong>Allow AI training use</strong><small>Optional consent; your profile identity is excluded.</small></span></label>
                      <label className="minimalConsentRow"><input type="checkbox" checked={communitySignForm.rulesAccepted} onChange={(event) => setCommunitySignForm({ ...communitySignForm, rulesAccepted: event.target.checked })} /><span><strong>Follow community guidelines *</strong></span></label>
                      <label className="minimalConsentRow"><input type="checkbox" checked={communitySignForm.rightsConfirmed} onChange={(event) => setCommunitySignForm({ ...communitySignForm, rightsConfirmed: event.target.checked })} /><span><strong>I have permission to share this content *</strong></span></label>
                    </fieldset>
                  </main>

                  <aside className="minimalSignPreview">
                    <div className={communitySignForm.videoUrl ? 'minimalSignPreviewMedia' : 'minimalSignPreviewMedia emptyMinimalSignPreview'}>
                      {communitySignForm.videoUrl ? <video src={communitySignForm.videoUrl} controls /> : <><span>＋</span><strong>No demonstration yet</strong></>}
                    </div>
                    <div className="minimalSignPreviewCopy"><span>{communitySignForm.language} · {communitySignForm.type}</span><strong>{communitySignForm.title || 'Untitled sign'}</strong><p>{communitySignForm.meaning || 'Add a short meaning.'}</p></div>
                    <dl><div><dt>Category</dt><dd>{communitySignForm.category}</dd></div><div><dt>Visibility</dt><dd>{communitySignForm.visibility}</dd></div></dl>
                  </aside>
                </div>

                <footer className="minimalSignCreatorActions">
                  <span>{communitySignDraftSaved ? 'Draft saved on this device' : 'Not published'}</span>
                  <button type="button" onClick={saveCommunitySignDraft}>Save draft</button>
                  <button type="button" onClick={(event) => createCommunitySign(event, 'library')}>Add to library</button>
                  <button type="submit" disabled={!communitySignForm.rulesAccepted || !communitySignForm.rightsConfirmed}>Publish sign</button>
                </footer>
              </form>
            </section>
          )}

          {activePanel === 'community' && (
            <section className="communityPage" aria-label="Signova community dashboard">
              <header className="communityTopBar">
                <div>
                  <strong>Signova Community Content</strong>
                </div>
                <div className="communityNotificationWrap">
                  <button
                    type="button"
                    className={communityNotificationsOpen ? 'communityIconButton activeCommunityNotification' : 'communityIconButton'}
                    aria-label="Notifications"
                    aria-expanded={communityNotificationsOpen}
                    onClick={() => setCommunityNotificationsOpen((open) => !open)}
                  >
                  {communityNotifications.length > 0 && (
                    <span className="notificationDot">{Math.min(99, communityNotifications.length)}</span>
                  )}
                  <span className="communityBellIcon" aria-hidden="true"><i /></span>
                  </button>
                  {communityNotificationsOpen && (
                    <div className="communityNotificationPanel" role="dialog" aria-label="Community notifications">
                      <div className="communityNotificationHeader">
                        <span>Notifications</span>
                        <div>
                          <button
                            type="button"
                            className="clearCommunityNotifications"
                            onClick={() => setDismissedCommunityNotificationIds((ids) => [...new Set([...ids, ...communityNotifications.map((item) => item.id)])])}
                            aria-label="Clear all notifications"
                            disabled={!communityNotifications.length}
                          >
                            <i aria-hidden="true" />
                          </button>
                          <button type="button" onClick={() => setCommunityNotificationsOpen(false)} aria-label="Close notifications">×</button>
                        </div>
                      </div>
                      <div className="communityNotificationList">
                        {communityNotifications.length ? communityNotifications.map((item) => (
                          <button type="button" className={`communityNotificationItem ${item.tone}`} key={item.id}>
                            <span>{item.icon}</span>
                            <strong>{item.title}</strong>
                            <small>{item.detail}</small>
                          </button>
                        )) : (
                          <p className="communityNotificationEmpty">No real notifications yet.</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <button type="button" className="communityCreateSignButton" onClick={() => { setCommunityNotificationsOpen(false); setActivePanel('communityCreate'); }} aria-label="Create community sign">
                  <span className="communityCreateSign3dIcon" aria-hidden="true"><i /><b /><em>+</em></span>
                </button>
                <div className="communityAvatarWrap">
                  <button
                    type="button"
                    className={`communityAvatar avatarTone-${communityProfile.avatarTone || 'cyan'} avatarMode-${communityProfile.avatarMode || '3d'} avatarMood-${communityProfile.avatarMood || 'calm'} avatarAccessory-${communityProfile.avatarAccessory || 'none'} ${isSignovaProActive ? 'proCommunityAvatar' : ''}`}
                    aria-label="Customize public creator profile"
                    aria-expanded={communityAvatarOpen}
                    onClick={() => setCommunityAvatarOpen((open) => !open)}
                  >
                    {communityProfile.avatarImage ? <img src={communityProfile.avatarImage} alt="" /> : <span className="avatarGlyph" aria-hidden="true"><i /><i /><i /></span>}
                    <span className="avatarAccessoryMark" aria-hidden="true" />
                    <em>{communityAvatarInitials}</em>
                    {isSignovaProActive && <b className="communityProMark" aria-label={signovaProBadgeLabel}>PRO</b>}
                  </button>
                  {communityAvatarOpen && (
                    <div className="communityAvatarPanel" role="dialog" aria-label="Customize public creator profile">
                      <div className="avatarPanelHeader">
                        <div>
                          <span>Creator Studio</span>
                          <strong>{communityProfile.username ? 'Your public profile is ready' : 'Create your public profile'}</strong>
                          <small>{communityProfile.username || '@signova.creator'} · posts, signs, groups</small>
                        </div>
                        <button type="button" onClick={() => { setCommunityAvatarOpen(false); setCommunityIdentityEditing(false); }} aria-label="Close avatar customizer">×</button>
                      </div>

                      <div className="avatarStudioPreview">
                        <span className={`communityAvatar avatarTone-${communityProfile.avatarTone || 'cyan'} avatarMode-${communityProfile.avatarMode || '3d'} avatarMood-${communityProfile.avatarMood || 'calm'} avatarAccessory-${communityProfile.avatarAccessory || 'none'}`}>
                          {communityProfile.avatarImage ? <img src={communityProfile.avatarImage} alt="" /> : <span className="avatarGlyph" aria-hidden="true"><i /><i /><i /></span>}
                          <span className="avatarAccessoryMark" aria-hidden="true" />
                          <em>{communityAvatarInitials}</em>
                        </span>
                        <div>
                          <strong>{communityProfile.name || 'Signova Creator'}</strong>
                          <small>{communityProfile.bio || 'Public creator profile for Signova community.'}</small>
                        </div>
                      </div>

                      {!communityIdentityEditing ? (
                        <div className="avatarIdentitySummary">
                          <span><b>Name</b>{communityProfile.name || 'Signova Creator'}</span>
                          <span><b>Username</b>{communityProfile.username || '@signova.creator'}</span>
                          <button type="button" onClick={() => setCommunityIdentityEditing(true)}>Edit identity</button>
                        </div>
                      ) : (
                        <div className="avatarIdentityEditor">
                          <label className="avatarField">
                            <span>Creator name</span>
                            <input value={communityProfile.name} onChange={(event) => updateAvatarSetting('name', event.target.value)} />
                          </label>
                          <label className="avatarField">
                            <span>Creator username</span>
                            <input value={communityProfile.username} onChange={(event) => updateAvatarSetting('username', normalizeUsername(event.target.value))} />
                          </label>
                          <label className="avatarField">
                            <span>Public bio</span>
                            <input value={communityProfile.bio} onChange={(event) => updateAvatarSetting('bio', event.target.value)} />
                          </label>
                          <label className="avatarField">
                            <span>Initials</span>
                            <input
                              value={communityProfile.avatarInitials}
                              maxLength={2}
                              onChange={(event) => updateAvatarSetting('avatarInitials', event.target.value.toUpperCase())}
                            />
                          </label>
                        </div>
                      )}

                      <div className="avatarPresetGrid" aria-label="Create 3D avatar presets">
                        {SIGNOVA_AVATAR_ASSETS.map((preset) => (
                          <button type="button" key={preset.label} onClick={() => applyCommunityAvatarPreset(preset)}>
                            <span className={`presetAvatarDot avatarTone-${preset.tone}`}>{preset.image ? <img src={preset.image} alt="" /> : <i />}</span>
                            <b>{preset.label}</b>
                          </button>
                        ))}
                        <button type="button" className="avatarGenerateMixButton" onClick={generateCommunityAvatarFromAssets}>
                          <span className="presetAvatarDot avatarTone-orange"><i /></span>
                          <b>Generate mix</b>
                        </button>
                      </div>

                      <div className="avatarModeGrid" aria-label="Avatar render style">
                        <button type="button" className={communityProfile.avatarMode === '3d' ? 'activeAvatarMode' : ''} onClick={() => updateAvatarSetting('avatarMode', '3d')}>Soft 3D</button>
                        <button type="button" className={communityProfile.avatarMode === 'flat' ? 'activeAvatarMode' : ''} onClick={() => updateAvatarSetting('avatarMode', 'flat')}>Simple mark</button>
                      </div>
                      <div className="avatarMiniOptions" aria-label="Avatar details">
                        {[
                          ['avatarMood', 'calm', 'Calm'],
                          ['avatarMood', 'smile', 'Smile'],
                          ['avatarAccessory', 'none', 'No item'],
                          ['avatarAccessory', 'glasses', 'Glasses'],
                          ['avatarAccessory', 'headset', 'Headset'],
                        ].map(([key, value, label]) => (
                          <button
                            type="button"
                            className={communityProfile[key] === value ? 'activeAvatarMiniOption' : ''}
                            key={`${key}-${value}`}
                            onClick={() => updateAvatarSetting(key, value)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      <div className="avatarToneGrid" aria-label="Avatar color">
                        {['cyan', 'purple', 'green', 'orange', 'pink'].map((tone) => (
                          <button
                            type="button"
                            className={`avatarToneButton avatarTone-${tone} ${communityProfile.avatarTone === tone ? 'activeAvatarTone' : ''}`}
                            key={tone}
                            onClick={() => updateAvatarSetting('avatarTone', tone)}
                            aria-label={`Use ${tone} avatar tone`}
                          />
                        ))}
                      </div>
                      <div className="avatarActionRow" aria-label="Avatar actions">
                        <button type="button" onClick={saveAvatarCustomization} title="Save avatar" aria-label="Save avatar"><span className="avatarSaveIcon" /></button>
                        <button type="button" onClick={deleteAvatarCustomization} title="Reset avatar" aria-label="Reset avatar"><span className="avatarResetIcon" /></button>
                        <button type="button" onClick={undoAvatarCustomization} disabled={!avatarUndoStack.length} title="Undo avatar change" aria-label="Undo avatar change">↶</button>
                        <button type="button" onClick={redoAvatarCustomization} disabled={!avatarRedoStack.length} title="Redo avatar change" aria-label="Redo avatar change">↷</button>
                      </div>
                    </div>
                  )}
                </div>
              </header>

              <nav ref={communityFeedTabsRef} className="communityFeedTabs" aria-label="Community feed filters">
                {['For You', 'Following', 'ISL', 'ASL', 'Emergency', 'Daily Use'].map((label) => (
                  <button type="button" className={communityFeedFilter === label ? 'activeFeedTab' : ''} key={label} onClick={() => setCommunityFeedFilter(label)}>{label}</button>
                ))}
              </nav>

              <div className="communitySocialLayout">
                <main className="communityFeed communitySocialFeed" aria-label="Community sign feed">
                  <div className="communityPostStream" aria-label="Scrollable community posts">
                    {visibleCommunityPosts.map((post) => (
                      <article className={`feedPostCard communitySocialPost ${post.mediaType === 'video' ? 'communityVideoPost' : ''}`} key={post.id}>
                      <header className="socialPostHeader">
                        <span className={`communityAvatar socialCreatorAvatar avatarTone-${post.avatarTone || 'cyan'}`}>{post.avatarImage ? <img src={post.avatarImage} alt="" /> : post.avatar}</span>
                        <div>
                          <strong>{post.name}<span className="verifiedCreatorMark" aria-label="Verified creator">✓</span>{(post.isPremium || (isSignovaProActive && post.username === communityProfile.username)) && <span className="socialProCreatorMark" aria-label="Signova Pro member">PRO</span>}</strong>
                          <small>{post.username || '@signova.creator'} · {post.level} · {post.time}</small>
                        </div>
                        <button type="button" className={post.following ? 'followCreatorButton followingCreatorButton' : 'followCreatorButton'} onClick={() => toggleCommunityCreatorFollow(post.id)}>
                          {post.following ? 'Following' : 'Follow'}
                        </button>
                        <div className="communityPostMenuWrap">
                          <button
                            type="button"
                            className="postMoreButton"
                            aria-label="More post options"
                            aria-expanded={communityPostMenu.postId === post.id}
                            onClick={() => setCommunityPostMenu((menu) => menu.postId === post.id ? { postId: '', reportOpen: false } : { postId: post.id, reportOpen: false })}
                          >•••</button>
                          {communityPostMenu.postId === post.id && (
                            <div className="communityPostOptionsMenu" role="menu">
                              <button type="button" role="menuitem" onClick={() => downloadCommunityPost(post)}>
                                <span className="postOptionIcon downloadPostIcon" aria-hidden="true"><i /></span>
                                Download
                              </button>
                              <button
                                type="button"
                                role="menuitem"
                                aria-expanded={communityPostMenu.reportOpen}
                                onClick={() => setCommunityPostMenu((menu) => ({ ...menu, reportOpen: !menu.reportOpen }))}
                              >
                                <span className="postOptionIcon reportPostIcon" aria-hidden="true"><i /></span>
                                Report content
                                <em>›</em>
                              </button>
                              {communityPostMenu.reportOpen && (
                                <div className="communityReportSubmenu">
                                  <button type="button" onClick={() => handleCommunityPostReport(post, 'not-interested')}>Not interested</button>
                                  <button type="button" className="dangerPostOption" onClick={() => handleCommunityPostReport(post, 'remove')}>Remove content</button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </header>

                      <div className="communityPostCopy">
                        <strong>{post.sign}</strong>
                        <p>{post.text}</p>
                      </div>

                      <div className={`communityPostMedia ${post.mediaType === 'video' ? 'communityVideoPostMedia' : ''}`}>
                        {post.mediaType !== 'video' && (
                          <div className="contentUploaderBadge" aria-label={`Uploaded by ${post.name}`}>
                            <span className={`communityAvatar contentUploaderAvatar avatarTone-${post.avatarTone || 'cyan'}`}>{post.avatarImage ? <img src={post.avatarImage} alt="" /> : post.avatar}</span>
                            <span>
                              <strong>{post.name}</strong>
                              <small>{post.time}</small>
                            </span>
                          </div>
                        )}
                        {post.mediaType === 'video' ? (
                          <CommunityFeedVideo src={post.mediaUrl} label={`${post.name} posted ${post.sign} video`} />
                        ) : (
                          <img src={post.mediaUrl} alt={`${post.name} demonstrating the ${post.sign} sign`} loading="lazy" decoding="async" />
                        )}
                        {post.mediaType === 'video' && (
                          <div className="communityMediaMeta">
                            <span>{post.duration}</span>
                            <span>{post.confidence} AI confidence</span>
                          </div>
                        )}
                      </div>

                      <div className="postTags">
                        {post.tags.map((tag) => <span key={tag}>{tag}</span>)}
                      </div>

                      <div className="communityLearningTip">
                        <span>Learning tip</span>
                        <p>{post.learningTip}</p>
                        <button type="button" onClick={() => setStatus(`${post.sign} opened in learning mode.`)}>Learn this sign</button>
                      </div>

                      <div className="postActions socialPostActions">
                        <button type="button" className={post.liked ? 'activePostAction' : ''} onClick={() => toggleCommunityPostLike(post.id)} aria-label={post.liked ? 'Liked' : 'Like'} data-label={post.liked ? 'Liked' : 'Like'}>
                          <span className="socialActionIcon socialLikeIcon" aria-hidden="true"><i /></span>
                          <span className="socialActionText">{post.liked ? 'Liked' : 'Like'}</span>
                          <strong>{post.stats.likes.toLocaleString()}</strong>
                        </button>
                        <button type="button" onClick={() => openCommunityPostComments(post)} aria-label="Comment" data-label="Comment">
                          <span className="socialActionIcon socialCommentIcon" aria-hidden="true"><i /></span>
                          <span className="socialActionText">Comment</span>
                          <strong>{post.stats.comments.toLocaleString()}</strong>
                        </button>
                        <button type="button" onClick={() => shareCommunityPost(post.id)} aria-label="Share" data-label="Share">
                          <span className="socialActionIcon socialShareIcon" aria-hidden="true"><i /></span>
                          <span className="socialActionText">Share</span>
                          <strong>{post.stats.shares.toLocaleString()}</strong>
                        </button>
                      </div>
                      </article>
                    ))}
                    {!visibleCommunityPosts.length && (
                      <p className="realDataEmpty">No signs match this feed yet. Follow creators or publish a sign to grow it.</p>
                    )}
                  </div>
                </main>

                <aside className="communityDiscoveryRail" aria-label="Discover community creators">
                  <section className="createPostCard communityQuickComposer">
                    <div className="postIdentity">
                      <span className={`communityAvatar smallAvatar avatarTone-${communityProfile.avatarTone || 'cyan'} avatarMode-${communityProfile.avatarMode || '3d'} avatarMood-${communityProfile.avatarMood || 'calm'} avatarAccessory-${communityProfile.avatarAccessory || 'none'} ${isSignovaProActive ? 'proCommunityAvatar' : ''}`}>
                        {communityProfile.avatarImage ? <img src={communityProfile.avatarImage} alt="" /> : <span className="avatarGlyph" aria-hidden="true"><i /><i /><i /></span>}
                        <em>{communityAvatarInitials}</em>
                        {isSignovaProActive && <b className="communityProMark" aria-label={signovaProBadgeLabel}>PRO</b>}
                      </span>
                      <input value={communityDraft} onChange={(event) => setCommunityDraft(event.target.value)} placeholder="Share a sign, tip, or question..." aria-label="Create community post" />
                    </div>
                    <div className="createPostActions">
                      <button type="button" className="ghostCommunityButton" onClick={() => setActivePanel('communityCreate')}>Create Sign</button>
                      <label className={communityComposerMedia ? 'ghostCommunityButton activeComposerMediaButton' : 'ghostCommunityButton'}>
                        <input type="file" accept="image/*,video/*" onChange={addCommunityComposerMedia} />
                        {communityComposerMedia ? communityComposerMedia.name : 'Add media'}
                      </label>
                      <button type="button" className="postButton" onClick={publishCommunityPost} disabled={!communityDraft.trim() && !communityComposerMedia}>Post</button>
                    </div>
                  </section>
                  <section className="communityPanel communityDiscoverCard">
                    <div className="communityPanelHeader"><strong>Discover creators</strong></div>
                    {topContributors.slice(0, 4).map((user) => (
                      <div className="communityCreatorSuggestion" key={user.name}>
                        <span className="miniAvatar">{user.avatar}</span>
                        <div><strong>{user.name}</strong><small>{user.signsCreated} signs · {user.label}</small></div>
                        <button type="button">Follow</button>
                      </div>
                    ))}
                  </section>
                  <section className="communityPanel communityDiscoverCard">
                    <div className="communityPanelHeader"><strong>Trending signs</strong></div>
                    <div className="communityTrendChips">
                      {(trendingSigns.length ? trendingSigns.slice(0, 6).map((sign) => sign.title) : ['Need Help', 'Thank You', 'Nice to meet you']).map((sign) => (
                        <button type="button" key={sign}>#{sign.replace(/\s+/g, '')}</button>
                      ))}
                    </div>
                  </section>
                  <button type="button" className="communityCreateCta" onClick={() => setActivePanel('communityCreate')}>
                    <span>Create a Community Sign</span>
                    <small>Teach a useful sign to learners around the world.</small>
                  </button>
                </aside>
              </div>
            </section>
          )}

          {activePanel === 'communityGroups' && (
            <section className="communityPage communityGroupsPage" aria-label="Signova community groups">
              <div className="communityGroupsLayout">
                <aside className="communityPanel groupDirectory" aria-label="Community group list">
                  <div className="communityPanelHeader groupDirectoryHeader">
                    <div>
                      <strong>Signova Groups</strong>
                    </div>
                    <div className="groupHeaderActions">
                      <button
                        type="button"
                        aria-label="Create group"
                        onClick={() => {
                          setGroupCreationContext('community');
                          setGroupModalOpen(true);
                          setCommunityGroupToolOpen('');
                        }}
                      >
                        ＋
                      </button>
                      <button type="button" className="groupChatActionsTrigger" aria-label="Community group conversation actions" onClick={() => setCommunityGroupToolOpen((open) => (open === 'group-chat-actions' ? '' : 'group-chat-actions'))}>•••</button>
                    </div>
                  </div>
                  <label className="communityGroupSearch">
                    <span aria-hidden="true">⌕</span>
                    <input value={communityGroupSearch} onChange={(event) => setCommunityGroupSearch(event.target.value)} placeholder="Search groups" aria-label="Search group directory" />
                  </label>
                  <div className="groupTabs directGroupCategories" aria-label="Group categories">
                    {[
                      ['all', 'All'],
                      ['joined', 'Joined'],
                      ['live', 'Live'],
                      ['archived', 'Archived'],
                      ...communityGroupCategoryOptions.map((category) => [`category:${category.toLowerCase()}`, category]),
                    ].map(([id, label]) => (
                      <button type="button" className={communityGroupCategory === id ? 'activeGroupTab' : ''} onClick={() => setCommunityGroupCategory(id)} key={id}>{label}</button>
                    ))}
                    <button type="button" className="addGroupCategoryButton" onClick={() => setCommunityGroupCategoryComposerOpen((open) => !open)} aria-label="Create group category">＋</button>
                  </div>
                  {communityGroupCategoryComposerOpen && (
                    <form className="groupCategoryComposer" onSubmit={createCommunityGroupCategory}>
                      <input value={communityGroupCategoryDraft} onChange={(event) => setCommunityGroupCategoryDraft(event.target.value)} placeholder="Category name" autoFocus />
                      <button type="submit" disabled={!communityGroupCategoryDraft.trim()}>Add</button>
                    </form>
                  )}
                  <div className="communityGroupDirectoryItems">
                    {visibleCommunityGroups.length ? visibleCommunityGroups.map((group) => (
                      <button
                        className={selectedCommunityGroup?.id === group.id ? 'communityGroupChat activeCommunityGroup' : 'communityGroupChat'}
                        type="button"
                        key={group.id}
                        onClick={() => {
                          setSelectedCommunityGroupId(group.id);
                          setCommunityGroupToolOpen('');
                          setCommunityGroupProfileOpen(false);
                        }}
                      >
                        <span className="communityGroupAvatar">{group.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</span>
                        <span>
                          <strong>{group.name}</strong>
                          <small>{group.latest}</small>
                        </span>
                        <em><b>{group.online}</b> online</em>
                      </button>
                    )) : <p className="realDataEmpty">No real Signova groups yet. Click + to create your first community group.</p>}
                  </div>
                </aside>

                <main className={`communityPanel groupChatPanel cleanGroupWorkspace ${selectedCommunityGroup ? '' : 'emptyCleanGroupWorkspace'}`} aria-label="Selected community group">
                  {!selectedCommunityGroup && (
                    <section className="groupWorkspaceEmpty">
                      <span className="emptyGroupMark" aria-hidden="true"><i /><b>＋</b></span>
                      <strong>Create your first Signova group</strong>
                      <p>Bring learners together for sign practice, clips, feedback, polls, and live meetings.</p>
                      <button type="button" onClick={() => { setGroupCreationContext('community'); setGroupModalOpen(true); }}>Create group</button>
                    </section>
                  )}
                  <section className="groupFocusHero">
                    <button type="button" className="communityGroupAvatar largeGroupAvatar groupProfileTrigger" onClick={() => setCommunityGroupProfileOpen(true)} aria-label="Open community group profile">{selectedCommunityGroup?.name?.[0] || 'G'}</button>
                    <div>
                      <strong>{selectedCommunityGroup?.name || 'Create a practical learning group'}</strong>
                      <div className="groupLiveActivity">
                        <i aria-hidden="true" />
                        <span><b>{selectedCommunityGroup?.online || 0} active now</b><small>{communityGroupPosts.filter((post) => post.groupId === selectedCommunityGroup?.id).length} recent updates</small></span>
                      </div>
                    </div>
                    <div className="groupHeroActions">
                      <button type="button" className="postButton groupMeetAction" disabled={!selectedCommunityGroup} onClick={() => startMeetingMode('video')} aria-label="Start community group meeting"><span className="groupMeetingIcon" aria-hidden="true"><i /><b /></span><span>Meet</span></button>
                      <button type="button" className="ghostCommunityButton" onClick={() => setCommunityGroupToolOpen('invite')}>Invite</button>
                      <button type="button" className="groupMoreAction" onClick={() => setCommunityGroupToolOpen((open) => (open === 'settings' ? '' : 'settings'))} aria-label="Community group settings" aria-expanded={communityGroupToolOpen === 'settings'}>⋮</button>
                    </div>
                  </section>

                  <section className="groupActivityPanel">
                    {selectedCommunityGroup ? (
                      <div className="groupActivityList">
                        {communityGroupPosts.filter((post) => post.groupId === selectedCommunityGroup.id).map((post) => (
                          <article className="memberGroupUpdate" key={post.id}>
                            <b>{post.author.slice(0, 1).toUpperCase()}</b>
                            <span><strong>{post.author}</strong><p>{post.text}</p>{post.audioUrl && <audio controls preload="metadata" src={post.audioUrl} />}<small>{post.time} · Local device only</small></span>
                          </article>
                        ))}
                        {!communityGroupPosts.some((post) => post.groupId === selectedCommunityGroup.id) && <p className="groupActivityEmpty">No activity yet. Start with a note, emoji, voice message, or meeting.</p>}
                      </div>
                    ) : (
                      <p className="realDataEmpty">No real group selected. Click + to create a group space.</p>
                    )}
                  </section>

                  {communityGroupToolOpen && (
                    <section className={`communityGroupMiniWindow communityGroupTool-${communityGroupToolOpen}`} aria-label="Community group tool">
                      <button type="button" onClick={() => setCommunityGroupToolOpen('')} aria-label="Close community group tool">×</button>
                      {communityGroupToolOpen === 'practice' && <><strong>Practice Window</strong><small>Start a focused sign drill for this group.</small><div className="communityMiniActionGrid"><button type="button">Greeting signs</button><button type="button">Hand accuracy</button><button type="button">Sentence chain</button></div></>}
                      {communityGroupToolOpen === 'poll' && <><strong>Audience Poll</strong><small>Ask members what sign to practice next.</small><input placeholder="Poll question" /><div className="communityMiniActionGrid"><button type="button">Need Help</button><button type="button">Thank You</button><button type="button">Emergency signs</button></div></>}
                      {communityGroupToolOpen === 'drive' && <><strong>Media Drive</strong><small>Share sign videos, worksheets, and call clips.</small><div className="communityMiniActionGrid"><button type="button">Upload clip</button><button type="button">Saved signs</button><button type="button">Library book</button></div></>}
                      {communityGroupToolOpen === 'review' && <><strong>Review Queue</strong><small>Approve created signs before they enter call-ready mode.</small><div className="communityMiniActionGrid"><button type="button">Pending signs</button><button type="button">AI checks</button><button type="button">Creator feedback</button></div></>}
                      {communityGroupToolOpen === 'invite' && <><strong>Invite Members</strong><small>Add learners, creators, interpreters, or family members.</small><input placeholder="@username or phone" /><div className="communityMiniActionGrid"><button type="button">Copy invite</button><button type="button">Add contact</button><button type="button">QR code</button></div></>}
                      {communityGroupToolOpen === 'settings' && <><strong>Group settings</strong><small>Membership, learning, accessibility, privacy, and meeting defaults.</small><div className="communityMiniActionGrid groupSettingsActionGrid"><button type="button" onClick={() => setCommunityGroupToolOpen('invite')}>Members & roles</button><button type="button" onClick={() => setStatus(`Group access: ${selectedCommunityGroup?.privacy || 'private'}`)}>Privacy & access</button><button type="button" onClick={() => setCommunityGroupToolOpen('review')}>Moderation</button><button type="button" onClick={() => setStatus('Group notifications updated.')}>Notifications</button><button type="button" onClick={() => setCommunityGroupToolOpen('practice')}>Practice defaults</button><button type="button" onClick={() => setCommunityGroupToolOpen('drive')}>Media permissions</button><button type="button" onClick={() => setStatus('Live captions enabled for group meetings.')}>Captions & language</button><button type="button" onClick={() => setStatus('Invite link controls opened.')}>Invite links</button><button type="button" onClick={() => setStatus('Accessibility preferences opened.')}>Accessibility</button></div></>}
                      {communityGroupToolOpen === 'group-chat-actions' && <><strong>Group conversation</strong><small>Actions for this community-group conversation only.</small><div className="communityMiniActionGrid groupChatActionGrid"><button type="button" onClick={() => handleCommunityGroupChatAction('archive')}>Archive group</button><button type="button" onClick={() => handleCommunityGroupChatAction('categorize')}>Add to community collection</button><button type="button" onClick={() => handleCommunityGroupChatAction('clear')}>Clear conversation</button><button type="button" className="dangerGroupSetting" onClick={() => handleCommunityGroupChatAction('delete')}>Delete group</button><button type="button" className="dangerGroupSetting" onClick={() => handleCommunityGroupChatAction('block')}>Block group</button></div></>}
                      {communityGroupToolOpen === 'directory-settings' && <><strong>Community Groups</strong><small>Controls for discovery and all community spaces. Chat groups stay separate.</small><div className="communityMiniActionGrid groupSettingsActionGrid"><button type="button" onClick={() => { setGroupCreationContext('community'); setGroupModalOpen(true); setCommunityGroupToolOpen(''); }}>Create community group</button><button type="button" onClick={() => setCommunityGroupCategory('joined')}>Joined groups</button><button type="button" onClick={() => setCommunityGroupCategory('live')}>Live groups</button><button type="button" onClick={() => setStatus('Community group discovery preferences opened.')}>Discovery</button><button type="button" onClick={() => setStatus('Community group notification preferences opened.')}>Notifications</button><button type="button" onClick={() => setStatus('Blocked community groups opened.')}>Blocked groups</button></div></>}
                      {communityGroupToolOpen === 'attach' && <><strong>Add to group</strong><small>Share something useful with this learning space.</small><div className="communityMiniActionGrid importantGroupAttachments"><button type="button" onClick={() => setCommunityGroupToolOpen('drive')}>Sign clip</button><button type="button" onClick={() => setCommunityGroupToolOpen('drive')}>Photo or video</button><button type="button" onClick={() => setCommunityGroupToolOpen('drive')}>Document</button><button type="button" onClick={() => setCommunityGroupToolOpen('poll')}>Poll</button><button type="button" onClick={() => setCommunityGroupToolOpen('practice')}>Practice task</button><button type="button" onClick={() => setCommunityGroupToolOpen('invite')}>Contact</button></div></>}
                      {communityGroupToolOpen === 'group-created' && <><strong>Group Created</strong><small>Your new group is ready. Add people or start a sign practice room.</small><div className="communityMiniActionGrid"><button type="button" onClick={() => setCommunityGroupToolOpen('invite')}>Invite</button><button type="button" onClick={() => setCommunityGroupToolOpen('practice')}>Practice</button><button type="button" onClick={() => startMeetingMode('video')}>Meet</button></div></>}
                    </section>
                  )}

                  {communityGroupProfileOpen && selectedCommunityGroup && (
                    <section className="communityGroupProfileWindow" role="dialog" aria-modal="false" aria-label={`${selectedCommunityGroup.name} community profile`}>
                      <button type="button" className="communityGroupProfileClose" onClick={() => setCommunityGroupProfileOpen(false)} aria-label="Close group profile">×</button>
                      <span className="communityGroupAvatar groupProfileAvatar">{selectedCommunityGroup.name.slice(0, 1)}</span>
                      <div className="groupProfileIdentity">
                        <small>Community group</small>
                        <strong>{selectedCommunityGroup.name}</strong>
                        <span>{selectedCommunityGroup.username}</span>
                      </div>
                      <p>{selectedCommunityGroup.latest}</p>
                      <div className="groupProfileStats">
                        <span><strong>{selectedCommunityGroup.memberCount}</strong><small>Members</small></span>
                        <span><strong>{selectedCommunityGroup.online}</strong><small>Online</small></span>
                        <span><strong>{selectedCommunityGroup.category}</strong><small>Category</small></span>
                      </div>
                      <div className="groupProfileDetails">
                        <span><small>Language</small><strong>{selectedCommunityGroup.language}</strong></span>
                        <span><small>Access</small><strong>{selectedCommunityGroup.privacy}</strong></span>
                        <span><small>Level</small><strong>{selectedCommunityGroup.level}</strong></span>
                        <span><small>Posting</small><strong>{selectedCommunityGroup.postingPermission || 'members'}</strong></span>
                      </div>
                      <div className="groupProfileSecurity"><b aria-hidden="true">⌁</b><span><strong>Local preview protection</strong><small>Temporary device-session key; group E2EE is not yet available</small></span></div>
                      <div className="groupProfileActions">
                        <button type="button" onClick={() => { setCommunityGroupProfileOpen(false); setCommunityGroupToolOpen('invite'); }}>Invite</button>
                        <button type="button" onClick={() => { setCommunityGroupProfileOpen(false); setCommunityGroupToolOpen('settings'); }}>Settings</button>
                      </div>
                    </section>
                  )}

                  <form className="groupComposer cleanGroupComposer" onSubmit={postCommunityGroupNote}>
                    <button type="button" className="groupComposerAttach" onClick={() => setCommunityGroupToolOpen((open) => (open === 'attach' ? '' : 'attach'))} aria-label="Add to group" aria-expanded={communityGroupToolOpen === 'attach'}>
                      <span className="groupComposerAttachIcon" aria-hidden="true"><i /><i /></span>
                    </button>
                    <button type="button" className="groupComposerEmoji" onClick={() => setCommunityGroupEmojiOpen((open) => !open)} aria-label="Add emoji" aria-expanded={communityGroupEmojiOpen}>☺</button>
                    <input
                      value={communityGroupDraft}
                      onChange={(event) => setCommunityGroupDraft(event.target.value)}
                      placeholder="Write a practice note..."
                      aria-label="Community group message"
                    />
                    <button type="button" className={communityGroupVoice.active ? 'groupComposerVoice activeGroupVoice' : 'groupComposerVoice'} onClick={toggleCommunityGroupVoice} aria-label={communityGroupVoice.active ? 'Stop and send voice message' : 'Record voice message'}>
                      <span className="groupVoiceIcon" aria-hidden="true"><i /><b /></span>
                      {communityGroupVoice.active && <small>{formatVoiceTime(communityGroupVoice.seconds)}</small>}
                    </button>
                    <button type="submit" className="postButton" disabled={!communityGroupDraft.trim() || !selectedCommunityGroup}>Post</button>
                    {communityGroupEmojiOpen && (
                      <div className="communityGroupEmojiPicker" aria-label="Community group emojis">
                        {COMPOSER_EMOJIS.slice(0, 16).map((emoji) => <button type="button" key={emoji} onClick={() => { setCommunityGroupDraft((draft) => `${draft}${emoji}`); setCommunityGroupEmojiOpen(false); }}>{emoji}</button>)}
                      </div>
                    )}
                  </form>
                </main>
              </div>
            </section>
          )}

          {activePanel === 'settings' && (
            <section className={`panel settingsPanel ${activeSettingsSection ? 'settingsSubPageActive' : ''}`}>
              {!activeSettingsSection ? (
                <>
                  <label className="settingsSearchBar">
                    <span aria-hidden="true">⌕</span>
                    <input
                      value={settingsSearch}
                      onChange={(event) => setSettingsSearch(event.target.value)}
                      placeholder="Search"
                      aria-label="Search settings"
                    />
                  </label>

                  <div className="settingsHero">
                    <div className="settingsProfilePhoto" aria-hidden="true">
                      {settings.account.profilePhoto ? <img src={settings.account.profilePhoto} alt="" /> : <img src="/app-logo.png" alt="" />}
                    </div>
                    <div className="settingsProfileNameBlock">
                      <span>App profile</span>
                      <strong>{settings.account.name || 'Signova User'}</strong>
                      <small>{normalizeAuthUsername(settings.account.username || 'signova.user')}</small>
                    </div>
                  </div>

                  <div className="settingsProfileMoment" aria-label="Profile summary">
                    <label className="settingsProfileNoteEditor">
                      <span>Signova profile note</span>
                      <textarea
                        value={settings.account.about}
                        onChange={(event) => updateSetting('account', 'about', event.target.value)}
                        maxLength={120}
                        placeholder="Write a short profile note..."
                        aria-label="Customize Signova profile note"
                      />
                    </label>
                  </div>

                  <div className="settingsChooser" aria-label="Settings categories">
                    {filteredSettingsSections.map((section) => (
                      <button
                        type="button"
                        className="settingsChoiceCard"
                        key={section.id}
                        onClick={() => setActiveSettingsSection(section.id)}
                      >
                        <span className="settingsIcon">{section.icon}</span>
                        <span>
                          <strong>{section.title}</strong>
                          <small>{section.detail}</small>
                        </span>
                        <em aria-hidden="true">›</em>
                      </button>
                    ))}
                    {!filteredSettingsSections.length && (
                      <p className="settingsNoResults">No settings found for “{settingsSearch.trim()}”.</p>
                    )}
                  </div>

                </>
              ) : (
                <div className="settingsSubPageHeader">
                  <button type="button" onClick={() => setActiveSettingsSection('')} aria-label="Back to settings">‹</button>
                  <div>
                    <span>Settings</span>
                    <strong>{activeSettingsMeta?.title}</strong>
                    <small>{activeSettingsMeta?.detail}</small>
                  </div>
                </div>
              )}

              <div data-setting-section="account" className={`settingsGroup settingsDetailGroup ${activeSettingsSection === 'account' ? 'activeSettingsDetail' : ''}`}>
                <div className="settingsGroupHeader">
                  <span className="settingsIcon">A</span>
                  <div>
                    <strong>Account</strong>
                    <small>Profile, password, plan, and session controls.</small>
                  </div>
                </div>
                <div className="settingsGrid twoColumns">
                  <label className="settingField">
                    <span>Profile name</span>
                    <input value={settings.account.name} onChange={(event) => updateSetting('account', 'name', event.target.value)} />
                  </label>
                  <label className="settingField">
                    <span>Username</span>
                    <input value={settings.account.username} onChange={(event) => updateSetting('account', 'username', normalizeAuthUsername(event.target.value))} placeholder="@your.name" autoComplete="username" />
                  </label>
                  <label className="settingField">
                    <span>Phone number</span>
                    <input type="tel" value={settings.account.phone} onChange={(event) => updateSetting('account', 'phone', event.target.value)} placeholder="+91XXXXXXXXXX" autoComplete="tel" />
                  </label>
                  <label className="settingField">
                    <span>Email</span>
                    <input type="email" value={settings.account.email || authenticatedFirebaseUser?.email || ''} readOnly />
                  </label>
                  <label className="settingField">
                    <span>Password</span>
                    <button type="button" className="settingsInlineAction" onClick={sendAccountPasswordReset}>Send change link</button>
                  </label>
                  <label className="settingField">
                    <span>Subscription plan</span>
                    <select value={settings.account.subscription} onChange={(event) => updateSetting('account', 'subscription', event.target.value)}>
                      <option>Free learning plan</option>
                      <option>Signova Pro Trial</option>
                      <option>Student plan</option>
                      <option>Signova Student Pro</option>
                      <option>Pro accessibility plan</option>
                      <option>Signova Pro</option>
                    </select>
                  </label>
                </div>
                {accountSettingsMessage.text && (
                  <p className={`settingsAccountMessage ${accountSettingsMessage.type === 'success' ? 'success' : 'error'}`}>{accountSettingsMessage.text}</p>
                )}
                <div className="settingsActions settingsAccountPrimaryActions">
                  <button type="button" className="primaryButton settingsActionButton" onClick={saveAccountSettings}>Save profile changes</button>
                  <button type="button" className="secondaryButton settingsActionButton" onClick={addAnotherAccount}>Add another account</button>
                </div>
                <div className="settingsAccountSessionCard" aria-label="Account session">
                  <img src="/app-logo.png" alt="" />
                  <div>
                    <strong>Signova account session</strong>
                    <small>{settings.account.email || authenticatedFirebaseUser?.email || 'Signed in on this device'}</small>
                  </div>
                  <button type="button" className="settingsLogoutButton" onClick={handleSignovaLogout}>
                    <span aria-hidden="true">↪</span>
                    Logout
                  </button>
                </div>
              </div>

              <div data-setting-section="camera" className={`settingsGroup settingsDetailGroup ${activeSettingsSection === 'camera' ? 'activeSettingsDetail' : ''}`}>
                <div className="settingsGroupHeader">
                  <span className="settingsIcon">C</span>
                  <div>
                    <strong>Camera & Mic</strong>
                    <small>Capture settings that directly affect latency and recognition quality.</small>
                  </div>
                </div>
                <div className="settingsGrid">
                  <label className="settingSwitch">
                    <input type="checkbox" checked={cameraEnabled} onChange={toggleCameraTrack} />
                    <span><strong>Camera</strong><small>{cameraEnabled ? 'Camera feed is active' : 'Camera feed is off'}</small></span>
                  </label>
                  <label className="settingField">
                    <span>Camera selection</span>
                    <select value={settings.camera.facingMode} onChange={(event) => updateSetting('camera', 'facingMode', event.target.value)}>
                      <option value="user">Front camera</option>
                      <option value="environment">Back camera</option>
                    </select>
                  </label>
                  <label className="settingField">
                    <span>Resolution</span>
                    <select value={settings.camera.resolution} onChange={(event) => updateSetting('camera', 'resolution', event.target.value)}>
                      <option value="480p">480p</option>
                      <option value="720p">720p</option>
                      <option value="1080p">1080p</option>
                      <option value="1440p">1440p</option>
                    </select>
                  </label>
                  <label className="settingField">
                    <span>Camera FPS</span>
                    <select value={settings.camera.fps} onChange={(event) => updateSetting('camera', 'fps', Number(event.target.value))}>
                      <option value={15}>15 FPS</option>
                      <option value={30}>30 FPS</option>
                    </select>
                  </label>
                  <label className="settingSwitch">
                    <input type="checkbox" checked={micEnabled} onChange={toggleMicTrack} />
                    <span><strong>Microphone</strong><small>{micEnabled ? 'Voice input enabled' : 'Voice input muted'}</small></span>
                  </label>
                  <label className="settingField">
                    <span>Input device</span>
                    <select value={settings.microphone.inputDevice} onChange={(event) => updateSetting('microphone', 'inputDevice', event.target.value)}>
                      <option value="default">Default microphone</option>
                      <option value="communications">Communication microphone</option>
                    </select>
                  </label>
                  <label className="settingSwitch">
                    <input type="checkbox" checked={settings.microphone.noiseSuppression} onChange={(event) => updateSetting('microphone', 'noiseSuppression', event.target.checked)} />
                    <span><strong>Noise suppression</strong><small>Reduce background noise for clearer voice cues.</small></span>
                  </label>
                </div>
              </div>

              <div data-setting-section="security" className={`settingsGroup settingsDetailGroup ${activeSettingsSection === 'security' ? 'activeSettingsDetail' : ''}`}>
                <div className="settingsGroupHeader">
                  <span className="settingsIcon">S</span>
                  <div>
                    <strong>Security</strong>
                    <small>Two-factor authorization, app lock, and login protection.</small>
                  </div>
                </div>
                <div className="settingsSecurityHero">
                  <span aria-hidden="true">⌾</span>
                  <div>
                    <strong>{settings.security?.twoFactorAuthorization || settings.account.twoFactor ? 'Security is active' : 'Security is ready'}</strong>
                    <small>Use email verification, Signova Lock, and trusted-device controls to protect private chats.</small>
                  </div>
                </div>
                <div className="settingsDpdpNotice">
                  <strong>DPDP-ready protection</strong>
                  <small>Clear consent, child safety, data export/delete, and sensitive-action confirmation for Indian users.</small>
                </div>
                <div className="settingsGrid">
                  <label className="settingSwitch">
                    <input type="checkbox" checked={Boolean(settings.security.dpdpNoticeAccepted)} onChange={(event) => updateSetting('security', 'dpdpNoticeAccepted', event.target.checked)} />
                    <span><strong>Accept privacy notice</strong><small>I understand what Signova stores, what stays on-device, and how to withdraw consent.</small></span>
                  </label>
                  <label className="settingSwitch">
                    <input
                      type="checkbox"
                      checked={Boolean(settings.security?.twoFactorAuthorization || settings.account.twoFactor)}
                      onChange={(event) => {
                        updateSetting('security', 'twoFactorAuthorization', event.target.checked);
                        updateSetting('account', 'twoFactor', event.target.checked);
                      }}
                    />
                    <span><strong>Two-factor authorization</strong><small>Email verification + device unlock before sensitive account actions.</small></span>
                  </label>
                  <label className="settingSwitch">
                    <input type="checkbox" checked={settings.display.signovaLock} onChange={(event) => updateSetting('display', 'signovaLock', event.target.checked)} />
                    <span><strong>Signova Lock</strong><small>Protect private chat, call history, and account settings with device unlock or PIN.</small></span>
                  </label>
                  <div className={`settingsLockMethodGrid ${settings.display.signovaLock ? 'enabled' : 'disabled'}`} aria-label="Signova Lock methods">
                    {[
                      ['signovaLockFace', 'Face lock', 'Use supported face unlock'],
                      ['signovaLockFingerprint', 'Fingerprint', 'Use supported fingerprint unlock'],
                      ['signovaLockPin', 'PIN fallback', 'Keep a manual unlock option'],
                    ].map(([key, title, detail]) => (
                      <label key={key} className="settingsLockMethod">
                        <input type="checkbox" checked={Boolean(settings.display[key])} disabled={!settings.display.signovaLock} onChange={(event) => updateSetting('display', key, event.target.checked)} />
                        <span><strong>{title}</strong><small>{detail}</small></span>
                      </label>
                    ))}
                  </div>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.security.loginAlerts} onChange={(event) => updateSetting('security', 'loginAlerts', event.target.checked)} /><span><strong>Login alerts</strong><small>Show a security notice when a new device signs in.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.security.childSafetyMode} onChange={(event) => updateSetting('security', 'childSafetyMode', event.target.checked)} /><span><strong>Child safety mode</strong><small>Disables public profile hints and requires safer defaults for younger learners.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.security.trustedDevice} onChange={(event) => updateSetting('security', 'trustedDevice', event.target.checked)} /><span><strong>Trust this device</strong><small>Keep this browser signed in until you log out.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.security.requirePasswordForSensitiveActions} onChange={(event) => updateSetting('security', 'requirePasswordForSensitiveActions', event.target.checked)} /><span><strong>Confirm sensitive actions</strong><small>Ask for password/reset confirmation before account and privacy changes.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.security.hideSensitivePreviews} onChange={(event) => updateSetting('security', 'hideSensitivePreviews', event.target.checked)} /><span><strong>Hide sensitive previews</strong><small>Hide private message/call previews in mini windows and notifications.</small></span></label>
                  <label className="settingField"><span>Auto-lock after</span><select value={settings.security.autoLockMinutes} onChange={(event) => updateSetting('security', 'autoLockMinutes', Number(event.target.value))}><option value={5}>5 minutes</option><option value={15}>15 minutes</option><option value={30}>30 minutes</option><option value={60}>1 hour</option></select></label>
                </div>
                <div className="settingsActions">
                  <button type="button" className="settingsActionButton" onClick={sendAccountPasswordReset}>Send password reset email</button>
                  <button type="button" className="settingsActionButton" disabled title="Server-side session management is not connected yet">Active sessions unavailable</button>
                </div>
              </div>

              <div data-setting-section="translation" className={`settingsGroup settingsDetailGroup ${activeSettingsSection === 'translation' ? 'activeSettingsDetail' : ''}`}>
                <div className="settingsGroupHeader">
                  <span className="settingsIcon">T</span>
                  <div>
                    <strong>Sign Translation</strong>
                    <small>Control how Signova converts signs into text and voice.</small>
                  </div>
                </div>
                <div className="settingsGrid">
                  <label className="settingSwitch synapseToggle">
                    <input type="checkbox" checked={synapseEnabled} onChange={(event) => updateSettingAndTrack('translation', 'enabled', event.target.checked)} />
                    <span><strong>Enable translation</strong><small>{synapseEnabled ? 'Synapse engine is listening for signs' : 'Translation is paused'}</small></span>
                  </label>
                  <label className="settingField">
                    <span>Translation mode</span>
                    <select value={settings.translation.mode} onChange={(event) => updateSetting('translation', 'mode', event.target.value)}>
                      <option value="word">Word mode</option>
                      <option value="sentence">Sentence mode</option>
                    </select>
                  </label>
                  <label className="settingField">
                    <span>Language</span>
                    <select value={settings.translation.language} onChange={(event) => changeTranslationLanguage(event.target.value)}>
                      <option>English</option>
                      <option>Hindi</option>
                      <option>Hinglish</option>
                      <option>ISL Gloss</option>
                    </select>
                  </label>
                  <label className="settingField">
                    <span>Output type</span>
                    <select value={settings.translation.outputType} onChange={(event) => updateSettingAndTrack('translation', 'outputType', event.target.value)}>
                      <option value="text">Text</option>
                      <option value="voice">Voice</option>
                      <option value="textVoice">Text + Voice</option>
                    </select>
                  </label>
                  <label className="settingRange wideSetting">
                    <span>Confidence threshold <strong>{formatConfidence(settings.translation.confidenceThreshold)}</strong></span>
                    <input type="range" min="0.2" max="0.9" step="0.01" value={settings.translation.confidenceThreshold} onChange={(event) => updateSetting('translation', 'confidenceThreshold', Number(event.target.value))} />
                  </label>
                </div>
              </div>

              <div data-setting-section="lighting" className={`settingsGroup settingsDetailGroup ${activeSettingsSection === 'lighting' ? 'activeSettingsDetail' : ''}`}>
                <div className="settingsGroupHeader">
                  <span className="settingsIcon">L</span>
                  <div>
                    <strong>Ring Light & Preprocessing</strong>
                    <small>Improve hand visibility before frames reach the model.</small>
                  </div>
                </div>
                <div className="settingsGrid">
                  <label className="settingSwitch"><input type="checkbox" checked={settings.lighting.autoLowLight} onChange={(event) => updateSetting('lighting', 'autoLowLight', event.target.checked)} /><span><strong>Auto low light detection</strong><small>Warns when lighting may reduce accuracy.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.lighting.ringLight} onChange={(event) => updateSetting('lighting', 'ringLight', event.target.checked)} /><span><strong>Ring light</strong><small>Boost face and hand visibility.</small></span></label>
                  <label className="settingRange"><span>Brightness <strong>{settings.lighting.brightness}%</strong></span><input type="range" min="20" max="100" value={settings.lighting.brightness} onChange={(event) => updateSetting('lighting', 'brightness', Number(event.target.value))} /></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.lighting.aiEnhancement} onChange={(event) => updateSetting('lighting', 'aiEnhancement', event.target.checked)} /><span><strong>AI enhancement</strong><small>Prioritize clearer hand boundaries.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.filters.enabled} onChange={(event) => updateSetting('filters', 'enabled', event.target.checked)} /><span><strong>Filters</strong><small>Enable preprocessing filters.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.filters.backgroundBlur} onChange={(event) => updateSetting('filters', 'backgroundBlur', event.target.checked)} /><span><strong>Background blur</strong><small>Reduce background distraction.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.filters.contrastEnhancement} onChange={(event) => updateSetting('filters', 'contrastEnhancement', event.target.checked)} /><span><strong>Contrast enhancement</strong><small>Improve edge consistency.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.filters.skinOptimization} onChange={(event) => updateSetting('filters', 'skinOptimization', event.target.checked)} /><span><strong>Skin detection optimization</strong><small>Advanced hand segmentation aid.</small></span></label>
                </div>
              </div>

              <div data-setting-section="ai" className={`settingsGroup settingsDetailGroup ${activeSettingsSection === 'ai' ? 'activeSettingsDetail' : ''}`}>
                <div className="settingsGroupHeader">
                  <span className="settingsIcon">P</span>
                  <div>
                    <strong>AI Performance</strong>
                    <small>Choose between speed, balance, and recognition confidence.</small>
                  </div>
                </div>
                <div className="settingsGrid">
                  <label className="settingField">
                    <span>Performance mode</span>
                    <select value={settings.ai.performanceMode} onChange={(event) => updateSetting('ai', 'performanceMode', event.target.value)}>
                      <option value="lowLatency">Low Latency</option>
                      <option value="balanced">Balanced</option>
                      <option value="highAccuracy">High Accuracy</option>
                    </select>
                  </label>
                  <label className="settingField">
                    <span>Frame processing</span>
                    <select value={settings.ai.frameRate} onChange={(event) => updateSetting('ai', 'frameRate', Number(event.target.value))}>
                      <option value={15}>15 FPS</option>
                      <option value={30}>30 FPS</option>
                    </select>
                  </label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.ai.frameSkipping} onChange={(event) => updateSetting('ai', 'frameSkipping', event.target.checked)} /><span><strong>Frame skipping</strong><small>Skip frames when speed matters more than detail.</small></span></label>
                  <label className="settingField">
                    <span>Model selection</span>
                    <select value={settings.ai.model} onChange={(event) => updateSetting('ai', 'model', event.target.value)}>
                      <option value="mixed">Auto mixed model</option>
                      <option value="isl">ISL sentence model</option>
                      <option value="asl">ASL word model</option>
                      <option value="basic">Quick gesture model</option>
                    </select>
                    <small>Alphabet is reserved for community learning drafts, then promoted into word and sentence signs.</small>
                  </label>
                </div>
              </div>

              <div data-setting-section="display" className={`settingsGroup settingsDetailGroup ${activeSettingsSection === 'display' ? 'activeSettingsDetail' : ''}`}>
                <div className="settingsGroupHeader">
                  <span className="settingsIcon">D</span>
                  <div>
                    <strong>Display & Accessibility</strong>
                    <small>Make the interface easier to read, scan, and follow.</small>
                  </div>
                </div>
                <div className="settingsGrid">
                  <label className="settingField"><span>Theme</span><select value={settings.display.theme} onChange={(event) => updateSettingAndTrack('display', 'theme', event.target.value)}><option value="light">Light</option><option value="dark">Dark</option><option value="system">System default</option></select></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.display.highContrast} onChange={(event) => updateSetting('display', 'highContrast', event.target.checked)} /><span><strong>High contrast</strong><small>Increase separation for key UI controls.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.display.largeText} onChange={(event) => updateSetting('display', 'largeText', event.target.checked)} /><span><strong>Large text</strong><small>Use larger text in captions and controls.</small></span></label>
                  <label className="settingField"><span>Subtitle size</span><select value={settings.display.subtitleSize} onChange={(event) => updateSetting('display', 'subtitleSize', event.target.value)}><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.display.visualFeedback} onChange={(event) => updateSetting('display', 'visualFeedback', event.target.checked)} /><span><strong>Visual feedback</strong><small>Show recognition and correction cues.</small></span></label>
                </div>
              </div>

              <div data-setting-section="notifications" className={`settingsGroup settingsDetailGroup ${activeSettingsSection === 'notifications' ? 'activeSettingsDetail' : ''}`}>
                <div className="settingsGroupHeader">
                  <span className="settingsIcon">N</span>
                  <div>
                    <strong>Notifications</strong>
                    <small>Practice, learning, and achievement updates.</small>
                  </div>
                </div>
                <div className="settingsGrid">
                  <label className="settingSwitch"><input type="checkbox" checked={settings.notifications.practiceReminders} onChange={(event) => updateSetting('notifications', 'practiceReminders', event.target.checked)} /><span><strong>Practice reminders</strong><small>Keep daily learning consistent.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.notifications.learningAlerts} onChange={(event) => updateSetting('notifications', 'learningAlerts', event.target.checked)} /><span><strong>Learning alerts</strong><small>Notify when new signs are available.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.notifications.achievements} onChange={(event) => updateSetting('notifications', 'achievements', event.target.checked)} /><span><strong>Achievements</strong><small>Celebrate streaks and accuracy gains.</small></span></label>
                </div>
              </div>

              <div data-setting-section="practice" className={`settingsGroup settingsDetailGroup ${activeSettingsSection === 'practice' ? 'activeSettingsDetail' : ''}`}>
                <div className="settingsGroupHeader">
                  <span className="settingsIcon">S</span>
                  <div>
                    <strong>Gesture Feedback & Practice</strong>
                    <small>Personalize coaching and daily practice intensity.</small>
                  </div>
                </div>
                <div className="settingsGrid">
                  <label className="settingSwitch"><input type="checkbox" checked={settings.feedback.realTimeCorrection} onChange={(event) => updateSetting('feedback', 'realTimeCorrection', event.target.checked)} /><span><strong>Real-time correction</strong><small>Guide hand position while signing.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.feedback.errorHighlighting} onChange={(event) => updateSetting('feedback', 'errorHighlighting', event.target.checked)} /><span><strong>Error highlighting</strong><small>Show missed movement or shape cues.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.feedback.learningSuggestions} onChange={(event) => updateSetting('feedback', 'learningSuggestions', event.target.checked)} /><span><strong>Learning suggestions</strong><small>Recommend signs from recent history.</small></span></label>
                  <label className="settingField"><span>Difficulty</span><select value={settings.practice.difficulty} onChange={(event) => updateSetting('practice', 'difficulty', event.target.value)}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.practice.reminders} onChange={(event) => updateSetting('practice', 'reminders', event.target.checked)} /><span><strong>Practice reminders</strong><small>Use goals to keep practice active.</small></span></label>
                  <label className="settingRange"><span>Daily goal <strong>{settings.practice.dailyGoal} min</strong></span><input type="range" min="5" max="60" step="5" value={settings.practice.dailyGoal} onChange={(event) => updateSetting('practice', 'dailyGoal', Number(event.target.value))} /></label>
                </div>
              </div>

              <div data-setting-section="privacy" className={`settingsGroup settingsDetailGroup ${activeSettingsSection === 'privacy' ? 'activeSettingsDetail' : ''}`}>
                <div className="settingsGroupHeader">
                  <span className="settingsIcon">R</span>
                  <div>
                    <strong>Privacy & Data</strong>
                    <small>Decide what Signova stores and what leaves the device.</small>
                  </div>
                </div>
                <div className="settingsGrid">
                  <div className="settingsDpdpNotice wideSetting">
                    <strong>DPDP consent controls</strong>
                    <small>Video is off by default. Public community identity, QR sharing, AI improvement data, and history storage stay user-controlled.</small>
                  </div>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.privacy.cameraProcessing} onChange={(event) => updateSetting('privacy', 'cameraProcessing', event.target.checked)} /><span><strong>Allow camera processing</strong><small>Camera is used for live signs only; video is not saved unless “Save video data” is enabled.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.privacy.saveVideoData} onChange={(event) => updateSetting('privacy', 'saveVideoData', event.target.checked)} /><span><strong>Save video data</strong><small>Off by default for private practice.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.privacy.storeHistory} onChange={(event) => updateSetting('privacy', 'storeHistory', event.target.checked)} /><span><strong>Store translation history</strong><small>Use recent signs for learning suggestions.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.privacy.dataSharing} onChange={(event) => updateSetting('privacy', 'dataSharing', event.target.checked)} /><span><strong>Data sharing consent</strong><small>Share anonymized data for model improvement.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.privacy.communityPublicProfile} onChange={(event) => updateSetting('privacy', 'communityPublicProfile', event.target.checked)} /><span><strong>Public community profile</strong><small>Show your public creator identity on posts, groups, likes, and comments.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.privacy.qrSharing} onChange={(event) => updateSetting('privacy', 'qrSharing', event.target.checked)} /><span><strong>QR profile sharing</strong><small>Share only public profile link, display name, username, and language preference.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.privacy.showUsername} onChange={(event) => updateSetting('privacy', 'showUsername', event.target.checked)} /><span><strong>Show username</strong><small>Show @username in chat headers and contact rows.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.privacy.showNumber} onChange={(event) => updateSetting('privacy', 'showNumber', event.target.checked)} /><span><strong>Show phone number</strong><small>Show phone number in chat contact rows.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.privacy.showOnlineStatus} onChange={(event) => updateSetting('privacy', 'showOnlineStatus', event.target.checked)} /><span><strong>Show online status</strong><small>Show online, away, active now, and device presence.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.privacy.showLastSeen} onChange={(event) => updateSetting('privacy', 'showLastSeen', event.target.checked)} /><span><strong>Show last seen</strong><small>Show last seen time in chat presence.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.privacy.readReceipts} onChange={(event) => updateSetting('privacy', 'readReceipts', event.target.checked)} /><span><strong>Read receipts</strong><small>Show sent, delivered, and read times.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.privacy.saveChatHistory} onChange={(event) => updateSetting('privacy', 'saveChatHistory', event.target.checked)} /><span><strong>Save chat history</strong><small>Keep text, sign, voice, and call history locally.</small></span></label>
                </div>
                <div className="settingsActions">
                  <button type="button" className="secondaryButton" onClick={clearSignovaData}>Clear history</button>
                  <button type="button" className="secondaryButton" onClick={exportSignovaData}>Export data</button>
                  <button type="button" className="dangerButton" onClick={deleteAccountPreview}>Delete account</button>
                </div>
              </div>

              <div data-setting-section="device" className={`settingsGroup settingsDetailGroup ${activeSettingsSection === 'device' ? 'activeSettingsDetail' : ''}`}>
                <div className="settingsGroupHeader">
                  <span className="settingsIcon">▤</span>
                  <div>
                    <strong>Device & Performance</strong>
                    <small>Keep Signova comfortable on this device.</small>
                  </div>
                </div>
                <div className="settingsDeviceSummary" aria-label="Detected device summary">
                  <span><strong>{detectedDeviceProfile.deviceType}</strong><small>Layout</small></span>
                  <span><strong>{detectedDeviceProfile.performance}</strong><small>Performance</small></span>
                  <span><strong>{detectedDeviceProfile.network}</strong><small>Network</small></span>
                  <span><strong>{detectedDeviceProfile.motion}</strong><small>Motion</small></span>
                </div>
                <div className="settingsGrid">
                  <label className="settingSwitch"><input type="checkbox" checked={settings.device.dataSaver} onChange={(event) => updateSetting('device', 'dataSaver', event.target.checked)} /><span><strong>Data saver</strong><small>Reduce media and background sync on slow networks.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.device.autoMediaQuality} onChange={(event) => updateSetting('device', 'autoMediaQuality', event.target.checked)} /><span><strong>Auto media quality</strong><small>Choose lighter video quality when the device is busy.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.device.reduceMotion} onChange={(event) => updateSetting('device', 'reduceMotion', event.target.checked)} /><span><strong>Reduce motion</strong><small>Make transitions calmer and easier on the eyes.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.device.compactMode} onChange={(event) => updateSetting('device', 'compactMode', event.target.checked)} /><span><strong>Compact layout</strong><small>Use tighter spacing on small screens.</small></span></label>
                  <label className="settingSwitch"><input type="checkbox" checked={settings.device.offlineCache} onChange={(event) => updateSetting('device', 'offlineCache', event.target.checked)} /><span><strong>Offline cache</strong><small>Keep recent learning data available on this device.</small></span></label>
                </div>
              </div>

              <div data-setting-section="about" className={`settingsGroup settingsDetailGroup ${activeSettingsSection === 'about' ? 'activeSettingsDetail' : ''}`}>
                <div className="settingsGroupHeader">
                  <span className="settingsIcon">I</span>
                  <div>
                    <strong>About Signova</strong>
                    <small>Ownership, developer credit, and system health.</small>
                  </div>
                </div>
                <div className="settingsLegalNotice">
                  <strong>All copyrighted by Synapse Neural Technologies Pvt. Ltd.</strong>
                  <small>Developed by Akshat Sharma.</small>
                </div>
                <div className="settingsGrid compactMetrics">
                  <div className={`metric connectionMetric ${apiConnection.status}`}>
                    <span>Connection</span>
                    <strong>{apiConnection.status === 'connected' ? 'Connected' : apiConnection.status}</strong>
                    <small>{apiConnection.detail}</small>
                  </div>
                  <div className="metric"><span>Backend</span><strong>{apiConnection.backend}</strong><small>Port 5000 API gateway</small></div>
                  <div className="metric"><span>AI Service</span><strong>{apiConnection.ai}</strong><small>Port 8000 Synapse engine</small></div>
                  <div className="metric"><span>Sign Library</span><strong>{signApiStatus}</strong></div>
                  <div className="metric"><span>Performance Profile</span><strong>{PERFORMANCE_PROFILES[settings.ai.performanceMode].label}</strong></div>
                  <div className="metric"><span>Model Quality</span><strong>{formatMetricPercent(activeModelMetrics.accuracy ?? activeModelMetrics.best_validation_accuracy)}</strong><small>{aiMetrics.status}</small></div>
                </div>
              </div>
            </section>
          )}
        </div>
      </aside>
      )}

      {contactModalOpen && (
        <div className="contactMiniOverlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setContactModalOpen(false);
        }}>
          <section className="contactMiniModal" role="dialog" aria-modal="true" aria-label="Add Signova contact">
            <button type="button" className="contactMiniClose" onClick={() => setContactModalOpen(false)} aria-label="Close add contact">×</button>
            <div className="modalBrandHeader">
              <span className="modalLogo3d"><img src="/app-logo.png" alt="" /></span>
              <div>
                <span>Add Contact</span>
                <strong>Signova identity card</strong>
                <small>Number + username identification</small>
              </div>
            </div>
            <form className="contactForm" onSubmit={addContact}>
              <input className="signSearch" value={contactForm.name} onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })} placeholder="Full name" />
              <div className="contactPhoneRow">
                <select className="signSearch" value={contactForm.countryCode} onChange={(event) => setContactForm({ ...contactForm, countryCode: event.target.value })} aria-label="Country code">
                  {CONTACT_COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>{country.flag} {country.code}</option>
                  ))}
                </select>
                <input className="signSearch" value={contactForm.number} onChange={(event) => setContactForm({ ...contactForm, number: event.target.value.replace(/\D/g, '') })} placeholder="Phone number (optional)" inputMode="numeric" />
              </div>
              <input className="signSearch" value={contactForm.username} onChange={(event) => setContactForm({ ...contactForm, username: event.target.value })} placeholder="@username" />
              {contactFormError ? <small className="contactFormError">{contactFormError}</small> : null}
              <small className="contactIdentityNote">Username is locked as the default profile identity. Number can stay hidden.</small>
              <div className="contactAvatarOptions" aria-label="Contact avatar view">
                <button type="button" className={contactForm.avatarChoice === 'signova' ? 'activeContactAvatarOption' : ''} onClick={() => setContactForm({ ...contactForm, avatarChoice: 'signova' })}>
                  <span className="contactAvatar signovaContactAvatar"><img src="/app-logo.png" alt="" /><em>{contactForm.name.trim().charAt(0).toUpperCase() || 'S'}</em></span>
                  Signova icon
                </button>
                <button type="button" className={contactForm.avatarChoice === 'initial' ? 'activeContactAvatarOption' : ''} onClick={() => setContactForm({ ...contactForm, avatarChoice: 'initial' })}>
                  <span className="contactAvatar initialContactAvatar">{contactForm.name.trim().charAt(0).toUpperCase() || 'S'}</span>
                  First name
                </button>
              </div>
              <div className="contactVisibilityGrid">
                <label><input type="checkbox" checked={contactForm.showUsername} onChange={(event) => setContactForm({ ...contactForm, showUsername: event.target.checked })} /> Show username</label>
                <label><input type="checkbox" checked={contactForm.showNumber} onChange={(event) => setContactForm({ ...contactForm, showNumber: event.target.checked })} /> Show number</label>
              </div>
              <button type="submit">Add contact</button>
            </form>
          </section>
        </div>
      )}

      {groupModalOpen && (
        <div className="contactMiniOverlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setGroupModalOpen(false);
        }}>
          <section className="contactMiniModal groupCreateModal" role="dialog" aria-modal="true" aria-label="Create Signova group">
            <button type="button" className="contactMiniClose" onClick={() => setGroupModalOpen(false)} aria-label="Close group creation">×</button>
            <div className="modalBrandHeader">
              <Attach3DIcon type="contact" />
              <div>
                <span>{groupCreationContext === 'community' ? 'Create Community Group' : 'Create Chat Group'}</span>
                <strong>{groupCreationContext === 'community' ? 'Community learning space' : 'Private conversation group'}</strong>
                <small>{groupCreationContext === 'community' ? 'Discovery, learning, moderation, and members' : 'Private messaging preview for selected contacts'}</small>
              </div>
            </div>
            <form className="contactForm groupCreateForm" onSubmit={createSignovaGroup}>
              <input className="signSearch" value={groupForm.name} onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })} placeholder="Group name" />
              <div className="miniFormGrid">
                <label className="settingField">
                  <span>Purpose</span>
                  <select value={groupForm.purpose} onChange={(event) => setGroupForm({ ...groupForm, purpose: event.target.value })}>
                    <option>Sign language learning</option>
                    <option>Classroom</option>
                    <option>Family support</option>
                    <option>Interpreter team</option>
                    <option>Community discussion</option>
                    <option>Event planning</option>
                  </select>
                </label>
                <label className="settingField">
                  <span>Category</span>
                  <select value={groupForm.category} onChange={(event) => setGroupForm({ ...groupForm, category: event.target.value })}>
                    <option value="learning">Learning</option>
                    <option value="classroom">Classroom</option>
                    <option value="family">Family</option>
                    <option value="work">Work</option>
                    <option value="community">Community</option>
                    <option value="event">Event</option>
                  </select>
                </label>
              </div>
              <textarea className="signSearch" value={groupForm.description} onChange={(event) => setGroupForm({ ...groupForm, description: event.target.value })} placeholder="Short group description" />
              <input className="signSearch" value={groupForm.members} onChange={(event) => setGroupForm({ ...groupForm, members: event.target.value })} placeholder="@usernames or numbers, comma separated" />
              <label className="settingField">
                <span>Privacy</span>
                <select value={groupForm.privacy} onChange={(event) => setGroupForm({ ...groupForm, privacy: event.target.value })}>
                  <option value="private">Private invite-only</option>
                  <option value="approval">Join with admin approval</option>
                  <option value="public">Public community group</option>
                </select>
              </label>
              <div className="groupFeatureGrid">
                <label><input type="checkbox" checked={groupForm.allowMeetings} onChange={(event) => setGroupForm({ ...groupForm, allowMeetings: event.target.checked })} /> Meetings</label>
                <label><input type="checkbox" checked={groupForm.enableAudiencePolls} onChange={(event) => setGroupForm({ ...groupForm, enableAudiencePolls: event.target.checked })} /> Audience polls</label>
                <label><input type="checkbox" checked={groupForm.enableMediaDrive} onChange={(event) => setGroupForm({ ...groupForm, enableMediaDrive: event.target.checked })} /> Media drive</label>
                <label><input type="checkbox" checked={groupForm.adminApproval} onChange={(event) => setGroupForm({ ...groupForm, adminApproval: event.target.checked })} /> Admin approval</label>
                <label><input type="checkbox" checked={groupForm.autoCaptions} onChange={(event) => setGroupForm({ ...groupForm, autoCaptions: event.target.checked })} /> Meeting captions</label>
                <label title="Group E2EE is not implemented yet"><input type="checkbox" checked={false} disabled /> Group E2EE unavailable</label>
              </div>
              {groupCreationContext === 'community' && (
                <div className="miniFormGrid communityGroupAdvancedCreate">
                  <label className="settingField">
                    <span>Who can post</span>
                    <select value={groupForm.postingPermission} onChange={(event) => setGroupForm({ ...groupForm, postingPermission: event.target.value })}>
                      <option value="members">All members</option>
                      <option value="approved">Approved members</option>
                      <option value="admins">Admins only</option>
                    </select>
                  </label>
                  <label className="settingField">
                    <span>Member list</span>
                    <select value={groupForm.memberListVisibility} onChange={(event) => setGroupForm({ ...groupForm, memberListVisibility: event.target.value })}>
                      <option value="members">Members can view</option>
                      <option value="admins">Admins only</option>
                      <option value="public">Public</option>
                    </select>
                  </label>
                  <label className="settingField">
                    <span>Notifications</span>
                    <select value={groupForm.notifications} onChange={(event) => setGroupForm({ ...groupForm, notifications: event.target.value })}>
                      <option value="important">Important updates</option>
                      <option value="all">All activity</option>
                      <option value="mentions">Mentions only</option>
                    </select>
                  </label>
                </div>
              )}
              <div className="categoryComposerActions">
                <button type="button" onClick={() => setGroupModalOpen(false)}>Cancel</button>
                <button type="submit" className="primaryCategoryButton">Create group</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {contactInfoOpen && selectedChatContact && (
        <div className="contactMiniOverlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setContactInfoOpen(false);
        }}>
          <section className="contactInfoWindow" role="dialog" aria-modal="true" aria-label="Contact info">
            <button type="button" className="contactMiniClose" onClick={() => setContactInfoOpen(false)} aria-label="Close contact info">×</button>
            <header className="contactInfoHero">
              <ContactAvatar contact={selectedChatContact} className="avatar contactInfoAvatar" />
              <div>
                <span>Contact info</span>
                <strong>{selectedChatContact.name}</strong>
                <small>{selectedChatContact.username}</small>
              </div>
            </header>
            <div className="contactInfoGrid">
              <section>
                <span>Identity</span>
                <strong>{selectedChatContact.showUsername !== false ? selectedChatContact.username : 'Username hidden'}</strong>
                <small>{selectedChatContact.showNumber ? selectedChatContact.number : 'Phone number private'}</small>
              </section>
              <section>
                <span>Security</span>
                <strong>{encryptionStatus}</strong>
                <small>{selectedChatFlags.locked ? 'Locked chat' : 'Local chat preview ready'}</small>
              </section>
              <section>
                <span>Presence</span>
                <strong>{selectedChatPresence?.status || 'Offline'}</strong>
                <small>{selectedChatPresence?.detail || 'No activity yet'}</small>
              </section>
              <section>
                <span>Chat status</span>
                <strong>{selectedChatFlags.favourite ? 'Favourite' : selectedChatFlags.blocked ? 'Blocked' : 'Active'}</strong>
                <small>{selectedChatFlags.muted ? 'Notifications muted' : 'Notifications on'}</small>
              </section>
            </div>
            <div className="contactInfoActions">
              <button type="button" onClick={startVideoSignChat}><Attach3DIcon type="camera" /><span>Video</span></button>
              <button type="button" onClick={startVoiceSignChat}><Attach3DIcon type="audio" /><span>Voice</span></button>
              <button type="button" onClick={() => handleHeaderChatAction('favourite')}><Attach3DIcon type="sticker" /><span>{selectedChatFlags.favourite ? 'Unfavourite' : 'Favourite'}</span></button>
              <button type="button" onClick={() => handleHeaderChatAction('blocked')}><Attach3DIcon type="contact" /><span>{selectedChatFlags.blocked ? 'Unblock' : 'Block'}</span></button>
            </div>
          </section>
        </div>
      )}

      {attachMiniWindow && (
        <div className="contactMiniOverlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setAttachMiniWindow('');
        }}>
          <section className="contactMiniModal attachMiniModal" role="dialog" aria-modal="true" aria-label="Signova attachment window">
            <button type="button" className="contactMiniClose" onClick={() => setAttachMiniWindow('')} aria-label="Close attachment window">×</button>
            <div className="modalBrandHeader">
              <Attach3DIcon type={attachMiniWindow === 'event' ? 'event' : attachMiniWindow === 'poll' ? 'poll' : attachMiniWindow === 'contact' ? 'contact' : attachMiniWindow === 'imageMode' ? 'gallery' : attachMiniWindow === 'cameraClip' ? 'camera' : 'sticker'} />
              <div>
                <span>Signova Attach</span>
                <strong>{attachMiniWindow === 'contact' ? 'Share contact' : attachMiniWindow === 'poll' ? 'Audience poll' : attachMiniWindow === 'event' ? 'Meet Moment' : attachMiniWindow === 'imageMode' ? 'Image send mode' : attachMiniWindow === 'cameraClip' ? 'Live camera clip' : 'Gesture stickers'}</strong>
                <small>{attachMiniWindow === 'contact' ? 'Share name, username, and optional number' : attachMiniWindow === 'poll' ? 'Create an audience poll for chat' : attachMiniWindow === 'event' ? 'Save meet date with reminder' : attachMiniWindow === 'imageMode' ? 'Choose quality before sending image' : attachMiniWindow === 'cameraClip' ? 'Snap-style camera clip with front/back switch' : 'Sticker picker preview'}</small>
              </div>
            </div>

            {attachMiniWindow === 'imageMode' && (
              <div className="attachChoiceGrid">
                {['Simple image', 'HD image', 'Full HD image', 'Send as document'].map((mode) => (
                  <button type="button" className={imageSendMode === mode ? 'activeAttachChoice' : ''} key={mode} onClick={() => setImageSendMode(mode)}>
                    <Attach3DIcon type={mode.includes('document') ? 'document' : 'gallery'} />
                    <span>{mode}</span>
                  </button>
                ))}
                <button type="button" className="attachWideAction" onClick={() => openAttachmentPicker('image/*')}>
                  Choose image
                </button>
              </div>
            )}

            {attachMiniWindow === 'cameraClip' && (
              <div className="attachCameraClipPanel">
                <div className="cameraClipPreview">
                  <Attach3DIcon type="camera" />
                  <strong>{cameraClipFacing}</strong>
                  <small>Simple snap-style clip preview</small>
                </div>
                <div className="attachChoiceGrid twoChoiceGrid">
                  {['Front camera', 'Back camera'].map((camera) => (
                    <button type="button" className={cameraClipFacing === camera ? 'activeAttachChoice' : ''} key={camera} onClick={() => setCameraClipFacing(camera)}>
                      <Attach3DIcon type="camera" />
                      <span>{camera}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className="attachWideAction" onClick={sendCameraClip}>Send clip</button>
              </div>
            )}

            {attachMiniWindow === 'contact' && (
              <form className="contactForm attachMiniForm" onSubmit={shareSignovaContact}>
                <label className="settingField">
                  <span>Select Signova contact</span>
                  <select value={selectedShareContactId} onChange={(event) => setSelectedShareContactId(event.target.value)}>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.id}>{contact.name} · {contact.username}</option>
                    ))}
                  </select>
                </label>
                <div className="shareContactPreview">
                  <ContactAvatar contact={contacts.find((item) => item.id === selectedShareContactId) || contacts[0]} />
                  <span>
                    <strong>{contacts.find((item) => item.id === selectedShareContactId)?.name || 'Signova Contact'}</strong>
                    <small>{contacts.find((item) => item.id === selectedShareContactId)?.username || '@username'}</small>
                  </span>
                </div>
                <button type="submit">Share contact</button>
              </form>
            )}

            {attachMiniWindow === 'poll' && (
              <form className="contactForm attachMiniForm" onSubmit={createPulsePoll}>
                <input className="signSearch" value={pollForm.question} onChange={(event) => setPollForm({ ...pollForm, question: event.target.value })} placeholder="Poll question" />
                {pollForm.options.map((option, index) => (
                  <input
                    className="signSearch"
                    key={`poll-option-${index}`}
                    value={option}
                    onChange={(event) => setPollForm({ ...pollForm, options: pollForm.options.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)) })}
                    placeholder={`Option ${index + 1}`}
                  />
                ))}
                <div className="avatarActionRow">
                  <button type="button" onClick={() => setPollForm({ ...pollForm, options: [...pollForm.options, ''] })}>Add option</button>
                  <button type="submit">Create poll</button>
                </div>
              </form>
            )}

            {attachMiniWindow === 'event' && (
              <form className="contactForm attachMiniForm" onSubmit={createMeetMoment}>
                <input className="signSearch" value={meetForm.title} onChange={(event) => setMeetForm({ ...meetForm, title: event.target.value })} placeholder="Meet title" />
                <div className="miniFormGrid">
                  <input className="signSearch" type="date" value={meetForm.date} onChange={(event) => setMeetForm({ ...meetForm, date: event.target.value })} />
                  <input className="signSearch" type="time" value={meetForm.time} onChange={(event) => setMeetForm({ ...meetForm, time: event.target.value })} />
                </div>
                <label className="settingField">
                  <span>Reminder</span>
                  <select value={meetForm.reminder} onChange={(event) => setMeetForm({ ...meetForm, reminder: event.target.value })}>
                    <option>At time of event</option>
                    <option>5 min before</option>
                    <option>15 min before</option>
                    <option>1 hour before</option>
                    <option>1 day before</option>
                  </select>
                </label>
                <button type="submit">Save meet moment</button>
              </form>
            )}

            {attachMiniWindow === 'sticker' && (
              <div className="stickerPickerGrid">
                {GESTURE_STICKERS.map((sticker) => (
                  <button type="button" key={sticker.label} onClick={() => sendGestureSticker(sticker)}>
                    <b>{sticker.emoji}</b>
                    <span>{sticker.label}</span>
                    <small>{sticker.note}</small>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {passwordModal.open && (
        <div className="contactMiniOverlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPasswordModal({ open: false, contactId: null, mode: 'create', value: '', error: '', methods: { face: true, fingerprint: true, pin: true } });
        }}>
          <section className="contactMiniModal passwordMiniModal" role="dialog" aria-modal="true" aria-label={passwordModal.mode === 'unlock' ? 'Unlock chat' : 'Create chat password'}>
            <button type="button" className="contactMiniClose" onClick={() => setPasswordModal({ open: false, contactId: null, mode: 'create', value: '', error: '', methods: { face: true, fingerprint: true, pin: true } })} aria-label="Close password window">×</button>
            <div className="modalBrandHeader">
              <span className="modalLogo3d lockLogo3d"><img src="/app-logo.png" alt="" /></span>
              <div>
                <span>{passwordModal.mode === 'unlock' ? 'Unlock Chat' : 'Chat Lock'}</span>
                <strong>{contacts.find((contact) => contact.id === passwordModal.contactId)?.name || 'Private chat'}</strong>
                <small>{passwordModal.mode === 'unlock' ? 'Use PIN or supported biometric unlock.' : 'Protect this chat with Face, Fingerprint, and PIN.'}</small>
              </div>
            </div>
            <div className="chatLockMethods" aria-label="Chat lock methods">
              {[
                ['face', 'Face lock', 'Supported device face unlock'],
                ['fingerprint', 'Fingerprint', 'Supported biometric fingerprint'],
                ['pin', 'PIN', 'Fallback chat PIN'],
              ].map(([key, title, detail]) => (
                <label className="chatLockMethod" key={key}>
                  <input
                    type="checkbox"
                    checked={Boolean(passwordModal.methods?.[key])}
                    onChange={(event) => setPasswordModal((modal) => ({
                      ...modal,
                      methods: { ...(modal.methods || {}), [key]: event.target.checked },
                    }))}
                    disabled={passwordModal.mode === 'unlock'}
                  />
                  <span>
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </span>
                </label>
              ))}
            </div>
            <form className="contactForm" onSubmit={submitPasswordModal}>
              <input
                className="signSearch"
                type="password"
                value={passwordModal.value}
                onChange={(event) => setPasswordModal((modal) => ({ ...modal, value: event.target.value, error: '' }))}
                placeholder={passwordModal.mode === 'unlock' ? 'Enter PIN/password' : 'Create chat PIN/password'}
              />
              {passwordModal.error && <small className="passwordError">{passwordModal.error}</small>}
              <button type="submit">{passwordModal.mode === 'unlock' ? 'Unlock chat' : 'Enable chat lock'}</button>
            </form>
          </section>
        </div>
      )}

    </div>
  );
}

export default App;
