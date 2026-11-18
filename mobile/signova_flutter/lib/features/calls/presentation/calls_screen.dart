import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

import '../data/call_coordinator.dart';

class CallsScreen extends StatefulWidget {
  const CallsScreen({super.key});

  @override
  State<CallsScreen> createState() => _CallsScreenState();
}

class _CallsScreenState extends State<CallsScreen> {
  final _recipient = TextEditingController();
  final _localRenderer = RTCVideoRenderer();
  final _remoteRenderer = RTCVideoRenderer();
  CallCoordinator? _call;
  MediaStream? _remoteStream;
  String _status = 'Calls use end-to-end WebRTC media transport.';
  bool _busy = false;
  bool _active = false;
  bool _relayOnly = false;

  @override
  void initState() {
    super.initState();
    unawaited(_localRenderer.initialize());
    unawaited(_remoteRenderer.initialize());
  }

  CallCoordinator _coordinator() => CallCoordinator(
        onState: (value) {
          if (mounted) setState(() => _status = value);
        },
        onRemoteStream: (stream) {
          _remoteStream = stream;
          _remoteRenderer.srcObject = stream;
          if (mounted) setState(() {});
        },
      );

  Future<void> _start({required bool video}) async {
    if (_busy) {
      return;
    }
    setState(() {
      _busy = true;
      _status = 'Requesting camera and microphone…';
    });
    final call = _coordinator();
    _call = call;
    try {
      await call.startOutgoing(recipientUid: _recipient.text, video: video, relayOnly: _relayOnly);
      _localRenderer.srcObject = call.localStream;
      setState(() => _active = true);
    } catch (error) {
      await call.end();
      if (mounted) setState(() => _status = 'Could not start the call: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _accept(String roomId) async {
    if (_busy) {
      return;
    }
    setState(() {
      _busy = true;
      _status = 'Connecting to call…';
    });
    final call = _coordinator();
    _call = call;
    try {
      await call.acceptIncoming(roomId: roomId, relayOnly: _relayOnly);
      _localRenderer.srcObject = call.localStream;
      setState(() => _active = true);
    } catch (error) {
      await call.end();
      if (mounted) setState(() => _status = 'Could not join the call: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _end() async {
    final call = _call;
    _call = null;
    await call?.end();
    _localRenderer.srcObject = null;
    _remoteRenderer.srcObject = null;
    if (mounted) {
      setState(() {
        _active = false;
        _status = 'Call ended. Camera and microphone are off.';
      });
    }
  }

  @override
  void dispose() {
    _recipient.dispose();
    unawaited(_call?.end());
    unawaited(_localRenderer.dispose());
    unawaited(_remoteRenderer.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final uid = FirebaseAuth.instance.currentUser?.uid;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('One-to-one calls', style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text(_status),
        if (!_active) ...[
          const SizedBox(height: 16),
          TextField(controller: _recipient, decoration: const InputDecoration(labelText: 'Recipient Signova user ID', border: OutlineInputBorder()), textInputAction: TextInputAction.done),
          const SizedBox(height: 8),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: _relayOnly,
            onChanged: (value) => setState(() => _relayOnly = value),
            title: const Text('Relay-only network test'),
            subtitle: const Text('Use this during staged TURN testing.'),
          ),
          Row(children: [
            Expanded(child: FilledButton.icon(onPressed: _busy ? null : () => _start(video: true), icon: const Icon(Icons.video_call), label: const Text('Video call'))),
            const SizedBox(width: 10),
            Expanded(child: OutlinedButton.icon(onPressed: _busy ? null : () => _start(video: false), icon: const Icon(Icons.call), label: const Text('Voice call'))),
          ]),
          if (uid != null) ...[
            const SizedBox(height: 22),
            Text('Incoming calls', style: Theme.of(context).textTheme.titleMedium),
            StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
              stream: FirebaseFirestore.instance.collection('callRooms').where('calleeUid', isEqualTo: uid).snapshots(),
              builder: (context, snapshot) {
                if (snapshot.hasError) return const ListTile(title: Text('Incoming calls are unavailable.'));
                final rooms = (snapshot.data?.docs ?? const []).where((doc) {
                  final data = doc.data();
                  return data['status'] == 'connecting' && (data['expiresAtMillis'] as int? ?? 0) > DateTime.now().millisecondsSinceEpoch;
                }).toList();
                if (rooms.isEmpty) return const ListTile(title: Text('No incoming calls'));
                return Column(children: [for (final room in rooms) Card(child: ListTile(
                  leading: Icon(room.data()['mediaType'] == 'video' ? Icons.video_call : Icons.call),
                  title: Text('Incoming ${room.data()['mediaType'] == 'video' ? 'video' : 'voice'} call'),
                  subtitle: const Text('Signova contact'),
                  trailing: FilledButton(onPressed: _busy ? null : () => _accept(room.id), child: const Text('Accept')),
                ))]);
              },
            ),
          ],
        ] else ...[
          const SizedBox(height: 14),
          AspectRatio(
            aspectRatio: 3 / 4,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: _remoteStream == null ? Container(color: const Color(0xff17243a), child: const Center(child: Text('Waiting for the other person…', style: TextStyle(color: Colors.white)))) : RTCVideoView(_remoteRenderer, objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover),
            ),
          ),
          const SizedBox(height: 12),
          if (_localRenderer.srcObject != null)
            SizedBox(height: 150, child: ClipRRect(borderRadius: BorderRadius.circular(16), child: RTCVideoView(_localRenderer, mirror: true, objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitCover))),
          const SizedBox(height: 12),
          FilledButton.icon(onPressed: _end, icon: const Icon(Icons.call_end), label: const Text('End call')),
        ],
      ],
    );
  }
}
