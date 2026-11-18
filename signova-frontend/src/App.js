import './App.css';
import './mobileDesktop.css';
import './desktopPageFixes.css';
import './uiPerformanceFixes.css';
import './appShellAuthority.css';
import './premiumDarkSystem.css';
import './signovaDesignSystem.css';
import './mobileAdaptive.css';
import './scrollbarAuthority.css';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes, uploadBytesResumable } from 'firebase/storage';
import { firebaseAuth, firebaseStorage, firestoreDb, isFirebaseReady } from './firebase';
import { deleteUserDoc, flushUserWorkspaceOutbox, loadUserCollection, resetDatabaseSession, saveUserDoc, startDatabaseSession } from './signovaDb';
import AppNavigationRail from './components/AppNavigationRail';
import ProgressScrollRail from './components/ProgressScrollRail';
import { Attach3DIcon, RailIcon } from './components/SignovaIcons';
import {
  AppStartupSkeleton,
  DelayedStartupSkeleton,
  ContactAvatar,
  getCallHistoryPresentation,
  SignovaOpeningAnimation,
} from './components/AppPresentation';
import SettingsView from './components/settings/SettingsView';
import MobileNotSupportedView from './components/MobileNotSupportedView';
import useMobileDeviceBlock from './hooks/useMobileDeviceBlock';
import './mobileNotSupported.css';
import useAppViewport from './hooks/useAppViewport';
import useCallsManager from './hooks/useCallsManager';
import useChatManager from './hooks/useChatManager';
import { conversationE2EE } from './securityCapabilities';
import CommunityView from './components/CommunityView';
import ChatView from './components/ChatView';
import LibraryView from './components/LibraryView';
import ConversationHistorySidebar from './components/ConversationHistorySidebar';
import ConversationInfoView from './components/ConversationInfoView';
import TranslateToolsPanel from './components/TranslateToolsPanel';
import ProfileView from './components/ProfileView';
import ContactsView from './components/ContactsView';
import CommunityCreateSignView from './components/CommunityCreateSignView';
import ProgressDashboardView from './components/ProgressDashboardView';
import CommunityGroupsView from './components/CommunityGroupsView';
import AddContactModal from './components/modals/AddContactModal';
import { requestJson } from './services/apiClient';
import { speakAccessibleText as speak } from './services/speechService';
import { validateCommunityMediaFile } from './features/community/mediaValidation';
import { createVideoPosterBlob } from './features/community/videoPoster';
import { cleanupCommunityMedia, uploadCommunityMedia } from './features/community/durableMediaService';
import { normalizeUsername } from './features/auth/identityValidation';
import { extractLookupPhoneKeys, normalizeContactPhone as normalizePhoneNumber, normalizeContactRecord, validateContactUsername as validateUsername } from './features/contacts/contactModel';
import { buildSignPurpose, buildSignUsage, getSignBookType, inferSignLanguage, normalizeSignText } from './features/learning/signPresentation';
import { formatPracticeTime, radarPolygonPoints, toPointArray } from './features/progress/progressPresentation';
import { buildSettingsSections, buildSettingsWorkspaceRecord, createDefaultSettings, filterSettingsSections, loadPersistedSettings, resolveWorkspaceSettings, SIGNOVA_SETTINGS_STORAGE_KEY, SIGNOVA_SETTINGS_WORKSPACE_ID } from './features/settings/settingsModel';
import { buildHistoryDeletionTargets, mayPersistChatHistory, mayProcessCamera, mayShareProfile, } from './features/settings/privacyPolicy';
import { buildChatAttachmentMessage, buildDirectChatAttachmentDescriptor, validateChatAttachmentFile } from './features/chat/attachmentModel';
import { createAttachmentObjectUrlRegistry, sanitizeAttachmentMessagesForPersistence } from './features/chat/attachmentUrlLifecycle';
import { uploadDirectChatAttachment } from './features/chat/directAttachmentUpload';
import { createLocalSessionProtectionKey, protectLocalSessionText, revealLocalSessionText } from './features/chat/localSessionProtection';
import { migrateLegacyChatLockFlags } from './features/chat/localChatLock';
import { mergeRealtimeConversationMessages, messagesForContact, normalizeConversationMessages } from './features/chat/conversationMessageModel';
import { enqueueDirectMessage, flushDirectMessageOutbox, queuedDirectMessagesForContact } from './features/chat/directMessageOutbox';
import { presenceLabel, subscribeUserPresence, writeUserPresence } from './features/chat/presenceService';
import {
  acknowledgeDirectMessageReceipt,
  applyDirectMessageReceipts,
  ensureDirectChat,
  markDirectMessageEdited,
  markDirectMessageUnsent,
  sendDirectTextMessage,
  sendDirectAttachmentMessage,
  setDirectMessageReaction,
  subscribeDirectChatMessages,
  subscribeDirectChatReceipts,
  subscribeDirectChatReactions,
} from './features/chat/firestoreChatService';
import {
  getFriendlyFirebaseAuthError,
  normalizeAuthPhone,
  normalizeAuthUsername,
  splitAuthName,
  validateAuthEmail,
  validateAuthForm,
  validateAuthName,
  validateAuthPhone,
  validateAuthUsername,
} from './features/auth/authValidation';
import { AUTH_RECOVERY_METHODS, AUTH_SECURITY_CAPABILITIES } from './features/auth/authCapabilities';
import { deleteCurrentAccountWithPassword } from './features/auth/accountDeletionClient';
import {
  buildCommunityPostPayload,
  normalizeCommunityPostFromFirestore,
  PUBLIC_COMMUNITY_POSTS_COLLECTION,
} from './features/community/communityPostModel';
import {
  acquireCameraStream,
  attachMicrophoneTrack,
  cameraErrorMessage,
  configureVideoTrack,
  stopMediaStream,
} from './features/camera/cameraMediaService';
import { loadMediaPipeScripts, MEDIAPIPE_HANDS_BASE_URL } from './features/camera/mediaPipeLoader';
import { extract165DVector } from './features/camera/holisticFeatureExtractor';
import { createCameraFrameLoop } from './features/camera/cameraFrameLoop';
import { uploadDurableProfilePhoto } from './features/profile/profilePhotoService';
import {
  COMMUNITY_CONTRIBUTORS,
  COMMUNITY_GROUPS,
  COMMUNITY_SIGNS,
  COMPOSER_EMOJIS,
  DEFAULT_SIGNS,
  EMPTY_CONTACT_FORM,
  EMPTY_GROUP_FORM,
  GESTURE_LOOP_STEPS,
  GESTURE_STICKERS,
  INITIAL_CONTACTS,
  LEARN_MISSIONS,
  MESSAGE_EMOJI_REACTIONS,
  MESSAGE_QUICK_REACTIONS,
  NAV_ITEMS,
  PERFORMANCE_PROFILES,
  PRACTICAL_LEARN_MODES,
  SIGNOVA_AVATAR_ASSETS,
} from './features/app/appData';

const Signova3DAvatar = lazy(() => import('./Signova3DAvatar'));
const LearnStudio = lazy(() => import('./LearnStudio'));

const LOCAL_API_URL = 'http://127.0.0.1:5000';
const CONFIGURED_API_URL = String(process.env.REACT_APP_SIGNOVA_API_URL || '').trim().replace(/\/+$/, '');
const IS_LOCAL_APP_RUNTIME = typeof window === 'undefined'
  || window.location.protocol === 'file:'
  || ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_URL = IS_LOCAL_APP_RUNTIME
  ? (process.env.REACT_APP_LOCAL_API_URL || LOCAL_API_URL)
  : (CONFIGURED_API_URL || LOCAL_API_URL);
const SIGNOVA_UI_TEST_ROUTE = typeof window !== 'undefined'
  ? new URLSearchParams(window.location.search).get('uiTest')
  : '';
const SIGNOVA_UI_TEST_ENABLED = process.env.REACT_APP_SIGNOVA_UI_TEST_MODE === 'true'
  && IS_LOCAL_APP_RUNTIME;
const SIGNOVA_UI_TEST_MODE = SIGNOVA_UI_TEST_ENABLED && SIGNOVA_UI_TEST_ROUTE === 'app';
const SIGNOVA_AUTH_TEST_MODE = SIGNOVA_UI_TEST_ENABLED && SIGNOVA_UI_TEST_ROUTE === 'auth';
const SIGNOVA_AUTH_FLOW_TEST_MODE = SIGNOVA_AUTH_TEST_MODE
  && typeof window !== 'undefined'
  && new URLSearchParams(window.location.search).get('authFlow') === 'real';
const SIGNOVA_MEDIA_TEST_MODE = SIGNOVA_UI_TEST_ENABLED && SIGNOVA_UI_TEST_ROUTE === 'media';
const SIGNOVA_CALL_TEST_MODE = SIGNOVA_UI_TEST_ENABLED && SIGNOVA_UI_TEST_ROUTE === 'call';
const SIGNOVA_CALL_TEST_ROLE = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('callRole') : '';
const SIGNOVA_CALL_TEST_CONTACT = SIGNOVA_CALL_TEST_ROLE === 'b'
  ? { id: 'call-peer-a', name: 'Call Peer A', username: '@call.peer.a', firebaseUid: 'call-peer-a-e2e', status: 'online', showUsername: true }
  : { id: 'call-peer-b', name: 'Call Peer B', username: '@call.peer.b', firebaseUid: 'call-peer-b-e2e', status: 'online', showUsername: true };
const DEFAULT_SESSION_CONTACTS = SIGNOVA_CALL_TEST_MODE ? [SIGNOVA_CALL_TEST_CONTACT] : INITIAL_CONTACTS;
const CHAT_SIDEBAR_MIN_WIDTH = 260;
const CHAT_SIDEBAR_MAX_WIDTH = 480;
const CHAT_SIDEBAR_DEFAULT_WIDTH = 320;

function getDesktopCallWindowMode() {
  if (typeof window === 'undefined') return '';
  const mode = new URLSearchParams(window.location.search).get('signovaCall');
  return mode === 'voice' ? 'voice' : mode === 'video' ? 'video' : '';
}

function clampChatSidebarWidth(value) {
  return Math.min(CHAT_SIDEBAR_MAX_WIDTH, Math.max(CHAT_SIDEBAR_MIN_WIDTH, value));
}


// MediaPipe can sample at display speed, but remote inference must remain bounded.
// This cadence stays below the authenticated API's per-user budget.
const PREDICTION_INTERVAL_MS = 750;
const ACCEPT_COOLDOWN_MS = 280;
const MIN_ACCEPT_CONFIDENCE = 0.55;
const MIN_SIGN_STABLE_FRAMES = 3;
const MIN_CONFIDENCE_MARGIN = 0.12;
const PREDICTION_REQUEST_TIMEOUT_MS = 45_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 20_000;
const COLD_START_REQUEST_TIMEOUT_MS = 65_000;
// The app shell can render from its local workspace cache.  Do not make a
// successful sign-in wait indefinitely for an optional profile read.
const AUTH_PROFILE_READ_TIMEOUT_MS = 900;
const DISPLAY_THEME_STORAGE_KEY = 'signova-display-theme-v1';
const TEMPORAL_BUFFER_SIZE = 8;
const ENGINE_NAME = 'Signova AI Synapse Engine';

function resolveStartupValue(promise, fallback, timeoutMs = AUTH_PROFILE_READ_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(fallback), timeoutMs);
    Promise.resolve(promise).then(finish, () => finish(fallback));
  });
}

function hasCachedFirebaseAuth() {
  if (typeof window === 'undefined') return false;
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith('firebase:authUser:')) {
        const raw = window.localStorage.getItem(key);
        if (raw && raw !== 'null' && raw !== '{}') {
          return true;
        }
      }
    }
  } catch {
    return false;
  }
  return false;
}

function getInitialDarkMode() {
  if (typeof window === 'undefined') return false;
  try {
    const saved = window.localStorage.getItem(DISPLAY_THEME_STORAGE_KEY);
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    let settingsTheme = null;
    try {
      const raw = JSON.parse(window.localStorage.getItem('signova-settings-v1') || 'null');
      const settings = raw ? (raw.settings || raw) : null;
      settingsTheme = settings?.display?.theme;
    } catch {}
    if (settingsTheme === 'dark') return true;
    if (settingsTheme === 'light') return false;
    if (settingsTheme === 'system') {
      return Boolean(window.matchMedia?.('(prefers-color-scheme: dark)')?.matches);
    }
    return false;
  } catch {
    return false;
  }
}

function createSettingsWithSavedDisplayTheme(confidenceThreshold) {
  const defaults = createDefaultSettings(confidenceThreshold);
  if (typeof window === 'undefined') return defaults;
  try {
    const theme = window.localStorage.getItem(DISPLAY_THEME_STORAGE_KEY);
    if (['light', 'dark', 'system'].includes(theme)) {
      return { ...defaults, display: { ...defaults.display, theme } };
    }
    const raw = JSON.parse(window.localStorage.getItem('signova-settings-v1') || 'null');
    const settings = raw ? (raw.settings || raw) : null;
    if (['light', 'dark', 'system'].includes(settings?.display?.theme)) {
      return { ...defaults, display: { ...defaults.display, theme: settings.display.theme } };
    }
    return defaults;
  } catch {
    return defaults;
  }
}

async function fetchJson(path, options = {}) {
  const predictPath = path.includes('/predict');
  const coldStartPath = path === '/api/health' || path === '/api/platform/health';
  const timeoutMs = coldStartPath
    ? COLD_START_REQUEST_TIMEOUT_MS
    : predictPath
      ? PREDICTION_REQUEST_TIMEOUT_MS
      : DEFAULT_REQUEST_TIMEOUT_MS;
  return requestJson({
    baseUrl: API_URL,
    path,
    options,
    timeoutMs,
    getToken: async () => firebaseAuth?.currentUser?.getIdToken?.() || '',
  });
}

function formatConfidence(value) {
  if (!Number.isFinite(value)) return '0%';
  return `${Math.round(value * 100)}%`;
}


