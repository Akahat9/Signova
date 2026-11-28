function requireFunction(value, name) {
  if (typeof value !== 'function') throw new Error(`${name} is required`);
  return value;
}

export function createPeerConnectionSession({
  PeerConnection,
  iceServers = [],
  iceTransportPolicy = 'all',
  localStream,
  caller = false,
  dataChannelLabel = 'signova-caption-sync',
  onLocalCandidate,
  onLocalCandidateError = () => undefined,
  onRemoteStream = () => undefined,
  onDataChannel = () => undefined,
  onConnectionStateChange = () => undefined,
  onIceConnectionStateChange = () => undefined,
  subscribeRemoteCandidates,
  onRemoteCandidateError = () => undefined,
  onCandidateSubscriptionError = () => undefined,
} = {}) {
  const Peer = requireFunction(PeerConnection, 'PeerConnection');
  const publishCandidate = requireFunction(onLocalCandidate, 'onLocalCandidate');
  const subscribeCandidates = requireFunction(subscribeRemoteCandidates, 'subscribeRemoteCandidates');
  if (!localStream?.getTracks) throw new Error('A local media stream is required');

  const peer = new Peer({ iceServers, iceTransportPolicy });
  peer.onicecandidate = ({ candidate } = {}) => {
    if (!candidate) return;
    Promise.resolve(publishCandidate(candidate)).catch(onLocalCandidateError);
  };
  peer.ontrack = (event = {}) => {
    const remoteStream = event.streams?.[0];
    if (remoteStream) onRemoteStream(remoteStream, event);
  };
  peer.ondatachannel = ({ channel } = {}) => {
    if (channel) onDataChannel(channel, 'remote');
  };
  peer.onconnectionstatechange = () => onConnectionStateChange(peer.connectionState, peer);
  peer.oniceconnectionstatechange = () => {
    onIceConnectionStateChange(peer.iceConnectionState, peer);
    if (!peer.connectionState || peer.connectionState === 'connected') {
      if (peer.iceConnectionState === 'disconnected' || peer.iceConnectionState === 'failed') {
        onConnectionStateChange(peer.iceConnectionState, peer);
      }
    }
  };

  localStream.getTracks().forEach((track) => {
    const sender = peer.addTrack(track, localStream);
    if (track.kind === 'video' && typeof sender?.getParameters === 'function' && typeof sender?.setParameters === 'function') {
      try {
        const params = sender.getParameters() || {};
        const encodings = Array.isArray(params.encodings) && params.encodings.length ? params.encodings : [{}];
        params.encodings = encodings.map((encoding) => ({
          ...encoding,
          maxFramerate: 60,
          maxBitrate: Math.max(Number(encoding.maxBitrate || 0), 2_500_000),
        }));
        Promise.resolve(sender.setParameters(params)).catch(() => undefined);
      } catch {
        // Browser does not allow modifying sender encoding parameters
      }
    }
  });
  if (caller) onDataChannel(peer.createDataChannel(dataChannelLabel, { ordered: true }), 'local');

  const unsubscribeCandidates = subscribeCandidates(
    (candidate) => Promise.resolve(peer.addIceCandidate(candidate)).catch(onRemoteCandidateError),
    onCandidateSubscriptionError,
  );

  return {
    peer,
    unsubscribeCandidates: typeof unsubscribeCandidates === 'function'
      ? unsubscribeCandidates
      : () => undefined,
  };
}
