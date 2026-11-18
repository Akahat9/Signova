import 'dart:async';
import 'dart:convert';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:http/http.dart' as http;

class CallCoordinator {
  CallCoordinator({required this.onState, required this.onRemoteStream});

  static const _apiBase = String.fromEnvironment('SIGNOVA_API_BASE_URL');
  final void Function(String state) onState;
  final void Function(MediaStream? stream) onRemoteStream;
  final _db = FirebaseFirestore.instance;
  final _auth = FirebaseAuth.instance;
  DocumentReference<Map<String, dynamic>>? _room;
  RTCPeerConnection? _peer;
  MediaStream? _local;
  StreamSubscription<DocumentSnapshot<Map<String, dynamic>>>? _roomSub;
  StreamSubscription<QuerySnapshot<Map<String, dynamic>>>? _candidateSub;
  bool _caller = false;
  bool _closing = false;
  bool _remoteDescriptionSet = false;

  Future<List<Map<String, dynamic>>> _iceServers() async {
    final user = _auth.currentUser;
    if (user == null) throw StateError('Sign in to start a call.');
    if (_apiBase.isEmpty) throw StateError('SIGNOVA_API_BASE_URL must point to the Signova backend.');
    final token = await user.getIdToken();
    final response = await http.get(
      Uri.parse('$_apiBase/api/calls/ice-config'),
      headers: {'Authorization': 'Bearer $token'},
    );
    if (response.statusCode != 200) throw StateError('Could not get secure call network settings (${response.statusCode}).');
    final payload = jsonDecode(response.body) as Map<String, dynamic>;
    final servers = (payload['iceServers'] as List<dynamic>? ?? const []).cast<Map<String, dynamic>>();
    if (servers.isEmpty) throw StateError('No ICE servers are configured.');
    return servers;
  }

  Future<MediaStream> _capture({required bool video}) => navigator.mediaDevices.getUserMedia({
        'audio': true,
        'video': video ? {'facingMode': 'user'} : false,
      });

  Future<void> startOutgoing({required String recipientUid, required bool video, bool relayOnly = false}) async {
    final user = _auth.currentUser;
    if (user == null) throw StateError('Sign in to start a call.');
    final callee = recipientUid.trim();
    if (callee.isEmpty || callee == user.uid) throw ArgumentError('Enter another Signova user ID.');
    _caller = true;
    _room = _db.collection('callRooms').doc();
    final now = DateTime.now().millisecondsSinceEpoch;
    await _room!.set({
      'callerUid': user.uid,
      'calleeUid': callee,
      'participantUids': [user.uid, callee],
      'mediaType': video ? 'video' : 'voice',
      'status': 'ringing',
      'createdAt': FieldValue.serverTimestamp(),
      'updatedAt': FieldValue.serverTimestamp(),
      'expiresAtMillis': now + const Duration(minutes: 2).inMilliseconds,
    });
    await _connect(video: video, relayOnly: relayOnly);
    final offer = await _peer!.createOffer({'offerToReceiveAudio': true, 'offerToReceiveVideo': video});
    await _peer!.setLocalDescription(offer);
    await _room!.update({'offer': offer.toMap(), 'status': 'connecting', 'updatedAt': FieldValue.serverTimestamp()});
    onState('Calling…');
    _listenToRoom();
  }

  Future<void> acceptIncoming({required String roomId, bool relayOnly = false}) async {
    final user = _auth.currentUser;
    if (user == null) throw StateError('Sign in to accept a call.');
    _caller = false;
    _room = _db.collection('callRooms').doc(roomId);
    final snapshot = await _room!.get();
    final room = snapshot.data();
    if (!snapshot.exists || room == null || room['calleeUid'] != user.uid || room['status'] != 'connecting') {
      throw StateError('This call is no longer available.');
    }
    await _connect(video: room['mediaType'] == 'video', relayOnly: relayOnly);
    await _peer!.setRemoteDescription(_description(room['offer'] as Map<String, dynamic>));
    _remoteDescriptionSet = true;
    final answer = await _peer!.createAnswer({'offerToReceiveAudio': true, 'offerToReceiveVideo': room['mediaType'] == 'video'});
    await _peer!.setLocalDescription(answer);
    await _room!.update({'answer': answer.toMap(), 'status': 'connected', 'updatedAt': FieldValue.serverTimestamp()});
    _listenToRoom();
    onState('Connecting…');
  }

