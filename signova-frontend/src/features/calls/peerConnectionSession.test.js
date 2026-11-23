import { createPeerConnectionSession } from './peerConnectionSession';

class FakePeerConnection {
  constructor(configuration) {
    this.configuration = configuration;
    this.connectionState = 'new';
    this.addedTracks = [];
    this.addedCandidates = [];
  }

  addTrack(track, stream) { this.addedTracks.push({ track, stream }); }

  addIceCandidate(candidate) { this.addedCandidates.push(candidate); return Promise.resolve(); }

  createDataChannel(label, options) {
    this.createdChannel = { label, options };
    return this.createdChannel;
  }
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

test('wires configuration, local tracks, caller channel, and remote candidate subscription', async () => {
  const video = { kind: 'video' };
  const audio = { kind: 'audio' };
  const stream = { getTracks: () => [video, audio] };
  let emitRemoteCandidate;
  const unsubscribe = jest.fn();
  const onDataChannel = jest.fn();
  const onLocalCandidate = jest.fn();

  const session = createPeerConnectionSession({
    PeerConnection: FakePeerConnection,
    iceServers: [{ urls: 'stun:example.test' }],
    iceTransportPolicy: 'relay',
    localStream: stream,
    caller: true,
    onLocalCandidate,
    onDataChannel,
    subscribeRemoteCandidates: (onCandidate) => {
      emitRemoteCandidate = onCandidate;
      return unsubscribe;
    },
  });

  expect(session.peer.configuration).toEqual({
    iceServers: [{ urls: 'stun:example.test' }],
    iceTransportPolicy: 'relay',
  });
  expect(session.peer.addedTracks).toEqual([{ track: video, stream }, { track: audio, stream }]);
  expect(onDataChannel).toHaveBeenCalledWith({ label: 'signova-caption-sync', options: { ordered: true } }, 'local');

  const localCandidate = { candidate: 'local' };
  session.peer.onicecandidate({ candidate: localCandidate });
  expect(onLocalCandidate).toHaveBeenCalledWith(localCandidate);
  emitRemoteCandidate({ candidate: 'remote' });
  await flushPromises();
  expect(session.peer.addedCandidates).toEqual([{ candidate: 'remote' }]);
  session.unsubscribeCandidates();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

test('forwards remote streams, remote channels, and connection states', () => {
  const onRemoteStream = jest.fn();
  const onDataChannel = jest.fn();
  const onConnectionStateChange = jest.fn();
  const { peer } = createPeerConnectionSession({
    PeerConnection: FakePeerConnection,
    localStream: { getTracks: () => [] },
    onLocalCandidate: jest.fn(),
    onRemoteStream,
    onDataChannel,
    onConnectionStateChange,
    subscribeRemoteCandidates: () => jest.fn(),
  });
  const remoteStream = { id: 'remote' };
  const channel = { label: 'signova-caption-sync' };
  peer.ontrack({ streams: [remoteStream] });
  peer.ondatachannel({ channel });
  peer.connectionState = 'connected';
  peer.onconnectionstatechange();

  expect(onRemoteStream).toHaveBeenCalledWith(remoteStream, { streams: [remoteStream] });
  expect(onDataChannel).toHaveBeenCalledWith(channel, 'remote');
  expect(onConnectionStateChange).toHaveBeenCalledWith('connected', peer);

  peer.iceConnectionState = 'disconnected';
  peer.oniceconnectionstatechange();
  expect(onConnectionStateChange).toHaveBeenCalledWith('disconnected', peer);
});

test('reports async candidate failures without leaking unhandled rejections', async () => {
  const localError = new Error('publish failed');
  const remoteError = new Error('candidate failed');
  const onLocalCandidateError = jest.fn();
  const onRemoteCandidateError = jest.fn();
  let emitRemoteCandidate;
  const { peer } = createPeerConnectionSession({
    PeerConnection: class extends FakePeerConnection {
      addIceCandidate() { return Promise.reject(remoteError); }
    },
    localStream: { getTracks: () => [] },
    onLocalCandidate: () => Promise.reject(localError),
    onLocalCandidateError,
    onRemoteCandidateError,
    subscribeRemoteCandidates: (onCandidate) => { emitRemoteCandidate = onCandidate; },
  });
  peer.onicecandidate({ candidate: { candidate: 'local' } });
  emitRemoteCandidate({ candidate: 'remote' });
  await flushPromises();
  expect(onLocalCandidateError).toHaveBeenCalledWith(localError);
  expect(onRemoteCandidateError).toHaveBeenCalledWith(remoteError);
});

test('rejects incomplete session dependencies before creating a peer', () => {
  expect(() => createPeerConnectionSession({
    PeerConnection: FakePeerConnection,
    onLocalCandidate: jest.fn(),
    subscribeRemoteCandidates: jest.fn(),
  })).toThrow('A local media stream is required');
});
