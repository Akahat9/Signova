import {
  extract165DVector,
  createMultimodalTemporalBuffer,
  MULTIMODAL_FEATURE_SIZE,
  HAND_FEATURE_SIZE,
  BODY_FEATURE_SIZE,
  EXPRESSION_FEATURE_SIZE,
} from './holisticFeatureExtractor';

describe('holisticFeatureExtractor', () => {
  test('constants match exact multimodal specification', () => {
    expect(HAND_FEATURE_SIZE).toBe(126);
    expect(BODY_FEATURE_SIZE).toBe(27);
    expect(EXPRESSION_FEATURE_SIZE).toBe(12);
    expect(MULTIMODAL_FEATURE_SIZE).toBe(165);
  });

  test('returns 165 zeroes when given empty results', () => {
    const vector = extract165DVector({});
    expect(vector).toBeInstanceOf(Float32Array);
    expect(vector.length).toBe(165);
    expect(vector.every((val) => val === 0)).toBe(true);
  });

  test('normalizes hands and pose relative to shoulder span', () => {
    // Mock shoulders at (0.4, 0.4) and (0.6, 0.4) => span = 0.2, midpoint = (0.5, 0.4)
    const poseLandmarks = Array.from({ length: 33 }, (_, i) => ({ x: 0.5, y: 0.5, z: 0.0 }));
    poseLandmarks[11] = { x: 0.4, y: 0.4, z: 0.0 }; // Left shoulder
    poseLandmarks[12] = { x: 0.6, y: 0.4, z: 0.0 }; // Right shoulder

    // Mock left hand landmark at midpoint (0.5, 0.4) => normalized coordinate should be (0, 0, 0)
    const leftHandLandmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.4, z: 0.0 }));
    // Mock right hand landmark at (0.7, 0.4) => dx = 0.2 / span (0.2) = 1.0
    const rightHandLandmarks = Array.from({ length: 21 }, () => ({ x: 0.7, y: 0.4, z: 0.0 }));

    const vector = extract165DVector({
      poseLandmarks,
      leftHandLandmarks,
      rightHandLandmarks,
    });

    expect(vector.length).toBe(165);
    // Left hand points at midpoint should be 0
    expect(vector[0]).toBeCloseTo(0.0);
    expect(vector[1]).toBeCloseTo(0.0);

    // Right hand point at (0.7, 0.4) normalized by midpoint (0.5, 0.4) & scale 0.2 => 1.0
    expect(vector[63]).toBeCloseTo(1.0);
    expect(vector[64]).toBeCloseTo(0.0);
  });

  test('extracts non-manual facial markers when face mesh is present', () => {
    const faceLandmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0.0 }));
    // Set outer cheeks
    faceLandmarks[234] = { x: 0.3, y: 0.5, z: 0.0 }; // left cheek
    faceLandmarks[454] = { x: 0.7, y: 0.5, z: 0.0 }; // right cheek => face width = 0.4

    // Set mouth
    faceLandmarks[61] = { x: 0.45, y: 0.6, z: 0.0 }; // mouth left
    faceLandmarks[291] = { x: 0.55, y: 0.6, z: 0.0 }; // mouth right => mouth width = 0.1
    faceLandmarks[13] = { x: 0.5, y: 0.58, z: 0.0 }; // upper lip
    faceLandmarks[14] = { x: 0.5, y: 0.62, z: 0.0 }; // lower lip => mouth open = 0.04

    const vector = extract165DVector({ faceLandmarks });
    // Face valid flag at index 164
    expect(vector[164]).toBe(1.0);
    // Mouth width ratio = 0.1 / 0.4 = 0.25
    expect(vector[153]).toBeCloseTo(0.25, 2);
    // Mouth open ratio = 0.04 / 0.1 = 0.4
    expect(vector[154]).toBeCloseTo(0.4, 2);
  });

  test('createMultimodalTemporalBuffer manages rolling sequence window', () => {
    const buffer = createMultimodalTemporalBuffer(40);
    expect(buffer.isReady()).toBe(false);

    for (let i = 0; i < 10; i++) {
      buffer.push(new Float32Array(165));
    }
    expect(buffer.size()).toBe(10);
    expect(buffer.isReady()).toBe(true);

    for (let i = 0; i < 40; i++) {
      buffer.push(new Float32Array(165));
    }
    expect(buffer.size()).toBe(40); // Capped at capacity 40

    const frames = buffer.getFrames();
    expect(frames.length).toBe(40);
    expect(frames[0].length).toBe(165);

    buffer.clear();
    expect(buffer.size()).toBe(0);
    expect(buffer.isReady()).toBe(false);
  });
});

