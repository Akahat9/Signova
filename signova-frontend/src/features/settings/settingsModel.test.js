import { buildSettingsSections, buildSettingsWorkspaceRecord, createDefaultSettings, filterSettingsSections, loadPersistedSettings, mergeSignovaSettings, parsePersistedSettings, resolveWorkspaceSettings, savePersistedSettings, serializePersistedSettings, SIGNOVA_SETTINGS_SCHEMA_VERSION, SIGNOVA_SETTINGS_STORAGE_KEY, SIGNOVA_SETTINGS_WORKSPACE_ID } from './settingsModel';

test('creates complete dark-first defaults with the supplied confidence threshold', () => {
  const settings = createDefaultSettings(0.72);
  expect(settings.display.theme).toBe('dark');
  expect(settings.translation.confidenceThreshold).toBe(0.72);
  expect(settings).toEqual(expect.objectContaining({ account: expect.any(Object), privacy: expect.any(Object), security: expect.any(Object), device: expect.any(Object) }));
});

test('merges only known top-level settings while preserving new nested defaults', () => {
  const defaults = createDefaultSettings();
  const merged = mergeSignovaSettings(defaults, { display: { theme: 'light' }, removedLegacyGroup: { unsafe: true } });
  expect(merged.display).toMatchObject({ theme: 'light', highContrast: false });
  expect(merged.removedLegacyGroup).toBeUndefined();
});

test('sanitizes nested keys, types, enums, ranges, and oversized values', () => {
  const defaults = createDefaultSettings();
  const merged = mergeSignovaSettings(defaults, {
    display: { theme: 'neon', highContrast: 'yes', unknown: true },
    practice: { dailyGoal: 9999 },
    translation: { confidenceThreshold: -4 },
    account: { name: 'x'.repeat(2001) },
    __proto__: { polluted: true },
  });
  expect(merged.display).toMatchObject({ theme: 'dark', highContrast: false });
  expect(merged.display.unknown).toBeUndefined();
  expect(merged.practice.dailyGoal).toBe(240);
  expect(merged.translation.confidenceThreshold).toBe(0);
  expect(merged.account.name).toBe('Signova User');
  expect({}.polluted).toBeUndefined();
});

test('keeps every camera resolution exposed by the Settings UI', () => {
  const defaults = createDefaultSettings();
  const merged = mergeSignovaSettings(defaults, { camera: { resolution: '1440p' } });
  expect(merged.camera.resolution).toBe('1440p');
});

test('loads persisted settings and safely recovers from malformed JSON', () => {
  const storage = { getItem: jest.fn(() => JSON.stringify({ practice: { dailyGoal: 30 } })) };
  expect(loadPersistedSettings(storage).practice).toMatchObject({ dailyGoal: 30, reminders: true });
  storage.getItem.mockReturnValue('{bad-json');
  expect(loadPersistedSettings(storage).practice.dailyGoal).toBe(15);
  expect(storage.getItem).toHaveBeenCalledWith(SIGNOVA_SETTINGS_STORAGE_KEY);
});

test('migrates legacy settings and round-trips the versioned persistence envelope', () => {
  expect(parsePersistedSettings(JSON.stringify({ display: { theme: 'light' } }))).toEqual({ display: { theme: 'light' } });
  expect(parsePersistedSettings(JSON.stringify({ version: 99, settings: {} }))).toBeNull();

  const storage = { getItem: jest.fn(), setItem: jest.fn() };
  const settings = createDefaultSettings(0.72);
  settings.display.theme = 'system';
  expect(savePersistedSettings(storage, settings, 0.72)).toBe(true);
  const serialized = storage.setItem.mock.calls[0][1];
  expect(JSON.parse(serialized).version).toBe(SIGNOVA_SETTINGS_SCHEMA_VERSION);
  storage.getItem.mockReturnValue(serialized);
  expect(loadPersistedSettings(storage, 0.72).display.theme).toBe('system');
  expect(serializePersistedSettings(settings, 0.72)).toBe(serialized);
});

test('fails storage writes without breaking the live settings session', () => {
  const storage = { setItem: jest.fn(() => { throw new Error('quota'); }) };
  expect(savePersistedSettings(storage, createDefaultSettings())).toBe(false);
});

test('serializes preferences without duplicating authoritative identity or oversized profile media', () => {
  const settings = createDefaultSettings();
  settings.account.email = 'private@example.test';
  settings.account.about = 'Accessible product builder';
  settings.account.profilePhoto = 'data:image/png;base64,private';
  settings.display.theme = 'light';
  const record = buildSettingsWorkspaceRecord(settings);
  expect(record).toMatchObject({ id: SIGNOVA_SETTINGS_WORKSPACE_ID, schemaVersion: SIGNOVA_SETTINGS_SCHEMA_VERSION, savedAt: expect.any(Number) });
  expect(record.settings.display.theme).toBe('light');
  expect(record.settings.account.about).toBe('Accessible product builder');
  expect(record.settings.account.email).toBeUndefined();
  expect(record.settings.account.profilePhoto).toBeUndefined();
});

test('hydrates sanitized workspace preferences without overriding the authoritative account profile', () => {
  const current = createDefaultSettings();
  current.account.email = 'verified@example.test';
  const record = buildSettingsWorkspaceRecord({ ...current, account: { ...current.account, about: 'Cloud preference' }, display: { ...current.display, theme: 'light' } });
  record.settings.practice.dailyGoal = 999;
  const resolved = resolveWorkspaceSettings(current, record);
  expect(resolved.account.email).toBe('verified@example.test');
  expect(resolved.account.about).toBe('Cloud preference');
  expect(resolved.display.theme).toBe('light');
  expect(resolved.practice.dailyGoal).toBe(240);
  expect(resolveWorkspaceSettings(current, { ...record, schemaVersion: 99 }).display.theme).toBe('dark');
});

test('builds and searches responsive setting categories from live state', () => {
  const settings = createDefaultSettings();
  const sections = buildSettingsSections(settings, { cameraEnabled: true, deviceProfile: { deviceType: 'Desktop', performance: 'High performance' } });
  expect(sections.find((section) => section.id === 'camera').detail).toContain('Camera on');
  expect(filterSettingsSections(sections, 'privacy')).toEqual([expect.objectContaining({ id: 'security' })]);
  expect(filterSettingsSections(sections, '  ')).toBe(sections);
});
