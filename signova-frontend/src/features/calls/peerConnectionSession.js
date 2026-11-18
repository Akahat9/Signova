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

  localStream.getTracks().forEach((track) => peer.addTrack(track, localStream));
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
