export const SIGN_LANGUAGES = ['ISL', 'ASL', 'BSL'];
export const SIGN_TYPES = ['Letter', 'Word', 'Sentence'];

export const SIGN_ANIMATION_LIBRARY = {
  hello: {
    id: 'hello',
    label: 'Hello',
    type: 'Word',
    meaning: 'A friendly greeting.',
    handshape: 'Open dominant hand',
    movement: 'Move the hand outward from the forehead',
    expression: 'Relaxed face and natural eye contact',
    poses: [
      { left: [-0.25, 0.2, -0.35], right: [-1.1, -0.35, 0.9] },
      { left: [-0.25, 0.2, -0.35], right: [-0.65, -0.1, 1.25] },
      { left: [-0.25, 0.2, -0.35], right: [-1.25, -0.25, 0.72] },
    ],
  },
  help: {
    id: 'help',
    label: 'Help',
    type: 'Word',
    meaning: 'Ask another person for assistance.',
    handshape: 'Dominant fist resting on an open palm',
    movement: 'Lift both hands together',
    expression: 'Clear requesting expression',
    poses: [
      { left: [-0.7, 0.1, -0.55], right: [0.65, -0.2, 0.52] },
      { left: [-0.95, 0.2, -0.85], right: [0.92, -0.15, 0.82] },
      { left: [-0.72, 0.1, -0.58], right: [0.68, -0.2, 0.56] },
    ],
  },
  okay: {
    id: 'okay',
    label: 'Are you okay?',
    type: 'Sentence',
    meaning: 'A gentle check-in about safety or wellbeing.',
    handshape: 'Open hands with relaxed fingers',
    movement: 'Move both hands slightly toward the person',
    expression: 'Soft eyebrows and a concerned face',
    poses: [
      { left: [-0.5, 0.15, -0.55], right: [0.5, -0.15, 0.55] },
      { left: [-0.85, 0.35, -0.82], right: [0.85, -0.35, 0.82] },
      { left: [-0.62, 0.22, -0.68], right: [0.62, -0.22, 0.68] },
    ],
  },
  name: {
    id: 'name',
    label: 'My name is',
    type: 'Sentence',
    meaning: 'Introduce yourself before fingerspelling your name.',
    handshape: 'Point to self, then use two extended fingers',
    movement: 'Touch the chest, then tap the fingers together',
    expression: 'Warm smile',
    poses: [
      { left: [-0.25, 0.05, -0.42], right: [0.75, -0.25, 0.72] },
      { left: [-0.72, 0.4, -0.76], right: [0.72, -0.4, 0.76] },
      { left: [-0.48, 0.22, -0.58], right: [0.48, -0.22, 0.58] },
    ],
  },
};

export function resolveSignQueue(text = '') {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return [SIGN_ANIMATION_LIBRARY.okay];
  if (normalized.includes('help')) return [SIGN_ANIMATION_LIBRARY.help];
  if (normalized.includes('name') || normalized.includes('introduce')) return [SIGN_ANIMATION_LIBRARY.name];
  if (normalized.includes('okay') || normalized.includes('ok')) return [SIGN_ANIMATION_LIBRARY.okay];
  if (normalized.includes('hello') || normalized.includes('hi')) return [SIGN_ANIMATION_LIBRARY.hello];

  return normalized
    .split(/\s+/)
    .slice(0, 8)
    .map((token, index) => ({
      ...SIGN_ANIMATION_LIBRARY.hello,
      id: `fingerspell-${token}-${index}`,
      label: token,
      type: token.length === 1 ? 'Letter' : 'Word',
      meaning: `Fingerspell “${token}”`,
    }));
}
