import 'dart:async';
import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:hand_detection/hand_detection_native.dart';

import '../data/on_device_recognizer.dart';
import '../domain/sequence_preprocessing.dart';

class TranslationScreen extends StatefulWidget {
  const TranslationScreen({super.key, required this.active});
  final bool active;

  @override
  State<TranslationScreen> createState() => _TranslationScreenState();
}

class _TranslationScreenState extends State<TranslationScreen> with WidgetsBindingObserver {
  final _recognizer = OnDeviceRecognizer();
  CameraController? _camera;
  HandDetector? _detector;
  String _language = 'ISL';
  String _message = 'Camera inference runs locally on this device.';
  SignPrediction? _prediction;
  bool _loading = false;
  bool _processingFrame = false;
  int _frameCount = 0;
  int _lastLandmarkMs = 0;
  DateTime _lastInference = DateTime.fromMillisecondsSinceEpoch(0);
  List<double>? _previousFeatures;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didUpdateWidget(covariant TranslationScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.active && !widget.active) unawaited(_stopCamera());
  }

  Future<void> _startCamera() async {
    if (_loading || _camera != null) return;
    setState(() {
      _loading = true;
      _message = 'Checking camera and model availability…';
    });
    try {
      await _recognizer.load(_language == 'ISL' ? 'isl' : 'asl');
      final cameras = await availableCameras();
      if (cameras.isEmpty) throw CameraException('no-camera', 'No camera is available on this device.');
      final detector = await HandDetector.create(useCompiledModel: true, accelerators: {Accelerator.gpu, Accelerator.cpu});
      final camera = CameraController(cameras.first, ResolutionPreset.medium, enableAudio: false, imageFormatGroup: ImageFormatGroup.yuv420);
      await camera.initialize();
      _detector = detector;
      _camera = camera;
      await camera.startImageStream(_onImage);
      if (mounted) setState(() => _message = 'Ready. Camera frames stay on this device.');
    } catch (error) {
      await _camera?.dispose();
      _camera = null;
      await _detector?.dispose();
      _detector = null;
      if (mounted) setState(() => _message = 'Camera or model unavailable: $error');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _onImage(CameraImage image) async {
    final detector = _detector;
    if (_processingFrame || detector == null) return;
    _processingFrame = true;
    final timer = Stopwatch()..start();
    try {
      final camera = _camera;
      final rotation = camera == null
          ? null
          : rotationForFrame(
              width: image.width,
              height: image.height,
              sensorOrientation: camera.description.sensorOrientation,
              isFrontCamera: camera.description.lensDirection == CameraLensDirection.front,
              deviceOrientation: camera.value.deviceOrientation,
            );
      final hands = await detector.detectFromCameraImage(image, rotation: rotation, maxDim: 640);
      timer.stop();
      _lastLandmarkMs = timer.elapsedMilliseconds;
      final normalize = _recognizer.featureNormalization == 'wrist_centered_scale_normalized';
      final current = sequenceFrameFeatures(
        hands.map((hand) {
          final width = math.max(1, hand.imageWidth).toDouble();
          final height = math.max(1, hand.imageHeight).toDouble();
          return hand.landmarks.map((point) => normalizeImageLandmark(
                point.x,
                point.y,
                point.z,
                width.toInt(),
                height.toInt(),
              )).toList();
        }).toList(),
        wristCenteredScaleNormalized: normalize,
      );
      final smoothed = smoothSequenceFrame(current, _previousFeatures);
      _previousFeatures = smoothed;
      _recognizer.addFrame(smoothed);
      _frameCount++;
      final now = DateTime.now();
      // Adaptive sample: keep inference under about 4 Hz so slower phones can
      // continue previewing without building up a queue of stale frames.
      if (_frameCount % 3 == 0 && now.difference(_lastInference).inMilliseconds >= 220) {
        _lastInference = now;
        final prediction = await _recognizer.predict();
        if (mounted && prediction != null) setState(() => _prediction = prediction);
      }
    } catch (error) {
      if (mounted) setState(() => _message = 'Local recognition paused: $error');
    } finally {
      _processingFrame = false;
    }
  }

  Future<void> _stopCamera() async {
    final camera = _camera;
    _camera = null;
    if (camera != null) {
      if (camera.value.isStreamingImages) await camera.stopImageStream();
      await camera.dispose();
    }
    await _detector?.dispose();
    _detector = null;
    _previousFeatures = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive || state == AppLifecycleState.paused || state == AppLifecycleState.detached) {
      unawaited(_stopCamera());
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_stopCamera());
    unawaited(_recognizer.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Sign translation', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 8),
          const Text('Your camera and recognition data stay on this device.'),
          const SizedBox(height: 14),
          SegmentedButton<String>(
            segments: const [ButtonSegment(value: 'ISL', label: Text('ISL')), ButtonSegment(value: 'ASL', label: Text('ASL'))],
            selected: {_language},
            onSelectionChanged: _camera == null ? (selection) => setState(() { _language = selection.first; _prediction = null; }) : null,
          ),
          const SizedBox(height: 14),
          AspectRatio(
            aspectRatio: 3 / 4,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: _camera?.value.isInitialized == true
                  ? CameraPreview(_camera!)
                  : Container(color: const Color(0xff17243a), child: const Center(child: Icon(Icons.camera_alt_outlined, color: Colors.white70, size: 56))),
            ),
          ),
          const SizedBox(height: 12),
          if (_camera == null)
            FilledButton.icon(onPressed: _loading ? null : _startCamera, icon: const Icon(Icons.camera_alt), label: Text(_loading ? 'Starting…' : 'Start camera'))
          else
            OutlinedButton.icon(onPressed: _stopCamera, icon: const Icon(Icons.stop), label: const Text('Stop camera')),
          const SizedBox(height: 10),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  _prediction == null
                      ? 'Waiting for a sign'
                      : (_prediction!.confidence < 0.55 || _prediction!.confidenceMargin < 0.12 ? 'Unclear sign' : _prediction!.label.replaceAll('_', ' ')),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                if (_prediction != null) Text('Confidence ${(100 * _prediction!.confidence).toStringAsFixed(1)}%'),
                if (_camera != null && _recognizer.modelVersion != null)
                  Text('Local inference ${_prediction?.inferenceMs ?? 0} ms · landmarks $_lastLandmarkMs ms · model ${_recognizer.modelVersion!.substring(0, 8)}'),
                const SizedBox(height: 4),
                Text(_message),
              ]),
            ),
          ),
        ],
      );
}
