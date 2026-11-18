import React from 'react';

export default function AppNavigationRail({
  activePanel,
  accountAvatarInitials,
  encryptionStatus,
  engineName,
  fullIntro,
  isProActive,
  navItems,
  onCommunityOpen,
  onLogoClick,
  onLogoDoubleClick,
  onOpenPanel,
  railIcon: RailIcon,
  railTributeActive,
  signApiStatus,
}) {
  return (
    <aside className={railTributeActive ? 'appRail railLogoTributeMode' : 'appRail'} aria-label="Signova app navigation">
      <button type="button" className="railLogoButton" onClick={onLogoClick} onDoubleClick={onLogoDoubleClick} aria-label="Play Signova tribute animation">
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
          className={`${['profile', 'signovaPro'].includes(activePanel) ? 'railButton profileButton activeRailButton' : 'railButton profileButton'} ${isProActive ? 'proProfileButton' : ''}`}
          type="button"
          title="Profile"
          aria-label="Profile"
          onClick={() => onOpenPanel('profile')}
        >
          <span className={isProActive ? 'railProfileAvatar profileInitialPremiumRing' : 'railProfileAvatar'} aria-hidden="true">
            <i />
            <b>{accountAvatarInitials}</b>
          </span>
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
