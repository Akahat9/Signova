import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Modern ChatLockPasswordModal matching Signova's purple-accented Chat Lock card.
 * Supports Individual & Group Chat Lock on this device with Face ID, Fingerprint,
 * and masked PIN/password with show/hide eye toggle.
 */
export default function ChatLockPasswordModal({
  passwordModal,
  setPasswordModal,
  contacts = [],
  chatFlags = {},
  submitPasswordModal,
  onUnlockBiometric,
}) {
  const [showPin, setShowPin] = useState(false);
  const [biometricBusy, setBiometricBusy] = useState(false);
  const [platformBiometricAvailable, setPlatformBiometricAvailable] = useState(true);

  useEffect(() => {
    let mounted = true;
    if (typeof window !== 'undefined' && window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then((avail) => {
          if (mounted) setPlatformBiometricAvailable(Boolean(avail));
        })
        .catch(() => {
          if (mounted) setPlatformBiometricAvailable(true);
        });
    }
    return () => {
      mounted = false;
    };
  }, []);

  const handleClose = () => {
    setShowPin(false);
    setBiometricBusy(false);
    setPasswordModal({
      open: false,
      contactId: null,
      mode: 'create',
      value: '',
      error: '',
      methods: { face: true, fingerprint: true, pin: true },
    });
  };

  useEffect(() => {
    if (!passwordModal?.open) return undefined;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passwordModal?.open]);

  if (!passwordModal?.open || typeof document === 'undefined') {
    return null;
  }

  const activeContact = contacts.find((contact) => contact.id === passwordModal.contactId);
  const targetFlags = chatFlags[passwordModal.contactId] || {};
  const isGroup = Boolean(targetFlags.group || activeContact?.number === 'Signova Group');
  const isUnlock = passwordModal.mode === 'unlock';
  const methods = passwordModal.methods || { face: true, fingerprint: true, pin: true };

  const toggleMethod = async (methodKey) => {
    if (isUnlock) {
      // In unlock mode, clicking Face ID or Fingerprint attempts biometric unlock immediately
      setBiometricBusy(true);
      try {
        if (typeof onUnlockBiometric === 'function') {
          await onUnlockBiometric(passwordModal.contactId, methodKey);
        }
      } finally {
        setBiometricBusy(false);
      }
      return;
    }
    setPasswordModal((modal) => ({
      ...modal,
      error: '',
      methods: {
        ...(modal.methods || { face: true, fingerprint: true, pin: true }),
        [methodKey]: !(modal.methods?.[methodKey] ?? true),
      },
    }));
  };

  return createPortal(
    <div
      className="modernContactModalOverlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <section
        className="modernChatLockCard"
        role="dialog"
        aria-modal="true"
        aria-label={isUnlock ? 'Unlock chat' : 'Chat Lock'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="modernChatLockHeader">
          <div className="modernChatLockTitleGroup">
            <div className="modernLockIconBadge">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div>
              <h3>{isUnlock ? (isGroup ? 'Unlock Group' : 'Unlock Chat') : (isGroup ? 'Group Chat Lock' : 'Chat Lock')}</h3>
              <p>
                {activeContact?.name
                  ? `${activeContact.name} · ${isGroup ? 'Device-only group lock' : 'Private & secure'}`
                  : 'Keep your chats private and secure'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="modernModalCloseBtn"
            onClick={handleClose}
            aria-label="Close chat lock"
          >
            ✕
          </button>
        </header>

        <div className="modernChatLockBody">
          {/* Hero Shield */}
          <div className="modernLockShieldHero" aria-hidden="true">
            <div className="modernLockShieldGlow" />
            <div className="modernLockShieldShape">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="#7c3aed" stroke="#7c3aed" strokeWidth="1.5">
                <rect x="5" y="11" width="14" height="10" rx="2.5" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" fill="none" stroke="#7c3aed" strokeWidth="2.4" strokeLinecap="round" />
                <circle cx="12" cy="16" r="1.4" fill="#ffffff" stroke="none" />
              </svg>
            </div>
          </div>

          {/* Device Unlock Banner */}
          <div className="modernDeviceUnlockBanner">
            <span className="deviceFingerprintIcon">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" />
                <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 12 0c0 1.5-.5 4-1 5.5" />
                <path d="M12 12v4" />
                <path d="M9 12a3 3 0 0 1 6 0c0 2-.5 5-1.5 7" />
              </svg>
            </span>
            <div>
              <strong>Unlock with your device</strong>
              <small>Use Face ID or Fingerprint to access locked {isGroup ? 'groups' : 'chats'}.</small>
            </div>
          </div>

          {/* Available Methods */}
          <div className="modernLockMethodsSection">
            <span className="modernMethodsHeading">{isUnlock ? 'Quick Biometric Unlock' : 'Available Methods'}</span>
            <div className="modernLockMethodsGrid">
              <button
                type="button"
                className={`modernMethodTile ${methods.face ? 'selected' : ''}`}
                onClick={() => toggleMethod('face')}
                disabled={biometricBusy}
              >
                <span className="methodTileIcon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    <path d="M9 10h.01M15 10h.01" strokeWidth="2.5" strokeLinecap="round" />
                    <path d="M9.5 15a3.5 3.5 0 0 0 5 0" strokeLinecap="round" />
                  </svg>
                </span>
                <div className="methodTileText">
                  <strong>Face ID</strong>
                  <small>{platformBiometricAvailable ? (isUnlock ? 'Tap to unlock' : 'Available') : 'Device ready'}</small>
                </div>
                {methods.face && <span className="methodCheckPill">✓</span>}
              </button>

              <button
                type="button"
                className={`modernMethodTile ${methods.fingerprint ? 'selected' : ''}`}
                onClick={() => toggleMethod('fingerprint')}
                disabled={biometricBusy}
              >
                <span className="methodTileIcon">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" />
                    <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 12 0c0 1.5-.5 4-1 5.5" />
                    <path d="M9 12a3 3 0 0 1 6 0c0 2-.5 5-1.5 7" />
                  </svg>
                </span>
                <div className="methodTileText">
                  <strong>Fingerprint</strong>
                  <small>{platformBiometricAvailable ? (isUnlock ? 'Tap to unlock' : 'Available') : 'Device ready'}</small>
                </div>
                {methods.fingerprint && <span className="methodCheckPill">✓</span>}
              </button>
            </div>
          </div>

          <div className="qrScanOrDivider">
            <span>OR</span>
          </div>

          {/* PIN Form */}
          <form className="modernChatLockPinForm" onSubmit={submitPasswordModal}>
            <label htmlFor="modern-chat-lock-pin">
              {isUnlock ? 'Enter PIN / Password' : 'Set a PIN'}{' '}
              {!isUnlock && <span className="optLabel">(Optional if Biometric enabled)</span>}
            </label>
            <div className="modernPinInputWrapper">
              <input
                id="modern-chat-lock-pin"
                type={showPin ? 'text' : 'password'}
                value={passwordModal.value}
                onChange={(event) =>
                  setPasswordModal((modal) => ({ ...modal, value: event.target.value, error: '' }))
                }
                placeholder={isUnlock ? 'Enter your PIN or password' : '• • • • • •'}
                minLength={isUnlock ? 1 : (methods.face || methods.fingerprint ? 0 : 6)}
                maxLength={128}
                autoComplete={isUnlock ? 'current-password' : 'new-password'}
                aria-describedby="chat-lock-security-note"
              />
              <button
                type="button"
                className="modernPinEyeBtn"
                onClick={() => setShowPin((v) => !v)}
                aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
              >
                {showPin ? (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>

            {passwordModal.error && <small className="passwordError">{passwordModal.error}</small>}

            <div className="modernChatLockNotice" id="chat-lock-security-note">
              <span className="noticeInfoIcon">ⓘ</span>
              <span>
                {isGroup
                  ? 'Locked groups stay hidden on this device only — messages, media, docs, and notifications remain private.'
                  : 'Locked chats will be hidden from your chat list and notifications.'}
              </span>
            </div>

            <button type="submit" className="modernEnableChatLockBtn" disabled={biometricBusy}>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>{isUnlock ? (isGroup ? 'Unlock Group' : 'Unlock Chat') : 'Enable Chat Lock'}</span>
            </button>
          </form>
        </div>
      </section>
    </div>,
    document.body
  );
}
