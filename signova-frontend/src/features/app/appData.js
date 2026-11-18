// Static product data and form defaults. Runtime services and mutable feature state
// stay in their owning modules; these exports must remain side-effect free.

export const SIGNOVA_AVATAR_ASSETS = [
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

export const DEFAULT_SIGNS = [
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

export const NAV_ITEMS = [
  { id: 'chats', icon: 'home', label: 'Home' },
  { id: 'translate', icon: 'voiceHistory', label: 'Sign voice history' },
  { id: 'library', icon: 'library', label: 'Library' },
  { id: 'learn', icon: 'learn', label: 'Learn' },
  { id: 'community', icon: 'community', label: 'Community' },
  { id: 'settings', icon: 'settings', label: 'Settings' },
];

export const INITIAL_CONTACTS = [
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

export const LEARN_MISSIONS = [
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

export const GESTURE_LOOP_STEPS = [
  ['Understand', 'Learn the meaning, situation, and expression before copying movement.'],
  ['Observe', 'Watch normal speed, slow motion, hand focus, and body posture.'],
  ['Shadow', 'Sign with the guide while Signova tracks rhythm and movement path.'],
  ['AI Coach', 'Receive focused feedback for handshape, orientation, location, and expression.'],
  ['Conversation', 'Use the sign naturally inside a short real-life interaction.'],
  ['Recall', 'Repeat later without the guide so the skill moves into memory.'],
];

export const PRACTICAL_LEARN_MODES = [
  ['shadow', 'practice', 'Watch & Shadow', 'Follow a guided sign without interruption.'],
  ['coach', 'voiceHistory', 'AI Coach', 'Get one useful correction after every attempt.'],
  ['conversation', 'conversations', 'Conversation Mission', 'Respond naturally instead of repeating a fixed answer.'],
  ['expression', 'community', 'Expression Lab', 'Train face, head movement, and body posture.'],
];

export const EMPTY_CONTACT_FORM = {
  name: '',
  countryCode: '+91',
  number: '',
  username: '',
  avatarChoice: 'signova',
  showUsername: true,
  showNumber: false,
};

export const EMPTY_GROUP_FORM = {
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
  // This is a capability state, not a user preference. Keep it false until the
  // audited MLS activation gates pass and the disabled UI is replaced.
  encryptedRequired: false,
};

export const COMMUNITY_CONTRIBUTORS = [];
export const COMMUNITY_SIGNS = [];
export const COMMUNITY_GROUPS = [];
export const PERFORMANCE_PROFILES = {
  lowLatency: { label: 'Low Latency', detection: 0.5, tracking: 0.5, frameModulo: 2 },
  balanced: { label: 'Balanced', detection: 0.58, tracking: 0.58, frameModulo: 1 },
  highAccuracy: { label: 'High Accuracy', detection: 0.68, tracking: 0.68, frameModulo: 1 },
};

export const MESSAGE_QUICK_REACTIONS = ['👍', '👏', '💙', '❤️', '😂'];
export const MESSAGE_EMOJI_REACTIONS = [
  '👍', '👏', '💙', '❤️', '😂', '😮', '🙏', '🔥', '✅', '✨',
  '😍', '🥰', '😊', '😎', '🤝', '👌', '💯', '🎉', '🌟', '🙌',
  '😢', '😄', '🤗', '😇', '💪', '🫶', '🤟', '👋', '🙃', '🥳',
];

export const GESTURE_STICKERS = [
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

export const COMPOSER_EMOJIS = ['😀', '😂', '😊', '😍', '🙏', '👍', '👏', '💙', '❤️', '🔥', '✨', '✅', '🎉', '🤝', '🤟', '👋', '💪', '🌟', '😮', '🥳'];