function App() {
  useAppViewport();
  const { isMobileBlocked, proceedAnyway } = useMobileDeviceBlock();
  const videoRef = useRef(null);
  const offscreenVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const streamRef = useRef(null);
  const startVideoSignChatRef = useRef(null);
  const startVoiceSignChatRef = useRef(null);
  const openPanelRef = useRef(null);
  const addEncryptedMessageRef = useRef(null);
  const communityCaptureVideoRef = useRef(null);
  const communityComposerFileInputRef = useRef(null);
  const communityCaptureStreamRef = useRef(null);
  const communityCaptureRecorderRef = useRef(null);
  const communityCaptureChunksRef = useRef([]);
  const communityUploadTaskRef = useRef(null);
  const communityCaptureTimerRef = useRef(null);
  const handsRef = useRef(null);
  const animationFrameRef = useRef(null);
  const cameraFrameLoopRef = useRef(null);
  const lastSentAt = useRef(0);
  const lastSpoken = useRef('');
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
  const cameraControlClickTimerRef = useRef(null);
  const startCameraRef = useRef(null);
  const railLogoClickTimerRef = useRef(null);
  const railTributeTimerRef = useRef(null);
  const communityRailTapTimerRef = useRef(null);
  const communityFeedTabsRef = useRef(null);
  const signToolsPaneRef = useRef(null);
  const fullIntroTimerRef = useRef(null);
  const attachmentInputRef = useRef(null);
  const attachmentUrlRegistryRef = useRef(null);
  if (!attachmentUrlRegistryRef.current) attachmentUrlRegistryRef.current = createAttachmentObjectUrlRegistry();
  const directAttachmentUrlRequestsRef = useRef(new Set());
  const directAttachmentRetryFilesRef = useRef(new Map());
  const sendLongPressRef = useRef(null);
  const sendLongPressTriggeredRef = useRef(false);
  const voiceRecorderRef = useRef(null);
  const voiceRecorderChunksRef = useRef([]);
  const voiceRecorderStreamRef = useRef(null);
  const pageFlipAudioContextRef = useRef(null);
  const profileQrScanInputRef = useRef(null);
  const desktopCallWindowStartedRef = useRef(false);
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
    if (SIGNOVA_AUTH_TEST_MODE) return 'auth';
    if (process.env.NODE_ENV === 'test' || SIGNOVA_UI_TEST_MODE || SIGNOVA_MEDIA_TEST_MODE || SIGNOVA_CALL_TEST_MODE) return 'app';
    if (hasCachedFirebaseAuth()) return 'app';
    return 'checking';
  });
  const [networkOnline, setNetworkOnline] = useState(() => (
    typeof navigator === 'undefined' || navigator.onLine !== false
  ));
  const [authForm, setAuthForm] = useState({ name: '', username: '', phone: '', email: '', pin: '', confirmPin: '', phoneOtp: '', hidePhone: true });
  const [authMode, setAuthMode] = useState('signup');
  const [authRecoveryOpen, setAuthRecoveryOpen] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState({ type: '', text: '' });
  const [accountSettingsMessage, setAccountSettingsMessage] = useState({ type: '', text: '' });
  const [accountDeletionForm, setAccountDeletionForm] = useState({ password: '', busy: false });
  const [authenticatedFirebaseUser, setAuthenticatedFirebaseUser] = useState(null);
  const [authVerificationCooldownUntil, setAuthVerificationCooldownUntil] = useState(0);
  const [authCooldownNow, setAuthCooldownNow] = useState(() => Date.now());
  const [, setAuthPhoneChallenge] = useState(null);
  const desktopCallWindowMode = getDesktopCallWindowMode();
  const [caption, setCaption] = useState('Waiting for signs');
  const [status, setStatus] = useState('Starting camera');
  const [cameraQuality, setCameraQuality] = useState({ label: 'Camera standby', width: 0, height: 0, fps: 0 });
  const [apiRecovery, setApiRecovery] = useState({ active: false, message: '' });
  const [history, setHistory] = useState([]);
  const [sentence, setSentence] = useState('Waiting for signs');
  const [signLibrary, setSignLibrary] = useState(DEFAULT_SIGNS);
  const [signApiStatus, setSignApiStatus] = useState('Loading signs');
  const [recognitionCapability, setRecognitionCapability] = useState('detecting');
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
  const [apiConnectionRetryKey, setApiConnectionRetryKey] = useState(0);
  const [serviceBannerDismissed, setServiceBannerDismissed] = useState(false);
  const [synapseEnabled, setSynapseEnabled] = useState(true);
  const [liveSign, setLiveSign] = useState(null);
  const [learningFeedback, setLearningFeedback] = useState('Keep your hand inside the frame.');
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [activePanel, setActivePanel] = useState(() => SIGNOVA_CALL_TEST_MODE ? 'chats' : 'community');
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
  const [premiumDarkMode, setPremiumDarkMode] = useState(getInitialDarkMode);
  const [activeSettingsSection, setActiveSettingsSection] = useState('');
  const [settingsSearch, setSettingsSearch] = useState('');
  const [settings, setSettings] = useState(() => createSettingsWithSavedDisplayTheme(MIN_ACCEPT_CONFIDENCE));
  const settingsSnapshotRef = useRef(settings);
  settingsSnapshotRef.current = settings;
  const chatHistoryPersistenceEnabled = mayPersistChatHistory(settings.privacy);
  const profileSharingEnabled = mayShareProfile(settings.privacy);
  const [composerSending, setComposerSending] = useState(false);
  const [typingContactId, setTypingContactId] = useState('');
  const [composerPickerOpen, setComposerPickerOpen] = useState(false);
  const [composerPickerTab, setComposerPickerTab] = useState('emoji');
  const [scheduleComposerOpen, setScheduleComposerOpen] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({ date: '', time: '', note: '' });
  const [voiceNote, setVoiceNote] = useState({ active: false, paused: false, seconds: 0 });
  const [driveItems, setDriveItems] = useState([]);
  const [contacts, setContacts] = useState(DEFAULT_SESSION_CONTACTS);
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
  const [attachmentAccept, setAttachmentAccept] = useState('');
  const [imageSendMode, setImageSendMode] = useState('Simple image');
  const [cameraClipFacing, setCameraClipFacing] = useState('Front camera');
  const [audioPlaybackRates, setAudioPlaybackRates] = useState({});
  const [pollForm, setPollForm] = useState({ question: '', options: ['Yes', 'No'] });
  const [meetForm, setMeetForm] = useState({ title: '', date: '', time: '', reminder: '15 min before' });
  const [selectedShareContactId, setSelectedShareContactId] = useState(INITIAL_CONTACTS[0]?.id || '');
  const [chatSearch, setChatSearch] = useState('');
  const [callHistorySearch, setCallHistorySearch] = useState('');
  const [callHistoryFilter, setCallHistoryFilter] = useState('all');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [callHistory, setCallHistory] = useState([]);
  const [conversationInfoMenuOpen, setConversationInfoMenuOpen] = useState(false);
  const [conversationCategoryOpen, setConversationCategoryOpen] = useState(false);
  const [conversationCategory, setConversationCategory] = useState('all');
  const [contactInfoOpen, setContactInfoOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [groupForm, setGroupForm] = useState(EMPTY_GROUP_FORM);
  const [groupCreationContext, setGroupCreationContext] = useState('chat');
  const [communityGroupRecords, setCommunityGroupRecords] = useState([]);
  const [communityGroupProfileOpen, setCommunityGroupProfileOpen] = useState(false);
  const [communityDraft, setCommunityDraft] = useState('');
  const [communityComposerMedia, setCommunityComposerMedia] = useState(null);
  const [communityComposerKind, setCommunityComposerKind] = useState('post');
  const [communityPublicProfileTab, setCommunityPublicProfileTab] = useState('Posts');
  const [communityComposerReview, setCommunityComposerReview] = useState({
    stage: 'idle',
    checks: [],
    suggestions: [],
    confirmed: false,
  });
  const [communityUpload, setCommunityUpload] = useState({ stage: 'idle', progress: 0, error: '' });
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
  const [communityPosts, setCommunityPosts] = useState([]);
  const [communityHiddenPostIds, setCommunityHiddenPostIds] = useState([]);
  const [communityLikedPostIds, setCommunityLikedPostIds] = useState([]);
  const [communityLikeDetails, setCommunityLikeDetails] = useState({ postId: '', loading: false, likes: [] });
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
      contactId: 'signova-ai',
      direction: 'incoming',
      text: 'Hi, I am ready for Signova live translation.',
      time: 'Now',
      sentAt: 'Now',
      deliveredAt: 'Now',
      readAt: 'Now',
      status: 'read',
      encrypted: false,
      reactions: [],
      createdAt: Date.now(),
      liveActivity: 'Local preview message',
      seenGlow: true,
    },
  ]);
  const [activeRealtimeChat, setActiveRealtimeChat] = useState({ contactId: '', chatId: '', status: 'local', error: '' });
  const [chatPresenceByUid, setChatPresenceByUid] = useState({});
  const [persistenceReady, setPersistenceReady] = useState(false);
  const [encryptionStatus, setEncryptionStatus] = useState('Creating local session key');
  const [, setSecureCallStatus] = useState('WebRTC DTLS-SRTP transport ready');
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
    const availablePosts = communityPosts.filter((post) => !communityHiddenPostIds.includes(post.id));
    return communityFeedFilter === 'For You'
      ? availablePosts
      : communityFeedFilter === 'Following'
        ? availablePosts.filter((post) => post.following)
        : communityFeedFilter === 'Reels'
          ? availablePosts.filter((post) => post.contentKind === 'reel')
        : availablePosts.filter((post) => post.tags.some((tag) => tag.toLowerCase() === communityFeedFilter.toLowerCase()));
  }, [communityFeedFilter, communityHiddenPostIds, communityPosts]);
  const ownCommunityPosts = useMemo(() => communityPosts.filter((post) => (
    post.authorUid === authenticatedFirebaseUser?.uid || post.username === communityProfile.username
  )), [authenticatedFirebaseUser?.uid, communityPosts, communityProfile.username]);
  const publicProfilePosts = useMemo(() => ownCommunityPosts.filter((post) => (
    communityPublicProfileTab === 'Posts'
      || (communityPublicProfileTab === 'Reels' && post.contentKind === 'reel')
      || (communityPublicProfileTab === 'Images' && post.mediaType === 'image')
      || (communityPublicProfileTab === 'Videos' && post.mediaType === 'video' && post.contentKind !== 'reel')
  )), [communityPublicProfileTab, ownCommunityPosts]);
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
  const {
    selectedChatId,
    setSelectedChatId,
    chatFilter,
    setChatFilter,
    chatDraft,
    setChatDraft,
    messageSearch,
    setMessageSearch,
    messageSearchOpen,
    setMessageSearchOpen,
    selectedMessageIds,
    setSelectedMessageIds,
    chatMenu,
    setChatMenu,
    chatHeaderMenuOpen,
    setChatHeaderMenuOpen,
    chatSidebarMenu,
    setChatSidebarMenu,
    categoryComposerOpen,
    setCategoryComposerOpen,
    categoryDraft,
    setCategoryDraft,
    customChatCategories,
    chatFlags,
    setChatFlags,
    passwordModal,
    setPasswordModal,
    reactionMessageId,
    toolMessageId,
    setToolMessageId,
    emojiPickerMessageId,
    setEmojiPickerMessageId,
    messageInfoId,
    setMessageInfoId,
    messageTranslateMenu,
    setMessageTranslateMenu,
    attachMenuOpen,
    setAttachMenuOpen,
    attachMiniWindow,
    setAttachMiniWindow,
    chatLongPressRef,
    directAttachmentUploadTasksRef,
    markMessageDeleted,
    canModifyMessage,
    messageReceiptLabel,
    handleMessageClick,
    closeMessageMiniWindows,
    openReactionWindow,
    openToolWindow,
    showChatMenu,
    showChatSidebarMenu,
    toggleHeaderMenu,
    saveCustomChatCategory,
    openCategoryComposer,
    startChatLongPress,
    clearChatLongPress,
    openPasswordModal,
    submitPasswordModal,
    handleChatAction,
    handleHeaderChatAction,
    handleSidebarChatAction,
  } = useChatManager({
    contacts,
    setContacts,
    setMessages,
    deleteUserDoc,
    attachmentUrlRegistryRef,
    setStatus,
    startVideoSignChat: (stayInChat) => startVideoSignChatRef.current?.(stayInChat),
    startVoiceSignChat: (stayInChat) => startVoiceSignChatRef.current?.(stayInChat),
    setContactInfoOpen,
    setGroupModalOpen,
    setGroupCreationContext,
    openPanel: (panel) => openPanelRef.current?.(panel),
    addEncryptedMessage: (...args) => addEncryptedMessageRef.current?.(...args),
    setSelectedShareContactId,
    speak,
    settings,
    liveSign,
  });

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

  const updateSynapseEnabled = useCallback(function updateSynapseEnabled(nextValue) {
    setSynapseEnabled((current) => {
      const value = typeof nextValue === 'function' ? nextValue(current) : nextValue;
      synapseEnabledRef.current = value;
      return value;
    });
  }, []);

  const {
    callStatus,
    setCallStatus,
    callNetworkQuality,
    incomingCall,
    callExperience,
    setCallExperience,
    callElapsedSeconds,
    setCallElapsedSeconds,
    chatCallScreen,
    setChatCallScreen,
    chatCallMinimized,
    setChatCallMinimized,
    chatCallExpanded,
    setChatCallExpanded,
    chatCallInfoOpen,
    setChatCallInfoOpen,
    chatCallMoreOpen,
    setChatCallMoreOpen,
    callControlsVisible,
    chatCallSettingsTab,
    setChatCallSettingsTab,
    chatCallHistoryOpen,
    setChatCallHistoryOpen,
    chatCallFocus,
    setChatCallFocus,
    chatCallPosition,
    setChatCallPosition,
    remoteMediaTrackKinds,
    remoteMediaState,
    remoteCaption,
    captionChannelStatus,
    callTranscript,
    setCallTranscript,
    callSignTelemetry,
    setCallSignTelemetry,
    captionChannelRef,
    peerRefs,
    callSignalingUnsubscribersRef,
    chatCallScreenRef,
    startVideoSignChat,
    startVoiceSignChat,
    switchToVideoSignChat,
    startConversationInfoCall,
    endCallSession,
    acceptIncomingCall,
    rejectIncomingCall,
    formatCallTimer,
    startChatCallMove,
    attachRemoteCallVideo,
    attachLocalTrackingVideo,
    startMeetingMode,
    revealCallControls,
    toggleCallTranslation,
    startWebRtcPreview,
    sendCaptionSync,
  } = useCallsManager({
    fetchJson,
    firestoreDb,
    authenticatedFirebaseUser,
    selectedChatContact,
    settings,
    cameraEnabled,
    micEnabled,
    startCamera,
    stopCamera,
    startCameraRef,
    setMicEnabled,
    updateSynapseEnabled,
    synapseEnabledRef,
    synapseEnabled,
    caption,
    sentence,
    liveSign,
    streamRef,
    videoRef,
    remoteVideoRef,
    speak,
    voiceEnabledRef,
    addTranscriptEntry,
    startConversationLog,
    completeActiveConversationLog,
    clearSentence,
    setStatus,
    setSecureCallStatus,
    updateSettingAndTrack,
    setSelectedChatId,
    setSelectedConversationId,
    setMobileChatListOpen,
    setActivePanel,
    desktopCallWindowMode,
    SIGNOVA_CALL_TEST_MODE,
  });
  startVideoSignChatRef.current = startVideoSignChat;
  startVoiceSignChatRef.current = startVoiceSignChat;

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
    if (selectedChatContact.firebaseUid) {
      return presenceLabel(chatPresenceByUid[selectedChatContact.firebaseUid], {
        showLastSeen: settings.privacy.showLastSeen,
      });
    }
    const isActive = activeCallLog?.contactId === selectedChatContact.id;
    const online = selectedChatContact.id === 'signova-ai' || isActive || selectedChatContact.status === 'online';
    return {
      status: online ? 'Online' : 'Offline',
      detail: online ? 'Local conversation available' : 'No realtime presence',
      device: online ? 'Local app mode' : 'Offline mode',
      tone: online ? 'online' : 'offline',
    };
  }, [activeCallLog, chatPresenceByUid, selectedChatContact, settings.privacy.showLastSeen]);
  const selectedHeaderActivity = useMemo(() => {
    if (!selectedChatPresence) return [];
    if (!settings.privacy.showOnlineStatus) return ['Status hidden'];
    const isTyping = Boolean(selectedChatContact?.id && typingContactId === selectedChatContact.id);
    if (isTyping) return ['typing...'];
    if (activeCallLog?.contactId === selectedChatContact?.id) return ['in live call'];
    if (selectedChatPresence.tone === 'online') {
      return ['online'];
    }
    if (settings.privacy.showLastSeen && selectedChatPresence.detail && !selectedChatPresence.detail.includes('presence')) {
      return [selectedChatPresence.detail];
    }
    return ['offline'];
  }, [activeCallLog, selectedChatContact, selectedChatPresence, settings.privacy.showLastSeen, settings.privacy.showOnlineStatus, typingContactId]);
  const incomingMessageCount = useMemo(() => 0, []);
  const visibleChatMessages = useMemo(() => {
    const conversationMessages = messagesForContact(messages, selectedChatId);
    const query = messageSearch.trim().toLowerCase();
    if (!query) return conversationMessages;
    return conversationMessages.filter((message) => (
      String(message.text || '').toLowerCase().includes(query)
      || String(message.status || '').toLowerCase().includes(query)
      || String(message.time || '').toLowerCase().includes(query)
    ));
  }, [messageSearch, messages, selectedChatId]);
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
  const settingsSections = useMemo(
    () => buildSettingsSections(settings, { cameraEnabled, deviceProfile: detectedDeviceProfile }),
    [cameraEnabled, detectedDeviceProfile, settings],
  );
  const activeSettingsMeta = useMemo(
    () => settingsSections.find((item) => item.id === activeSettingsSection),
    [activeSettingsSection, settingsSections],
  );
  const filteredSettingsSections = useMemo(
    () => filterSettingsSections(settingsSections, settingsSearch),
    [settingsSearch, settingsSections],
  );
  const groupedSettingsSections = useMemo(() => filteredSettingsSections.reduce((groups, section) => {
    const groupTitle = section.group || 'Settings';
    const current = groups[groups.length - 1];
    if (current?.title === groupTitle) current.sections.push(section);
    else groups.push({ title: groupTitle, sections: [section] });
    return groups;
  }, []), [filteredSettingsSections]);
  useEffect(() => {
    if (activePanel !== 'settings' || activeSettingsSection || typeof window === 'undefined') return;
    if (window.matchMedia('(min-width: 1024px)').matches) setActiveSettingsSection('general');
  }, [activePanel, activeSettingsSection]);
  useEffect(() => () => {
    window.clearTimeout(cameraControlClickTimerRef.current);
  }, []);

  useEffect(() => {
    if (chatCallMoreOpen) {
      revealCallControls();
    }
  }, [chatCallMoreOpen, revealCallControls]);

  useEffect(() => {
    const updateNetworkStatus = () => setNetworkOnline(navigator.onLine !== false);
    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

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
    function handleWorkspaceReconnect() {
      setDatabaseStatus({ mode: 'checking', detail: 'Reconnecting and syncing saved changes' });
      flushUserWorkspaceOutbox()
        .then((result) => {
          setDatabaseStatus(result.mode === 'firestore'
            ? { mode: 'firestore', detail: result.remaining ? `${result.remaining} saved changes waiting to sync` : 'Firestore database connected · saved changes synced' }
            : { mode: 'local', detail: `Local database active${result.reason ? ` - ${result.reason}` : ''}` });
        })
        .catch(() => setDatabaseStatus({ mode: 'local', detail: 'Reconnect failed · saved changes remain on this device' }));
    }
    window.addEventListener('online', handleWorkspaceReconnect);
    return () => window.removeEventListener('online', handleWorkspaceReconnect);
  }, []);

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
    if (process.env.NODE_ENV === 'test' || SIGNOVA_UI_TEST_MODE || (SIGNOVA_AUTH_TEST_MODE && !SIGNOVA_AUTH_FLOW_TEST_MODE)) return undefined;
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
          if (SIGNOVA_MEDIA_TEST_MODE || SIGNOVA_CALL_TEST_MODE) {
            const email = SIGNOVA_CALL_TEST_MODE ? `call-peer-${SIGNOVA_CALL_TEST_ROLE === 'b' ? 'b' : 'a'}@example.test` : 'media-owner@example.test';
            const password = SIGNOVA_CALL_TEST_MODE ? 'Signova-call-test-2026!' : 'Signova-media-test-2026!';
            signInWithEmailAndPassword(firebaseAuth, email, password)
              .catch((error) => setAuthMessage({ type: 'error', text: `Media test sign-in failed: ${error.code || error.message}` }));
            return;
          }
          setPersistenceReady(false);
          setSettings(createSettingsWithSavedDisplayTheme(MIN_ACCEPT_CONFIDENCE));
          setContacts(DEFAULT_SESSION_CONTACTS);
          setSelectedChatId(DEFAULT_SESSION_CONTACTS[0]?.id || null);
          setMessages((items) => {
            attachmentUrlRegistryRef.current.releaseMessages(items);
            return [];
          });
          setChatFlags({});
          setCallHistory([]);
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
        fetchJson('/api/auth/identity/register', {
          method: 'POST',
          body: JSON.stringify({ username: profile.username, phone: profile.phone || '' }),
        }).catch(() => undefined);
        setSettings(createSettingsWithSavedDisplayTheme(MIN_ACCEPT_CONFIDENCE));
        applyAuthenticatedProfile(profile);
        resetDatabaseSession();
        setAuthMessage({ type: '', text: '' });
        // Authentication is already complete.  Let the workspace hydrate in
        // place instead of holding the user on a decorative intro screen.
        setAuthStage('app');
      });
    }

    startFirebaseAuthWatcher();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setCommunityPosts(livePosts);
      },
      () => {
        setCommunityPosts([]);
      },
    );
    return unsubscribe;
  }, [authenticatedFirebaseUser?.uid, communityLikedPostIds]);

  useEffect(() => {
    if (authStage !== 'app') return undefined;
    let cancelled = false;
    const startupFallbackTimer = typeof window === 'undefined' ? null : window.setTimeout(() => {
      if (cancelled) return;
      setDatabaseStatus({ mode: 'local', detail: 'Offline workspace ready after startup timeout' });
      setPersistenceReady(true);
    }, 2500);
    setPersistenceReady(false);
    setContacts((prev) => (prev && prev.length > 0 ? prev : DEFAULT_SESSION_CONTACTS));
    setSelectedChatId((prev) => prev || DEFAULT_SESSION_CONTACTS[0]?.id || null);

    async function loadPersistedData() {
      const startedAt = Date.now();
      try {
        const session = await startDatabaseSession();
        if (cancelled) return;
        setDatabaseStatus({
          mode: session.mode,
          detail: session.mode === 'firestore' ? 'Firestore database connected' : `Local database active${session.reason ? ` - ${session.reason}` : ''}`,
        });

        const [savedContacts, savedChatState, savedCalls, savedPreferences] = await Promise.all([
          loadUserCollection('contacts'),
          loadUserCollection('chatState'),
          loadUserCollection('callHistory'),
          loadUserCollection('userPreferences'),
        ]);
        if (cancelled) return;

        let resolvedSettings = settingsSnapshotRef.current;
        const workspaceSettings = savedPreferences.find((item) => item.id === SIGNOVA_SETTINGS_WORKSPACE_ID);
        if (workspaceSettings) {
          resolvedSettings = resolveWorkspaceSettings(resolvedSettings, workspaceSettings, MIN_ACCEPT_CONFIDENCE);
        } else if (session.mode === 'local' && typeof window !== 'undefined' && window.localStorage.getItem(SIGNOVA_SETTINGS_STORAGE_KEY)) {
          const legacySettings = loadPersistedSettings(window.localStorage, MIN_ACCEPT_CONFIDENCE);
          resolvedSettings = resolveWorkspaceSettings(
            resolvedSettings,
            buildSettingsWorkspaceRecord(legacySettings, MIN_ACCEPT_CONFIDENCE),
            MIN_ACCEPT_CONFIDENCE,
          );
          saveUserDoc('userPreferences', buildSettingsWorkspaceRecord(resolvedSettings, MIN_ACCEPT_CONFIDENCE))
            .then(() => window.localStorage.removeItem(SIGNOVA_SETTINGS_STORAGE_KEY))
            .catch(() => {
              // Keep the local backup; startup must not block on migration.
            });
        }
        setSettings(resolvedSettings);
        if (typeof window !== 'undefined' && resolvedSettings?.display?.theme) {
          try {
            window.localStorage.setItem(DISPLAY_THEME_STORAGE_KEY, resolvedSettings.display.theme);
          } catch {}
        }

        const normalizedContacts = savedContacts.map(normalizeContactRecord);
        setContacts([
          ...normalizedContacts,
          ...DEFAULT_SESSION_CONTACTS.filter((initial) => !normalizedContacts.some((contact) => contact.id === initial.id)),
        ]);
        setSelectedChatId(normalizedContacts[0]?.id || DEFAULT_SESSION_CONTACTS[0]?.id || null);

        const messageState = savedChatState.find((item) => item.id === 'messages');
        if (mayPersistChatHistory(resolvedSettings.privacy) && Array.isArray(messageState?.items) && messageState.items.length) {
          setMessages(normalizeConversationMessages(messageState.items));
        }

        const flagState = savedChatState.find((item) => item.id === 'chatFlags');
        if (flagState?.items && typeof flagState.items === 'object') {
          try {
            const migrated = await migrateLegacyChatLockFlags(flagState.items);
            if (cancelled) return;
            setChatFlags(migrated.flags);
          } catch {
            // Retain access in memory, but the persistence effect below refuses
            // to write legacy plaintext when secure migration is unavailable.
            setChatFlags(flagState.items);
          }
        }

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
      } catch (error) {
        if (!cancelled) {
          setDatabaseStatus({ mode: 'local', detail: 'Offline workspace ready with local data' });
        }
      } finally {
        // Keep the transition stable without imposing a noticeable startup
        // delay after local/cache data is available.
        const remainingSkeletonTime = Math.max(0, 180 - (Date.now() - startedAt));
        if (remainingSkeletonTime) await new Promise((resolve) => window.setTimeout(resolve, remainingSkeletonTime));
        if (!cancelled) {
          if (startupFallbackTimer) window.clearTimeout(startupFallbackTimer);
          setPersistenceReady(true);
        }
      }
    }

    loadPersistedData();
    return () => {
      cancelled = true;
      if (startupFallbackTimer) window.clearTimeout(startupFallbackTimer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStage, authenticatedFirebaseUser?.uid]);

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
      setCallStatus('Voice Sign Chat ringing · WebRTC transport protection ready');
    } else {
      setSecureCallStatus('Video Sign Chat ready');
      setCallStatus('Video Sign Chat ringing · camera and sign language ready');
      startCameraRef.current?.();
    }
  }, [authStage, desktopCallWindowMode, setCallExperience, setChatCallScreen, setChatCallMinimized, setCallStatus, updateSynapseEnabled, setMicEnabled, setSecureCallStatus, startCameraRef]);

  useEffect(() => {
    if (!persistenceReady) return;
    if (!chatHistoryPersistenceEnabled) {
      deleteUserDoc('chatState', 'messages').catch(() => {});
      return;
    }
    saveUserDoc('chatState', {
      id: 'messages',
      items: sanitizeAttachmentMessagesForPersistence(messages.filter((message) => !String(message.transport || '').startsWith('firestore')).slice(-120)),
      savedAt: Date.now(),
    }).catch(() => {});
  }, [chatHistoryPersistenceEnabled, messages, persistenceReady]);

  const flushActiveRealtimeMessageOutbox = useCallback(async (realtimeChat) => {
    if (!authenticatedFirebaseUser?.uid || !firestoreDb || realtimeChat.status !== 'ready' || !realtimeChat.chatId || !realtimeChat.contactId) {
      return { attempted: 0, completed: 0, remaining: 0, error: '' };
    }
    const result = await flushDirectMessageOutbox({
      storage: typeof window === 'undefined' ? null : window.localStorage,
      ownerUid: authenticatedFirebaseUser.uid,
      firestore: firestoreDb,
      chatId: realtimeChat.chatId,
      contactId: realtimeChat.contactId,
    });
    if (result.completed) setStatus(result.remaining ? `${result.completed} queued message(s) synced · ${result.remaining} waiting` : 'Queued Firebase messages synced');
    return result;
  }, [authenticatedFirebaseUser?.uid]);

  useEffect(() => {
    if (!authenticatedFirebaseUser?.uid || !selectedChatContact?.firebaseUid || !selectedChatContact?.id) return;
    const queuedMessages = queuedDirectMessagesForContact(
      typeof window === 'undefined' ? null : window.localStorage,
      authenticatedFirebaseUser.uid,
      selectedChatContact.id,
      { chatId: activeRealtimeChat.contactId === selectedChatContact.id ? activeRealtimeChat.chatId : '' },
    );
    if (!queuedMessages.length) return;
    setMessages((items) => {
      const existingIds = new Set(items.map((message) => String(message.id)));
      const nextQueued = queuedMessages.filter((message) => !existingIds.has(message.id));
      return nextQueued.length ? [...items, ...nextQueued].sort((first, second) => Number(first.createdAt || 0) - Number(second.createdAt || 0)) : items;
    });
  }, [activeRealtimeChat.chatId, activeRealtimeChat.contactId, authenticatedFirebaseUser?.uid, selectedChatContact?.firebaseUid, selectedChatContact?.id]);

  useEffect(() => {
    const contactId = selectedChatContact?.id || '';
    const contactUid = selectedChatContact?.firebaseUid || '';
    const currentUser = authenticatedFirebaseUser;
    if (authStage !== 'app' || !contactId || !contactUid || !currentUser?.uid || !currentUser.emailVerified || !firestoreDb) {
      setActiveRealtimeChat({ contactId, chatId: '', status: contactUid ? 'unavailable' : 'local', error: '' });
      return undefined;
    }
    let cancelled = false;
    const unsubscribers = [];
    let latestReceiptMap = new Map();
    setActiveRealtimeChat({ contactId, chatId: '', status: 'connecting', error: '' });
    ensureDirectChat({ firestore: firestoreDb, currentUser, contactUid })
      .then(({ chatId }) => {
        if (cancelled) return;
        const acknowledgeVisibleIncomingMessages = (remoteMessages = []) => {
          remoteMessages
            .filter((message) => message.direction === 'incoming' && message.transport === 'firestore' && !message.deleted)
            .forEach((message) => {
              acknowledgeDirectMessageReceipt({
                firestore: firestoreDb,
                chatId,
                messageId: message.id,
                userUid: currentUser.uid,
                read: Boolean(settings.privacy.readReceipts),
              }).catch((error) => {
                if (!cancelled) setStatus(error?.message || 'Realtime receipt update failed');
              });
            });
        };
        setActiveRealtimeChat({ contactId, chatId, status: 'ready', error: '' });
        flushActiveRealtimeMessageOutbox({ contactId, chatId, status: 'ready', error: '' }).catch(() => {});
        unsubscribers.push(subscribeDirectChatMessages({
          firestore: firestoreDb,
          chatId,
          currentUid: currentUser.uid,
          contactId,
          onMessages: (remoteMessages) => {
            if (cancelled) return;
            acknowledgeVisibleIncomingMessages(remoteMessages);
            resolveDirectAttachmentUrls(remoteMessages);
            setMessages((items) => applyDirectMessageReceipts(
              mergeRealtimeConversationMessages(items, contactId, remoteMessages),
              latestReceiptMap,
            ));
          },
          onError: (error) => {
            if (!cancelled) setActiveRealtimeChat({ contactId, chatId, status: 'error', error: error?.message || 'Realtime chat unavailable' });
          },
        }));
        unsubscribers.push(subscribeDirectChatReactions({
          firestore: firestoreDb,
          chatId,
          onReactions: (reactionMap) => {
            if (cancelled) return;
            setMessages((items) => items.map((message) => {
              if (message.contactId !== contactId || message.transport !== 'firestore') return message;
              return { ...message, reactions: reactionMap.get(message.id) || [] };
            }));
          },
          onError: (error) => {
            if (!cancelled) setStatus(error?.message || 'Realtime reactions unavailable');
          },
        }));
        unsubscribers.push(subscribeDirectChatReceipts({
          firestore: firestoreDb,
          chatId,
          onReceipts: (receiptMap) => {
            if (cancelled) return;
            latestReceiptMap = receiptMap;
            setMessages((items) => applyDirectMessageReceipts(items, receiptMap));
          },
          onError: (error) => {
            if (!cancelled) setStatus(error?.message || 'Realtime receipts unavailable');
          },
        }));
      })
      .catch((error) => {
        if (!cancelled) setActiveRealtimeChat({ contactId, chatId: '', status: 'error', error: error?.message || 'Realtime chat unavailable' });
      });
    return () => {
      cancelled = true;
      unsubscribers.forEach((unsubscribe) => {
        try {
          if (typeof unsubscribe === 'function') unsubscribe();
        } catch {
          // Ignore stale Firestore unsubscribe failures during contact switches.
        }
      });
    };
  }, [authStage, authenticatedFirebaseUser, selectedChatContact?.firebaseUid, selectedChatContact?.id, settings.privacy.readReceipts, flushActiveRealtimeMessageOutbox]);

  useEffect(() => {
    function handleDirectMessageReconnect() {
      flushActiveRealtimeMessageOutbox(activeRealtimeChat).catch(() => {});
    }
    window.addEventListener('online', handleDirectMessageReconnect);
    return () => window.removeEventListener('online', handleDirectMessageReconnect);
  }, [activeRealtimeChat, authenticatedFirebaseUser?.uid, flushActiveRealtimeMessageOutbox]);

  useEffect(() => {
    const uid = authenticatedFirebaseUser?.uid;
    if (authStage !== 'app' || !uid || !firestoreDb) return undefined;
    let stopped = false;
    const deviceLabel = navigator.userAgentData?.platform || 'Web';
    const publish = (state) => {
      if (stopped) return;
      writeUserPresence({
        firestore: firestoreDb,
        uid,
        state: settings.privacy.showOnlineStatus ? state : 'hidden',
        deviceLabel,
      }).catch(() => {});
    };
    publish(document.visibilityState === 'hidden' ? 'away' : 'online');
    const interval = window.setInterval(() => publish(document.visibilityState === 'hidden' ? 'away' : 'online'), 45_000);
    const handleVisibility = () => publish(document.visibilityState === 'hidden' ? 'away' : 'online');
    const handleOnline = () => publish('online');
    const handleOffline = () => publish('away');
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      stopped = true;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      writeUserPresence({
        firestore: firestoreDb,
        uid,
        state: settings.privacy.showOnlineStatus ? 'offline' : 'hidden',
        deviceLabel,
      }).catch(() => {});
    };
  }, [authStage, authenticatedFirebaseUser?.uid, settings.privacy.showOnlineStatus]);

  useEffect(() => {
    if (authStage !== 'app' || !firestoreDb) return undefined;
    const uids = Array.from(new Set(
      visibleContacts
        .map((contact) => String(contact.firebaseUid || '').trim())
        .filter(Boolean)
        .slice(0, 40),
    ));
    if (!uids.length) return undefined;
    const unsubscribers = uids.map((uid) => subscribeUserPresence({
      firestore: firestoreDb,
      uid,
      onPresence: (presence) => {
        setChatPresenceByUid((items) => ({ ...items, [uid]: presence }));
      },
      onError: () => {
        setChatPresenceByUid((items) => ({ ...items, [uid]: null }));
      },
    }));
    return () => {
      unsubscribers.forEach((unsubscribe) => {
        try {
          if (typeof unsubscribe === 'function') unsubscribe();
        } catch {
          // Ignore stale presence unsubscribe failures during chat filter changes.
        }
      });
    };
  }, [authStage, visibleContacts]);

  useEffect(() => {
    if (!persistenceReady) return;
    let cancelled = false;
    migrateLegacyChatLockFlags(chatFlags)
      .then((migrated) => {
        if (cancelled) return;
        if (migrated.migratedCount) {
          setChatFlags(migrated.flags);
          return;
        }
        saveUserDoc('chatState', { id: 'chatFlags', items: migrated.flags, savedAt: Date.now() }).catch(() => {});
      })
      .catch(() => {
        // Fail closed: never write a legacy plaintext credential back to local
        // storage or Firestore when Web Crypto migration cannot complete.
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      recognitionModel: recognitionCapability === 'basic' ? 'basic' : settings.ai.model,
      storeHistory: settings.privacy.storeHistory,
    };
  }, [
    recognitionCapability,
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
    if (streamRef.current) {
      if (videoRef.current && videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
      }
      if (offscreenVideoRef.current && offscreenVideoRef.current.srcObject !== streamRef.current) {
        offscreenVideoRef.current.srcObject = streamRef.current;
        offscreenVideoRef.current.play().catch(() => {});
      }
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

      const key = await createLocalSessionProtectionKey();
      chatKeyRef.current = key;
      setEncryptionStatus('Local session protection active');
    }

    setupEncryption();
  }, []);

  async function addEncryptedMessage(text, direction = 'outgoing', extra = {}) {
    addEncryptedMessageRef.current = addEncryptedMessage;
    const cleanText = text.trim();
    if (!cleanText) return;
    const sentAt = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const createdAt = Date.now();
    const messageId = `${createdAt}-${Math.random().toString(36).slice(2, 7)}`;
    const contactId = String(extra.contactId || selectedChatId || 'signova-ai');
    const isAssistantConversation = contactId === 'signova-ai';
    const baseStatus = direction === 'outgoing' ? (isAssistantConversation ? 'sending' : 'Saved locally') : 'receiving';
    const initialStatus = direction === 'outgoing' ? (isAssistantConversation ? 'sending' : 'local') : 'read';

    if (!chatKeyRef.current) {
      setMessages((items) => [
        ...items,
        {
          id: messageId,
          contactId,
          direction,
          text: cleanText,
          time: sentAt,
          sentAt,
          deliveredAt: direction === 'outgoing' ? '' : 'Now',
          readAt: '',
          status: initialStatus,
          encrypted: false,
          reactions: [],
          createdAt,
          liveActivity: baseStatus,
          seenGlow: false,
          ...extra,
        },
      ]);
      if (direction === 'outgoing' && isAssistantConversation) {
        window.setTimeout(() => {
          setMessages((items) => items.map((message) => (
            message.id === messageId && message.status !== 'deleted'
              ? { ...message, status: 'delivered', deliveredAt: sentAt, liveActivity: 'Delivered locally' }
              : message
          )));
        }, 280);
        window.setTimeout(() => {
          setMessages((items) => items.map((message) => (
            message.id === messageId && message.status !== 'deleted'
              ? { ...message, status: settings.privacy.readReceipts ? 'read' : 'delivered', readAt: settings.privacy.readReceipts ? sentAt : '', liveActivity: settings.privacy.readReceipts ? 'Seen locally' : 'Delivered locally', seenGlow: settings.privacy.readReceipts }
              : message
          )));
        }, 900);
      }
      return;
    }

    const localProtectionContext = `chat:${contactId}`;
    const encryptedPayload = await protectLocalSessionText(chatKeyRef.current, cleanText, { context: localProtectionContext });
    const decryptedText = await revealLocalSessionText(chatKeyRef.current, encryptedPayload, { context: localProtectionContext });
    setMessages((items) => [
      ...items,
      {
        id: messageId,
        contactId,
        direction,
        text: decryptedText,
        time: sentAt,
        sentAt,
        deliveredAt: direction === 'outgoing' ? '' : 'Now',
        readAt: '',
        status: initialStatus,
        encrypted: true,
        encryptedPayload,
        reactions: [],
        createdAt,
        liveActivity: baseStatus,
        seenGlow: false,
        ...extra,
      },
    ]);

    if (direction === 'outgoing' && isAssistantConversation) {
      window.setTimeout(() => {
        setMessages((items) => items.map((message) => (
          message.id === messageId && message.status !== 'deleted'
            ? { ...message, status: 'delivered', deliveredAt: sentAt, liveActivity: 'Delivered locally' }
            : message
        )));
      }, 280);
      window.setTimeout(() => {
        setMessages((items) => items.map((message) => (
          message.id === messageId && message.status !== 'deleted'
            ? { ...message, status: settings.privacy.readReceipts ? 'read' : 'delivered', readAt: settings.privacy.readReceipts ? sentAt : '', liveActivity: settings.privacy.readReceipts ? 'Seen locally' : 'Delivered locally', seenGlow: settings.privacy.readReceipts }
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

  async function reactToMessage(targetMessage, reaction) {
    const message = typeof targetMessage === 'object'
      ? targetMessage
      : messages.find((item) => item.id === targetMessage);
    const messageId = String(message?.id || '').trim();
    if (!messageId) throw new Error('Message is unavailable');
    const isRealtimeMessage = message?.transport === 'firestore';
    const realtimeChatId = message?.realtimeChatId || (activeRealtimeChat.contactId === message?.contactId ? activeRealtimeChat.chatId : '');
    const alreadyReacted = Array.isArray(message?.reactions) && message.reactions.includes(reaction);
    const nextReaction = alreadyReacted ? '' : reaction;
    if (isRealtimeMessage) {
      if (!authenticatedFirebaseUser?.uid || !firestoreDb || !realtimeChatId) {
        throw new Error('Realtime reactions are unavailable');
      }
      await setDirectMessageReaction({
        firestore: firestoreDb,
        chatId: realtimeChatId,
        messageId,
        userUid: authenticatedFirebaseUser.uid,
        reaction: nextReaction,
      });
    }
    setMessages((items) => items.map((message) => (
      message.id === messageId
        ? { ...message, reactions: nextReaction ? Array.from(new Set([...(message.reactions || []), nextReaction])) : (message.reactions || []).filter((item) => item !== reaction) }
        : message
    )));
  }



  async function reactFromWindow(message, reaction, keepOpen = false) {
    await reactToMessage(message, reaction);
    setStatus(`Reacted ${reaction}`);
    if (!keepOpen) closeMessageMiniWindows();
  }

  function runMessageTool(action) {
    Promise.resolve(action()).catch((error) => setStatus(error?.message || 'Message action failed'));
    setToolMessageId('');
  }

  function cancelDirectAttachmentUpload(messageId) {
    const task = directAttachmentUploadTasksRef.current.get(messageId);
    if (!task?.cancel) {
      setStatus('Attachment upload is not active.');
      return;
    }
    task.cancel();
    setStatus('Cancelling attachment upload.');
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
    if (settings.translation.outputType !== 'text') {
      speak(translatedText, targetLanguage === 'Hindi' ? 'hi-IN' : 'en-IN', { rate: 0.96 });
    }
    closeMessageMiniWindows();
    setStatus(`Translated to ${targetLanguage}: ${translatedText}`);
  }

  async function copyMessage(message) {
    if (!message.text || message.deleted) return;
    try {
      await navigator.clipboard.writeText(message.text);
      setStatus('Message copied.');
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

  async function editMessage(message) {
    if (!canModifyMessage(message)) {
      setStatus('Edit window expired. Messages can be edited for 30 minutes.');
      return;
    }
    const nextText = window.prompt('Edit Signova message', message.text);
    if (!nextText || !nextText.trim()) return;
    const cleanText = nextText.trim();
    const isRealtimeMessage = String(message?.transport || '').startsWith('firestore');
    const realtimeChatId = message.realtimeChatId || (activeRealtimeChat.contactId === message.contactId ? activeRealtimeChat.chatId : '');
    if (isRealtimeMessage) {
      if (!realtimeChatId) {
        setStatus('Reconnect verified realtime chat before editing this message');
        return;
      }
      try {
        await markDirectMessageEdited({
          firestore: firestoreDb,
          chatId: realtimeChatId,
          messageId: message.id,
          text: cleanText,
        });
      } catch (error) {
        setStatus(`Edit failed: ${error?.message || 'try again'}`);
        return;
      }
    }
    setMessages((items) => items.map((item) => (
      item.id === message.id
        ? { ...item, text: cleanText, editedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), edited: true, liveActivity: isRealtimeMessage ? 'Edited through Firebase chat' : item.liveActivity }
        : item
    )));
    setStatus(isRealtimeMessage ? 'Message edited through Firebase chat' : 'Message edited locally');
  }

  async function unsendMessage(message) {
    if (!canModifyMessage(message)) {
      setStatus('Unsend window expired. Messages can be unsent for 30 minutes.');
      return;
    }
    const isRealtimeMessage = String(message?.transport || '').startsWith('firestore');
    const realtimeChatId = message.realtimeChatId || (activeRealtimeChat.contactId === message.contactId ? activeRealtimeChat.chatId : '');
    if (isRealtimeMessage) {
      if (!realtimeChatId) {
        setStatus('Reconnect verified realtime chat before unsending this message');
        return;
      }
      try {
        await markDirectMessageUnsent({
          firestore: firestoreDb,
          chatId: realtimeChatId,
          messageId: message.id,
        });
        const mediaPath = String(message?.attachmentData?.mediaPath || '').trim();
        if (mediaPath) deleteObject(storageRef(firebaseStorage, mediaPath)).catch(() => {});
      } catch (error) {
        setStatus(`Unsend failed: ${error?.message || 'try again'}`);
        return;
      }
    }
    setMessages((items) => items.map((item) => {
      if (item.id !== message.id) return item;
      attachmentUrlRegistryRef.current.releaseMessage(item);
      return {
        ...item,
        text: 'You unsent this message',
        status: 'deleted',
        deleted: true,
        unsent: true,
        attachmentData: item.attachmentData ? { ...item.attachmentData, url: '' } : item.attachmentData,
      };
    }));
    setStatus(isRealtimeMessage ? 'Message unsent through Firebase chat' : 'Message unsent locally');
  }

  async function retryMessage(message) {
    const messageId = typeof message === 'string' ? message : message?.id;
    const isRealtimeMessage = String(message?.transport || '').startsWith('firestore');
    if (isRealtimeMessage && message?.attachmentData?.mediaPath) {
      const retryFile = directAttachmentRetryFilesRef.current.get(messageId);
      if (!retryFile) {
        setStatus('Attachment retry needs the original file. Please choose it again.');
        return;
      }
      try {
        await sendRealtimeAttachmentMessage(retryFile, message);
        setStatus('Attachment resent through Firebase chat');
      } catch (error) {
        setStatus(error?.code === 'storage/canceled' ? 'Attachment upload cancelled' : `Attachment retry failed: ${error?.message || 'try again'}`);
      }
      return;
    }
    if (isRealtimeMessage && authenticatedFirebaseUser?.uid) {
      const retryChatId = message.realtimeChatId || (activeRealtimeChat.contactId === message.contactId ? activeRealtimeChat.chatId : '');
      if (!retryChatId) {
        setStatus('Reconnect verified realtime chat before retrying this message');
        return;
      }
      setMessages((items) => items.map((item) => (
        item.id === messageId ? { ...item, status: 'sending', liveActivity: 'Retrying through Firebase chat', transport: 'firestore-pending' } : item
      )));
      try {
        await sendDirectTextMessage({
          firestore: firestoreDb,
          chatId: retryChatId,
          senderUid: authenticatedFirebaseUser.uid,
          text: message.text,
          messageId,
        });
        setMessages((items) => items.map((item) => (
          item.id === messageId ? { ...item, status: 'sent', liveActivity: 'Sent through Firebase chat', transport: 'firestore-pending' } : item
        )));
        setStatus('Message resent through Firebase chat');
      } catch (error) {
        let queued = null;
        try {
          queued = enqueueDirectMessage(typeof window === 'undefined' ? null : window.localStorage, authenticatedFirebaseUser.uid, {
            senderUid: authenticatedFirebaseUser.uid,
            contactId: message.contactId,
            chatId: retryChatId,
            messageId,
            text: message.text,
          });
        } catch {
          queued = null;
        }
        setMessages((items) => items.map((item) => (
          item.id === messageId
            ? { ...item, status: queued ? 'queued' : 'failed', liveActivity: queued ? 'Queued for Firebase retry' : 'Firebase retry failed', transport: queued ? 'firestore-queued' : 'firestore-failed', realtimeChatId: retryChatId }
            : item
        )));
        setStatus(queued ? 'Message queued and will retry when Firebase reconnects' : `Retry failed: ${error?.message || 'try again'}`);
      }
      return;
    }
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
    if (selectedChatContact?.firebaseUid) {
      if (activeRealtimeChat.status !== 'ready' || activeRealtimeChat.contactId !== replyContactId || !activeRealtimeChat.chatId || !authenticatedFirebaseUser?.uid) {
        setComposerSending(false);
        setStatus(activeRealtimeChat.status === 'error' ? `Realtime chat unavailable: ${activeRealtimeChat.error}` : 'Connecting verified realtime chat · try again in a moment');
        return false;
      }
      const createdAt = Date.now();
      const messageId = `message-${window.crypto?.randomUUID?.() || `${createdAt}-${Math.random().toString(16).slice(2)}`}`;
      const time = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((items) => [...items, {
        id: messageId,
        contactId: replyContactId,
        direction: 'outgoing',
        text: outgoingText,
        time,
        sentAt: time,
        deliveredAt: '',
        readAt: '',
        status: 'sending',
        encrypted: false,
        reactions: [],
        createdAt,
        liveActivity: 'Sending through Firebase chat',
        seenGlow: false,
        senderUid: authenticatedFirebaseUser.uid,
        transport: 'firestore-pending',
        realtimeChatId: activeRealtimeChat.chatId,
      }]);
      setChatDraft('');
      try {
        await sendDirectTextMessage({
          firestore: firestoreDb,
          chatId: activeRealtimeChat.chatId,
          senderUid: authenticatedFirebaseUser.uid,
          text: outgoingText,
          messageId,
        });
        setMessages((items) => items.map((message) => (
          message.id === messageId ? { ...message, status: 'sent', liveActivity: 'Sent through Firebase chat' } : message
        )));
        setStatus('Message sent through Firebase chat');
      } catch (error) {
        let queued = null;
        try {
          queued = enqueueDirectMessage(typeof window === 'undefined' ? null : window.localStorage, authenticatedFirebaseUser.uid, {
            senderUid: authenticatedFirebaseUser.uid,
            contactId: replyContactId,
            chatId: activeRealtimeChat.chatId,
            messageId,
            text: outgoingText,
          });
        } catch {
          queued = null;
        }
        setMessages((items) => items.map((message) => (
          message.id === messageId
            ? { ...message, status: queued ? 'queued' : 'failed', liveActivity: queued ? 'Queued for Firebase retry' : (error?.code === 'chat/write-timeout' ? 'Waiting for network confirmation' : 'Firebase send failed'), transport: queued ? 'firestore-queued' : 'firestore-failed' }
            : message
        )));
        setStatus(queued
          ? 'Message queued and will retry when Firebase reconnects'
          : (error?.code === 'chat/write-timeout' ? 'Message is waiting for Firebase network confirmation' : `Message failed: ${error?.message || 'try again'}`));
      } finally {
        setComposerSending(false);
      }
      return true;
    }
    await addEncryptedMessage(outgoingText, 'outgoing', { contactId: replyContactId || 'signova-ai' });
    setChatDraft('');
    window.setTimeout(() => setComposerSending(false), 720);
    if (replyContactId === 'signova-ai') {
      setTypingContactId(replyContactId);
      window.setTimeout(() => {
        addEncryptedMessage(buildAssistantReply(outgoingText), 'incoming', { contactId: replyContactId });
        setTypingContactId((currentId) => (currentId === replyContactId ? '' : currentId));
      }, 420);
    } else {
      setStatus(selectedChatContact?.firebaseUid
        ? 'Message saved locally · realtime chat transport is not connected yet'
        : 'Message saved locally · this contact is not linked to a verified Signova account');
    }
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
      const url = attachmentUrlRegistryRef.current.track(URL.createObjectURL(blob));
      addEncryptedMessage(`Music / Audio Note: Voice note ${duration}`, 'outgoing', {
        attachmentType: 'audio',
        attachmentData: {
          title: `Voice note ${duration}`,
          url,
          fileType: mimeType,
          size: duration,
          durationSeconds: voiceNote.seconds,
          signGloss: `VOICE NOTE (${duration}) · READY FOR SIGN CONVERSION`,
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
    return 'I am Signova AI Assistant. I can help with signs, calls, contacts, media drive, and chat.';
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
    const video = (offscreenVideoRef.current && offscreenVideoRef.current.readyState >= 2)
      ? offscreenVideoRef.current
      : (videoRef.current || offscreenVideoRef.current);
    if (!video) return;

    const resultRoi = currentMediaPipeRoiRef.current;
    const mappedHandLandmarks = results.multiHandLandmarks?.map((landmarks) => mapLandmarksFromSignerRoi(landmarks, resultRoi)) || [];

    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (context) {
        const width = video.videoWidth || canvas.clientWidth || 640;
        const height = video.videoHeight || canvas.clientHeight || 480;
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);

        const HAND_SKELETON_BONES = [
          [0, 1], [1, 2], [2, 3], [3, 4],
          [0, 5], [5, 6], [6, 7], [7, 8],
          [5, 9], [9, 10], [10, 11], [11, 12],
          [9, 13], [13, 14], [14, 15], [15, 16],
          [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
        ];

        mappedHandLandmarks.forEach((landmarks) => {
          context.save();
          context.strokeStyle = 'rgba(14, 165, 233, 0.9)';
          context.lineWidth = 3;
          context.lineCap = 'round';
          context.lineJoin = 'round';
          HAND_SKELETON_BONES.forEach(([i, j]) => {
            if (landmarks[i] && landmarks[j]) {
              context.beginPath();
              context.moveTo(landmarks[i].x * canvas.width, landmarks[i].y * canvas.height);
              context.lineTo(landmarks[j].x * canvas.width, landmarks[j].y * canvas.height);
              context.stroke();
            }
          });

          context.fillStyle = '#22d3ee';
          context.shadowColor = '#06b6d4';
          context.shadowBlur = 8;
          landmarks.forEach((pt) => {
            context.beginPath();
            context.arc(pt.x * canvas.width, pt.y * canvas.height, 4, 0, 2 * Math.PI);
            context.fill();
          });
          context.restore();
        });
      }
    }

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

    if (!synapseEnabledRef.current) {
      setStatus('Camera active - turn on Synapse for signs');
      setLearningFeedback('Synapse Engine is off. Turn it on to translate signs.');
      return;
    }

    const landmarks = toPointArray(mappedHandLandmarks[0]);
    const now = Date.now();
    const multimodalVector = extract165DVector({
      poseLandmarks: results.poseLandmarks,
      faceLandmarks: results.faceLandmarks,
      leftHandLandmarks: mappedHandLandmarks[0],
      rightHandLandmarks: mappedHandLandmarks[1],
    });

    temporalFramesRef.current = [
      ...temporalFramesRef.current,
      {
        landmarks,
        hands: mappedHandLandmarks.map(toPointArray),
        pose: results.poseLandmarks || [],
        face: results.faceLandmarks || [],
        multimodal_vector: Array.from(multimodalVector),
        handedness: results.multiHandedness?.map((item) => item.label) || [],
        timestamp: now,
      },
    ].slice(-TEMPORAL_BUFFER_SIZE);

    if (now - lastSentAt.current < PREDICTION_INTERVAL_MS || predictionInFlightRef.current) return;
    lastSentAt.current = now;
    predictionInFlightRef.current = true;

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
          if (runtimeSettingsRef.current.recognitionModel === 'basic' || quickConfidence >= sequenceConfidence || sequenceConfidence < 0.1) {
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
      const basicTestingMode = runtimeSettingsRef.current.recognitionModel === 'basic' && quickFallbackActive;
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
        const sentAsVoice = activePanel !== 'learn'
          && voiceEnabledRef.current
          && phrase !== lastSpoken.current
          && settings.translation.outputType !== 'text';
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
    if (!mayProcessCamera(settings.privacy)) {
      setStatus('Camera processing is disabled in Privacy settings');
      setApiRecovery({ active: false, message: '' });
      return false;
    }
    if (restartStream && streamRef.current) {
      cameraFrameLoopRef.current?.stop();
      cameraFrameLoopRef.current = null;
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      handsRef.current?.close?.();
      handsRef.current = null;
    }
    if (streamRef.current) return true;

    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      setStatus('Camera requires HTTPS or localhost');
      setApiRecovery({ active: true, message: 'Open Signova over HTTPS to use sign translation.' });
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('Camera is unavailable in this browser');
      setApiRecovery({ active: true, message: 'This browser does not provide secure camera access.' });
      return false;
    }

    try {
      const performanceProfile = PERFORMANCE_PROFILES[settings.ai.performanceMode] || PERFORMANCE_PROFILES.balanced;
      const trackerLoad = loadMediaPipeScripts()
        .then(() => ({ ready: typeof window.Hands === 'function', error: null }))
        .catch((error) => ({ ready: false, error }));
      const acquired = await acquireCameraStream(navigator.mediaDevices, settings.camera, facingModeOverride);
      const { stream, resolution: cameraResolution } = acquired;

      if (micEnabled) {
        const microphone = await attachMicrophoneTrack(navigator.mediaDevices, stream, settings.microphone);
        if (!microphone.added) setStatus('Camera active · microphone unavailable');
      }

      setCameraQuality(await configureVideoTrack(stream, cameraResolution, settings.camera.fps));
      streamRef.current = stream;
      setCameraEnabled(true);
      setStatus('Camera active');
      setApiRecovery({ active: false, message: '' });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      if (offscreenVideoRef.current) {
        offscreenVideoRef.current.srcObject = stream;
        await offscreenVideoRef.current.play().catch(() => {});
      }

      const tracker = await trackerLoad;
      if (!tracker.ready) {
        setStatus('Camera active · hand tracker failed to load');
        setApiRecovery({
          active: true,
          message: tracker.error?.message || 'Hand tracking could not load. Check the network and retry.',
        });
        return true;
      }

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

      cameraFrameLoopRef.current?.stop();
      cameraFrameLoopRef.current = createCameraFrameLoop({
        isActive: () => Boolean(streamRef.current),
        getVideo: () => {
          if (offscreenVideoRef.current && offscreenVideoRef.current.readyState >= 2) return offscreenVideoRef.current;
          if (videoRef.current && videoRef.current.readyState >= 2) return videoRef.current;
          return offscreenVideoRef.current || videoRef.current;
        },
        getConfig: () => {
          const config = frameSettingsRef.current;
          return {
            ...config,
            frameRate: config.frameRate || settings.ai.frameRate || 30,
            frameModulo: (PERFORMANCE_PROFILES[config.performanceMode] || PERFORMANCE_PROFILES.balanced).frameModulo,
          };
        },
        processFrame: async (video) => {
          void sendRtmwSnapshot(video);
          await hands.send({ image: getMediaPipeInput(video) });
        },
        onFrameError: () => setStatus('MediaPipe frame skipped'),
      });
      cameraFrameLoopRef.current.start();
      return true;
    } catch (error) {
      cameraFrameLoopRef.current?.stop();
      cameraFrameLoopRef.current = null;
      const message = cameraErrorMessage(error);
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      handsRef.current?.close?.();
      handsRef.current = null;
      setCameraEnabled(false);
      setStatus(message);
      setApiRecovery({ active: true, message });
      return false;
    }
  }

  startCameraRef.current = startCamera;

  function stopCamera() {
    if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
    cameraFrameLoopRef.current?.stop();
    cameraFrameLoopRef.current = null;
    stopMediaStream(streamRef.current);
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

  useEffect(() => {
    if (activePanel === 'communityCreate' && streamRef.current) stopCamera();
  }, [activePanel]);

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
    callSignalingUnsubscribersRef.current.forEach((unsubscribe) => unsubscribe?.());
    attachmentUrlRegistryRef.current.releaseAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captionChannelRef, peerRefs, callSignalingUnsubscribersRef]);

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
        setPasswordModal({ open: false, contactId: null, mode: 'create', value: '', error: '', methods: { face: false, fingerprint: false, pin: true } });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePanel, attachMenuOpen, contactModalOpen, conversationCategoryOpen, conversationInfoMenuOpen, passwordModal.open, selectedConversationId]);

  useEffect(() => {
    async function loadSigns() {
      try {
        const data = await fetchJson('/api/signs');
        if (Array.isArray(data.signs) && data.signs.length) {
          setSignLibrary(data.signs);
          const availableSigns = data.signs.filter((sign) => sign.recognition_status !== 'training_required');
          const hasSequenceModel = availableSigns.some((sign) => {
            const sources = Array.isArray(sign.sources) ? sign.sources : [sign.source];
            return sources.some((source) => String(source || '').includes('transformer'));
          });
          const capability = hasSequenceModel ? 'sequence' : 'basic';
          setRecognitionCapability(capability);
          setSignApiStatus(
            capability === 'basic'
              ? `Basic live translation ready · ${availableSigns.length} signs`
              : `Loaded ${availableSigns.length} trained signs from ${data.apiSource}`,
          );
          return;
        }
        setRecognitionCapability('basic');
        setSignApiStatus('Using fallback signs');
      } catch {
        setSignLibrary(DEFAULT_SIGNS);
        setRecognitionCapability('basic');
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
        setApiRecovery((current) => (
          current.active && /request failed|service|api|unreachable|offline/i.test(current.message)
            ? { active: false, message: '' }
            : current
        ));
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
  }, [apiConnectionRetryKey]);

  function retryServiceConnection() {
    setServiceBannerDismissed(false);
    setApiConnection((current) => ({
      ...current,
      status: 'checking',
      backend: 'Checking',
      ai: 'Checking',
      detail: 'Checking Signova services',
    }));
    setApiConnectionRetryKey((value) => value + 1);
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


  function openPanel(panel) {
    openPanelRef.current = openPanel;
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
        profilePhoto: profile.profilePhotoUrl || '',
        profilePhotoPath: profile.profilePhotoPath || '',
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
      ...(profile.profilePhoto && profile.profilePhotoPath ? {
        profilePhotoUrl: profile.profilePhoto,
        profilePhotoPath: profile.profilePhotoPath,
      } : {}),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(firestoreDb, 'users', user.uid), profilePayload, { merge: true });
    if (username) {
      try {
        await setDoc(doc(firestoreDb, 'publicUserIdentities', username), {
          uid: user.uid,
          username,
          name: profile.name || user.displayName || 'Signova User',
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (pubErr) {
        console.warn('Public identity directory write postponed:', pubErr?.message);
      }
    }
    if (phone && firestoreDb && user?.uid) {
      const phoneDigits = String(phone).replace(/\D/g, '');
      if (phoneDigits.length >= 7) {
        setDoc(doc(firestoreDb, 'publicPhoneIdentities', phoneDigits), {
          uid: user.uid,
          username,
          name: profile.name || user.displayName || 'Signova User',
          phone: phoneDigits,
          updatedAt: serverTimestamp(),
        }, { merge: true }).catch(() => undefined);
        if (phoneDigits.length > 10) {
          const national = phoneDigits.slice(-10);
          setDoc(doc(firestoreDb, 'publicPhoneIdentities', national), {
            uid: user.uid,
            username,
            name: profile.name || user.displayName || 'Signova User',
            phone: national,
            updatedAt: serverTimestamp(),
          }, { merge: true }).catch(() => undefined);
        }
      }
    }
    if (user.emailVerified) {
      try {
        if (typeof firebaseAuth?.currentUser?.getIdToken === 'function') {
          await firebaseAuth.currentUser.getIdToken(true).catch(() => undefined);
        }
        await fetchJson('/api/auth/identity/register', {
          method: 'POST',
          body: JSON.stringify({ username, phone }),
        });
      } catch (identityError) {
        // Backend identity indexing is auxiliary; profile and Firestore are already successfully saved
        console.warn('Backend identity directory sync postponed:', identityError?.message);
      }
    }
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
    const fallbackProfile = {
      ...fallback,
      email: user?.email || fallback.email,
      emailVerified: Boolean(user?.emailVerified),
    };
    if (!firestoreDb || !user?.uid) {
      return fallbackProfile;
    }
    return resolveStartupValue(
      getDoc(doc(firestoreDb, 'users', user.uid)).then((profileSnap) => ({
        ...fallback,
        ...(profileSnap.exists() ? profileSnap.data() : {}),
        email: user.email || fallback.email,
        emailVerified: Boolean(user.emailVerified),
      })),
      fallbackProfile,
    );
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
    const cleanUsername = normalizeAuthUsername(profile.username || user.email?.split('@')[0] || '');
    if (cleanUsername && firestoreDb && user?.uid) {
      setDoc(doc(firestoreDb, 'publicUserIdentities', cleanUsername), {
        uid: user.uid,
        username: cleanUsername,
        name: profile.name || user.displayName || 'Signova User',
        updatedAt: serverTimestamp(),
      }, { merge: true }).catch(() => undefined);
      const userPhoneDigits = String(profile.phone || '').replace(/\D/g, '');
      if (userPhoneDigits.length >= 7) {
        setDoc(doc(firestoreDb, 'publicPhoneIdentities', userPhoneDigits), {
          uid: user.uid,
          username: cleanUsername,
          name: profile.name || user.displayName || 'Signova User',
          phone: userPhoneDigits,
          updatedAt: serverTimestamp(),
        }, { merge: true }).catch(() => undefined);
        if (userPhoneDigits.length > 10) {
          const natDigits = userPhoneDigits.slice(-10);
          setDoc(doc(firestoreDb, 'publicPhoneIdentities', natDigits), {
            uid: user.uid,
            username: cleanUsername,
            name: profile.name || user.displayName || 'Signova User',
            phone: natDigits,
            updatedAt: serverTimestamp(),
          }, { merge: true }).catch(() => undefined);
        }
      }
    }
    resetDatabaseSession();
    setAuthMessage({ type: '', text: '' });
    setAuthStage('app');
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
      if (authMode === 'signup') {
        const { password, email, username, phone, name } = validateAuthForm(authForm, 'signup');
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

      const { password, email } = validateAuthForm(authForm, 'login');
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
      attachmentUrlRegistryRef.current.releaseAll();
      setMessages([]);
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
      const updatedAccount = {
        ...settings.account,
        name,
        firstName: nameParts.firstName,
        lastName: nameParts.lastName,
        username,
        phone,
      };
      const nextSettings = {
        ...settings,
        account: updatedAccount,
      };
      setSettings(nextSettings);

      // Immediately persist to local storage so user edits are permanently saved even if offline
      if (typeof window !== 'undefined') {
        try {
          const workspaceRecord = buildSettingsWorkspaceRecord(nextSettings, MIN_ACCEPT_CONFIDENCE);
          window.localStorage.setItem(SIGNOVA_SETTINGS_STORAGE_KEY, JSON.stringify({ version: 2, settings: workspaceRecord.settings }));
          saveUserDoc('userPreferences', workspaceRecord).catch(() => undefined);
        } catch (storageErr) {
          console.warn('Local workspace save note:', storageErr);
        }
      }

      if (authenticatedFirebaseUser && firebaseAuth?.currentUser) {
        try {
          if (typeof firebaseAuth.currentUser.getIdToken === 'function') {
            await firebaseAuth.currentUser.getIdToken(true).catch(() => undefined);
          }
          await updateProfile(firebaseAuth.currentUser, { displayName: name }).catch((err) => {
            console.warn('Firebase updateProfile notice:', err);
          });
          await saveAuthProfile(authenticatedFirebaseUser, nextProfile);
        } catch (cloudErr) {
          console.warn('Firebase cloud sync notice:', cloudErr);
          setAccountSettingsMessage({
            type: 'success',
            text: 'Profile changes saved locally. Cloud sync will finalize automatically.',
          });
          setStatus('Profile changes saved locally.');
          return;
        }
      }

      setAccountSettingsMessage({ type: 'success', text: 'Profile changes saved successfully.' });
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

  async function deleteSignovaAccount() {
    setAccountSettingsMessage({ type: '', text: '' });
    setAccountDeletionForm((current) => ({ ...current, busy: true }));
    try {
      stopCamera();
      await deleteCurrentAccountWithPassword({
        firebaseAuth,
        password: accountDeletionForm.password,
        apiBaseUrl: API_URL,
      });
      attachmentUrlRegistryRef.current.releaseAll();
      setMessages([]);
      setCallHistory([]);
      setContacts(DEFAULT_SESSION_CONTACTS);
      setSelectedChatId(DEFAULT_SESSION_CONTACTS[0]?.id || null);
      setAccountDeletionForm({ password: '', busy: false });
      resetDatabaseSession();
      setAuthenticatedFirebaseUser(null);
      setPersistenceReady(false);
      setAuthMode('login');
      setAuthRecoveryOpen(false);
      setAuthMessage({ type: 'success', text: 'Account deleted. Your Firebase account and Signova-owned data cleanup completed.' });
      setAuthStage('auth');
    } catch (error) {
      setAccountSettingsMessage({ type: 'error', text: getFriendlyFirebaseAuthError(error, error?.message || 'Could not delete account.') });
      setAccountDeletionForm((current) => ({ ...current, busy: false }));
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
    const accepted = [];
    const rejected = [];
    files.forEach((file) => {
      try {
        validateChatAttachmentFile(file);
        accepted.push(file);
      } catch (error) {
        rejected.push(error.message || 'Attachment rejected.');
      }
    });
    const items = accepted.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Date.now()}`,
      name: file.name,
      type: file.type || 'document',
      size: file.size,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));
    if (items.length) setDriveItems((current) => [...items, ...current]);
    event.target.value = '';
    accepted.forEach((file) => sendFileAsSpecialMessage(file));
    if (rejected.length) {
      setStatus(`${rejected.length} attachment${rejected.length === 1 ? '' : 's'} rejected. ${rejected[0]}`);
    } else if (selectedChatContact?.firebaseUid) {
      setStatus(`${accepted.length} attachment${accepted.length === 1 ? '' : 's'} uploading through Firebase chat.`);
    } else {
      setStatus(`${accepted.length} attachment${accepted.length === 1 ? '' : 's'} ready in this local preview.`);
    }
  }

  function directAttachmentStoragePath({ chatId, senderUid, messageId, storageName }) {
    return `chatAttachments/${chatId}/${senderUid}/${messageId}/${storageName}`;
  }

  function resolveDirectAttachmentUrls(candidateMessages = []) {
    if (!firebaseStorage) return;
    candidateMessages.forEach((message) => {
      const mediaPath = String(message?.attachmentData?.mediaPath || '').trim();
      if (!mediaPath || message.attachmentData?.url || directAttachmentUrlRequestsRef.current.has(mediaPath)) return;
      directAttachmentUrlRequestsRef.current.add(mediaPath);
      getDownloadURL(storageRef(firebaseStorage, mediaPath))
        .then((url) => {
          if (!url) return;
          setMessages((items) => items.map((item) => (
            item.id === message.id
              ? { ...item, attachmentData: { ...(item.attachmentData || {}), url, previewExpired: false } }
              : item
          )));
        })
        .catch(() => {
          setMessages((items) => items.map((item) => (
            item.id === message.id
              ? { ...item, attachmentData: { ...(item.attachmentData || {}), url: '', previewExpired: true } }
              : item
          )));
        });
    });
  }

  async function sendRealtimeAttachmentMessage(file, retryMessageState = null) {
    if (activeRealtimeChat.status !== 'ready' || activeRealtimeChat.contactId !== selectedChatId || !activeRealtimeChat.chatId || !authenticatedFirebaseUser?.uid) {
      throw new Error(activeRealtimeChat.status === 'error' ? `Realtime chat unavailable: ${activeRealtimeChat.error}` : 'Connecting verified realtime chat · try again in a moment');
    }
    const retryMessageId = String(retryMessageState?.id || '').trim();
    const localUrl = retryMessageState?.attachmentData?.url || attachmentUrlRegistryRef.current.track(URL.createObjectURL(file));
    const descriptor = buildDirectChatAttachmentDescriptor(file, { imageSendMode, url: localUrl });
    const createdAt = Number(retryMessageState?.createdAt || Date.now());
    const messageId = retryMessageId || `message-${window.crypto?.randomUUID?.() || `${createdAt}-${Math.random().toString(16).slice(2)}`}`;
    const time = new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const mediaPath = directAttachmentStoragePath({
      chatId: activeRealtimeChat.chatId,
      senderUid: authenticatedFirebaseUser.uid,
      messageId,
      storageName: descriptor.storageName,
    });
    directAttachmentRetryFilesRef.current.set(messageId, file);
    if (retryMessageId) {
      setMessages((items) => items.map((message) => (
        message.id === messageId
          ? {
            ...message,
            status: 'sending',
            transport: 'firestore-pending',
            liveActivity: 'Retrying attachment upload',
            attachmentData: { ...(message.attachmentData || descriptor.attachmentData), mediaPath, uploadStage: 'uploading', uploadProgress: 0, uploadError: '' },
          }
          : message
      )));
    } else {
      setMessages((items) => [...items, {
        id: messageId,
        contactId: selectedChatId,
        direction: 'outgoing',
        text: descriptor.text,
        time,
        sentAt: time,
        deliveredAt: '',
        readAt: '',
        status: 'sending',
        encrypted: false,
        reactions: [],
        createdAt,
        liveActivity: 'Uploading attachment to Firebase Storage',
        seenGlow: false,
        senderUid: authenticatedFirebaseUser.uid,
        transport: 'firestore-pending',
        realtimeChatId: activeRealtimeChat.chatId,
        attachmentType: descriptor.attachmentType,
        attachmentData: { ...descriptor.attachmentData, mediaPath, durable: false, previewExpired: false, uploadStage: 'uploading', uploadProgress: 0, uploadError: '' },
      }]);
    }
    try {
      const uploadResult = await uploadDirectChatAttachment({
        storage: firebaseStorage,
        file,
        path: mediaPath,
        contentType: descriptor.contentType,
        metadata: {
          chatId: activeRealtimeChat.chatId,
          senderUid: authenticatedFirebaseUser.uid,
          messageId,
        },
        makeRef: storageRef,
        startResumableUpload: uploadBytesResumable,
        getUrl: getDownloadURL,
        onTask: (task) => directAttachmentUploadTasksRef.current.set(messageId, task),
        onProgress: (progress) => {
          setMessages((items) => items.map((message) => (
            message.id === messageId
              ? { ...message, liveActivity: `Uploading attachment ${progress}%`, attachmentData: { ...(message.attachmentData || {}), uploadStage: 'uploading', uploadProgress: progress } }
              : message
          )));
        },
      });
      setMessages((items) => items.map((message) => (
        message.id === messageId
          ? { ...message, liveActivity: 'Attachment uploaded · publishing message', attachmentData: { ...(message.attachmentData || {}), uploadStage: 'publishing', uploadProgress: 100, url: uploadResult.url || message.attachmentData?.url || '' } }
          : message
      )));
      await sendDirectAttachmentMessage({
        firestore: firestoreDb,
        chatId: activeRealtimeChat.chatId,
        senderUid: authenticatedFirebaseUser.uid,
        messageId,
        text: descriptor.text,
        mediaPath,
        attachment: {
          type: descriptor.attachmentType,
          title: descriptor.attachmentData.title,
          contentType: descriptor.contentType,
          size: descriptor.attachmentData.size,
          sizeBytes: descriptor.sizeBytes,
          mode: descriptor.attachmentData.mode || '',
          quality: descriptor.attachmentData.quality || '',
        },
      });
      setMessages((items) => items.map((message) => (
        message.id === messageId
          ? { ...message, status: 'sent', liveActivity: 'Attachment sent through Firebase chat', attachmentData: { ...(message.attachmentData || {}), durable: true, mediaPath, uploadStage: 'sent', uploadProgress: 100, uploadError: '' } }
          : message
      )));
      directAttachmentRetryFilesRef.current.delete(messageId);
      return true;
    } catch (error) {
      const cancelled = error?.code === 'storage/canceled';
      deleteObject(storageRef(firebaseStorage, mediaPath)).catch(() => {});
      setMessages((items) => items.map((message) => (
        message.id === messageId
          ? {
            ...message,
            status: 'failed',
            liveActivity: cancelled ? 'Attachment upload cancelled' : (error?.code === 'chat/write-timeout' ? 'Waiting for attachment message confirmation' : 'Attachment send failed'),
            transport: 'firestore-failed',
            attachmentData: { ...(message.attachmentData || {}), uploadStage: cancelled ? 'cancelled' : 'failed', uploadError: cancelled ? 'Upload cancelled' : (error?.message || 'Attachment send failed') },
          }
          : message
      )));
      throw error;
    } finally {
      directAttachmentUploadTasksRef.current.delete(messageId);
    }
  }

  function sendFileAsSpecialMessage(file) {
    try {
      validateChatAttachmentFile(file);
      if (selectedChatContact?.firebaseUid) {
        sendRealtimeAttachmentMessage(file)
          .then(() => setStatus('Attachment sent through Firebase chat'))
          .catch((error) => setStatus(error?.message || 'Attachment send failed'));
        return true;
      }
      const url = attachmentUrlRegistryRef.current.track(URL.createObjectURL(file));
      const message = buildChatAttachmentMessage(file, { imageSendMode, url });
      addEncryptedMessage(message.text, 'outgoing', {
        attachmentType: message.attachmentType,
        attachmentData: message.attachmentData,
      });
      return true;
    } catch (error) {
      setStatus(error.message || 'Attachment rejected.');
      return false;
    }
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
        note: 'Shared Signova identity card for contact exchange.',
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
    let firebaseUid = '';
    try {
      if (firestoreDb && usernameCheck.username) {
        const identitySnap = await getDoc(doc(firestoreDb, 'publicUserIdentities', usernameCheck.username));
        if (identitySnap.exists()) {
          firebaseUid = String(identitySnap.data()?.uid || '');
        }
      }
    } catch (directError) {
      console.warn('Direct identity lookup fallback:', directError?.message);
    }
    if (!firebaseUid && phone.nationalNumber && firestoreDb) {
      try {
        const phoneKeys = extractLookupPhoneKeys(phone.countryCode, phone.nationalNumber);
        for (const key of phoneKeys) {
          const phoneSnap = await getDoc(doc(firestoreDb, 'publicPhoneIdentities', key));
          if (phoneSnap.exists() && phoneSnap.data()?.uid) {
            firebaseUid = String(phoneSnap.data()?.uid || '');
            break;
          }
        }
      } catch (phoneErr) {
        console.warn('Phone identity lookup fallback:', phoneErr?.message);
      }
    }
    if (!firebaseUid) {
      try {
        const identity = await fetchJson('/api/auth/identity/resolve', {
          method: 'POST',
          body: JSON.stringify({ username: usernameCheck.username }),
        });
        firebaseUid = String(identity.uid || '');
      } catch {
        // The contact remains useful locally, but real calling requires a verified UID.
      }
    }
    const id = `${usernameCheck.username.replace('@', 'user-')}-${Date.now()}`;
    const nextContact = normalizeContactRecord({
      id,
      firebaseUid,
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
    setStatus(firebaseUid
      ? 'Contact verified and saved · real calling ready'
      : databaseStatus.mode === 'firestore' ? 'Contact saved · real calling waits for verified Signova identity' : 'Contact saved locally');
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
        encryptedRequired: false,
        membersList: members,
        owner: settings.account.username || '@signova.user',
        createdAt: Date.now(),
      };
      setCommunityGroupRecords((items) => [communityRecord, ...items]);
      setSelectedCommunityGroupId(communityRecord.id);
      if (window.crypto?.subtle) {
        createLocalSessionProtectionKey().then((key) => communityGroupKeysRef.current.set(communityRecord.id, key)).catch(() => {});
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
      key = await createLocalSessionProtectionKey();
      communityGroupKeysRef.current.set(selectedCommunityGroup.id, key);
    }
    const encryptedPayload = key ? await protectLocalSessionText(key, text, { context: `group:${selectedCommunityGroup.id}` }) : null;
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
          key = await createLocalSessionProtectionKey();
          communityGroupKeysRef.current.set(selectedCommunityGroup.id, key);
        }
        const label = `Voice message · ${formatVoiceTime(duration)}`;
        const encryptedPayload = key ? await protectLocalSessionText(key, label, { context: `group:${selectedCommunityGroup.id}` }) : null;
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
    if (!firestoreDb || !authenticatedFirebaseUser?.uid || !authenticatedFirebaseUser.emailVerified) {
      setStatus('Sign in with a verified account before publishing.');
      return;
    }
    if (communityComposerMedia && (communityComposerReview.stage !== 'ready' || !communityComposerReview.confirmed)) {
      setStatus('Review and confirm the media verification points before publishing.');
      return;
    }
    let uploadedMedia = communityComposerMedia;
    if (communityComposerMedia?.file) {
      if (!firebaseStorage) {
        setStatus('Media storage is unavailable. The post was not published.');
        return;
      }
      setStatus('Uploading community media…');
      setCommunityUpload({ stage: 'uploading', progress: 0, error: '' });
      try {
        uploadedMedia = await uploadCommunityMedia({
          storage: firebaseStorage,
          media: communityComposerMedia,
          ownerUid: authenticatedFirebaseUser.uid,
          makeRef: storageRef,
          startResumableUpload: uploadBytesResumable,
          uploadBlob: uploadBytes,
          getUrl: getDownloadURL,
          remove: deleteObject,
          createPoster: createVideoPosterBlob,
          onTask: (task) => { communityUploadTaskRef.current = task; },
          onProgress: (progress) => setCommunityUpload({ stage: 'uploading', progress, error: '' }),
        });
        setCommunityUpload({ stage: 'uploaded', progress: 100, error: '' });
      } catch (error) {
        const cancelled = error?.code === 'storage/canceled';
        setCommunityUpload({
          stage: cancelled ? 'cancelled' : 'failed',
          progress: 0,
          error: cancelled ? 'Upload cancelled.' : 'Upload failed. Check the file format, size, and connection.',
        });
        setStatus(cancelled ? 'Media upload cancelled.' : 'Media upload failed. You can retry without selecting the file again.');
        return;
      } finally {
        communityUploadTaskRef.current = null;
      }
    }
    const payload = buildCommunityPostPayload({
      text,
      media: uploadedMedia,
      profile: communityProfile,
      initials: communityAvatarInitials,
      difficulty: settings.practice.difficulty,
      isPremium: isSignovaProActive,
      user: authenticatedFirebaseUser,
      contentKind: communityComposerKind,
    });
    try {
      await addDoc(collection(firestoreDb, PUBLIC_COMMUNITY_POSTS_COLLECTION), payload);
    } catch {
      await cleanupCommunityMedia({ storage: firebaseStorage, media: uploadedMedia, makeRef: storageRef, remove: deleteObject });
      setStatus('Post was not published. Live database sync failed.');
      return;
    }
    if (communityComposerMedia?.url?.startsWith('blob:')) URL.revokeObjectURL(communityComposerMedia.url);
    setCommunityDraft('');
    setCommunityComposerMedia(null);
    setCommunityComposerKind('post');
    setCommunityComposerReview({ stage: 'idle', checks: [], suggestions: [], confirmed: false });
    setCommunityUpload({ stage: 'idle', progress: 0, error: '' });
    setStatus('Community post published live.');
  }

  async function addCommunityComposerMedia(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validation = await validateCommunityMediaFile(file);
    if (!validation.valid) {
      setStatus(validation.error);
      event.target.value = '';
      return;
    }
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setStatus('Please choose an image or video file for the community post.');
      event.target.value = '';
      return;
    }
    if (communityComposerKind === 'reel' && !isVideo) {
      setStatus('Reels require a vertical video file.');
      event.target.value = '';
      return;
    }
    if (communityComposerMedia?.url?.startsWith('blob:')) URL.revokeObjectURL(communityComposerMedia.url);
    const media = {
      name: file.name,
      type: isVideo ? 'video' : 'image',
      url: URL.createObjectURL(file),
      file,
    };
    setCommunityComposerMedia(media);
    setCommunityUpload({ stage: 'idle', progress: 0, error: '' });
    setCommunityComposerReview({ stage: 'analyzing', checks: [], suggestions: [], confirmed: false });
    const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'this sign';
    const generatedCaption = `Practising ${baseName}. Watch the handshape, movement, and expression, then share constructive feedback. #SignLanguage #Signova`;
    if (!communityDraft.trim()) setCommunityDraft(generatedCaption);
    try {
      const quality = isVideo
        ? (await inspectCommunityVideo(file)).quality
        : await inspectCommunityImage(file);
      const sizeCheck = {
        label: `${(file.size / (1024 * 1024)).toFixed(1)} MB file size`,
        pass: file.size <= (isVideo ? 50 : 12) * 1024 * 1024,
      };
      const checks = [sizeCheck, ...quality.checks];
      const suggestions = checks.filter((check) => !check.pass).map((check) => (
        check.label.includes('dark') ? 'Use front lighting so both hands remain visible.'
          : check.label.includes('resolution') ? 'Record at 720p or higher and keep the upper body in frame.'
            : check.label.includes('duration') ? 'Trim the demonstration to 15 seconds or less.'
              : check.label.includes('contrast') ? 'Use a plain background that contrasts with skin and clothing.'
                : `Improve: ${check.label}.`
      ));
      setCommunityComposerReview({ stage: 'ready', checks, suggestions, confirmed: false });
      setStatus('Media inspected and an editable caption was generated.');
    } catch {
      setCommunityComposerReview({
        stage: 'ready',
        checks: [{ label: 'Media could not be inspected', pass: false }],
        suggestions: ['Choose a supported image, MP4, or WebM file.'],
        confirmed: false,
      });
      setStatus('Media attached, but verification needs your review.');
    }
    event.target.value = '';
  }

  function cancelCommunityUpload() {
    communityUploadTaskRef.current?.cancel?.();
  }

  async function toggleCommunityPostLike(postId) {
    if (!firestoreDb || !authenticatedFirebaseUser?.uid || !authenticatedFirebaseUser.emailVerified) {
      setStatus('Sign in with a verified account to record a like.');
      return;
    }
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
    try {
      const result = await fetchJson('/api/community/posts/action', {
        method: 'POST',
        body: JSON.stringify({ postId, action: 'toggle-like' }),
      });
      setCommunityPosts((posts) => posts.map((post) => post.id === postId
        ? { ...post, liked: result.liked, stats: { ...post.stats, likes: Number(result.likes || 0) } }
        : post));
    } catch {
      setCommunityLikedPostIds(communityLikedPostIds);
      setCommunityPosts((posts) => posts.map((post) => post.id === postId ? targetPost : post));
      setStatus('Like was not recorded. Live database sync failed.');
    }
  }

  async function showCommunityPostLikes(postId) {
    if (communityLikeDetails.postId === postId) {
      setCommunityLikeDetails({ postId: '', loading: false, likes: [] });
      return;
    }
    setCommunityLikeDetails({ postId, loading: true, likes: [] });
    try {
      const data = await fetchJson(`/api/community/posts/likes?postId=${encodeURIComponent(postId)}`);
      setCommunityLikeDetails({ postId, loading: false, likes: data.likes || [] });
    } catch {
      setCommunityLikeDetails({ postId, loading: false, likes: [] });
      setStatus('Could not load live like records.');
    }
  }

  async function shareCommunityPost(postId) {
    if (!authenticatedFirebaseUser?.uid || !authenticatedFirebaseUser.emailVerified) {
      setStatus('Sign in with a verified account to record a share.');
      return;
    }
    try {
      const result = await fetchJson('/api/community/posts/action', {
        method: 'POST',
        body: JSON.stringify({ postId, action: 'share' }),
      });
      setCommunityPosts((posts) => posts.map((post) => post.id === postId
        ? { ...post, stats: { ...post.stats, shares: Number(result.shares || 0) } }
        : post));
      setStatus('Share recorded live.');
    } catch {
      setStatus('Share was not recorded. Live database sync failed.');
    }
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

  async function deleteCommunityPost(post) {
    if (!authenticatedFirebaseUser?.uid || post.authorUid !== authenticatedFirebaseUser.uid) {
      setStatus('Only the creator can delete this post.');
      return;
    }
    setCommunityPostMenu({ postId: '', reportOpen: false });
    setStatus('Deleting post…');
    try {
      await deleteDoc(doc(firestoreDb, PUBLIC_COMMUNITY_POSTS_COLLECTION, post.id));
      await cleanupCommunityMedia({ storage: firebaseStorage, media: { path: post.mediaPath, thumbnailPath: post.thumbnailPath }, makeRef: storageRef, remove: deleteObject });
      setCommunityPosts((posts) => posts.filter((item) => item.id !== post.id));
      setStatus('Post and uploaded media deleted.');
    } catch {
      setStatus('Post could not be deleted. Please try again.');
    }
  }

  async function handleCommunityPostReport(post, action) {
    if (action.startsWith('report-')) {
      const category = action.replace('report-', '');
      try {
        await fetchJson('/api/community/posts/report', {
          method: 'POST',
          body: JSON.stringify({
            postId: post.id,
            category,
            reason: `User reported this community post for ${category}.`,
          }),
        });
        setCommunityHiddenPostIds((ids) => [...new Set([...ids, post.id])]);
        setCommunityPostMenu({ postId: '', reportOpen: false });
        setStatus('Report sent for moderation and the post was hidden.');
      } catch {
        setStatus('Report could not be submitted. Please try again.');
      }
      return;
    }
    if (action === 'remove' || action === 'not-interested') {
      setCommunityHiddenPostIds((ids) => [...new Set([...ids, post.id])]);
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

  function deleteSingleCallLog(callId) {
    setCallHistory((items) => items.filter((item) => item.id !== callId));
    setStatus('Call record removed.');
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

  function updateCameraProcessingSetting(enabled) {
    updateSetting('privacy', 'cameraProcessing', enabled);
    if (!enabled && streamRef.current) stopCamera();
  }

  useEffect(() => {
    if (!persistenceReady) return;
    const workspaceRecord = buildSettingsWorkspaceRecord(settings, MIN_ACCEPT_CONFIDENCE);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(SIGNOVA_SETTINGS_STORAGE_KEY, JSON.stringify({ version: 2, settings: workspaceRecord.settings }));
      } catch {
        // Local backup is best-effort; database persistence below remains authoritative.
      }
    }
    saveUserDoc('userPreferences', workspaceRecord).catch(() => {
      setStatus('Settings are active for this session but could not be persisted');
    });
  }, [persistenceReady, settings]);

  useEffect(() => {
    let cancelled = false;
    if (!profileSharingEnabled) {
      setProfileQrDataUrl('');
      setProfileQrOpen(false);
      setProfileQrMessage('QR profile sharing is off.');
      return undefined;
    }
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
  }, [premiumDarkMode, profileQrPayload, profileSharingEnabled]);

  async function copyProfileShareLink() {
    if (!mayShareProfile(settings.privacy)) {
      setProfileQrMessage('Enable QR profile sharing in Privacy settings first.');
      return;
    }
    try {
      await navigator.clipboard?.writeText(profileShareUrl);
      setProfileQrMessage('Profile link copied.');
      setStatus('Profile link copied.');
    } catch {
      setProfileQrMessage('Copy unavailable. Select and copy the link manually.');
    }
  }

  async function shareProfileQr() {
    if (!mayShareProfile(settings.privacy)) {
      setProfileQrMessage('Enable QR profile sharing in Privacy settings first.');
      return;
    }
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
    if (!mayShareProfile(settings.privacy) || !profileQrDataUrl) return;
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

  async function handleProfilePhotoUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!authenticatedFirebaseUser?.uid || !authenticatedFirebaseUser.emailVerified || !firebaseStorage || !firestoreDb) {
      setStatus('Verified Firebase login is required to upload a profile photo');
      return;
    }
    try {
      setStatus('Uploading profile photo…');
      const uploadedPhoto = await uploadDurableProfilePhoto({
        file,
        ownerUid: authenticatedFirebaseUser.uid,
        previousPath: settings.account.profilePhotoPath,
        storage: firebaseStorage,
        firestore: firestoreDb,
      });
      setSettings((current) => ({
        ...current,
        account: { ...current.account, profilePhoto: uploadedPhoto.profilePhotoUrl, profilePhotoPath: uploadedPhoto.profilePhotoPath },
      }));
      setStatus('Profile photo uploaded');
    } catch (error) {
      setStatus(`Profile photo upload failed: ${error?.message || 'try again'}`);
    }
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
      document.documentElement.classList.toggle('premiumDarkMode', shouldUseDark);
      document.body.classList.toggle('premiumDarkMode', shouldUseDark);
      document.documentElement.style.colorScheme = shouldUseDark ? 'dark' : 'light';
      document.body.style.colorScheme = shouldUseDark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', shouldUseDark ? '#090b0f' : '#f4f6fa');
    };
    applyTheme();
    mediaQuery?.addEventListener?.('change', applyTheme);
    return () => {
      mediaQuery?.removeEventListener?.('change', applyTheme);
    };
  }, [settings.display.theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(DISPLAY_THEME_STORAGE_KEY, settings.display.theme || 'system');
    } catch {
      // The current session can still apply its theme if browser storage is unavailable.
    }
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

  async function clearSignovaData() {
    const deletionTargets = buildHistoryDeletionTargets(callHistory);
    setHistory([]);
    setSavedLearningItems([]);
    setMessages((items) => {
      attachmentUrlRegistryRef.current.releaseMessages(items);
      return [];
    });
    setCallHistory([]);
    clearSentence();
    setCaption('Waiting for signs');
    const results = await Promise.allSettled(
      deletionTargets.map((target) => deleteUserDoc(target.collection, target.id)),
    );
    const failed = results.filter((result) => result.status === 'rejected').length;
    setStatus(failed ? 'History cleared on this screen; some persisted records could not be removed' : 'Translation, chat, and call history cleared');
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
      settings: 'signovaSettingsPage',
    };
    Object.entries(pageClasses).forEach(([panel, className]) => {
      root.classList.toggle(className, activePanel === panel);
      body.classList.toggle(className, activePanel === panel);
    });
    const isProfilePage = ['profile', 'publicProfile', 'signovaPro'].includes(activePanel);
    root.classList.toggle('signovaProfilePage', isProfilePage);
    body.classList.toggle('signovaProfilePage', isProfilePage);
    return () => {
      Object.values(pageClasses).forEach((className) => {
        root.classList.remove(className);
        body.classList.remove(className);
      });
      root.classList.remove('signovaProfilePage');
      body.classList.remove('signovaProfilePage');
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
  }, [callExperience, chatCallScreen, setCallElapsedSeconds]);

  if (isMobileBlocked) {
    return <MobileNotSupportedView onProceedAnyway={proceedAnyway} />;
  }

  if (authStage !== 'app') {
    return (
      <main className={`signovaAuthShell ${premiumDarkMode ? 'premiumDarkMode' : ''} ${authStage === 'opening' ? 'signovaAuthOpening' : ''}`} aria-label="Signova authentication">
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
                    <span><Attach3DIcon type="lock" /><b>Firebase Authentication</b><small>Account access uses verified Firebase sessions</small></span>
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
                    <small>Enter the email address used by your Firebase account. We will request a password reset email.</small>
                  </header>
                  <form className="signovaAuthForm" onSubmit={sendAuthRecovery}>
                    <label>
                      <span>Account Identity</span>
                      <input type="email" value={authForm.email} onChange={(event) => setAuthForm((form) => ({ ...form, email: event.target.value }))} placeholder="Enter your account email" autoComplete="email" />
                    </label>
                    <div className="signovaRecoveryMethods">
                      {AUTH_RECOVERY_METHODS.map((method) => (
                        <span key={method.id} aria-disabled={!method.available} className={method.available ? '' : 'unavailableRecoveryMethod'}>
                          <Attach3DIcon type={method.icon} />{method.label}
                        </span>
                      ))}
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
        {authStage === 'checking' && <DelayedStartupSkeleton delay={400} />}
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

  const serviceNotificationInfo = (() => {
    if ((apiConnection.status !== 'offline' && !apiRecovery.active) || serviceBannerDismissed) {
      return null;
    }
    const rawMsg = String(apiRecovery?.message || apiConnection?.detail || '').trim();
    const isAuth = /invalid authentication token|authentication is required|unauthorized|auth token|token/i.test(rawMsg);
    const isColdStart = /503|504|timeout|cold start|timed out/i.test(rawMsg);
    const isNetwork = /network|offline|failed to fetch|unreachable/i.test(rawMsg);
    const isCamera = /camera|media|permission|device/i.test(rawMsg);
    const isInternalService = /internal service error/i.test(rawMsg);

    if (isAuth) {
      return {
        type: 'auth',
        badge: 'Account',
        title: 'Sign In Required',
        description: 'Please sign in or refresh your account session to use cloud features.',
        actionLabel: 'Sign In',
      };
    }
    if (isInternalService) {
      return {
        type: 'general',
        badge: 'AI Notice',
        title: 'Sign Translation Standby',
        description: 'AI translation model is in standby. Real-time calls and chats are fully operational.',
        actionLabel: 'Got It',
      };
    }
    if (isColdStart) {
      return {
        type: 'coldStart',
        badge: 'Cloud Sync',
        title: 'Cloud Service Waking Up',
        description: 'The cloud backend is initializing. Please hold on a few moments.',
        actionLabel: 'Retry Now',
      };
    }
    if (isCamera) {
      return {
        type: 'camera',
        badge: 'Camera',
        title: 'Camera Permission Needed',
        description: rawMsg || 'Please allow camera access in your browser to detect hand signs.',
        actionLabel: 'Allow Access',
      };
    }
    if (isNetwork) {
      return {
        type: 'network',
        badge: 'Connection',
        title: 'Connection Disrupted',
        description: 'Unable to reach Signova servers. Please check your internet connection.',
        actionLabel: 'Retry Connection',
      };
    }
    return {
      type: 'general',
      badge: 'Notice',
      title: apiConnection.status === 'offline' ? 'Services Reconnecting' : 'Translation Notice',
      description: rawMsg.length > 90 ? 'Service temporarily unavailable. Retrying...' : (rawMsg || 'The service could not be reached.'),
      actionLabel: 'Retry',
    };
  })();

  async function handleServiceBannerAction(bannerType) {
    if (bannerType === 'auth') {
      try {
        if (typeof firebaseAuth?.currentUser?.getIdToken === 'function') {
          await firebaseAuth.currentUser.getIdToken(true);
          retryServiceConnection();
          return;
        }
      } catch {
        // fallback
      }
      setActiveSettingsSection('account');
      openPanel('settings');
      return;
    }
    if (bannerType === 'camera') {
      startCamera(null, true);
      return;
    }
    if (bannerType === 'general') {
      setServiceBannerDismissed(true);
      return;
    }
    retryServiceConnection();
  }

  return (
    <div
      className={`${premiumDarkMode ? 'messengerShell premiumDarkMode' : 'messengerShell'} ${isSignovaProActive ? 'signovaProMember' : ''} ${activePanel === 'chats' ? 'chatMode' : ''} ${activePanel === 'translate' ? 'conversationHistoryMode' : ''} ${activePanel === 'learn' ? 'learnMode' : ''} ${activePanel === 'library' ? 'libraryMode' : ''} ${activePanel === 'drive' ? 'progressMode' : ''} ${['profile', 'publicProfile', 'signovaPro'].includes(activePanel) ? 'profileMode' : ''} ${activePanel === 'settings' ? 'settingsMode' : ''} ${activePanel === 'contacts' ? 'contactsMode' : ''} ${['community', 'communityGroups', 'communityCreate'].includes(activePanel) ? 'communityMode' : ''} ${mobileChatListOpen ? 'mobileChatListOpen' : 'mobileChatRoomOpen'} ${settings.display.highContrast ? 'highContrastMode' : ''} ${settings.display.largeText ? 'largeTextMode' : ''} subtitle-${settings.display.subtitleSize}`}
      data-e2e-auth-uid={SIGNOVA_UI_TEST_ENABLED ? authenticatedFirebaseUser?.uid || '' : undefined}
      data-e2e-remote-tracks={SIGNOVA_UI_TEST_ENABLED ? remoteMediaTrackKinds.join(',') : undefined}
      data-e2e-chat-status={SIGNOVA_UI_TEST_ENABLED ? activeRealtimeChat.status : undefined}
      data-e2e-chat-error={SIGNOVA_UI_TEST_ENABLED ? activeRealtimeChat.error : undefined}
      style={{ '--chat-sidebar-width': `${chatSidebarWidth}px` }}
    >
      <video
        ref={offscreenVideoRef}
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: 640,
          height: 480,
          opacity: 0.01,
          pointerEvents: 'none',
          zIndex: -9999,
        }}
        autoPlay
        playsInline
        muted
        aria-hidden="true"
      />

      {serviceNotificationInfo && (
        <aside
          className={`serviceRecoveryBanner modernRecoveryToast ${serviceNotificationInfo.type}`}
          role="alert"
          aria-live="assertive"
        >
          <div className="recoveryToastIcon" aria-hidden="true">
            {serviceNotificationInfo.type === 'auth' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            ) : serviceNotificationInfo.type === 'coldStart' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>
              </svg>
            ) : serviceNotificationInfo.type === 'camera' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            ) : serviceNotificationInfo.type === 'network' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
                <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            )}
          </div>
          <div className="recoveryToastContent">
            <div className="recoveryToastHeading">
              <strong className="recoveryToastTitle">{serviceNotificationInfo.title}</strong>
              <span className="recoveryToastPill">{serviceNotificationInfo.badge}</span>
            </div>
            <small className="recoveryToastDesc">{serviceNotificationInfo.description}</small>
          </div>
          <div className="recoveryToastBtnGroup">
            <button
              type="button"
              className="recoveryToastMainBtn"
              onClick={() => handleServiceBannerAction(serviceNotificationInfo.type)}
            >
              {serviceNotificationInfo.actionLabel}
            </button>
            <button
              type="button"
              className="recoveryToastDismissBtn"
              aria-label="Dismiss notification"
              onClick={() => {
                setServiceBannerDismissed(true);
                setApiRecovery({ active: false, message: '' });
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </aside>
      )}
      {!persistenceReady && !networkOnline && <AppStartupSkeleton />}
      {incomingCall && (
        <section className="incomingSignovaCall" aria-label="Incoming Signova call" aria-live="assertive">
          <span className="incomingCallPulse" aria-hidden="true" />
          <div>
            <small>Incoming {incomingCall.mediaType === 'voice' ? 'voice' : 'video'} call</small>
            <strong>Verified Signova contact</strong>
          </div>
          <button type="button" className="rejectIncomingCall" onClick={rejectIncomingCall}>Decline</button>
          <button type="button" className="acceptIncomingCall" onClick={acceptIncomingCall} disabled={!incomingCall.offer}>Accept</button>
        </section>
      )}
    
      <AppNavigationRail
        activePanel={activePanel}
        accountAvatarInitials={accountAvatarInitials}
        encryptionStatus={encryptionStatus}
        engineName={ENGINE_NAME}
        fullIntro={fullIntroActive && typeof document !== 'undefined' ? createPortal(<SignovaOpeningAnimation activePanel={activePanel} />, document.body) : null}
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
          <ConversationHistorySidebar
            callHistorySearch={callHistorySearch}
            setCallHistorySearch={setCallHistorySearch}
            callHistoryFilter={callHistoryFilter}
            setCallHistoryFilter={setCallHistoryFilter}
            conversationHistoryContacts={conversationHistoryContacts}
            selectedConversationId={selectedConversationId}
            setSelectedConversationId={setSelectedConversationId}
            setMobileChatListOpen={setMobileChatListOpen}
          />
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
            const contactPresence = contact.firebaseUid
              ? presenceLabel(chatPresenceByUid[contact.firebaseUid], { showLastSeen: settings.privacy.showLastSeen })
              : null;
            const isOnline = contactPresence ? contactPresence.tone === 'online' : (contact.id === 'signova-ai' || activeCallLog?.contactId === contact.id);
            const isChatOpen = selectedChatId === contact.id;
            const isTyping = typingContactId === contact.id;
            const activityStatus = isTyping
              ? 'typing...'
              : activeCallLog?.contactId === contact.id
                ? 'in call'
                : isOnline
                  ? (contact.id === 'signova-ai' ? '' : 'online')
                  : (contactPresence?.detail && !contactPresence.detail.includes('presence') && settings.privacy.showLastSeen
                    ? contactPresence.detail
                    : '');
            const messageCount = isChatOpen ? 0 : (Number(flags.unreadCount) || (flags.unread ? 1 : 0));
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
                    unreadCount: 0,
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
                  {!isChatOpen && activityStatus ? (
                    <>
                      {(contact.showUsername !== false || contact.showNumber) ? <i aria-hidden="true">·</i> : null}
                      <span className="headerActivityTicker" aria-label={activityStatus}>
                        <em>{activityStatus}</em>
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
        />
      </aside>

      <main className={chatCallScreen && !chatCallMinimized ? 'conversationPane callWorkspaceActive' : 'conversationPane'}>
        {activePanel === 'translate' ? (
          <ConversationInfoView
            selectedConversation={selectedConversation}
            activeCallLog={activeCallLog}
            setMobileChatListOpen={setMobileChatListOpen}
            startConversationInfoCall={startConversationInfoCall}
            conversationInfoMenuOpen={conversationInfoMenuOpen}
            setConversationInfoMenuOpen={setConversationInfoMenuOpen}
            setConversationCategoryOpen={setConversationCategoryOpen}
            conversationCategoryOpen={conversationCategoryOpen}
            conversationCategory={conversationCategory}
            setConversationCategory={setConversationCategory}
            setSelectedChatId={setSelectedChatId}
            setActivePanel={setActivePanel}
            clearConversationHistory={clearConversationHistory}
            clearHistoryConfirmId={clearHistoryConfirmId}
            selectedConversationCalls={selectedConversationCalls}
            visibleConversationCalls={visibleConversationCalls}
            deleteSingleCallLog={deleteSingleCallLog}
          />
        ) : (
          <ChatView
            activePanel={activePanel}
            selectedChatContact={selectedChatContact}
            setMobileChatListOpen={setMobileChatListOpen}
            setContactInfoOpen={setContactInfoOpen}
            selectedChatPresence={selectedChatPresence}
            status={status}
            selectedHeaderActivity={selectedHeaderActivity}
            activeCallLog={activeCallLog}
            callExperience={callExperience}
            callStatus={callStatus}
            startVideoSignChat={startVideoSignChat}
            startVoiceSignChat={startVoiceSignChat}
            setMessageSearchOpen={setMessageSearchOpen}
            messageSearchOpen={messageSearchOpen}
            messageSearch={messageSearch}
            setMessageSearch={setMessageSearch}
            toggleHeaderMenu={toggleHeaderMenu}
            chatHeaderMenuOpen={chatHeaderMenuOpen}
            setChatHeaderMenuOpen={setChatHeaderMenuOpen}
            selectedChatFlags={selectedChatFlags}
            handleHeaderChatAction={handleHeaderChatAction}
            chatCallScreen={chatCallScreen}
            chatCallMinimized={chatCallMinimized}
            chatCallExpanded={chatCallExpanded}
            chatCallInfoOpen={chatCallInfoOpen}
            chatCallPosition={chatCallPosition}
            startChatCallMove={startChatCallMove}
            formatCallTimer={formatCallTimer}
            callElapsedSeconds={callElapsedSeconds}
            callNetworkQuality={callNetworkQuality}
            setChatCallInfoOpen={setChatCallInfoOpen}
            desktopCallWindowMode={desktopCallWindowMode}
            setChatCallPosition={setChatCallPosition}
            setChatCallMinimized={setChatCallMinimized}
            setChatCallExpanded={setChatCallExpanded}
            setChatCallMoreOpen={setChatCallMoreOpen}
            setChatCallHistoryOpen={setChatCallHistoryOpen}
            endCallSession={endCallSession}
            cameraEnabled={cameraEnabled}
            streamRef={streamRef}
            accountAvatarInitials={accountAvatarInitials}
            remoteMediaState={remoteMediaState}
            remoteCaption={remoteCaption}
            liveSign={liveSign}
            activeCallLanguage={activeCallLanguage}
            currentSignReference={currentSignReference}
            activeCallBook={activeCallBook}
            captionChannelStatus={captionChannelStatus}
            callControlsVisible={callControlsVisible}
            chatCallMoreOpen={chatCallMoreOpen}
            setChatCallFocus={setChatCallFocus}
            switchToVideoSignChat={switchToVideoSignChat}
            chatCallFocus={chatCallFocus}
            callVideoFilterStyle={callVideoFilterStyle}
            settings={settings}
            attachLocalTrackingVideo={attachLocalTrackingVideo}
            canvasRef={canvasRef}
            revealCallControls={revealCallControls}
            toggleCallTranslation={toggleCallTranslation}
            synapseEnabled={synapseEnabled}
            handleCameraControlClick={handleCameraControlClick}
            flipCameraFacingMode={flipCameraFacingMode}
            toggleMicTrack={toggleMicTrack}
            micEnabled={micEnabled}
            premiumDarkMode={premiumDarkMode}
            chatCallSettingsTab={chatCallSettingsTab}
            setChatCallSettingsTab={setChatCallSettingsTab}
            changeTranslationLanguage={changeTranslationLanguage}
            updateSetting={updateSetting}
            voiceEnabled={voiceEnabled}
            setVoiceEnabled={setVoiceEnabled}
            chatCallHistoryOpen={chatCallHistoryOpen}
            callTranscript={callTranscript}
            formatConfidence={formatConfidence}
            callConfidencePercent={callConfidencePercent}
            TEMPORAL_BUFFER_SIZE={TEMPORAL_BUFFER_SIZE}
            currentSignNumber={currentSignNumber}
            callVocabularySize={callVocabularySize}
            currentSignModel={currentSignModel}
            callSignTelemetry={callSignTelemetry}
            callQualityState={callQualityState}
            cameraQuality={cameraQuality}
            captionChannelRef={captionChannelRef}
            startWebRtcPreview={startWebRtcPreview}
            unlockSelectedChat={unlockSelectedChat}
            visibleChatMessages={visibleChatMessages}
            selectedMessageIds={selectedMessageIds}
            canModifyMessage={canModifyMessage}
            reactionMessageId={reactionMessageId}
            toolMessageId={toolMessageId}
            emojiPickerMessageId={emojiPickerMessageId}
            handleMessageClick={handleMessageClick}
            openReactionWindow={openReactionWindow}
            openToolWindow={openToolWindow}
            editSharedContact={editSharedContact}
            addSharedContact={addSharedContact}
            voteAudiencePoll={voteAudiencePoll}
            editMeetMoment={editMeetMoment}
            saveMeetDetail={saveMeetDetail}
            audioPlaybackRates={audioPlaybackRates}
            updateAudioPlaybackRate={updateAudioPlaybackRate}
            cancelDirectAttachmentUpload={cancelDirectAttachmentUpload}
            messageReceiptLabel={messageReceiptLabel}
            MESSAGE_QUICK_REACTIONS={MESSAGE_QUICK_REACTIONS}
            reactFromWindow={reactFromWindow}
            setStatus={setStatus}
            setEmojiPickerMessageId={setEmojiPickerMessageId}
            MESSAGE_EMOJI_REACTIONS={MESSAGE_EMOJI_REACTIONS}
            runMessageTool={runMessageTool}
            copyMessage={copyMessage}
            forwardMessage={forwardMessage}
            toggleSelectMessage={toggleSelectMessage}
            setMessageTranslateMenu={setMessageTranslateMenu}
            toggleMessageFlag={toggleMessageFlag}
            setMessageInfoId={setMessageInfoId}
            messageInfoId={messageInfoId}
            retryMessage={retryMessage}
            editMessage={editMessage}
            unsendMessage={unsendMessage}
            markMessageDeleted={markMessageDeleted}
            messageTranslateMenu={messageTranslateMenu}
            translateMessage={translateMessage}
            composerSending={composerSending}
            sendChatMessage={sendChatMessage}
            scheduleComposerOpen={scheduleComposerOpen}
            scheduleForm={scheduleForm}
            setScheduleForm={setScheduleForm}
            scheduleDraftMessage={scheduleDraftMessage}
            setScheduleComposerOpen={setScheduleComposerOpen}
            chatDraft={chatDraft}
            composerPickerOpen={composerPickerOpen}
            composerPickerTab={composerPickerTab}
            setComposerPickerTab={setComposerPickerTab}
            selectComposerEmoji={selectComposerEmoji}
            useTranslationAsMessage={useTranslationAsMessage}
            sentence={sentence}
            caption={caption}
            signLibrary={signLibrary}
            selectComposerSign={selectComposerSign}
            selectComposerSticker={selectComposerSticker}
            attachMenuOpen={attachMenuOpen}
            setAttachMenuOpen={setAttachMenuOpen}
            attachmentInputRef={attachmentInputRef}
            attachmentAccept={attachmentAccept}
            handleDriveUpload={handleDriveUpload}
            handleAttachmentAction={handleAttachmentAction}
            setComposerPickerOpen={setComposerPickerOpen}
            voiceNote={voiceNote}
            toggleVoicePause={toggleVoicePause}
            startVoiceNote={startVoiceNote}
            formatVoiceTime={formatVoiceTime}
            addVoiceNote={addVoiceNote}
            deleteVoiceNote={deleteVoiceNote}
            setChatDraft={setChatDraft}
            startSendLongPress={startSendLongPress}
            stopSendLongPress={stopSendLongPress}
            handleSendIconClick={handleSendIconClick}
            attachRemoteCallVideo={attachRemoteCallVideo}
            setChatCallScreen={setChatCallScreen}
            openPanel={openPanel}
          />
        )}
      </main>

      {activePanel !== 'chats' && activePanel !== 'translate' && (
      <aside ref={signToolsPaneRef} className="signToolsPane">
        {activePanel === 'drive' && <ProgressScrollRail targetRef={signToolsPaneRef} />}
        <div className="workRail">
          <ProfileView
            activePanel={activePanel}
            setActivePanel={setActivePanel}
            openPanel={openPanel}
            communityProfile={communityProfile}
            communityAvatarInitials={communityAvatarInitials}
            ownCommunityPosts={ownCommunityPosts}
            communityIdentityEditing={communityIdentityEditing}
            setCommunityIdentityEditing={setCommunityIdentityEditing}
            updateAvatarSetting={updateAvatarSetting}
            normalizeUsername={normalizeUsername}
            saveAvatarCustomization={saveAvatarCustomization}
            communityPublicProfileTab={communityPublicProfileTab}
            setCommunityPublicProfileTab={setCommunityPublicProfileTab}
            publicProfilePosts={publicProfilePosts}
            settings={settings}
            isSignovaProActive={isSignovaProActive}
            accountAvatarInitials={accountAvatarInitials}
            handleProfilePhotoUpload={handleProfilePhotoUpload}
            signovaProBadgeLabel={signovaProBadgeLabel}
            profileCompletion={profileCompletion}
            signovaProDaysLeft={signovaProDaysLeft}
            updateSetting={updateSetting}
            profileQrOpen={profileQrOpen}
            setProfileQrOpen={setProfileQrOpen}
            profileQrDataUrl={profileQrDataUrl}
            copyProfileShareLink={copyProfileShareLink}
            shareProfileQr={shareProfileQr}
            downloadProfileQr={downloadProfileQr}
            profileQrScanInputRef={profileQrScanInputRef}
            scanProfileQrImage={scanProfileQrImage}
            profileQrManualValue={profileQrManualValue}
            setProfileQrManualValue={setProfileQrManualValue}
            openScannedProfile={openScannedProfile}
            profileQrMessage={profileQrMessage}
            profileStats={profileStats}
          />

          {activePanel === 'translate' && (
            <TranslateToolsPanel
              synapseEnabled={synapseEnabled}
              updateSynapseEnabled={updateSynapseEnabled}
              liveSign={liveSign}
              learningFeedback={learningFeedback}
              temporalBufferSize={TEMPORAL_BUFFER_SIZE}
              formatConfidence={formatConfidence}
              sentence={sentence}
              copySentence={copySentence}
              clearSentence={clearSentence}
              latestHistory={latestHistory}
            />
          )}

          <LibraryView
            activePanel={activePanel}
            signToolsPaneRef={signToolsPaneRef}
            signSearch={signSearch}
            setSignSearch={setSignSearch}
            filteredSigns={filteredSigns}
            libraryBooks={libraryBooks}
            openLearningBook={openLearningBook}
            openLibraryBook={openLibraryBook}
            openLibraryBookId={openLibraryBookId}
            setActivePanel={setActivePanel}
            currentLibraryBookPage={currentLibraryBookPage}
            nextLibraryBookPage={nextLibraryBookPage}
            libraryBookView={libraryBookView}
            setLibraryBookView={setLibraryBookView}
            closeLearningBook={closeLearningBook}
            libraryOpeningBookId={libraryOpeningBookId}
            libraryPageFlip={libraryPageFlip}
            turnLibraryPage={turnLibraryPage}
            libraryReaderRef={libraryReaderRef}
            libraryReaderPage={libraryReaderPage}
            playPageFlipSound={playPageFlipSound}
            speak={speak}
          />

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
                onSpeak={(text, language) => speak(text, language || settings.account.preferredLanguage)}
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
            <ProgressDashboardView
              activePanel={activePanel}
              appProgressStats={appProgressStats}
              selectedProgressMetric={selectedProgressMetric}
              setSelectedProgressMetric={setSelectedProgressMetric}
              formatPracticeTime={formatPracticeTime}
              formatConfidence={formatConfidence}
              driveItems={driveItems}
              progressSkillMetrics={progressSkillMetrics}
              progressRadarPoints={progressRadarPoints}
              radarPolygonPoints={radarPolygonPoints}
              progressAchievements={progressAchievements}
              showAllAchievements={showAllAchievements}
              setShowAllAchievements={setShowAllAchievements}
              setStatus={setStatus}
            />
          )}

          <ContactsView
            activePanel={activePanel}
            contactForm={contactForm}
            setContactForm={setContactForm}
            addContact={addContact}
            contactFormError={contactFormError}
          />

          <CommunityCreateSignView
            activePanel={activePanel}
            createCommunitySign={createCommunitySign}
            communitySignPipelineStep={communitySignPipelineStep}
            communitySignPipeline={communitySignPipeline}
            setActivePanel={setActivePanel}
            communitySignPipelineProgress={communitySignPipelineProgress}
            communitySignPipelineUnlocked={communitySignPipelineUnlocked}
            setCommunitySignPipelineStep={setCommunitySignPipelineStep}
            communitySignForm={communitySignForm}
            setCommunitySignForm={setCommunitySignForm}
            advanceCommunitySignPipeline={advanceCommunitySignPipeline}
            openCommunityCapture={openCommunityCapture}
            handleCommunitySignMedia={handleCommunitySignMedia}
            communityCaptureError={communityCaptureError}
            communityCaptureOpen={communityCaptureOpen}
            communityCaptureMode={communityCaptureMode}
            stopCommunityCapture={stopCommunityCapture}
            communityCaptureVideoRef={communityCaptureVideoRef}
            communityCaptureRecording={communityCaptureRecording}
            communityCaptureSeconds={communityCaptureSeconds}
            stopCommunityVideoRecording={stopCommunityVideoRecording}
            recordCommunityVideo={recordCommunityVideo}
            captureCommunityPhoto={captureCommunityPhoto}
            communityMediaQuality={communityMediaQuality}
            communityProfile={communityProfile}
            communitySignDraftSaved={communitySignDraftSaved}
            saveCommunitySignDraft={saveCommunitySignDraft}
          />
        
         {activePanel === 'community' && (
  <CommunityView
    communityNotificationsOpen={communityNotificationsOpen}
    setCommunityNotificationsOpen={setCommunityNotificationsOpen}
    communityNotifications={communityNotifications}
    setDismissedCommunityNotificationIds={setDismissedCommunityNotificationIds}
    setActivePanel={setActivePanel}
    communityProfile={communityProfile}
    isSignovaProActive={isSignovaProActive}
    communityAvatarOpen={communityAvatarOpen}
    setCommunityAvatarOpen={setCommunityAvatarOpen}
    communityAvatarInitials={communityAvatarInitials}
    signovaProBadgeLabel={signovaProBadgeLabel}
    communityIdentityEditing={communityIdentityEditing}
    setCommunityIdentityEditing={setCommunityIdentityEditing}
    updateAvatarSetting={updateAvatarSetting}
    normalizeUsername={normalizeUsername}
    SIGNOVA_AVATAR_ASSETS={SIGNOVA_AVATAR_ASSETS}
    applyCommunityAvatarPreset={applyCommunityAvatarPreset}
    generateCommunityAvatarFromAssets={generateCommunityAvatarFromAssets}
    saveAvatarCustomization={saveAvatarCustomization}
    deleteAvatarCustomization={deleteAvatarCustomization}
    undoAvatarCustomization={undoAvatarCustomization}
    avatarUndoStack={avatarUndoStack}
    redoAvatarCustomization={redoAvatarCustomization}
    avatarRedoStack={avatarRedoStack}
    communityFeedTabsRef={communityFeedTabsRef}
    communityFeedFilter={communityFeedFilter}
    setCommunityFeedFilter={setCommunityFeedFilter}
    visibleCommunityPosts={visibleCommunityPosts}
    toggleCommunityCreatorFollow={toggleCommunityCreatorFollow}
    communityPostMenu={communityPostMenu}
    setCommunityPostMenu={setCommunityPostMenu}
    downloadCommunityPost={downloadCommunityPost}
    authenticatedFirebaseUser={authenticatedFirebaseUser}
    deleteCommunityPost={deleteCommunityPost}
    handleCommunityPostReport={handleCommunityPostReport}
    setStatus={setStatus}
    toggleCommunityPostLike={toggleCommunityPostLike}
    showCommunityPostLikes={showCommunityPostLikes}
    openCommunityPostComments={openCommunityPostComments}
    shareCommunityPost={shareCommunityPost}
    communityLikeDetails={communityLikeDetails}
    communityComposerMedia={communityComposerMedia}
    communityComposerReview={communityComposerReview}
    setCommunityComposerReview={setCommunityComposerReview}
    communityDraft={communityDraft}
    setCommunityDraft={setCommunityDraft}
    communityUpload={communityUpload}
    cancelCommunityUpload={cancelCommunityUpload}
    publishCommunityPost={publishCommunityPost}
    communityComposerKind={communityComposerKind}
    setCommunityComposerKind={setCommunityComposerKind}
    communityComposerFileInputRef={communityComposerFileInputRef}
    addCommunityComposerMedia={addCommunityComposerMedia}
    topContributors={topContributors}
    trendingSigns={trendingSigns}
    setCommunityComposerMedia={setCommunityComposerMedia}
  />
)}
          {activePanel === 'communityGroups' && (
            <CommunityGroupsView
              communityGroupSearch={communityGroupSearch}
              setCommunityGroupSearch={setCommunityGroupSearch}
              communityGroupCategory={communityGroupCategory}
              setCommunityGroupCategory={setCommunityGroupCategory}
              communityGroupCategoryOptions={communityGroupCategoryOptions}
              communityGroupCategoryComposerOpen={communityGroupCategoryComposerOpen}
              setCommunityGroupCategoryComposerOpen={setCommunityGroupCategoryComposerOpen}
              communityGroupCategoryDraft={communityGroupCategoryDraft}
              setCommunityGroupCategoryDraft={setCommunityGroupCategoryDraft}
              createCommunityGroupCategory={createCommunityGroupCategory}
              visibleCommunityGroups={visibleCommunityGroups}
              selectedCommunityGroup={selectedCommunityGroup}
              setSelectedCommunityGroupId={setSelectedCommunityGroupId}
              setCommunityGroupToolOpen={setCommunityGroupToolOpen}
              setCommunityGroupProfileOpen={setCommunityGroupProfileOpen}
              setGroupCreationContext={setGroupCreationContext}
              setGroupModalOpen={setGroupModalOpen}
              handleCommunityGroupChatAction={handleCommunityGroupChatAction}
              communityGroupPosts={communityGroupPosts}
              communityGroupToolOpen={communityGroupToolOpen}
              startMeetingMode={startMeetingMode}
              setStatus={setStatus}
              communityGroupDraft={communityGroupDraft}
              setCommunityGroupDraft={setCommunityGroupDraft}
              communityGroupEmojiOpen={communityGroupEmojiOpen}
              setCommunityGroupEmojiOpen={setCommunityGroupEmojiOpen}
              COMPOSER_EMOJIS={COMPOSER_EMOJIS}
              postCommunityGroupNote={postCommunityGroupNote}
              communityGroupVoice={communityGroupVoice}
              toggleCommunityGroupVoice={toggleCommunityGroupVoice}
              formatVoiceTime={formatVoiceTime}
              communityGroupProfileOpen={communityGroupProfileOpen}
            />
          )}

        {activePanel === 'settings' && (
  <SettingsView
    activeSettingsSection={activeSettingsSection}
    setActiveSettingsSection={setActiveSettingsSection}
    activeSettingsMeta={activeSettingsMeta}
    settingsSearch={settingsSearch}
    setSettingsSearch={setSettingsSearch}
    groupedSettingsSections={groupedSettingsSections}
    filteredSettingsSections={filteredSettingsSections}
    settings={settings}
    updateSetting={updateSetting}
    updateSettingAndTrack={updateSettingAndTrack}
    sendAccountPasswordReset={sendAccountPasswordReset}
    saveAccountSettings={saveAccountSettings}
    addAnotherAccount={addAnotherAccount}
    handleSignovaLogout={handleSignovaLogout}
    accountSettingsMessage={accountSettingsMessage}
    cameraEnabled={cameraEnabled}
    toggleCameraTrack={toggleCameraTrack}
    micEnabled={micEnabled}
    toggleMicTrack={toggleMicTrack}
    openPanel={openPanel}
    exportSignovaData={exportSignovaData}
    clearSignovaData={clearSignovaData}
    apiConnection={apiConnection}
    signApiStatus={signApiStatus}
    PERFORMANCE_PROFILES={PERFORMANCE_PROFILES}
    activeModelMetrics={activeModelMetrics}
    aiMetrics={aiMetrics}
    isFirebaseReady={isFirebaseReady}
    conversationE2EE={conversationE2EE}
    authenticatedFirebaseUser={authenticatedFirebaseUser}
    AUTH_SECURITY_CAPABILITIES={AUTH_SECURITY_CAPABILITIES}
         deleteSignovaAccount={deleteSignovaAccount}
    updateCameraProcessingSetting={updateCameraProcessingSetting}
  />
)}
        </div>
      </aside>
      )}

      <AddContactModal
        contactModalOpen={contactModalOpen}
        setContactModalOpen={setContactModalOpen}
        contactForm={contactForm}
        setContactForm={setContactForm}
        addContact={addContact}
        contactFormError={contactFormError}
      />

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
          if (event.target === event.currentTarget) setPasswordModal({ open: false, contactId: null, mode: 'create', value: '', error: '', methods: { face: false, fingerprint: false, pin: true } });
        }}>
          <section className="contactMiniModal passwordMiniModal" role="dialog" aria-modal="true" aria-label={passwordModal.mode === 'unlock' ? 'Unlock chat' : 'Create chat password'}>
            <button type="button" className="contactMiniClose" onClick={() => setPasswordModal({ open: false, contactId: null, mode: 'create', value: '', error: '', methods: { face: false, fingerprint: false, pin: true } })} aria-label="Close password window">×</button>
            <div className="modalBrandHeader">
              <span className="modalLogo3d lockLogo3d"><img src="/app-logo.png" alt="" /></span>
              <div>
                <span>{passwordModal.mode === 'unlock' ? 'Unlock Chat' : 'Chat Lock'}</span>
                <strong>{contacts.find((contact) => contact.id === passwordModal.contactId)?.name || 'Private chat'}</strong>
                <small>{passwordModal.mode === 'unlock' ? 'Enter the local chat password.' : 'Create a local chat password for this device.'}</small>
              </div>
            </div>
            <div className="chatLockMethods" aria-label="Chat lock methods">
              {[
                ['face', 'Face lock', 'Unavailable — biometric verification is not connected'],
                ['fingerprint', 'Fingerprint', 'Unavailable — biometric verification is not connected'],
                ['pin', 'Password / PIN', 'Available local app-lock method'],
              ].map(([key, title, detail]) => (
                <label className="chatLockMethod" key={key}>
                  <input
                    type="checkbox"
                    checked={key === 'pin'}
                    readOnly
                    disabled
                  />
                  <span>
                    <strong>{title}</strong>
                    <small>{detail}</small>
                  </span>
                </label>
              ))}
            </div>
            <small id="chat-lock-security-note">Local chat lock hides this conversation in Signova. It does not encrypt stored or transmitted messages.</small>
            <form className="contactForm" onSubmit={submitPasswordModal}>
              <input
                className="signSearch"
                type="password"
                value={passwordModal.value}
                onChange={(event) => setPasswordModal((modal) => ({ ...modal, value: event.target.value, error: '' }))}
                placeholder={passwordModal.mode === 'unlock' ? 'Enter PIN/password' : 'Create chat PIN/password'}
                minLength={passwordModal.mode === 'unlock' ? 1 : 6}
                maxLength={128}
                autoComplete={passwordModal.mode === 'unlock' ? 'current-password' : 'new-password'}
                aria-describedby="chat-lock-security-note"
                required
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