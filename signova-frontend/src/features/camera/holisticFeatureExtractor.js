/**
 * Signova Holistic Multimodal Feature Extractor
 * Extracts a normalized 165-dimensional feature vector per video frame:
 * - 126 Hand coordinates (42 landmarks x 3: left & right hands)
 * - 27 Upper-Body Pose coordinates (9 key upper-body landmarks x 3)
 * - 12 Facial Non-Manual Markers (geometric ratios for mouth, eyes, brows, head tilt)
 *
 * All coordinates are normalized relative to the signer's shoulder midpoint and span,
 * making recognition invariant to distance and position relative to the camera.
 */

export const HAND_FEATURE_SIZE = 126;
export const BODY_FEATURE_SIZE = 27;
export const EXPRESSION_FEATURE_SIZE = 12;
export const MULTIMODAL_FEATURE_SIZE = HAND_FEATURE_SIZE + BODY_FEATURE_SIZE + EXPRESSION_FEATURE_SIZE; // 165
export const DEFAULT_SEQUENCE_LENGTH = 40;

// Upper body landmarks: nose (0), shoulders (11, 12), elbows (13, 14), wrists (15, 16), hips (23, 24)
export const UPPER_BODY_INDICES = Object.freeze([0, 11, 12, 13, 14, 15, 16, 23, 24]);

// Face mesh key landmark indices for non-manual markers (MediaPipe 468/478 mesh)
export const FACE_LANDMARK_INDICES = Object.freeze({
  leftCheek: 234,
  rightCheek: 454,
  mouthLeft: 61,
  mouthRight: 291,
  upperInnerLip: 13,
  lowerInnerLip: 14,
  lowerLipBottom: 17,
  leftEyeOuter: 33,
  leftEyeInner: 133,
  leftEyeTop: 159,
  leftEyeBottom: 145,
  rightEyeOuter: 263,
  rightEyeInner: 362,
  rightEyeTop: 386,
  rightEyeBottom: 374,
  leftBrow: 70,
  rightBrow: 300,
});

