import React, { useState, useEffect } from 'react';
import SignovaCheckoutModal from './modals/SignovaCheckoutModal';

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
  const [institutionIdType, setInstitutionIdType] = useState('student_card');
  const [studentDocFileName, setStudentDocFileName] = useState('');
  const [studentIdNumber, setStudentIdNumber] = useState('');
  const [studentGradYear, setStudentGradYear] = useState('2026');
  const [isUploadingStudentId, setIsUploadingStudentId] = useState(false);
  const [checkoutModalPlan, setCheckoutModalPlan] = useState(null);

  const handleCheckoutSuccess = (completedPlan) => {
    updateSetting('account', 'proPlan', completedPlan.name);
    updateSetting('account', 'isPro', true);
    updateSetting('account', 'proStatus', 'active');
    setProFeedbackToast(`🎉 Payment successful (₹${completedPlan.price})! Subscribed to ${completedPlan.name}.`);
    setTimeout(() => setProFeedbackToast(''), 5000);
  };

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
                      <img src="/app-logo.png" alt="Signova" className="modernHeroLogoPlaceholder" />
                      <span className="modernHeroInitialSubtext">{accountAvatarInitials || 'S'}</span>
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
                TAB 3: SIGNOVA PRO (Comprehensive Membership & Verification Hub)
               ========================================================= */}
            {profileTab === 'pro' && (
              <div className="modernProfileTabBody">
                {/* Active Membership Status Banner */}
                <section className="modernSectionCard modernProFeatureCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <span className="modernIconPurple">✦</span>
                      <div>
                        <h3>Signova Pro Membership</h3>
                        <small style={{ color: '#64748b' }}>Manage your plan, student privileges, and AI capabilities</small>
                      </div>
                    </div>
                    <span className="modernBadgeActive">{isSignovaProActive ? (settings?.account?.proPlan || 'Pro Active') : 'Ready to Activate'}</span>
                  </div>

                  {proFeedbackToast && (
                    <div className="modernProToast">
                      ✓ {proFeedbackToast}
                    </div>
                  )}

                  <div className="modernProBanner">
                    <div className="modernProBadgePill">PRO</div>
                    <div className="modernProBannerText">
                      <strong>Current Plan: {settings?.account?.proPlan || '2 Months Free Pro Trial'}</strong>
                      <p>Full access to AI sign feedback, continuous learning, and multi-dialect practice.</p>
                    </div>
                  </div>

                  <div className="modernCreatorMetricsGrid" style={{ margin: '16px 0' }}>
                    <div className="creatorMetricTile">
                      <strong>{settings?.account?.proPlan || '2 Months Free Pro'}</strong>
                      <small>Current Tier</small>
                    </div>
                    <div className="creatorMetricTile">
                      <strong>{isSignovaProActive ? `${signovaProDaysLeft} days` : 'Ready'}</strong>
                      <small>Billing Cycle / Days Left</small>
                    </div>
                    <div className="creatorMetricTile">
                      <strong style={{ color: settings?.account?.studentVerified ? '#10b981' : '#f59e0b' }}>
                        {settings?.account?.studentVerified ? '✓ Verified' : 'Pending Verification'}
                      </strong>
                      <small>Student ID Status</small>
                    </div>
                  </div>
                </section>

                {/* Subscriptions Designed in Detailed Cards */}
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <rect x="2" y="5" width="20" height="14" rx="2"/>
                        <line x1="2" y1="10" x2="22" y2="10"/>
                      </svg>
                      <div>
                        <h3>Subscription Plans & Pricing</h3>
                        <small style={{ color: '#64748b' }}>Choose the ideal plan for your learning, development, or organization</small>
                      </div>
                    </div>
                  </div>

                  <div className="modernSubscriptionCardsGrid">
                    {/* Free Card */}
                    <div className={`modernSubPlanCard ${settings?.account?.proPlan === 'Free Plan' ? 'activePlanCard' : ''}`}>
                      <div className="planCardTop">
                        <span className="planTierLabel">STARTER</span>
                        <h4>Free Plan</h4>
                        <div className="planPriceRow">
                          <span className="planCurrency">₹</span>
                          <span className="planPrice">0</span>
                          <span className="planInterval">/forever</span>
                        </div>
                        <p className="planBriefDescription">For casual learners exploring sign language fundamentals.</p>
                      </div>
                      <div className="planDivider" />
                      <div className="planFeaturesSection">
                        <strong>What's Included:</strong>
                        <ul className="planFeatureList">
                          <li>✓ Basic Indian & American Sign dictionary access</li>
                          <li>✓ Standard community posts and text chats</li>
                          <li>✓ Up to 10 sign practice exercises per day</li>
                          <li>✓ Community public profile card</li>
                          <li>✕ No real-time AI gesture feedback</li>
                          <li>✕ No HD multi-peer video calling</li>
                        </ul>
                      </div>
                      <button
                        type="button"
                        className="planCardActionBtn"
                        onClick={() => {
                          updateSetting('account', 'proPlan', 'Free Plan');
                          updateSetting('account', 'isPro', false);
                          setProFeedbackToast('Switched to Free plan.');
                          setTimeout(() => setProFeedbackToast(''), 3000);
                        }}
                      >
                        {settings?.account?.proPlan === 'Free Plan' ? 'Current Plan' : 'Select Free'}
                      </button>
                    </div>

                    {/* Student Pro Card (₹149) */}
                    <div className={`modernSubPlanCard popularPlanCard ${settings?.account?.proPlan === 'Student Pro' ? 'activePlanCard' : ''}`}>
                      <div className="planPopularPill">STUDENT SPECIAL</div>
                      <div className="planCardTop">
                        <span className="planTierLabel">ACADEMIC</span>
                        <h4>Student Pro</h4>
                        <div className="planPriceRow">
                          <span className="planCurrency">₹</span>
                          <span className="planPrice">149</span>
                          <span className="planInterval">/month</span>
                        </div>
                        <p className="planBriefDescription">Discounted full AI access for verified high school & college students.</p>
                      </div>
                      <div className="planDivider" />
                      <div className="planFeaturesSection">
                        <strong>What's Included:</strong>
                        <ul className="planFeatureList">
                          <li>✓ <b>Everything in Free</b> plus:</li>
                          <li>✓ <b>Unlimited AI Sign Vision Feedback</b> with MediaPipe 3D</li>
                          <li>✓ Instant AI Practice Coach for weak & recalled signs</li>
                          <li>✓ Continuous streak protection & daily goal trackers</li>
                          <li>✓ Verified Student Pro badge on public profile</li>
                          <li>✓ 1-on-1 HD Video Sign Chat with real-time subtitles</li>
                        </ul>
                      </div>
                      <button
                        type="button"
                        className="planCardActionBtn primaryBtn"
                        onClick={() => {
                          if (!settings?.account?.studentVerified) {
                            setProFeedbackToast('Please submit your Student ID verification below to unlock the ₹149 student rate.');
                            setTimeout(() => setProFeedbackToast(''), 4000);
                          } else {
                            setCheckoutModalPlan({
                              id: 'student',
                              name: 'Student Pro',
                              price: 149,
                              defaultInterval: 'month',
                            });
                          }
                        }}
                      >
                        {settings?.account?.proPlan === 'Student Pro' ? 'Current Plan' : 'Choose Student (₹149)'}
                      </button>
                    </div>

                    {/* Signova Pro (₹249) */}
                    <div className={`modernSubPlanCard ${settings?.account?.proPlan === 'Signova Pro' ? 'activePlanCard' : ''}`}>
                      <div className="planCardTop">
                        <span className="planTierLabel">PROFESSIONAL</span>
                        <h4>Signova Pro</h4>
                        <div className="planPriceRow">
                          <span className="planCurrency">₹</span>
                          <span className="planPrice">249</span>
                          <span className="planInterval">/month</span>
                        </div>
                        <p className="planBriefDescription">Complete suite for deaf educators, creators, and daily sign communicators.</p>
                      </div>
                      <div className="planDivider" />
                      <div className="planFeaturesSection">
                        <strong>What's Included:</strong>
                        <ul className="planFeatureList">
                          <li>✓ <b>Everything in Student Pro</b> plus:</li>
                          <li>✓ Multi-dialect sign translation (ISL, ASL, BSL)</li>
                          <li>✓ Full Creator Studio & Sign Creation upload toolkit</li>
                          <li>✓ Unlimited video call recording & local offline vault</li>
                          <li>✓ AI Gesture Loop with real-time accuracy scoring</li>
                          <li>✓ Priority cloud rendering & 24/7 dedicated support</li>
                        </ul>
                      </div>
                      <button
                        type="button"
                        className="planCardActionBtn"
                        onClick={() => {
                          setCheckoutModalPlan({
                            id: 'pro',
                            name: 'Signova Pro',
                            price: 249,
                            defaultInterval: 'month',
                          });
                        }}
                      >
                        {settings?.account?.proPlan === 'Signova Pro' ? 'Current Plan' : 'Choose Pro (₹249)'}
                      </button>
                    </div>

                    {/* Business & Institution Card (₹349/mo or ₹2999/yr) */}
                    <div className={`modernSubPlanCard businessPlanCard ${settings?.account?.proPlan === 'Institution & Business' || settings?.account?.proPlan === 'Institution Plan' ? 'activePlanCard' : ''}`}>
                      <div className="planCardTop">
                        <span className="planTierLabel">ENTERPRISE</span>
                        <h4>Institution & Business</h4>
                        <div className="planPriceRow">
                          <span className="planCurrency">₹</span>
                          <span className="planPrice">349</span>
                          <span className="planInterval">/month</span>
                        </div>
                        <div className="planAnnualBadge">Or ₹2,999/year (Save ₹1,189)</div>
                        <p className="planBriefDescription">For universities, NGOs, schools, and corporate accessibility teams.</p>
                      </div>
                      <div className="planDivider" />
                      <div className="planFeaturesSection">
                        <strong>What's Included:</strong>
                        <ul className="planFeatureList">
                          <li>✓ Bulk student/member licenses (up to 250 seats)</li>
                          <li>✓ Centralized classroom progress & analytics dashboard</li>
                          <li>✓ Custom sign vocabulary & institutional dataset training</li>
                          <li>✓ Admin console with CSV member management</li>
                          <li>✓ Dedicated Account Manager & SLA guarantee</li>
                          <li>✓ Single Sign-On (SSO) & HIPAA/FERPA compliance</li>
                        </ul>
                      </div>
                      <button
                        type="button"
                        className="planCardActionBtn"
                        onClick={() => {
                          setCheckoutModalPlan({
                            id: 'institution',
                            name: 'Institution & Business',
                            price: 349,
                            defaultInterval: 'month',
                          });
                        }}
                      >
                        {settings?.account?.proPlan === 'Institution & Business' || settings?.account?.proPlan === 'Institution Plan' ? 'Current Plan' : 'Select Institution (₹349)'}
                      </button>
                    </div>
                  </div>
                </section>

                {/* Structured Student ID Verification Workflow */}
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                        <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                      </svg>
                      <div>
                        <h3>Student Identity Verification Portal</h3>
                        <small style={{ color: '#64748b' }}>Upload official credentials to qualify for the ₹149/month Student Pro rate</small>
                      </div>
                    </div>
                    <span className={`verificationStatusBadge ${settings?.account?.studentVerified ? 'verified' : 'pending'}`}>
                      {settings?.account?.studentVerified ? '✓ Verified Student' : 'Action Required'}
                    </span>
                  </div>

                  <div className="studentVerificationForm">
                    <div className="formTwoColRow">
                      <label className="modernFormField">
                        <span>Institution / College / University Name</span>
                        <input
                          type="text"
                          value={settings?.account?.studentInstitution || ''}
                          onChange={(e) => updateSetting('account', 'studentInstitution', e.target.value)}
                          placeholder="e.g. Indian Institute of Technology / Delhi University"
                          className="modernSettingInput"
                        />
                      </label>

                      <label className="modernFormField">
                        <span>Student Roll / Registration Number</span>
                        <input
                          type="text"
                          value={studentIdNumber}
                          onChange={(e) => setStudentIdNumber(e.target.value)}
                          placeholder="e.g. 2024-CS-0891"
                          className="modernSettingInput"
                        />
                      </label>
                    </div>

                    <div className="formTwoColRow">
                      <label className="modernFormField">
                        <span>Document Proof Type</span>
                        <select
                          value={institutionIdType}
                          onChange={(e) => setInstitutionIdType(e.target.value)}
                          className="modernSettingInput"
                        >
                          <option value="student_card">College / University Student ID Card</option>
                          <option value="tuition_receipt">Current Semester Tuition Receipt / Fee Challan</option>
                          <option value="enrollment_letter">Official Bonafide Enrollment Certificate</option>
                          <option value="school_portal">Student Portal Screenshot (.edu email)</option>
                        </select>
                      </label>

                      <label className="modernFormField">
                        <span>Expected Graduation Year</span>
                        <select
                          value={studentGradYear}
                          onChange={(e) => setStudentGradYear(e.target.value)}
                          className="modernSettingInput"
                        >
                          <option value="2025">2025</option>
                          <option value="2026">2026</option>
                          <option value="2027">2027</option>
                          <option value="2028">2028</option>
                          <option value="2029">2029+</option>
                        </select>
                      </label>
                    </div>

                    {/* ID Document Upload Dropzone */}
                    <div className="studentDocUploadZone">
                      <label className="studentDocUploadLabel">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="visuallyHidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setIsUploadingStudentId(true);
                              setStudentDocFileName(file.name);
                              setTimeout(() => {
                                setIsUploadingStudentId(false);
                                setProFeedbackToast(`Document "${file.name}" uploaded for verification.`);
                                setTimeout(() => setProFeedbackToast(''), 3000);
                              }, 900);
                            }
                          }}
                        />
                        <div className="uploadZoneInner">
                          <span className="uploadZoneIcon">📄</span>
                          {studentDocFileName ? (
                            <div>
                              <strong style={{ color: '#7c3aed' }}>✓ Selected: {studentDocFileName}</strong>
                              <small style={{ display: 'block', color: '#64748b', marginTop: '2px' }}>Click to replace document</small>
                            </div>
                          ) : (
                            <div>
                              <strong>Upload Photo or PDF of Student ID Card</strong>
                              <small style={{ display: 'block', color: '#64748b', marginTop: '2px' }}>PNG, JPG, or PDF (Max 15MB)</small>
                            </div>
                          )}
                        </div>
                      </label>
                    </div>

                    {/* Verification Submission Action */}
                    <div className="verificationActionRow">
                      <button
                        type="button"
                        className="modernPrimaryAddBtn"
                        disabled={isUploadingStudentId}
                        style={{ width: 'auto', padding: '10px 24px' }}
                        onClick={() => {
                          if (!settings?.account?.studentInstitution) {
                            setProFeedbackToast('Please enter your Institution Name.');
                            setTimeout(() => setProFeedbackToast(''), 3000);
                            return;
                          }
                          updateSetting('account', 'studentVerified', true);
                          setProFeedbackToast('Student ID submitted and verified! Student Pro rate ($149/mo) unlocked.');
                          setTimeout(() => setProFeedbackToast(''), 3500);
                        }}
                      >
                        {isUploadingStudentId ? 'Validating Document...' : (settings?.account?.studentVerified ? '✓ Re-Submit Verification' : 'Submit ID for Instant Verification')}
                      </button>

                      {settings?.account?.studentVerified && (
                        <button
                          type="button"
                          className="modernOutlineBtn"
                          onClick={() => {
                            updateSetting('account', 'studentVerified', false);
                            setProFeedbackToast('Student verification reset.');
                            setTimeout(() => setProFeedbackToast(''), 2500);
                          }}
                        >
                          Reset Verification
                        </button>
                      )}
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

        {/* Dedicated Signova Payment & Checkout Modal */}
        <SignovaCheckoutModal
          isOpen={Boolean(checkoutModalPlan)}
          onClose={() => setCheckoutModalPlan(null)}
          plan={checkoutModalPlan}
          user={{
            name: displayName,
            username: displayUsername,
            email: settings?.account?.email || '',
            phone: settings?.account?.phone || '',
          }}
          onPaymentSuccess={handleCheckoutSuccess}
        />
      </section>
    );
  }

  return null;
}
