import React, { useState, useMemo } from 'react';
import { ContactAvatar } from '../AppPresentation';

/**
 * Modern ContactProfileModal Component matching Image 2 specifications.
 * Displayed when clicking on a contact's profile in chat or contacts list.
 * Features real conversation media, real call metrics, contact privacy badges,
 * full-screen media lightbox, 3-dots actions menu, and 1-click Chat/Video/Voice launch.
 */
export default function ContactProfileModal({
  isOpen,
  onClose,
  contact,
  messages = [],
  contacts = [],
  startVideoSignChat,
  startVoiceSignChat,
  handleHeaderChatAction,
  selectedChatFlags = {},
  selectedChatPresence,
  encryptionStatus = 'End-to-end encrypted',
  onOpenChat,
}) {
  const [activeTab, setActiveTab] = useState('about'); // 'about' | 'media' | 'files' | 'links' | 'activity'
  const [mediaFilter, setMediaFilter] = useState('all'); // 'all' | 'photos' | 'videos' | 'documents' | 'links' | 'audio'
  const [copyFeedback, setCopyFeedback] = useState('');
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [activeLightboxMedia, setActiveLightboxMedia] = useState(null);

  // Extract real messages for this contact
  const contactMessages = useMemo(() => {
    if (!contact?.id) return [];
    return messages.filter((m) => m.contactId === contact.id);
  }, [contact?.id, messages]);

  // Extract real shared media items
  const sharedMediaItems = useMemo(() => {
    return contactMessages.filter((m) => {
      const type = (m.type || '').toLowerCase();
      return (
        m.mediaUrl ||
        m.imageUrl ||
        m.videoUrl ||
        type === 'media' ||
        type === 'image' ||
        type === 'video'
      );
    });
  }, [contactMessages]);

  // Extract real shared files / documents
  const sharedDocItems = useMemo(() => {
    return contactMessages.filter((m) => {
      const type = (m.type || '').toLowerCase();
      return m.documentUrl || m.fileName || type === 'document' || type === 'file';
    });
  }, [contactMessages]);

  // Extract real shared links
  const sharedLinkItems = useMemo(() => {
    return contactMessages.filter((m) => {
      const text = m.text || '';
      return text.includes('http://') || text.includes('https://') || text.includes('www.');
    });
  }, [contactMessages]);

  // Extract real voice notes / audio
  const sharedAudioItems = useMemo(() => {
    return contactMessages.filter((m) => {
      const type = (m.type || '').toLowerCase();
      return m.audioUrl || type === 'audio' || m.voice;
    });
  }, [contactMessages]);

  // Filtered list based on media filter pill
  const visibleMediaList = useMemo(() => {
    if (mediaFilter === 'photos') {
      return sharedMediaItems.filter((m) => !m.videoUrl && m.type !== 'video');
    }
    if (mediaFilter === 'videos') {
      return sharedMediaItems.filter((m) => m.videoUrl || m.type === 'video');
    }
    if (mediaFilter === 'documents') {
      return sharedDocItems;
    }
    if (mediaFilter === 'links') {
      return sharedLinkItems;
    }
    if (mediaFilter === 'audio') {
      return sharedAudioItems;
    }
    return [...sharedMediaItems, ...sharedDocItems, ...sharedLinkItems, ...sharedAudioItems];
  }, [mediaFilter, sharedMediaItems, sharedDocItems, sharedLinkItems, sharedAudioItems]);

  if (!isOpen || !contact) return null;

  const isOnline = selectedChatPresence?.tone === 'online' || contact.status === 'online';
  const callsCount = contact.calls?.length || 0;
  const displayName = contact.name || 'Signova User';
  const displayUsername = contact.username ? (contact.username.startsWith('@') ? contact.username : `@${contact.username}`) : '@signova.member';
  const displayBio = contact.about || contact.bio || 'Sign language enthusiast | Building a more inclusive world 💜';

  async function handleCopyUsername() {
    if (navigator?.clipboard) {
      await navigator.clipboard.writeText(displayUsername).catch(() => {});
      setCopyFeedback('Username copied!');
      setTimeout(() => setCopyFeedback(''), 2500);
    }
  }

  function handleStartChat() {
    onClose();
    if (typeof onOpenChat === 'function') {
      onOpenChat(contact);
    }
  }

  return (
    <div
      className="modernContactModalOverlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
          setActiveLightboxMedia(null);
        }
      }}
    >
      <div className="modernContactProfileCard" role="dialog" aria-modal="true" aria-label={`${displayName} profile`}>
        {/* =========================================================
            LEFT COLUMN: 3D HERO AVATAR & QUICK ACTIONS (Image 2 Parity)
           ========================================================= */}
        <aside className="modernProfileHeroCol">
          {/* Ambient Glow & 3D Avatar (Centered, Clickable for Zoom) */}
          <div className="modernHeroAvatarStage">
            <div className="modernHeroRadialGlow" />
            <div
              className="modernHeroAvatarFrame clickableHeroAvatar"
              onClick={() => {
                const imgUrl = contact?.profileImage || '/app-logo.png';
                setActiveLightboxMedia({
                  mediaUrl: imgUrl,
                  fileName: `${displayName}'s Profile Photo`,
                });
              }}
              title="Click to view full photo"
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  const imgUrl = contact?.profileImage || '/app-logo.png';
                  setActiveLightboxMedia({
                    mediaUrl: imgUrl,
                    fileName: `${displayName}'s Profile Photo`,
                  });
                }
              }}
            >
              <ContactAvatar
                contact={contact}
                className="modernHeroAvatarImg centeredHeroAvatar"
                presenceTone={isOnline ? 'online' : 'offline'}
              />
              <span className={`modernHeroStatusDot ${isOnline ? 'statusOnline' : 'statusOffline'}`} />
              <div className="avatarZoomOverlay" title="Zoom in">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="11" y1="8" x2="11" y2="14"/>
                  <line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Quick Action Options Placed Directly Below Profile Pic (Accessible at Top) */}
          <div className="modernHeroTopQuickActions">
            <button
              type="button"
              className={`modernHeroMiniPillBtn ${selectedChatFlags.favourite ? 'activeFav' : ''}`}
              onClick={() => handleHeaderChatAction?.('favourite')}
              title={selectedChatFlags.favourite ? 'Remove from favourites' : 'Star as favourite'}
            >
              <span>{selectedChatFlags.favourite ? '★ Favourited' : '☆ Favourite'}</span>
            </button>

            <button
              type="button"
              className={`modernHeroMiniPillBtn ${selectedChatFlags.muted ? 'activeMuted' : ''}`}
              onClick={() => handleHeaderChatAction?.('muted')}
              title={selectedChatFlags.muted ? 'Unmute notifications' : 'Mute notifications'}
            >
              <span>{selectedChatFlags.muted ? '🔕 Muted' : '🔔 Mute'}</span>
            </button>

            <div className="modernContactMenuWrap">
              <button
                type="button"
                className="modernHeroMiniPillBtn moreBtn"
                onClick={() => setActionsMenuOpen((open) => !open)}
                aria-label="More contact options"
                title="More options"
              >
                <span>⋮ More</span>
              </button>

              {actionsMenuOpen && (
                <div className="modernContactActionDropdown avatarDropdown" onMouseLeave={() => setActionsMenuOpen(false)}>
                  <button
                    type="button"
                    className="modernDropdownItem"
                    onClick={() => {
                      handleHeaderChatAction?.('favourite');
                      setActionsMenuOpen(false);
                    }}
                  >
                    <span>{selectedChatFlags.favourite ? '★ Unstar Contact' : '☆ Star as Favourite'}</span>
                  </button>
                  <button
                    type="button"
                    className="modernDropdownItem"
                    onClick={() => {
                      handleHeaderChatAction?.('muted');
                      setActionsMenuOpen(false);
                    }}
                  >
                    <span>{selectedChatFlags.muted ? '🔔 Unmute Notifications' : '🔕 Mute Notifications'}</span>
                  </button>
                  <button
                    type="button"
                    className="modernDropdownItem dangerAction"
                    onClick={() => {
                      handleHeaderChatAction?.('blocked');
                      setActionsMenuOpen(false);
                    }}
                  >
                    <span>{selectedChatFlags.blocked ? '✓ Unblock Contact' : '🚫 Block Contact'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Name & Identity */}
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
              <span className={`presenceDot ${isOnline ? 'dotOnline' : 'dotOffline'}`} />
              <small>{isOnline ? 'Online' : 'Offline'}</small>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="modernHeroStatsBar">
            <div className="modernStatItem">
              <strong>{contacts.length || 3}</strong>
              <small>Contacts</small>
            </div>
            <span className="modernStatDivider" />
            <div className="modernStatItem">
              <strong>{contactMessages.length || 0}</strong>
              <small>Messages</small>
            </div>
            <span className="modernStatDivider" />
            <div className="modernStatItem">
              <strong>{callsCount || 0}</strong>
              <small>Calls</small>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="modernHeroActionButtons">
            {/* Direct Send Message Button */}
            <button
              type="button"
              className="modernPrimaryAddBtn modernMessageActionBtn"
              onClick={handleStartChat}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
              <span>Send Message</span>
            </button>

            {typeof startVideoSignChat === 'function' && (
              <button
                type="button"
                className="modernHeroOutlineBtn"
                onClick={() => {
                  onClose();
                  startVideoSignChat();
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M23 7l-7 5 7 5V7z" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
                <span>Video Sign Chat</span>
              </button>
            )}

            {typeof startVoiceSignChat === 'function' && (
              <button
                type="button"
                className="modernHeroOutlineBtn"
                onClick={() => {
                  onClose();
                  startVoiceSignChat();
                }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
                <span>Voice Sign Chat</span>
              </button>
            )}

            <button
              type="button"
              className="modernHeroOutlineBtn"
              onClick={handleCopyUsername}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{copyFeedback || 'Copy Username'}</span>
            </button>
          </div>

          {/* Joined Date Footer */}
          <div className="modernHeroJoinedDate">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>Member since {contact.joined || 'Jan 2025'}</span>
          </div>
        </aside>

        {/* =========================================================
            RIGHT COLUMN: CONTENT PANE WITH PILL TABS (Image 2 Parity)
           ========================================================= */}
        <main className="modernProfileContentCard">
          {/* Top Navigation Pill Tabs + 3-Dots Action Menu + Close Button */}
          <header className="modernProfileTopNav">
            <nav className="modernProfilePillTabs" aria-label="Contact details navigation">
              {['about', 'media', 'files', 'links', 'activity'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`modernNavPill ${activeTab === tab ? 'activePill' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>

            <div className="modernTopNavActions">
              {/* Close Button Only in Top Bar */}
              <button
                type="button"
                className="modernProfileCloseBtn"
                onClick={onClose}
                aria-label="Close contact profile"
                title="Close"
              >
                ×
              </button>
            </div>
          </header>

          {/* TAB 1: ABOUT (Image 2 exact match) */}
          {activeTab === 'about' && (
            <div className="modernProfileTabBody">
              {/* Section 1: About Me */}
              <section className="modernSectionCard">
                <div className="modernSectionHeader">
                  <div className="modernSectionTitle">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <h3>About Contact</h3>
                  </div>
                </div>
                <div className="modernBioBox">
                  <p>{displayBio}</p>
                </div>
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
                      <strong>{contact.showNumber !== false && contact.number ? contact.number : '+91 ••••• •••••'}</strong>
                    </div>
                    <span className={`modernPrivacyBadge ${contact.showNumber !== false && contact.number ? 'badgePublic' : 'badgePrivate'}`}>
                      {contact.showNumber !== false && contact.number ? '🟢 Public' : '🔒 Private'}
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

              {/* Section 3: Activity Overview (Real Counts) */}
              <section className="modernSectionCard">
                <div className="modernSectionHeader">
                  <div className="modernSectionTitle">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <line x1="18" y1="20" x2="18" y2="10" />
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                    <h3>Activity Overview</h3>
                  </div>
                </div>

                <div className="modernActivityOverviewGrid">
                  <div className="modernActivityTile">
                    <span className="modernActivityTileIcon">💬</span>
                    <strong>{contactMessages.length}</strong>
                    <small>Messages</small>
                  </div>
                  <div className="modernActivityTile">
                    <span className="modernActivityTileIcon">🖼️</span>
                    <strong>{sharedMediaItems.length}</strong>
                    <small>Media Shared</small>
                  </div>
                  <div className="modernActivityTile">
                    <span className="modernActivityTileIcon">🔗</span>
                    <strong>{sharedLinkItems.length}</strong>
                    <small>Links Shared</small>
                  </div>
                  <div className="modernActivityTile">
                    <span className="modernActivityTileIcon">📞</span>
                    <strong>{callsCount}</strong>
                    <small>Calls</small>
                  </div>
                </div>
              </section>

              {/* Section 4: Shared Media (REAL data only + Clickable Lightbox) */}
              <section className="modernSectionCard">
                <div className="modernSectionHeader">
                  <div className="modernSectionTitle">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <h3>Shared Media</h3>
                  </div>

                  <div className="modernMediaFilterPills">
                    {['all', 'photos', 'videos', 'documents', 'links', 'audio'].map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        className={`modernFilterPill ${mediaFilter === filter ? 'activeFilter' : ''}`}
                        onClick={() => setMediaFilter(filter)}
                      >
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {visibleMediaList.length > 0 ? (
                  <div className="modernSharedMediaGrid">
                    {visibleMediaList.map((item, idx) => (
                      <div
                        key={item.id || idx}
                        className="modernMediaItemPreview clickableMedia"
                        onClick={() => setActiveLightboxMedia(item)}
                        title="Click to preview"
                      >
                        {item.mediaUrl || item.imageUrl ? (
                          <img src={item.mediaUrl || item.imageUrl} alt="" />
                        ) : item.videoUrl ? (
                          <div className="modernMediaVideoCard">
                            <span className="modernPlayTriangle">▶</span>
                          </div>
                        ) : item.documentUrl || item.fileName ? (
                          <div className="modernMediaDocCard">
                            <span className="modernDocBadge">PDF</span>
                            <small>{item.fileName || 'Document'}</small>
                          </div>
                        ) : (
                          <div className="modernMediaLinkCard">
                            <span>🔗</span>
                            <small>{item.text || 'Link'}</small>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="realDataEmptyState">
                    <span style={{ fontSize: '24px' }}>📂</span>
                    <p>No {mediaFilter === 'all' ? 'media or files' : mediaFilter} shared in this chat yet.</p>
                  </div>
                )}
              </section>

              {/* Section 5: Recent Activity (REAL conversation data) */}
              <section className="modernSectionCard">
                <div className="modernSectionHeader">
                  <div className="modernSectionTitle">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                    <h3>Recent Activity</h3>
                  </div>
                </div>

                <div className="modernRecentActivityList">
                  {contact.lastCall ? (
                    <div className="modernActivityItem">
                      <div className="modernActivityAvatarSmall">
                        <ContactAvatar contact={contact} />
                      </div>
                      <div className="modernActivityText">
                        <strong>{contact.lastCall.type === 'video' ? 'Video Sign Chat' : 'Voice Sign Chat'}</strong>
                        <p>{contact.lastCall.endedLabel || contact.lastCall.startedLabel || 'Recent conversation'}</p>
                      </div>
                      <span className="modernActivityTimeTag">
                        {contact.lastCall.duration ? `${contact.lastCall.duration}s` : 'Completed'}
                      </span>
                    </div>
                  ) : null}

                  {contactMessages.length > 0 ? (
                    <div className="modernActivityItem">
                      <div className="modernActivityAvatarSmall">
                        <ContactAvatar contact={contact} />
                      </div>
                      <div className="modernActivityText">
                        <strong>Last message sent</strong>
                        <p>{contactMessages[contactMessages.length - 1].text?.slice(0, 50) || 'Media attachment'}</p>
                      </div>
                      <span className="modernActivityTimeTag">Active</span>
                    </div>
                  ) : null}

                  {!contact.lastCall && !contactMessages.length && (
                    <div className="realDataEmptyState">
                      <span style={{ fontSize: '20px' }}>💬</span>
                      <p>No recent activity yet. Start a chat or video call to connect!</p>
                    </div>
                  )}
                </div>
              </section>

              {/* Dedicated Privacy & Contact Actions Card (Scrolled to bottom) */}
              <section className="modernSectionCard modernDangerZoneCard">
                <div className="modernSectionHeader">
                  <div className="modernSectionTitle">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    <h3>Privacy & Contact Actions</h3>
                  </div>
                </div>

                <div className="modernContactActionList">
                  <div className="modernContactActionRow">
                    <div>
                      <strong>Star / Favourite Contact</strong>
                      <small>Pin this contact for rapid access across conversations</small>
                    </div>
                    <button
                      type="button"
                      className="modernSecondaryActionBtn"
                      onClick={() => handleHeaderChatAction?.('favourite')}
                    >
                      {selectedChatFlags.favourite ? '★ Unstar Contact' : '☆ Star as Favourite'}
                    </button>
                  </div>

                  <div className="modernContactActionRow">
                    <div>
                      <strong>Mute Notifications</strong>
                      <small>Silence incoming message tones and call banners from this user</small>
                    </div>
                    <button
                      type="button"
                      className="modernSecondaryActionBtn"
                      onClick={() => handleHeaderChatAction?.('muted')}
                    >
                      {selectedChatFlags.muted ? '🔔 Unmute' : '🔕 Mute Notifications'}
                    </button>
                  </div>

                  <div className="modernContactActionRow dangerBorderTop">
                    <div>
                      <strong style={{ color: '#ef4444' }}>Block & Report Contact</strong>
                      <small>Prevent this user from messaging, calling, or seeing online presence</small>
                    </div>
                    <div className="dangerActionsGroup">
                      <button
                        type="button"
                        className="modernDangerActionBtn"
                        onClick={() => handleHeaderChatAction?.('blocked')}
                      >
                        {selectedChatFlags.blocked ? '✓ Unblock Contact' : '🚫 Block Contact'}
                      </button>
                      <button
                        type="button"
                        className="modernReportActionBtn"
                        onClick={() => {
                          alert(`Contact ${displayName} reported for review.`);
                        }}
                      >
                        ⚠ Report Spam
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: MEDIA */}
          {activeTab === 'media' && (
            <div className="modernProfileTabBody">
              <section className="modernSectionCard">
                <div className="modernSectionHeader">
                  <h3>Photos & Videos</h3>
                  <small>{sharedMediaItems.length} shared</small>
                </div>
                {sharedMediaItems.length > 0 ? (
                  <div className="modernSharedMediaGrid">
                    {sharedMediaItems.map((m, idx) => (
                      <div
                        key={m.id || idx}
                        className="modernMediaItemPreview clickableMedia"
                        onClick={() => setActiveLightboxMedia(m)}
                      >
                        {m.videoUrl ? <video src={m.videoUrl} /> : <img src={m.mediaUrl || m.imageUrl} alt="" />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="realDataEmptyState">
                    <p>No photos or videos shared in this conversation yet.</p>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 3: FILES */}
          {activeTab === 'files' && (
            <div className="modernProfileTabBody">
              <section className="modernSectionCard">
                <div className="modernSectionHeader">
                  <h3>Shared Documents & Files</h3>
                  <small>{sharedDocItems.length} shared</small>
                </div>
                {sharedDocItems.length > 0 ? (
                  <div className="modernDocList">
                    {sharedDocItems.map((doc, idx) => (
                      <div key={doc.id || idx} className="modernDocRow">
                        <span>📄</span>
                        <div style={{ flex: 1 }}>
                          <strong>{doc.fileName || 'Shared Document'}</strong>
                          <small>{doc.fileSize || 'Encrypted PDF'}</small>
                        </div>
                        {doc.documentUrl && (
                          <a href={doc.documentUrl} target="_blank" rel="noreferrer" className="modernSmallLink">
                            Download
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="realDataEmptyState">
                    <p>No documents shared in this conversation yet.</p>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 4: LINKS */}
          {activeTab === 'links' && (
            <div className="modernProfileTabBody">
              <section className="modernSectionCard">
                <div className="modernSectionHeader">
                  <h3>Shared Links</h3>
                  <small>{sharedLinkItems.length} shared</small>
                </div>
                {sharedLinkItems.length > 0 ? (
                  <div className="modernDocList">
                    {sharedLinkItems.map((item, idx) => (
                      <div key={item.id || idx} className="modernDocRow">
                        <span>🔗</span>
                        <div style={{ flex: 1 }}>
                          <strong>{item.text}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="realDataEmptyState">
                    <p>No links shared in this conversation yet.</p>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 5: ACTIVITY / CALLS */}
          {activeTab === 'activity' && (
            <div className="modernProfileTabBody">
              <section className="modernSectionCard">
                <div className="modernSectionHeader">
                  <h3>Call History & Interaction Log</h3>
                  <small>{callsCount} total calls</small>
                </div>
                <div className="modernRecentActivityList">
                  {contact.calls && contact.calls.length > 0 ? (
                    contact.calls.map((call, idx) => (
                      <div key={idx} className="modernActivityItem">
                        <span style={{ fontSize: '18px' }}>{call.type === 'video' ? '📹' : '📞'}</span>
                        <div className="modernActivityText">
                          <strong>{call.type === 'video' ? 'Video Sign Chat' : 'Voice Sign Chat'}</strong>
                          <p>{call.endedLabel || call.startedLabel || 'Completed call'}</p>
                        </div>
                        <span className="modernActivityTimeTag">{call.duration ? `${call.duration}s` : 'Call log'}</span>
                      </div>
                    ))
                  ) : (
                    <div className="realDataEmptyState">
                      <p>No call history recorded with this contact yet.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>

      {/* Media Lightbox Modal */}
      {activeLightboxMedia && (
        <div
          className="modernLightboxOverlay"
          onClick={() => setActiveLightboxMedia(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className="modernLightboxCard" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="modernLightboxClose"
              onClick={() => setActiveLightboxMedia(null)}
              aria-label="Close preview"
            >
              ×
            </button>
            <div className="modernLightboxMediaWrapper">
              {activeLightboxMedia.videoUrl ? (
                <video src={activeLightboxMedia.videoUrl} controls autoPlay />
              ) : activeLightboxMedia.mediaUrl || activeLightboxMedia.imageUrl ? (
                <img src={activeLightboxMedia.mediaUrl || activeLightboxMedia.imageUrl} alt="" />
              ) : (
                <div className="modernDocPreviewBox">
                  <span>📄</span>
                  <strong>{activeLightboxMedia.fileName || 'Shared Document'}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
