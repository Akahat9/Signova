import React, { useState, useEffect } from 'react';

/**
 * Modern ProfileView Component matching Signova's minimalist redesign (Image 2).
 * Features dual-column layout, 3D Hero avatar with ambient glow, verified checkmark,
 * dual persona switcher (Personal vs Creator & Developer Hub), interactive pill tabs,
 * contact privacy badges, activity overview, and shared media preview.
 */
export default function ProfileView({
  activePanel,
  setActivePanel,
  openPanel,
  communityProfile,
  communityAvatarInitials,
  ownCommunityPosts,
  communityIdentityEditing,
  setCommunityIdentityEditing,
  updateAvatarSetting,
  normalizeUsername,
  saveAvatarCustomization,
  communityPublicProfileTab,
  setCommunityPublicProfileTab,
  publicProfilePosts,
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
}) {
  const [qrModalTab, setQrModalTab] = useState('view'); // 'view' or 'scan'
  const [profileTab, setProfileTab] = useState('about'); // 'about' | 'media' | 'files' | 'links' | 'activity' | 'settings'
  const [personaMode, setPersonaMode] = useState('personal'); // 'personal' | 'creator'
  const [mediaCategory, setMediaCategory] = useState('all'); // 'all' | 'photos' | 'videos' | 'documents' | 'links' | 'audio'
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [copyFeedback, setCopyFeedback] = useState('');

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
    const handle = settings?.account?.username || '@krisha';
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
   * 2. Modern Profile Page (Redesigned Image 2 Parity)
   * ---------------------------------------------------- */
  if (activePanel === 'profile') {
    const displayName = settings.account.name || 'Krisha Sharma';
    const displayUsername = settings.account.username || '@krisha';
    const displayPhone = settings.account.phone || '+91 7986295274';
    const displayBio = settings.account.about || 'Sign language enthusiast | Building a more inclusive world 💜';
    const contactsCount = contacts?.length || 245;
    const callsCount = callHistory?.length || 32;
    const groupsCount = communityGroups?.length || 12;

    return (
      <section className="modernProfilePage" aria-label="Signova modern profile">
        <div className="modernProfileContainer">
          {/* =========================================================
              LEFT COLUMN: HERO IDENTITY CARD (Image 2 Parity)
             ========================================================= */}
          <aside className="modernProfileHeroCard">
            {/* 3D Avatar with Ambient Glow & Online Indicator */}
            <div className="modernAvatarWrapper">
              <label className="modernProfileAvatarLabel" title="Click to upload profile photo">
                {settings.account.profilePhoto ? (
                  <img src={settings.account.profilePhoto} alt={displayName} className="modernProfileAvatarImg" />
                ) : (
                  <div className="modernProfileAvatar3D">
                    {/* High quality 3D illustrated avatar SVG fallback */}
                    <svg viewBox="0 0 120 120" width="100%" height="100%">
                      <defs>
                        <radialGradient id="heroFace" cx="50%" cy="40%" r="55%">
                          <stop offset="0%" stopColor="#fed7aa" />
                          <stop offset="100%" stopColor="#fba772" />
                        </radialGradient>
                        <linearGradient id="heroHair" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#292524" />
                          <stop offset="100%" stopColor="#1c1917" />
                        </linearGradient>
                      </defs>
                      <circle cx="60" cy="60" r="54" fill="#ede9fe" />
                      {/* Hair back */}
                      <ellipse cx="60" cy="50" rx="36" ry="34" fill="url(#heroHair)" />
                      {/* Face */}
                      <ellipse cx="60" cy="62" rx="27" ry="29" fill="url(#heroFace)" />
                      {/* Hair front bangs */}
                      <path d="M 33 46 C 36 32, 60 26, 87 42 C 80 34, 60 30, 42 36 Z" fill="url(#heroHair)" />
                      {/* Eyes */}
                      <ellipse cx="49" cy="59" rx="3.5" ry="4.5" fill="#1e293b" />
                      <ellipse cx="71" cy="59" rx="3.5" ry="4.5" fill="#1e293b" />
                      <circle cx="50" cy="57" r="1.2" fill="#ffffff" />
                      <circle cx="72" cy="57" r="1.2" fill="#ffffff" />
                      {/* Eyebrows */}
                      <path d="M 43 51 Q 49 48 55 52" stroke="#1c1917" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                      <path d="M 65 52 Q 71 48 77 51" stroke="#1c1917" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                      {/* Smile */}
                      <path d="M 52 73 Q 60 80 68 73" stroke="#be185d" strokeWidth="2.2" strokeLinecap="round" fill="none" />
                      {/* Cheeks */}
                      <circle cx="43" cy="67" r="4" fill="#fb7185" opacity="0.35" />
                      <circle cx="77" cy="67" r="4" fill="#fb7185" opacity="0.35" />
                      {/* Hoodie collar */}
                      <path d="M 36 94 C 44 86, 76 86, 84 94 L 88 120 L 32 120 Z" fill="#1e1b4b" />
                    </svg>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePhotoUpload}
                  aria-label="Upload profile photo"
                  hidden
                />
                <div className="modernAvatarUploadOverlay" title="Change photo">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                    <circle cx="12" cy="13" r="4"/>
                  </svg>
                </div>
              </label>
              {/* Online indicator badge */}
              <span className="modernHeroOnlineDot" title="Online now" />
            </div>

            {/* Name with Verified Checkmark */}
            <div className="modernHeroIdentity">
              <h2 className="modernHeroName">
                {displayName}
                <span className="modernVerifiedBadge" title="Verified Signova Identity">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="#7c3aed">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </span>
              </h2>
              <span className="modernHeroUsername">{displayUsername}</span>

              {/* Online Pill */}
              <div className="modernHeroOnlinePill">
                <span className="modernPulseGreen" />
                <span>Online</span>
              </div>

              {/* Bio Statement */}
              <p className="modernHeroBio">
                {displayBio}
              </p>
            </div>

            {/* Stats Counter Bar (Contacts | Chats | Groups) */}
            <div className="modernHeroStatsBar">
              <div className="modernHeroStatItem">
                <strong>{contactsCount}</strong>
                <small>Contacts</small>
              </div>
              <div className="modernHeroStatDivider" />
              <div className="modernHeroStatItem">
                <strong>32</strong>
                <small>Chats</small>
              </div>
              <div className="modernHeroStatDivider" />
              <div className="modernHeroStatItem">
                <strong>{groupsCount}</strong>
                <small>Groups</small>
              </div>
            </div>

            {/* Action Buttons List */}
            <div className="modernHeroActionsList">
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
              <span>Joined on 12 Jan 2025</span>
            </div>
          </aside>

          {/* =========================================================
              RIGHT COLUMN: CONTENT PANE WITH PILL TABS (Image 2 Parity)
             ========================================================= */}
          <main className="modernProfileContentCard">
            {/* Top Navigation Pill Tabs + Close Button */}
            <header className="modernProfileTopNav">
              <nav className="modernProfilePillTabs" aria-label="Profile navigation">
                {['about', 'media', 'files', 'links', 'activity', 'settings'].map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`modernNavPill ${profileTab === tab ? 'activePill' : ''}`}
                    onClick={() => setProfileTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
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

            {/* TAB CONTENT: ABOUT (Image 2 exact match) */}
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
                        <strong>{ownCommunityPosts?.length || 48}</strong>
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

                  <div className="modernContactCardsGrid">
                    {/* Phone card */}
                    <div className="modernContactCard">
                      <div className="modernContactCardLeading">
                        <span className="modernContactIconWrap">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                        </span>
                        <div>
                          <small>Phone Number</small>
                          <strong>{displayPhone}</strong>
                        </div>
                      </div>
                      <span className="modernPrivacyBadge private">
                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                        </svg>
                        <span>Private</span>
                      </span>
                    </div>

                    {/* Username card */}
                    <div className="modernContactCard">
                      <div className="modernContactCardLeading">
                        <span className="modernContactIconWrap">
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                            <circle cx="12" cy="12" r="4"/>
                            <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>
                          </svg>
                        </span>
                        <div>
                          <small>Username</small>
                          <strong>{displayUsername}</strong>
                        </div>
                      </div>
                      <span className="modernPrivacyBadge public">
                        <span className="dotGreen" />
                        <span>Public</span>
                      </span>
                    </div>
                  </div>
                </section>

                {/* Section 3: Activity Overview */}
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <line x1="18" y1="20" x2="18" y2="10"/>
                        <line x1="12" y1="20" x2="12" y2="4"/>
                        <line x1="6" y1="20" x2="6" y2="14"/>
                      </svg>
                      <h3>Activity Overview</h3>
                    </div>
                    <button type="button" className="modernSeeAllLink" onClick={() => setProfileTab('activity')}>
                      See all →
                    </button>
                  </div>

                  <div className="modernActivityStatsGrid">
                    <div className="modernActivityTile">
                      <span className="modernActivityTileIcon chat">💬</span>
                      <strong>1.2K</strong>
                      <small>Messages</small>
                    </div>

                    <div className="modernActivityTile">
                      <span className="modernActivityTileIcon media">🖼️</span>
                      <strong>245</strong>
                      <small>Media Shared</small>
                    </div>

                    <div className="modernActivityTile">
                      <span className="modernActivityTileIcon links">🔗</span>
                      <strong>48</strong>
                      <small>Links Shared</small>
                    </div>

                    <div className="modernActivityTile">
                      <span className="modernActivityTileIcon calls">📞</span>
                      <strong>{callsCount}</strong>
                      <small>Calls</small>
                    </div>
                  </div>
                </section>

                {/* Section 4: Shared Media */}
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                      <h3>Shared Media</h3>
                    </div>

                    <div className="modernMediaFilterRow">
                      {['all', 'photos', 'videos', 'documents', 'links', 'audio'].map((category) => (
                        <button
                          key={category}
                          type="button"
                          className={`modernMediaFilterBtn ${mediaCategory === category ? 'activeFilter' : ''}`}
                          onClick={() => setMediaCategory(category)}
                        >
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Shared Media Thumbnails Grid */}
                  <div className="modernSharedMediaGrid">
                    {/* Item 1: Mountain landscape photo */}
                    <div className="modernMediaCard photo">
                      <img
                        src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=300&auto=format&fit=crop&q=60"
                        alt="Shared landscape"
                      />
                    </div>

                    {/* Item 2: Video clip with play button & duration */}
                    <div className="modernMediaCard video">
                      <img
                        src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=60"
                        alt="Sign video preview"
                      />
                      <div className="modernVideoPlayOverlay">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="#ffffff">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      </div>
                      <span className="modernVideoDurationBadge">0:24</span>
                    </div>

                    {/* Item 3: Document preview */}
                    <div className="modernMediaCard document">
                      <div className="modernDocCardContent">
                        <span className="modernDocPdfBadge">PDF</span>
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#64748b" strokeWidth="1.8">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <small>Design_File</small>
                      </div>
                    </div>

                    {/* Item 4: Shared link card */}
                    <div className="modernMediaCard link">
                      <div className="modernLinkCardContent">
                        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#7c3aed" strokeWidth="2">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                        </svg>
                        <small>signova.ai</small>
                      </div>
                    </div>

                    {/* Item 5: Audio waveform */}
                    <div className="modernMediaCard audio">
                      <div className="modernAudioCardContent">
                        <div className="modernAudioWaveform">
                          <span /><span /><span /><span /><span />
                        </div>
                        <span className="modernAudioDuration">0:45</span>
                      </div>
                    </div>

                    {/* Item 6: +12 More Items */}
                    <button
                      type="button"
                      className="modernMediaCard moreBadge"
                      onClick={() => setProfileTab('media')}
                    >
                      <strong>+12</strong>
                      <small>View all</small>
                    </button>
                  </div>
                </section>

                {/* Section 5: Recent Activity */}
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <circle cx="12" cy="12" r="10"/>
                        <polyline points="12 6 12 12 16 14"/>
                      </svg>
                      <h3>Recent Activity</h3>
                    </div>
                    <button type="button" className="modernSeeAllLink" onClick={() => setProfileTab('activity')}>
                      See all →
                    </button>
                  </div>

                  <div className="modernActivityList">
                    <div className="modernActivityItem">
                      <div className="modernActivityAvatar">
                        <span>📄</span>
                      </div>
                      <div className="modernActivityText">
                        <strong>Sent a document</strong>
                        <small>Design_File.pdf • 2h ago</small>
                      </div>
                      <span className="modernActivityTrailingIcon">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#7c3aed" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        </svg>
                      </span>
                    </div>

                    <div className="modernActivityItem">
                      <div className="modernActivityAvatar heart">
                        <span>❤️</span>
                      </div>
                      <div className="modernActivityText">
                        <strong>Reacted ❤️ to your message</strong>
                        <small>Yesterday, 8:30 PM</small>
                      </div>
                      <span className="modernActivityTrailingIcon">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="#ef4444">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* TAB CONTENT: SETTINGS (Embedded) */}
            {profileTab === 'settings' && (
              <div className="modernProfileTabBody">
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <circle cx="12" cy="12" r="3"/>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                      </svg>
                      <h3>Sign Language & Preferences</h3>
                    </div>
                  </div>

                  <div className="modernSettingsGrid">
                    <label className="modernSettingRow">
                      <span>Preferred Dialect</span>
                      <select
                        value={settings.account.preferredSignLanguage || 'ISL'}
                        onChange={(e) => updateSetting('account', 'preferredSignLanguage', e.target.value)}
                        className="modernSettingSelect"
                      >
                        <option value="ISL">Indian Sign Language (ISL)</option>
                        <option value="ASL">American Sign Language (ASL)</option>
                        <option value="BSL">British Sign Language (BSL)</option>
                      </select>
                    </label>

                    <label className="modernSettingRow">
                      <span>Proficiency Level</span>
                      <select
                        value={settings.account.signSkillLevel || 'Beginner'}
                        onChange={(e) => updateSetting('account', 'signSkillLevel', e.target.value)}
                        className="modernSettingSelect"
                      >
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced (Fluent)</option>
                      </select>
                    </label>

                    <label className="modernSettingRow">
                      <span>Signova Community Role</span>
                      <select
                        value={settings.account.userType || 'Sign Language Learner'}
                        onChange={(e) => updateSetting('account', 'userType', e.target.value)}
                        className="modernSettingSelect"
                      >
                        <option value="Sign Language Learner">Sign Language Learner</option>
                        <option value="Deaf">Deaf</option>
                        <option value="Hard of Hearing">Hard of Hearing</option>
                        <option value="Interpreter">Professional Interpreter</option>
                        <option value="AI Dataset Contributor">AI Dataset Contributor</option>
                      </select>
                    </label>
                  </div>
                </section>
              </div>
            )}

            {/* Other tabs fallback */}
            {profileTab !== 'about' && profileTab !== 'settings' && (
              <div className="modernProfileTabBody">
                <section className="modernSectionCard">
                  <div className="modernSectionHeader">
                    <div className="modernSectionTitle">
                      <h3>{profileTab.charAt(0).toUpperCase() + profileTab.slice(1)} Vault</h3>
                    </div>
                  </div>
                  <p className="modernEmptyNotice">
                    All your shared {profileTab} in personal chats and verified sign sessions will be indexed here.
                  </p>
                </section>
              </div>
            )}
          </main>
        </div>

        {/* Profile QR Modal (Preserved & Enhanced) */}
        {profileQrOpen && (
          <div
            className="profileQrModalOverlay"
            role="presentation"
            onClick={() => setProfileQrOpen(false)}
          >
            <div
              className="profileQrModal"
              role="dialog"
              aria-modal="true"
              aria-label="Profile QR Sharing and Scanner"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="profileQrModalClose"
                onClick={() => setProfileQrOpen(false)}
                aria-label="Close QR Modal"
              >
                ×
              </button>

              <div className="profileQrModalTabs">
                <button
                  type="button"
                  className={qrModalTab === 'view' ? 'active' : ''}
                  onClick={() => setQrModalTab('view')}
                >
                  My Profile QR
                </button>
                <button
                  type="button"
                  className={qrModalTab === 'scan' ? 'active' : ''}
                  onClick={() => setQrModalTab('scan')}
                >
                  Scan QR
                </button>
              </div>

              <div className="profileQrModalBody">
                {qrModalTab === 'view' ? (
                  <div className="profileQrViewContent">
                    <div className="profileQrFullDisplay">
                      {profileQrDataUrl ? (
                        <img src={profileQrDataUrl} alt={`${displayName} QR Code`} />
                      ) : (
                        <div className="qrArt signovaProfileQrCode large">
                          <span /><span /><span /><i /><i /><i />
                        </div>
                      )}
                    </div>
                    <strong>{displayName}</strong>
                    <p>{displayUsername}</p>

                    <div className="profileQrModalActionRow">
                      <button
                        type="button"
                        className="profileQrActionButton"
                        onClick={copyProfileShareLink}
                      >
                        Copy Link
                      </button>
                      <button
                        type="button"
                        className="profileQrActionButton"
                        onClick={shareProfileQr}
                      >
                        Share
                      </button>
                      <button
                        type="button"
                        className="profileQrActionButton secondary"
                        onClick={downloadProfileQr}
                      >
                        Save Image
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="profileQrScanContent">
                    <input
                      ref={profileQrScanInputRef}
                      type="file"
                      accept="image/*"
                      onChange={scanProfileQrImage}
                      aria-label="Upload QR image to scan"
                      hidden
                    />
                    <div
                      className="profileQrUploadDropzone"
                      onClick={() => profileQrScanInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                    >
                      <strong>Upload QR Image from Device</strong>
                      <p>Select a screenshot or photo containing a Signova profile QR</p>
                      <span className="profileQrUploadBtnPill">Browse Image</span>
                    </div>

                    <div className="profileQrDivider">
                      <span>OR ENTER PROFILE LINK</span>
                    </div>

                    <div className="profileQrManualInputGroup">
                      <input
                        type="text"
                        value={profileQrManualValue}
                        onChange={(event) => setProfileQrManualValue(event.target.value)}
                        placeholder="Paste profile link..."
                        className="profileQrManualInput"
                      />
                      <button
                        type="button"
                        className="profileQrResolveButton"
                        onClick={() => openScannedProfile(profileQrManualValue)}
                        disabled={!profileQrManualValue.trim()}
                      >
                        Open Profile
                      </button>
                    </div>

                    {profileQrMessage && (
                      <div className="profileQrScanFeedback">
                        <span>ℹ️</span>
                        <span>{profileQrMessage}</span>
                      </div>
                    )}
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
   * 3. Signova Pro Membership Page
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
        </main>
      </section>
    );
  }

  return null;
}
