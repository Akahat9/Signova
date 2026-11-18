const assert = require('node:assert/strict');
const test = require('node:test');
const { claimMlsKeyPackages, validatePublishedKeyPackage } = require('../services/mlsKeyPackages');

const nowMs = Date.UTC(2026, 0, 1);
const packageFor = (deviceId) => ({
  ownerUid: 'target-user', deviceId, packageId: `package-${deviceId}`, protocol: 'MLS10',
  ciphersuite: 'MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519',
  keyPackageBase64: 'A'.repeat(128), credentialFingerprint: 'fingerprint-a',
  status: 'available', expiresAtMs: nowMs + 3600_000,
});

function transactionDb({ members = ['caller-user', 'target-user'], devices = ['device-a'], packages = devices.map(packageFor) } = {}) {
  const updates = [];
  const snapshots = [
    { exists: true, data: () => ({ memberIds: members }) },
    { docs: devices.map((id) => ({ id, data: () => ({ deviceId: id, status: 'active' }) })) },
    { docs: packages.map((record) => ({ data: () => record, ref: { id: record.packageId } })) },
  ];
  let readIndex = 0;
  const db = { runTransaction: (work) => work({ get: async () => snapshots[readIndex++], update: (ref, data) => updates.push({ ref, data }) }) };
  return { db, updates };
}

const dependencies = {
  makeConversationRef: () => ({}), makeDeviceQuery: () => ({}), makePackageQuery: () => ({}), timestamp: () => 'server-time',
};

test('validates bounded MLS KeyPackage publication metadata', () => {
  const valid = packageFor('device-a');
  assert.equal(validatePublishedKeyPackage(valid, nowMs).packageId, 'package-device-a');
  assert.throws(() => validatePublishedKeyPackage({ ...valid, expiresAtMs: nowMs + 8 * 86400_000 }, nowMs), /expiry/);
  assert.throws(() => validatePublishedKeyPackage({ ...valid, ciphersuite: 'unknown' }, nowMs), /Unsupported/);
});

test('atomically claims one package for every active recipient device', async () => {
  const { db, updates } = transactionDb({ devices: ['device-a', 'device-b'] });
  const result = await claimMlsKeyPackages({
    db, targetUid: 'target-user', claimantUid: 'caller-user', conversationId: 'chat-a', nowMs, dependencies,
  });
  assert.deepEqual(result.packages.map((item) => item.deviceId), ['device-a', 'device-b']);
  assert.deepEqual(result.missingDeviceIds, []);
  assert.equal(updates.length, 2);
  assert.equal(updates[0].data.claimedBy, 'caller-user');
  assert.equal(updates[0].data.conversationId, 'chat-a');
  assert.equal(updates[0].data.claimId, updates[1].data.claimId);
  assert.equal('claimId' in result.packages[0], false);
});

test('does not consume any package when an active device is missing one', async () => {
  const { db, updates } = transactionDb({ devices: ['device-a', 'device-b'], packages: [packageFor('device-a')] });
  const result = await claimMlsKeyPackages({
    db, targetUid: 'target-user', claimantUid: 'caller-user', conversationId: 'chat-a', nowMs, dependencies,
  });
  assert.deepEqual(result, { packages: [], missingDeviceIds: ['device-b'] });
  assert.equal(updates.length, 0);
});

test('rejects claims outside a shared conversation before consuming packages', async () => {
  const { db, updates } = transactionDb({ members: ['target-user', 'someone-else'] });
  await assert.rejects(claimMlsKeyPackages({
    db, targetUid: 'target-user', claimantUid: 'caller-user', conversationId: 'chat-a', nowMs, dependencies,
  }), /Both users must be members/);
  assert.equal(updates.length, 0);
});

test('rejects self-claim before accessing Firestore', async () => {
  await assert.rejects(claimMlsKeyPackages({
    db: {}, targetUid: 'same-user', claimantUid: 'same-user', conversationId: 'chat-a', nowMs,
  }), /Cannot claim/);
});
