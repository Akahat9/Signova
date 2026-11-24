import React from 'react';

export default function AppNavigationRail({
  activePanel,
  accountAvatarInitials,
  encryptionStatus,
  engineName,
  fullIntro,
  isProActive,
  isVerified = true,
  navItems,
  onCommunityOpen,
  onLogoClick,
  onOpenPanel,
  profilePhoto,
  railIcon: RailIcon,
  railTributeActive,
  signApiStatus,
}) {
  return (
    <aside className={railTributeActive ? 'appRail railLogoTributeMode' : 'appRail'} aria-label="Signova app navigation">
      <button type="button" className="railLogoButton" onClick={onLogoClick} aria-label="Play Signova tribute animation">
        <img className="railLogo" src="/app-logo.png" alt="Signova" />
      </button>
      <div className={railTributeActive ? 'railLogoTribute activeRailLogoTribute' : 'railLogoTribute'} aria-hidden="true">
        <span className="railTributeWave saffronWave" />
        <span className="railTributeWave whiteWave" />
        <span className="railTributeWave greenWave" />
        <span className="railTributeChakra" />
        <span className="railTributeHand">✋</span>
        <span className="railTributeHeart">♥</span>
        <span className="railTributeCopy">
          <strong>Every Gesture, A Voice</strong>
          <small>For India, our defenders, and every silent story.</small>
        </span>
      </div>
      {fullIntro}
      <nav className="railNav">
        {navItems.map((item) => {
          const isCommunityItem = item.id === 'community';
          const isActive = isCommunityItem
            ? ['community', 'communityGroups', 'communityCreate'].includes(activePanel)
            : activePanel === item.id;
          const iconType = isCommunityItem
            ? activePanel === 'communityGroups' ? 'communityGroups' : 'communityFeed'
            : item.icon;

          return (
            <button
              key={item.id}
              type="button"
              className={`${isActive ? 'railButton activeRailButton' : 'railButton'} railButton-${item.id}`}
              onClick={isCommunityItem ? onCommunityOpen : () => onOpenPanel(item.id)}
              title={isCommunityItem ? `${item.label} · double tap to switch Content and Groups` : item.label}
              aria-label={item.label}
            >
              <RailIcon type={iconType} />
              <span className="railLabel">{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="railProfileSection">
        <button
          className={`${['profile', 'signovaPro'].includes(activePanel) ? 'railButton profileButton activeRailButton' : 'railButton profileButton'}`}
          type="button"
          title="Profile"
          aria-label="Profile"
          onClick={() => onOpenPanel('profile')}
        >
          <div className="railProfileAvatarWrapper" aria-hidden="true">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="railProfileCustomImg" />
            ) : (
              <div className="railProfileSignovaAvatar">
                <img src="/app-logo.png" alt="Signova" className="railProfileSignovaIcon" />
              </div>
            )}
            {!profilePhoto && (
              <span className="railProfileInitialCornerBadge">
                {accountAvatarInitials || 'S'}
              </span>
            )}
            {isVerified && (
              <span className="railProfileVerifiedBadge" title="Verified Account">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none">
                  <circle cx="12" cy="12" r="11" fill="#7c3aed" />
                  <path d="M7 12.5l3 3 7-7" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            )}
          </div>
          <span className="railLabel">Profile</span>
        </button>
        <div className="securityCard railSecurityCard">
          <span>{engineName}</span>
          <strong>{encryptionStatus}</strong>
          <small>{signApiStatus}</small>
        </div>
      </div>
    </aside>
  );
}
