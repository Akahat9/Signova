import React from 'react';
import { Attach3DIcon } from '../SignovaIcons';
import { ContactAvatar } from '../AppPresentation';

/**
 * ContactInfoModal component
 * Displays selected contact's identity, presence, encryption/security status,
 * and quick conversation action buttons (Video, Voice, Favourite, Block).
 */
export default function ContactInfoModal({
  contactInfoOpen,
  setContactInfoOpen,
  selectedChatContact,
  encryptionStatus,
  selectedChatFlags = {},
  selectedChatPresence,
  startVideoSignChat,
  startVoiceSignChat,
  handleHeaderChatAction,
}) {
  if (!contactInfoOpen || !selectedChatContact) {
    return null;
  }

  return (
    <div
      className="contactMiniOverlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setContactInfoOpen(false);
      }}
    >
      <section className="contactInfoWindow" role="dialog" aria-modal="true" aria-label="Contact info">
        <button
          type="button"
          className="contactMiniClose"
          onClick={() => setContactInfoOpen(false)}
          aria-label="Close contact info"
        >
          ×
        </button>
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
            <strong>
              {selectedChatContact.showUsername !== false
                ? selectedChatContact.username
                : 'Username hidden'}
            </strong>
            <small>
              {selectedChatContact.showNumber
                ? selectedChatContact.number
                : 'Phone number private'}
            </small>
          </section>
          <section>
            <span>Security</span>
            <strong>{encryptionStatus}</strong>
            <small>
              {selectedChatFlags.locked ? 'Locked chat' : 'Local chat preview ready'}
            </small>
          </section>
          <section>
            <span>Presence</span>
            <strong>{selectedChatPresence?.status || 'Offline'}</strong>
            <small>{selectedChatPresence?.detail || 'No activity yet'}</small>
          </section>
          <section>
            <span>Chat status</span>
            <strong>
              {selectedChatFlags.favourite
                ? 'Favourite'
                : selectedChatFlags.blocked
                ? 'Blocked'
                : 'Active'}
            </strong>
            <small>
              {selectedChatFlags.muted ? 'Notifications muted' : 'Notifications on'}
            </small>
          </section>
        </div>
        <div className="contactInfoActions">
          <button type="button" onClick={startVideoSignChat}>
            <Attach3DIcon type="camera" />
            <span>Video</span>
          </button>
          <button type="button" onClick={startVoiceSignChat}>
            <Attach3DIcon type="audio" />
            <span>Voice</span>
          </button>
          <button type="button" onClick={() => handleHeaderChatAction('favourite')}>
            <Attach3DIcon type="sticker" />
            <span>{selectedChatFlags.favourite ? 'Unfavourite' : 'Favourite'}</span>
          </button>
          <button type="button" onClick={() => handleHeaderChatAction('blocked')}>
            <Attach3DIcon type="contact" />
            <span>{selectedChatFlags.blocked ? 'Unblock' : 'Block'}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

