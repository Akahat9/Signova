import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import {
  createCallRoom,
  publishCallAnswer,
  publishCallOffer,
  publishIceCandidate,
  setCallRoomStatus,
  watchCallRoom,
  watchIncomingCalls,
} from '../services/callSignaling';
import { summarizeCallStats } from '../features/calls/callQuality';
import { isTerminalCallStatus } from '../features/calls/callStateMachine';
import { validateCallIceConfiguration } from '../features/calls/iceConfiguration';
import {
  buildCaptionSyncPayload,
  deriveLocalMediaState,
  getLiveMediaTrackKinds,
} from '../features/calls/callMediaProtocol';
import { createPeerConnectionSession } from '../features/calls/peerConnectionSession';
import { formatConfidence } from '../features/learning/signPresentation';
import {
  playIncomingRingtone,
  playOutgoingRingback,
  stopCallAudio,
} from '../services/callRingtone';

export default function useCallsManager({
  firestoreDb,
  authenticatedFirebaseUser,
  selectedChatContact,
  settings,
  cameraEnabled,
  micEnabled,
  startCamera,
  stopCamera,
  startCameraRef,
  setMicEnabled,
  updateSynapseEnabled,
  synapseEnabledRef,
  synapseEnabled,
  caption,
  sentence,
  liveSign,
  streamRef,
  videoRef,
  remoteVideoRef,
  speak,
  voiceEnabledRef,
  addTranscriptEntry,
  startConversationLog,
  completeActiveConversationLog,
  clearSentence,
  setStatus,
  setSecureCallStatus,
  updateSettingAndTrack,
  setSelectedChatId,
  setSelectedConversationId,
  setMobileChatListOpen,
  setActivePanel,
  desktopCallWindowMode,
  SIGNOVA_CALL_TEST_MODE = false,
  fetchJson = window.fetch,
}) {
  // Call State
  const [callStatus, setCallStatus] = useState('WebRTC ready');
  const [callNetworkQuality, setCallNetworkQuality] = useState({ label: 'Waiting', rttMs: 0, packetLoss: 0, bitrateKbps: 0 });
  const [incomingCall, setIncomingCall] = useState(null);
  const [acceptingIncomingCall, setAcceptingIncomingCall] = useState(false);
  const [callExperience, setCallExperience] = useState('videoSignChat');
  const [callElapsedSeconds, setCallElapsedSeconds] = useState(0);
  const [chatCallScreen, setChatCallScreen] = useState(null);
  const [chatCallMinimized, setChatCallMinimized] = useState(false);
  const [chatCallExpanded, setChatCallExpanded] = useState(false);
  const [chatCallInfoOpen, setChatCallInfoOpen] = useState(false);
  const [chatCallMoreOpen, setChatCallMoreOpen] = useState(false);
  const [callControlsVisible, setCallControlsVisible] = useState(true);
  const [chatCallSettingsTab, setChatCallSettingsTab] = useState('general');
  const [chatCallHistoryOpen, setChatCallHistoryOpen] = useState(false);
  const [chatCallFocus, setChatCallFocus] = useState('local');
  const calculateDefaultOverlayPosition = useCallback(() => {
    if (typeof window === 'undefined') return { x: 16, y: 16 };
    const width = window.innerWidth <= 600 ? Math.min(320, window.innerWidth - 32) : 380;
    const height = window.innerWidth <= 600 ? 210 : 220;
    return {
      x: Math.max(16, window.innerWidth - width - 16),
      y: Math.max(16, window.innerHeight - height - 16),
    };
  }, []);

  const [chatCallPosition, setChatCallPosition] = useState(calculateDefaultOverlayPosition);
  const [remoteMediaTrackKinds, setRemoteMediaTrackKinds] = useState([]);
  const [remoteMediaState, setRemoteMediaState] = useState({ camera: true, mic: true, translation: true });
  const [remoteCaption, setRemoteCaption] = useState('Waiting for remote caption');
  const [captionChannelStatus, setCaptionChannelStatus] = useState('Caption sync ready');
  const [callTranscript, setCallTranscript] = useState([]);
  const [callSignTelemetry, setCallSignTelemetry] = useState({ attempts: 0, accepted: 0, uncertain: 0, unique: [], last: null });
  const [apiConnectionRetryKey, setApiConnectionRetryKey] = useState(0);

  // Call Refs
  const remoteStreamRef = useRef(null);
  const peerRefs = useRef([]);
  const activeCallRoomIdRef = useRef('');
  const activeCallRemoteUidRef = useRef('');
  const callSignalingUnsubscribersRef = useRef([]);
  const callStatsTimerRef = useRef(null);
  const callRingTimeoutRef = useRef(null);
  const callReconnectTimeoutRef = useRef(null);
  const callHeartbeatTimerRef = useRef(null);
  const lastHeartbeatReceivedRef = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const previousCallStatsRef = useRef({ at: 0, bytes: 0 });
  const chatCallDragRef = useRef(null);
  const callControlsTimerRef = useRef(null);
  const startWebRtcPreviewRef = useRef(null);
  const chatCallScreenRef = useRef(null);
  const captionChannelRef = useRef(null);
  const lastRemoteSpoken = useRef('');

  useEffect(() => {
    chatCallScreenRef.current = chatCallScreen;
  }, [chatCallScreen]);

  useEffect(() => {
    function handleWindowResize() {
      setChatCallPosition((prev) => {
        const width = window.innerWidth <= 600 ? Math.min(320, window.innerWidth - 32) : 380;
        const height = window.innerWidth <= 600 ? 210 : 220;
        const maxX = Math.max(16, window.innerWidth - width - 16);
        const maxY = Math.max(16, window.innerHeight - height - 16);
        return {
          x: Math.max(16, Math.min(maxX, prev.x)),
          y: Math.max(16, Math.min(maxY, prev.y)),
        };
      });
    }
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, []);

  const activeTargetContactRef = useRef(null);
  const callConnectedAtRef = useRef(0);
  const acceptingCallRef = useRef(false);
  const iceConfigCacheRef = useRef({ value: null, at: 0 });

  // Elapsed timer effect - counts strictly once WebRTC connects
  useEffect(() => {
    if (!chatCallScreen) {
      setCallElapsedSeconds(0);
      callConnectedAtRef.current = 0;
      return undefined;
    }
    const timer = window.setInterval(() => {
      if (callConnectedAtRef.current > 0) {
        setCallElapsedSeconds(Math.floor((Date.now() - callConnectedAtRef.current) / 1000));
      } else {
        setCallElapsedSeconds(0);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [chatCallScreen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCallAudio();
      captionChannelRef.current?.close?.();
      captionChannelRef.current = null;
      peerRefs.current.forEach((peer) => peer.close());
      callSignalingUnsubscribersRef.current.forEach((unsubscribe) => unsubscribe?.());
      window.clearInterval(callStatsTimerRef.current);
      window.clearTimeout(callRingTimeoutRef.current);
      window.clearTimeout(callReconnectTimeoutRef.current);
      window.clearTimeout(callControlsTimerRef.current);
    };
  }, []);

  // Watch incoming calls
  useEffect(() => {
    if (!firestoreDb || !authenticatedFirebaseUser?.uid) {
      setIncomingCall(null);
      stopCallAudio();
      return undefined;
    }
    return watchIncomingCalls(firestoreDb, authenticatedFirebaseUser.uid, (rooms) => {
      const activeRoom = rooms[0] || null;
      if (activeRoom?.id !== activeCallRoomIdRef.current) {
        setIncomingCall(activeRoom);
        if (activeRoom) {
          playIncomingRingtone();
        } else {
          stopCallAudio();
        }
      }
    }, () => setStatus?.('Incoming call signaling is temporarily unavailable.'));
  }, [authenticatedFirebaseUser?.uid, firestoreDb, setStatus]);

  function clearCallSignalingSubscriptions() {
    callSignalingUnsubscribersRef.current.forEach((unsubscribe) => unsubscribe?.());
    callSignalingUnsubscribersRef.current = [];
  }

  function stopCallStats() {
    window.clearInterval(callStatsTimerRef.current);
    callStatsTimerRef.current = null;
    previousCallStatsRef.current = { at: 0, bytes: 0 };
  }

  function stopCallHeartbeat() {
    if (callHeartbeatTimerRef.current) {
      window.clearInterval(callHeartbeatTimerRef.current);
      callHeartbeatTimerRef.current = null;
    }
    lastHeartbeatReceivedRef.current = 0;
  }

  function clearCallTimers() {
    window.clearTimeout(callRingTimeoutRef.current);
    window.clearTimeout(callReconnectTimeoutRef.current);
    callRingTimeoutRef.current = null;
    callReconnectTimeoutRef.current = null;
    stopCallHeartbeat();
  }

  function retryServiceConnection(setApiConnection) {
    setApiConnection?.((current) => ({
      ...current,
      status: 'checking',
      backend: 'Checking',
      ai: 'Checking',
      detail: 'Checking Signova services',
    }));
    setApiConnectionRetryKey((value) => value + 1);
  }

  const getCurrentLocalMediaState = useCallback(() => {
    const stream = streamRef.current || videoRef.current?.srcObject;
    return deriveLocalMediaState({
      stream,
      cameraFallback: cameraEnabled,
      micFallback: micEnabled,
      translation: synapseEnabledRef.current,
    });
  }, [cameraEnabled, micEnabled, streamRef, synapseEnabledRef, videoRef]);

  function applyRemoteCaptionPayload(payload) {
    if (!payload || typeof payload !== 'object') return;
    if (payload.mediaState) {
      setRemoteMediaState((current) => ({ ...current, ...payload.mediaState }));
      if (payload.type === 'signova-media-state') return;
    }
    const nextCaption = payload.caption || payload.sentence || 'Remote sign received';
    setRemoteCaption(nextCaption);
    setCaptionChannelStatus(payload.confidence
      ? `Synced ${formatConfidence(Number(payload.confidence))}`
      : 'Caption synced');
    const voiceOutputAllowed = voiceEnabledRef.current && settings.translation?.outputType !== 'text';
    const spokenKey = `${nextCaption}-${payload.language || settings.translation?.language}`;
    if (voiceOutputAllowed && nextCaption !== 'Waiting for signs' && spokenKey !== lastRemoteSpoken.current) {
      lastRemoteSpoken.current = spokenKey;
      speak?.(nextCaption, payload.language || settings.translation?.language);
    }
    addTranscriptEntry?.({
      label: payload.label || 'remote',
      text: nextCaption,
      confidence: Number(payload.confidence || 0),
      voiceStatus: payload.voiceStatus === 'voice' ? 'Remote voice' : 'Remote text',
      remoteStatus: 'Received',
    });
  }

  function sendCaptionSync(override = {}) {
    const channel = captionChannelRef.current;
    if (!channel || channel.readyState !== 'open') return false;
    const payload = buildCaptionSyncPayload({
      caption,
      sentence,
      label: liveSign?.label || '',
      confidence: liveSign?.confidence || 0,
      language: settings.translation?.language,
      mode: settings.translation?.mode,
      mediaState: getCurrentLocalMediaState(),
      sentAt: Date.now(),
      ...override,
    });
    channel.send(JSON.stringify(payload));
    return true;
  }

  // Caption channel live sync
  useEffect(() => {
    if (caption === 'Waiting for signs') return;
    const channel = captionChannelRef.current;
    if (!channel || channel.readyState !== 'open') return;
    channel.send(JSON.stringify(buildCaptionSyncPayload({
      caption,
      sentence,
      label: liveSign?.label || '',
      confidence: liveSign?.confidence || 0,
      language: settings.translation?.language,
      mode: settings.translation?.mode,
      mediaState: getCurrentLocalMediaState(),
      sentAt: Date.now(),
    })));
  }, [cameraEnabled, caption, getCurrentLocalMediaState, liveSign, micEnabled, sentence, settings.translation?.language, settings.translation?.mode, synapseEnabled]);

  // Media state sync
  useEffect(() => {
    if (!chatCallScreen) return;
    const channel = captionChannelRef.current;
    if (!channel || channel.readyState !== 'open') return;
    channel.send(JSON.stringify({
      type: 'signova-media-state',
      mediaState: getCurrentLocalMediaState(),
      sentAt: Date.now(),
    }));
  }, [cameraEnabled, chatCallScreen, getCurrentLocalMediaState, micEnabled, synapseEnabled]);

  function startCallStats(peer) {
    stopCallStats();
    async function sample() {
      if (peer.connectionState === 'closed') return;
      try {
        const report = await peer.getStats();
        const now = Date.now();
        const summary = summarizeCallStats(Array.from(report.values()), previousCallStatsRef.current, now);
        previousCallStatsRef.current = summary.next;
        setCallNetworkQuality(summary.quality);
      } catch {
        // Stats availability differs across browsers; the call itself remains active.
      }
    }
    sample();
    callStatsTimerRef.current = window.setInterval(sample, 2500);
  }

  function startCallHeartbeat(channel) {
    stopCallHeartbeat();
    if (!channel || channel.readyState !== 'open') return;
    lastHeartbeatReceivedRef.current = Date.now();
    callHeartbeatTimerRef.current = window.setInterval(() => {
      const activeChannel = captionChannelRef.current;
      if (!activeChannel || activeChannel.readyState !== 'open') {
        stopCallHeartbeat();
        return;
      }
      try {
        activeChannel.send(JSON.stringify({ type: 'signova-heartbeat-ping', sentAt: Date.now() }));
      } catch {
        // Transport error caught cleanly
      }
      if (lastHeartbeatReceivedRef.current && Date.now() - lastHeartbeatReceivedRef.current > 8000) {
        setCaptionChannelStatus('Sync degraded · Checking transport');
      }
    }, 3000);
  }

  function configureCaptionChannel(channel) {
    captionChannelRef.current = channel;
    channel.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.type === 'signova-heartbeat-ping') {
          if (channel.readyState === 'open') {
            try {
              channel.send(JSON.stringify({ type: 'signova-heartbeat-pong', sentAt: payload.sentAt, receivedAt: Date.now() }));
            } catch {}
          }
          lastHeartbeatReceivedRef.current = Date.now();
          return;
        }
        if (payload?.type === 'signova-heartbeat-pong') {
          lastHeartbeatReceivedRef.current = Date.now();
          const rtt = Math.max(1, Date.now() - (Number(payload.sentAt) || Date.now()));
          setCallSignTelemetry((current) => ({ ...current, rttMs: rtt }));
          return;
        }
        if (payload?.type === 'signova-call-hangup') {
          handleRemoteTerminalCall('ended');
          return;
        }
        applyRemoteCaptionPayload(payload);
      } catch {
        setRemoteCaption(String(event.data || 'Remote sign received'));
        setCaptionChannelStatus('Caption synced');
      }
    };
    channel.onopen = () => {
      setCaptionChannelStatus('Caption sync connected');
      startCallHeartbeat(channel);
      sendCaptionSync({ caption, sentence });
    };
    channel.onclose = () => {
      stopCallHeartbeat();
      setCaptionChannelStatus('Caption sync closed');
    };
    channel.onerror = () => {
      stopCallHeartbeat();
      setCaptionChannelStatus('Caption sync error');
    };
  }

  async function getCallIceConfiguration() {
    if (SIGNOVA_CALL_TEST_MODE) return { iceServers: [], turnConfigured: false, iceTransportPolicy: 'all' };
    if (iceConfigCacheRef.current.value && Date.now() - iceConfigCacheRef.current.at < 60_000) {
      return iceConfigCacheRef.current.value;
    }
    try {
      const config = await Promise.race([
        fetchJson('/api/calls/ice-config'),
        new Promise((_, reject) => window.setTimeout(() => reject(new Error('ICE config timeout')), 1200)),
      ]);
      const requireTurn = process.env.REACT_APP_SIGNOVA_FORCE_RELAY === 'true';
      const validated = validateCallIceConfiguration(config, { requireTurn });
      if (!validated.turnConfigured) setStatus?.('Call is using STUN only; TURN must be configured for reliable production calls.');
      iceConfigCacheRef.current = { value: validated, at: Date.now() };
      return validated;
    } catch {
      const fallback = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ],
        turnConfigured: false,
        iceTransportPolicy: 'all',
      };
      iceConfigCacheRef.current = { value: fallback, at: Date.now() };
      return fallback;
    }
  }

  function createSignovaPeer({ iceServers, iceTransportPolicy = 'all', localStream, roomId, localUid, remoteUid, caller }) {
    const { peer, unsubscribeCandidates } = createPeerConnectionSession({
      PeerConnection: RTCPeerConnection,
      iceServers,
      iceTransportPolicy,
      localStream,
      caller,
      onLocalCandidate: (candidate) => publishIceCandidate(firestoreDb, roomId, localUid, candidate),
      onLocalCandidateError: () => setCallStatus('ICE signaling interrupted'),
      onRemoteStream: (remoteStream) => {
        remoteStreamRef.current = remoteStream;
        const trackKinds = getLiveMediaTrackKinds(remoteStream);
        setRemoteMediaTrackKinds(trackKinds);
        setRemoteMediaState((current) => ({
          ...current,
          camera: trackKinds.includes('video'),
          mic: trackKinds.includes('audio'),
        }));
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
      },
      onDataChannel: (channel) => {
        if (channel.label === 'signova-caption-sync') configureCaptionChannel(channel);
      },
      onConnectionStateChange: (state, activePeer) => {
        if (state === 'connected') {
          reconnectAttemptRef.current = 0;
          clearCallTimers();
          stopCallAudio();
          callConnectedAtRef.current = Date.now();
          setCallStatus('WebRTC connected · Secure');
          startCallStats(activePeer);
          setCallRoomStatus(firestoreDb, roomId, 'connected').catch(() => undefined);
        } else if (state === 'disconnected' || state === 'failed') {
          if (reconnectAttemptRef.current < 3) {
            reconnectAttemptRef.current += 1;
            const attempt = reconnectAttemptRef.current;
            setCallStatus(`Connection interrupted — reconnecting (attempt ${attempt}/3)…`);
            setCallRoomStatus(firestoreDb, roomId, 'reconnecting').catch(() => undefined);
            if (caller) {
              window.clearTimeout(callReconnectTimeoutRef.current);
              callReconnectTimeoutRef.current = window.setTimeout(async () => {
                if (activePeer.connectionState === 'connected') return;
                try {
                  const restartOffer = await activePeer.createOffer({ iceRestart: true });
                  await activePeer.setLocalDescription(restartOffer);
                  await publishCallOffer(firestoreDb, roomId, restartOffer);
                } catch {
                  setCallStatus('Reconnect negotiation failed');
                }
              }, 1200 * attempt);
            }
          } else {
            clearCallTimers();
            stopCallStats();
            stopCallAudio();
            callConnectedAtRef.current = 0;
            setCallStatus('Call connection lost · Network unreachable');
            setCallRoomStatus(firestoreDb, roomId, 'failed').catch(() => undefined);
          }
        } else if (state === 'closed') {
          clearCallTimers();
          stopCallStats();
          stopCallAudio();
          callConnectedAtRef.current = 0;
          if (activeCallRoomIdRef.current) {
            handleRemoteTerminalCall('ended');
          }
        }
      },
    });

    peerRefs.current.push(peer);
    activeCallRoomIdRef.current = roomId;
    activeCallRemoteUidRef.current = remoteUid;
    callSignalingUnsubscribersRef.current.push(unsubscribeCandidates);
    return peer;
  }

  async function startWebRtcPreview() {
    if (activeCallRoomIdRef.current || peerRefs.current.length) {
      setCallStatus('A call is already active or connecting');
      return;
    }
    startConversationLog?.('webrtc');
    if (!streamRef.current && !videoRef.current?.srcObject) {
      if (chatCallScreen === 'voice') {
        setCallStatus('Starting microphone for WebRTC…');
        try {
          streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          setMicEnabled?.(true);
        } catch {
          setCallStatus('Microphone permission required for WebRTC');
          return;
        }
      } else {
        setCallStatus('Starting camera for WebRTC...');
        const cameraStarted = await startCamera?.();
        if (!cameraStarted) {
          setCallStatus('Camera permission required for WebRTC');
          return;
        }
      }
    }

    const localStream = streamRef.current || videoRef.current?.srcObject;
    if (!localStream) {
      setCallStatus('Start camera first');
      return;
    }

    const callerUid = authenticatedFirebaseUser?.uid;
    let calleeUid = activeTargetContactRef.current?.firebaseUid || selectedChatContact?.firebaseUid || '';
    if (!calleeUid && firestoreDb) {
      const target = activeTargetContactRef.current || selectedChatContact;
      const rawUsername = String(target?.username || '').trim().toLowerCase();
      const usernameCandidates = rawUsername
        ? [rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`, rawUsername.replace(/^@+/, '')]
        : [];
      for (const lookupUsername of usernameCandidates) {
        if (!lookupUsername) continue;
        try {
          const snap = await getDoc(doc(firestoreDb, 'publicUserIdentities', lookupUsername));
          if (snap.exists() && snap.data()?.uid) {
            calleeUid = String(snap.data().uid);
            break;
          }
        } catch {
          // try next candidate
        }
      }
      if (!calleeUid && target?.number) {
        const phoneDigits = String(target.number).replace(/\D/g, '');
        const phoneKeys = phoneDigits.length >= 7 ? [phoneDigits, phoneDigits.slice(-10)] : [];
        for (const pKey of phoneKeys) {
          try {
            const snap = await getDoc(doc(firestoreDb, 'publicPhoneIdentities', pKey));
            if (snap.exists() && snap.data()?.uid) {
              calleeUid = String(snap.data().uid);
              break;
            }
          } catch {
            // ignore
          }
        }
      }
    }
    if (!firestoreDb || !callerUid) {
      setCallStatus('Verified Signova login is required for real calling');
      return;
    }
    if (!calleeUid || calleeUid === callerUid) {
      setCallStatus('This contact has no verified Signova identity for real calling');
      return;
    }

    peerRefs.current.forEach((peer) => peer.close());
    clearCallSignalingSubscriptions();
    captionChannelRef.current?.close?.();
    captionChannelRef.current = null;
    lastRemoteSpoken.current = '';
    setRemoteCaption('Waiting for remote caption');
    setCaptionChannelStatus('Opening caption sync...');

    const roomId = await createCallRoom(firestoreDb, { callerUid, calleeUid, mediaType: chatCallScreen === 'voice' ? 'voice' : 'video' });
    activeCallRoomIdRef.current = roomId;
    activeCallRemoteUidRef.current = calleeUid;
    let localPeer = null;
    let pendingAnswerSdp = '';
    callSignalingUnsubscribersRef.current.push(watchCallRoom(firestoreDb, roomId, (room) => {
      if (!room) return;
      if (localPeer && room.answer && room.answer.sdp !== localPeer.currentRemoteDescription?.sdp && room.answer.sdp !== pendingAnswerSdp) {
        pendingAnswerSdp = room.answer.sdp;
        localPeer.setRemoteDescription(room.answer)
          .catch(() => setCallStatus('Remote answer was invalid'))
          .finally(() => { pendingAnswerSdp = ''; });
      }
      if (isTerminalCallStatus(room.status)) handleRemoteTerminalCall(room.status);
    }, () => setCallStatus('Call room signaling unavailable')));
    const iceConfig = await getCallIceConfiguration();
    if (activeCallRoomIdRef.current !== roomId) return;
    localPeer = createSignovaPeer({
      ...iceConfig, localStream, roomId, localUid: callerUid, remoteUid: calleeUid, caller: true,
    });
    const offer = await localPeer.createOffer();
    if (activeCallRoomIdRef.current !== roomId) return;
    await localPeer.setLocalDescription(offer);
    if (activeCallRoomIdRef.current !== roomId) return;
    await publishCallOffer(firestoreDb, roomId, offer);
    playOutgoingRingback();
    setCallStatus('Calling verified Signova contact…');
    callRingTimeoutRef.current = window.setTimeout(async () => {
      if (localPeer.connectionState === 'connected' || activeCallRoomIdRef.current !== roomId) return;
      stopCallAudio();
      await setCallRoomStatus(firestoreDb, roomId, 'failed').catch(() => undefined);
      resetWebRtcPreview('Call timed out · no answer');
    }, 30000);
  }

  async function acceptIncomingCall() {
    if (acceptingCallRef.current) return;
    stopCallAudio();
    let room = incomingCall;
    const localUid = authenticatedFirebaseUser?.uid;
    if (!room || !localUid || !firestoreDb) {
      setStatus?.('No active incoming call or Firebase session.');
      return;
    }
    acceptingCallRef.current = true;
    setAcceptingIncomingCall(true);
    try {
      activeCallRoomIdRef.current = room.id;
      activeCallRemoteUidRef.current = room.callerUid || '';
      clearCallSignalingSubscriptions();
      let activePeer = null;
      let abortedByRemote = false;
      callSignalingUnsubscribersRef.current.push(watchCallRoom(firestoreDb, room.id, async (nextRoom) => {
        if (!nextRoom) return;
        if (isTerminalCallStatus(nextRoom.status)) {
          abortedByRemote = true;
          handleRemoteTerminalCall(nextRoom.status);
          return;
        }
        if (activePeer && nextRoom.status === 'reconnecting' && nextRoom.offer && nextRoom.offer.sdp !== activePeer.currentRemoteDescription?.sdp) {
          try {
            await activePeer.setRemoteDescription(nextRoom.offer);
            const restartAnswer = await activePeer.createAnswer();
            await activePeer.setLocalDescription(restartAnswer);
            await publishCallAnswer(firestoreDb, room.id, restartAnswer);
          } catch {
            setCallStatus('Reconnect negotiation failed');
          }
        }
      }, () => setCallStatus('Call room signaling unavailable')));

      setIncomingCall(null);
      setActivePanel?.('chats');
      setMobileChatListOpen?.(false);
      setChatCallScreen(room.mediaType === 'voice' ? 'voice' : 'video');
      setCallStatus('Connecting to caller…');

      if (!room.offer) {
        room = await new Promise((resolve) => {
          let settled = false;
          let unsub = () => undefined;
          const timer = window.setTimeout(() => {
            if (!settled) {
              settled = true;
              unsub();
              resolve(null);
            }
          }, 15000);
          unsub = watchCallRoom(firestoreDb, room.id, (latest) => {
            if (settled) return;
            if (latest && isTerminalCallStatus(latest.status)) {
              settled = true;
              window.clearTimeout(timer);
              unsub();
              abortedByRemote = true;
              handleRemoteTerminalCall(latest.status);
              resolve(null);
              return;
            }
            if (latest?.offer) {
              settled = true;
              window.clearTimeout(timer);
              unsub();
              resolve(latest);
            }
          }, () => {
            if (!settled) {
              settled = true;
              window.clearTimeout(timer);
              unsub();
              resolve(null);
            }
          });
        });
        if (abortedByRemote) return;
        if (!room?.offer) {
          setStatus?.('The caller took too long to prepare the connection. Try again.');
          setCallStatus('Call connection unavailable');
          setChatCallScreen(null);
          completeActiveConversationLog?.();
          clearCallSignalingSubscriptions();
          activeCallRoomIdRef.current = '';
          activeCallRemoteUidRef.current = '';
          return;
        }
      }

      setCallStatus('Accepting incoming call…');
      clearCallTimers();
      if (!streamRef.current) {
        if (room.mediaType === 'video') {
          const cameraStarted = await startCamera?.();
          if (abortedByRemote || activeCallRoomIdRef.current !== room.id) return;
          if (!cameraStarted) {
            setCallStatus('Camera permission is required to accept this video call');
            setStatus?.('Camera permission is required to accept this video call.');
            setChatCallScreen(null);
            completeActiveConversationLog?.();
            clearCallSignalingSubscriptions();
            activeCallRoomIdRef.current = '';
            activeCallRemoteUidRef.current = '';
            return;
          }
        } else {
          try {
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            setMicEnabled?.(true);
          } catch {
            setCallStatus('Microphone permission is required to accept this voice call');
            setStatus?.('Microphone permission is required to accept this voice call.');
            setChatCallScreen(null);
            completeActiveConversationLog?.();
            clearCallSignalingSubscriptions();
            activeCallRoomIdRef.current = '';
            activeCallRemoteUidRef.current = '';
            return;
          }
        }
      }
      if (abortedByRemote || activeCallRoomIdRef.current !== room.id) return;
      const localStream = streamRef.current || videoRef.current?.srcObject;
      if (!localStream) {
        setCallStatus('Microphone or camera stream is unavailable');
        setChatCallScreen(null);
        completeActiveConversationLog?.();
        clearCallSignalingSubscriptions();
        activeCallRoomIdRef.current = '';
        activeCallRemoteUidRef.current = '';
        return;
      }
      peerRefs.current.forEach((peer) => peer.close());
      const iceConfig = await getCallIceConfiguration();
      if (abortedByRemote || activeCallRoomIdRef.current !== room.id) return;
      const peer = createSignovaPeer({
        ...iceConfig,
        localStream,
        roomId: room.id,
        localUid,
        remoteUid: room.callerUid,
        caller: false,
      });
      activePeer = peer;
      await peer.setRemoteDescription(room.offer);
      if (abortedByRemote || activeCallRoomIdRef.current !== room.id) return;
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await publishCallAnswer(firestoreDb, room.id, answer);
      startConversationLog?.(room.mediaType === 'voice' ? 'voice-sign-chat' : 'video-sign-chat', room.callerUid);
      setCallStatus('Connecting WebRTC…');
    } catch (error) {
      setCallStatus(`Accepting call failed: ${error?.message || 'connection error'}`);
      setStatus?.('Could not connect incoming call. Please try again.');
      setChatCallScreen(null);
      completeActiveConversationLog?.();
      clearCallSignalingSubscriptions();
      activeCallRoomIdRef.current = '';
      activeCallRemoteUidRef.current = '';
    } finally {
      acceptingCallRef.current = false;
      setAcceptingIncomingCall(false);
    }
  }

  async function rejectIncomingCall() {
    stopCallAudio();
    const roomId = incomingCall?.id;
    setIncomingCall(null);
    completeActiveConversationLog?.();
    setChatCallScreen(null);
    setCallStatus('Call rejected');
    if (roomId && firestoreDb) {
      await Promise.resolve(setCallRoomStatus(firestoreDb, roomId, 'rejected')).catch(() => undefined);
    }
    setStatus?.('Incoming call rejected.');
  }

  startWebRtcPreviewRef.current = startWebRtcPreview;

  // Auto WebRTC call initiation effect
  useEffect(() => {
    if (!['video', 'voice'].includes(chatCallScreen) || peerRefs.current.length || acceptingCallRef.current || activeCallRoomIdRef.current) return undefined;
    if (chatCallScreen === 'video' && (!cameraEnabled || !streamRef.current)) return undefined;
    const timer = window.setTimeout(() => {
      startWebRtcPreviewRef.current?.().catch((error) => {
        setCallStatus(`Calling unavailable: ${error.message || 'connection failed'}`);
        setCaptionChannelStatus('Caption sync unavailable');
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [cameraEnabled, chatCallScreen, streamRef]);

  function resetWebRtcPreview(nextCallStatus = 'WebRTC ready') {
    stopCallAudio();
    callConnectedAtRef.current = 0;
    clearCallTimers();
    stopCallStats();
    clearCallSignalingSubscriptions();
    captionChannelRef.current?.close?.();
    captionChannelRef.current = null;
    lastRemoteSpoken.current = '';
    peerRefs.current.forEach((peer) => peer.close());
    peerRefs.current = [];
    activeCallRoomIdRef.current = '';
    activeCallRemoteUidRef.current = '';
    remoteStreamRef.current = null;
    setRemoteMediaTrackKinds([]);
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setRemoteCaption('Waiting for remote caption');
    setRemoteMediaState({ camera: true, mic: true, translation: true });
    setCaptionChannelStatus('Caption sync ready');
    setCallStatus(nextCallStatus);
    setCallNetworkQuality({ label: 'Waiting', rttMs: 0, packetLoss: 0, bitrateKbps: 0 });
  }

  function handleRemoteTerminalCall(status) {
    const label = status === 'ended' ? 'Call ended' : `Call ${status}`;
    completeActiveConversationLog?.();
    resetWebRtcPreview(label);
    stopCamera?.();
    setIncomingCall(null);
    setChatCallScreen(null);
    setChatCallMinimized(false);
    setChatCallExpanded(false);
    setChatCallInfoOpen(false);
    setChatCallMoreOpen(false);
    setChatCallHistoryOpen(false);
  }

  async function endCallSession(event) {
    event?.stopPropagation();
    completeActiveConversationLog?.();
    const roomIdToEnd = activeCallRoomIdRef.current;
    if (captionChannelRef.current?.readyState === 'open') {
      try {
        captionChannelRef.current.send(JSON.stringify({ type: 'signova-call-hangup', sentAt: Date.now() }));
      } catch {
        // DataChannel may already be closing; Firestore update handles fallback
      }
    }
    const statusUpdatePromise = roomIdToEnd && firestoreDb
      ? Promise.resolve(setCallRoomStatus(firestoreDb, roomIdToEnd, 'ended')).catch(() => undefined)
      : Promise.resolve();
    resetWebRtcPreview('Call ended');
    stopCamera?.();
    setSecureCallStatus?.('Call ended');
    setCallStatus('Call ended');
    setChatCallScreen(null);
    setChatCallMinimized(false);
    setChatCallExpanded(false);
    setChatCallInfoOpen(false);
    setChatCallMoreOpen(false);
    setChatCallHistoryOpen(false);
    setChatCallFocus('local');
    setCallTranscript([]);
    setCallSignTelemetry({ attempts: 0, accepted: 0, uncertain: 0, unique: [], last: null });
    clearSentence?.();
    if (desktopCallWindowMode && window.signovaDesktop?.close) {
      window.signovaDesktop.close();
    }
    await statusUpdatePromise;
  }

  function formatCallTimer(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
  }

  async function startVideoSignChat(stayInChat = false) {
    if (stayInChat === true && !desktopCallWindowMode && window.signovaDesktop?.openCallWindow) {
      startConversationLog?.('video-sign-chat');
      window.signovaDesktop.openCallWindow('video');
      return;
    }
    if (selectedChatContact) activeTargetContactRef.current = selectedChatContact;
    setCallExperience('videoSignChat');
    setChatCallScreen('video');
    setChatCallMinimized(false);
    setChatCallFocus('local');
    setChatCallHistoryOpen(false);
    setChatCallMoreOpen(false);
    updateSynapseEnabled?.(true);
    const cameraStarted = await startCameraRef.current?.();
    if (!cameraStarted) {
      setSecureCallStatus?.('Camera unavailable');
      setCallStatus('Camera permission required for WebRTC');
      return;
    }
    startConversationLog?.('video-sign-chat');
    setSecureCallStatus?.('Video Sign Chat ready');
    setCallStatus('Video Sign Chat ringing — camera and sign language ready');
  }

  function startConversationInfoCall(contact, type = 'video') {
    if (!contact?.id) return;
    activeTargetContactRef.current = contact;
    setSelectedChatId?.(contact.id);
    setSelectedConversationId?.(contact.id);
    setMobileChatListOpen?.(false);
    setActivePanel?.('chats');
    if (type === 'voice') {
      setCallExperience('voiceSignChat');
      setChatCallScreen('voice');
      setMicEnabled?.(true);
      updateSynapseEnabled?.(true);
      updateSettingAndTrack?.('translation', 'outputType', 'textVoice');
      startConversationLog?.('voice-sign-chat', contact.id);
    } else {
      setCallExperience('videoSignChat');
      setChatCallScreen('video');
      updateSynapseEnabled?.(true);
      startCameraRef.current?.();
      startConversationLog?.('video-sign-chat', contact.id);
    }
    setChatCallMinimized(false);
    setChatCallFocus('local');
    setCallStatus(`${type === 'voice' ? 'Voice' : 'Video'} Sign Chat started with ${contact.name}`);
  }

  function startVoiceSignChat(stayInChat = false) {
    if (stayInChat === true && !desktopCallWindowMode && window.signovaDesktop?.openCallWindow) {
      startConversationLog?.('voice-sign-chat');
      window.signovaDesktop.openCallWindow('voice');
      return;
    }
    if (selectedChatContact) activeTargetContactRef.current = selectedChatContact;
    setCallExperience('voiceSignChat');
    setChatCallScreen('voice');
    setChatCallMinimized(false);
    setChatCallFocus('local');
    setChatCallHistoryOpen(false);
    setChatCallMoreOpen(false);
    setMicEnabled?.(true);
    updateSynapseEnabled?.(true);
    updateSettingAndTrack?.('translation', 'outputType', 'textVoice');
    startConversationLog?.('voice-sign-chat');
    setSecureCallStatus?.('Voice Sign Chat ready');
    setCallStatus('Voice Sign Chat ringing — live voice mail and voice-to-sign captions');
  }

  function switchToVideoSignChat() {
    setCallExperience('videoSignChat');
    setChatCallScreen('video');
    setChatCallFocus('local');
    updateSynapseEnabled?.(true);
    startCameraRef.current?.();
    setCallStatus('Video Sign Chat active — camera and live sign translation ready');
  }

  function attachRemoteCallVideo(node) {
    remoteVideoRef.current = node;
    if (node && remoteStreamRef.current && node.srcObject !== remoteStreamRef.current) {
      node.srcObject = remoteStreamRef.current;
      node.play?.().catch(() => {});
    }
  }

  function attachLocalTrackingVideo(node) {
    videoRef.current = node;
    if (node && streamRef.current && node.srcObject !== streamRef.current) {
      node.srcObject = streamRef.current;
      node.play?.().catch(() => {});
    }
  }

  function startChatCallMove(event) {
    if (!chatCallMinimized) return;
    if (event.target.closest('button, input, select, a')) return;
    event.preventDefault();
    event.stopPropagation();
    const card = event.currentTarget.closest('.minimizedUnifiedChatCallWindow') || event.currentTarget;
    const rect = card?.getBoundingClientRect();
    chatCallDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      x: rect?.left ?? chatCallPosition.x,
      y: rect?.top ?? chatCallPosition.y,
    };

    function moveCallCard(moveEvent) {
      const drag = chatCallDragRef.current;
      if (!drag) return;
      const width = card?.offsetWidth || (window.innerWidth <= 600 ? Math.min(320, window.innerWidth - 32) : 380);
      const height = card?.offsetHeight || (window.innerWidth <= 600 ? 210 : 220);
      setChatCallPosition({
        x: Math.max(16, Math.min(window.innerWidth - width - 16, drag.x + moveEvent.clientX - drag.startX)),
        y: Math.max(16, Math.min(window.innerHeight - height - 16, drag.y + moveEvent.clientY - drag.startY)),
      });
    }

    function stopCallCardMove() {
      chatCallDragRef.current = null;
      window.removeEventListener('pointermove', moveCallCard);
      window.removeEventListener('pointerup', stopCallCardMove);
      window.removeEventListener('pointercancel', stopCallCardMove);
    }

    window.addEventListener('pointermove', moveCallCard);
    window.addEventListener('pointerup', stopCallCardMove);
    window.addEventListener('pointercancel', stopCallCardMove);
  }

  function startMeetingMode(type = 'video') {
    if (type === 'voice') startVoiceSignChat(true);
    else startVideoSignChat(true);
    setCallExperience(type === 'voice' ? 'voiceMeeting' : 'videoMeeting');
    setSecureCallStatus?.(type === 'voice' ? 'Voice meeting room ready' : 'Video meeting room ready');
    setCallStatus(type === 'voice' ? 'Voice meeting ready · camera optional' : 'Video meeting ready · camera and signs active');
    if (type === 'voice') {
      setMicEnabled?.(true);
    }
  }

  function revealCallControls(keepOpen = false) {
    setCallControlsVisible(true);
    window.clearTimeout(callControlsTimerRef.current);
    if (!keepOpen) {
      callControlsTimerRef.current = window.setTimeout(() => {
        setCallControlsVisible(false);
      }, 3500);
    }
  }

  function toggleCallTranslation() {
    const next = !synapseEnabledRef.current;
    updateSynapseEnabled?.(next);
    sendCaptionSync({ mode: next ? settings.translation?.mode : 'off' });
  }

  return {
    // States
    callStatus,
    setCallStatus,
    callNetworkQuality,
    setCallNetworkQuality,
    incomingCall,
    setIncomingCall,
    acceptingIncomingCall,
    callExperience,
    setCallExperience,
    callElapsedSeconds,
    setCallElapsedSeconds,
    chatCallScreen,
    setChatCallScreen,
    chatCallMinimized,
    setChatCallMinimized,
    chatCallExpanded,
    setChatCallExpanded,
    chatCallInfoOpen,
    setChatCallInfoOpen,
    chatCallMoreOpen,
    setChatCallMoreOpen,
    callControlsVisible,
    setCallControlsVisible,
    chatCallSettingsTab,
    setChatCallSettingsTab,
    chatCallHistoryOpen,
    setChatCallHistoryOpen,
    chatCallFocus,
    setChatCallFocus,
    chatCallPosition,
    setChatCallPosition,
    remoteMediaTrackKinds,
    setRemoteMediaTrackKinds,
    remoteMediaState,
    setRemoteMediaState,
    remoteCaption,
    setRemoteCaption,
    captionChannelStatus,
    setCaptionChannelStatus,
    callTranscript,
    setCallTranscript,
    callSignTelemetry,
    setCallSignTelemetry,
    apiConnectionRetryKey,
    // Refs
    remoteStreamRef,
    captionChannelRef,
    activeCallRoomIdRef,
    chatCallScreenRef,
    peerRefs,
    callSignalingUnsubscribersRef,
    // Handlers
    startVideoSignChat,
    startVoiceSignChat,
    switchToVideoSignChat,
    startConversationInfoCall,
    endCallSession,
    acceptIncomingCall,
    rejectIncomingCall,
    formatCallTimer,
    startChatCallMove,
    attachRemoteCallVideo,
    attachLocalTrackingVideo,
    startMeetingMode,
    revealCallControls,
    toggleCallTranslation,
    retryServiceConnection,
    sendCaptionSync,
    startWebRtcPreview,
    resetWebRtcPreview,
    handleRemoteTerminalCall,
    getCallIceConfiguration,
  };
}

