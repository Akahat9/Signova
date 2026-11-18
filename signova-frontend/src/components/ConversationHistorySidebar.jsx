import React from 'react';
import { ContactAvatar } from './AppPresentation';

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function VideoMiniIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function VoiceMiniIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}

export default function ConversationHistorySidebar({
  callHistorySearch,
  setCallHistorySearch,
  callHistoryFilter,
  setCallHistoryFilter,
  conversationHistoryContacts,
  selectedConversationId,
  setSelectedConversationId,
  setMobileChatListOpen,
}) {
  return (
    <>
      <div className="chatSidebarTop conversationHistoryTop">
        <strong>Conversation history</strong>
      </div>
      <label className={callHistorySearch ? 'searchBox activeSearchBox' : 'searchBox'}>
        <span className="searchIconSpan" aria-hidden="true"><SearchIcon /></span>
        <input
          type="search"
          value={callHistorySearch}
          onChange={(event) => setCallHistorySearch(event.target.value)}
          placeholder="Search call history"
          aria-label="Search conversation history"
        />
        {callHistorySearch && (
          <button
            type="button"
            className="searchClearBtn"
            onClick={() => setCallHistorySearch('')}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </label>
      <div className="chatCategoryRow conversationHistoryCategories" aria-label="Conversation history filters">
        {[
          ['all', 'All'],
          ['active', 'Online'],
          ['completed', 'Completed'],
          ['no-history', 'No calls'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={callHistoryFilter === id ? 'activeChatFilter' : ''}
            onClick={() => setCallHistoryFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mobileListSummary">
        <span>People & calls</span>
        <small>{conversationHistoryContacts.length} conversation{conversationHistoryContacts.length === 1 ? '' : 's'}</small>
      </div>
      <div className="chatList conversationHistoryList">
        {conversationHistoryContacts.length ? conversationHistoryContacts.map((contact) => {
          const isVideo = contact.lastCall?.type === 'video';
          return (
            <button
              className={selectedConversationId === contact.id ? 'chatListItem conversationHistoryItem activeChat' : 'chatListItem conversationHistoryItem'}
              type="button"
              key={contact.id}
              onClick={() => {
                setSelectedConversationId(contact.id);
                setMobileChatListOpen(false);
              }}
            >
              <div className="sidebarContactAvatarWrap">
                <ContactAvatar contact={contact} className={contact.status === 'online' ? 'avatar onlineConversationAvatar' : 'avatar'} />
                <span className={contact.status === 'online' ? 'avatarStatusDot onlineDot' : 'avatarStatusDot offlineDot'} />
              </div>
              <div className="sidebarContactBody">
                <div className="sidebarContactTopLine">
                  <strong className="sidebarContactName">{contact.name}</strong>
                  <span className="sidebarLastCallTime">
                    {contact.lastCall ? (contact.lastCall.endedLabel || contact.lastCall.startedLabel || 'Recent') : 'Ready'}
                  </span>
                </div>
                <div className="sidebarCallDetail">
                  {contact.lastCall ? (
                    <>
                      <span className={isVideo ? 'sidebarCallTypeIcon videoIcon' : 'sidebarCallTypeIcon voiceIcon'}>
                        {isVideo ? <VideoMiniIcon /> : <VoiceMiniIcon />}
                      </span>
                      <span className="sidebarCallTypeLabel">
                        {isVideo ? 'Video Sign Chat' : 'Voice Sign Chat'}
                      </span>
                    </>
                  ) : (
                    <span className="sidebarNoCallLabel">Ready for live call</span>
                  )}
                </div>
                <div className="sidebarContactFooter">
                  <span className={contact.status === 'online' ? 'sidebarStatusBadge online' : 'sidebarStatusBadge offline'}>
                    <i />
                    {contact.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                  <span className="callCountPill">
                    {contact.calls.length} call{contact.calls.length === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            </button>
          );
        }) : <p className="emptyChatState">No conversation history found.</p>}
      </div>
    </>
  );
}

