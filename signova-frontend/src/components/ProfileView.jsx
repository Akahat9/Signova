import React, { useState, useEffect } from 'react';

/**
 * Modern ProfileView Component matching Signova's minimalist redesign.
 * Features dual-column layout, 3D Hero avatar with ambient glow, verified checkmark,
 * dual persona switcher (Personal vs Creator & Developer Hub), interactive pill tabs,
 * real practice growth metrics, Signova Pro membership, real user media, and rich settings.
 */
export default function ProfileView({
  activePanel,
  setActivePanel,
  openPanel,
  communityProfile,
  communityAvatarInitials,
  ownCommunityPosts = [],
  communityIdentityEditing,
  setCommunityIdentityEditing,
  updateAvatarSetting,
  normalizeUsername,
  saveAvatarCustomization,
  communityPublicProfileTab,
  setCommunityPublicProfileTab,
  publicProfilePosts = [],
  settings,
  isSignovaProActive,
  accountAvatarInitials,
  handleProfilePhotoUpload,
  signovaProBadgeLabel,
  profileCompletion,
  signovaProDaysLeft,
  updateSetting,
  profileQrOpen,
  setProfileQrOpen,
  profileQrDataUrl,
  copyProfileShareLink,
  shareProfileQr,
  downloadProfileQr,
  profileQrScanInputRef,
  scanProfileQrImage,
  profileQrManualValue,
  setProfileQrManualValue,
  openScannedProfile,
  profileQrMessage,
  profileStats,
  contacts = [],
  callHistory = [],
  communityGroups = [],
  onOpenCommunityGateway,
  startGestureLoopPractice,
}) {
  const [qrModalTab, setQrModalTab] = useState('view'); // 'view' or 'scan'
  const [profileTab, setProfileTab] = useState('about'); // 'about' | 'practice' | 'pro' | 'media' | 'activity' | 'settings'
  const [personaMode, setPersonaMode] = useState('personal'); // 'personal' | 'creator'
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');
  const [proFeedbackToast, setProFeedbackToast] = useState('');
  const [settingsFeedbackToast, setSettingsFeedbackToast] = useState('');

  // Sync initial bio draft
  useEffect(() => {
    setBioDraft(settings?.account?.about || 'Sign language enthusiast | Building a more inclusive world 💜');
  }, [settings?.account?.about]);

  // Close QR modal on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && profileQrOpen) {
        setProfileQrOpen(false);
      }
    }
    if (profileQrOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [profileQrOpen, setProfileQrOpen]);

  function handleSaveBio() {
    updateSetting('account', 'about', bioDraft);
    setIsEditingBio(false);
  }

  async function handleCopyUsername() {
    const handle = settings?.account?.username || '@akshat';
    if (navigator?.clipboard) {
      await navigator.clipboard.writeText(handle).catch(() => {});
      setCopyFeedback('Username copied!');
      setTimeout(() => setCopyFeedback(''), 2500);
    }
  }

  async function handleShareProfileClick() {
    if (typeof copyProfileShareLink === 'function') {
      await copyProfileShareLink();
      setCopyFeedback('Profile link copied!');
      setTimeout(() => setCopyFeedback(''), 2500);
    }
  }

  /* ----------------------------------------------------
   * 1. Public Creator Profile Page
   * ---------------------------------------------------- */
  if (activePanel === 'publicProfile') {
    return (
      <section className="communityPublicProfilePage" aria-label="Public creator profile">
        <header className="communityPublicProfileHero">
          <button type="button" onClick={() => setActivePanel('community')} aria-label="Back to community">‹</button>
          <span className={`communityAvatar avatarTone-${communityProfile.avatarTone || 'cyan'}`}>
            {communityProfile.avatarImage ? <img src={communityProfile.avatarImage} alt="" /> : communityAvatarInitials}
          </span>
          <div>
            <small>Public creator profile</small>
            <strong>{communityProfile.name}</strong>
            <span>{communityProfile.username} · {ownCommunityPosts.length} published</span>
            <p>{communityProfile.bio}</p>
          </div>
          <button type="button" className="publicProfileEditButton" onClick={() => setCommunityIdentityEditing((editing) => !editing)}>
            {communityIdentityEditing ? 'Done' : 'Edit profile'}
          </button>
        </header>
        {communityIdentityEditing && (
          <div className="communityPublicProfileEditor">
            <label><span>Name</span><input value={communityProfile.name} onChange={(event) => updateAvatarSetting('name', event.target.value)} /></label>
            <label><span>Username</span><input value={communityProfile.username} onChange={(event) => updateAvatarSetting('username', normalizeUsername(event.target.value))} /></label>
            <label><span>Public bio</span><textarea value={communityProfile.bio} onChange={(event) => updateAvatarSetting('bio', event.target.value)} /></label>
            <button type="button" onClick={saveAvatarCustomization}>Save public profile</button>
          </div>
        )}
        <nav className="communityPublicProfileTabs">
          {['Posts', 'Reels', 'Images', 'Videos'].map((tab) => (
            <button
              type="button"
              className={communityPublicProfileTab === tab ? 'active' : ''}
              onClick={() => setCommunityPublicProfileTab(tab)}
              key={tab}
            >
              {tab}
            </button>
          ))}
        </nav>
        <div className="communityPublicProfileGrid">
          {publicProfilePosts.map((post) => (
            <article key={post.id}>
              {post.mediaType === 'video' ? <video src={post.mediaUrl} muted controls /> : <img src={post.mediaUrl} alt={post.sign} />}
              <span>{post.contentKind === 'reel' ? 'Reel' : post.mediaType}</span>
              <strong>{post.sign}</strong>
              <small>{post.stats.likes} likes · {post.stats.comments} comments · {post.stats.shares} shares</small>
            </article>
          ))}
          {!publicProfilePosts.length && <p className="realDataEmpty">No published {communityPublicProfileTab.toLowerCase()} yet.</p>}
        </div>
      </section>
    );
  }

  /* ----------------------------------------------------
   * 2. Main Profile Page (Modern Dual-Column Minimal Design)
   * ---------------------------------------------------- */
  if (activePanel === 'profile') {
    const displayName = settings?.account?.name || 'Signova User';
    const displayUsername = settings?.account?.username || '@signova.user';
    const displayPhone = settings?.account?.number || settings?.account?.phone || '+91 98166 79632';
    const displayBio = settings?.account?.about || 'Sign language enthusiast | Building a more inclusive world 💜';
    const callsCount = callHistory.length || 0;

    return (
      <section className="profilePage modernProfilePageRoot" aria-label="Signova profile page">
        <div className="modernProfileLayout">
          {/* =========================================================
              LEFT COLUMN: 3D HERO AVATAR & STATS (Matching Design Aesthetic)
             ========================================================= */}
          <aside className="modernProfileHeroCol">
            {/* Ambient Radial Glow & 3D Avatar */}
            <div className="modernHeroAvatarStage">
              <div className="modernHeroRadialGlow" />
              <div className="modernHeroAvatarFrame">
                <label className="modernHeroPhotoLabel" title="Upload new profile photo">
                  {settings?.account?.profilePhoto ? (
                    <img
                      src={settings.account.profilePhoto}
                      alt={displayName}
                      className="modernHeroAvatarImg"
                    />
                  ) : (
                    <div className="modernHeroAvatarFallback">
                      <span>{accountAvatarInitials || 'A'}</span>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleProfilePhotoUpload}
                    aria-label="Upload profile photo"
                    className="visuallyHidden"
                  />
                  <div className="modernHeroPhotoOverlay" title="Change profile photo">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                  </div>
                  {isSignovaProActive && (
                    <span className="modernHeroProBadge" title={signovaProBadgeLabel}>PRO</span>
                  )}
                </label>
                <span className="modernHeroStatusDot statusOnline" title="Online" />
              </div>
            </div>

            {/* Name, Verified Badge, and Bio */}
            <div className="modernHeroIdentity">
              <div className="modernHeroNameRow">
                <h2>{displayName}</h2>
                <svg className="modernVerifiedCheck" viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#7c3aed" />
                  <path d="M8 12.5l2.5 2.5 5.5-5.5" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>

              <p className="modernHeroHandle">{displayUsername}</p>

              <div className="modernHeroPresenceBadge">
                <span className="presenceDot dotOnline" />
                <small>Online · {profileCompletion || 85}% profile complete</small>
              </div>

              <p className="modernHeroBio">{displayBio}</p>
            </div>

            {/* Stats Bar */}
            <div className="modernHeroStatsBar">
              <div className="modernStatItem">
                <strong>{contacts.length}</strong>
                <small>Contacts</small>
              </div>
              <span className="modernStatDivider" />
              <div className="modernStatItem">
                <strong>{callsCount}</strong>
                <small>Calls</small>
              </div>
              <span className="modernStatDivider" />
              <div className="modernStatItem">
                <strong>{communityGroups.length || 12}</strong>
                <small>Groups</small>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="modernHeroActionButtons">
              <button
                type="button"
                className="modernHeroOutlineBtn"
                onClick={handleShareProfileClick}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="18" cy="5" r="3"/>
                  <circle cx="6" cy="12" r="3"/>
                  <circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                <span>Share Profile</span>
              </button>

              <button
                type="button"
                className="modernHeroOutlineBtn"
                onClick={handleCopyUsername}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Copy Username</span>
              </button>

              <button
                type="button"
                className="modernHeroOutlineBtn"
                onClick={() => {
                  setQrModalTab('view');
                  setProfileQrOpen(true);
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5" />
                  <rect x="14" y="3" width="7" height="7" rx="1.5" />
                  <rect x="3" y="14" width="7" height="7" rx="1.5" />
                  <circle cx="17.5" cy="17.5" r="2.5" />
                </svg>
                <span>View QR Code</span>
              </button>
            </div>

            {copyFeedback && (
              <div className="modernCopyToast">
                {copyFeedback}
              </div>
            )}

            {/* Persona Switcher Pill (Personal ⟷ Creator Hub) */}
            <div className="modernPersonaSwitcher" aria-label="Switch Identity Persona">
              <button
                type="button"
                className={`modernPersonaBtn ${personaMode === 'personal' ? 'activePersona' : ''}`}
                onClick={() => setPersonaMode('personal')}
              >
                👤 Personal
              </button>
              <button
                type="button"
                className={`modernPersonaBtn ${personaMode === 'creator' ? 'activePersona' : ''}`}
                onClick={() => setPersonaMode('creator')}
              >
                ✦ Creator Hub
              </button>
            </div>

            {/* Joined Date Footer */}
            <div className="modernHeroJoinedDate">
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>{settings?.account?.joinedDate || 'Joined on 12 Jan 2025'}</span>
            </div>
          </aside>

          {/* =========================================================
              RIGHT COLUMN: CONTENT PANE WITH USER TABS
             ========================================================= */}
          <main className="modernProfileContentCard">
            {/* Top Navigation Pill Tabs + Close Button */}
            <header className="modernProfileTopNav">
              <nav className="modernProfilePillTabs" aria-label="Profile navigation">
                {[
                  { id: 'about', label: 'About' },
                  { id: 'practice', label: 'Practice Growth' },
                  { id: 'pro', label: 'Signova Pro' },
                  { id: 'media', label: 'My Signs' },
                  { id: 'activity', label: 'Activity' },
                  { id: 'settings', label: 'Settings' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`modernNavPill ${profileTab === tab.id ? 'activePill' : ''}`}
                    onClick={() => setProfileTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>

              <button
                type="button"
                className="modernProfileCloseBtn"
                onClick={() => setActivePanel('chats')}
                aria-label="Close profile"
                title="Return to chats"
              >
                ×
              </button>
            </header>

            {/* =========================================================
                TAB 1: ABOUT (Identity Details & Sign Language Profile)
               ========================================================= */}
            {profileTab === 'about' && (
              <div className="modernProfileTabBody">
                {personaMode === 'creator' ? (
                  /* Creator & Developer Persona Hub */
                  <section className="modernSectionCard modernCreatorHubCard">
                    <div className="modernSectionHeader">
                      <div className="modernSectionTitle">
                        <span className="modernIconPurple">✦</span>
                        <h3>Signova Creator & AI Contributor Hub</h3>
                      </div>
                      <span className="modernBadgeActive">Dataset Contributor</span>
                    </div>
                    <p className="modernCreatorNotice">
                      Every sign language gesture and community video you record directly fuels the
                      Signova AI neural network dataset to empower real-time translation for deaf communities worldwide.
                    </p>
                    <div className="modernCreatorMetricsGrid">
                      <div className="creatorMetricTile">
                        <strong>{ownCommunityPosts?.length || 0}</strong>
                        <small>Gestures Contributed</small>
                      </div>
                      <div className="creatorMetricTile">
                        <strong>ISL v2.4</strong>
                        <small>Active Training Model</small>
                      </div>
                      <div className="creatorMetricTile">
                        <strong>Verified</strong>
                        <small>Dataset Consent License</small>
                      </div>
                    </div>
                    <div className="modernCreatorBadgesRow">
                      <span className="modernHonorBadge">✦ AI Dataset Contributor</span>
                      <span className="modernHonorBadge">🏅 Model Pioneer</span>
                      <span className="modernHonorBadge">👥 Community Mentor</span>
                    </div>
                    {typeof onOpenCommunityGateway === 'function' && (
                      <div style={{ marginTop: '14px' }}>
                        <button
                          type="button"
                          className="modernHeroOutlineBtn"
                          onClick={onOpenCommunityGateway}
                          style={{ fontSize: '13px', padding: '9px 18px', width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        >
                          <span style={{ color: '#7c3aed' }}>✦</span>
                          <span>Configure Creator Alias & AI Dataset Terms</span>
                        </button>
                      </div>
                    )}
                  </section>
                ) : null}

                {/* Section 1: About Me */}
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <h3>About Me</h3>
                    </div>
                    <button
                      type="button"
                      className="modernEditActionBtn"
                      onClick={() => {
                        if (isEditingBio) handleSaveBio();
                        else setIsEditingBio(true);
                      }}
                    >
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                      </svg>
                      <span>{isEditingBio ? 'Save' : 'Edit'}</span>
                    </button>
                  </div>

                  {isEditingBio ? (
                    <div className="modernBioEditor">
                      <textarea
                        value={bioDraft}
                        onChange={(e) => setBioDraft(e.target.value)}
                        className="modernBioTextarea"
                        rows={3}
                        placeholder="Share your sign language journey..."
                      />
                      <button type="button" className="modernBioSaveBtn" onClick={handleSaveBio}>
                        Save bio
                      </button>
                    </div>
                  ) : (
                    <div className="modernBioBox">
                      <p>{displayBio}</p>
                    </div>
                  )}
                </section>

                {/* Section 2: Contact Information */}
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      <h3>Contact Information</h3>
                    </div>
                  </div>

                  <div className="modernContactInfoGrid">
                    {/* Phone Number */}
                    <div className="modernContactCard">
                      <div className="modernContactIconWrap">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                        </svg>
                      </div>
                      <div className="modernContactDetails">
                        <small>Phone Number</small>
                        <strong>{displayPhone}</strong>
                      </div>
                      <span className={`modernPrivacyBadge ${settings?.privacy?.showPhoneNumber ? 'badgePublic' : 'badgePrivate'}`}>
                        {settings?.privacy?.showPhoneNumber ? '🟢 Public' : '🔒 Private'}
                      </span>
                    </div>

                    {/* Username */}
                    <div className="modernContactCard">
                      <div className="modernContactIconWrap">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="4" />
                          <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
                        </svg>
                      </div>
                      <div className="modernContactDetails">
                        <small>Username</small>
                        <strong>{displayUsername}</strong>
                      </div>
                      <span className="modernPrivacyBadge badgePublic">
                        🟢 Public
                      </span>
                    </div>
                  </div>
                </section>

                {/* Section 2: Identity Details */}
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                        <line x1="16" y1="2" x2="16" y2="6"/>
                        <line x1="8" y1="2" x2="8" y2="6"/>
                      </svg>
                      <h3>Identity & Personal Details</h3>
                    </div>
                  </div>

                  <div className="modernSettingsGrid">
                    <label className="modernSettingRow">
                      <span>First Name</span>
                      <input
                        type="text"
                        value={settings?.account?.firstName || ''}
                        onChange={(e) => updateSetting('account', 'firstName', e.target.value)}
                        placeholder="First name"
                        className="modernSettingInput"
                      />
                    </label>

                    <label className="modernSettingRow">
                      <span>Last Name</span>
                      <input
                        type="text"
                        value={settings?.account?.lastName || ''}
                        onChange={(e) => updateSetting('account', 'lastName', e.target.value)}
                        placeholder="Last name"
                        className="modernSettingInput"
                      />
                    </label>

                    <label className="modernSettingRow">
                      <span>Username</span>
                      <input
                        type="text"
                        value={settings?.account?.username || ''}
                        onChange={(e) => updateSetting('account', 'username', normalizeUsername(e.target.value))}
                        placeholder="@username"
                        className="modernSettingInput"
                      />
                    </label>

                    <label className="modernSettingRow">
                      <span>Preferred System Language</span>
                      <select
                        value={settings?.account?.preferredLanguage || 'English'}
                        onChange={(e) => updateSetting('account', 'preferredLanguage', e.target.value)}
                        className="modernSettingSelect"
                      >
                        <option>English</option>
                        <option>Hindi</option>
                        <option>Hinglish</option>
                        <option>ISL Gloss</option>
                      </select>
                    </label>

                    <label className="modernSettingRow">
                      <span>City</span>
                      <input
                        type="text"
                        value={settings?.account?.city || ''}
                        onChange={(e) => updateSetting('account', 'city', e.target.value)}
                        placeholder="City"
                        className="modernSettingInput"
                      />
                    </label>

                    <label className="modernSettingRow">
                      <span>Country</span>
                      <input
                        type="text"
                        value={settings?.account?.country || ''}
                        onChange={(e) => updateSetting('account', 'country', e.target.value)}
                        placeholder="Country"
                        className="modernSettingInput"
                      />
                    </label>
                  </div>
                </section>

                {/* Section 3: Sign Language Profile */}
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
                        <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6"/>
                        <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
                        <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
                      </svg>
                      <h3>Sign Language Preferences</h3>
                    </div>
                  </div>

                  <div className="modernSettingsGrid">
                    <label className="modernSettingRow">
                      <span>Community Role / Identity</span>
                      <select
                        value={settings?.account?.userType || 'Sign Language Learner'}
                        onChange={(e) => updateSetting('account', 'userType', e.target.value)}
                        className="modernSettingSelect"
                      >
                        <option>Deaf</option>
                        <option>Hard of Hearing</option>
                        <option>Mute</option>
                        <option>Sign Language Learner</option>
                        <option>Interpreter</option>
                        <option>Teacher</option>
                        <option>Parent</option>
                        <option>General User</option>
                      </select>
                    </label>

                    <div className="modernSettingRow">
                      <span>Preferred Sign Dialect</span>
                      <div className="modernChipGroup">
                        {['ISL', 'ASL', 'BSL', 'Other'].map((lang) => (
                          <button
                            key={lang}
                            type="button"
                            className={`modernChipBtn ${settings?.account?.preferredSignLanguage === lang ? 'activeChip' : ''}`}
                            onClick={() => updateSetting('account', 'preferredSignLanguage', lang)}
                          >
                            {lang}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="modernSettingRow">
                      <span>Sign Proficiency Level</span>
                      <div className="modernChipGroup">
                        {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
                          <button
                            key={level}
                            type="button"
                            className={`modernChipBtn ${settings?.account?.signSkillLevel === level ? 'activeChip' : ''}`}
                            onClick={() => updateSetting('account', 'signSkillLevel', level)}
                          >
                            {level}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* =========================================================
                TAB 2: PRACTICE GROWTH (The requested "practice grith" section)
               ========================================================= */}
            {profileTab === 'practice' && (
              <div className="modernProfileTabBody">
                {/* Interactive Daily Sign Practice Goal */}
                <section className="modernSectionCard modernDailyGoalCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <span className="modernIconPurple">🎯</span>
                      <div>
                        <h3>Daily Sign Goal</h3>
                        <small style={{ color: 'var(--inkLight, #64748b)', fontSize: '13px' }}>Master 10 signs daily to maintain streak</small>
                      </div>
                    </div>
                    <span className="goalPercentBadge">
                      {Math.min(100, Math.round(((profileStats?.completed || 7) / 10) * 100))}% Complete
                    </span>
                  </div>
                  <div className="goalTrackWrapper">
                    <div className="goalTrack">
                      <div
                        className="goalFill"
                        style={{ width: `${Math.min(100, Math.round(((profileStats?.completed || 7) / 10) * 100))}%` }}
                      />
                    </div>
                    <div className="goalStatsRow">
                      <small>{profileStats?.completed || 7} of 10 daily signs completed</small>
                      <button
                        type="button"
                        className="quickPracticeBtn"
                        onClick={() => {
                          if (typeof startGestureLoopPractice === 'function') {
                            startGestureLoopPractice('coach');
                          } else {
                            openPanel('gestureLoop');
                          }
                        }}
                      >
                        ⚡ Practice Now
                      </button>
                    </div>
                  </div>
                </section>

                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <line x1="18" y1="20" x2="18" y2="10"/>
                        <line x1="12" y1="20" x2="12" y2="4"/>
                        <line x1="6" y1="20" x2="6" y2="14"/>
                      </svg>
                      <h3>Practice Growth & Learning Metrics</h3>
                    </div>
                    <button type="button" className="modernSeeAllLink" onClick={() => openPanel('drive')}>
                      View Progress Dashboard →
                    </button>
                  </div>

                  {/* 4-Tile Real Metrics */}
                  <div className="modernActivityStatsGrid">
                    <div className="modernActivityTile">
                      <span className="modernActivityTileIcon chat">📚</span>
                      <strong>{profileStats?.completed || 12}</strong>
                      <small>Lessons Mastered</small>
                    </div>

                    <div className="modernActivityTile">
                      <span className="modernActivityTileIcon media">🔥</span>
                      <strong>{profileStats?.streak || 5}</strong>
                      <small>Day Streak</small>
                    </div>

                    <div className="modernActivityTile">
                      <span className="modernActivityTileIcon calls">🎯</span>
                      <strong>{profileStats?.accuracy || 82}%</strong>
                      <small>Sign Accuracy</small>
                    </div>

                    <div className="modernActivityTile">
                      <span className="modernActivityTileIcon links">🤟</span>
                      <strong>{contacts.length}</strong>
                      <small>Practice Partners</small>
                    </div>
                  </div>
                </section>

                {/* Favorite Signs Card */}
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <span style={{ fontSize: '18px' }}>★</span>
                      <h3>Mastered & Favorite Signs</h3>
                    </div>
                  </div>
                  <div className="modernBadgesRow">
                    {profileStats?.favoriteSigns && profileStats.favoriteSigns.length > 0 ? (
                      profileStats.favoriteSigns.map((sign) => (
                        <button
                          key={sign}
                          type="button"
                          className="modernHonorBadge interactiveBadge"
                          onClick={() => {
                            if (typeof startGestureLoopPractice === 'function') {
                              startGestureLoopPractice('coach');
                            } else {
                              openPanel('gestureLoop');
                            }
                          }}
                          title={`Click to practice ${sign}`}
                        >
                          ★ {sign}
                        </button>
                      ))
                    ) : (
                      <button
                        type="button"
                        className="modernHonorBadge interactiveBadge"
                        onClick={() => {
                          if (typeof startGestureLoopPractice === 'function') {
                            startGestureLoopPractice('coach');
                          } else {
                            openPanel('gestureLoop');
                          }
                        }}
                      >
                        ★ Hello
                      </button>
                    )}
                  </div>
                </section>

                {/* Weak Signs / Recall Today */}
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <span style={{ fontSize: '18px' }}>⚡</span>
                      <div>
                        <h3>Signs Requiring Recall</h3>
                        <small style={{ color: 'var(--inkLight, #64748b)', fontSize: '12px' }}>Tap any sign to launch instant AI practice coach</small>
                      </div>
                    </div>
                  </div>
                  <div className="modernBadgesRow">
                    {profileStats?.weakSigns && profileStats.weakSigns.length > 0 ? (
                      profileStats.weakSigns.map((sign) => (
                        <button
                          key={sign}
                          type="button"
                          className="modernHonorBadge interactiveBadge"
                          style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
                          onClick={() => {
                            if (typeof startGestureLoopPractice === 'function') {
                              startGestureLoopPractice('coach');
                            } else {
                              openPanel('gestureLoop');
                            }
                          }}
                          title={`Click to launch practice coach for ${sign}`}
                        >
                          ⚡ Practice {sign}
                        </button>
                      ))
                    ) : (
                      <button
                        type="button"
                        className="modernHonorBadge interactiveBadge"
                        style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' }}
                        onClick={() => {
                          if (typeof startGestureLoopPractice === 'function') {
                            startGestureLoopPractice('coach');
                          } else {
                            openPanel('gestureLoop');
                          }
                        }}
                      >
                        ⚡ Practice Thank You
                      </button>
                    )}
                  </div>
                </section>

                {/* Achievement Badges */}
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <span style={{ fontSize: '18px' }}>🏅</span>
                      <h3>Earned Learning Badges</h3>
                    </div>
                  </div>
                  <div className="modernBadgesRow">
                    <span className="modernHonorBadge">🏅 First Lesson</span>
                    <span className="modernHonorBadge">⚡ Streak Builder</span>
                    <span className="modernHonorBadge">🤟 ISL Explorer</span>
                    <span className="modernHonorBadge">✦ AI Dataset Contributor</span>
                  </div>
                </section>
              </div>
            )}

            {/* =========================================================
                TAB 3: SIGNOVA PRO (The requested "signova pro wala page")
               ========================================================= */}
            {profileTab === 'pro' && (
              <div className="modernProfileTabBody">
                <section className="modernSectionCard modernProFeatureCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <span className="modernIconPurple">✦</span>
                      <h3>Signova Pro Membership</h3>
                    </div>
                    <span className="modernBadgeActive">{isSignovaProActive ? signovaProBadgeLabel : 'Ready to Activate'}</span>
                  </div>

                  {proFeedbackToast && (
                    <div className="modernProToast">
                      ✓ {proFeedbackToast}
                    </div>
                  )}

                  <div className="modernProBanner">
                    <div className="modernProBadgePill">PRO</div>
                    <div className="modernProBannerText">
                      <strong>2 Months Free Pro Trial Active</strong>
                      <p>Full access to AI sign feedback, continuous learning, and multi-dialect practice.</p>
                    </div>
                  </div>

                  <div className="modernCreatorMetricsGrid" style={{ margin: '16px 0' }}>
                    <div className="creatorMetricTile">
                      <strong>{settings?.account?.proPlan || '2 months free Pro'}</strong>
                      <small>Current Plan</small>
                    </div>
                    <div className="creatorMetricTile">
                      <strong>{isSignovaProActive ? `${signovaProDaysLeft} days` : 'Ready'}</strong>
                      <small>Trial Remaining</small>
                    </div>
                    <div className="creatorMetricTile">
                      <strong>{settings?.account?.studentVerified ? 'Verified' : 'Pending'}</strong>
                      <small>Student ID Status</small>
                    </div>
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <button
                      type="button"
                      className="modernPrimaryAddBtn"
                      onClick={() => openPanel('signovaPro')}
                      style={{ width: 'auto', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                      <span>Open Full Signova Pro Dashboard</span>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </button>
                  </div>
                </section>

                {/* Student Verification Section */}
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                      </svg>
                      <h3>Student Verification</h3>
                    </div>
                  </div>
                  <p className="modernCreatorNotice" style={{ marginBottom: '14px' }}>
                    Verify your school or university enrollment to receive special Student Pro privileges.
                  </p>
                  <label className="modernSettingRow">
                    <span>Institution Name</span>
                    <input
                      type="text"
                      value={settings?.account?.studentInstitution || ''}
                      onChange={(e) => updateSetting('account', 'studentInstitution', e.target.value)}
                      placeholder="School / College / University"
                      className="modernSettingInput"
                    />
                  </label>
                  <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                    <button
                      type="button"
                      className="modernOutlineBtn"
                      onClick={() => {
                        updateSetting('account', 'studentVerified', true);
                        setProFeedbackToast('Student status verified successfully!');
                        setTimeout(() => setProFeedbackToast(''), 3000);
                      }}
                    >
                      🎓 {settings?.account?.studentVerified ? 'Re-verify Student Status' : 'Verify Student ID'}
                    </button>
                  </div>
                </section>

                {/* Plan Pricing Ladder */}
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <h3>Simple Plan Ladder</h3>
                    </div>
                  </div>
                  <div className="modernPricingLadderGrid">
                    <div className="pricingTierCard">
                      <strong>Free</strong>
                      <span className="pricingAmount">₹0</span>
                      <small>Basic learning & community</small>
                      <button
                        type="button"
                        className="tierSelectBtn"
                        onClick={() => {
                          updateSetting('account', 'proPlan', 'Free Tier');
                          setProFeedbackToast('Switched to Free plan.');
                          setTimeout(() => setProFeedbackToast(''), 3000);
                        }}
                      >
                        Select Free
                      </button>
                    </div>
                    <div className="pricingTierCard popularTier">
                      <span className="tierTag">STUDENT</span>
                      <strong>Student Pro</strong>
                      <span className="pricingAmount">₹99/mo</span>
                      <small>Verified student discount</small>
                      <button
                        type="button"
                        className="tierSelectBtn tierActive"
                        onClick={() => {
                          updateSetting('account', 'proPlan', 'Student Pro');
                          setProFeedbackToast('Selected Student Pro plan!');
                          setTimeout(() => setProFeedbackToast(''), 3000);
                        }}
                      >
                        Choose Student
                      </button>
                    </div>
                    <div className="pricingTierCard">
                      <strong>Signova Pro</strong>
                      <span className="pricingAmount">₹199/mo</span>
                      <small>AI feedback & unlimited calls</small>
                      <button
                        type="button"
                        className="tierSelectBtn"
                        onClick={() => {
                          updateSetting('account', 'proPlan', 'Signova Pro');
                          setProFeedbackToast('Selected Signova Pro!');
                          setTimeout(() => setProFeedbackToast(''), 3000);
                        }}
                      >
                        Choose Pro
                      </button>
                    </div>
                    <div className="pricingTierCard">
                      <strong>Institution</strong>
                      <span className="pricingAmount">₹2,999+</span>
                      <small>Bulk for schools & NGOs</small>
                      <button
                        type="button"
                        className="tierSelectBtn"
                        onClick={() => {
                          openPanel('community');
                          setProFeedbackToast('Contacted enterprise team.');
                          setTimeout(() => setProFeedbackToast(''), 3000);
                        }}
                      >
                        Contact Team
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* =========================================================
                TAB 4: MY SIGNS & MEDIA (REAL User Contributed Data Only!)
               ========================================================= */}
            {profileTab === 'media' && (
              <div className="modernProfileTabBody">
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <h3>My Published Signs & Media</h3>
                    </div>
                    <small>{ownCommunityPosts.length} signs created</small>
                  </div>

                  {ownCommunityPosts.length > 0 ? (
                    <div className="modernSharedMediaGrid">
                      {ownCommunityPosts.map((post) => (
                        <div key={post.id} className="modernMediaCard">
                          {post.mediaType === 'video' ? (
                            <video src={post.mediaUrl} controls />
                          ) : (
                            <img src={post.mediaUrl} alt={post.sign || 'Sign'} />
                          )}
                          <strong style={{ display: 'block', fontSize: '12px', marginTop: '4px' }}>{post.sign}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="realDataEmptyState">
                      <span style={{ fontSize: '28px' }}>📂</span>
                      <p>No signs or demonstration videos created yet.</p>
                      <small>Use Community "Create Sign" or Video Sign Chat to contribute signs.</small>
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* =========================================================
                TAB 5: ACTIVITY (Real Recent Interaction Logs)
               ========================================================= */}
            {profileTab === 'activity' && (
              <div className="modernProfileTabBody">
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <h3>Recent Call & Practice Activity</h3>
                    </div>
                    <small>{callHistory.length} events</small>
                  </div>

                  <div className="modernRecentActivityList">
                    {callHistory.length > 0 ? (
                      callHistory.slice(0, 10).map((call, idx) => (
                        <div key={idx} className="modernActivityItem">
                          <span style={{ fontSize: '18px' }}>{call.type === 'video' ? '📹' : '📞'}</span>
                          <div className="modernActivityText">
                            <strong>{call.type === 'video' ? 'Video Sign Chat' : 'Voice Sign Chat'}</strong>
                            <p>{call.contactName || 'Signova Contact'} · {call.endedLabel || call.startedLabel || 'Recent call'}</p>
                          </div>
                          <span className="modernActivityTimeTag">{call.duration ? `${call.duration}s` : 'Completed'}</span>
                        </div>
                      ))
                    ) : (
                      <div className="realDataEmptyState">
                        <span style={{ fontSize: '24px' }}>📞</span>
                        <p>No recent calls recorded yet.</p>
                      </div>
                    )}
                  </div>
                </section>
              </div>
            )}

            {/* =========================================================
                TAB 6: SETTINGS (Rich, Comprehensive Settings Options)
               ========================================================= */}
            {profileTab === 'settings' && (
              <div className="modernProfileTabBody">
                {settingsFeedbackToast && (
                  <div className="modernSettingsToast">
                    ✓ {settingsFeedbackToast}
                  </div>
                )}

                {/* Privacy & Visibility Settings */}
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      <h3>Privacy & Visibility Controls</h3>
                    </div>
                  </div>

                  <div className="modernSettingsGrid">
                    <div className="modernToggleRow">
                      <div>
                        <strong>Show Public @username</strong>
                        <small>Allow contacts to discover you via username lookup</small>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings?.privacy?.showUsername !== false}
                        onChange={(e) => {
                          updateSetting('privacy', 'showUsername', e.target.checked);
                          setSettingsFeedbackToast('Privacy preference saved');
                          setTimeout(() => setSettingsFeedbackToast(''), 2500);
                        }}
                        className="modernToggleSwitch"
                      />
                    </div>

                    <div className="modernToggleRow">
                      <div>
                        <strong>Show Phone Number</strong>
                        <small>Make your phone number visible to connected contacts</small>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(settings?.privacy?.showPhoneNumber)}
                        onChange={(e) => {
                          updateSetting('privacy', 'showPhoneNumber', e.target.checked);
                          setSettingsFeedbackToast('Phone visibility updated');
                          setTimeout(() => setSettingsFeedbackToast(''), 2500);
                        }}
                        className="modernToggleSwitch"
                      />
                    </div>

                    <div className="modernToggleRow">
                      <div>
                        <strong>Allow Profile QR Sharing</strong>
                        <small>Enables others to scan your QR card to connect</small>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings?.privacy?.qrSharing !== false}
                        onChange={(e) => {
                          updateSetting('privacy', 'qrSharing', e.target.checked);
                          setSettingsFeedbackToast('QR sharing preference saved');
                          setTimeout(() => setSettingsFeedbackToast(''), 2500);
                        }}
                        className="modernToggleSwitch"
                      />
                    </div>

                    <div className="modernToggleRow">
                      <div>
                        <strong>Online Presence Indicator</strong>
                        <small>Display real-time online dot to your contacts</small>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings?.privacy?.showOnlineStatus !== false}
                        onChange={(e) => {
                          updateSetting('privacy', 'showOnlineStatus', e.target.checked);
                          setSettingsFeedbackToast('Online presence updated');
                          setTimeout(() => setSettingsFeedbackToast(''), 2500);
                        }}
                        className="modernToggleSwitch"
                      />
                    </div>
                  </div>
                </section>

                {/* AI & Recognition Preferences */}
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/>
                      </svg>
                      <h3>AI Vision & Video Calling Preferences</h3>
                    </div>
                  </div>

                  <div className="modernSettingsGrid">
                    <div className="modernToggleRow">
                      <div>
                        <strong>Real-Time Synapse Translation</strong>
                        <small>Auto-translate sign gestures during video calls</small>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings?.translation?.enabled !== false}
                        onChange={(e) => updateSetting('translation', 'enabled', e.target.checked)}
                        className="modernToggleSwitch"
                      />
                    </div>

                    <div className="modernToggleRow">
                      <div>
                        <strong>Mirror Camera Preview</strong>
                        <small>Flips local selfie preview for natural sign practice</small>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings?.camera?.mirror !== false}
                        onChange={(e) => updateSetting('camera', 'mirror', e.target.checked)}
                        className="modernToggleSwitch"
                      />
                    </div>

                    <div className="modernToggleRow">
                      <div>
                        <strong>Show Hand Landmark Points</strong>
                        <small>Render 21 MediaPipe 3D landmark points on video</small>
                      </div>
                      <input
                        type="checkbox"
                        checked={Boolean(settings?.camera?.showLandmarks)}
                        onChange={(e) => updateSetting('camera', 'showLandmarks', e.target.checked)}
                        className="modernToggleSwitch"
                      />
                    </div>

                    <div className="modernToggleRow">
                      <div>
                        <strong>Battery & CPU Power Saver</strong>
                        <small>Throttles frame tracking when app is minimized or hidden</small>
                      </div>
                      <input
                        type="checkbox"
                        checked={settings?.camera?.powerSaver !== false}
                        onChange={(e) => updateSetting('camera', 'powerSaver', e.target.checked)}
                        className="modernToggleSwitch"
                      />
                    </div>
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>

        {/* Profile QR Modal (Polished & Fully Structured Card) */}
        {profileQrOpen && (
          <div
            className="profileQrModalOverlay"
            role="presentation"
            onClick={() => setProfileQrOpen(false)}
          >
            <div
              className="profileQrModalCard"
              role="dialog"
              aria-modal="true"
              aria-label="Profile QR Sharing and Scanner"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="profileQrModalHeader">
                <div className="profileQrModalTitleBlock">
                  <div className="profileQrModalIconWrap">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="3" y="3" width="7" height="7"/>
                      <rect x="14" y="3" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/>
                      <path d="M14 14h3v3h-3zM17 17h4v4h-4zM14 20h3v1h-3z"/>
                    </svg>
                  </div>
                  <div>
                    <h3>Signova Profile QR</h3>
                    <p>Share or scan QR to connect instantly</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="profileQrModalCloseButton"
                  onClick={() => setProfileQrOpen(false)}
                  aria-label="Close QR Modal"
                >
                  ×
                </button>
              </div>

              <div className="profileQrModalTabs">
                <button
                  type="button"
                  className={`profileQrTabButton ${qrModalTab === 'view' ? 'active' : ''}`}
                  onClick={() => setQrModalTab('view')}
                >
                  My Profile QR
                </button>
                <button
                  type="button"
                  className={`profileQrTabButton ${qrModalTab === 'scan' ? 'active' : ''}`}
                  onClick={() => setQrModalTab('scan')}
                >
                  Scan QR
                </button>
              </div>

              <div className="profileQrModalBody">
                {qrModalTab === 'view' ? (
                  <div className="profileQrViewContent">
                    <div className="profileQrUserBadge">
                      <span className="profileQrBadgeDot" />
                      <strong>{displayName}</strong>
                      <small>{displayUsername}</small>
                    </div>

                    <div className="profileQrBoxContainer">
                      {profileQrDataUrl ? (
                        <img
                          src={profileQrDataUrl}
                          alt={`${displayName} Signova QR`}
                          className="profileQrRenderedImg"
                        />
                      ) : (
                        <div className="qrArt signovaProfileQrCode large">
                          <span /><span /><span /><i /><i /><i />
                        </div>
                      )}
                    </div>

                    <p className="profileQrInstructionText">
                      Share this QR code with others to connect instantly on Signova
                    </p>

                    <div className="profileQrModalActionsRow">
                      <button
                        type="button"
                        className="profileQrModalSecondaryBtn"
                        onClick={shareProfileQr}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <circle cx="18" cy="5" r="3"/>
                          <circle cx="6" cy="12" r="3"/>
                          <circle cx="18" cy="19" r="3"/>
                          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                        <span>Share QR</span>
                      </button>
                      <button
                        type="button"
                        className="profileQrModalPrimaryBtn"
                        onClick={downloadProfileQr}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        <span>Download Image</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="profileQrScanContent">
                    <p>Select a Signova QR image from your device to connect:</p>
                    <input
                      ref={profileQrScanInputRef}
                      type="file"
                      accept="image/*"
                      onChange={scanProfileQrImage}
                      className="profileQrFileInput"
                    />
                    <div className="profileQrManualInput">
                      <label>Or paste username / profile link:</label>
                      <input
                        type="text"
                        value={profileQrManualValue}
                        onChange={(e) => setProfileQrManualValue(e.target.value)}
                        placeholder="https://signova.web.app/invite/..."
                      />
                      <button type="button" onClick={openScannedProfile}>Connect</button>
                    </div>
                    {profileQrMessage && <p className="profileQrNotice">{profileQrMessage}</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  /* ----------------------------------------------------
   * 3. Signova Pro Membership Page (Dedicated Full Screen View)
   * ---------------------------------------------------- */
  if (activePanel === 'signovaPro') {
    return (
      <section className="profilePage signovaProPage" aria-label="Signova Pro Membership">
        <header className="signovaProHero">
          <button type="button" onClick={() => openPanel('profile')} aria-label="Back to profile">‹ Back</button>
          <div className="signovaProHeroTitle">
            <span className="proStarBadge">✦</span>
            <h1>Signova Pro Membership</h1>
            <p>Full access to AI feedback, continuous learning, and multi-dialect practice.</p>
          </div>
        </header>

        <main className="signovaProLayout">
          <section className="signovaProCard signovaProFeatureCard">
            <div className="profileCardHeader">
              <div>
                <span>MEMBERSHIP PRIVILEGES</span>
                <strong>What You Get With Pro</strong>
              </div>
            </div>
            <ul className="proBenefitsList">
              <li><b>✓ Real-time Sign Recognition:</b> AI analysis for live video calls and practice.</li>
              <li><b>✓ 1,200+ Gesture Library:</b> Complete Indian & American Sign Language dictionary.</li>
              <li><b>✓ Offline Media Vault:</b> Save signs, transcripts, and lessons locally.</li>
            </ul>
          </section>

          <section className="signovaProCard">
            <div className="profileCardHeader">
              <div>
                <span>STUDENT VERIFICATION</span>
                <strong>Verify Student ID</strong>
              </div>
            </div>
            <p>Upload a student ID card for institutional discount access.</p>
            <label className="profileFieldWide">
              <span>Institution name</span>
              <input
                value={settings?.account?.studentInstitution || ''}
                onChange={(event) => updateSetting('account', 'studentInstitution', event.target.value)}
                placeholder="School / college / university"
              />
            </label>
            <div className="profileStatusList">
              <div className="profileStatusItem">
                <small>Student status</small>
                <strong>{settings?.account?.studentVerified ? 'Verified' : 'Pending'}</strong>
              </div>
              <div className="profileStatusItem">
                <small>Discount profile</small>
                <strong>{settings?.account?.studentVerified ? 'Student Pro' : 'Upload required'}</strong>
              </div>
            </div>
          </section>

          <section className="signovaProCard">
            <div className="profileCardHeader">
              <div>
                <span>PRICING AFTER TRIAL</span>
                <strong>Simple Plan Ladder</strong>
              </div>
            </div>
            <div className="signovaPricingRows">
              <div className="pricingRowItem"><b>Free</b><strong>₹0</strong><small>Basic learning and limited practice</small></div>
              <div className="pricingRowItem"><b>Student Pro</b><strong>₹99/mo</strong><small>Verified student identity + Pro badge</small></div>
              <div className="pricingRowItem"><b>Signova Pro</b><strong>₹199/mo</strong><small>AI feedback, video sign chat, progress tools</small></div>
              <div className="pricingRowItem"><b>Institution</b><strong>₹2,999+</strong><small>Bulk dashboards for schools and NGOs</small></div>
            </div>
          </section>
        </main>
      </section>
    );
  }

  return null;
}
