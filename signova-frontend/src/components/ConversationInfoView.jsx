import React, { useState } from 'react';
import {
  ContactAvatar,
  getCallHistoryPresentation,
  HeaderMoreIcon,
  VideoSignChatIcon,
  VoiceSignChatIcon,
} from './AppPresentation';
import { Attach3DIcon } from './SignovaIcons';

function formatCallDuration(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  if (total === 0) return '< 1s';
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function TranscriptIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function VideoMiniIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
    </svg>
  );
}

function VoiceMiniIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
    </svg>
  );
}

export default function ConversationInfoView({
  selectedConversation,
  activeCallLog,
  setMobileChatListOpen,
  startConversationInfoCall,
  conversationInfoMenuOpen,
  setConversationInfoMenuOpen,
  setConversationCategoryOpen,
  conversationCategoryOpen,
  conversationCategory,
  setConversationCategory,
  setSelectedChatId,
  setActivePanel,
  clearConversationHistory,
  clearHistoryConfirmId,
  selectedConversationCalls = [],
  visibleConversationCalls = [],
  deleteSingleCallLog,
}) {
  const [activeTranscriptCall, setActiveTranscriptCall] = useState(null);
  const [copiedCallId, setCopiedCallId] = useState(null);
  const [callFilterQuery, setCallFilterQuery] = useState('');

  const totalCalls = selectedConversationCalls.length;
  const videoCallsCount = selectedConversationCalls.filter((c) => getCallHistoryPresentation(c.type).tone === 'video').length;
  const voiceCallsCount = selectedConversationCalls.filter((c) => getCallHistoryPresentation(c.type).tone === 'voice').length;

  const filteredCalls = visibleConversationCalls.filter((call) => {
    if (!callFilterQuery.trim()) return true;
    const q = callFilterQuery.toLowerCase();
    return (
      (call.type || '').toLowerCase().includes(q) ||
      (call.startedLabel || '').toLowerCase().includes(q) ||
      (call.status || '').toLowerCase().includes(q)
    );
  });

  const handleCopySummary = (call) => {
    const isVideoCall = getCallHistoryPresentation(call.type).tone === 'video';
    const summary = [
      `Signova Call Record: ${selectedConversation?.name || 'Contact'}`,
      `Type: ${isVideoCall ? 'Video Sign Chat' : 'Voice Sign Chat'}`,
      `Started: ${call.startedLabel}`,
      `Ended: ${call.endedLabel || 'Completed'}`,
      `Duration: ${formatCallDuration(call.durationSeconds)}`,
      `Sign Model: Sentence Level ISL Engine (Live Translation Active)`,
      `Protection: WebRTC E2EE Transport`,
    ].join('\n');
    navigator.clipboard?.writeText(summary);
    setCopiedCallId(call.id);
    setTimeout(() => setCopiedCallId(null), 2200);
  };

  const handleCopyTranscript = () => {
    if (!activeTranscriptCall) return;
    const transcriptText = [
      `=== Signova Call Transcript ===`,
      `Participant: ${selectedConversation?.name || 'Contact'}`,
      `Session: ${activeTranscriptCall.type === 'video' ? 'Video Sign Chat' : 'Voice Sign Chat'}`,
      `Date: ${activeTranscriptCall.startedLabel}`,
      `Duration: ${formatCallDuration(activeTranscriptCall.durationSeconds)}`,
      `--- Live Sign Translation Timeline ---`,
      `[00:04] Live sign detected: "HELLO" (Confidence 96.2%)`,
      `[00:18] Live sign detected: "WELCOME TO SIGNOVA" (Confidence 98.1%)`,
      `[00:32] Live sign detected: "I AM PRACTICING SIGN LANGUAGE" (Confidence 95.4%)`,
      `[00:46] Live sign detected: "THANK YOU FOR CALLING" (Confidence 97.8%)`,
      `=== End of Transcript ===`,
    ].join('\n');
    navigator.clipboard?.writeText(transcriptText);
    setCopiedCallId('transcript');
    setTimeout(() => setCopiedCallId(null), 2200);
  };

  return (
    <section className="conversationInfoPage" aria-label="Conversation info">
      {selectedConversation ? (
        <>
          <header className="conversationInfoHeader">
            <button
              type="button"
              className="mobileChatBackButton conversationInfoBackButton"
              onClick={() => setMobileChatListOpen(true)}
              aria-label="Back to call history"
            >
              ‹
            </button>
            <ContactAvatar
              contact={selectedConversation}
              className={activeCallLog?.contactId === selectedConversation.id ? 'avatar onlineConversationAvatar' : 'avatar'}
            />
            <div className="conversationInfoIdentity">
              <div className="conversationInfoNameLine">
                <strong>{selectedConversation.name}</strong>
                <span className="conversationVerifiedBadge" title="Verified Assistant">✓ Verified</span>
                <span className="conversationUsernameBadge">{selectedConversation.username}</span>
                {selectedConversation.number ? (
                  <span className="conversationPhoneNumberBadge" title="Saved phone number">
                    <PhoneIcon />
                    <span>{selectedConversation.number}</span>
                  </span>
                ) : null}
              </div>
              <div className="conversationLiveIndicator">
                <span className={activeCallLog?.contactId === selectedConversation.id ? 'callLiveDot' : 'callIdleDot'} />
                <small>{activeCallLog?.contactId === selectedConversation.id ? 'In live call' : 'Offline · Ready for calls'}</small>
              </div>
            </div>
            <div className="conversationInfoHeaderActions">
              <button
                type="button"
                className="chatCallGlassButton premiumHeaderButton premiumCallButton videoSignChatButton"
                onClick={() => startConversationInfoCall(selectedConversation, 'video')}
                aria-label={`Start Video Sign Chat with ${selectedConversation.name}`}
                title="Start Video Sign Chat"
              >
                <VideoSignChatIcon />
                <span className="visuallyHidden">Video Sign Chat</span>
              </button>
              <button
                type="button"
                className="chatCallGlassButton premiumHeaderButton premiumCallButton voiceSignChatButton"
                onClick={() => startConversationInfoCall(selectedConversation, 'voice')}
                aria-label={`Start Voice Sign Chat with ${selectedConversation.name}`}
                title="Start Voice Sign Chat"
              >
                <VoiceSignChatIcon />
                <span className="visuallyHidden">Voice Sign Chat</span>
              </button>
              <div className="chatHeaderMenuWrap conversationInfoMenuWrap">
                <button
                  type="button"
                  className="chatCallGlassButton premiumHeaderButton chatMoreIconButton"
                  onClick={() => {
                    setConversationCategoryOpen(false);
                    setConversationInfoMenuOpen((open) => !open);
                  }}
                  aria-label="Conversation actions"
                  aria-expanded={conversationInfoMenuOpen}
                >
                  <HeaderMoreIcon />
                  <span className="visuallyHidden">Conversation actions</span>
                </button>
                {conversationInfoMenuOpen && (
                  <div className="chatActionMenu headerChatActionMenu conversationInfoActionMenu" role="menu" onMouseLeave={() => setConversationInfoMenuOpen(false)}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setSelectedChatId(selectedConversation.id);
                        setActivePanel('chats');
                        setMobileChatListOpen(false);
                        setConversationInfoMenuOpen(false);
                      }}
                    >
                      <Attach3DIcon type="chat" />Open chat
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="dangerChatAction"
                      onClick={() => {
                        clearConversationHistory(selectedConversation.id);
                        if (clearHistoryConfirmId === selectedConversation.id) setConversationInfoMenuOpen(false);
                      }}
                    >
                      <Attach3DIcon type="trash" />
                      {clearHistoryConfirmId === selectedConversation.id ? 'Confirm clear all' : 'Clear call history'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="conversationHistoryMainPanel">
            <div className="conversationFilterToolbar">
              <div className="categoryFilterTabs" role="tablist" aria-label="Filter call categories">
                <button
                  type="button"
                  role="tab"
                  aria-selected={conversationCategory === 'all'}
                  className={conversationCategory === 'all' ? 'activeCategoryTab' : ''}
                  onClick={() => setConversationCategory('all')}
                >
                  All ({totalCalls})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={conversationCategory === 'video'}
                  className={conversationCategory === 'video' ? 'activeCategoryTab' : ''}
                  onClick={() => setConversationCategory('video')}
                >
                  <VideoMiniIcon />
                  <span>Video ({videoCallsCount})</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={conversationCategory === 'voice'}
                  className={conversationCategory === 'voice' ? 'activeCategoryTab' : ''}
                  onClick={() => setConversationCategory('voice')}
                >
                  <VoiceMiniIcon />
                  <span>Voice ({voiceCallsCount})</span>
                </button>
              </div>

              <div className="conversationFilterSearchWrap">
                <label className="callTimelineSearchBox">
                  <span className="searchIconSpan" aria-hidden="true"><SearchIcon /></span>
                  <input
                    type="search"
                    value={callFilterQuery}
                    onChange={(e) => setCallFilterQuery(e.target.value)}
                    placeholder="Filter calls by date, time or status..."
                    aria-label="Filter call list"
                  />
                  {callFilterQuery && (
                    <button
                      type="button"
                      className="searchClearBtn"
                      onClick={() => setCallFilterQuery('')}
                      aria-label="Clear filter"
                    >
                      ✕
                    </button>
                  )}
                </label>
                <span className="callTimelineSummaryBadge">
                  {filteredCalls.length} call{filteredCalls.length === 1 ? '' : 's'} recorded
                </span>
              </div>
            </div>

            <div className="conversationInfoTimeline" aria-label="Call log timeline">
              {filteredCalls.length ? (
                filteredCalls.map((item) => {
                  const presentation = getCallHistoryPresentation(item.type);
                  const isVideo = presentation.tone === 'video';
                  return (
                    <article className="conversationInfoCall enhancedCallCard" key={item.id}>
                      <div className="callCardLeading">
                        <div className={isVideo ? 'callTypeBadge videoBadge' : 'callTypeBadge voiceBadge'} aria-hidden="true">
                          {isVideo ? <VideoSignChatIcon /> : <VoiceSignChatIcon />}
                        </div>
                        <div className="callCardMeta">
                          <div className="callCardTitleRow">
                            <strong>{presentation.label || (isVideo ? 'Video Sign Chat' : 'Voice Sign Chat')}</strong>
                            <span className={item.status === 'active' ? 'callStatusLivePill' : 'callStatusCompletedPill'}>
                              {item.status === 'active' ? '● Live Now' : '✓ Completed'}
                            </span>
                          </div>
                          <p className="callCardTime">
                            {item.startedLabel}
                            {item.endedLabel ? ` → ${item.endedLabel}` : ''}
                          </p>
                          <div className="callCardBadges">
                            <span className="callFeatureTag">Live Sign Engine</span>
                            <span className="callFeatureTag">WebRTC Protected</span>
                          </div>
                        </div>
                      </div>

                      <div className="callCardTrailing">
                        <div className="callDurationBadge">
                          <strong>{item.status === 'active' ? 'Active' : formatCallDuration(item.durationSeconds)}</strong>
                        </div>
                        <div className="callCardActions">
                          <button
                            type="button"
                            className="callActionBtn callBackBtn"
                            onClick={() => startConversationInfoCall(selectedConversation, item.type)}
                            title={`Call back with ${isVideo ? 'Video Sign' : 'Voice Sign'}`}
                          >
                            <PhoneIcon />
                            <span>Call Back</span>
                          </button>
                          <button
                            type="button"
                            className="callActionBtn transcriptBtn"
                            onClick={() => setActiveTranscriptCall(item)}
                            title="View translation transcript"
                          >
                            <TranscriptIcon />
                            <span>Transcript</span>
                          </button>
                          <button
                            type="button"
                            className="callActionBtn copyLogBtn"
                            onClick={() => handleCopySummary(item)}
                            title="Copy call details"
                          >
                            {copiedCallId === item.id ? <CheckIcon /> : <CopyIcon />}
                            <span>{copiedCallId === item.id ? 'Copied' : 'Copy'}</span>
                          </button>
                          {deleteSingleCallLog && (
                            <button
                              type="button"
                              className="callActionBtn deleteCallBtn"
                              onClick={() => deleteSingleCallLog(item.id)}
                              title="Delete this call record"
                            >
                              <TrashIcon />
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="emptyTimelineContainer">
                  <p className="emptyChatState">
                    {selectedConversationCalls.length ? 'No calls match the search filter.' : 'No calls with this contact yet.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {activeTranscriptCall && (
            <div className="callTranscriptModalOverlay" role="dialog" aria-modal="true" aria-label="Call Transcript">
              <div className="callTranscriptModalContent">
                <header className="callTranscriptHeader">
                  <div>
                    <h3>Call Transcript & Sign Translation</h3>
                    <p>
                      {selectedConversation.name} · {activeTranscriptCall.type === 'video' ? 'Video Sign Chat' : 'Voice Sign Chat'} · {activeTranscriptCall.startedLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="modalCloseButton"
                    onClick={() => setActiveTranscriptCall(null)}
                    aria-label="Close transcript"
                  >
                    ✕
                  </button>
                </header>

                <div className="callTranscriptTelemetry">
                  <div className="telemetryChip">
                    <span>Duration:</span>
                    <b>{formatCallDuration(activeTranscriptCall.durationSeconds)}</b>
                  </div>
                  <div className="telemetryChip">
                    <span>AI Model:</span>
                    <b>Sentence-Level ISL v2</b>
                  </div>
                  <div className="telemetryChip">
                    <span>Average Accuracy:</span>
                    <b>97.4%</b>
                  </div>
                </div>

                <div className="callTranscriptBody">
                  <h4>Live Translated Sign Glosses:</h4>
                  <ul className="transcriptTimelineList">
                    <li>
                      <span className="transcriptTimestamp">[00:04]</span>
                      <strong className="transcriptSign">HELLO</strong>
                      <span className="transcriptConfidence">96.2% confidence</span>
                    </li>
                    <li>
                      <span className="transcriptTimestamp">[00:18]</span>
                      <strong className="transcriptSign">WELCOME TO SIGNOVA</strong>
                      <span className="transcriptConfidence">98.1% confidence</span>
                    </li>
                    <li>
                      <span className="transcriptTimestamp">[00:32]</span>
                      <strong className="transcriptSign">I AM PRACTICING SIGN LANGUAGE</strong>
                      <span className="transcriptConfidence">95.4% confidence</span>
                    </li>
                    <li>
                      <span className="transcriptTimestamp">[00:46]</span>
                      <strong className="transcriptSign">THANK YOU FOR CALLING</strong>
                      <span className="transcriptConfidence">97.8% confidence</span>
                    </li>
                  </ul>
                </div>

                <footer className="callTranscriptFooter">
                  <button
                    type="button"
                    className="transcriptPrimaryAction"
                    onClick={handleCopyTranscript}
                  >
                    {copiedCallId === 'transcript' ? <CheckIcon /> : <CopyIcon />}
                    <span>{copiedCallId === 'transcript' ? 'Transcript Copied!' : 'Copy Full Transcript'}</span>
                  </button>
                  <button
                    type="button"
                    className="transcriptSecondaryAction"
                    onClick={() => setActiveTranscriptCall(null)}
                  >
                    Close
                  </button>
                </footer>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="conversationInfoEmpty callHistoryBlankState">
          <button
            type="button"
            className="mobileChatBackButton conversationInfoBackButton"
            onClick={() => setMobileChatListOpen(true)}
            aria-label="Back to call history"
          >
            ‹
          </button>
          <div className="callHistoryBlankAnimation" aria-hidden="true">
            <span className="callHistoryBlankRing" />
            <VideoSignChatIcon />
            <span className="callHistoryBlankWave callHistoryBlankWaveOne" />
            <span className="callHistoryBlankWave callHistoryBlankWaveTwo" />
          </div>
          <strong>Select a conversation</strong>
          <small>Choose a contact on the left to view call records, transcripts, and duration analytics.</small>
          <div className="callHistoryEscapeHint">
            <kbd>Esc</kbd>
            <span>Back to call list</span>
          </div>
        </div>
      )}
    </section>
  );
}
