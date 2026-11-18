const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const { buildIceConfig, buildTwilioIceConfig, validateTurnEnvironment } = require('../services/callInfrastructure');

const originalEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) delete process.env[key];
  }
  Object.assign(process.env, originalEnv);
});

test('ICE config returns STUN without exposing an incomplete TURN configuration', () => {
  delete process.env.SIGNOVA_TURN_URLS;
  delete process.env.SIGNOVA_TURN_SHARED_SECRET;
  const result = buildIceConfig('user-a', Date.UTC(2026, 0, 1));

  assert.equal(result.turnConfigured, false);
  assert.equal(result.iceServers.length, 1);
  assert.equal('credential' in result.iceServers[0], false);
});

test('ICE config generates expiring coturn REST credentials', () => {
  process.env.SIGNOVA_TURN_URLS = 'turn:turn.example.test:3478?transport=udp';
  process.env.SIGNOVA_TURN_SHARED_SECRET = 'a-strong-turn-secret-that-is-long-enough';
  process.env.SIGNOVA_TURN_CREDENTIAL_TTL_SECONDS = '600';
  const result = buildIceConfig('user-a', Date.UTC(2026, 0, 1));

  assert.equal(result.turnConfigured, true);
  assert.equal(result.iceServers.length, 2);
  assert.match(result.iceServers[1].username, /^1767226200:user-a$/);
  assert.ok(result.iceServers[1].credential.length > 20);
  assert.equal(result.iceServers[1].credential.includes(process.env.SIGNOVA_TURN_SHARED_SECRET), false);
});

test('TURN production readiness requires UDP and TCP or TLS routes', () => {
  const incomplete = validateTurnEnvironment({
    SIGNOVA_TURN_URLS: 'turn:relay.example.test:3478?transport=udp',
    SIGNOVA_TURN_SHARED_SECRET: 'a-strong-turn-secret-that-is-long-enough',
  });
  assert.equal(incomplete.ready, false);
  assert.match(incomplete.issues.join(' '), /TCP or TLS/);

  const ready = validateTurnEnvironment({
    SIGNOVA_TURN_URLS: 'turn:relay.example.test:3478?transport=udp,turns:relay.example.test:5349?transport=tcp',
    SIGNOVA_TURN_SHARED_SECRET: 'a-strong-turn-secret-that-is-long-enough',
  });
  assert.equal(ready.ready, true);
  assert.deepEqual(ready.issues, []);
});

test('TURN readiness rejects unsafe protocols and short shared secrets', () => {
  const result = validateTurnEnvironment({
    SIGNOVA_TURN_URLS: 'https://relay.example.test',
    SIGNOVA_TURN_SHARED_SECRET: 'short',
  });
  assert.equal(result.ready, false);
  assert.match(result.issues.join(' '), /turn: or turns:/);
  assert.match(result.issues.join(' '), /32 characters/);
});

test('Twilio Network Traversal configuration is validated without exposing credentials', () => {
  const result = validateTurnEnvironment({
    SIGNOVA_TURN_PROVIDER: 'twilio',
    TWILIO_ACCOUNT_SID: 'AC' + '0'.repeat(32),
    TWILIO_AUTH_TOKEN: 'test-auth-token-placeholder',
  });
  assert.equal(result.ready, true);
  assert.equal(result.provider, 'twilio');
});

test('Twilio token response becomes expiring ICE config', async () => {
  const testSid = 'AC' + '0'.repeat(32);
  process.env.TWILIO_ACCOUNT_SID = testSid;
  process.env.TWILIO_AUTH_TOKEN = 'test-auth-token-placeholder';
  const result = await buildTwilioIceConfig(Date.UTC(2026, 0, 1), async (url, options) => {
    assert.match(url, new RegExp(`api\\.twilio\\.com/2010-04-01/Accounts/${testSid}/Tokens\\.json$`));
    assert.equal(options.method, 'POST');
    assert.match(options.headers.Authorization, /^Basic /);
    return {
      ok: true,
      async json() {
        return {
          ttl: 600,
          ice_servers: [
            { urls: 'stun:global.stun.twilio.com:3478' },
            { urls: 'turn:global.turn.twilio.com:3478?transport=udp', username: 'temporary-user', credential: 'temporary-secret' },
            { urls: 'turn:global.turn.twilio.com:443?transport=tcp', username: 'temporary-user', credential: 'temporary-secret' },
          ],
        };
      },
    };
  });
  assert.equal(result.provider, 'twilio');
  assert.equal(result.turnConfigured, true);
  assert.equal(result.iceServers.length, 3);
  assert.equal(result.expiresAt, '2026-01-01T00:10:00.000Z');
});
