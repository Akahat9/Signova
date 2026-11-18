import { validateCallIceConfiguration } from './iceConfiguration';

const future = '2026-01-01T00:10:00.000Z';
const nowMs = Date.parse('2026-01-01T00:00:00.000Z');

test('accepts authenticated TURN credentials and enables relay-only policy', () => {
  const result = validateCallIceConfiguration({
    turnConfigured: true, expiresAt: future,
    iceServers: [{ urls: ['turn:relay.test:3478?transport=udp', 'turns:relay.test:5349'], username: 'expiry:user', credential: 'secret' }],
  }, { requireTurn: true, nowMs });
  expect(result.iceTransportPolicy).toBe('relay');
  expect(result.turnConfigured).toBe(true);
});

test('fails closed when TURN-only testing has no relay', () => {
  expect(() => validateCallIceConfiguration({
    turnConfigured: false, expiresAt: future, iceServers: [{ urls: 'stun:stun.test:3478' }],
  }, { requireTurn: true, nowMs })).toThrow('TURN relay is required');
});

test.each([
  [{ turnConfigured: true, expiresAt: future, iceServers: [{ urls: 'turn:relay.test:3478' }] }, 'TURN credentials are incomplete'],
  [{ turnConfigured: false, expiresAt: future, iceServers: [{ urls: 'https://relay.test' }] }, 'unsupported server URL'],
  [{ turnConfigured: false, expiresAt: '2026-01-01T00:00:20.000Z', iceServers: [{ urls: 'stun:stun.test' }] }, 'expired or too close'],
  [{ turnConfigured: false, expiresAt: future, iceServers: [{ urls: 'turn:relay.test', username: 'u', credential: 'c' }] }, 'metadata does not match'],
])('rejects malformed or unsafe ICE configuration', (config, message) => {
  expect(() => validateCallIceConfiguration(config, { nowMs })).toThrow(message);
});

