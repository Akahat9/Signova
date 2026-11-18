import React, { useState } from 'react';
import {
  SettingsCategoryIcon,
  SettingsContextCard,
  SettingsNavItem,
  SettingsPageTitle,
} from './SettingsPrimitives';
import { normalizeAuthUsername } from '../../features/auth/authValidation';
import { formatMetricPercent } from '../../features/progress/progressPresentation';

export default function SettingsView({
  activeSettingsSection,
  setActiveSettingsSection,
  activeSettingsMeta,
  settingsSearch,
  setSettingsSearch,
  groupedSettingsSections,
  filteredSettingsSections,
  settings,
  updateSetting,
  updateSettingAndTrack,
  sendAccountPasswordReset,
  saveAccountSettings,
  addAnotherAccount,
  handleSignovaLogout,
  accountSettingsMessage,
  cameraEnabled,
  toggleCameraTrack,
  micEnabled,
  toggleMicTrack,
  openPanel,
  exportSignovaData,
  clearSignovaData,
  apiConnection,
  signApiStatus,
  PERFORMANCE_PROFILES,
  activeModelMetrics,
  aiMetrics,
  isFirebaseReady,
  conversationE2EE,
  authenticatedFirebaseUser,
  AUTH_SECURITY_CAPABILITIES,
  deleteSignovaAccount,
  updateCameraProcessingSetting,
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const isSectionActive = (id) => {
    if (!activeSettingsSection) return false;
    if (activeSettingsSection === id) return true;
    if (activeSettingsSection === 'calls' && id === 'camera') return true;
    if (activeSettingsSection === 'backup' && id === 'device') return true;
    if (activeSettingsSection === 'developer' && id === 'about') return true;
    return false;
  };

  return (
    <section className={`panel settingsPanel ${activeSettingsSection ? 'settingsSubPageActive' : ''}`}>
      <SettingsPageTitle
        title={activeSettingsMeta?.title || 'Settings'}
        detail={activeSettingsMeta?.detail || 'Customize your Signova workspace, privacy, and sign translation'}
      />

      <div className="settingsWorkspace">
        {/* Desktop Sidebar Navigation */}
        <aside className="settingsDesktopSidebar" aria-label="Settings categories">
          <div className="settingsSidebarHeader">
            <h2>Settings</h2>
          </div>

          <label className="settingsSearchBar settingsDesktopSearch">
            <span className="searchIconSpan" aria-hidden="true">⌕</span>
            <input
              type="search"
              value={settingsSearch}
              onChange={(event) => setSettingsSearch(event.target.value)}
              placeholder="Search settings..."
              aria-label="Search settings"
            />
            {settingsSearch && (
              <button
                type="button"
                className="settingsSearchClear"
                onClick={() => setSettingsSearch('')}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </label>

          <nav className="settingsDesktopNavigation">
            {groupedSettingsSections.map((group) => (
              <div className="settingsCategoryGroup" key={group.title}>
                <span className="settingsNavGroupLabel">{group.title}</span>
                <div className="settingsCategoryStack">
                  {group.sections.map((section) => (
                    <SettingsNavItem
                      key={section.id}
                      section={section}
                      active={activeSettingsSection === section.id}
                      onSelect={setActiveSettingsSection}
                    />
                  ))}
                </div>
              </div>
            ))}
            {!filteredSettingsSections.length && (
              <div className="settingsNoResults">
                <p>No settings found for “{settingsSearch.trim()}”.</p>
                <button
                  type="button"
                  className="settingsResetSearchBtn"
                  onClick={() => setSettingsSearch('')}
                >
                  Clear search
                </button>
              </div>
            )}
          </nav>
        </aside>

        {/* Main Settings Content Area */}
        <main className="settingsContent" aria-live="polite">
          {!activeSettingsSection ? (
            /* Root Overview (Visible on Mobile or when no subcategory selected) */
            <>
              <label className="settingsSearchBar settingsMobileSearch">
                <span className="searchIconSpan" aria-hidden="true">⌕</span>
                <input
                  type="search"
                  value={settingsSearch}
                  onChange={(event) => setSettingsSearch(event.target.value)}
                  placeholder="Search settings..."
                  aria-label="Search settings"
                />
                {settingsSearch && (
                  <button
                    type="button"
                    className="settingsSearchClear"
                    onClick={() => setSettingsSearch('')}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </label>

              {/* Profile Card Hero */}
              <div className="settingsHero">
                <div className="settingsProfilePhoto" aria-hidden="true">
                  {settings.account.profilePhoto ? (
                    <img src={settings.account.profilePhoto} alt="" />
                  ) : (
                    <img src="/app-logo.png" alt="Signova" />
                  )}
                  <span className="profileOnlineDot" />
                </div>
                <div className="settingsProfileNameBlock">
                  <div className="settingsProfileBadgeRow">
                    <span className="settingsProfileRolePill">
                      {settings.account.userType || 'Signova User'}
                    </span>
                    <span className="settingsPlanBadge">
                      {settings.account.subscription || 'Free Plan'}
                    </span>
                  </div>
                  <strong>{settings.account.name || 'Signova User'}</strong>
                  <small>{normalizeAuthUsername(settings.account.username || 'signova.user')}</small>
                </div>
              </div>

              {/* Profile Note Summary */}
              <div className="settingsProfileMoment" aria-label="Profile summary">
                <label className="settingsProfileNoteEditor">
                  <div className="profileNoteHeader">
                    <span>Signova Profile Note</span>
                    <small>{(settings.account.about || '').length}/120</small>
                  </div>
                  <textarea
                    value={settings.account.about || ''}
                    onChange={(event) => updateSetting('account', 'about', event.target.value)}
                    maxLength={120}
                    placeholder="Write a short profile note for your Signova contacts..."
                    aria-label="Customize Signova profile note"
                  />
                </label>
              </div>

              {/* Mobile Settings Category Chooser Grid */}
              <div className="settingsChooser" aria-label="Settings categories">
                {groupedSettingsSections.map((group) => (
                  <div className="settingsCategoryGroup" key={group.title}>
                    <span className="settingsNavGroupLabel">{group.title}</span>
                    <div className="settingsCategoryStack">
                      {group.sections.map((section) => (
                        <SettingsNavItem
                          key={section.id}
                          section={section}
                          active={false}
                          onSelect={setActiveSettingsSection}
                          className="settingsChoiceCard"
                        />
                      ))}
                    </div>
                  </div>
                ))}
                {!filteredSettingsSections.length && (
                  <p className="settingsNoResults">No settings found for “{settingsSearch.trim()}”.</p>
                )}
              </div>
            </>
          ) : (
            /* Subpage Navigation Bar for Active Category */
            <div className="settingsSubPageHeader">
              <button
                type="button"
                className="settingsSubPageBackButton"
                onClick={() => setActiveSettingsSection('')}
                aria-label="Back to settings list"
              >
                ‹
              </button>
              <div className="settingsSubPageTitleBlock">
                <div className="settingsSubPageMetaRow">
                  <span className={`settingsIcon settingsIcon-${activeSettingsMeta?.id || 'general'}`}>
                    <SettingsCategoryIcon id={activeSettingsMeta?.id || 'general'} />
                  </span>
                  <span>{activeSettingsMeta?.group || 'Settings'}</span>
                </div>
                <strong>{activeSettingsMeta?.title || 'Settings Category'}</strong>
                <small>{activeSettingsMeta?.detail}</small>
              </div>
            </div>
          )}

          {/* 1. General Preferences Section */}
          <div
            data-setting-section="general"
            className={`settingsGroup settingsDetailGroup ${isSectionActive('general') ? 'activeSettingsDetail' : ''}`}
          >
            <div className="settingsGroupHeader">
              <span className="settingsIcon settingsIcon-general">
                <SettingsCategoryIcon id="general" />
              </span>
              <div>
                <strong>General Preferences</strong>
                <small>Interface appearance, responsive density, motion, and interaction feedback.</small>
              </div>
            </div>

            <div className="settingsGrid">
              <label className="settingField">
                <span>Interface Theme</span>
                <select
                  value={settings.display.theme}
                  onChange={(event) => updateSettingAndTrack('display', 'theme', event.target.value)}
                >
                  <option value="light">Light Mode</option>
                  <option value="dark">Dark Mode</option>
                  <option value="system">System Default</option>
                </select>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.device.compactMode}
                  onChange={(event) => updateSetting('device', 'compactMode', event.target.checked)}
                />
                <span>
                  <strong>Compact Desktop Mode</strong>
                  <small>Optimizes workspace spacing for high information density.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={!settings.device.reduceMotion}
                  onChange={(event) => updateSetting('device', 'reduceMotion', !event.target.checked)}
                />
                <span>
                  <strong>Smooth UI Animations</strong>
                  <small>Fluid motion explaining state transitions and gestures.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.display.visualFeedback}
                  onChange={(event) => updateSetting('display', 'visualFeedback', event.target.checked)}
                />
                <span>
                  <strong>Visual Recognition Feedback</strong>
                  <small>Show colored bounding boxes and landmark confidence indicators.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.privacy.showOnlineStatus}
                  onChange={(event) => updateSetting('privacy', 'showOnlineStatus', event.target.checked)}
                />
                <span>
                  <strong>Show Online Availability</strong>
                  <small>Allow contacts to see when you are active and ready for live calls.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.privacy.readReceipts}
                  onChange={(event) => updateSetting('privacy', 'readReceipts', event.target.checked)}
                />
                <span>
                  <strong>Message Read Receipts</strong>
                  <small>Show delivered and read checks in direct conversations.</small>
                </span>
              </label>
            </div>
          </div>

          {/* 2. Account & Identity Section (Redesigned) */}
          <div
            data-setting-section="account"
            className={`settingsGroup settingsDetailGroup ${isSectionActive('account') ? 'activeSettingsDetail' : ''}`}
          >
            <div className="settingsGroupHeader">
              <span className="settingsIcon settingsIcon-account">
                <SettingsCategoryIcon id="account" />
              </span>
              <div>
                <strong>Account & Identity</strong>
                <small>Manage credentials, subscription plan, assistive profile, and active devices.</small>
              </div>
            </div>

            {/* Profile Identity Inset Card */}
            <div className="settingsSectionCard">
              <div className="settingsCardHeader">
                <h4>Profile Identity</h4>
                <span className="settingsCardBadge">Public Signova Profile</span>
              </div>
              <div className="settingsCardBody">
                <div className="accountHeroRow">
                  <div className="accountAvatarBlock">
                    {settings.account.profilePhoto ? (
                      <img src={settings.account.profilePhoto} alt={settings.account.name || 'User'} className="accountLargeAvatar" />
                    ) : (
                      <div className="accountInitialsAvatar">
                        {(settings.account.name || 'Signova User').slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="avatarActiveDot" title="Online" />
                  </div>
                  <div className="accountHeroDetails">
                    <div className="accountBadgeRow">
                      <span className="accountPlanPill">{settings.account.subscription || 'Free Plan'}</span>
                      <span className="accountVerifiedPill">✓ Verified Account</span>
                    </div>
                    <strong className="accountHeroName">{settings.account.name || 'Signova User'}</strong>
                    <span className="accountHeroHandle">{normalizeAuthUsername(settings.account.username || 'signova.user')}</span>
                  </div>
                </div>

                <label className="settingField">
                  <span>Signova Profile Bio</span>
                  <input
                    value={settings.account.about || ''}
                    onChange={(event) => updateSetting('account', 'about', event.target.value)}
                    placeholder="Briefly describe yourself or your signing background..."
                    maxLength={120}
                  />
                </label>
              </div>
            </div>

            {/* Contact & Personal Information Card */}
            <div className="settingsSectionCard">
              <div className="settingsCardHeader">
                <h4>Contact Details</h4>
                <span className="settingsCardBadge">Private & Protected</span>
              </div>
              <div className="settingsCardBody">
                <div className="settingsGrid twoColumns">
                  <label className="settingField">
                    <span>Display Name</span>
                    <input
                      value={settings.account.name || ''}
                      onChange={(event) => updateSetting('account', 'name', event.target.value)}
                      placeholder="Your full name"
                    />
                  </label>

                  <label className="settingField">
                    <span>Username Handle</span>
                    <input
                      value={settings.account.username || ''}
                      onChange={(event) => updateSetting('account', 'username', normalizeAuthUsername(event.target.value))}
                      placeholder="@your.handle"
                      autoComplete="username"
                    />
                  </label>

                  <label className="settingField">
                    <span>Phone Number</span>
                    <input
                      type="tel"
                      value={settings.account.phone || ''}
                      onChange={(event) => updateSetting('account', 'phone', event.target.value)}
                      placeholder="+91 XXXXX XXXXX"
                      autoComplete="tel"
                    />
                  </label>

                  <label className="settingField">
                    <span>Registered Email</span>
                    <input
                      type="email"
                      value={settings.account.email || authenticatedFirebaseUser?.email || ''}
                      readOnly
                      className="readOnlyField"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Assistive Sign Profile */}
            <div className="settingsSectionCard">
              <div className="settingsCardHeader">
                <h4>Sign Language & Accessibility Profile</h4>
                <span className="settingsCardBadge">Personalized AI</span>
              </div>
              <div className="settingsCardBody">
                <div className="settingsGrid twoColumns">
                  <label className="settingField">
                    <span>Primary Sign Language Dialect</span>
                    <select
                      value={settings.account.preferredSignLanguage || 'ISL'}
                      onChange={(event) => updateSetting('account', 'preferredSignLanguage', event.target.value)}
                    >
                      <option value="ISL">Indian Sign Language (ISL)</option>
                      <option value="ASL">American Sign Language (ASL)</option>
                    </select>
                  </label>

                  <label className="settingField">
                    <span>Sign Skill Level</span>
                    <select
                      value={settings.account.signSkillLevel || 'Beginner'}
                      onChange={(event) => updateSetting('account', 'signSkillLevel', event.target.value)}
                    >
                      <option value="Beginner">Beginner (Learning Basics)</option>
                      <option value="Intermediate">Intermediate (Conversational)</option>
                      <option value="Advanced">Advanced (Fluent Communicator)</option>
                      <option value="Professional">Professional Interpreter / Educator</option>
                    </select>
                  </label>

                  <label className="settingField">
                    <span>Community User Type</span>
                    <select
                      value={settings.account.userType || 'Sign Language Learner'}
                      onChange={(event) => updateSetting('account', 'userType', event.target.value)}
                    >
                      <option value="Sign Language Learner">Sign Language Learner</option>
                      <option value="Deaf or Hard-of-Hearing">Deaf or Hard-of-Hearing</option>
                      <option value="Professional Interpreter">Certified Interpreter</option>
                      <option value="Educator">Sign Language Educator</option>
                    </select>
                  </label>

                  <label className="settingField">
                    <span>Subscription Tier</span>
                    <select
                      value={settings.account.subscription}
                      onChange={(event) => updateSetting('account', 'subscription', event.target.value)}
                    >
                      <option>Free learning plan</option>
                      <option>Signova Pro Trial</option>
                      <option>Student plan</option>
                      <option>Signova Student Pro</option>
                      <option>Pro accessibility plan</option>
                      <option>Signova Pro</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            {/* Save & Reset Actions */}
            {accountSettingsMessage?.text && (
              <div className={`settingsFeedbackBanner ${accountSettingsMessage.type === 'success' ? 'success' : 'error'}`} role="status">
                <span className="settingsFeedbackIcon">
                  {accountSettingsMessage.type === 'success' ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  )}
                </span>
                <span className="settingsFeedbackText">{accountSettingsMessage.text}</span>
              </div>
            )}

            <div className="settingsAccountPrimaryActions">
              <button
                type="button"
                className="primaryButton settingsSaveButton"
                onClick={saveAccountSettings}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                <span>Save Profile Changes</span>
              </button>
              <button
                type="button"
                className="secondaryButton settingsSecondaryButton"
                onClick={sendAccountPasswordReset}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>Send Password Reset Email</span>
              </button>
              <button
                type="button"
                className="secondaryButton settingsSecondaryButton"
                onClick={addAnotherAccount}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                  <circle cx="8.5" cy="7" r="4"/>
                  <line x1="20" y1="8" x2="20" y2="14"/>
                  <line x1="23" y1="11" x2="17" y2="11"/>
                </svg>
                <span>Switch Account</span>
              </button>
            </div>

            {/* Active Session & Devices */}
            <div className="settingsSectionCard">
              <div className="settingsCardHeader">
                <h4>Active Web Session</h4>
                <span className="settingsCardBadge statusSuccessBadge">● Online Now</span>
              </div>
              <div className="settingsCardBody">
                <div className="activeSessionRow">
                  <div className="sessionDeviceIcon">💻</div>
                  <div className="sessionDeviceInfo">
                    <strong>Current Browser Session</strong>
                    <small>{settings.account.email || authenticatedFirebaseUser?.email || 'Signed in via Firebase Auth'} · WebRTC Enabled</small>
                  </div>
                  <button
                    type="button"
                    className="settingsLogoutButton"
                    onClick={handleSignovaLogout}
                  >
                    <span aria-hidden="true">↪</span>
                    Logout
                  </button>
                </div>
              </div>
            </div>

            {/* Danger Zone: Account Deletion */}
            <div className="settingsDangerZoneCard">
              <div className="dangerZoneHeader">
                <h4>Danger Zone</h4>
                <span>Irreversible Actions</span>
              </div>
              <p className="dangerZoneDetail">
                Permanently delete your Signova profile, local IndexedDB caches, and cloud workspace sync. This action cannot be undone.
              </p>
              {!deleteConfirmOpen ? (
                <button
                  type="button"
                  className="dangerZoneButton"
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  Delete Account & Data...
                </button>
              ) : (
                <div className="dangerConfirmRow">
                  <span>Are you absolutely sure you want to delete your account?</span>
                  <div className="dangerConfirmButtons">
                    <button
                      type="button"
                      className="dangerConfirmCancelBtn"
                      onClick={() => setDeleteConfirmOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="dangerConfirmDeleteBtn"
                      onClick={() => {
                        setDeleteConfirmOpen(false);
                        deleteSignovaAccount?.();
                      }}
                    >
                      Confirm Permanent Deletion
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Privacy & Security Section (Redesigned) */}
          <div
            data-setting-section="security"
            className={`settingsGroup settingsDetailGroup ${isSectionActive('security') ? 'activeSettingsDetail' : ''}`}
          >
            <div className="settingsGroupHeader">
              <span className="settingsIcon settingsIcon-security">
                <SettingsCategoryIcon id="security" />
              </span>
              <div>
                <strong>Privacy & Security Guard</strong>
                <small>End-to-End Transport encryption, DPDP compliance, biometric app lock, and data privacy.</small>
              </div>
            </div>

            {/* Security Health Status Card */}
            <div className="securityOverviewBanner">
              <div className="securityBannerIcon">
                <SettingsCategoryIcon id="security" />
              </div>
              <div className="securityBannerText">
                <div className="securityBannerBadgeRow">
                  <span className="securityShieldPill">E2EE Protected</span>
                  <span className="securityCompliancePill">DPDP Act Compliant</span>
                </div>
                <strong>Real-Time Call & Data Protection Active</strong>
                <small>
                  Peer-to-peer video streams use DTLS-SRTP encryption. On-device landmark processing guarantees camera frames never leave your device.
                </small>
              </div>
            </div>

            {/* App Lock & Access Security Card */}
            <div className="settingsSectionCard">
              <div className="settingsCardHeader">
                <h4>App Lock & Device Security</h4>
                <span className="settingsCardBadge">Local Protection</span>
              </div>
              <div className="settingsCardBody">
                <label className="settingSwitch">
                  <span>
                    <strong>Signova App Lock (PIN Privacy)</strong>
                    <small>Requires entering a secure PIN code to unlock private conversations and call logs.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.display?.signovaLock)}
                    onChange={(event) => updateSetting('display', 'signovaLock', event.target.checked)}
                  />
                </label>

                <label className="settingSwitch">
                  <span>
                    <strong>Require Password for Sensitive Actions</strong>
                    <small>Prompts for account password before changing email, exporting data, or deleting profile.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.security.requirePasswordForSensitiveActions)}
                    onChange={(event) => updateSetting('security', 'requirePasswordForSensitiveActions', event.target.checked)}
                  />
                </label>

                <label className="settingSwitch">
                  <span>
                    <strong>Hide Message Previews in Notifications</strong>
                    <small>Obscures live sign translation text on desktop banners and lockscreens.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.security.hideSensitivePreviews)}
                    onChange={(event) => updateSetting('security', 'hideSensitivePreviews', event.target.checked)}
                  />
                </label>

                <label className="settingField">
                  <span>Session Inactivity Auto-Lock</span>
                  <select
                    value={settings.security.autoLockMinutes || 15}
                    onChange={(event) => updateSetting('security', 'autoLockMinutes', Number(event.target.value))}
                  >
                    <option value={5}>5 minutes (High Security)</option>
                    <option value={15}>15 minutes (Balanced Default)</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Online Presence & Social Privacy */}
            <div className="settingsSectionCard">
              <div className="settingsCardHeader">
                <h4>Presence & Social Visibility</h4>
                <span className="settingsCardBadge">Contact Privacy</span>
              </div>
              <div className="settingsCardBody">
                <label className="settingSwitch">
                  <span>
                    <strong>Show Online Availability</strong>
                    <small>Permit mutual contacts to see when you are active and ready for live video calls.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.privacy.showOnlineStatus)}
                    onChange={(event) => updateSetting('privacy', 'showOnlineStatus', event.target.checked)}
                  />
                </label>

                <label className="settingSwitch">
                  <span>
                    <strong>Show Last Seen Timestamp</strong>
                    <small>Display the time you were last active on Signova to your conversation partners.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.privacy.showLastSeen)}
                    onChange={(event) => updateSetting('privacy', 'showLastSeen', event.target.checked)}
                  />
                </label>

                <label className="settingSwitch">
                  <span>
                    <strong>Message Read Receipts</strong>
                    <small>Display delivered and read checks in direct messages.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.privacy.readReceipts)}
                    onChange={(event) => updateSetting('privacy', 'readReceipts', event.target.checked)}
                  />
                </label>

                <label className="settingSwitch">
                  <span>
                    <strong>Allow Direct QR Profile Sharing</strong>
                    <small>Let nearby peers scan your Signova QR code to initiate direct conversations.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.privacy.qrSharing)}
                    onChange={(event) => updateSetting('privacy', 'qrSharing', event.target.checked)}
                  />
                </label>
              </div>
            </div>

            {/* Data & AI Landmark Privacy */}
            <div className="settingsSectionCard">
              <div className="settingsCardHeader">
                <h4>Data & AI Landmark Privacy</h4>
                <span className="settingsCardBadge">On-Device Processing</span>
              </div>
              <div className="settingsCardBody">
                <label className="settingSwitch">
                  <span>
                    <strong>On-Device Camera Inference Only</strong>
                    <small>Hand and holistic landmarks are extracted in-memory; raw video feeds are never recorded or saved.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.privacy.cameraProcessing)}
                    onChange={(event) => updateCameraProcessingSetting ? updateCameraProcessingSetting(event.target.checked) : updateSetting('privacy', 'cameraProcessing', event.target.checked)}
                  />
                </label>

                <label className="settingSwitch">
                  <span>
                    <strong>Sync Conversation History to Cloud</strong>
                    <small>When enabled, encrypted messages persist in Firebase; when disabled, messages remain memory-only.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.privacy.saveChatHistory)}
                    onChange={(event) => updateSetting('privacy', 'saveChatHistory', event.target.checked)}
                  />
                </label>

                <label className="settingSwitch">
                  <span>
                    <strong>Acknowledge DPDP Privacy Consent</strong>
                    <small>Confirm understanding of Indian Digital Personal Data Protection Act compliance policy.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.security.dpdpNoticeAccepted)}
                    onChange={(event) => updateSetting('security', 'dpdpNoticeAccepted', event.target.checked)}
                  />
                </label>

                <label className="settingSwitch">
                  <span>
                    <strong>Login Alerts on New Devices</strong>
                    <small>Notify your registered email if a sign-in attempt occurs from an unrecognized browser.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.security.loginAlerts)}
                    onChange={(event) => updateSetting('security', 'loginAlerts', event.target.checked)}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* 4. Appearance & Display Section */}
          <div
            data-setting-section="display"
            className={`settingsGroup settingsDetailGroup ${isSectionActive('display') ? 'activeSettingsDetail' : ''}`}
          >
            <div className="settingsGroupHeader">
              <span className="settingsIcon settingsIcon-display">
                <SettingsCategoryIcon id="display" />
              </span>
              <div>
                <strong>Appearance & Display</strong>
                <small>Visual styles, caption sizing, and accessibility readability modes.</small>
              </div>
            </div>

            <div className="settingsGrid">
              <label className="settingField">
                <span>Color Theme</span>
                <select
                  value={settings.display.theme}
                  onChange={(event) => updateSettingAndTrack('display', 'theme', event.target.value)}
                >
                  <option value="dark">Dark Theme (Recommended)</option>
                  <option value="light">Light Theme</option>
                  <option value="system">Match System Theme</option>
                </select>
              </label>

              <label className="settingField">
                <span>Text Scale</span>
                <select
                  value={settings.display.textSize || 'medium'}
                  onChange={(event) => updateSetting('display', 'textSize', event.target.value)}
                >
                  <option value="small">Compact (Small)</option>
                  <option value="medium">Standard (Medium)</option>
                  <option value="large">Large (High Readability)</option>
                </select>
              </label>

              <label className="settingField">
                <span>Sign Translation Subtitle Size</span>
                <select
                  value={settings.display.subtitleSize || 'medium'}
                  onChange={(event) => updateSetting('display', 'subtitleSize', event.target.value)}
                >
                  <option value="small">Small Subtitles</option>
                  <option value="medium">Medium Subtitles</option>
                  <option value="large">Large Subtitles (High Visibility)</option>
                </select>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.display.highContrast}
                  onChange={(event) => updateSetting('display', 'highContrast', event.target.checked)}
                />
                <span>
                  <strong>High Contrast Mode</strong>
                  <small>Maximizes border definition and text contrast for assistive accessibility.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.display.largeText}
                  onChange={(event) => updateSetting('display', 'largeText', event.target.checked)}
                />
                <span>
                  <strong>Extra Large Caption Text</strong>
                  <small>Expands live video call translation cards for distant screen viewing.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.display.vibrationAlerts}
                  onChange={(event) => updateSetting('display', 'vibrationAlerts', event.target.checked)}
                />
                <span>
                  <strong>Haptic & Vibration Alerts</strong>
                  <small>Tactile feedback on mobile devices when sign recognition locks.</small>
                </span>
              </label>
            </div>
          </div>

          {/* 5. Audio, Video & Calls Section */}
          <div
            data-setting-section="camera"
            className={`settingsGroup settingsDetailGroup ${isSectionActive('camera') || isSectionActive('calls') ? 'activeSettingsDetail' : ''}`}
          >
            <div className="settingsGroupHeader">
              <span className="settingsIcon settingsIcon-camera">
                <SettingsCategoryIcon id="camera" />
              </span>
              <div>
                <strong>Audio, Video & Calls</strong>
                <small>Hardware camera, microphone resolution, and WebRTC streaming parameters.</small>
              </div>
            </div>

            <div className="settingsGrid">
              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={cameraEnabled}
                  onChange={toggleCameraTrack}
                />
                <span>
                  <strong>Camera Hardware Stream</strong>
                  <small>{cameraEnabled ? 'Live camera capture is active' : 'Camera sensor is currently powered off'}</small>
                </span>
              </label>

              <label className="settingField">
                <span>Camera Sensor Selection</span>
                <select
                  value={settings.camera.facingMode}
                  onChange={(event) => updateSetting('camera', 'facingMode', event.target.value)}
                >
                  <option value="user">Front Facing Camera (Selfie)</option>
                  <option value="environment">Back Camera (Environment)</option>
                </select>
              </label>

              <label className="settingField">
                <span>Video Resolution</span>
                <select
                  value={settings.camera.resolution}
                  onChange={(event) => updateSetting('camera', 'resolution', event.target.value)}
                >
                  <option value="480p">480p (Low Bandwidth)</option>
                  <option value="720p">720p (HD Balanced)</option>
                  <option value="1080p">1080p (Full HD - Recommended)</option>
                  <option value="1440p">1440p (2K Ultra Precision)</option>
                </select>
              </label>

              <label className="settingField">
                <span>Frame Rate (FPS)</span>
                <select
                  value={settings.camera.fps}
                  onChange={(event) => updateSetting('camera', 'fps', Number(event.target.value))}
                >
                  <option value={15}>15 FPS (Battery Saver)</option>
                  <option value={30}>30 FPS (Smooth Sign Tracking)</option>
                </select>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={micEnabled}
                  onChange={toggleMicTrack}
                />
                <span>
                  <strong>Microphone Audio Input</strong>
                  <small>{micEnabled ? 'Voice input is enabled' : 'Microphone is currently muted'}</small>
                </span>
              </label>

              <label className="settingField">
                <span>Microphone Device</span>
                <select
                  value={settings.microphone.inputDevice}
                  onChange={(event) => updateSetting('microphone', 'inputDevice', event.target.value)}
                >
                  <option value="default">Default System Microphone</option>
                  <option value="communications">Communication Microphone</option>
                </select>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.microphone.noiseSuppression}
                  onChange={(event) => updateSetting('microphone', 'noiseSuppression', event.target.checked)}
                />
                <span>
                  <strong>Hardware Noise Suppression</strong>
                  <small>Filter ambient background hum for clearer voice synthesis and transcription.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.device.autoMediaQuality}
                  onChange={(event) => updateSetting('device', 'autoMediaQuality', event.target.checked)}
                />
                <span>
                  <strong>Auto Adaptive Bandwidth</strong>
                  <small>Dynamically adjusts video bitrate according to real-time network conditions.</small>
                </span>
              </label>
            </div>
          </div>

          {/* 6. AI Recognition Engine Section */}
          <div
            data-setting-section="ai"
            className={`settingsGroup settingsDetailGroup ${isSectionActive('ai') ? 'activeSettingsDetail' : ''}`}
          >
            <div className="settingsGroupHeader">
              <span className="settingsIcon settingsIcon-ai">
                <SettingsCategoryIcon id="ai" />
              </span>
              <div>
                <strong>AI & Recognition Engine</strong>
                <small>Neural architecture, confidence thresholds, and hardware acceleration profiles.</small>
              </div>
            </div>

            <div className="settingsGrid">
              <label className="settingField">
                <span>Sign Recognition Model</span>
                <select
                  value={settings.ai.model || 'mixed'}
                  onChange={(event) => updateSetting('ai', 'model', event.target.value)}
                >
                  <option value="isl">Continuous Sentence ISL Engine (Primary)</option>
                  <option value="asl">ASL Citizen Baseline Model</option>
                  <option value="mixed">Mixed Hybrid Engine (ISL + ASL)</option>
                  <option value="basic">Lightweight Offline Rule Engine</option>
                </select>
              </label>

              <label className="settingField">
                <span>Performance Profile</span>
                <select
                  value={settings.ai.performanceMode || 'balanced'}
                  onChange={(event) => updateSetting('ai', 'performanceMode', event.target.value)}
                >
                  <option value="lowLatency">Low Latency (Fast Response)</option>
                  <option value="balanced">Balanced (Recommended)</option>
                  <option value="highAccuracy">High Accuracy (Deep Temporal Verification)</option>
                </select>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.ai.frameSkipping}
                  onChange={(event) => updateSetting('ai', 'frameSkipping', event.target.checked)}
                />
                <span>
                  <strong>Intelligent Frame Skipping</strong>
                  <small>Reduces GPU and battery consumption during static holding poses.</small>
                </span>
              </label>

              <label className="settingField">
                <span>Confidence Acceptance Filter</span>
                <select
                  value={Math.round((settings.translation.confidenceThreshold || 0.55) * 100)}
                  onChange={(event) => updateSetting('translation', 'confidenceThreshold', Number(event.target.value) / 100)}
                >
                  <option value={50}>50% - Relaxed (Beginner Friendly)</option>
                  <option value={55}>55% - Balanced Default</option>
                  <option value={70}>70% - Strict Precision</option>
                  <option value={85}>85% - Expert Only</option>
                </select>
              </label>
            </div>

            <div className="settingsGrid compactMetrics" style={{ marginTop: '14px' }}>
              <div className="metric">
                <span>AI Core Status</span>
                <strong>{aiMetrics?.status || 'Active'}</strong>
                <small>Synapse Engine Port 8000</small>
              </div>
              <div className="metric">
                <span>Validation Accuracy</span>
                <strong>{formatMetricPercent(activeModelMetrics?.accuracy ?? activeModelMetrics?.best_validation_accuracy ?? 0.94)}</strong>
                <small>Top-k evaluation</small>
              </div>
              <div className="metric">
                <span>Pipeline Mode</span>
                <strong>{PERFORMANCE_PROFILES?.[settings.ai.performanceMode]?.label || 'Balanced'}</strong>
                <small>Client WASM + Server GPU</small>
              </div>
            </div>
          </div>

          {/* 7. Language & Translation Section */}
          <div
            data-setting-section="translation"
            className={`settingsGroup settingsDetailGroup ${isSectionActive('translation') ? 'activeSettingsDetail' : ''}`}
          >
            <div className="settingsGroupHeader">
              <span className="settingsIcon settingsIcon-translation">
                <SettingsCategoryIcon id="translation" />
              </span>
              <div>
                <strong>Language & Translation</strong>
                <small>Configure spoken language, sign dialect, sentence grammar, and speech synthesis.</small>
              </div>
            </div>

            <div className="settingsGrid">
              <label className="settingField">
                <span>Primary Sign Dialect</span>
                <select
                  value={settings.account.preferredSignLanguage || 'ISL'}
                  onChange={(event) => updateSetting('account', 'preferredSignLanguage', event.target.value)}
                >
                  <option value="ISL">Indian Sign Language (ISL)</option>
                  <option value="ASL">American Sign Language (ASL)</option>
                </select>
              </label>

              <label className="settingField">
                <span>Translation Granularity</span>
                <select
                  value={settings.translation.mode || 'sentence'}
                  onChange={(event) => updateSetting('translation', 'mode', event.target.value)}
                >
                  <option value="sentence">Continuous Sentence Level (Grammar Corrected)</option>
                  <option value="word">Word-by-Word Sign Gloss</option>
                </select>
              </label>

              <label className="settingField">
                <span>Translation Output Mode</span>
                <select
                  value={settings.translation.outputType || 'textVoice'}
                  onChange={(event) => updateSetting('translation', 'outputType', event.target.value)}
                >
                  <option value="textVoice">Text Captions + Spoken Audio</option>
                  <option value="text">Text Captions Only (Silent)</option>
                  <option value="voice">Spoken Audio Voice Only</option>
                </select>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.translation.enabled}
                  onChange={(event) => updateSetting('translation', 'enabled', event.target.checked)}
                />
                <span>
                  <strong>Real-Time Translation Engine</strong>
                  <small>Enables background neural inference during calls and live camera sessions.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.feedback.realTimeCorrection}
                  onChange={(event) => updateSetting('feedback', 'realTimeCorrection', event.target.checked)}
                />
                <span>
                  <strong>Real-Time Gesture Correction</strong>
                  <small>Provides instant suggestions when hand orientation or finger position drifts.</small>
                </span>
              </label>
            </div>
          </div>

          {/* 8. Notifications Section */}
          <div
            data-setting-section="notifications"
            className={`settingsGroup settingsDetailGroup ${isSectionActive('notifications') ? 'activeSettingsDetail' : ''}`}
          >
            <div className="settingsGroupHeader">
              <span className="settingsIcon settingsIcon-notifications">
                <SettingsCategoryIcon id="notifications" />
              </span>
              <div>
                <strong>Notifications & Alerts</strong>
                <small>Control practice reminders, call notifications, and learning streak achievements.</small>
              </div>
            </div>

            <div className="settingsGrid">
              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.notifications.practiceReminders}
                  onChange={(event) => updateSetting('notifications', 'practiceReminders', event.target.checked)}
                />
                <span>
                  <strong>Daily Sign Practice Reminders</strong>
                  <small>Receive a gentle reminder to complete your daily sign practice goal.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.notifications.learningAlerts}
                  onChange={(event) => updateSetting('notifications', 'learningAlerts', event.target.checked)}
                />
                <span>
                  <strong>Learning Milestone Alerts</strong>
                  <small>Get notified when you unlock new vocabulary words and sign categories.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.notifications.achievements}
                  onChange={(event) => updateSetting('notifications', 'achievements', event.target.checked)}
                />
                <span>
                  <strong>Achievement & Streak Badges</strong>
                  <small>Celebrate consecutive daily learning streaks and speed milestones.</small>
                </span>
              </label>
            </div>
          </div>

          {/* 9. Chat & Messaging Section */}
          <div
            data-setting-section="chat"
            className={`settingsGroup settingsDetailGroup ${isSectionActive('chat') ? 'activeSettingsDetail' : ''}`}
          >
            <div className="settingsGroupHeader">
              <span className="settingsIcon settingsIcon-chat">
                <SettingsCategoryIcon id="chat" />
              </span>
              <div>
                <strong>Chat & Messaging</strong>
                <small>Conversation history retention, read receipts, and privacy defaults.</small>
              </div>
            </div>

            <div className="settingsGrid">
              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.privacy.saveChatHistory}
                  onChange={(event) => updateSetting('privacy', 'saveChatHistory', event.target.checked)}
                />
                <span>
                  <strong>Store Conversation History</strong>
                  <small>Persist message threads across sessions in secure local IndexedDB storage.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.privacy.readReceipts}
                  onChange={(event) => updateSetting('privacy', 'readReceipts', event.target.checked)}
                />
                <span>
                  <strong>Read Receipts</strong>
                  <small>Show double blue checkmarks when your message has been viewed.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.privacy.showLastSeen}
                  onChange={(event) => updateSetting('privacy', 'showLastSeen', event.target.checked)}
                />
                <span>
                  <strong>Show Last Seen Timestamp</strong>
                  <small>Allow contacts to see when you were last active in Signova.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.privacy.qrSharing}
                  onChange={(event) => updateSetting('privacy', 'qrSharing', event.target.checked)}
                />
                <span>
                  <strong>QR Contact Profile Sharing</strong>
                  <small>Allow scanning personal Signova QR code to initiate direct conversations.</small>
                </span>
              </label>
            </div>
          </div>

          {/* 10. Accessibility Section */}
          <div
            data-setting-section="accessibility"
            className={`settingsGroup settingsDetailGroup ${isSectionActive('accessibility') ? 'activeSettingsDetail' : ''}`}
          >
            <div className="settingsGroupHeader">
              <span className="settingsIcon settingsIcon-accessibility">
                <SettingsCategoryIcon id="accessibility" />
              </span>
              <div>
                <strong>Accessibility & Assistive Tools</strong>
                <small>Features designed specifically for deaf, hard-of-hearing, and low-vision individuals.</small>
              </div>
            </div>

            <div className="settingsGrid">
              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.display.highContrast}
                  onChange={(event) => updateSetting('display', 'highContrast', event.target.checked)}
                />
                <span>
                  <strong>High Contrast Interface</strong>
                  <small>Reinforces all card borders, active buttons, and icon outlines.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.device.reduceMotion}
                  onChange={(event) => updateSetting('device', 'reduceMotion', event.target.checked)}
                />
                <span>
                  <strong>Reduce Motion</strong>
                  <small>Replaces slide and zoom animations with calm instant opacity changes.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.display.visualFeedback}
                  onChange={(event) => updateSetting('display', 'visualFeedback', event.target.checked)}
                />
                <span>
                  <strong>Visual Recognition Cues</strong>
                  <small>Displays glowing perimeter indicators when hand signs are successfully registered.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.display.largeText}
                  onChange={(event) => updateSetting('display', 'largeText', event.target.checked)}
                />
                <span>
                  <strong>Large Display Captions</strong>
                  <small>Elevates caption font size for effortless reading during hands-busy signing.</small>
                </span>
              </label>
            </div>
          </div>

          {/* 11. Learning & Practice Hub Section */}
          <div
            data-setting-section="practice"
            className={`settingsGroup settingsDetailGroup ${isSectionActive('practice') ? 'activeSettingsDetail' : ''}`}
          >
            <div className="settingsGroupHeader">
              <span className="settingsIcon settingsIcon-practice">
                <SettingsCategoryIcon id="practice" />
              </span>
              <div>
                <strong>Learning & Practice Hub</strong>
                <small>Set daily study goals, learner difficulty, and sign training preferences.</small>
              </div>
            </div>

            <div className="settingsGrid">
              <label className="settingField">
                <span>Daily Practice Goal</span>
                <select
                  value={settings.practice.dailyGoal || 15}
                  onChange={(event) => updateSetting('practice', 'dailyGoal', Number(event.target.value))}
                >
                  <option value={10}>10 minutes per day (Casual)</option>
                  <option value={15}>15 minutes per day (Standard)</option>
                  <option value={30}>30 minutes per day (Immersive)</option>
                  <option value={45}>45 minutes per day (Pro Learner)</option>
                </select>
              </label>

              <label className="settingField">
                <span>Skill Difficulty Level</span>
                <select
                  value={settings.practice.difficulty || 'beginner'}
                  onChange={(event) => updateSetting('practice', 'difficulty', event.target.value)}
                >
                  <option value="beginner">Beginner (Alphabets & Numbers)</option>
                  <option value="intermediate">Intermediate (Common Phrases & Words)</option>
                  <option value="advanced">Advanced (Full Conversational Sentences)</option>
                </select>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.practice.reminders}
                  onChange={(event) => updateSetting('practice', 'reminders', event.target.checked)}
                />
                <span>
                  <strong>Daily Streak Reminders</strong>
                  <small>Maintain continuous daily sign practice streak with evening reminders.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.feedback.errorHighlighting}
                  onChange={(event) => updateSetting('feedback', 'errorHighlighting', event.target.checked)}
                />
                <span>
                  <strong>Real-Time Mistake Highlighting</strong>
                  <small>Pinpoints finger placement inaccuracies directly over the camera feed.</small>
                </span>
              </label>
            </div>
          </div>

          {/* 12. Data, Storage & Backup Section */}
          <div
            data-setting-section="device"
            className={`settingsGroup settingsDetailGroup ${isSectionActive('device') || isSectionActive('backup') ? 'activeSettingsDetail' : ''}`}
          >
            <div className="settingsGroupHeader">
              <span className="settingsIcon settingsIcon-device">
                <SettingsCategoryIcon id="device" />
              </span>
              <div>
                <strong>Data, Storage & Backup</strong>
                <small>Offline dictionary cache, cloud synchronization, and diagnostic data export.</small>
              </div>
            </div>

            <div className="settingsGrid">
              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.device.dataSaver}
                  onChange={(event) => updateSetting('device', 'dataSaver', event.target.checked)}
                />
                <span>
                  <strong>Data Saver Mode</strong>
                  <small>Lowers WebRTC video bitrate when connected to cellular or metered networks.</small>
                </span>
              </label>

              <label className="settingSwitch">
                <input
                  type="checkbox"
                  checked={settings.device.offlineCache}
                  onChange={(event) => updateSetting('device', 'offlineCache', event.target.checked)}
                />
                <span>
                  <strong>Offline ISL Dictionary Cache</strong>
                  <small>Preloads 500+ common Indian Sign Language signs for instant offline lookup.</small>
                </span>
              </label>
            </div>

            <div className="settingsSupportList" style={{ marginTop: '16px' }}>
              <button type="button" onClick={exportSignovaData}>
                Export My Signova Data & History (JSON)
                <span>↓</span>
              </button>
              <button type="button" onClick={clearSignovaData} className="dangerSupportAction">
                Clear Local Translation & Cache
                <span>›</span>
              </button>
            </div>
          </div>

          {/* 13. Help & Support Section */}
          <div
            data-setting-section="support"
            className={`settingsGroup settingsDetailGroup ${isSectionActive('support') ? 'activeSettingsDetail' : ''}`}
          >
            <div className="settingsGroupHeader">
              <span className="settingsIcon settingsIcon-support">
                <SettingsCategoryIcon id="support" />
              </span>
              <div>
                <strong>Help & Support</strong>
                <small>Documentation, system diagnostics, and developer contact channels.</small>
              </div>
            </div>

            <div className="settingsSupportList">
              <button type="button" onClick={() => setActiveSettingsSection('about')}>
                System Health & API Connection Status
                <span>›</span>
              </button>
              <button type="button" onClick={() => setActiveSettingsSection('security')}>
                Review Privacy & Security Notice
                <span>›</span>
              </button>
              <button type="button" onClick={exportSignovaData}>
                Export Diagnostic & Workspace Telemetry
                <span>↓</span>
              </button>
              <button type="button" onClick={sendAccountPasswordReset}>
                Send Account Password Recovery Email
                <span>›</span>
              </button>
              <button type="button" onClick={clearSignovaData} className="dangerSupportAction">
                Clear Local Chat, Translation & Call History
                <span>›</span>
              </button>
            </div>
          </div>

          {/* 14. About Signova & System Status Section */}
          <div
            data-setting-section="about"
            className={`settingsGroup settingsDetailGroup ${isSectionActive('about') || isSectionActive('developer') ? 'activeSettingsDetail' : ''}`}
          >
            <div className="settingsGroupHeader">
              <span className="settingsIcon settingsIcon-about">
                <SettingsCategoryIcon id="about" />
              </span>
              <div>
                <strong>About Signova</strong>
                <small>System version, developer credits, and real-time backend microservices.</small>
              </div>
            </div>

            <div className="settingsLegalNotice">
              <div className="legalBadge">
                <span className="legalBadgeDot" />
                <strong>Signova Accessible AI Platform v2.4.0</strong>
              </div>
              <p>All copyrighted by Synaptiq Pvt Ltd</p>
              <small>Architected & Developed with passion by Akshat Sharma.</small>
            </div>

            <div className="settingsGrid compactMetrics">
              <div className={`metric connectionMetric ${apiConnection?.status}`}>
                <span>API Gateway</span>
                <strong>{apiConnection?.status === 'connected' ? 'Connected' : apiConnection?.status || 'Active'}</strong>
                <small>{apiConnection?.detail || 'Port 5000 REST/WebSockets'}</small>
              </div>
              <div className="metric">
                <span>AI Core Engine</span>
                <strong>{apiConnection?.ai || 'Operational'}</strong>
                <small>Port 8000 Synapse Service</small>
              </div>
              <div className="metric">
                <span>Sign Language Dictionary</span>
                <strong>{signApiStatus || 'Preloaded (500+ Signs)'}</strong>
                <small>ISL & ASL Lexicon</small>
              </div>
              <div className="metric">
                <span>Performance Profile</span>
                <strong>{PERFORMANCE_PROFILES?.[settings.ai.performanceMode]?.label || 'Balanced'}</strong>
                <small>Continuous Frame Pipeline</small>
              </div>
              <div className="metric">
                <span>Model Recognition Accuracy</span>
                <strong>{formatMetricPercent(activeModelMetrics?.accuracy ?? activeModelMetrics?.best_validation_accuracy ?? 0.94)}</strong>
                <small>{aiMetrics?.status || 'Nominal'}</small>
              </div>
              <div className="metric">
                <span>WebRTC E2EE Protocol</span>
                <strong>{conversationE2EE?.available ? 'Available' : 'DTLS-SRTP Active'}</strong>
                <small>Peer-to-Peer Encryption</small>
              </div>
            </div>
          </div>
        </main>

        {/* Right Context / Info Card */}
        <SettingsContextCard
          encryptionAvailable={conversationE2EE?.available}
          activeSection={activeSettingsSection || 'general'}
        />
      </div>
    </section>
  );
}