  RTCSessionDescription _description(Map<String, dynamic> map) => RTCSessionDescription(map['sdp'] as String?, map['type'] as String?);

  Future<void> _connect({required bool video, required bool relayOnly}) async {
    final iceServers = await _iceServers();
    _local = await _capture(video: video);
    final peer = await createPeerConnection({
      'iceServers': iceServers,
      'iceTransportPolicy': relayOnly ? 'relay' : 'all',
      'sdpSemantics': 'unified-plan',
    });
    _peer = peer;
    for (final track in _local!.getTracks()) {
      await peer.addTrack(track, _local!);
    }
    peer.onIceCandidate = (candidate) {
      if (candidate.candidate == null || _room == null) return;
      _room!.collection('candidates').add({
        'ownerUid': _auth.currentUser!.uid,
        'candidate': candidate.candidate,
        'sdpMid': candidate.sdpMid,
        'sdpMLineIndex': candidate.sdpMLineIndex,
        'createdAt': FieldValue.serverTimestamp(),
      });
    };
    peer.onTrack = (event) {
      if (event.streams.isNotEmpty) onRemoteStream(event.streams.first);
    };
    peer.onConnectionState = (state) {
      switch (state) {
        case RTCPeerConnectionState.RTCPeerConnectionStateConnected:
          onState('Connected');
          break;
        case RTCPeerConnectionState.RTCPeerConnectionStateDisconnected:
        case RTCPeerConnectionState.RTCPeerConnectionStateFailed:
          onState('Connection interrupted. Reconnecting…');
          break;
        case RTCPeerConnectionState.RTCPeerConnectionStateClosed:
          onState('Call ended');
          break;
        default:
          onState('Connecting…');
      }
    };
    _candidateSub = _room!.collection('candidates').snapshots().listen((snapshot) {
      for (final change in snapshot.docChanges) {
        if (change.type != DocumentChangeType.added || change.doc.data()?['ownerUid'] == _auth.currentUser?.uid) continue;
        final data = change.doc.data()!;
        unawaited(peer.addCandidate(RTCIceCandidate(data['candidate'] as String?, data['sdpMid'] as String?, data['sdpMLineIndex'] as int?)));
      }
    });
  }

  void _listenToRoom() {
    _roomSub?.cancel();
    _roomSub = _room!.snapshots().listen((snapshot) async {
      final data = snapshot.data();
      if (data == null || _closing) return;
      if (_caller && data['answer'] is Map<String, dynamic> && !_remoteDescriptionSet) {
        await _peer?.setRemoteDescription(_description(data['answer'] as Map<String, dynamic>));
        _remoteDescriptionSet = true;
      }
      if (data['status'] == 'rejected') onState('Call declined');
      if (data['status'] == 'ended' || data['status'] == 'failed') onState('Call ended');
    });
  }

  MediaStream? get localStream => _local;
  String? get roomId => _room?.id;

  Future<void> end() async {
    if (_closing) return;
    _closing = true;
    try {
      if (_room != null) await _room!.update({'status': 'ended', 'updatedAt': FieldValue.serverTimestamp()});
    } catch (_) {
      // The room may have expired or network may be unavailable; local media
      // still must be released immediately.
    }
    await _candidateSub?.cancel();
    await _roomSub?.cancel();
    await _peer?.close();
    for (final track in _local?.getTracks() ?? <MediaStreamTrack>[]) {
      await track.stop();
    }
    await _local?.dispose();
    _candidateSub = null;
    _roomSub = null;
    _peer = null;
    _local = null;
    _room = null;
    _remoteDescriptionSet = false;
    onRemoteStream(null);
    _closing = false;
  }
}
