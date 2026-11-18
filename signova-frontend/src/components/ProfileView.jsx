import React, { useState, useEffect } from 'react';

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
}) {
  const [qrModalTab, setQrModalTab] = useState('view'); // 'view' or 'scan'

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
   * 2. Main Profile Page (Redesigned Minimalist Experience)
   * ---------------------------------------------------- */
  if (activePanel === 'profile') {
    return (
      <section className="profilePage redesignedProfilePage" aria-label="Signova profile page">
        {/* Profile Hero Header */}
        <header className="profileHeroCard">
          <div className="profilePhotoBlock">
            <label className={isSignovaProActive ? 'profilePhoto proProfilePhoto' : 'profilePhoto'} title="Upload new profile photo">
              {settings.account.profilePhoto ? (
                <img src={settings.account.profilePhoto} alt={`${settings.account.name} profile`} />
              ) : (
                <span className="profileAvatarInitials">{accountAvatarInitials}</span>
              )}
              <input type="file" accept="image/*" onChange={handleProfilePhotoUpload} aria-label="Upload profile photo" />
              <div className="profilePhotoUploadOverlay" title="Change Photo">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
              {isSignovaProActive && <b className="profileProCrown" aria-label={signovaProBadgeLabel}>PRO</b>}
            </label>

            <div className="profileCompletionPill" title={`${profileCompletion}% of profile completed`}>
              <div className="profileCompletionTrack">
                <div className="profileCompletionIndicator" style={{ width: `${profileCompletion}%` }} />
              </div>
              <span>{profileCompletion}% Complete</span>
            </div>
          </div>

          <div className="profileHeroText">
            <div className="profileHeroTagline">
              <span className="profileCategoryLabel">SIGNOVA PROFILE</span>
              {isSignovaProActive && (
                <div
                  className="profileProBadge"
                  onClick={() => openPanel('signovaPro')}
                  role="button"
                  tabIndex={0}
                  title="View Signova Pro Membership"
                >
                  <span className="proSparkle">✦</span>
                  <strong>{signovaProBadgeLabel}</strong>
                  <small>{signovaProDaysLeft} days left</small>
                </div>
              )}
            </div>

            <h1 className="profileUserName">{settings.account.name || 'Signova User'}</h1>

            <div className="profileMetaInfoRow">
              <span className="profileUsernameText">{settings.account.username || '@user'}</span>
              <span className="profileMetaDot">•</span>
              <span className="profileMetaSubText">{settings.account.preferredSignLanguage || 'ISL'} learner</span>
              <span className="profileMetaDot">•</span>
              <span className="profileMetaSubText">{settings.account.userType || 'Sign Language Learner'}</span>
            </div>

            <label className="profileAboutNote">
              <span className="profileAboutLabel">About Me</span>
              <textarea
                value={settings.account.about}
                onChange={(event) => updateSetting('account', 'about', event.target.value)}
                placeholder="I am learning Indian Sign Language for daily communication..."
                rows={2}
              />
            </label>
          </div>

          {/* Interactive Profile QR Card (Click to open centered modal) */}
          <aside
            className="profileQrCard realProfileQrCard"
            aria-label="QR profile sharing"
            onClick={() => {
              setQrModalTab('view');
              setProfileQrOpen(true);
            }}
            title="Click to view full QR code or scan"
          >
            <div className="profileQrCardPreview">
              {profileQrDataUrl ? (
                <img src={profileQrDataUrl} alt={`${settings.account.name} Signova profile QR code`} />
              ) : (
                <div className="qrArt signovaProfileQrCode" aria-hidden="true">
                  <span /><span /><span /><i /><i /><i />
                </div>
              )}
              <div className="profileQrHoverHint">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9"/>
                  <polyline points="9 21 3 21 3 15"/>
                  <line x1="21" y1="3" x2="14" y2="10"/>
                  <line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
              </div>
            </div>

            <div className="profileQrCardDetails">
              <strong>Profile QR</strong>
              <em>{settings.account.username || '@signova.user'}</em>
              <small>{settings.privacy.qrSharing ? 'Click to open & scan' : 'QR sharing is off'}</small>
            </div>

            <div className="profileQrActions" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={copyProfileShareLink} disabled={!settings.privacy.qrSharing}>
                Copy
              </button>
              <button type="button" onClick={shareProfileQr} disabled={!settings.privacy.qrSharing}>
                Share
              </button>
              <button type="button" onClick={downloadProfileQr} disabled={!settings.privacy.qrSharing || !profileQrDataUrl}>
                Save
              </button>
            </div>

            <button
              type="button"
              className="profileQrScanButton"
              onClick={(e) => {
                e.stopPropagation();
                setQrModalTab('scan');
                setProfileQrOpen(true);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
              </svg>
              Scan QR
            </button>
          </aside>
        </header>

        {/* 2-Column Responsive Body */}
        <div className="profileLayout">
          {/* Left Column: Personal Identity & Sign Language Settings */}
          <div className="profileColumn">
            {/* Identity Details Card */}
            <section className="profileCard">
              <div className="profileCardHeader">
                <div className="profileCardHeaderIcon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <div>
                  <span>BASIC INFO</span>
                  <strong>Your Identity Details</strong>
                </div>
              </div>
              <div className="profileFormGrid">
                <label>
                  <span>First name</span>
                  <input
                    value={settings.account.firstName}
                    onChange={(event) => updateSetting('account', 'firstName', event.target.value)}
                    placeholder="First name"
                  />
                </label>
                <label>
                  <span>Last name</span>
                  <input
                    value={settings.account.lastName}
                    onChange={(event) => updateSetting('account', 'lastName', event.target.value)}
                    placeholder="Last name"
                  />
                </label>
                <label>
                  <span>Username</span>
                  <input
                    value={settings.account.username}
                    onChange={(event) => updateSetting('account', 'username', normalizeUsername(event.target.value))}
                    placeholder="@username"
                  />
                </label>
                <label>
                  <span>Preferred language</span>
                  <select
                    value={settings.account.preferredLanguage}
                    onChange={(event) => updateSetting('account', 'preferredLanguage', event.target.value)}
                  >
                    <option>English</option>
                    <option>Hindi</option>
                    <option>Hinglish</option>
                    <option>ISL Gloss</option>
                  </select>
                </label>
                <label>
                  <span>City</span>
                  <input
                    value={settings.account.city}
                    onChange={(event) => updateSetting('account', 'city', event.target.value)}
                    placeholder="City"
                  />
                </label>
                <label>
                  <span>Country</span>
                  <input
                    value={settings.account.country}
                    onChange={(event) => updateSetting('account', 'country', event.target.value)}
                    placeholder="Country"
                  />
                </label>
              </div>
            </section>

            {/* Sign Language Profile Card */}
            <section className="profileCard">
              <div className="profileCardHeader">
                <div className="profileCardHeaderIcon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/>
                    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6"/>
                    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/>
                    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>
                  </svg>
                </div>
                <div>
                  <span>SIGN LANGUAGE PROFILE</span>
                  <strong>How Signova Should Support You</strong>
                </div>
              </div>

              <label className="profileFieldWide">
                <span>Community User Type</span>
                <select
                  value={settings.account.userType}
                  onChange={(event) => updateSetting('account', 'userType', event.target.value)}
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

              <div className="profileSubSection">
                <span className="profileSectionSubTitle">Preferred Sign Dialect</span>
                <div className="profileChipGroup" aria-label="Preferred sign language">
                  {['ISL', 'ASL', 'BSL', 'Other'].map((language) => (
                    <button
                      type="button"
                      key={language}
                      className={settings.account.preferredSignLanguage === language ? 'activeProfileChip' : ''}
                      onClick={() => updateSetting('account', 'preferredSignLanguage', language)}
                    >
                      {language}
                    </button>
                  ))}
                </div>
              </div>

              <div className="profileSubSection">
                <span className="profileSectionSubTitle">Sign Proficiency Level</span>
                <div className="profileChipGroup" aria-label="Skill level">
                  {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
                    <button
                      type="button"
                      key={level}
                      className={settings.account.signSkillLevel === level ? 'activeProfileChip' : ''}
                      onClick={() => updateSetting('account', 'signSkillLevel', level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Signova Pro & Learning Progress */}
          <div className="profileColumn">
            {/* Signova Pro Card */}
            <section className="profileCard signovaProProfileCard">
              <div className="profileCardHeader">
                <div className="profileCardHeaderIcon proIcon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </div>
                <div>
                  <span>SIGNOVA PRO</span>
                  <strong>{isSignovaProActive ? signovaProBadgeLabel : 'Unlock Premium Access'}</strong>
                </div>
              </div>

              <div className="signovaProPromoBanner">
                <div className="signovaProPromoPill">PRO</div>
                <div className="signovaProPromoText">
                  <strong>2 Months Free Pro Trial</strong>
                  <p>First 2 months are free for everyone. Pro badge appears on your profile automatically.</p>
                </div>
              </div>

              <div className="profileStatusList">
                <div className="profileStatusItem">
                  <small>Current Plan</small>
                  <strong>{settings.account.proPlan || '2 months free Pro'}</strong>
                </div>
                <div className="profileStatusItem">
                  <small>Trial Remaining</small>
                  <strong className="statusActiveValue">{isSignovaProActive ? `${signovaProDaysLeft} days remaining` : 'Ready'}</strong>
                </div>
                <div className="profileStatusItem">
                  <small>Student ID Verification</small>
                  <strong>{settings.account.studentVerified ? 'Verified' : 'Not verified'}</strong>
                </div>
              </div>

              <button
                type="button"
                className="profilePrimaryAction"
                onClick={() => openPanel('signovaPro')}
              >
                <span>Open Signova Pro</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </section>

            {/* Learning Progress Card */}
            <section className="profileCard">
              <div className="profileCardHeader">
                <div className="profileCardHeaderIcon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/>
                    <line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                </div>
                <div>
                  <span>LEARNING PROGRESS</span>
                  <strong>Practice Growth</strong>
                </div>
              </div>

              <div className="profileProgressGrid">
                <div className="profileProgressTile">
                  <strong>{profileStats.completed}</strong>
                  <small>Lessons</small>
                </div>
                <div className="profileProgressTile">
                  <strong className="streakHighlight">🔥 {profileStats.streak}</strong>
                  <small>Day Streak</small>
                </div>
                <div className="profileProgressTile">
                  <strong className="accuracyHighlight">{profileStats.accuracy}%</strong>
                  <small>Accuracy</small>
                </div>
              </div>

              <div className="profileTagBlock">
                <span className="profileSubTitle">Favorite Signs</span>
                <div className="favoriteSignsList">
                  {profileStats.favoriteSigns.map((sign) => (
                    <span key={sign} className="signTagBadge favoriteTag">★ {sign}</span>
                  ))}
                </div>
              </div>

              <div className="profileTagBlock weakSignsBlock">
                <span className="profileSubTitle">Weak Signs</span>
                <div className="weakSignsList">
                  {profileStats.weakSigns.map((sign) => (
                    <span key={sign} className="signTagBadge weakTag">⚡ {sign}</span>
                  ))}
                </div>
              </div>

              <div className="profileBadges">
                <span className="profileAchievementBadge">🏅 First Lesson</span>
                <span className="profileAchievementBadge">⚡ Streak Builder</span>
                <span className="profileAchievementBadge">🤟 ISL Explorer</span>
              </div>
            </section>
          </div>
        </div>

        {/* ----------------------------------------------------
         * 3. Centered Profile QR Modal (Middle Screen Lightbox)
         * ---------------------------------------------------- */}
        {profileQrOpen && (
          <div
            className="profileQrModalOverlay"
            onClick={() => setProfileQrOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profileQrModalTitle"
          >
            <div
              className="profileQrModalCard"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="profileQrModalHeader">
                <div className="profileQrModalTitleBlock">
                  <div className="profileQrModalIconWrap">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"/>
                      <rect x="14" y="3" width="7" height="7"/>
                      <rect x="14" y="14" width="7" height="7"/>
                      <rect x="3" y="14" width="7" height="7"/>
                    </svg>
                  </div>
                  <div>
                    <h3 id="profileQrModalTitle">Signova Profile QR</h3>
                    <p>Scan with any phone camera or upload a code image</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="profileQrModalCloseButton"
                  onClick={() => setProfileQrOpen(false)}
                  aria-label="Close QR Modal"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              {/* Modal Mode Selector */}
              <div className="profileQrModalTabs">
                <button
                  type="button"
                  className={`profileQrTabButton ${qrModalTab === 'view' ? 'active' : ''}`}
                  onClick={() => setQrModalTab('view')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  <span>My QR Code</span>
                </button>
                <button
                  type="button"
                  className={`profileQrTabButton ${qrModalTab === 'scan' ? 'active' : ''}`}
                  onClick={() => setQrModalTab('scan')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
                    <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                    <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
                    <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                  </svg>
                  <span>Scan / Open Code</span>
                </button>
              </div>

              {qrModalTab === 'view' ? (
                <div className="profileQrViewContent">
                  <div className="profileQrUserBadge">
                    <div className="profileQrSmallAvatar">
                      {settings.account.profilePhoto ? (
                        <img src={settings.account.profilePhoto} alt="" />
                      ) : (
                        <span>{accountAvatarInitials}</span>
                      )}
                    </div>
                    <div className="profileQrUserInfo">
                      <strong>{settings.account.name || 'Signova User'}</strong>
                      <small>{settings.account.username || '@user'} · {settings.account.preferredSignLanguage || 'ISL'} Learner</small>
                    </div>
                  </div>

                  <div className="profileQrImageContainer">
                    {profileQrDataUrl ? (
                      <img
                        src={profileQrDataUrl}
                        alt={`${settings.account.name} Signova profile QR code`}
                        className="profileQrImageLarge"
                      />
                    ) : (
                      <div className="qrArt signovaProfileQrCode largeQrArt" aria-hidden="true">
                        <span /><span /><span /><i /><i /><i />
                      </div>
                    )}
                    <div className="profileQrScanCorner top-left" />
                    <div className="profileQrScanCorner top-right" />
                    <div className="profileQrScanCorner bottom-left" />
                    <div className="profileQrScanCorner bottom-right" />
                  </div>

                  <p className="profileQrInstructions">
                    {settings.privacy.qrSharing
                      ? 'Point any smartphone camera or QR scanner at this code to open public profile.'
                      : 'QR sharing is disabled in your Privacy & Security settings.'}
                  </p>

                  <div className="profileQrActionButtonsRow">
                    <button
                      type="button"
                      className="profileQrActionButton primary"
                      onClick={copyProfileShareLink}
                      disabled={!settings.privacy.qrSharing}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      <span>Copy Link</span>
                    </button>
                    <button
                      type="button"
                      className="profileQrActionButton secondary"
                      onClick={shareProfileQr}
                      disabled={!settings.privacy.qrSharing}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="5" r="3"/>
                        <circle cx="6" cy="12" r="3"/>
                        <circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                      <span>Share</span>
                    </button>
                    <button
                      type="button"
                      className="profileQrActionButton secondary"
                      onClick={downloadProfileQr}
                      disabled={!settings.privacy.qrSharing || !profileQrDataUrl}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      <span>Save Image</span>
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
                    <div className="profileQrUploadIcon">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <circle cx="8.5" cy="8.5" r="1.5"/>
                        <polyline points="21 15 16 10 5 21"/>
                      </svg>
                    </div>
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
                      placeholder="Paste profile link (e.g. https://.../#/profile/username)"
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
        )}
      </section>
    );
  }

  /* ----------------------------------------------------
   * 4. Signova Pro Membership & Subscriptions Page
   * ---------------------------------------------------- */
  if (activePanel === 'signovaPro') {
    return (
      <section className="signovaProPage" aria-label="Signova Pro subscription page">
        <header className="signovaProHero">
          <button type="button" onClick={() => openPanel('profile')} aria-label="Back to profile" className="proBackButton">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            <span>Back to Profile</span>
          </button>
          <div>
            <span>SIGNOVA PRO MEMBERSHIP</span>
            <strong>Premium Access for Sign Language Communication</strong>
            <small>First 2 months are free for everyone. Student ID verification unlocks student Pro identity.</small>
          </div>
          <div className={isSignovaProActive ? 'signovaProHeroBadge activeProHeroBadge' : 'signovaProHeroBadge'}>
            <i aria-hidden="true" />
            <b>{isSignovaProActive ? 'PRO TRIAL' : 'FREE PLAN'}</b>
            <small>{isSignovaProActive ? `${signovaProDaysLeft} days left` : '2 months free'}</small>
          </div>
        </header>

        <main className="signovaProLayout">
          <section className="signovaProCard signovaProPlanCard">
            <div className="signovaProMiniIcon largeProIcon" aria-hidden="true"><i /><b /><em>PRO</em></div>
            <span>Recommended</span>
            <strong>2 months free Pro</strong>
            <p>Start without payment, show Pro status on profile, and unlock advanced Signova learning tools.</p>
            <div className="signovaProFeatureGrid">
              <b>Unlimited practice</b>
              <b>AI feedback</b>
              <b>Video sign chat</b>
              <b>Profile Pro badge</b>
              <b>Priority learning tools</b>
              <b>Certificates ready</b>
            </div>
            <button type="button" className="signovaProPrimaryButton" disabled title="Server-side subscriptions are not connected yet">
              Subscriptions coming later
            </button>
          </section>

          <section className="signovaProCard">
            <div className="profileCardHeader">
              <div className="profileCardHeaderIcon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                  <path d="M6 12v5c3 3 9 3 12 0v-5"/>
                </svg>
              </div>
              <div>
                <span>STUDENT VERIFICATION</span>
                <strong>Verify Student ID</strong>
              </div>
            </div>
            <p>Upload a student ID card. In production this should go to secure storage and be reviewed or verified with your institution rules.</p>
            <label className="studentIdUploadCard">
              <input type="file" accept="image/*,.pdf" disabled />
              <span>▣</span>
              <strong>{settings.account.studentVerified ? 'Student ID verified' : 'Verification unavailable'}</strong>
              <small>{settings.account.studentIdFileName || 'Verification service is not connected yet'}</small>
            </label>
            <label className="profileFieldWide">
              <span>Institution name</span>
              <input
                value={settings.account.studentInstitution}
                onChange={(event) => updateSetting('account', 'studentInstitution', event.target.value)}
                placeholder="School / college / university"
              />
            </label>
            <div className="profileStatusList">
              <div className="profileStatusItem">
                <small>Student status</small>
                <strong>{settings.account.studentVerified ? 'Verified' : 'Pending'}</strong>
              </div>
              <div className="profileStatusItem">
                <small>Discount profile</small>
                <strong>{settings.account.studentVerified ? 'Student Pro' : 'Upload required'}</strong>
              </div>
            </div>
          </section>

          <section className="signovaProCard">
            <div className="profileCardHeader">
              <div className="profileCardHeaderIcon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              </div>
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
            <button type="button" className="profilePrimaryAction" disabled title="Payment verification must be completed by the server">
              Payment service not connected
            </button>
          </section>

          <section className="signovaProCard signovaProPublicCard">
            <div className="profileCardHeader">
              <div className="profileCardHeaderIcon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </div>
              <div>
                <span>PUBLIC VISIBILITY</span>
                <strong>How Others See Your Pro Status</strong>
              </div>
            </div>
            <div className="proPublicPreview">
              <span className="communityAvatar proCommunityAvatar">
                <em>{communityAvatarInitials}</em>
                <b className="communityProMark">PRO</b>
              </span>
              <div>
                <strong>{communityProfile.name}</strong>
                <small>{communityProfile.username} · {signovaProBadgeLabel}</small>
              </div>
            </div>
            <p>After Pro activation, your public avatar and posts show a clean Pro badge with a soft animated ring.</p>
          </section>
        </main>
      </section>
    );
  }

  return null;
}
