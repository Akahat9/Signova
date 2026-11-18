import 'package:flutter_test/flutter_test.dart';
import 'package:signova_flutter/features/translation/domain/sequence_preprocessing.dart';

void main() {
  test('camera landmarks are normalized to the training image coordinate range', () {
    expect(normalizeImageLandmark(320, 240, 32, 640, 480), [0.5, 0.5, 0.05]);
  });

  test('feature vector preserves MediaPipe hand order and pads the second hand', () {
    final points = List.generate(21, (index) => <double>[index / 21, index / 42, -index / 84]);
    final vector = sequenceFrameFeatures([points], wristCenteredScaleNormalized: false);
    expect(vector, hasLength(126));
    expect(vector[0], 0);
    expect(vector[3], closeTo(1 / 21, 1e-9));
    expect(vector[63], 0);
    expect(vector[125], 0);
  });

  test('wrist-centered normalization matches the Python preprocessing shape and scale', () {
    final points = List.generate(21, (index) => <double>[0.5 + index / 40, 0.4 + index / 80, index / 200]);
    final vector = sequenceFrameFeatures([points], wristCenteredScaleNormalized: true);
    expect(vector[0], 0);
    expect(vector[1], 0);
    expect(vector[2], 0);
    expect(vector[60], closeTo(0.89442719, 1e-7));
  });

  test('smoothing and fixed sequence padding follow the Python reference rules', () {
    final first = List<double>.filled(126, 0)..[0] = 1;
    final second = List<double>.filled(126, 0);
    final smoothed = smoothSequenceFrame(second, first);
    expect(smoothed[0], closeTo(1, 1e-9));
    final sequence = fixedLengthSequence([first, second]);
    expect(sequence, hasLength(40 * 126));
    expect(sequence[0], 1);
    expect(sequence[126], 0);
    expect(sequence[39 * 126], 0);
  });
}
