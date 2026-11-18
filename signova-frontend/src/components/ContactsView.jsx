import React from 'react';
import { CONTACT_COUNTRIES } from '../features/contacts/contactModel';

export default function ContactsView({
  activePanel,
  contactForm,
  setContactForm,
  addContact,
  contactFormError,
}) {
  if (activePanel !== 'contacts') {
    return null;
  }

  return (
    <section className="panel contactsPanel">
      <div className="panelHeader">
        <span>Add Contact</span>
        <strong>Number + username identification</strong>
      </div>
      <form className="contactForm" onSubmit={addContact}>
        <input
          className="signSearch"
          value={contactForm.name}
          onChange={(event) => setContactForm({ ...contactForm, name: event.target.value })}
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
            onChange={(event) => setContactForm({ ...contactForm, number: event.target.value.replace(/\D/g, '') })}
            placeholder="Phone number (optional)"
            inputMode="numeric"
          />
        </div>
        <input
          className="signSearch"
          value={contactForm.username}
          onChange={(event) => setContactForm({ ...contactForm, username: event.target.value })}
          placeholder="@username"
        />
        {contactFormError ? <small className="contactFormError">{contactFormError}</small> : null}
        <small className="contactIdentityNote">Username is the default identity. Phone number is optional in profile view.</small>
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
  );
}

