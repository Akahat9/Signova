export const SIGNOVA_SETTINGS_STORAGE_KEY = 'signova-settings-v1';
export const SIGNOVA_SETTINGS_SCHEMA_VERSION = 2;
export const SIGNOVA_SETTINGS_WORKSPACE_ID = 'settings';

const WORKSPACE_PREFERENCE_GROUPS = Object.freeze([
  'camera', 'microphone', 'translation', 'lighting', 'filters', 'display',
  'security', 'notifications', 'ai', 'privacy', 'feedback', 'practice', 'device',
]);
const ACCOUNT_PREFERENCE_KEYS = Object.freeze([
  'phone', 'city', 'country', 'preferredLanguage', 'about', 'userType',
  'preferredSignLanguage', 'signSkillLevel', 'supportNotes', 'emergencyContact',
  'healthNotes', 'avatarInitials', 'avatarTone', 'avatarMode', 'avatarMood',
  'avatarAccessory',
]);

const SETTINGS_ENUMS = Object.freeze({
  'account.avatarMode': ['3d', 'flat'],
  'account.avatarMood': ['calm', 'smile'],
  'camera.facingMode': ['user', 'environment'],
  'camera.resolution': ['480p', '720p', '1080p', '1440p'],
  'translation.mode': ['word', 'sentence'],
  'translation.outputType': ['text', 'voice', 'textVoice'],
  'filters.preset': ['natural', 'clear', 'warm', 'cool'],
  'display.theme': ['dark', 'light', 'system'],
  'display.subtitleSize': ['small', 'medium', 'large'],
  'display.textSize': ['small', 'medium', 'large'],
  'ai.performanceMode': ['lowLatency', 'balanced', 'highAccuracy'],
  'ai.model': ['asl', 'isl', 'mixed', 'asl_top300', 'asl_top500', 'basic'],
  'practice.difficulty': ['beginner', 'intermediate', 'advanced'],
});

const SETTINGS_NUMBER_RANGES = Object.freeze({
  'account.proTrialMonths': [0, 24],
  'camera.fps': [1, 120],
  'translation.confidenceThreshold': [0, 1],
  'lighting.brightness': [0, 100],
  'filters.beautyLevel': [0, 100],
  'security.autoLockMinutes': [0, 1440],
  'ai.frameRate': [1, 120],
  'practice.dailyGoal': [1, 240],
});

const MAX_SETTING_STRING_LENGTH = 2000;
const SETTINGS_STRING_LIMITS = Object.freeze({ 'account.profilePhoto': 2 * 1024 * 1024 });

export function createDefaultSettings(confidenceThreshold = 0.55) {
  return {
    account: { name: 'Signova User', firstName: 'Signova', lastName: 'User', username: '@signova.user', email: '', phone: '', city: '', country: 'India', preferredLanguage: 'English', about: 'I am learning Indian Sign Language for daily communication.', subscription: 'Free learning plan', proStatus: 'trial', proPlan: 'Signova Pro Trial', proTrialMonths: 2, proStartedAt: '', proExpiresAt: '', studentVerified: false, studentIdFileName: '', studentInstitution: '', profilePhoto: '', profilePhotoPath: '', phoneVerified: true, emailVerified: true, twoFactor: false, connectedDevices: 'Web, Android ready', userType: 'Sign Language Learner', preferredSignLanguage: 'ISL', signSkillLevel: 'Beginner', supportNotes: '', emergencyContact: '', healthNotes: '', avatarInitials: 'SU', avatarTone: 'cyan', avatarMode: '3d', avatarMood: 'calm', avatarAccessory: 'none' },
    camera: { facingMode: 'user', resolution: '1080p', fps: 30 },
    microphone: { inputDevice: 'default', noiseSuppression: true },
    translation: { enabled: true, mode: 'sentence', language: 'English', outputType: 'textVoice', confidenceThreshold },
    lighting: { autoLowLight: true, ringLight: false, brightness: 62, aiEnhancement: true },
    filters: { enabled: true, backgroundBlur: false, contrastEnhancement: true, skinOptimization: true, beautyLevel: 28, preset: 'natural' },
    display: { theme: 'dark', highContrast: false, largeText: false, subtitleSize: 'medium', textSize: 'medium', visualFeedback: true, vibrationAlerts: false, signovaLock: false, signovaLockFace: false, signovaLockFingerprint: false, signovaLockPin: false },
    security: { twoFactorAuthorization: false, loginAlerts: false, trustedDevice: true, requirePasswordForSensitiveActions: false, autoLockMinutes: 15, hideSensitivePreviews: false, childSafetyMode: false, dpdpNoticeAccepted: false },
    notifications: { practiceReminders: true, learningAlerts: true, achievements: true },
    ai: { performanceMode: 'balanced', frameRate: 30, frameSkipping: true, model: 'mixed' },
    privacy: { saveVideoData: false, storeHistory: true, dataSharing: false, cameraProcessing: true, communityPublicProfile: true, showUsername: true, showNumber: true, showProfilePhoto: true, showDeafStatus: false, showLearningProgress: true, qrSharing: true, showOnlineStatus: true, showLastSeen: true, readReceipts: true, saveChatHistory: true },
    feedback: { realTimeCorrection: true, errorHighlighting: true, learningSuggestions: true },
    practice: { difficulty: 'beginner', reminders: true, dailyGoal: 15 },
    device: { dataSaver: false, reduceMotion: false, compactMode: false, autoMediaQuality: true, offlineCache: true },
  };
}

