import React, { useEffect, useState } from 'react';
import { CONTACT_COUNTRIES, formatUniversalPhone, generateUsernameSlug } from '../../features/contacts/contactModel';
import { useContactDirectoryLookup } from '../../features/contacts/useContactDirectoryLookup';

/**
 * AddContactModal component
 * Dialog for adding a new Signova contact with universal phone formatting,
 * instant live debounce directory checks, and duplicate prevention.
 */
export default function AddContactModal({
  contactModalOpen,
  setContactModalOpen,
  contactForm,
  setContactForm,
  addContact,
  contactFormError,
  contacts = [],
}) {
  const [manualUsernameEdited, setManualUsernameEdited] = useState(false);

  const lookupStatus = useContactDirectoryLookup({
    countryCode: contactForm.countryCode,
    number: contactForm.number,
    username: contactForm.username,
    contacts,
  });

  useEffect(() => {
    if (contactModalOpen) {
      setManualUsernameEdited(false);
    }
  }, [contactModalOpen]);

  useEffect(() => {
    if (lookupStatus.status === 'verified' && lookupStatus.verifiedUser) {
      const u = lookupStatus.verifiedUser;
      setContactForm((prev) => ({
        ...prev,
        username: u.username || prev.username,
        name: prev.name.trim() ? prev.name : (u.name || prev.name),
      }));
    }
  }, [lookupStatus.status, lookupStatus.verifiedUser, setContactForm]);

  if (!contactModalOpen) {
    return null;
  }

  function handleNameChange(event) {
    const nextName = event.target.value;
    if (!manualUsernameEdited && lookupStatus.status !== 'verified') {
      const autoSlug = generateUsernameSlug(nextName);
      setContactForm((prev) => ({ ...prev, name: nextName, username: autoSlug }));
    } else {
      setContactForm((prev) => ({ ...prev, name: nextName }));
    }
  }

  function handlePhoneChange(event) {
    const rawInput = event.target.value;
    const parsed = formatUniversalPhone(contactForm.countryCode, rawInput);
    setContactForm((prev) => ({
      ...prev,
      countryCode: parsed.countryCode,
      number: parsed.nationalNumber,
    }));
  }

  function handleUsernameChange(event) {
    const nextUsername = event.target.value;
    setManualUsernameEdited(true);
    setContactForm((prev) => ({ ...prev, username: nextUsername }));
  }

  return (
    <div
      className="contactMiniOverlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setContactModalOpen(false);
      }}
    >
      <section className="contactMiniModal" role="dialog" aria-modal="true" aria-label="Add Signova contact">
        <button
          type="button"
          className="contactMiniClose"
          onClick={() => setContactModalOpen(false)}
          aria-label="Close add contact"
        >
          ×
        </button>
        <div className="modalBrandHeader">
          <span className="modalLogo3d">
            <img src="/app-logo.png" alt="" />
          </span>
          <div>
            <span>Add Contact</span>
            <strong>Signova identity card</strong>
            <small>Number + username identification</small>
          </div>
        </div>
        <form className="contactForm" onSubmit={addContact}>
          <input
            className="signSearch"
            value={contactForm.name}
            onChange={handleNameChange}
            placeholder="Full name"
          />
          <div className="contactPhoneRow">
            <select
              className="signSearch"
              value={contactForm.countryCode}
              onChange={(event) => setContactForm({ ...contactForm, countryCode: event.target.value })}
              aria-label="Country code"
            >
              {CONTACT_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.code}
                </option>
              ))}
            </select>
            <input
              className="signSearch"
              value={contactForm.number}
              onChange={handlePhoneChange}
              placeholder="Phone number (optional)"
              inputMode="numeric"
            />
          </div>
          <input
            className="signSearch"
            value={contactForm.username}
            onChange={handleUsernameChange}
            placeholder="@username"
          />
          {lookupStatus.tone === 'found' ? (
            <div className="contactLookupBadge contactLookupFound">
              {lookupStatus.text}
            </div>
          ) : lookupStatus.tone === 'warning' ? (
            <div className="contactLookupBadge contactLookupWarning">
              {lookupStatus.text}
            </div>
          ) : lookupStatus.tone === 'searching' ? (
            <div className="contactLookupBadge contactLookupSearching">
              {lookupStatus.text}
            </div>
          ) : lookupStatus.text ? (
            <div className="contactLookupBadge contactLookupNote">
              {lookupStatus.text}
            </div>
          ) : null}
          {contactFormError ? <small className="contactFormError">{contactFormError}</small> : null}
          <small className="contactIdentityNote">
            Username is locked as the default profile identity. Number can stay hidden.
          </small>
          <div className="contactAvatarOptions" aria-label="Contact avatar view">
            <button
              type="button"
              className={contactForm.avatarChoice === 'signova' ? 'activeContactAvatarOption' : ''}
              onClick={() => setContactForm({ ...contactForm, avatarChoice: 'signova' })}
            >
              <span className="contactAvatar signovaContactAvatar">
                <img src="/app-logo.png" alt="" />
                <em>{contactForm.name.trim().charAt(0).toUpperCase() || 'S'}</em>
              </span>
              Signova icon
            </button>
            <button
              type="button"
              className={contactForm.avatarChoice === 'initial' ? 'activeContactAvatarOption' : ''}
              onClick={() => setContactForm({ ...contactForm, avatarChoice: 'initial' })}
            >
              <span className="contactAvatar initialContactAvatar">
                {contactForm.name.trim().charAt(0).toUpperCase() || 'S'}
              </span>
              First name
            </button>
          </div>
          <div className="contactVisibilityGrid">
            <label>
              <input
                type="checkbox"
                checked={contactForm.showUsername}
                onChange={(event) => setContactForm({ ...contactForm, showUsername: event.target.checked })}
              />{' '}
              Show username
            </label>
            <label>
              <input
                type="checkbox"
                checked={contactForm.showNumber}
                onChange={(event) => setContactForm({ ...contactForm, showNumber: event.target.checked })}
              />{' '}
              Show number
            </label>
          </div>
          <button type="submit">Add contact</button>
        </form>
      </section>
    </div>
  );
}
