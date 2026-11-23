import React from 'react';
import { CommunityActionIcon, CommunityFeedVideo } from './AppPresentation';

export default function CommunityView({
  communityNotificationsOpen,
  setCommunityNotificationsOpen,
  communityNotifications,
  setDismissedCommunityNotificationIds,
  setActivePanel,
  communityProfile,
  isSignovaProActive,
  communityAvatarOpen,
  setCommunityAvatarOpen,
  communityAvatarInitials,
  signovaProBadgeLabel,
  communityIdentityEditing,
  setCommunityIdentityEditing,
  updateAvatarSetting,
  normalizeUsername,
  SIGNOVA_AVATAR_ASSETS,
  applyCommunityAvatarPreset,
  generateCommunityAvatarFromAssets,
  saveAvatarCustomization,
  deleteAvatarCustomization,
  undoAvatarCustomization,
  avatarUndoStack,
  redoAvatarCustomization,
  avatarRedoStack,
  communityFeedTabsRef,
  communityFeedFilter,
  setCommunityFeedFilter,
  visibleCommunityPosts,
  toggleCommunityCreatorFollow,
  communityPostMenu,
  setCommunityPostMenu,
  downloadCommunityPost,
  authenticatedFirebaseUser,
  deleteCommunityPost,
  handleCommunityPostReport,
  setStatus,
  toggleCommunityPostLike,
  showCommunityPostLikes,
  openCommunityPostComments,
  shareCommunityPost,
  communityLikeDetails,
  communityComposerMedia,
  communityComposerReview,
  setCommunityComposerReview,
  communityDraft,
  setCommunityDraft,
  communityUpload,
  cancelCommunityUpload,
  publishCommunityPost,
  communityComposerKind,
  setCommunityComposerKind,
  communityComposerFileInputRef,
  addCommunityComposerMedia,
  topContributors,
  trendingSigns,
  setCommunityComposerMedia,
  onOpenCommunityGateway,
}) {
  return (
    <section className="communityPage" aria-label="Signova community dashboard">
      <header className="communityTopBar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <strong>Signova Community Content</strong>
          <button
            type="button"
            className="communityCreatorGatewayBtn"
            onClick={onOpenCommunityGateway}
            title="Configure your Community Creator / Developer ID & AI Training contribution"
          >
            <span>✦</span>
            <span>{communityProfile?.name || 'Creator Persona'}</span>
            {communityProfile?.aiDatasetConsent && <span className="communityAiBadge">AI Contributor</span>}
          </button>
        </div>
        <div className="communityNotificationWrap">
          <button
            type="button"
            className={communityNotificationsOpen ? 'communityIconButton activeCommunityNotification' : 'communityIconButton'}
            aria-label="Notifications"
            aria-expanded={communityNotificationsOpen}
            onClick={() => setCommunityNotificationsOpen((open) => !open)}
          >
            {communityNotifications.length > 0 && (
              <span className="notificationDot">{Math.min(99, communityNotifications.length)}</span>
            )}
            <span className="communityBellIcon" aria-hidden="true"><i /></span>
          </button>
          {communityNotificationsOpen && (
            <div className="communityNotificationPanel" role="dialog" aria-label="Community notifications">
              <div className="communityNotificationHeader">
                <span>Notifications</span>
                <div>
                  <button
                    type="button"
                    className="clearCommunityNotifications"
                    onClick={() => setDismissedCommunityNotificationIds((ids) => [...new Set([...ids, ...communityNotifications.map((item) => item.id)])])}
                    aria-label="Clear all notifications"
                    disabled={!communityNotifications.length}
                  >
                    <i aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setCommunityNotificationsOpen(false)} aria-label="Close notifications">×</button>
                </div>
              </div>
              <div className="communityNotificationList">
                {communityNotifications.length ? communityNotifications.map((item) => (
                  <button type="button" className={`communityNotificationItem ${item.tone}`} key={item.id}>
                    <span>{item.icon}</span>
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </button>
                )) : (
                  <p className="communityNotificationEmpty">No real notifications yet.</p>
                )}
              </div>
            </div>
          )}
        </div>
        <button type="button" className="communityCreateSignButton" onClick={() => { setCommunityNotificationsOpen(false); setActivePanel('communityCreate'); }} aria-label="Create community sign">
          <span className="communityCreateSign3dIcon" aria-hidden="true"><i /><b /><em>+</em></span>
        </button>
        <div className="communityAvatarWrap">
          <button
            type="button"
            className={`communityAvatar avatarTone-${communityProfile.avatarTone || 'cyan'} avatarMode-${communityProfile.avatarMode || '3d'} avatarMood-${communityProfile.avatarMood || 'calm'} avatarAccessory-${communityProfile.avatarAccessory || 'none'} ${isSignovaProActive ? 'proCommunityAvatar' : ''}`}
            aria-label="Customize public creator profile"
            aria-expanded={communityAvatarOpen}
            onClick={() => { setCommunityAvatarOpen(false); setActivePanel('publicProfile'); }}
          >
            {communityProfile.avatarImage ? <img src={communityProfile.avatarImage} alt="" /> : <span className="avatarGlyph" aria-hidden="true"><i /><i /><i /></span>}
            <span className="avatarAccessoryMark" aria-hidden="true" />
            <em>{communityAvatarInitials}</em>
            {isSignovaProActive && <b className="communityProMark" aria-label={signovaProBadgeLabel}>PRO</b>}
          </button>
          {communityAvatarOpen && (
            <div className="communityAvatarPanel" role="dialog" aria-label="Customize public creator profile">
              <div className="avatarPanelHeader">
                <div>
                  <span>Creator Studio</span>
                  <strong>{communityProfile.username ? 'Your public profile is ready' : 'Create your public profile'}</strong>
                  <small>{communityProfile.username || '@signova.creator'} · posts, signs, groups</small>
                </div>
                <button type="button" onClick={() => { setCommunityAvatarOpen(false); setCommunityIdentityEditing(false); }} aria-label="Close avatar customizer">×</button>
              </div>

              <div className="avatarStudioPreview">
                <span className={`communityAvatar avatarTone-${communityProfile.avatarTone || 'cyan'} avatarMode-${communityProfile.avatarMode || '3d'} avatarMood-${communityProfile.avatarMood || 'calm'} avatarAccessory-${communityProfile.avatarAccessory || 'none'}`}>
                  {communityProfile.avatarImage ? <img src={communityProfile.avatarImage} alt="" /> : <span className="avatarGlyph" aria-hidden="true"><i /><i /><i /></span>}
                  <span className="avatarAccessoryMark" aria-hidden="true" />
                  <em>{communityAvatarInitials}</em>
                </span>
                <div>
                  <strong>{communityProfile.name || 'Signova Creator'}</strong>
                  <small>{communityProfile.bio || 'Public creator profile for Signova community.'}</small>
                </div>
              </div>

              {!communityIdentityEditing ? (
                <div className="avatarIdentitySummary">
                  <span><b>Name</b>{communityProfile.name || 'Signova Creator'}</span>
                  <span><b>Username</b>{communityProfile.username || '@signova.creator'}</span>
                  <button type="button" onClick={() => setCommunityIdentityEditing(true)}>Edit identity</button>
                </div>
              ) : (
                <div className="avatarIdentityEditor">
                  <label className="avatarField">
                    <span>Creator name</span>
                    <input value={communityProfile.name} onChange={(event) => updateAvatarSetting('name', event.target.value)} />
                  </label>
                  <label className="avatarField">
                    <span>Creator username</span>
                    <input value={communityProfile.username} onChange={(event) => updateAvatarSetting('username', normalizeUsername(event.target.value))} />
                  </label>
                  <label className="avatarField">
                    <span>Public bio</span>
                    <input value={communityProfile.bio} onChange={(event) => updateAvatarSetting('bio', event.target.value)} />
                  </label>
                  <label className="avatarField">
                    <span>Initials</span>
                    <input
                      value={communityProfile.avatarInitials}
                      maxLength={2}
                      onChange={(event) => updateAvatarSetting('avatarInitials', event.target.value.toUpperCase())}
                    />
                  </label>
                </div>
              )}

              <div className="avatarPresetGrid" aria-label="Create 3D avatar presets">
                {SIGNOVA_AVATAR_ASSETS.map((preset) => (
                  <button type="button" key={preset.label} onClick={() => applyCommunityAvatarPreset(preset)}>
                    <span className={`presetAvatarDot avatarTone-${preset.tone}`}>{preset.image ? <img src={preset.image} alt="" /> : <i />}</span>
                    <b>{preset.label}</b>
                  </button>
                ))}
                <button type="button" className="avatarGenerateMixButton" onClick={generateCommunityAvatarFromAssets}>
                  <span className="presetAvatarDot avatarTone-orange"><i /></span>
                  <b>Generate mix</b>
                </button>
              </div>

              <div className="avatarModeGrid" aria-label="Avatar render style">
                <button type="button" className={communityProfile.avatarMode === '3d' ? 'activeAvatarMode' : ''} onClick={() => updateAvatarSetting('avatarMode', '3d')}>Soft 3D</button>
                <button type="button" className={communityProfile.avatarMode === 'flat' ? 'activeAvatarMode' : ''} onClick={() => updateAvatarSetting('avatarMode', 'flat')}>Simple mark</button>
              </div>
              <div className="avatarMiniOptions" aria-label="Avatar details">
                {[
                  ['avatarMood', 'calm', 'Calm'],
                  ['avatarMood', 'smile', 'Smile'],
                  ['avatarAccessory', 'none', 'No item'],
                  ['avatarAccessory', 'glasses', 'Glasses'],
                  ['avatarAccessory', 'headset', 'Headset'],
                ].map(([key, value, label]) => (
                  <button
                    type="button"
                    className={communityProfile[key] === value ? 'activeAvatarMiniOption' : ''}
                    key={`${key}-${value}`}
                    onClick={() => updateAvatarSetting(key, value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="avatarToneGrid" aria-label="Avatar color">
                {['cyan', 'purple', 'green', 'orange', 'pink'].map((tone) => (
                  <button
                    type="button"
                    className={`avatarToneButton avatarTone-${tone} ${communityProfile.avatarTone === tone ? 'activeAvatarTone' : ''}`}
                    key={tone}
                    onClick={() => updateAvatarSetting('avatarTone', tone)}
                    aria-label={`Use ${tone} avatar tone`}
                  />
                ))}
              </div>
              <div className="avatarActionRow" aria-label="Avatar actions">
                <button type="button" onClick={saveAvatarCustomization} title="Save avatar" aria-label="Save avatar"><span className="avatarSaveIcon" /></button>
                <button type="button" onClick={deleteAvatarCustomization} title="Reset avatar" aria-label="Reset avatar"><span className="avatarResetIcon" /></button>
                <button type="button" onClick={undoAvatarCustomization} disabled={!avatarUndoStack.length} title="Undo avatar change" aria-label="Undo avatar change">↶</button>
                <button type="button" onClick={redoAvatarCustomization} disabled={!avatarRedoStack.length} title="Redo avatar change" aria-label="Redo avatar change">↷</button>
              </div>
            </div>
          )}
        </div>
      </header>

      <nav ref={communityFeedTabsRef} className="communityFeedTabs" aria-label="Community feed filters">
        {['For You', 'Reels', 'Following', 'ISL', 'ASL', 'Emergency', 'Daily Use'].map((label) => (
          <button type="button" className={communityFeedFilter === label ? 'activeFeedTab' : ''} key={label} onClick={() => setCommunityFeedFilter(label)}>{label}</button>
        ))}
      </nav>

      <div className="communitySocialLayout">
        <main className="communityFeed communitySocialFeed" aria-label="Community sign feed">
          <div className="communityPostStream" aria-label="Scrollable community posts">
            {visibleCommunityPosts.map((post) => (
              <article className={`feedPostCard communitySocialPost ${post.mediaType === 'video' ? 'communityVideoPost' : ''}`} key={post.id}>
                <header className="socialPostHeader">
                  <span className={`communityAvatar socialCreatorAvatar avatarTone-${post.avatarTone || 'cyan'}`}>{post.avatarImage ? <img src={post.avatarImage} alt="" /> : post.avatar}</span>
                  <div>
                    <strong>{post.name}<span className="verifiedCreatorMark" aria-label="Verified creator">✓</span>{(post.isPremium || (isSignovaProActive && post.username === communityProfile.username)) && <span className="socialProCreatorMark" aria-label="Signova Pro member">PRO</span>}</strong>
                    <small>{post.username || '@signova.creator'} · {post.level} · {post.time}</small>
                  </div>
                  <button type="button" className={post.following ? 'followCreatorButton followingCreatorButton' : 'followCreatorButton'} onClick={() => toggleCommunityCreatorFollow(post.id)}>
                    {post.following ? 'Following' : 'Follow'}
                  </button>
                  <div className="communityPostMenuWrap">
                    <button
                      type="button"
                      className="postMoreButton"
                      aria-label="More post options"
                      aria-expanded={communityPostMenu.postId === post.id}
                      onClick={() => setCommunityPostMenu((menu) => menu.postId === post.id ? { postId: '', reportOpen: false } : { postId: post.id, reportOpen: false })}
                    >•••</button>
                    {communityPostMenu.postId === post.id && (
                      <div className="communityPostOptionsMenu" role="menu">
                        <button type="button" role="menuitem" onClick={() => downloadCommunityPost(post)}>
                          <span className="postOptionIcon downloadPostIcon" aria-hidden="true"><i /></span>
                          Download
                        </button>
                        {post.authorUid === authenticatedFirebaseUser?.uid && (
                          <button type="button" role="menuitem" className="dangerPostOption" onClick={() => deleteCommunityPost(post)}>
                            <span className="postOptionIcon deletePostIcon" aria-hidden="true"><i /></span>
                            Delete post
                          </button>
                        )}
                        <button
                          type="button"
                          role="menuitem"
                          aria-expanded={communityPostMenu.reportOpen}
                          onClick={() => setCommunityPostMenu((menu) => ({ ...menu, reportOpen: !menu.reportOpen }))}
                        >
                          <span className="postOptionIcon reportPostIcon" aria-hidden="true"><i /></span>
                          Report content
                          <em>›</em>
                        </button>
                        {communityPostMenu.reportOpen && (
                          <div className="communityReportSubmenu">
                            <button type="button" onClick={() => handleCommunityPostReport(post, 'not-interested')}>Not interested</button>
                            <button type="button" onClick={() => handleCommunityPostReport(post, 'report-spam')}>Spam or misleading</button>
                            <button type="button" onClick={() => handleCommunityPostReport(post, 'report-harassment')}>Harassment or unsafe</button>
                            <button type="button" onClick={() => handleCommunityPostReport(post, 'report-copyright')}>Copyright concern</button>
                            <button type="button" onClick={() => handleCommunityPostReport(post, 'remove')}>Hide this post</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </header>

                <div className="communityPostCopy">
                  <strong>{post.sign}</strong>
                  <p>{post.text}</p>
                </div>

                <div className={`communityPostMedia ${post.mediaType === 'video' ? 'communityVideoPostMedia' : ''}`}>
                  {post.mediaType !== 'video' && (
                    <div className="contentUploaderBadge" aria-label={`Uploaded by ${post.name}`}>
                      <span className={`communityAvatar contentUploaderAvatar avatarTone-${post.avatarTone || 'cyan'}`}>{post.avatarImage ? <img src={post.avatarImage} alt="" /> : post.avatar}</span>
                      <span>
                        <strong>{post.name}</strong>
                        <small>{post.time}</small>
                      </span>
                    </div>
                  )}
                  {post.mediaType === 'video' ? (
                    <CommunityFeedVideo src={post.mediaUrl} poster={post.thumbnailUrl} label={`${post.name} posted ${post.sign} video`} />
                  ) : (
                    <img src={post.mediaUrl} alt={`${post.name} demonstrating the ${post.sign} sign`} loading="lazy" decoding="async" />
                  )}
                  {post.mediaType === 'video' && (
                    <div className="communityMediaMeta">
                      <span>{post.duration}</span>
                      <span>{post.confidence} AI confidence</span>
                    </div>
                  )}
                </div>

                <div className="postTags">
                  {post.tags.map((tag) => <span key={tag}>{tag}</span>)}
                </div>

                <div className="communityLearningTip">
                  <span>Learning tip</span>
                  <p>{post.learningTip}</p>
                  <button type="button" onClick={() => setStatus(`${post.sign} opened in learning mode.`)}>Learn this sign</button>
                </div>

                <div className="postActions socialPostActions">
                  <button type="button" className={post.liked ? 'activePostAction' : ''} onClick={() => toggleCommunityPostLike(post.id)} aria-label={post.liked ? 'Liked' : 'Like'} data-label={post.liked ? 'Liked' : 'Like'}>
                    <CommunityActionIcon type="like" active={post.liked} />
                    <span className="socialActionText">{post.liked ? 'Liked' : 'Like'}</span>
                    <strong onClick={(event) => { event.stopPropagation(); showCommunityPostLikes(post.id); }} title="Show live like records">{post.stats.likes.toLocaleString()}</strong>
                  </button>
                  <button type="button" onClick={() => openCommunityPostComments(post)} aria-label="Comment" data-label="Comment">
                    <CommunityActionIcon type="comment" />
                    <span className="socialActionText">Comment</span>
                    <strong>{post.stats.comments.toLocaleString()}</strong>
                  </button>
                  <button type="button" onClick={() => shareCommunityPost(post.id)} aria-label="Share" data-label="Share">
                    <CommunityActionIcon type="share" />
                    <span className="socialActionText">Share</span>
                    <strong>{post.stats.shares.toLocaleString()}</strong>
                  </button>
                </div>
                {communityLikeDetails.postId === post.id && (
                  <div className="communityLiveLikes" aria-live="polite">
                    <span>Live likes</span>
                    {communityLikeDetails.loading
                      ? <small>Loading recorded likes…</small>
                      : communityLikeDetails.likes.length
                        ? communityLikeDetails.likes.map((like) => <small key={like.userId}><b>{like.name}</b>{like.username ? ` · ${like.username}` : ''}</small>)
                        : <small>No recorded likes yet.</small>}
                  </div>
                )}
              </article>
            ))}
            {!visibleCommunityPosts.length && (
              <p className="realDataEmpty">No signs match this feed yet. Follow creators or publish a sign to grow it.</p>
            )}
          </div>
        </main>

        <aside className="communityDiscoveryRail" aria-label="Discover community creators">
          <section className="createPostCard communityQuickComposer">
            <div className="communityComposerPipeline" aria-label="Post creation process">
              <span className={communityComposerMedia ? 'complete' : 'active'}><b>1</b>Select</span>
              <i />
              <span className={communityComposerReview.stage === 'ready' ? 'complete' : communityComposerMedia ? 'active' : ''}><b>2</b>Verify</span>
              <i />
              <span className={communityDraft.trim() ? 'complete' : ''}><b>3</b>Caption</span>
              <i />
              <span><b>4</b>Publish</span>
            </div>
            <div className="postIdentity">
              <span className={`communityAvatar smallAvatar avatarTone-${communityProfile.avatarTone || 'cyan'} avatarMode-${communityProfile.avatarMode || '3d'} avatarMood-${communityProfile.avatarMood || 'calm'} avatarAccessory-${communityProfile.avatarAccessory || 'none'} ${isSignovaProActive ? 'proCommunityAvatar' : ''}`}>
                {communityProfile.avatarImage ? <img src={communityProfile.avatarImage} alt="" /> : <span className="avatarGlyph" aria-hidden="true"><i /><i /><i /></span>}
                <em>{communityAvatarInitials}</em>
                {isSignovaProActive && <b className="communityProMark" aria-label={signovaProBadgeLabel}>PRO</b>}
              </span>
              <textarea value={communityDraft} onChange={(event) => setCommunityDraft(event.target.value)} placeholder="Select media to generate a caption, or write your own…" aria-label="Community post caption" maxLength="600" />
            </div>
            {communityComposerMedia && (
              <div className="communityComposerReview">
                <div className="communityComposerMediaPreview">
                  {communityComposerMedia.type === 'video'
                    ? <video src={communityComposerMedia.url} muted controls />
                    : <img src={communityComposerMedia.url} alt="Selected post preview" />}
                  <span>{communityComposerMedia.name}</span>
                </div>
                <div className="communityComposerChecks">
                  <strong>{communityComposerReview.stage === 'analyzing' ? 'Checking media…' : 'Verification points'}</strong>
                  {communityComposerReview.checks.map((check) => <small className={check.pass ? 'pass' : 'review'} key={check.label}>{check.pass ? '✓' : '!'} {check.label}</small>)}
                  {communityComposerReview.suggestions.map((suggestion) => <p key={suggestion}>{suggestion}</p>)}
                  {communityComposerReview.stage === 'ready' && (
                    <label><input type="checkbox" checked={communityComposerReview.confirmed} onChange={(event) => setCommunityComposerReview((review) => ({ ...review, confirmed: event.target.checked }))} /> I reviewed the caption, consent, and media quality.</label>
                  )}
                </div>
              </div>
            )}
            {communityUpload.stage !== 'idle' && (
              <div className={`communityUploadStatus upload-${communityUpload.stage}`} aria-live="polite">
                <div>
                  <span>{communityUpload.stage === 'uploading' ? 'Uploading media' : communityUpload.stage === 'uploaded' ? 'Upload complete' : 'Upload paused'}</span>
                  <strong>{communityUpload.stage === 'uploading' || communityUpload.stage === 'uploaded' ? `${communityUpload.progress}%` : communityUpload.error}</strong>
                </div>
                <progress max="100" value={communityUpload.progress} aria-label="Community media upload progress" />
                {communityUpload.stage === 'uploading' && <button type="button" onClick={cancelCommunityUpload}>Cancel</button>}
                {(communityUpload.stage === 'failed' || communityUpload.stage === 'cancelled') && <button type="button" onClick={publishCommunityPost}>Retry</button>}
              </div>
            )}
            <div className="createPostActions">
              <button type="button" className="ghostCommunityButton" onClick={() => setActivePanel('communityCreate')}>Create Sign</button>
              <label className={communityComposerMedia ? 'ghostCommunityButton activeComposerMediaButton' : 'ghostCommunityButton'}>
                <input ref={communityComposerFileInputRef} type="file" accept={communityComposerKind === 'reel' ? 'video/*' : 'image/*,video/*'} onChange={addCommunityComposerMedia} />
                {communityComposerMedia ? communityComposerMedia.name : 'Add media'}
              </label>
              <button type="button" className="postButton" onClick={publishCommunityPost} disabled={communityUpload.stage === 'uploading' || !communityDraft.trim() || (communityComposerMedia && !communityComposerReview.confirmed)}>Publish</button>
            </div>
          </section>
          <section className="communityPanel communityDiscoverCard">
            <div className="communityPanelHeader"><strong>Discover creators</strong></div>
            {topContributors.slice(0, 4).map((user) => (
              <div className="communityCreatorSuggestion" key={user.name}>
                <span className="miniAvatar">{user.avatar}</span>
                <div><strong>{user.name}</strong><small>{user.signsCreated} signs · {user.label}</small></div>
                <button type="button">Follow</button>
              </div>
            ))}
          </section>
          <section className="communityPanel communityDiscoverCard">
            <div className="communityPanelHeader"><strong>Trending signs</strong></div>
            <div className="communityTrendChips">
              {(trendingSigns.length ? trendingSigns.slice(0, 6).map((sign) => sign.title) : ['Need Help', 'Thank You', 'Nice to meet you']).map((sign) => (
                <button type="button" key={sign}>#{sign.replace(/\s+/g, '')}</button>
              ))}
            </div>
          </section>
          <section className="communityCreateCta" aria-label="Create community content">
            <span>Create content</span>
            <small>Publish a verified sign or a short vertical reel.</small>
            <div>
              <button type="button" onClick={() => setActivePanel('communityCreate')}>Create sign</button>
              <button type="button" onClick={() => {
                setCommunityComposerKind('reel');
                setCommunityComposerMedia(null);
                setCommunityComposerReview({ stage: 'idle', checks: [], suggestions: [], confirmed: false });
                communityComposerFileInputRef.current?.click();
              }}>Create reel</button>
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}