export function mergeSignovaSettings(defaults, saved) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return defaults;
  return Object.fromEntries(Object.entries(defaults).map(([group, defaultGroup]) => {
    const savedGroup = saved[group];
    if (!defaultGroup || typeof defaultGroup !== 'object' || Array.isArray(defaultGroup)) return [group, defaultGroup];
    if (!savedGroup || typeof savedGroup !== 'object' || Array.isArray(savedGroup)) return [group, { ...defaultGroup }];
    return [group, Object.fromEntries(Object.entries(defaultGroup).map(([key, fallback]) => {
      const candidate = savedGroup[key];
      const path = `${group}.${key}`;
      if (candidate === undefined || candidate === null || typeof candidate !== typeof fallback) return [key, fallback];
      if (typeof fallback === 'boolean') return [key, candidate];
      if (typeof fallback === 'string') {
        if (candidate.length > (SETTINGS_STRING_LIMITS[path] || MAX_SETTING_STRING_LENGTH)) return [key, fallback];
        const allowed = SETTINGS_ENUMS[path];
        return [key, allowed && !allowed.includes(candidate) ? fallback : candidate];
      }
      if (typeof fallback === 'number') {
        if (!Number.isFinite(candidate)) return [key, fallback];
        const [minimum, maximum] = SETTINGS_NUMBER_RANGES[path] || [-Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER];
        return [key, Math.min(maximum, Math.max(minimum, candidate))];
      }
      return [key, fallback];
    }))];
  }));
}

export function parsePersistedSettings(serialized) {
  if (!serialized) return null;
  const parsed = JSON.parse(serialized);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  // Versions before 2 stored the settings object directly. Keep that migration
  // path so existing users do not lose preferences during the schema upgrade.
  if (!Object.prototype.hasOwnProperty.call(parsed, 'version')) return parsed;
  if (parsed.version !== SIGNOVA_SETTINGS_SCHEMA_VERSION || !parsed.settings) return null;
  return parsed.settings;
}

export function serializePersistedSettings(settings, confidenceThreshold = 0.55) {
  return JSON.stringify({
    version: SIGNOVA_SETTINGS_SCHEMA_VERSION,
    settings: mergeSignovaSettings(createDefaultSettings(confidenceThreshold), settings),
  });
}

export function loadPersistedSettings(storage, confidenceThreshold = 0.55) {
  const defaults = createDefaultSettings(confidenceThreshold);
  if (!storage) return defaults;
  try { return mergeSignovaSettings(defaults, parsePersistedSettings(storage.getItem(SIGNOVA_SETTINGS_STORAGE_KEY))); }
  catch { return defaults; }
}

export function savePersistedSettings(storage, settings, confidenceThreshold = 0.55) {
  if (!storage) return false;
  try {
    storage.setItem(SIGNOVA_SETTINGS_STORAGE_KEY, serializePersistedSettings(settings, confidenceThreshold));
    return true;
  } catch {
    return false;
  }
}

export function buildSettingsWorkspaceRecord(settings, confidenceThreshold = 0.55) {
  const sanitized = mergeSignovaSettings(createDefaultSettings(confidenceThreshold), settings);
  return {
    id: SIGNOVA_SETTINGS_WORKSPACE_ID,
    schemaVersion: SIGNOVA_SETTINGS_SCHEMA_VERSION,
    settings: {
      ...Object.fromEntries(WORKSPACE_PREFERENCE_GROUPS.map((group) => [group, sanitized[group]])),
      account: Object.fromEntries(ACCOUNT_PREFERENCE_KEYS.map((key) => [key, sanitized.account[key]])),
    },
    savedAt: Date.now(),
  };
}

