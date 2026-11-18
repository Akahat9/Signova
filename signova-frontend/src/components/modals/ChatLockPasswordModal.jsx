import React from 'react';

/**
 * ChatLockPasswordModal component
 * Dialog for setting up a local device PIN/password or unlocking a locked private chat.
 */
export default function ChatLockPasswordModal({
  passwordModal,
  setPasswordModal,
  contacts = [],
  submitPasswordModal,
}) {
  if (!passwordModal?.open) {
    return null;
  }

  const activeContact = contacts.find((contact) => contact.id === passwordModal.contactId);

  const handleClose = () => {
    setPasswordModal({
      open: false,
      contactId: null,
      mode: 'create',
      value: '',
      error: '',
      methods: { face: false, fingerprint: false, pin: true },
    });
  };

  return (
    <div
      className="contactMiniOverlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <section
        className="contactMiniModal passwordMiniModal"
        role="dialog"
        aria-modal="true"
        aria-label={passwordModal.mode === 'unlock' ? 'Unlock chat' : 'Create chat password'}
      >
        <button
          type="button"
          className="contactMiniClose"
          onClick={handleClose}
          aria-label="Close password window"
        >
          ×
        </button>
        <div className="modalBrandHeader">
          <span className="modalLogo3d lockLogo3d">
            <img src="/app-logo.png" alt="" />
          </span>
          <div>
            <span>{passwordModal.mode === 'unlock' ? 'Unlock Chat' : 'Chat Lock'}</span>
            <strong>{activeContact?.name || 'Private chat'}</strong>
            <small>
              {passwordModal.mode === 'unlock'
                ? 'Enter the local chat password.'
                : 'Create a local chat password for this device.'}
            </small>
          </div>
        </div>
        <div className="chatLockMethods" aria-label="Chat lock methods">
          {[
            ['face', 'Face lock', 'Unavailable — biometric verification is not connected'],
            ['fingerprint', 'Fingerprint', 'Unavailable — biometric verification is not connected'],
            ['pin', 'Password / PIN', 'Available local app-lock method'],
          ].map(([key, title, detail]) => (
            <label className="chatLockMethod" key={key}>
              <input type="checkbox" checked={key === 'pin'} readOnly disabled />
              <span>
                <strong>{title}</strong>
                <small>{detail}</small>
              </span>
            </label>
          ))}
        </div>
        <small id="chat-lock-security-note">
          Local chat lock hides this conversation in Signova. It does not encrypt stored or transmitted messages.
        </small>
        <form className="contactForm" onSubmit={submitPasswordModal}>
          <input
            className="signSearch"
            type="password"
            value={passwordModal.value}
            onChange={(event) =>
              setPasswordModal((modal) => ({ ...modal, value: event.target.value, error: '' }))
            }
            placeholder={
              passwordModal.mode === 'unlock' ? 'Enter PIN/password' : 'Create chat PIN/password'
            }
            minLength={passwordModal.mode === 'unlock' ? 1 : 6}
            maxLength={128}
            autoComplete={passwordModal.mode === 'unlock' ? 'current-password' : 'new-password'}
            aria-describedby="chat-lock-security-note"
            required
          />
          {passwordModal.error && <small className="passwordError">{passwordModal.error}</small>}
          <button type="submit">
            {passwordModal.mode === 'unlock' ? 'Unlock chat' : 'Enable chat lock'}
          </button>
        </form>
      </section>
    </div>
  );
}