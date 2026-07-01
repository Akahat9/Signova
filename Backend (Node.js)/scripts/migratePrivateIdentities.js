const crypto = require('crypto');
const admin = require('firebase-admin');

const secret = process.env.SIGNOVA_IDENTITY_HMAC_SECRET || '';
if (secret.length < 32) {
  throw new Error('SIGNOVA_IDENTITY_HMAC_SECRET must be at least 32 characters');
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID,
  });
}

function normalize(type, value = '') {
  const raw = String(value).trim().toLowerCase().replace(/\s+/g, '');
  return type === 'phone' ? raw.replace(/[^\d+]/g, '') : raw.replace(/^@+/, '');
}

function keyFor(type, value) {
  return crypto.createHmac('sha256', secret).update(`${type}:${normalize(type, value)}`).digest('hex');
}

async function main() {
  const db = admin.firestore();
  const legacy = await db.collection('publicUserIdentities').get();
  let migrated = 0;
  let skipped = 0;
  const writer = db.bulkWriter();

  for (const document of legacy.docs) {
    const data = document.data();
    if (!data.uid || !data.email || !['username', 'phone'].includes(data.type) || !data.value) {
      skipped += 1;
      continue;
    }
    const target = db.collection('privateAuthIdentities').doc(keyFor(data.type, data.value));
    writer.set(target, {
      uid: data.uid,
      email: data.email,
      type: data.type,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    migrated += 1;
  }

  await writer.close();
  console.log(JSON.stringify({ legacy_documents: legacy.size, migrated, skipped }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
