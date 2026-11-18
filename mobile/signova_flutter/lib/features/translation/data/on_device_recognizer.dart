import 'dart:convert';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter/services.dart';
import 'package:flutter_onnxruntime/flutter_onnxruntime.dart';

import '../domain/sequence_preprocessing.dart';

class SignPrediction {
  const SignPrediction(this.label, this.confidence, this.confidenceMargin, this.inferenceMs);
  final String label;
  final double confidence;
  final double confidenceMargin;
  final int inferenceMs;
}

class OnDeviceRecognizer {
  static const sequenceLength = 40;
  static const featureSize = 126;
  final OnnxRuntime _runtime = OnnxRuntime();
  final List<List<double>> _frames = [];
  OrtSession? _session;
  List<String> _classes = const [];
  String? _task;
  String? featureNormalization;
  String? modelVersion;
  int lastInferenceMs = 0;

  Future<void> load(String task) async {
    if (_task == task && _session != null) return;
    await disposeModel();
    final manifest = jsonDecode(await rootBundle.loadString('assets/models/$task.manifest.json')) as Map<String, dynamic>;
    final classes = (manifest['classes'] as List<dynamic>).cast<String>();
    if (manifest['sequenceLength'] != sequenceLength || manifest['featureSize'] != featureSize || classes.isEmpty) {
      throw StateError('The $task model manifest does not match the mobile preprocessing contract.');
    }
    final modelAsset = await rootBundle.load('assets/models/$task.onnx');
    final modelBytes = modelAsset.buffer.asUint8List(modelAsset.offsetInBytes, modelAsset.lengthInBytes);
    final actualHash = sha256.convert(modelBytes).toString();
    if (actualHash != manifest['onnxSha256']) throw StateError('The $task ONNX checksum does not match its manifest.');
    _session = await _runtime.createSessionFromAsset('assets/models/$task.onnx');
    _classes = classes;
    _task = task;
    featureNormalization = manifest['featureNormalization'] as String?;
    modelVersion = actualHash;
    _frames.clear();
  }

  void addFrame(List<double> features) {
    if (features.length != featureSize) throw ArgumentError.value(features.length, 'features', 'Expected 126 features.');
    _frames.add(List<double>.unmodifiable(features));
    if (_frames.length > sequenceLength) _frames.removeAt(0);
  }

  Future<SignPrediction?> predict() async {
    final session = _session;
    if (session == null || _frames.length < 8) return null;
    final sequence = fixedLengthSequence(_frames, length: sequenceLength);
    final input = await OrtValue.fromList(Float32List.fromList(sequence), [1, sequenceLength, featureSize]);
    Map<String, OrtValue>? result;
    final timer = Stopwatch()..start();
    try {
      result = await session.run({'input': input});
      final output = result['logits'];
      if (output == null) throw StateError('The ONNX export is missing the logits output.');
      final logits = (await output.asFlattenedList()).map((value) => (value as num).toDouble()).toList();
      if (logits.length != _classes.length) throw StateError('The model output and class map lengths do not match.');
      var best = 0;
      for (var index = 1; index < logits.length; index++) {
        if (logits[index] > logits[best]) best = index;
      }
      final probabilities = logits.map((value) => math.exp(value - logits[best])).toList();
      final expSum = probabilities.fold<double>(0, (sum, value) => sum + value);
      final confidence = probabilities[best] / expSum;
      final second = probabilities.asMap().entries.where((entry) => entry.key != best).map((entry) => entry.value / expSum).fold<double>(0, (a, b) => math.max(a, b).toDouble());
      timer.stop();
      lastInferenceMs = timer.elapsedMilliseconds;
      return SignPrediction(_classes[best], confidence, confidence - second, lastInferenceMs);
    } finally {
      await input.dispose();
      for (final value in result?.values ?? const <OrtValue>[]) {
        await value.dispose();
      }
    }
  }

  Future<void> disposeModel() async {
    await _session?.close();
    _session = null;
    _classes = const [];
    _task = null;
    featureNormalization = null;
    modelVersion = null;
  }

  Future<void> dispose() async => disposeModel();
}