export function resolveWorkspaceSettings(currentSettings, workspaceRecord, confidenceThreshold = 0.55) {
  const defaults = createDefaultSettings(confidenceThreshold);
  const current = mergeSignovaSettings(defaults, currentSettings);
  if (!workspaceRecord
    || workspaceRecord.id !== SIGNOVA_SETTINGS_WORKSPACE_ID
    || workspaceRecord.schemaVersion !== SIGNOVA_SETTINGS_SCHEMA_VERSION
    || !workspaceRecord.settings
    || typeof workspaceRecord.settings !== 'object'
    || Array.isArray(workspaceRecord.settings)) return current;
  const saved = mergeSignovaSettings(defaults, workspaceRecord.settings);
  return {
    ...current,
    ...Object.fromEntries(WORKSPACE_PREFERENCE_GROUPS.map((group) => [group, saved[group]])),
    account: {
      ...current.account,
      ...Object.fromEntries(ACCOUNT_PREFERENCE_KEYS.map((key) => [key, saved.account[key]])),
    },
  };
}

export function buildSettingsSections(settings, { cameraEnabled = false, deviceProfile = {} } = {}) {
  return [
    { id: 'general', group: 'Account', icon: '▦', title: 'General', detail: 'Basic app preferences' },
    { id: 'account', group: 'Account', icon: '○', title: 'Account', detail: 'Profile and account identity' },
    { id: 'security', group: 'Account', icon: '⌾', title: 'Privacy & Security', detail: settings.security?.twoFactorAuthorization || settings.account.twoFactor ? 'Protection and privacy controls' : 'Login, privacy, and app lock' },
    { id: 'notifications', group: 'Preferences', icon: '⌁', title: 'Notifications', detail: settings.notifications.practiceReminders ? 'Practice reminders on' : 'Reminders off' },
    { id: 'display', group: 'Preferences', icon: '◐', title: 'Appearance', detail: settings.display.theme === 'dark' ? 'Dark mode' : settings.display.theme === 'light' ? 'Light mode' : 'System theme' },
    { id: 'translation', group: 'Preferences', icon: '◎', title: 'Language & Translation', detail: `${settings.translation.language} · ${settings.translation.mode} mode` },
    { id: 'accessibility', group: 'Preferences', icon: '✣', title: 'Accessibility', detail: 'Text, contrast, motion, captions' },
    { id: 'camera', group: 'Call & Chat', icon: '▣', title: 'Audio & Video', detail: cameraEnabled ? `${settings.camera.resolution} · Camera on` : 'Camera, microphone, quality' },
    { id: 'chat', group: 'Call & Chat', icon: '▢', title: 'Chat', detail: 'Messaging and history preferences' },
    { id: 'calls', group: 'Call & Chat', icon: '◍', title: 'Calls', detail: 'Call quality and device readiness' },
    { id: 'ai', group: 'Call & Chat', icon: '✦', title: 'AI Settings', detail: `${settings.ai.model} · ${settings.ai.performanceMode}` },
    { id: 'practice', group: 'Call & Chat', icon: '✓', title: 'Learning & Practice', detail: `${settings.practice.dailyGoal} min daily goal` },
    { id: 'communitySettings', group: 'Workspace', icon: '◇', title: 'Community', detail: 'Posts, profile, moderation controls' },
    { id: 'librarySettings', group: 'Workspace', icon: '▥', title: 'Library', detail: 'Saved signs and learning media' },
    { id: 'device', group: 'Data & Storage', icon: '▤', title: 'Data & Storage', detail: `${deviceProfile.deviceType || 'Unknown device'} · ${deviceProfile.performance || 'Unknown performance'}` },
    { id: 'backup', group: 'Data & Storage', icon: '↻', title: 'Backup & Sync', detail: 'Export and workspace sync status' },
    { id: 'support', group: 'Support', icon: '?', title: 'Help & Support', detail: 'Help center and feedback' },
    { id: 'about', group: 'Support', icon: 'i', title: 'About Signova', detail: 'Version, ownership, system health' },
    { id: 'developer', group: 'Support', icon: '</>', title: 'Developer Options', detail: 'Diagnostics and environment status' },
  ];
}

export function filterSettingsSections(sections, search) {
  const query = String(search || '').trim().toLowerCase();
  if (!query) return sections;
  return sections.filter((section) => [section.title, section.detail, section.id].some((value) => value.toLowerCase().includes(query)));
}
