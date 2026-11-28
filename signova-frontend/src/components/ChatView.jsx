import React from 'react';
import EncryptionStatusNotice from './EncryptionStatusNotice';
import CallWorkspace from './CallWorkspace';
import { Attach3DIcon } from './SignovaIcons';
import {
  ContactAvatar,
  ContactMetaLine,
  HeaderMoreIcon,
  HeaderSearchIcon,
  VideoSignChatIcon,
  VoiceSignChatIcon,
} from './AppPresentation';
import LazySpecialMessageCard from '../features/chat/LazySpecialMessageCard';
import { conversationE2EE } from '../securityCapabilities';
import { COMPOSER_EMOJIS, GESTURE_STICKERS } from '../features/app/appData';

export default function ChatView(props) {
  const {
    activePanel,
    selectedChatContact,
    setMobileChatListOpen,
    setContactInfoOpen,
    selectedChatPresence,
    status,
    selectedHeaderActivity,
    activeCallLog,
    callExperience,
    callStatus,
    startVideoSignChat,
    startVoiceSignChat,
    setMessageSearchOpen,
    messageSearchOpen,
    messageSearch,
    setMessageSearch,
    toggleHeaderMenu,
    chatHeaderMenuOpen,
    setChatHeaderMenuOpen,
    selectedChatFlags,
    handleHeaderChatAction,
    chatCallScreen,
    chatCallMinimized,
    chatCallExpanded,
    chatCallInfoOpen,
    chatCallPosition,
    startChatCallMove,
    formatCallTimer,
    callElapsedSeconds,
    callNetworkQuality,
    setChatCallInfoOpen,
    desktopCallWindowMode,
    setChatCallPosition,
    setChatCallMinimized,
    setChatCallExpanded,
    setChatCallMoreOpen,
    setChatCallHistoryOpen,
    endCallSession,
    cameraEnabled,
    streamRef,
    accountAvatarInitials,
    remoteMediaState,
    remoteCaption,
    liveSign,
    activeCallLanguage,
    currentSignReference,
    activeCallBook,
    captionChannelStatus,
    callControlsVisible,
    chatCallMoreOpen,
    setChatCallFocus,
    switchToVideoSignChat,
    chatCallFocus,
    callVideoFilterStyle,
    settings,
    attachLocalTrackingVideo,
    canvasRef,
    revealCallControls,
    toggleCallTranslation,
    synapseEnabled,
    handleCameraControlClick,
    flipCameraFacingMode,
    toggleMicTrack,
    micEnabled,
    premiumDarkMode,
    chatCallSettingsTab,
    setChatCallSettingsTab,
    changeTranslationLanguage,
    updateSetting,
    voiceEnabled,
    setVoiceEnabled,
    chatCallHistoryOpen,
    callTranscript,
    formatConfidence,
    callConfidencePercent,
    TEMPORAL_BUFFER_SIZE,
    currentSignNumber,
    callVocabularySize,
    currentSignModel,
    callSignTelemetry,
    callQualityState,
    cameraQuality,
    captionChannelRef,
    startWebRtcPreview,
    unlockSelectedChat,
    visibleChatMessages,
    selectedMessageIds,
    canModifyMessage,
    reactionMessageId,
    toolMessageId,
    emojiPickerMessageId,
    handleMessageClick,
    openReactionWindow,
    openToolWindow,
    editSharedContact,
    addSharedContact,
    voteAudiencePoll,
    editMeetMoment,
    saveMeetDetail,
    audioPlaybackRates,
    updateAudioPlaybackRate,
    cancelDirectAttachmentUpload,
    messageReceiptLabel,
    MESSAGE_QUICK_REACTIONS,
    reactFromWindow,
    setStatus,
    setEmojiPickerMessageId,
    MESSAGE_EMOJI_REACTIONS,
    runMessageTool,
    copyMessage,
    forwardMessage,
    toggleSelectMessage,
    setMessageTranslateMenu,
    toggleMessageFlag,
    setMessageInfoId,
    messageInfoId,
    retryMessage,
    editMessage,
    unsendMessage,
    markMessageDeleted,
    messageTranslateMenu,
    translateMessage,
    composerSending,
    sendChatMessage,
    scheduleComposerOpen,
    scheduleForm,
    setScheduleForm,
    scheduleDraftMessage,
    setScheduleComposerOpen,
    chatDraft,
    composerPickerOpen,
    composerPickerTab,
    setComposerPickerTab,
    selectComposerEmoji,
    useTranslationAsMessage,
    sentence,
    caption,
    signLibrary,
    selectComposerSign,
    selectComposerSticker,
    attachMenuOpen,
    setAttachMenuOpen,
    attachmentInputRef,
    attachmentAccept,
    handleDriveUpload,
    handleAttachmentAction,
    setComposerPickerOpen,
    voiceNote,
    voiceWaveform,
    toggleVoicePause,
    startVoiceNote,
    formatVoiceTime,
    addVoiceNote,
    deleteVoiceNote,
    setChatDraft,
    startSendLongPress,
    stopSendLongPress,
    handleSendIconClick,
    attachRemoteCallVideo,
    setChatCallScreen,
    openPanel,
    chatE2EECapability,
  } = props;

  if (activePanel !== 'chats') {
    return null;
  }

  return (
    <>
      {!selectedChatContact ? (
          <section className="chatBlankCanvas" aria-label="No chat selected">
            <div className="chatBlankAnimation" aria-hidden="true">
              <span className="blankOrbit blankOrbitOne" />
              <span className="blankOrbit blankOrbitTwo" />
              <span className="blankGestureCore">S</span>
              <span className="blankWave blankWaveOne" />
              <span className="blankWave blankWaveTwo" />
            </div>
            <div>
              <span>Signova Chats</span>
              <strong>Select a chat to begin</strong>
              <small>Press Esc anytime to unselect the current chat and return here.</small>
            </div>
          </section>
      ) : (
        <>
          <header className="chatHeader">
          <button
            type="button"
            className="mobileChatBackButton"
            onClick={() => setMobileChatListOpen(true)}
            aria-label="Back to chats"
          >
            ‹
          </button>
          <button type="button" className="chatIdentity chatIdentityButton" onClick={() => setContactInfoOpen(true)} aria-label="Open contact profile">
            <ContactAvatar
              contact={selectedChatContact || { name: 'Signova', username: '@signova.ai', avatarChoice: 'signova' }}
              presenceTone={selectedChatPresence?.tone || 'online'}
            />
            <div>
              <strong>{selectedChatContact?.name || 'Signova Interpreter'}</strong>
              {selectedChatContact ? (
                <ContactMetaLine contact={selectedChatContact} activityItems={selectedHeaderActivity} />
              ) : (
                <small className="contactMetaLine"><b>{status}</b><i aria-hidden="true">·</i><span className="headerActivityTicker"><em>{selectedHeaderActivity[0] || 'Active now'}</em></span></small>
              )}
            </div>
          </button>
          <div className="headerActions">
            <EncryptionStatusNotice capability={chatE2EECapability || conversationE2EE} />
            {activeCallLog?.contactId === selectedChatContact?.id ? (
              <span className="chatHeaderCallStatus">
                <b>{callExperience.includes('voice') ? 'Voice call' : 'Video call'}</b>
                <small>{callStatus}</small>
              </span>
            ) : null}
            <button
              type="button"
              className={`chatCallGlassButton premiumHeaderButton premiumCallButton videoSignChatButton ${activeCallLog?.contactId === selectedChatContact?.id && !callExperience.includes('voice') ? 'activePremiumCallButton' : ''}`}
              onClick={() => startVideoSignChat(true)}
              aria-label="Start Video Sign Chat"
              title="Video Sign Chat"
              data-tooltip="Video Sign Chat"
            >
              <VideoSignChatIcon />
              <span className="visuallyHidden">Video Sign Chat</span>
            </button>
            <button
              type="button"
              className={`chatCallGlassButton premiumHeaderButton premiumCallButton voiceSignChatButton ${activeCallLog?.contactId === selectedChatContact?.id && callExperience.includes('voice') ? 'activePremiumCallButton' : ''}`}
              onClick={() => startVoiceSignChat(true)}
              aria-label="Start Voice Sign Chat"
              title="Voice Sign Chat"
              data-tooltip="Voice Sign Chat"
            >
              <VoiceSignChatIcon />
              <span className="visuallyHidden">Voice Sign Chat</span>
            </button>
            <button
              type="button"
              className="chatCallGlassButton premiumHeaderButton chatSearchIconButton"
              onClick={() => {
                setMessageSearchOpen((open) => !open);
                window.setTimeout(() => document.querySelector('.chatHeaderSearch input')?.focus(), 60);
              }}
              aria-label="Search in chat"
              title="Search"
            >
              <HeaderSearchIcon />
              <span className="visuallyHidden">Search</span>
            </button>
            <div className="chatHeaderMenuWrap">
              <button
                type="button"
                className="chatCallGlassButton premiumHeaderButton chatMoreIconButton"
                onClick={toggleHeaderMenu}
                aria-label="Chat menu"
              title="More"
              aria-expanded={chatHeaderMenuOpen}
            >
                <HeaderMoreIcon />
                <span className="visuallyHidden">Chat menu</span>
              </button>
              {chatHeaderMenuOpen && (
                <div className="chatActionMenu headerChatActionMenu modernGroupedChatMenu" role="menu" onMouseLeave={() => setChatHeaderMenuOpen(false)}>
                  {[
                    {
                      groupTitle: 'Actions & Tools',
                      items: [
                        ['video-call', 'camera', 'Video Sign Chat'],
                        ['voice-call', 'audio', 'Voice Sign Chat'],
                        ['info', 'info', 'Contact profile'],
                        ['search', 'search', 'Search messages'],
                        ['select', 'select', 'Select messages'],
                        ['translate', 'translate', 'Open translation'],
                        ['share-contact', 'share', 'Share Signova contact'],
                        ['video-link', 'link', 'Send sign-chat link'],
                      ],
                    },
                    {
                      groupTitle: 'Chat Settings',
                      items: [
                        ['muted', 'mute', selectedChatFlags.muted ? 'Unmute alerts' : 'Mute alerts'],
                        ['pinned', 'pin', selectedChatFlags.pinned ? 'Unpin chat' : 'Pin chat'],
                        ['favourite', 'heart', selectedChatFlags.favourite ? 'Remove favourite' : 'Favourite chat'],
                        ['locked', 'lock', selectedChatFlags.locked ? 'Unlock private chat' : 'Lock private chat'],
                      ],
                    },
                    {
                      groupTitle: 'Privacy & Safety',
                      danger: true,
                      items: [
                        ['report', 'report', 'Report safety issue'],
                        ['blocked', 'block', selectedChatFlags.blocked ? 'Unblock contact' : 'Block contact'],
                        ['clear', 'clear', 'Clear chat'],
                        ['delete', 'trash', 'Delete chat'],
                      ],
                    },
                  ].map((section, idx) => (
                    <div key={section.groupTitle} className={`chatMenuGroup ${section.danger ? 'chatMenuDangerGroup' : ''}`}>
                      {idx > 0 && <div className="chatMenuGroupDivider" role="separator" />}
                      <span className="chatMenuGroupTitle">{section.groupTitle}</span>
                      <div className="chatMenuGroupItems">
                        {section.items.map(([action, iconType, label]) => (
                          <button
                            type="button"
                            role="menuitem"
                            className={section.danger ? 'dangerChatAction' : ''}
                            key={action}
                            onClick={() => handleHeaderChatAction(action)}
                          >
                            <Attach3DIcon type={iconType} />
                            <span>{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        {messageSearchOpen && (
          <label className="chatHeaderSearch">
            <span aria-hidden="true">⌕</span>
            <input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="Search messages" aria-label="Search messages in this chat" />
            <button type="button" onClick={() => { setMessageSearch(''); setMessageSearchOpen(false); }} aria-label="Close message search">×</button>
          </label>
        )}
        <CallWorkspace
          chatCallScreen={chatCallScreen}
          chatCallMinimized={chatCallMinimized}
          chatCallExpanded={chatCallExpanded}
          chatCallInfoOpen={chatCallInfoOpen}
          chatCallPosition={chatCallPosition}
          startChatCallMove={startChatCallMove}
          formatCallTimer={formatCallTimer}
          callElapsedSeconds={callElapsedSeconds}
          callStatus={callStatus}
          callNetworkQuality={callNetworkQuality}
          setChatCallInfoOpen={setChatCallInfoOpen}
          desktopCallWindowMode={desktopCallWindowMode}
          setChatCallPosition={setChatCallPosition}
          setChatCallMinimized={setChatCallMinimized}
          setChatCallExpanded={setChatCallExpanded}
          setChatCallMoreOpen={setChatCallMoreOpen}
          setChatCallHistoryOpen={setChatCallHistoryOpen}
          endCallSession={endCallSession}
          setChatCallFocus={setChatCallFocus}
          streamRef={streamRef}
          cameraEnabled={cameraEnabled}
          settings={settings}
          accountAvatarInitials={accountAvatarInitials}
          selectedChatContact={selectedChatContact}
          remoteMediaState={remoteMediaState}
          attachRemoteCallVideo={attachRemoteCallVideo}
          remoteCaption={remoteCaption}
          liveSign={liveSign}
          currentSignReference={currentSignReference}
          activeCallBook={activeCallBook}
          captionChannelStatus={captionChannelStatus}
          handleCameraControlClick={handleCameraControlClick}
          flipCameraFacingMode={flipCameraFacingMode}
          micEnabled={micEnabled}
          toggleMicTrack={toggleMicTrack}
          synapseEnabled={synapseEnabled}
          toggleCallTranslation={toggleCallTranslation}
          switchToVideoSignChat={switchToVideoSignChat}
          setChatCallScreen={setChatCallScreen}
          openPanel={openPanel}
          chatCallHistoryOpen={chatCallHistoryOpen}
          chatCallMoreOpen={chatCallMoreOpen}
          revealCallControls={revealCallControls}
          setChatCallSettingsTab={setChatCallSettingsTab}
          callVideoFilterStyle={callVideoFilterStyle}
          chatCallFocus={chatCallFocus}
          attachLocalTrackingVideo={attachLocalTrackingVideo}
          canvasRef={canvasRef}
          callControlsVisible={callControlsVisible}
          activeCallLanguage={activeCallLanguage}
          premiumDarkMode={premiumDarkMode}
          chatCallSettingsTab={chatCallSettingsTab}
          changeTranslationLanguage={changeTranslationLanguage}
          updateSetting={updateSetting}
          voiceEnabled={voiceEnabled}
          setVoiceEnabled={setVoiceEnabled}
          callTranscript={callTranscript}
          formatConfidence={formatConfidence}
          callConfidencePercent={callConfidencePercent}
          TEMPORAL_BUFFER_SIZE={TEMPORAL_BUFFER_SIZE}
          currentSignNumber={currentSignNumber}
          callVocabularySize={callVocabularySize}
          currentSignModel={currentSignModel}
          callSignTelemetry={callSignTelemetry}
          callQualityState={callQualityState}
          cameraQuality={cameraQuality}
          captionChannelRef={captionChannelRef}
          startWebRtcPreview={startWebRtcPreview}
        />
        {selectedChatFlags.locked ? (
          <section className="chatLockedCanvas" aria-label="Locked chat">
            <div className="chatLockOrb" aria-hidden="true">
              <span />
              <b>🔒</b>
            </div>
            <span>Private Chat</span>
            <strong>{selectedChatContact?.name || 'This chat'} is locked</strong>
            <small>{selectedChatFlags.passwordSet ? 'Enter the chat password to continue messaging.' : 'Unlock this chat from the menu or use the button below to continue messaging.'}</small>
            <button type="button" onClick={unlockSelectedChat}>Unlock chat</button>
          </section>
        ) : (
        <>
        <section className="messageThread" aria-label="Signova chat">
          {visibleChatMessages.map((message) => {
            const isOutgoing = message.direction === 'outgoing';
            const selected = selectedMessageIds.includes(message.id);
            const mutable = canModifyMessage(message);
            const reactionOpen = reactionMessageId === message.id;
            const toolOpen = toolMessageId === message.id;
            const emojiOpen = emojiPickerMessageId === message.id;
            const isTextMessage = !message.attachmentType;
            const canCopyMessage = isTextMessage || ['contact', 'meet', 'poll', 'sticker'].includes(message.attachmentType);
            const canTranslateMessage = isTextMessage;
            const canEditTextMessage = isOutgoing && mutable && isTextMessage;
            const canUnsendMessage = isOutgoing && mutable;
            return (
              <article
                className={[
                  'messageBubble',
                  isOutgoing ? 'outgoingBubble' : 'incomingBubble',
                  reactionOpen || toolOpen || emojiOpen ? 'activeMessageBubble' : '',
                  selected ? 'selectedMessageBubble' : '',
                  message.pinned ? 'pinnedMessageBubble' : '',
                  message.starred ? 'starredMessageBubble' : '',
                ].filter(Boolean).join(' ')}
                key={message.id}
                onClick={() => handleMessageClick(message)}
                onDoubleClick={(event) => openReactionWindow(event, message.id)}
                onContextMenu={(event) => openToolWindow(event, message.id)}
              >
                <div className="messageBubbleTopline" aria-hidden={!message.pinned && !message.starred && !message.forwarded && !message.edited}>
                  {message.pinned ? <span><Attach3DIcon type="pin" />Pinned</span> : null}
                  {message.starred ? <span><Attach3DIcon type="heart" />Starred</span> : null}
                  {message.forwarded ? <span>Forwarded</span> : null}
                  {message.edited ? <span>Edited {message.editedAt}</span> : null}
                </div>
                {message.attachmentType ? (
                  <LazySpecialMessageCard
                    message={message}
                    IconComponent={Attach3DIcon}
                    isOutgoing={isOutgoing}
                    onEditContact={() => editSharedContact(message)}
                    onAddContact={() => addSharedContact(message)}
                    onVotePoll={(optionIndex) => voteAudiencePoll(message, optionIndex)}
                    onEditMeet={() => editMeetMoment(message)}
                    onSaveMeetDetail={(target) => saveMeetDetail(message, target)}
                    audioSpeed={audioPlaybackRates[message.id] || 1}
                    onAudioSpeedChange={(rate) => updateAudioPlaybackRate(message.id, rate)}
                    onCancelAttachmentUpload={() => cancelDirectAttachmentUpload(message.id)}
                  />
                ) : (
                  <p>{message.text}</p>
                )}
                {message.translatedText ? (
                  <div className="messageTranslationResult">
                    <span>{message.translatedLanguage}</span>
                    <strong>{message.translatedText}</strong>
                    <small>Voice played · {message.translatedAt}</small>
                  </div>
                ) : null}
                {isOutgoing ? (
                  <small className="outgoingReceiptLine">
                    <span className="msgMetaTime">{message.sentAt || message.time}</span>
                    <span
                      className={`outgoingSeenState ${message.seenGlow || message.status === 'read' ? 'isRead' : ''}`}
                      title={settings.privacy.readReceipts && message.readAt ? `Seen ${message.readAt}` : (message.status || 'Sent')}
                      aria-label={settings.privacy.readReceipts && message.readAt ? `Seen ${message.readAt}` : (message.status || 'Sent')}
                    >
                      <b className={message.seenGlow ? 'receiptTicks readReceiptTicks' : 'receiptTicks'}>
                        {messageReceiptLabel(message)}
                      </b>
                    </span>
                  </small>
                ) : (
                  <small className="messageLiveActivity">
                    <span className="msgMetaTime">{message.time}</span>
                  </small>
                )}
                {message.reactions?.length ? <em className="messageReactionLine">{message.reactions.join(' ')}</em> : null}
                {reactionOpen ? (
                  <div className="messageReactionWindow" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="React to message">
                    {MESSAGE_QUICK_REACTIONS.map((reaction) => (
                      <button type="button" key={reaction} title={`React ${reaction}`} aria-label={`React ${reaction}`} onClick={() => reactFromWindow(message, reaction).catch((error) => setStatus(error?.message || 'Reaction failed'))}>
                        {reaction}
                      </button>
                    ))}
                    <button type="button" className="moreEmojiButton" title="More reactions" aria-label="More reactions" onClick={() => setEmojiPickerMessageId((currentId) => (currentId === message.id ? '' : message.id))}>+</button>
                  </div>
                ) : null}
                {emojiOpen ? (
                  <div className="messageEmojiPicker" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Emoji reactions">
                    {MESSAGE_EMOJI_REACTIONS.map((reaction) => (
                      <button type="button" key={reaction} title={`React ${reaction}`} aria-label={`React ${reaction}`} onClick={() => reactFromWindow(message, reaction).catch((error) => setStatus(error?.message || 'Reaction failed'))}>
                        {reaction}
                      </button>
                    ))}
                  </div>
                ) : null}
                {toolOpen ? (
                <div className="messageToolWindow" onClick={(event) => event.stopPropagation()} role="menu" aria-label="Message tools">
                  {canCopyMessage ? <button type="button" title="Copy" aria-label="Copy message" onClick={() => runMessageTool(() => copyMessage(message))}><Attach3DIcon type="copy" /></button> : null}
                  <button type="button" title="Forward" aria-label="Forward message" onClick={() => runMessageTool(() => forwardMessage({ ...message, forwarded: true }))}><Attach3DIcon type="forward" /></button>
                  <button type="button" title={selected ? 'Unselect' : 'Select'} aria-label={selected ? 'Unselect message' : 'Select message'} onClick={() => runMessageTool(() => toggleSelectMessage(message.id))}><Attach3DIcon type="select" /></button>
                  {canTranslateMessage ? <button
                    type="button"
                    title="Translate"
                    aria-label="Translate message"
                    onClick={() => setMessageTranslateMenu((currentId) => (currentId === message.id ? '' : message.id))}
                  >
                    <Attach3DIcon type="translate" />
                  </button> : null}
                  <button type="button" title={message.pinned ? 'Unpin' : 'Pin'} aria-label={message.pinned ? 'Unpin message' : 'Pin message'} onClick={() => runMessageTool(() => toggleMessageFlag(message.id, 'pinned'))}><Attach3DIcon type="pin" /></button>
                  <button type="button" title={message.starred ? 'Unstar' : 'Star'} aria-label={message.starred ? 'Unstar message' : 'Star message'} onClick={() => runMessageTool(() => toggleMessageFlag(message.id, 'starred'))}><Attach3DIcon type="heart" /></button>
                  {isOutgoing ? (
                    <button
                      type="button"
                      title="Message info"
                      aria-label="Message info"
                      onMouseEnter={() => setMessageInfoId(message.id)}
                      onMouseLeave={() => setMessageInfoId('')}
                      onFocus={() => setMessageInfoId(message.id)}
                      onBlur={() => setMessageInfoId('')}
                      onClick={(event) => {
                        event.stopPropagation();
                        setMessageInfoId((currentId) => (currentId === message.id ? '' : message.id));
                      }}
                    >
                      <Attach3DIcon type="info" />
                    </button>
                  ) : null}
                  {message.status === 'failed' && <button type="button" title="Retry" aria-label="Retry message" onClick={() => runMessageTool(() => retryMessage(message))}><Attach3DIcon type="retry" /></button>}
                  {canEditTextMessage ? <button type="button" title="Edit" aria-label="Edit message" onClick={() => runMessageTool(() => editMessage(message))}><Attach3DIcon type="edit" /></button> : null}
                  {canUnsendMessage ? <button type="button" title="Unsend" aria-label="Unsend message" onClick={() => runMessageTool(() => unsendMessage(message))}><Attach3DIcon type="unsend" /></button> : null}
                  <button type="button" title="Delete" aria-label="Delete message" onClick={() => runMessageTool(() => markMessageDeleted(message.id))}><Attach3DIcon type="trash" /></button>
                </div>
                ) : null}
                {messageInfoId === message.id ? (
                  <div className="messageInfoPopover" onMouseEnter={() => setMessageInfoId(message.id)} onMouseLeave={() => setMessageInfoId('')} onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Message live activity information">
                    <span>Message info</span>
                    <strong>{message.status === 'read' ? 'Read by receiver' : message.status === 'delivered' ? 'Delivered to receiver' : 'Sending'}</strong>
                    <small>Sent: {message.sentAt || message.time || 'Now'}</small>
                    <small>Delivered: {message.deliveredAt || 'Waiting'}</small>
                    <small>Read: {settings.privacy.readReceipts && message.readAt ? message.readAt : 'Not seen yet'}</small>
                    <small>Receiver: {selectedChatPresence?.status || 'Offline'} · {selectedChatPresence?.detail || 'Last seen unavailable'}</small>
                    <small>Security: {message.encrypted ? 'Protected by a temporary local-session key; not E2EE' : 'Not protected'}</small>
                  </div>
                ) : null}
                {messageTranslateMenu === message.id ? (
                  <div className="messageTranslatePopover" onClick={(event) => event.stopPropagation()} role="dialog" aria-label="Translate message">
                    <span>Translate message</span>
                    <button type="button" onClick={() => translateMessage(message, 'Hindi')}>
                      <Attach3DIcon type="translate" />
                      <strong>English to Hindi</strong>
                      <small>Translate + voice</small>
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>

        <form className={composerSending ? 'chatComposer composerSending' : 'chatComposer'} onSubmit={sendChatMessage}>
          {scheduleComposerOpen && (
            <section className="scheduleSendPanel" aria-label="Schedule message">
              <div>
                <span>Schedule send</span>
                <strong>When should this message go?</strong>
              </div>
              <input type="date" value={scheduleForm.date} onChange={(event) => setScheduleForm({ ...scheduleForm, date: event.target.value })} />
              <input type="time" value={scheduleForm.time} onChange={(event) => setScheduleForm({ ...scheduleForm, time: event.target.value })} />
              <input type="text" value={scheduleForm.note} onChange={(event) => setScheduleForm({ ...scheduleForm, note: event.target.value })} placeholder="Optional note" />
              <button type="button" onClick={scheduleDraftMessage}>Schedule</button>
              <button type="button" onClick={() => setScheduleComposerOpen(false)}>Close</button>
            </section>
          )}
          {chatDraft.trim() ? (
            <div className="composerLiveActivity" aria-live="polite">
              <span>Encrypting before send</span>
              <b>{chatDraft.length > 48 ? `${chatDraft.slice(0, 48)}...` : chatDraft}</b>
            </div>
          ) : null}
          {composerPickerOpen && (
            <section className="composerPickerPanel" aria-label="Signova composer picker">
              <nav className="composerPickerTabs" aria-label="Composer picker categories">
                {[
                  ['emoji', 'Emoji', '😊'],
                  ['signs', 'Signs', '🤟'],
                  ['stickers', 'Stickers', '✨'],
                ].map(([tab, label, icon]) => (
                  <button type="button" className={composerPickerTab === tab ? 'activeComposerPickerTab' : ''} key={tab} onClick={() => setComposerPickerTab(tab)}>
                    <span>{icon}</span>
                    <strong>{label}</strong>
                  </button>
                ))}
              </nav>
              {composerPickerTab === 'emoji' && (
                <div className="composerEmojiGrid">
                  {COMPOSER_EMOJIS.map((emoji) => (
                    <button type="button" key={emoji} onClick={() => selectComposerEmoji(emoji)}>{emoji}</button>
                  ))}
                </div>
              )}
              {composerPickerTab === 'signs' && (
                <div className="composerSignGrid">
                  <button type="button" className="composerUseLiveSign" onClick={useTranslationAsMessage}>
                    <Attach3DIcon type="translate" />
                    <span>Use live sign</span>
                    <small>{sentence !== 'Waiting for signs' ? sentence : caption}</small>
                  </button>
                  {signLibrary.slice(0, 12).map((sign) => (
                    <button type="button" key={`${sign.label}-${sign.sign}`} onClick={() => selectComposerSign(sign)}>
                      <span>{String(sign.sign || sign.label).slice(0, 2).toUpperCase()}</span>
                      <strong>{sign.sign || sign.label}</strong>
                      <small>{sign.hint || sign.source || 'Signova sign'}</small>
                    </button>
                  ))}
                </div>
              )}
              {composerPickerTab === 'stickers' && (
                <div className="composerStickerGrid">
                  {GESTURE_STICKERS.map((sticker) => (
                    <button type="button" key={sticker.label} onClick={() => selectComposerSticker(sticker)}>
                      <b>{sticker.emoji}</b>
                      <span>{sticker.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
          <div className="attachMenuWrap">
            <button
              type="button"
              className={attachMenuOpen ? 'attachButton activeAttachButton' : 'attachButton'}
              title="Add attachment or media"
              aria-label="Open Signova attachments"
              aria-expanded={attachMenuOpen}
              onClick={() => setAttachMenuOpen((open) => !open)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
            <input
              ref={attachmentInputRef}
              className="hiddenAttachmentInput"
              type="file"
              multiple
              accept={attachmentAccept}
              onChange={handleDriveUpload}
            />
            {attachMenuOpen && (
              <div className="signovaAttachMenu" role="menu" aria-label="Signova attachment options">
                <div className="signovaAttachBrand" aria-hidden="true">
                  <Attach3DIcon type="sticker" />
                  <div>
                    <strong>Signova Attach</strong>
                  </div>
                </div>
                {[
                  ['document', 'Vault Docs'],
                  ['gallery', 'Memory Gallery'],
                  ['camera', 'Live Camera Clip'],
                  ['audio', 'Music / Audio Note'],
                  ['contact', 'Signova Contact'],
                  ['poll', 'Audience Poll'],
                  ['event', 'Meet Moment'],
                  ['sticker', 'Gesture Sticker'],
                ].map(([action, label]) => (
                  <button type="button" role="menuitem" key={action} onClick={() => handleAttachmentAction(action)}>
                    <Attach3DIcon type={action} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className={composerPickerOpen ? 'composerSignButton activeComposerSignButton' : 'composerSignButton'}
            onClick={() => setComposerPickerOpen((open) => !open)}
            aria-label="Open emoji signs and stickers"
            title="Emoji, signs, stickers"
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="3" />
              <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="3" />
            </svg>
          </button>
          {voiceNote.active ? (
            <div className="voiceNoteComposerBar" aria-label="Voice note recording">
              <span className={voiceNote.paused ? 'pausedVoiceDot' : 'recordingVoiceDot'} />
              <strong>{formatVoiceTime(voiceNote.seconds)}</strong>
              <div className="voiceLiveWaveform" aria-hidden="true">
                {(voiceWaveform || []).map((level, idx) => (
                  <i key={idx} style={{ '--bar-h': `${Math.round(Math.max(0.18, Math.min(1, level)) * 100)}%` }} />
                ))}
              </div>
              <button type="button" onClick={toggleVoicePause}>{voiceNote.paused ? 'Resume' : 'Pause'}</button>
              <button type="button" className="voiceSendButton" onClick={addVoiceNote}>Send</button>
              <button type="button" className="voiceDeleteButton" onClick={deleteVoiceNote}>Delete</button>
            </div>
          ) : (
            <input
              value={chatDraft}
              onChange={(event) => setChatDraft(event.target.value)}
              placeholder="Type a message or sign note..."
              aria-label="Message"
            />
          )}
          <button
            type="button"
            className={voiceNote.active ? 'voiceComposerButton activeVoiceRecording' : 'voiceComposerButton'}
            onClick={voiceNote.active ? toggleVoicePause : startVoiceNote}
            aria-label="Record voice note"
            title="Voice note"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </button>
          <button
            type="button"
            className={`sendIconButton ${chatDraft.trim() ? 'hasDraftText' : ''}`}
            onPointerDown={startSendLongPress}
            onPointerUp={stopSendLongPress}
            onPointerLeave={stopSendLongPress}
            onPointerCancel={stopSendLongPress}
            onClick={handleSendIconClick}
            aria-label="Send message. Long press to schedule."
            title="Send. Long press to schedule."
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
            <span className="signovaSendGlyph" aria-hidden="true" style={{ display: 'none' }}>
              <i />
            </span>
          </button>
        </form>
        </>
        )}
        </>
      )}
    </>
  );
}
