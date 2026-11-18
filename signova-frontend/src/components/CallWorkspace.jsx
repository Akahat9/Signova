import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RailIcon } from './SignovaIcons';
import { ContactAvatar } from './AppPresentation';
import {
  isDocumentPiPSupported,
  requestDocumentPiP,
  closeActiveDocumentPiP,
} from '../features/calls/documentPictureInPicture';

export default function CallWorkspace({
  chatCallScreen,
  chatCallMinimized,
  chatCallExpanded,
  chatCallInfoOpen,
  chatCallPosition,
  startChatCallMove,
  formatCallTimer,
  callElapsedSeconds,
  callStatus,
  callNetworkQuality,
  setChatCallInfoOpen,
  desktopCallWindowMode,
  setChatCallPosition,
  setChatCallMinimized,
  setChatCallExpanded,
  setChatCallMoreOpen,
  setChatCallHistoryOpen,
  endCallSession,
  setChatCallFocus,
  streamRef,
  cameraEnabled,
  settings,
  accountAvatarInitials,
  selectedChatContact,
  remoteMediaState,
  attachRemoteCallVideo,
  remoteCaption,
  liveSign,
  currentSignReference,
  activeCallBook,
  captionChannelStatus,
  handleCameraControlClick,
  flipCameraFacingMode,
  micEnabled,
  toggleMicTrack,
  synapseEnabled,
  toggleCallTranslation,
  switchToVideoSignChat,
  setChatCallScreen,
  openPanel,
  chatCallHistoryOpen,
  chatCallMoreOpen,
  revealCallControls,
  chatCallSettingsTab,
  setChatCallSettingsTab,
  callVideoFilterStyle,
  chatCallFocus,
  attachLocalTrackingVideo,
  canvasRef,
  callControlsVisible,
  activeCallLanguage,
  premiumDarkMode,
  changeTranslationLanguage,
  updateSetting,
  voiceEnabled,
  setVoiceEnabled,
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
}) {
  const [pipActive, setPipActive] = useState(false);
  const [pipDocument, setPipDocument] = useState(null);
  const [transcriptNotice, setTranscriptNotice] = useState('');
  const [mediaDevicesList, setMediaDevicesList] = useState({ cameras: [], microphones: [] });
  const pipWindowRef = useRef(null);

  useEffect(() => {
    if (chatCallMoreOpen && typeof navigator !== 'undefined' && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const cameras = devices.filter((d) => d.kind === 'videoinput');
        const microphones = devices.filter((d) => d.kind === 'audioinput');
        setMediaDevicesList({ cameras, microphones });
      }).catch(() => {});
    }
  }, [chatCallMoreOpen]);

  const handleCopyTranscript = async () => {
    if (!callTranscript?.length) return;
    const text = callTranscript.map((item) => `[${item.time}] ${item.text}`).join('\n');
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      }
      setTranscriptNotice('Copied!');
      setTimeout(() => setTranscriptNotice(''), 2000);
    } catch {
      setTranscriptNotice('Copy failed');
      setTimeout(() => setTranscriptNotice(''), 2000);
    }
  };

  const handleDownloadTranscript = () => {
    if (!callTranscript?.length) return;
    const dateStr = new Date().toISOString().slice(0, 10);
    const content = `Signova Live Call Transcript\nDate: ${dateStr}\nContact: ${selectedChatContact?.name || 'Partner'}\n\n`
      + callTranscript.map((item) => `[${item.time}] ${item.text} (${item.voiceStatus})`).join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signova-call-transcript-${dateStr}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setTranscriptNotice('Saved .txt!');
    setTimeout(() => setTranscriptNotice(''), 2000);
  };

  useEffect(() => {
    return () => {
      closeActiveDocumentPiP();
    };
  }, []);

  useEffect(() => {
    if (pipDocument) {
      const themeClass = premiumDarkMode ? 'premiumDarkMode' : 'callLightTheme';
      if (pipDocument.documentElement) {
        pipDocument.documentElement.className = premiumDarkMode ? 'premiumDarkMode signovaPremiumDarkPage' : 'callLightTheme';
      }
      if (pipDocument.body) {
        pipDocument.body.className = `signovaPipDocumentActive ${themeClass}`;
      }
    }
  }, [pipDocument, premiumDarkMode]);

  const handleRestoreCall = () => {
    if (pipWindowRef.current) {
      closeActiveDocumentPiP();
      pipWindowRef.current = null;
    }
    setPipActive(false);
    setPipDocument(null);
    window.signovaDesktop?.restoreCallWindow?.();
    setChatCallMinimized(false);
  };

  const handleEndCall = (event) => {
    if (pipWindowRef.current) {
      closeActiveDocumentPiP();
      pipWindowRef.current = null;
    }
    setPipActive(false);
    setPipDocument(null);
    endCallSession(event);
  };

  const handleMinimizeToPiP = async () => {
    if (desktopCallWindowMode) {
      setChatCallPosition({ x: 8, y: 8 });
      window.signovaDesktop?.compactCallWindow?.();
      setChatCallMinimized(true);
      return;
    }

    if (isDocumentPiPSupported() && !pipActive) {
      try {
        const pipWin = await requestDocumentPiP({
          width: 520,
          height: 310,
          isDarkMode: Boolean(premiumDarkMode),
          onClose: () => {
            setPipActive(false);
            setPipDocument(null);
            pipWindowRef.current = null;
            setChatCallMinimized(false);
          },
        });
        pipWindowRef.current = pipWin;
        setPipDocument(pipWin.document);
        setPipActive(true);
        setChatCallMinimized(true);
        setChatCallExpanded(false);
        setChatCallInfoOpen(false);
        setChatCallMoreOpen(false);
        setChatCallHistoryOpen(false);
        return;
      } catch {
        // Fallback to in-app mini window
      }
    }

    setChatCallMinimized(true);
    setChatCallExpanded(false);
    setChatCallInfoOpen(false);
    setChatCallMoreOpen(false);
    setChatCallHistoryOpen(false);
    const width = typeof window !== 'undefined' && window.innerWidth <= 600 ? Math.min(320, window.innerWidth - 32) : 380;
    const height = typeof window !== 'undefined' && window.innerWidth <= 600 ? 210 : 220;
    setChatCallPosition({
      x: typeof window !== 'undefined' ? Math.max(16, window.innerWidth - width - 16) : 16,
      y: typeof window !== 'undefined' ? Math.max(16, window.innerHeight - height - 16) : 16,
    });
  };

  if (!chatCallScreen) {
    return null;
  }

  const renderMinimizedBody = () => (
    <div className="unifiedMinimizedCallBody">
      <div className="unifiedMinimizedParticipants">
        <button
          type="button"
          className="unifiedMinimizedParticipant unifiedMinimizedLocalParticipant"
          onClick={() => { handleRestoreCall(); setChatCallFocus('local'); }}
          aria-label="Open your video"
        >
          {chatCallScreen === 'video' && cameraEnabled ? (
            <>
              <video
                autoPlay
                playsInline
                muted
                ref={(node) => {
                  attachLocalTrackingVideo?.(node);
                  if (node && streamRef.current && node.srcObject !== streamRef.current) {
                    node.srcObject = streamRef.current;
                    node.play?.().catch(() => {});
                  }
                }}
              />
              <canvas
                ref={canvasRef}
                className="unifiedHandTrackerOverlay unifiedMinimizedHandTrackerOverlay"
                aria-label="Live hand tracking landmarks"
              />
            </>
          ) : chatCallScreen === 'video' ? (
            <span className="unifiedMinimizedCameraOffAvatar localCameraOffAvatar">
              {settings.account.profilePhoto ? <img src={settings.account.profilePhoto} alt="" /> : <b>{accountAvatarInitials}</b>}
              <small>Your camera is off</small>
            </span>
          ) : (
            <div className="unifiedMinimizedVoicePulse" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          )}
          <span><i />You</span>
        </button>
        <button
          type="button"
          className="unifiedMinimizedParticipant unifiedMinimizedPartnerParticipant"
          onClick={() => { handleRestoreCall(); setChatCallFocus('remote'); }}
          aria-label="Open partner video"
        >
          {chatCallScreen === 'video' && remoteMediaState.camera ? (
            <video ref={attachRemoteCallVideo} autoPlay playsInline />
          ) : chatCallScreen === 'video' ? (
            <span className="unifiedMinimizedCameraOffAvatar partnerCameraOffAvatar">
              <ContactAvatar contact={selectedChatContact || { name: 'Partner', avatarChoice: 'initial' }} className="unifiedMinimizedProfileAvatar" />
              <small>Camera off</small>
            </span>
          ) : <div className="unifiedMinimizedVoicePulse partnerVoicePulse" aria-hidden="true"><i /><i /><i /><i /><i /></div>}
          <span><i />{selectedChatContact?.name || 'Partner'}</span>
        </button>
      </div>
      {(!remoteMediaState.camera || !remoteMediaState.mic || !remoteMediaState.translation) && (
        <div className="unifiedMinimizedStatusNotices" aria-live="polite">
          {!remoteMediaState.camera && <span><b>Camera off</b>{selectedChatContact?.name || 'Partner'} turned off camera</span>}
          {!remoteMediaState.mic && <span><b>Mic off</b>{selectedChatContact?.name || 'Partner'} muted microphone</span>}
          {!remoteMediaState.translation && <span><b>Translation off</b>{selectedChatContact?.name || 'Partner'} paused translation</span>}
        </div>
      )}
      <div className="unifiedMinimizedTranslation">
        <span>Live translation <b>{settings.translation.language === 'ISL Gloss' ? 'ISL' : settings.translation.language}</b></span>
        <strong>{chatCallScreen === 'voice' ? remoteCaption : liveSign?.phrase || 'Waiting for signs'}</strong>
        <small>{currentSignReference ? `${currentSignReference} · ${activeCallBook}` : `${activeCallBook} · ${captionChannelStatus}`}</small>
      </div>
      <div className="unifiedMinimizedCallControls">
        <button
          type="button"
          className={`mini3dCallControl miniCameraCallControl ${cameraEnabled ? 'activeMiniCallControl' : 'inactiveMiniCallControl'}`}
          onClick={handleCameraControlClick}
          onDoubleClick={flipCameraFacingMode}
          title="Click: camera on/off · Double-click: flip camera"
          aria-label={cameraEnabled ? 'Turn camera off. Double-click to flip camera.' : 'Turn camera on. Double-click to flip camera.'}
        >
          <span className="miniCamera3dIcon" aria-hidden="true"><i /><b /></span>
        </button>
        <button
          type="button"
          className={`mini3dCallControl ${micEnabled ? 'activeMiniCallControl' : ''}`}
          onClick={toggleMicTrack}
          aria-label={micEnabled ? 'Mute microphone' : 'Turn microphone on'}
          title={micEnabled ? 'Mute microphone' : 'Turn microphone on'}
        >
          <RailIcon type="voiceHistory" />
        </button>
        <button
          type="button"
          className={`mini3dCallControl miniTranslationCallControl ${synapseEnabled ? 'activeMiniCallControl' : 'inactiveMiniCallControl'}`}
          onClick={toggleCallTranslation}
          title={synapseEnabled ? 'Pause live translation' : 'Resume live translation'}
          aria-pressed={synapseEnabled}
          aria-label={synapseEnabled ? 'Pause live translation' : 'Resume live translation'}
        >
          <RailIcon type="translate" />
        </button>
        <button
          type="button"
          className="mini3dCallControl miniSettingsCallControl"
          onClick={() => {
            handleRestoreCall();
            revealCallControls?.(true);
            setChatCallSettingsTab?.('general');
            setChatCallMoreOpen?.(true);
            setChatCallHistoryOpen?.(false);
          }}
          title="Call Settings"
          aria-label="Call Settings"
        >
          <RailIcon type="settings" />
        </button>
        <button
          type="button"
          className="unifiedMiniEndCall mini3dCallControl"
          onClick={handleEndCall}
          aria-label="End call"
          title="End call"
        >
          <span className="miniWindowGlyph">☎</span>
        </button>
      </div>
    </div>
  );

  // When floating in Document Picture-in-Picture, render strictly into the floating OS window.
  // This keeps the main browser tab completely clean (no duplicate in-page floating window).
  if (pipActive && pipDocument) {
    return createPortal((
      <div className={`signovaPipCallContainer ${premiumDarkMode ? 'premiumDarkMode' : 'callLightTheme'}`}>
        {renderMinimizedBody()}
      </div>
    ), pipDocument.body);
  }

  return createPortal((
    <section
      className={`unifiedChatCallWindow dedicatedChatCallWindow ${premiumDarkMode ? 'premiumDarkMode' : 'callLightTheme'} ${chatCallMinimized ? 'minimizedUnifiedChatCallWindow' : ''} ${chatCallExpanded ? 'expandedUnifiedChatCallWindow' : ''} ${chatCallScreen === 'voice' ? 'voiceUnifiedChatCallWindow' : ''} ${chatCallInfoOpen ? 'callInfoDrawerOpen' : ''}`}
      aria-label={chatCallScreen === 'voice' ? 'Voice Sign Chat' : 'Video Sign Chat'}
      style={chatCallMinimized ? { '--chat-call-x': `${chatCallPosition.x}px`, '--chat-call-y': `${chatCallPosition.y}px` } : undefined}
      onPointerDown={startChatCallMove}
    >
      <header className="unifiedCallHeader">
        <div className="unifiedCallBrand"><img src="/app-logo.png" alt="" /><span><strong>Signova</strong><small>Every Gesture, A Voice.</small></span></div>
        <div className="unifiedCallTitle">
          <span><i />Live</span>
          <strong>{chatCallScreen === 'voice' ? 'Signova Voice Chat' : 'Signova Video Chat'}</strong>
          <small>{formatCallTimer(callElapsedSeconds)} · Secure transport preview</small>
          <div className={`unifiedCallConnectionBar ${callStatus.includes('connected') ? 'connectedCallSignal' : 'connectingCallSignal'}`} aria-label="Live connection quality">
            <i /><i /><i /><i />
            <em>{callStatus.includes('connected') ? `${callNetworkQuality.label} · ${callNetworkQuality.rttMs}ms · ${callNetworkQuality.packetLoss.toFixed(1)}% loss` : 'Connecting securely'}</em>
          </div>
        </div>
        {chatCallMinimized ? (
          <div className="unifiedCallWindowActions minimizedHeaderActions">
            <button
              type="button"
              className="unifiedCallExpandButton"
              onClick={handleRestoreCall}
              aria-label="Expand call window"
              title="Expand call window"
            >
              ⤢
            </button>
            <button
              type="button"
              className="unifiedCallCloseButton"
              onClick={handleEndCall}
              aria-label="End call"
              title="End call"
            >
              ×
            </button>
          </div>
        ) : (
          <div className="unifiedCallWindowActions">
            <button type="button" className="unifiedCallInfoToggle" onClick={() => setChatCallInfoOpen((open) => !open)} aria-label="Toggle call status panel">ⓘ</button>
            <button
              type="button"
              className="unifiedCallMinimizeButton"
              onClick={handleMinimizeToPiP}
              aria-label="Minimize call"
            >
              −
            </button>
            <button
              type="button"
              className="unifiedCallExpandButton"
              onClick={async () => {
                if (desktopCallWindowMode && window.signovaDesktop?.toggleMaximize) {
                  setChatCallExpanded(Boolean(await window.signovaDesktop.toggleMaximize()));
                  return;
                }
                setChatCallExpanded((expanded) => !expanded);
              }}
              aria-label={chatCallExpanded ? 'Restore call window' : 'Expand call window'}
            >
              {chatCallExpanded ? '▣' : '□'}
            </button>
            <button type="button" className="unifiedCallCloseButton" onClick={handleEndCall} aria-label="Close call">×</button>
          </div>
        )}
      </header>
      {chatCallMinimized && renderMinimizedBody()}
      <div className="unifiedCallLayout">
        <aside className="unifiedCallModeRail" aria-label="Call sections">
          <nav>
            <button type="button" title="Video Chat" aria-label="Video Chat" className={chatCallScreen === 'video' ? 'activeCallModeRailItem' : ''} onClick={switchToVideoSignChat}><RailIcon type="camera" /><span>Video Chat</span></button>
            <button type="button" title="Voice Chat" aria-label="Voice Chat" className={chatCallScreen === 'voice' ? 'activeCallModeRailItem' : ''} onClick={() => setChatCallScreen('voice')}><RailIcon type="voiceHistory" /><span>Voice Chat</span></button>
            <button type="button" title="Library" aria-label="Library" onClick={() => { setChatCallMinimized(true); openPanel('library'); }}><RailIcon type="library" /><span>Library</span></button>
            <button type="button" title="Call History" aria-label="Call History" className={chatCallHistoryOpen ? 'activeCallModeRailItem' : ''} onClick={() => { setChatCallHistoryOpen((open) => !open); setChatCallMoreOpen(false); }}><RailIcon type="voiceHistory" /><span>Call History</span></button>
            <button type="button" title="Call Settings" aria-label="Call Settings" className={chatCallMoreOpen ? 'activeCallModeRailItem' : ''} aria-expanded={chatCallMoreOpen} onClick={() => { revealCallControls(true); setChatCallSettingsTab('general'); setChatCallMoreOpen((open) => !open); setChatCallHistoryOpen(false); }}><RailIcon type="settings" /><span>Call Settings</span></button>
          </nav>
          <button type="button" title="Profile" aria-label="Profile" className="unifiedCallRailProfile" onClick={() => { setChatCallMinimized(true); openPanel('profile'); }}><b>S</b><span>Profile</span></button>
        </aside>
        <main className="unifiedCallMain">
          <div className={`unifiedCallVideoStage ${settings.lighting.ringLight ? 'unifiedRingLightActive' : ''}`} style={callVideoFilterStyle} onMouseMove={() => revealCallControls()} onClick={() => revealCallControls()} onFocus={() => revealCallControls(true)}>
            {chatCallScreen === 'video' ? (
              chatCallFocus === 'local' ? (
                cameraEnabled ? (
                  <>
                    <video className="unifiedLocalCallVideo unifiedFilteredCallVideo" autoPlay playsInline muted ref={attachLocalTrackingVideo} />
                    <canvas ref={canvasRef} className={`unifiedHandTrackerOverlay ${settings.feedback.realTimeCorrection ? '' : 'trackerPointsHidden'}`} aria-label="Live hand tracking landmarks" />
                  </>
                ) : (
                  <div className="unifiedLargeCameraOffFallback">
                    {settings.account.profilePhoto ? <img src={settings.account.profilePhoto} alt="" /> : <b>{accountAvatarInitials}</b>}
                    <strong>Your camera is off</strong>
                  </div>
                )
              ) : remoteMediaState.camera ? (
                <video className="unifiedLocalCallVideo unifiedRemoteCallVideo" autoPlay playsInline ref={attachRemoteCallVideo} />
              ) : (
                <div className="unifiedLargeCameraOffFallback partnerLargeCameraOffFallback">
                  <ContactAvatar contact={selectedChatContact || { name: 'Partner', avatarChoice: 'initial' }} className="unifiedLargeProfileAvatar" />
                  <strong>{selectedChatContact?.name || 'Partner'} turned off camera</strong>
                </div>
              )
            ) : (
              <div className="unifiedVoiceCallSurface"><div className="chatVoiceOrb" aria-hidden="true"><span /><b>Voice</b><em /></div><div className="chatVoicePulse" aria-hidden="true"><i /><i /><i /><i /><i /></div><strong>Voice-to-sign translation active</strong><small>Speak naturally. Signova prepares captions and sign responses.</small></div>
            )}
            <span className="unifiedLocalLabel"><i />{chatCallFocus === 'local' ? 'You' : selectedChatContact?.name || 'Partner'}</span>
            {chatCallScreen === 'video' && (
              <button type="button" className="unifiedPartnerPreview" onClick={() => setChatCallFocus((focus) => focus === 'local' ? 'remote' : 'local')} aria-label={chatCallFocus === 'local' ? 'Show partner full screen' : 'Show your camera full screen'}>
                {chatCallFocus === 'local' ? (
                  remoteMediaState.camera ? <video ref={attachRemoteCallVideo} autoPlay playsInline /> : (
                    <span className="unifiedLargePreviewCameraOff">
                      <ContactAvatar contact={selectedChatContact || { name: 'Partner', avatarChoice: 'initial' }} className="unifiedLargePreviewProfileAvatar" />
                    </span>
                  )
                ) : cameraEnabled ? (
                  <>
                    <video className="unifiedFilteredCallVideo" autoPlay playsInline muted ref={attachLocalTrackingVideo} />
                    <canvas ref={canvasRef} className={`unifiedHandTrackerOverlay unifiedPreviewHandTrackerOverlay ${settings.feedback.realTimeCorrection ? '' : 'trackerPointsHidden'}`} aria-label="Live hand tracking landmarks" />
                  </>
                ) : (
                  <span className="unifiedLargePreviewCameraOff">
                    {settings.account.profilePhoto ? <img src={settings.account.profilePhoto} alt="" /> : <b>{accountAvatarInitials}</b>}
                  </span>
                )}
                <span><i />{chatCallFocus === 'local' ? selectedChatContact?.name || 'Partner' : 'You'}</span><b>{callStatus.includes('connected') ? 'Live' : 'Ready'}</b>
              </button>
            )}
            {(!remoteMediaState.camera || !remoteMediaState.mic || !remoteMediaState.translation) && (
              <div className="unifiedLargeStatusNotices" aria-live="polite">
                {!remoteMediaState.camera && <span><b>Camera off</b>{selectedChatContact?.name || 'Partner'} turned off camera</span>}
                {!remoteMediaState.mic && <span><b>Mic off</b>{selectedChatContact?.name || 'Partner'} muted microphone</span>}
                {!remoteMediaState.translation && <span><b>Translation off</b>{selectedChatContact?.name || 'Partner'} paused translation</span>}
              </div>
            )}
            <div className={`unifiedTranslationCaption ${callControlsVisible || chatCallMoreOpen ? 'captionAboveCallControls' : 'captionAtVideoBottom'}`} aria-live="polite"><span>Live translation <b>{activeCallLanguage}</b></span><strong>{chatCallScreen === 'voice' ? remoteCaption : liveSign?.phrase || 'Waiting for signs'}</strong><small>{currentSignReference ? `${currentSignReference} · ${activeCallBook}` : `${activeCallBook} · ${captionChannelStatus}`}</small></div>
          </div>
          <div className={`unifiedCallControls unifiedGlassCallControls ${callControlsVisible || chatCallMoreOpen ? 'visibleUnifiedCallControls' : 'hiddenUnifiedCallControls'}`} aria-label="Call controls" onMouseEnter={() => revealCallControls(true)} onMouseLeave={() => revealCallControls()} onFocus={() => revealCallControls(true)}>
            <button type="button" className={`unifiedTranslationCallControl ${synapseEnabled ? 'activeUnifiedCallControl' : 'inactiveUnifiedCallControl'}`} onClick={toggleCallTranslation} title={synapseEnabled ? 'Pause live translation' : 'Resume live translation'} aria-pressed={synapseEnabled}><RailIcon type="translate" /><span>Translate</span><small>{synapseEnabled ? 'On' : 'Paused'}</small></button>
            <button type="button" className={`unifiedMediaCallControl ${cameraEnabled ? 'mediaCallControlOn activeUnifiedCallControl' : 'mediaCallControlOff'}`} onClick={handleCameraControlClick} onDoubleClick={flipCameraFacingMode} title="Click: camera on/off · Double-click: flip front/back camera" aria-label={cameraEnabled ? 'Turn camera off. Double-click to flip camera.' : 'Turn camera on. Double-click to flip camera.'}><span className="unifiedCameraStateIcon" aria-hidden="true"><i /><b /></span><span>Camera</span><small>{cameraEnabled ? 'On' : 'Off'}</small></button>
            <button type="button" className={`unifiedMediaCallControl ${micEnabled ? 'mediaCallControlOn activeUnifiedCallControl' : 'mediaCallControlOff'}`} onClick={toggleMicTrack} aria-label={micEnabled ? 'Mute microphone' : 'Turn microphone on'}><span className="unifiedMicStateIcon" aria-hidden="true"><i /><b /></span><span>Mic</span><small>{micEnabled ? 'On' : 'Muted'}</small></button>
            {chatCallMoreOpen && createPortal((
                <div className={`unifiedMoreCallPopover ${premiumDarkMode ? 'premiumDarkMode' : ''}`} role="dialog" aria-label="Call translation settings">
                  <header><span>Call settings</span><button type="button" onClick={() => setChatCallMoreOpen(false)} aria-label="Close call settings">×</button></header>
                  <nav className="unifiedCallSettingsTabs">
                    {[['general', 'Language'], ['devices', 'Devices'], ['light', 'Light'], ['filter', 'Filter']].map(([tab, label]) => <button type="button" key={tab} className={chatCallSettingsTab === tab ? 'activeCallSettingsTab' : ''} onClick={() => setChatCallSettingsTab(tab)}>{label}</button>)}
                  </nav>
                  {chatCallSettingsTab === 'general' && (
                    <div className="unifiedCallSettingsPane">
                      <label><span>Translation language</span><select value={settings.translation.language} onChange={(event) => changeTranslationLanguage(event.target.value)}><option>English</option><option>Hindi</option><option>Hinglish</option><option>ISL Gloss</option></select></label>
                      <label><span>Recognition model</span><select value={settings.ai.model} onChange={(event) => updateSetting('ai', 'model', event.target.value)}><option value="mixed">Auto mixed model</option><option value="isl">ISL sentence model</option><option value="asl">ASL production hierarchy</option><option value="asl_top300">ASL Top 300 model</option><option value="asl_top500">ASL Top 500 model</option><option value="basic">Quick gesture model</option></select></label>
                      <label><span>Translation mode</span><select value={settings.translation.mode} onChange={(event) => updateSetting('translation', 'mode', event.target.value)}><option value="word">Word · Word Level Signs Book</option><option value="sentence">Sentence · Sentence Level Signs Book</option></select></label>
                      <label className="unifiedCallToggle"><input type="checkbox" checked={voiceEnabled} onChange={(event) => setVoiceEnabled(event.target.checked)} /><span>Voice output</span></label>
                      <label className="unifiedCallToggle"><input type="checkbox" checked={settings.feedback.realTimeCorrection} onChange={(event) => updateSetting('feedback', 'realTimeCorrection', event.target.checked)} /><span>Hand tracking points</span></label>
                    </div>
                  )}
                  {chatCallSettingsTab === 'devices' && (
                    <div className="unifiedCallSettingsPane">
                      <label>
                        <span>Camera device</span>
                        <select
                          value={settings.camera?.deviceId || ''}
                          onChange={(e) => updateSetting?.('camera', 'deviceId', e.target.value)}
                        >
                          {mediaDevicesList.cameras.length ? (
                            mediaDevicesList.cameras.map((cam, idx) => (
                              <option key={cam.deviceId || idx} value={cam.deviceId}>
                                {cam.label || `Camera ${idx + 1}`}
                              </option>
                            ))
                          ) : (
                            <option value="">Default system camera</option>
                          )}
                        </select>
                      </label>
                      <label>
                        <span>Microphone device</span>
                        <select
                          value={settings.microphone?.deviceId || ''}
                          onChange={(e) => updateSetting?.('microphone', 'deviceId', e.target.value)}
                        >
                          {mediaDevicesList.microphones.length ? (
                            mediaDevicesList.microphones.map((mic, idx) => (
                              <option key={mic.deviceId || idx} value={mic.deviceId}>
                                {mic.label || `Microphone ${idx + 1}`}
                              </option>
                            ))
                          ) : (
                            <option value="">Default system microphone</option>
                          )}
                        </select>
                      </label>
                      <label className="unifiedCallToggle">
                        <input
                          type="checkbox"
                          checked={cameraEnabled}
                          onChange={handleCameraControlClick}
                        />
                        <span>Camera active</span>
                      </label>
                      <label className="unifiedCallToggle">
                        <input
                          type="checkbox"
                          checked={micEnabled}
                          onChange={toggleMicTrack}
                        />
                        <span>Microphone active</span>
                      </label>
                    </div>
                  )}
                  {chatCallSettingsTab === 'light' && (
                    <div className="unifiedCallSettingsPane">
                      <label className="unifiedCallToggle"><input type="checkbox" checked={settings.lighting.ringLight} onChange={(event) => updateSetting('lighting', 'ringLight', event.target.checked)} /><span>Ring light</span></label>
                      <label className="unifiedCallRange"><span>Brightness <b>{settings.lighting.brightness}%</b></span><input type="range" min="20" max="100" value={settings.lighting.brightness} onChange={(event) => updateSetting('lighting', 'brightness', Number(event.target.value))} /></label>
                      <label className="unifiedCallToggle"><input type="checkbox" checked={settings.lighting.autoLowLight} onChange={(event) => updateSetting('lighting', 'autoLowLight', event.target.checked)} /><span>Auto low-light correction</span></label>
                      <label className="unifiedCallToggle"><input type="checkbox" checked={settings.lighting.aiEnhancement} onChange={(event) => updateSetting('lighting', 'aiEnhancement', event.target.checked)} /><span>AI hand-edge enhancement</span></label>
                    </div>
                  )}
                  {chatCallSettingsTab === 'filter' && (
                    <div className="unifiedCallSettingsPane">
                      <label className="unifiedCallToggle"><input type="checkbox" checked={settings.filters.enabled} onChange={(event) => updateSetting('filters', 'enabled', event.target.checked)} /><span>Enable camera filters</span></label>
                      <div className="unifiedCallPresetGrid">{['natural', 'clear', 'warm', 'cool'].map((preset) => <button type="button" key={preset} className={settings.filters.preset === preset ? 'activeCallPreset' : ''} onClick={() => updateSetting('filters', 'preset', preset)}>{preset}</button>)}</div>
                      <label className="unifiedCallRange"><span>Beauty smoothing <b>{settings.filters.beautyLevel || 0}%</b></span><input type="range" min="0" max="100" value={settings.filters.beautyLevel || 0} onChange={(event) => updateSetting('filters', 'beautyLevel', Number(event.target.value))} /></label>
                      <label className="unifiedCallToggle"><input type="checkbox" checked={settings.filters.contrastEnhancement} onChange={(event) => updateSetting('filters', 'contrastEnhancement', event.target.checked)} /><span>Contrast enhancement</span></label>
                      <label className="unifiedCallToggle"><input type="checkbox" checked={settings.filters.skinOptimization} onChange={(event) => updateSetting('filters', 'skinOptimization', event.target.checked)} /><span>Skin and hand optimization</span></label>
                    </div>
                  )}
                </div>
            ), document.body)}
            <button type="button" className="unifiedEndCallButton" onClick={endCallSession}><span>☎</span><b>End call</b></button>
          </div>
        </main>
        <aside className="unifiedCallInfoPanel">
          {chatCallHistoryOpen ? (
            <section className="unifiedCallTemporaryHistory">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span>Current call translations</span>
                {Boolean(callTranscript?.length) && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={handleCopyTranscript}
                      title="Copy transcript to clipboard"
                      style={{
                        background: 'rgba(2, 132, 199, 0.12)',
                        border: '1px solid rgba(2, 132, 199, 0.35)',
                        borderRadius: '6px',
                        padding: '2px 8px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        color: premiumDarkMode ? '#38bdf8' : '#0369a1',
                        fontWeight: '700',
                      }}
                    >
                      {transcriptNotice === 'Copied!' ? '✓ Copied' : '📋 Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadTranscript}
                      title="Download transcript as .txt"
                      style={{
                        background: 'rgba(2, 132, 199, 0.12)',
                        border: '1px solid rgba(2, 132, 199, 0.35)',
                        borderRadius: '6px',
                        padding: '2px 8px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        color: premiumDarkMode ? '#38bdf8' : '#0369a1',
                        fontWeight: '700',
                      }}
                    >
                      {transcriptNotice.includes('Saved') ? '✓ Saved' : '💾 Save .txt'}
                    </button>
                  </div>
                )}
              </div>
              <small>Saved automatically during the call session.</small>
              {callTranscript.length ? callTranscript.map((item) => (
                <div key={item.id}>
                  <strong>{item.text}</strong>
                  <small>{item.voiceStatus} · {item.time}</small>
                </div>
              )) : <p>No translations recorded in this call yet.</p>}
            </section>
          ) : (
            <>
              <section><span>Sign accuracy</span><strong>{formatConfidence(liveSign?.confidence || 0)}</strong><div className="unifiedAccuracyBar"><i style={{ width: `${callConfidencePercent}%` }} /></div><div className="unifiedAccuracyMetrics"><span><b>{formatConfidence(liveSign?.qualityScore || 0)}</b>Hand</span><span><b>{formatConfidence(liveSign?.stability || 0)}</b>Stable</span><span><b>{liveSign?.sequenceLength || 0}/{TEMPORAL_BUFFER_SIZE}</b>Sequence</span></div></section>
              <section className="unifiedCallSignTelemetry">
                <span>Sign model telemetry</span>
                <strong>{liveSign?.label ? `${currentSignNumber ? `#${currentSignNumber} · ` : ''}${liveSign.label}` : 'Waiting for sign'}</strong>
                <small>{callVocabularySize || 0} {activeCallLanguage} signs available · {currentSignModel}</small>
                <em className="unifiedActiveBook">{activeCallBook}</em>
                <div className="unifiedTelemetryMetrics">
                  <span><b>{callSignTelemetry.attempts}</b>Attempts</span>
                  <span><b>{callSignTelemetry.accepted}</b>Accepted</span>
                  <span><b>{callSignTelemetry.uncertain}</b>Weak</span>
                  <span><b>{callSignTelemetry.unique.length}</b>Unique</span>
                </div>
              </section>
              <section><span>Call quality</span><strong>{callQualityState.title}</strong><small>{cameraQuality.label} · {cameraQuality.width || 1920}×{cameraQuality.height || 1080} · {settings.camera.fps}fps</small></section>
              <section><span>Connection</span><strong>{captionChannelRef.current ? 'Transport protected & synced' : 'WebRTC transport protected'}</strong><small>{captionChannelStatus}</small><button type="button" onClick={startWebRtcPreview}>{callStatus.includes('connected') ? 'Reconnect' : 'Connect WebRTC'}</button></section>
              <section><span>Participants</span><div className="unifiedParticipant"><b>S</b><span><strong>You</strong><small>{micEnabled ? 'Speaking ready' : 'Muted'}</small></span><em>Local</em></div><div className="unifiedParticipant"><b>P</b><span><strong>{selectedChatContact?.name || 'Partner'}</strong><small>{callStatus}</small></span><em>Remote</em></div></section>
            </>
          )}
        </aside>
      </div>
    </section>
  ), document.body);
}

