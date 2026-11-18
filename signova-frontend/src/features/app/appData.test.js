import {
  COMPOSER_EMOJIS,
  DEFAULT_SIGNS,
  EMPTY_CONTACT_FORM,
  EMPTY_GROUP_FORM,
  GESTURE_STICKERS,
  INITIAL_CONTACTS,
  LEARN_MISSIONS,
  MESSAGE_EMOJI_REACTIONS,
  NAV_ITEMS,
  PERFORMANCE_PROFILES,
  SIGNOVA_AVATAR_ASSETS,
} from './appData';

function expectUnique(values) {
  expect(new Set(values).size).toBe(values.length);
}

test('navigation, sign, mission, avatar, and sticker identifiers remain unique', () => {
  expectUnique(NAV_ITEMS.map(({ id }) => id));
  expectUnique(DEFAULT_SIGNS.map(({ label }) => label));
  expectUnique(LEARN_MISSIONS.map(({ id }) => id));
  expectUnique(SIGNOVA_AVATAR_ASSETS.map(({ id }) => id));
  expectUnique(GESTURE_STICKERS.map(({ label }) => label));
});

test('product learning data contains complete actionable copy and supported profiles', () => {
  DEFAULT_SIGNS.forEach((sign) => expect(sign).toEqual(expect.objectContaining({ label: expect.any(String), sign: expect.any(String), hint: expect.any(String), source: 'landmark_dataset' })));
  LEARN_MISSIONS.forEach((mission) => expect(mission).toEqual(expect.objectContaining({ phrase: expect.any(String), meaning: expect.any(String), handshape: expect.any(String), motion: expect.any(String), expression: expect.any(String), minutes: expect.any(Number) })));
  expect(Object.keys(PERFORMANCE_PROFILES)).toEqual(['lowLatency', 'balanced', 'highAccuracy']);
  Object.values(PERFORMANCE_PROFILES).forEach(({ detection, tracking, frameModulo }) => {
    expect(detection).toBeGreaterThanOrEqual(0);
    expect(detection).toBeLessThanOrEqual(1);
    expect(tracking).toBeGreaterThanOrEqual(0);
    expect(tracking).toBeLessThanOrEqual(1);
    expect(frameModulo).toBeGreaterThanOrEqual(1);
  });
});

test('form defaults match privacy and unavailable-encryption capabilities', () => {
  expect(EMPTY_CONTACT_FORM).toMatchObject({ showUsername: true, showNumber: false });
  expect(EMPTY_GROUP_FORM.encryptedRequired).toBe(false);
  expect(EMPTY_GROUP_FORM.autoCaptions).toBe(true);
  expect(INITIAL_CONTACTS[0]).toMatchObject({ showUsername: true, showNumber: false });
});

test('reaction and composer palettes are non-empty and duplicate-free', () => {
  expectUnique(COMPOSER_EMOJIS);
  expectUnique(MESSAGE_EMOJI_REACTIONS);
  expect(COMPOSER_EMOJIS.length).toBeGreaterThanOrEqual(10);
  expect(MESSAGE_EMOJI_REACTIONS.length).toBeGreaterThan(COMPOSER_EMOJIS.length);
});