function euclideanDistance2D(p1, p2) {
  if (!p1 || !p2) return 0.0;
  const dx = (p1.x || 0) - (p2.x || 0);
  const dy = (p1.y || 0) - (p2.y || 0);
  return Math.hypot(dx, dy);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Extracts a normalized 165-D vector from MediaPipe Holistic or multi-source landmarks.
 * @param {Object} results Holistic output containing poseLandmarks, faceLandmarks, leftHandLandmarks, rightHandLandmarks
 * @returns {Float32Array} 165-dimensional normalized vector
 */
export function extract165DVector(results = {}) {
  const vector = new Float32Array(MULTIMODAL_FEATURE_SIZE);
  const pose = results?.poseLandmarks || [];
  const face = results?.faceLandmarks || [];
  const leftHand = results?.leftHandLandmarks || [];
  const rightHand = results?.rightHandLandmarks || [];

  // Calculate body reference frame from shoulders (index 11 = Left, 12 = Right)
  const leftShoulder = pose[11];
  const rightShoulder = pose[12];
  let ox = 0.5;
  let oy = 0.5;
  let oz = 0.0;
  let scale = 1.0;

  if (leftShoulder && rightShoulder) {
    ox = ((leftShoulder.x || 0) + (rightShoulder.x || 0)) / 2.0;
    oy = ((leftShoulder.y || 0) + (rightShoulder.y || 0)) / 2.0;
    oz = ((leftShoulder.z || 0) + (rightShoulder.z || 0)) / 2.0;
    const shoulderDistance = Math.hypot(
      (leftShoulder.x || 0) - (rightShoulder.x || 0),
      (leftShoulder.y || 0) - (rightShoulder.y || 0)
    );
    scale = Math.max(0.001, shoulderDistance);
  }

  // 1. Hands: Left Hand (indices 0..62)
  if (Array.isArray(leftHand) && leftHand.length >= 21) {
    for (let i = 0; i < 21; i++) {
      const pt = leftHand[i];
      if (pt) {
        vector[i * 3] = ((pt.x || 0) - ox) / scale;
        vector[i * 3 + 1] = ((pt.y || 0) - oy) / scale;
        vector[i * 3 + 2] = ((pt.z || 0) - oz) / scale;
      }
    }
  }

  // 2. Hands: Right Hand (indices 63..125)
  if (Array.isArray(rightHand) && rightHand.length >= 21) {
    for (let i = 0; i < 21; i++) {
      const pt = rightHand[i];
      if (pt) {
        vector[63 + (i * 3)] = ((pt.x || 0) - ox) / scale;
        vector[63 + (i * 3) + 1] = ((pt.y || 0) - oy) / scale;
        vector[63 + (i * 3) + 2] = ((pt.z || 0) - oz) / scale;
      }
    }
  }

  // 3. Upper Body Pose (indices 126..152: 9 landmarks x 3)
  for (let i = 0; i < UPPER_BODY_INDICES.length; i++) {
    const jointIndex = UPPER_BODY_INDICES[i];
    const pt = pose[jointIndex];
    if (pt) {
      vector[126 + (i * 3)] = ((pt.x || 0) - ox) / scale;
      vector[126 + (i * 3) + 1] = ((pt.y || 0) - oy) / scale;
      vector[126 + (i * 3) + 2] = ((pt.z || 0) - oz) / scale;
    }
  }

  // 4. Facial Non-Manual Markers (indices 153..164: 12 engineered features)
  if (Array.isArray(face) && face.length >= 468) {
    const p = FACE_LANDMARK_INDICES;
    const faceWidth = Math.max(0.001, euclideanDistance2D(face[p.leftCheek], face[p.rightCheek]));
    const mouthWidth = euclideanDistance2D(face[p.mouthLeft], face[p.mouthRight]);
    const mouthOpen = euclideanDistance2D(face[p.upperInnerLip], face[p.lowerInnerLip]);
    const leftEyeWidth = Math.max(0.001, euclideanDistance2D(face[p.leftEyeOuter], face[p.leftEyeInner]));
    const rightEyeWidth = Math.max(0.001, euclideanDistance2D(face[p.rightEyeOuter], face[p.rightEyeInner]));
    const leftEyeOpen = euclideanDistance2D(face[p.leftEyeTop], face[p.leftEyeBottom]);
    const rightEyeOpen = euclideanDistance2D(face[p.rightEyeTop], face[p.rightEyeBottom]);
    const leftBrowRaise = euclideanDistance2D(face[p.leftBrow], face[p.leftEyeTop]);
    const rightBrowRaise = euclideanDistance2D(face[p.rightBrow], face[p.rightEyeTop]);

    // Mouth corners vs lower lip elevation
    const mouthCornerMidY = ((face[p.mouthLeft]?.y || 0) + (face[p.mouthRight]?.y || 0)) / 2.0;
    const mouthCornerLift = mouthCornerMidY - (face[p.lowerLipBottom]?.y || 0);

    // Head roll angle (tilt between outer eye corners)
    const eyeDx = (face[p.rightEyeOuter]?.x || 0) - (face[p.leftEyeOuter]?.x || 0);
    const eyeDy = (face[p.rightEyeOuter]?.y || 0) - (face[p.leftEyeOuter]?.y || 0);
    const headRollAngle = Math.atan2(eyeDy, eyeDx) / Math.PI;

    // Shoulder tilt angle
    let shoulderTilt = 0.0;
    if (leftShoulder && rightShoulder) {
      const sDx = (rightShoulder.x || 0) - (leftShoulder.x || 0);
      const sDy = (rightShoulder.y || 0) - (leftShoulder.y || 0);
      shoulderTilt = Math.atan2(sDy, sDx) / Math.PI;
    }

    // Torso horizontal and vertical lean (nose relative to mid-hips 23 & 24)
    let torsoLeanX = 0.0;
    let torsoLeanY = 0.0;
    if (pose[0] && pose[23] && pose[24]) {
      const midHipX = ((pose[23].x || 0) + (pose[24].x || 0)) / 2.0;
      const midHipY = ((pose[23].y || 0) + (pose[24].y || 0)) / 2.0;
      torsoLeanX = clamp(((pose[0].x || 0) - midHipX) / scale, -1.5, 1.5);
      torsoLeanY = clamp(((pose[0].y || 0) - midHipY) / scale, -1.5, 1.5);
    }

    vector[153] = clamp(mouthWidth / faceWidth, 0.0, 1.5);
    vector[154] = clamp(mouthOpen / Math.max(0.001, mouthWidth), 0.0, 1.5);
    vector[155] = clamp(leftEyeOpen / leftEyeWidth, 0.0, 1.5);
    vector[156] = clamp(rightEyeOpen / rightEyeWidth, 0.0, 1.5);
    vector[157] = clamp(leftBrowRaise / faceWidth, 0.0, 1.5);
    vector[158] = clamp(rightBrowRaise / faceWidth, 0.0, 1.5);
    vector[159] = clamp(mouthCornerLift / faceWidth, -1.0, 1.0);
    vector[160] = clamp(headRollAngle, -1.0, 1.0);
    vector[161] = clamp(shoulderTilt, -1.0, 1.0);
    vector[162] = torsoLeanX;
    vector[163] = torsoLeanY;
    vector[164] = 1.0; // Face confidence valid
  }

  return vector;
}

/**
 * Creates a circular buffer for 40-frame multimodal temporal sequences.
 */
export function createMultimodalTemporalBuffer(capacity = DEFAULT_SEQUENCE_LENGTH) {
  const maxFrames = Math.max(1, capacity);
  const buffer = [];

  return {
    push(frameVector) {
      const vector = frameVector instanceof Float32Array
        ? frameVector
        : new Float32Array(frameVector || MULTIMODAL_FEATURE_SIZE);

      buffer.push(vector);
      if (buffer.length > maxFrames) {
        buffer.shift();
      }
      return buffer.length;
    },

    clear() {
      buffer.length = 0;
    },

    isReady() {
      return buffer.length >= Math.min(8, maxFrames);
    },

    getFrames() {
      return buffer.map((vec) => Array.from(vec));
    },

    size() {
      return buffer.length;
    },
  };
}

