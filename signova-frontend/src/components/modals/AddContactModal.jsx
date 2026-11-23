import React, { useEffect, useState } from 'react';
import { formatUniversalPhone, generateUsernameSlug } from '../../features/contacts/contactModel';
import { useContactDirectoryLookup } from '../../features/contacts/useContactDirectoryLookup';

/**
 * Modern AddContactModal component matching Signova's minimalist redesign (Image 1).
 * Features unified search, live verified match card with 1-click Add,
 * QR scanner trigger, invite link sharing, and iOS-style contact privacy toggles.
 */
export default function AddContactModal({
  contactModalOpen,
  setContactModalOpen,
  contactForm,
  setContactForm,
  addContact,
  contactFormError,
  contacts = [],
  onScanQr,
  copyProfileShareLink,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [manualName, setManualName] = useState('');

  const lookupStatus = useContactDirectoryLookup({
    countryCode: contactForm.countryCode,
    number: contactForm.number,
    username: contactForm.username,
    contacts,
  });

  useEffect(() => {
    if (contactModalOpen) {
      setSearchQuery(contactForm.username || contactForm.number || '');
      setManualName(contactForm.name || '');
      setInviteCopied(false);
    }
  }, [contactModalOpen, contactForm.username, contactForm.number, contactForm.name]);

  useEffect(() => {
    if (lookupStatus.status === 'verified' && lookupStatus.verifiedUser) {
      const u = lookupStatus.verifiedUser;
      setContactForm((prev) => ({
        ...prev,
        username: u.username || prev.username,
        name: prev.name.trim() ? prev.name : (u.name || prev.name),
      }));
      if (u.name) setManualName(u.name);
    }
  }, [lookupStatus.status, lookupStatus.verifiedUser, setContactForm]);

  if (!contactModalOpen) {
    return null;
  }

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearchQuery(val);

    const trimmed = val.trim();
    if (!trimmed) {
      setContactForm((prev) => ({
        ...prev,
        username: '',
        number: '',
        name: manualName,
      }));
      return;
    }

    // Check if user is typing phone number (digits, +, or leading 0)
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (trimmed.startsWith('+') || (digitsOnly.length >= 7 && !trimmed.startsWith('@'))) {
      const parsed = formatUniversalPhone(contactForm.countryCode, trimmed);
      setContactForm((prev) => ({
        ...prev,
        countryCode: parsed.countryCode,
        number: parsed.nationalNumber,
        username: prev.username || (manualName ? generateUsernameSlug(manualName) : ''),
      }));
    } else {
      // Treat as username query
      const formattedUser = trimmed.startsWith('@') ? trimmed.toLowerCase() : `@${trimmed.toLowerCase()}`;
      setContactForm((prev) => ({
        ...prev,
        username: formattedUser,
        name: manualName || prev.name || trimmed.replace(/^@/, ''),
      }));
    }
  }

  function handleClearSearch() {
    setSearchQuery('');
    setContactForm((prev) => ({
      ...prev,
      username: '',
      number: '',
    }));
  }

  async function handleInviteClick() {
    if (typeof copyProfileShareLink === 'function') {
      await copyProfileShareLink();
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 3000);
    } else if (navigator.clipboard) {
      const link = `${window.location.origin}/#invite`;
      await navigator.clipboard.writeText(link).catch(() => {});
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 3000);
    }
  }

  function handleScanQrClick() {
    if (typeof onScanQr === 'function') {
      onScanQr();
    }
  }

  function handleQuickAdd(e) {
    e.preventDefault();
    addContact(e);
  }

  const verifiedUser = lookupStatus.verifiedUser;
  const displayName = verifiedUser?.name || manualName || contactForm.name || (searchQuery.replace(/^@/, '') || 'Contact');
  const displayUser = verifiedUser?.username || contactForm.username || (searchQuery.startsWith('@') ? searchQuery : `@${searchQuery}`);

  return (
    <div
      className="modernContactModalOverlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setContactModalOpen(false);
      }}
    >
      <section className="modernAddContactCard" role="dialog" aria-modal="true" aria-label="Add Contact">
        {/* Close Button */}
        <button
          type="button"
          className="modernModalCloseBtn"
          onClick={() => setContactModalOpen(false)}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Modal Brand Header */}
        <header className="modernModalHeader">
          <div className="modernModalLogoGlow">
            <img src="/app-logo.png" alt="Signova" />
          </div>
          <div className="modernModalHeaderInfo">
            <h2>Add Contact</h2>
            <p>Share the Signova experience</p>
          </div>
        </header>

        <form className="modernAddContactForm" onSubmit={addContact}>
          {/* Unified Search Input */}
          <div className="modernSearchContainer">
            <svg className="modernSearchIcon" viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="modernSearchInput"
              placeholder="Search by username or phone number"
              value={searchQuery}
              onChange={handleSearchChange}
              autoFocus
            />
            {searchQuery ? (
              <button
                type="button"
                className="modernSearchClearBtn"
                onClick={handleClearSearch}
                aria-label="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>

          {/* Matched Contact Preview Card */}
          {lookupStatus.status === 'verified' && verifiedUser ? (
            <div className="modernMatchResultCard">
              <div className="modernMatchAvatarWrap">
                {verifiedUser.photo ? (
                  <img src={verifiedUser.photo} alt={displayName} className="modernMatchAvatarImg" />
                ) : (
                  <div className="modernMatchAvatarFallback">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="modernMatchOnlineDot" />
              </div>
              <div className="modernMatchDetails">
                <strong>{displayName}</strong>
                <span>{displayUser}</span>
              </div>
              <button
                type="button"
                className="modernMatchAddBtn"
                onClick={handleQuickAdd}
              >
                Add
              </button>
            </div>
          ) : lookupStatus.status === 'duplicate' ? (
            <div className="modernLookupAlert alertWarning">
              {lookupStatus.text}
            </div>
          ) : lookupStatus.loading ? (
            <div className="modernLookupAlert alertSearching">
              <span className="modernSpinner" /> Checking Signova directory...
            </div>
          ) : searchQuery.length >= 3 && !lookupStatus.verifiedUser ? (
            <div className="modernManualEntryCard">
              <p className="modernManualNotice">
                {lookupStatus.text || 'Unregistered on Signova. You can save as a direct invitation contact:'}
              </p>
              <input
                type="text"
                className="modernManualInput"
                placeholder="Full name for this contact"
                value={contactForm.name}
                onChange={(e) => {
                  setContactForm({ ...contactForm, name: e.target.value });
                  setManualName(e.target.value);
                }}
              />
            </div>
          ) : null}

          {contactFormError ? (
            <div className="modernFormError">{contactFormError}</div>
          ) : null}

          {/* OR Divider */}
          <div className="modernOrDivider">
            <span>OR</span>
          </div>

          {/* Quick Action Tiles */}
          <div className="modernQuickActionsGrid">
            <button
              type="button"
              className="modernQuickActionTile"
              onClick={handleScanQrClick}
            >
              <div className="modernTileIconWrap">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="3" y="3" width="7" height="7" rx="2" />
                  <rect x="14" y="3" width="7" height="7" rx="2" />
                  <rect x="3" y="14" width="7" height="7" rx="2" />
                  <circle cx="17.5" cy="17.5" r="2.5" />
                </svg>
              </div>
              <div className="modernTileText">
                <strong>Scan QR Code</strong>
                <small>Scan Signova QR Card</small>
              </div>
            </button>

            <button
              type="button"
              className="modernQuickActionTile"
              onClick={handleInviteClick}
            >
              <div className="modernTileIconWrap">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <div className="modernTileText">
                <strong>{inviteCopied ? 'Link Copied! ✓' : 'Invite via Link'}</strong>
                <small>{inviteCopied ? 'Ready to share' : 'Share invite link'}</small>
              </div>
            </button>
          </div>

          {/* Contact Privacy Section */}
          <div className="modernPrivacyCard">
            <div className="modernPrivacyHeader">
              <div className="modernPrivacyShield">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <div className="modernPrivacyHeaderText">
                <strong>Contact Privacy</strong>
                <small>Control what others can see</small>
              </div>
            </div>

            <div className="modernToggleRow">
              <div className="modernToggleLeading">
                <span className="modernToggleIcon">
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <div>
                  <strong>Show Username</strong>
                  <small>{contactForm.showUsername ? 'Your @username is public' : 'Your @username is hidden'}</small>
                </div>
              </div>
              <label className="modernSwitch">
                <input
                  type="checkbox"
                  checked={Boolean(contactForm.showUsername)}
                  onChange={(e) => setContactForm({ ...contactForm, showUsername: e.target.checked })}
                />
                <span className="modernSwitchSlider" />
              </label>
            </div>

            <div className="modernToggleRow">
              <div className="modernToggleLeading">
                <span className="modernToggleIcon">
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </span>
                <div>
                  <strong>Show Phone Number</strong>
                  <small>{contactForm.showNumber ? 'Your number is visible' : 'Your number is private'}</small>
                </div>
              </div>
              <label className="modernSwitch">
                <input
                  type="checkbox"
                  checked={Boolean(contactForm.showNumber)}
                  onChange={(e) => setContactForm({ ...contactForm, showNumber: e.target.checked })}
                />
                <span className="modernSwitchSlider" />
              </label>
            </div>
          </div>

          {/* Modal Footer */}
          <footer className="modernModalFooter">
            <div className="modernFooterSecurity">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Your information is secure and encrypted</span>
            </div>

            <button type="submit" className="modernPrimaryAddBtn">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.3">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              <span>Add Contact</span>
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
