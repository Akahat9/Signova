import { webcrypto } from 'crypto';
import {
  E2EE_TEXT_PREFIX,
  SIGNOVA_ACTIVE_E2EE_PROTOCOL,
  decryptRealtimeText,
  encryptRealtimeText,
} from './e2eeSessionService';
import { resolveConversationE2EEState } from '../securityCapabilities';

beforeAll(() => {
  if (!window.crypto?.subtle) {
    Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
  }
});

describe('e2eeSessionService', () => {
  test('resolves active E2EE capability when both devices are verified', () => {
    const state = resolveConversationE2EEState({
      available: true,
      protocol: SIGNOVA_ACTIVE_E2EE_PROTOCOL,
      verifiedDevices: 2,
      localFingerprint: 'abc',
      peerFingerprint: 'def',
    });

    expect(state.available).toBe(true);
    expect(state.protocol).toBe(SIGNOVA_ACTIVE_E2EE_PROTOCOL);
    expect(state.verifiedDevices).toBe(2);
  });

  test('encrypts and decrypts realtime text with AES-256-GCM envelope', async () => {
    const aesKey = await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
    const session = {
      available: true,
      protocol: SIGNOVA_ACTIVE_E2EE_PROTOCOL,
      verifiedDevices: 2,
      localDeviceId: 'web-device-1',
      key: aesKey,
    };

    const encrypted = await encryptRealtimeText(session, 'chat-1', 'msg-1', 'Namaste Signova');
    expect(encrypted.encrypted).toBe(true);
    expect(encrypted.text.startsWith(E2EE_TEXT_PREFIX)).toBe(true);
    expect(encrypted.text).not.toContain('Namaste Signova');

    const decrypted = await decryptRealtimeText(session, encrypted.text);
    expect(decrypted).toEqual({
      text: 'Namaste Signova',
      encrypted: true,
      decryptError: false,
    });
  });

  test('passes through plaintext messages unchanged and reports missing key gracefully', async () => {
    expect(await decryptRealtimeText(null, 'hello')).toEqual({ text: 'hello', encrypted: false });
    const locked = await decryptRealtimeText(null, `${E2EE_TEXT_PREFIX}{}`);
    expect(locked.encrypted).toBe(true);
    expect(locked.decryptError).toBe(true);
  });
});
