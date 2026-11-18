import 'dart:math' as math;

/// Converts image-space MediaPipe landmarks to the normalized coordinates used
/// by the Python sequence dataset. z shares the image-width scale.
List<double> normalizeImageLandmark(double x, double y, double z, int width, int height) {
  if (width <= 0 || height <= 0) throw ArgumentError('Image dimensions must be positive.');
  return [x / width, y / height, z / width];
}

/// Matches ai-service/Models/predict.py points_to_xyz + frame_to_feature_vector.
List<double> sequenceFrameFeatures(
  List<List<List<double>>> hands, {
  required bool wristCenteredScaleNormalized,
}) {
  final output = List<double>.filled(126, 0);
  for (var handIndex = 0; handIndex < math.min(2, hands.length); handIndex++) {
    final source = hands[handIndex];
    final points = List.generate(21, (index) {
      final point = index < source.length ? source[index] : const <double>[];
      return <double>[
        point.isNotEmpty ? point[0] : 0,
        point.length > 1 ? point[1] : 0,
        point.length > 2 ? point[2] : 0,
      ];
    });
    if (wristCenteredScaleNormalized) {
      final nonzeroXY = points.fold<int>(0, (count, point) => count + (point[0].abs() > 1e-7 ? 1 : 0) + (point[1].abs() > 1e-7 ? 1 : 0));
      if (nonzeroXY >= 6) {
        final wrist = List<double>.from(points.first);
        for (final point in points) {
          for (var axis = 0; axis < 3; axis++) {
            point[axis] -= wrist[axis];
          }
        }
        final maxXY = points.map((point) => math.sqrt(point[0] * point[0] + point[1] * point[1])).fold<double>(0, (a, b) => math.max(a, b).toDouble());
        final maxZ = points.map((point) => point[2].abs()).fold<double>(0, (a, b) => math.max(a, b).toDouble());
        final scale = math.max(math.max(maxXY, maxZ), 1e-6).toDouble();
        for (final point in points) {
          for (var axis = 0; axis < 3; axis++) {
            point[axis] /= scale;
          }
        }
      }
    }
    for (var point = 0; point < 21; point++) {
      for (var axis = 0; axis < 3; axis++) {
        output[handIndex * 63 + point * 3 + axis] = points[point][axis];
      }
    }
  }
  return output;
}

/// Mirrors predict.py smooth_feature_vectors(alpha=0.62), including carried
/// coordinates when MediaPipe returns an absent hand as zeros.
List<double> smoothSequenceFrame(List<double> current, List<double>? previous) {
  if (current.length != 126) throw ArgumentError.value(current.length, 'current', 'Expected a 126-feature frame.');
  if (previous == null) return List<double>.from(current);
  if (previous.length != 126) throw ArgumentError.value(previous.length, 'previous', 'Expected a 126-feature frame.');
  return List<double>.generate(current.length, (index) {
    final value = current[index].abs() > 1e-7 ? current[index] : previous[index];
    return 0.62 * value + 0.38 * previous[index];
  });
}

/// Mirrors normalize_sequence: repeat the final frame when shorter than 40.
List<double> fixedLengthSequence(List<List<double>> frames, {int length = 40}) {
  if (frames.isEmpty) throw ArgumentError('At least one frame is required.');
  if (frames.any((frame) => frame.length != 126)) throw ArgumentError('Every frame must contain 126 features.');
  final selected = frames.length <= length ? frames : List.generate(length, (index) => frames[((frames.length - 1) * index / (length - 1)).round()]);
  final result = <double>[];
  for (var index = 0; index < length; index++) {
    result.addAll(selected[index < selected.length ? index : selected.length - 1]);
  }
  return result;
}
