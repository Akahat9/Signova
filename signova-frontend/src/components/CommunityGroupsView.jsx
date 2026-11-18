import React from 'react';

/**
 * CommunityGroupsView component
 * Renders the Signova community groups directory, group workspace, chat, tools, and composer.
 */
export default function CommunityGroupsView({
  communityGroupSearch,
  setCommunityGroupSearch,
  communityGroupCategory,
  setCommunityGroupCategory,
  communityGroupCategoryOptions = [],
  communityGroupCategoryComposerOpen,
  setCommunityGroupCategoryComposerOpen,
  communityGroupCategoryDraft,
  setCommunityGroupCategoryDraft,
  createCommunityGroupCategory,
  visibleCommunityGroups = [],
  selectedCommunityGroup,
  setSelectedCommunityGroupId,
  setCommunityGroupToolOpen,
  setCommunityGroupProfileOpen,
  setGroupCreationContext,
  setGroupModalOpen,
  handleCommunityGroupChatAction,
  communityGroupPosts = [],
  communityGroupToolOpen,
  startMeetingMode,
  setStatus,
  communityGroupDraft,
  setCommunityGroupDraft,
  communityGroupEmojiOpen,
  setCommunityGroupEmojiOpen,
  COMPOSER_EMOJIS = [],
  postCommunityGroupNote,
  communityGroupVoice = {},
  toggleCommunityGroupVoice,
  formatVoiceTime = (s) => s,
  communityGroupProfileOpen,
}) {
  return (
    <section className="communityPage communityGroupsPage" aria-label="Signova community groups">
      <div className="communityGroupsLayout">
        <aside className="communityPanel groupDirectory" aria-label="Community group list">
          <div className="communityPanelHeader groupDirectoryHeader">
            <div>
              <strong>Signova Groups</strong>
            </div>
            <div className="groupHeaderActions">
              <button
                type="button"
                aria-label="Create group"
                onClick={() => {
                  setGroupCreationContext('community');
                  setGroupModalOpen(true);
                  setCommunityGroupToolOpen('');
                }}
              >
                ＋
              </button>
              <button
                type="button"
                className="groupChatActionsTrigger"
                aria-label="Community group conversation actions"
                onClick={() => setCommunityGroupToolOpen((open) => (open === 'group-chat-actions' ? '' : 'group-chat-actions'))}
              >
                •••
              </button>
            </div>
          </div>
          <label className="communityGroupSearch">
            <span aria-hidden="true">⌕</span>
            <input
              value={communityGroupSearch}
              onChange={(event) => setCommunityGroupSearch(event.target.value)}
              placeholder="Search groups"
              aria-label="Search group directory"
            />
          </label>
          <div className="groupTabs directGroupCategories" aria-label="Group categories">
            {[
              ['all', 'All'],
              ['joined', 'Joined'],
              ['live', 'Live'],
              ['archived', 'Archived'],
              ...communityGroupCategoryOptions.map((category) => [`category:${category.toLowerCase()}`, category]),
            ].map(([id, label]) => (
              <button
                type="button"
                className={communityGroupCategory === id ? 'activeGroupTab' : ''}
                onClick={() => setCommunityGroupCategory(id)}
                key={id}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="addGroupCategoryButton"
              onClick={() => setCommunityGroupCategoryComposerOpen((open) => !open)}
              aria-label="Create group category"
            >
              ＋
            </button>
          </div>
          {communityGroupCategoryComposerOpen && (
            <form className="groupCategoryComposer" onSubmit={createCommunityGroupCategory}>
              <input
                value={communityGroupCategoryDraft}
                onChange={(event) => setCommunityGroupCategoryDraft(event.target.value)}
                placeholder="Category name"
                autoFocus
              />
              <button type="submit" disabled={!communityGroupCategoryDraft.trim()}>
                Add
              </button>
            </form>
          )}
          <div className="communityGroupDirectoryItems">
            {visibleCommunityGroups.length ? (
              visibleCommunityGroups.map((group) => (
                <button
                  className={selectedCommunityGroup?.id === group.id ? 'communityGroupChat activeCommunityGroup' : 'communityGroupChat'}
                  type="button"
                  key={group.id}
                  onClick={() => {
                    setSelectedCommunityGroupId(group.id);
                    setCommunityGroupToolOpen('');
                    setCommunityGroupProfileOpen(false);
                  }}
                >
                  <span className="communityGroupAvatar">
                    {group.name
                      .split(/\s+/)
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)}
                  </span>
                  <span>
                    <strong>{group.name}</strong>
                    <small>{group.latest}</small>
                  </span>
                  <em>
                    <b>{group.online}</b> online
                  </em>
                </button>
              ))
            ) : (
              <p className="realDataEmpty">No real Signova groups yet. Click + to create your first community group.</p>
            )}
          </div>
        </aside>

        <main
          className={`communityPanel groupChatPanel cleanGroupWorkspace ${
            selectedCommunityGroup ? '' : 'emptyCleanGroupWorkspace'
          }`}
          aria-label="Selected community group"
        >
          {!selectedCommunityGroup && (
            <section className="groupWorkspaceEmpty">
              <span className="emptyGroupMark" aria-hidden="true">
                <i />
                <b>＋</b>
              </span>
              <strong>Create your first Signova group</strong>
              <p>Bring learners together for sign practice, clips, feedback, polls, and live meetings.</p>
              <button
                type="button"
                onClick={() => {
                  setGroupCreationContext('community');
                  setGroupModalOpen(true);
                }}
              >
                Create group
              </button>
            </section>
          )}
          <section className="groupFocusHero">
            <button
              type="button"
              className="communityGroupAvatar largeGroupAvatar groupProfileTrigger"
              onClick={() => setCommunityGroupProfileOpen(true)}
              aria-label="Open community group profile"
            >
              {selectedCommunityGroup?.name?.[0] || 'G'}
            </button>
            <div>
              <strong>{selectedCommunityGroup?.name || 'Create a practical learning group'}</strong>
              <div className="groupLiveActivity">
                <i aria-hidden="true" />
                <span>
                  <b>{selectedCommunityGroup?.online || 0} active now</b>
                  <small>
                    {communityGroupPosts.filter((post) => post.groupId === selectedCommunityGroup?.id).length} recent updates
                  </small>
                </span>
              </div>
            </div>
            <div className="groupHeroActions">
              <button
                type="button"
                className="postButton groupMeetAction"
                disabled={!selectedCommunityGroup}
                onClick={() => startMeetingMode('video')}
                aria-label="Start community group meeting"
              >
                <span className="groupMeetingIcon" aria-hidden="true">
                  <i />
                  <b />
                </span>
                <span>Meet</span>
              </button>
              <button
                type="button"
                className="ghostCommunityButton"
                onClick={() => setCommunityGroupToolOpen('invite')}
              >
                Invite
              </button>
              <button
                type="button"
                className="groupMoreAction"
                onClick={() => setCommunityGroupToolOpen((open) => (open === 'settings' ? '' : 'settings'))}
                aria-label="Community group settings"
                aria-expanded={communityGroupToolOpen === 'settings'}
              >
                ⋮
              </button>
            </div>
          </section>

          <section className="groupActivityPanel">
            {selectedCommunityGroup ? (
              <div className="groupActivityList">
                {communityGroupPosts
                  .filter((post) => post.groupId === selectedCommunityGroup.id)
                  .map((post) => (
                    <article className="memberGroupUpdate" key={post.id}>
                      <b>{post.author.slice(0, 1).toUpperCase()}</b>
                      <span>
                        <strong>{post.author}</strong>
                        <p>{post.text}</p>
                        {post.audioUrl && <audio controls preload="metadata" src={post.audioUrl} />}
                        <small>{post.time} · Local device only</small>
                      </span>
                    </article>
                  ))}
                {!communityGroupPosts.some((post) => post.groupId === selectedCommunityGroup.id) && (
                  <p className="groupActivityEmpty">No activity yet. Start with a note, emoji, voice message, or meeting.</p>
                )}
              </div>
            ) : (
              <p className="realDataEmpty">No real group selected. Click + to create a group space.</p>
            )}
          </section>

          {communityGroupToolOpen && (
            <section
              className={`communityGroupMiniWindow communityGroupTool-${communityGroupToolOpen}`}
              aria-label="Community group tool"
            >
              <button
                type="button"
                onClick={() => setCommunityGroupToolOpen('')}
                aria-label="Close community group tool"
              >
                ×
              </button>
              {communityGroupToolOpen === 'practice' && (
                <>
                  <strong>Practice Window</strong>
                  <small>Start a focused sign drill for this group.</small>
                  <div className="communityMiniActionGrid">
                    <button type="button">Greeting signs</button>
                    <button type="button">Hand accuracy</button>
                    <button type="button">Sentence chain</button>
                  </div>
                </>
              )}
              {communityGroupToolOpen === 'poll' && (
                <>
                  <strong>Audience Poll</strong>
                  <small>Ask members what sign to practice next.</small>
                  <input placeholder="Poll question" />
                  <div className="communityMiniActionGrid">
                    <button type="button">Need Help</button>
                    <button type="button">Thank You</button>
                    <button type="button">Emergency signs</button>
                  </div>
                </>
              )}
              {communityGroupToolOpen === 'drive' && (
                <>
                  <strong>Media Drive</strong>
                  <small>Share sign videos, worksheets, and call clips.</small>
                  <div className="communityMiniActionGrid">
                    <button type="button">Upload clip</button>
                    <button type="button">Saved signs</button>
                    <button type="button">Library book</button>
                  </div>
                </>
              )}
              {communityGroupToolOpen === 'review' && (
                <>
                  <strong>Review Queue</strong>
                  <small>Approve created signs before they enter call-ready mode.</small>
                  <div className="communityMiniActionGrid">
                    <button type="button">Pending signs</button>
                    <button type="button">AI checks</button>
                    <button type="button">Creator feedback</button>
                  </div>
                </>
              )}
              {communityGroupToolOpen === 'invite' && (
                <>
                  <strong>Invite Members</strong>
                  <small>Add learners, creators, interpreters, or family members.</small>
                  <input placeholder="@username or phone" />
                  <div className="communityMiniActionGrid">
                    <button type="button">Copy invite</button>
                    <button type="button">Add contact</button>
                    <button type="button">QR code</button>
                  </div>
                </>
              )}
              {communityGroupToolOpen === 'settings' && (
                <>
                  <strong>Group settings</strong>
                  <small>Membership, learning, accessibility, privacy, and meeting defaults.</small>
                  <div className="communityMiniActionGrid groupSettingsActionGrid">
                    <button type="button" onClick={() => setCommunityGroupToolOpen('invite')}>
                      Members & roles
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus(`Group access: ${selectedCommunityGroup?.privacy || 'private'}`)}
                    >
                      Privacy & access
                    </button>
                    <button type="button" onClick={() => setCommunityGroupToolOpen('review')}>
                      Moderation
                    </button>
                    <button type="button" onClick={() => setStatus('Group notifications updated.')}>
                      Notifications
                    </button>
                    <button type="button" onClick={() => setCommunityGroupToolOpen('practice')}>
                      Practice defaults
                    </button>
                    <button type="button" onClick={() => setCommunityGroupToolOpen('drive')}>
                      Media permissions
                    </button>
                    <button type="button" onClick={() => setStatus('Live captions enabled for group meetings.')}>
                      Captions & language
                    </button>
                    <button type="button" onClick={() => setStatus('Invite link controls opened.')}>
                      Invite links
                    </button>
                    <button type="button" onClick={() => setStatus('Accessibility preferences opened.')}>
                      Accessibility
                    </button>
                  </div>
                </>
              )}
              {communityGroupToolOpen === 'group-chat-actions' && (
                <>
                  <strong>Group conversation</strong>
                  <small>Actions for this community-group conversation only.</small>
                  <div className="communityMiniActionGrid groupChatActionGrid">
                    <button type="button" onClick={() => handleCommunityGroupChatAction('archive')}>
                      Archive group
                    </button>
                    <button type="button" onClick={() => handleCommunityGroupChatAction('categorize')}>
                      Add to community collection
                    </button>
                    <button type="button" onClick={() => handleCommunityGroupChatAction('clear')}>
                      Clear conversation
                    </button>
                    <button
                      type="button"
                      className="dangerGroupSetting"
                      onClick={() => handleCommunityGroupChatAction('delete')}
                    >
                      Delete group
                    </button>
                    <button
                      type="button"
                      className="dangerGroupSetting"
                      onClick={() => handleCommunityGroupChatAction('block')}
                    >
                      Block group
                    </button>
                  </div>
                </>
              )}
              {communityGroupToolOpen === 'directory-settings' && (
                <>
                  <strong>Community Groups</strong>
                  <small>Controls for discovery and all community spaces. Chat groups stay separate.</small>
                  <div className="communityMiniActionGrid groupSettingsActionGrid">
                    <button
                      type="button"
                      onClick={() => {
                        setGroupCreationContext('community');
                        setGroupModalOpen(true);
                        setCommunityGroupToolOpen('');
                      }}
                    >
                      Create community group
                    </button>
                    <button type="button" onClick={() => setCommunityGroupCategory('joined')}>
                      Joined groups
                    </button>
                    <button type="button" onClick={() => setCommunityGroupCategory('live')}>
                      Live groups
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('Community group discovery preferences opened.')}
                    >
                      Discovery
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('Community group notification preferences opened.')}
                    >
                      Notifications
                    </button>
                    <button
                      type="button"
                      onClick={() => setStatus('Blocked community groups opened.')}
                    >
                      Blocked groups
                    </button>
                  </div>
                </>
              )}
              {communityGroupToolOpen === 'attach' && (
                <>
                  <strong>Add to group</strong>
                  <small>Share something useful with this learning space.</small>
                  <div className="communityMiniActionGrid importantGroupAttachments">
                    <button type="button" onClick={() => setCommunityGroupToolOpen('drive')}>
                      Sign clip
                    </button>
                    <button type="button" onClick={() => setCommunityGroupToolOpen('drive')}>
                      Photo or video
                    </button>
                    <button type="button" onClick={() => setCommunityGroupToolOpen('drive')}>
                      Document
                    </button>
                    <button type="button" onClick={() => setCommunityGroupToolOpen('poll')}>
                      Poll
                    </button>
                    <button type="button" onClick={() => setCommunityGroupToolOpen('practice')}>
                      Practice task
                    </button>
                    <button type="button" onClick={() => setCommunityGroupToolOpen('invite')}>
                      Contact
                    </button>
                  </div>
                </>
              )}
              {communityGroupToolOpen === 'group-created' && (
                <>
                  <strong>Group Created</strong>
                  <small>Your new group is ready. Add people or start a sign practice room.</small>
                  <div className="communityMiniActionGrid">
                    <button type="button" onClick={() => setCommunityGroupToolOpen('invite')}>
                      Invite
                    </button>
                    <button type="button" onClick={() => setCommunityGroupToolOpen('practice')}>
                      Practice
                    </button>
                    <button type="button" onClick={() => startMeetingMode('video')}>
                      Meet
                    </button>
                  </div>
                </>
              )}
            </section>
          )}

          {communityGroupProfileOpen && selectedCommunityGroup && (
            <section
              className="communityGroupProfileWindow"
              role="dialog"
              aria-modal="false"
              aria-label={`${selectedCommunityGroup.name} community profile`}
            >
              <button
                type="button"
                className="communityGroupProfileClose"
                onClick={() => setCommunityGroupProfileOpen(false)}
                aria-label="Close group profile"
              >
                ×
              </button>
              <span className="communityGroupAvatar groupProfileAvatar">
                {selectedCommunityGroup.name.slice(0, 1)}
              </span>
              <div className="groupProfileIdentity">
                <small>Community group</small>
                <strong>{selectedCommunityGroup.name}</strong>
                <span>{selectedCommunityGroup.username}</span>
              </div>
              <p>{selectedCommunityGroup.latest}</p>
              <div className="groupProfileStats">
                <span>
                  <strong>{selectedCommunityGroup.memberCount}</strong>
                  <small>Members</small>
                </span>
                <span>
                  <strong>{selectedCommunityGroup.online}</strong>
                  <small>Online</small>
                </span>
                <span>
                  <strong>{selectedCommunityGroup.category}</strong>
                  <small>Category</small>
                </span>
              </div>
              <div className="groupProfileDetails">
                <span>
                  <small>Language</small>
                  <strong>{selectedCommunityGroup.language}</strong>
                </span>
                <span>
                  <small>Access</small>
                  <strong>{selectedCommunityGroup.privacy}</strong>
                </span>
                <span>
                  <small>Level</small>
                  <strong>{selectedCommunityGroup.level}</strong>
                </span>
                <span>
                  <small>Posting</small>
                  <strong>{selectedCommunityGroup.postingPermission || 'members'}</strong>
                </span>
              </div>
              <div className="groupProfileSecurity">
                <b aria-hidden="true">⌁</b>
                <span>
                  <strong>Local preview protection</strong>
                  <small>Temporary device-session key; group E2EE is not yet available</small>
                </span>
              </div>
              <div className="groupProfileActions">
                <button
                  type="button"
                  onClick={() => {
                    setCommunityGroupProfileOpen(false);
                    setCommunityGroupToolOpen('invite');
                  }}
                >
                  Invite
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCommunityGroupProfileOpen(false);
                    setCommunityGroupToolOpen('settings');
                  }}
                >
                  Settings
                </button>
              </div>
            </section>
          )}

          <form className="groupComposer cleanGroupComposer" onSubmit={postCommunityGroupNote}>
            <button
              type="button"
              className="groupComposerAttach"
              onClick={() => setCommunityGroupToolOpen((open) => (open === 'attach' ? '' : 'attach'))}
              aria-label="Add to group"
              aria-expanded={communityGroupToolOpen === 'attach'}
            >
              <span className="groupComposerAttachIcon" aria-hidden="true">
                <i />
                <i />
              </span>
            </button>
            <button
              type="button"
              className="groupComposerEmoji"
              onClick={() => setCommunityGroupEmojiOpen((open) => !open)}
              aria-label="Add emoji"
              aria-expanded={communityGroupEmojiOpen}
            >
              ☺
            </button>
            <input
              value={communityGroupDraft}
              onChange={(event) => setCommunityGroupDraft(event.target.value)}
              placeholder="Write a practice note..."
              aria-label="Community group message"
            />
            <button
              type="button"
              className={communityGroupVoice.active ? 'groupComposerVoice activeGroupVoice' : 'groupComposerVoice'}
              onClick={toggleCommunityGroupVoice}
              aria-label={communityGroupVoice.active ? 'Stop and send voice message' : 'Record voice message'}
            >
              <span className="groupVoiceIcon" aria-hidden="true">
                <i />
                <b />
              </span>
              {communityGroupVoice.active && <small>{formatVoiceTime(communityGroupVoice.seconds)}</small>}
            </button>
            <button
              type="submit"
              className="postButton"
              disabled={!communityGroupDraft.trim() || !selectedCommunityGroup}
            >
              Post
            </button>
            {communityGroupEmojiOpen && (
              <div className="communityGroupEmojiPicker" aria-label="Community group emojis">
                {COMPOSER_EMOJIS.slice(0, 16).map((emoji) => (
                  <button
                    type="button"
                    key={emoji}
                    onClick={() => {
                      setCommunityGroupDraft((draft) => `${draft}${emoji}`);
                      setCommunityGroupEmojiOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </form>
        </main>
      </div>
    </section>
  );
}

