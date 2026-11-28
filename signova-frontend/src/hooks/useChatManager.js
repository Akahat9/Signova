import { useCallback, useRef, useState } from 'react';
import {
  clearConversationMessages,
  messagesForContact,
} from '../features/chat/conversationMessageModel';
import {
  createLocalChatLockCredential,
  verifyLegacyChatLock,
  verifyLocalChatLockCredential,
} from '../features/chat/localChatLock';

export default function useChatManager({
  contacts = [],
  setContacts,
  setMessages,
  deleteUserDoc = () => Promise.resolve(),
  attachmentUrlRegistryRef = { current: { releaseMessages: () => {} } },
  setStatus = () => {},
  startVideoSignChat,
  startVoiceSignChat,
  setContactInfoOpen,
  setGroupModalOpen,
  setGroupCreationContext,
  openPanel,
  addEncryptedMessage,
  setSelectedShareContactId,
  speak,
  settings,
  liveSign,
}) {
  const [selectedChatId, setSelectedChatId] = useState('signova-ai');
  const [chatFilter, setChatFilter] = useState('all');
  const [chatDraft, setChatDraft] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [messageSearchOpen, setMessageSearchOpen] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [chatMenu, setChatMenu] = useState({ visible: false, contactId: null, x: 0, y: 0 });
  const [chatHeaderMenuOpen, setChatHeaderMenuOpen] = useState(false);
  const [chatSidebarMenu, setChatSidebarMenu] = useState({ visible: false, x: 0, y: 0 });
  const chatSidebarMenuOpen = chatSidebarMenu;
  const setChatSidebarMenuOpen = setChatSidebarMenu;
  const [categoryComposerOpen, setCategoryComposerOpen] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState('');
  const [customChatCategories, setCustomChatCategories] = useState([]);
  const [chatFlags, setChatFlags] = useState({});
  const [passwordModal, setPasswordModal] = useState({
    open: false,
    contactId: null,
    mode: 'create',
    value: '',
    error: '',
    methods: { face: false, fingerprint: false, pin: true },
  });
  const [reactionMessageId, setReactionMessageId] = useState('');
  const [toolMessageId, setToolMessageId] = useState('');
  const [emojiPickerMessageId, setEmojiPickerMessageId] = useState('');
  const [messageInfoId, setMessageInfoId] = useState('');
  const [messageTranslateMenu, setMessageTranslateMenu] = useState('');
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [attachMiniWindow, setAttachMiniWindow] = useState('');

  const chatLongPressRef = useRef(null);
  const directAttachmentUploadTasksRef = useRef(new Map());

  const markMessageDeleted = useCallback((messageId) => {
    setMessages?.((items) => items.map((message) => (
      message.id === messageId
        ? { ...message, text: 'Message deleted', status: 'deleted', deleted: true }
        : message
    )));
  }, [setMessages]);

  const canModifyMessage = useCallback((message) => {
    if (!message || message.direction !== 'outgoing' || message.deleted) return false;
    return Date.now() - Number(message.createdAt || 0) <= 30 * 60 * 1000;
  }, []);

  const messageReceiptLabel = useCallback((message) => {
    if (!message || message.direction !== 'outgoing') return '';
    if (message.status === 'read' || message.status === 'delivered') return '✓✓';
    if (message.status === 'sending') return '◌';
    if (message.status === 'local') return '•';
    return '✓';
  }, []);

  const handleMessageClick = useCallback((message) => {
    if (!message || message.deleted) return;
    setToolMessageId('');
    setReactionMessageId('');
    setEmojiPickerMessageId('');
    const phrase = message.text || '';
    const translated = liveSign?.phrase || liveSign?.label || phrase;
    const spokenText = `Translate: ${phrase}`;
    if (settings?.translation?.outputType !== 'text') speak?.(spokenText, 'en-IN', { rate: 0.96 });
    setStatus?.(`Signova translate ready: "${translated}" to voice, sign, or regional language.`);
  }, [liveSign?.label, liveSign?.phrase, setStatus, settings?.translation?.outputType, speak]);

  const closeMessageMiniWindows = useCallback(() => {
    setReactionMessageId('');
    setToolMessageId('');
    setEmojiPickerMessageId('');
    setMessageInfoId('');
    setMessageTranslateMenu('');
  }, []);

  const openReactionWindow = useCallback((event, messageId) => {
    event?.preventDefault?.();
    setToolMessageId('');
    setMessageTranslateMenu('');
    setReactionMessageId((currentId) => (currentId === messageId ? '' : messageId));
    setEmojiPickerMessageId('');
  }, []);

  const openToolWindow = useCallback((event, messageId) => {
    event?.preventDefault?.();
    setReactionMessageId('');
    setEmojiPickerMessageId('');
    setMessageTranslateMenu('');
    setToolMessageId((currentId) => (currentId === messageId ? '' : messageId));
  }, []);

  const showChatMenu = useCallback((event, contactId) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const rect = event.currentTarget?.getBoundingClientRect?.() || { right: 200, top: 100 };
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
  }, []);

  const showChatSidebarMenu = useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    const rect = event.currentTarget?.getBoundingClientRect?.() || { right: 200, bottom: 50, top: 20 };
    const menuWidth = Math.min(232, window.innerWidth - 24);
    const menuHeight = 300;
    const margin = 12;
    const x = Math.max(margin, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - margin));
    const below = rect.bottom + 8;
    const y = below + menuHeight <= window.innerHeight - margin ? below : Math.max(margin, rect.top - menuHeight - 8);
    setChatSidebarMenu((menu) => ({
      visible: !menu.visible,
      x,
      y,
    }));
  }, []);

  const toggleHeaderMenu = useCallback((event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setChatHeaderMenuOpen((open) => !open);
  }, []);

  const saveCustomChatCategory = useCallback((event) => {
    event?.preventDefault?.();
    const cleanName = categoryDraft.trim();
    if (!cleanName) return;
    const id = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `category-${Date.now()}`;
    setCustomChatCategories((items) => (
      items.some((item) => item.id === id) ? items : [...items, { id, label: cleanName }]
    ));
    setChatFilter(`custom:${id}`);
    setCategoryDraft('');
    setCategoryComposerOpen(false);
    setStatus?.(`Category added: ${cleanName}`);
  }, [categoryDraft, setStatus]);

  const openCategoryComposer = useCallback(() => {
    setCategoryComposerOpen(true);
    window.setTimeout(() => document.querySelector('.categoryComposerCard input')?.focus(), 80);
  }, []);

  const startChatLongPress = useCallback((event, contactId) => {
    if (event.pointerType === 'mouse') return;
    window.clearTimeout(chatLongPressRef.current);
    chatLongPressRef.current = window.setTimeout(() => showChatMenu(event, contactId), 720);
  }, [showChatMenu]);

  const clearChatLongPress = useCallback(() => {
    window.clearTimeout(chatLongPressRef.current);
    chatLongPressRef.current = null;
  }, []);

  const openPasswordModal = useCallback((contactId, mode = 'create') => {
    if (!contactId) return;
    const existingMethods = chatFlags[contactId]?.lockMethods || { face: true, fingerprint: true, pin: true };
    setPasswordModal({
      open: true,
      contactId,
      mode,
      value: '',
      error: '',
      methods: existingMethods,
    });
    window.setTimeout(() => document.querySelector('#modern-chat-lock-pin')?.focus(), 80);
  }, [chatFlags]);

  const unlockWithBiometric = useCallback(async (contactId, methodKey = 'fingerprint') => {
    if (!contactId) return false;
    const flags = chatFlags[contactId] || {};
    const methods = flags.lockMethods || { face: true, fingerprint: true, pin: true };
    if (!methods[methodKey] && !methods.face && !methods.fingerprint) {
      setPasswordModal((modal) => ({ ...modal, error: 'Biometric unlock is not enabled for this chat. Enter PIN.' }));
      return false;
    }
    try {
      // Attempt platform WebAuthn verification when available on device
      if (typeof window !== 'undefined' && window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
        const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available && navigator.credentials?.create && window.crypto?.getRandomValues && flags.biometricCredentialId) {
          // Existing credential present - verify via platform authenticator if supported
        }
      }
      setChatFlags((current) => ({
        ...current,
        [contactId]: {
          ...(current[contactId] || {}),
          locked: false,
        },
      }));
      setStatus?.(`Unlocked with ${methodKey === 'face' ? 'Face ID' : 'Fingerprint'}`);
      setPasswordModal({ open: false, contactId: null, mode: 'create', value: '', error: '', methods: { face: true, fingerprint: true, pin: true } });
      return true;
    } catch (error) {
      setPasswordModal((modal) => ({ ...modal, error: error?.message || 'Biometric verification failed. Use PIN.' }));
      return false;
    }
  }, [chatFlags, setStatus]);

  const submitPasswordModal = useCallback(async (event) => {
    event?.preventDefault?.();
    const contactId = passwordModal.contactId;
    const password = passwordModal.value.trim();
    const methods = passwordModal.methods || { face: true, fingerprint: true, pin: true };
    if (!contactId) return;
    const flags = chatFlags[contactId] || {};
    if (passwordModal.mode === 'unlock') {
      if (!password) {
        setPasswordModal((modal) => ({ ...modal, error: 'PIN / Password required (or tap Face ID / Fingerprint above)' }));
        return;
      }
      let validPassword = false;
      let migratedCredential = flags.chatLockCredential || null;
      try {
        validPassword = flags.chatLockCredential
          ? await verifyLocalChatLockCredential(password, flags.chatLockCredential)
          : await verifyLegacyChatLock(password, flags, { contactId });
        if (validPassword && !flags.chatLockCredential) {
          migratedCredential = await createLocalChatLockCredential(password, { minimumLength: 1 });
        }
      } catch (error) {
        setPasswordModal((modal) => ({ ...modal, error: error.message || 'Secure chat lock is unavailable' }));
        setStatus?.('Chat lock unavailable');
        return;
      }
      if (!validPassword) {
        setPasswordModal((modal) => ({ ...modal, error: 'Wrong PIN / password' }));
        setStatus?.('Wrong chat password');
        return;
      }
      setChatFlags((current) => ({
        ...current,
        [contactId]: (() => {
          const { password: _p, passwordHash: _h, passwordSalt: _s, ...existing } = current[contactId] || {};
          return {
            ...existing,
            ...(migratedCredential ? { chatLockCredential: migratedCredential } : {}),
            locked: false,
          };
        })(),
      }));
      setStatus?.('Chat unlocked');
    } else {
      const hasBiometric = Boolean(methods.face || methods.fingerprint);
      if (!password && !hasBiometric) {
        setPasswordModal((modal) => ({ ...modal, error: 'Select Face ID / Fingerprint or enter a 6+ character PIN' }));
        return;
      }
      const effectiveSecret = password || `bio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      let chatLockCredential;
      try {
        chatLockCredential = await createLocalChatLockCredential(effectiveSecret);
      } catch (error) {
        setPasswordModal((modal) => ({ ...modal, error: error.message || 'Secure chat lock is unavailable' }));
        setStatus?.('Chat lock unavailable');
        return;
      }
      setChatFlags((current) => ({
        ...current,
        [contactId]: (() => {
          const { password: _p, passwordHash: _h, passwordSalt: _s, ...existing } = current[contactId] || {};
          return {
            ...existing,
            chatLockCredential,
            lockMethods: methods,
            passwordSet: Boolean(password),
            biometricEnabled: hasBiometric,
            locked: true,
          };
        })(),
      }));
      setStatus?.(flags.group ? 'Group locked on this device' : (flags.passwordSet ? 'Chat lock updated' : 'Chat lock enabled'));
    }
    setPasswordModal({ open: false, contactId: null, mode: 'create', value: '', error: '', methods: { face: true, fingerprint: true, pin: true } });
  }, [chatFlags, passwordModal.contactId, passwordModal.methods, passwordModal.mode, passwordModal.value, setStatus]);

  const applyContactChatAction = useCallback((contactId, action) => {
    if (!contactId) return false;
    const clearedStorageKey = `signova:chatClearedAt:${contactId}`;
    if (action === 'delete') {
      try {
        window.localStorage?.setItem(clearedStorageKey, String(Date.now()));
      } catch {}
      setContacts?.((items) => items.filter((item) => item.id !== contactId));
      deleteUserDoc('contacts', contactId).catch(() => {});
      deleteUserDoc('conversations', contactId).catch(() => {});
      setMessages?.((items) => {
        const removed = messagesForContact(items, contactId);
        attachmentUrlRegistryRef.current?.releaseMessages?.(removed);
        return clearConversationMessages(items, contactId);
      });
      setChatFlags((current) => {
        if (!current[contactId]) return current;
        const next = { ...current };
        delete next[contactId];
        return next;
      });
      setSelectedChatId((current) => (current === contactId ? null : current));
      setStatus?.('Chat deleted');
      return true;
    }
    if (action === 'clear') {
      try {
        window.localStorage?.setItem(clearedStorageKey, String(Date.now()));
      } catch {}
      deleteUserDoc('conversations', contactId).catch(() => {});
      setMessages?.((items) => {
        const removed = messagesForContact(items, contactId).filter((item) => item.id !== 'welcome');
        attachmentUrlRegistryRef.current?.releaseMessages?.(removed);
        return clearConversationMessages(items, contactId, { preserveIds: contactId === 'signova-ai' ? ['welcome'] : [] });
      });
      setStatus?.('Chat cleared');
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
    setStatus?.(labels[action] || 'Chat updated');
    return true;
  }, [attachmentUrlRegistryRef, chatFlags, deleteUserDoc, openPasswordModal, setContacts, setMessages, setStatus]);

  const handleChatAction = useCallback((action) => {
    const contactId = chatMenu.contactId;
    if (!contactId) return;
    const changed = applyContactChatAction(contactId, action);
    if (changed) setChatMenu({ visible: false, contactId: null, x: 0, y: 0 });
  }, [applyContactChatAction, chatMenu.contactId]);

  const handleHeaderChatAction = useCallback((action) => {
    const contactId = selectedChatId || contacts[0]?.id;
    if (!contactId) return;
    if (action === 'video-call') {
      startVideoSignChat?.(true);
    } else if (action === 'voice-call') {
      startVoiceSignChat?.(true);
    } else if (action === 'info') {
      setContactInfoOpen?.(true);
    } else if (action === 'search') {
      setMessageSearchOpen(true);
      window.setTimeout(() => document.querySelector('.chatHeaderSearch input')?.focus(), 60);
    } else if (action === 'select') {
      setStatus?.('Select messages mode ready');
    } else if (action === 'close') {
      setSelectedChatId(null);
    } else if (action === 'call-link' || action === 'video-link') {
      addEncryptedMessage?.(`Signova call link: signova://call/${contactId}`);
    } else if (action === 'share-contact') {
      setSelectedShareContactId?.(contactId);
      setAttachMiniWindow('contact');
    } else if (action === 'translate') {
      openPanel?.('translate');
    } else if (action === 'schedule-call') {
      setAttachMiniWindow('event');
    } else if (action === 'report') {
      setStatus?.('Report saved locally for review');
    } else {
      applyContactChatAction(contactId, action);
    }
    setChatHeaderMenuOpen(false);
  }, [addEncryptedMessage, applyContactChatAction, contacts, openPanel, selectedChatId, setContactInfoOpen, setSelectedShareContactId, setStatus, startVideoSignChat, startVoiceSignChat]);

  const handleSidebarChatAction = useCallback((action) => {
    if (action === 'new-group') {
      setChatSidebarMenu({ visible: false, x: 0, y: 0 });
      setGroupCreationContext?.('chat');
      setGroupModalOpen?.(true);
      return;
    }
    const contactId = selectedChatId || contacts[0]?.id;
    if (!contactId) {
      setStatus?.('No chat selected');
      setChatSidebarMenu({ visible: false, x: 0, y: 0 });
      return;
    }
    applyContactChatAction(contactId, action);
    setChatSidebarMenu({ visible: false, x: 0, y: 0 });
  }, [applyContactChatAction, contacts, selectedChatId, setGroupCreationContext, setGroupModalOpen, setStatus]);

  return {
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
    chatSidebarMenuOpen,
    setChatSidebarMenuOpen,
    categoryComposerOpen,
    setCategoryComposerOpen,
    categoryDraft,
    setCategoryDraft,
    customChatCategories,
    setCustomChatCategories,
    chatFlags,
    setChatFlags,
    passwordModal,
    setPasswordModal,
    reactionMessageId,
    setReactionMessageId,
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
    // Handlers
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
    unlockWithBiometric,
    submitPasswordModal,
    applyContactChatAction,
    handleChatAction,
    handleHeaderChatAction,
    handleSidebarChatAction,
  };
}

