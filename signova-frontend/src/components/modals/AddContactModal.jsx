import React, { useEffect, useRef, useState } from 'react';
import { CONTACT_COUNTRIES, extractLookupPhoneKeys, generateUsernameSlug } from '../../features/contacts/contactModel';
import { firestoreDb } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';

/**
 * AddContactModal component
 * Dialog for adding a new Signova contact with name, phone number, username, and visibility options.
 * Features smart auto-fill from phone number and automatic username slugging from full name.
 */
export default function AddContactModal({
  contactModalOpen,
  setContactModalOpen,
  contactForm,
  setContactForm,
  addContact,
  contactFormError,
}) {
  const [manualUsernameEdited, setManualUsernameEdited] = useState(false);
  const [lookupStatus, setLookupStatus] = useState({ loading: false, found: false, verifiedUser: null, text: '' });
  const lookupTimerRef = useRef(null);

  useEffect(() => {
    if (contactModalOpen) {
      setManualUsernameEdited(false);
      setLookupStatus({ loading: false, found: false, verifiedUser: null, text: '' });
    }
    return () => {
      if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    };
  }, [contactModalOpen]);

  if (!contactModalOpen) {
    return null;
  }

  function handleNameChange(event) {
    const nextName = event.target.value;
    if (!manualUsernameEdited && !lookupStatus.found) {
      const autoSlug = generateUsernameSlug(nextName);
      setContactForm((prev) => ({ ...prev, name: nextName, username: autoSlug }));
    } else {
      setContactForm((prev) => ({ ...prev, name: nextName }));
    }
  }

  function handlePhoneChange(event) {
    const rawDigits = event.target.value.replace(/\D/g, '');
    setContactForm((prev) => ({ ...prev, number: rawDigits }));

    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);

    if (rawDigits.length < 7) {
      if (lookupStatus.found) {
        setLookupStatus({ loading: false, found: false, verifiedUser: null, text: '' });
      }
      return;
    }

    setLookupStatus((prev) => ({ ...prev, loading: true, text: 'Searching Signova directory...' }));

    lookupTimerRef.current = setTimeout(async () => {
      if (!firestoreDb) {
        setLookupStatus({ loading: false, found: false, verifiedUser: null, text: '' });
        return;
      }
      const phoneKeys = extractLookupPhoneKeys(contactForm.countryCode, rawDigits);
      let matchedData = null;
      for (const key of phoneKeys) {
        try {
          const snap = await getDoc(doc(firestoreDb, 'publicPhoneIdentities', key));
          if (snap.exists() && snap.data()?.username) {
            matchedData = snap.data();
            break;
          }
        } catch {
          // ignore individual lookup error
        }
      }

      if (matchedData) {
        setLookupStatus({
          loading: false,
          found: true,
          verifiedUser: matchedData,
          text: `✓ Verified Signova account found: ${matchedData.username}`,
        });
        setContactForm((prev) => ({
          ...prev,
          username: matchedData.username,
          name: prev.name.trim() ? prev.name : (matchedData.name || prev.name),
        }));
      } else {
        setLookupStatus({
          loading: false,
          found: false,
          verifiedUser: null,
          text: rawDigits.length >= 10 ? 'No Signova account registered with this number yet' : '',
        });
        if (!manualUsernameEdited && rawDigits.length >= 10) {
          setContactForm((prev) => ({
            ...prev,
            username: prev.username || `@user_${rawDigits.slice(-4)}`,
          }));
        }
      }
    }, 350);
  }

  function handleUsernameChange(event) {
    const nextUsername = event.target.value;
    setManualUsernameEdited(true);
    setContactForm((prev) => ({ ...prev, username: nextUsername }));

    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    const cleanUsername = nextUsername.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      setLookupStatus({ loading: false, found: false, verifiedUser: null, text: '' });
      return;
    }

    lookupTimerRef.current = setTimeout(async () => {
      if (!firestoreDb) return;
      try {
        const snap = await getDoc(doc(firestoreDb, 'publicUserIdentities', cleanUsername.startsWith('@') ? cleanUsername : `@${cleanUsername}`));
        if (snap.exists() && snap.data()?.uid) {
          const uData = snap.data();
          setLookupStatus({
            loading: false,
            found: true,
            verifiedUser: uData,
            text: `✓ Verified Signova account found: ${uData.username}`,
          });
        } else {
          setLookupStatus({ loading: false, found: false, verifiedUser: null, text: '' });
        }
      } catch {
        setLookupStatus({ loading: false, found: false, verifiedUser: null, text: '' });
      }
    }, 350);
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
          {lookupStatus.found ? (
            <div className="contactLookupBadge contactLookupFound">
              {lookupStatus.text}
            </div>
          ) : lookupStatus.loading ? (
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
