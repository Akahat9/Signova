require('dotenv').config({ quiet: true });

const crypto = require('crypto');
const { getFirebaseAdmin } = require('../services/firebaseAdmin');

const PREFIX = 'encryptedChatAttachments/';

function privateObjectRef(path) {
  return crypto.createHash('sha256').update(String(path)).digest('hex').slice(0, 20);
}

function selectOrphanedEncryptedAttachments(files, referencedPaths, cutoff) {
  return files.filter((file) => {
    if (!String(file.name || '').startsWith(PREFIX) || referencedPaths.has(file.name)) return false;
    const createdAt = Date.parse(file.metadata?.timeCreated || '');
    return Number.isFinite(createdAt) && createdAt <= cutoff;
  });
}

async function main({ argv = process.argv, env = process.env } = {}) {
  const apply = argv.includes('--apply');
  if (apply && env.SIGNOVA_ALLOW_ENCRYPTED_ATTACHMENT_DELETE !== 'true') {
    throw new Error('Set SIGNOVA_ALLOW_ENCRYPTED_ATTACHMENT_DELETE=true to apply encrypted attachment cleanup');
  }
  const maximum = Math.min(5000, Math.max(1, Number(env.SIGNOVA_ENCRYPTED_ATTACHMENT_AUDIT_MAX_FILES || 1000)));
  const graceHours = Math.min(720, Math.max(24, Number(env.SIGNOVA_ENCRYPTED_ATTACHMENT_ORPHAN_GRACE_HOURS || 72)));
  const admin = getFirebaseAdmin();
  const firestore = admin.firestore();
  const bucket = admin.storage().bucket(env.FIREBASE_STORAGE_BUCKET || undefined);
  const messages = await firestore.collectionGroup('messages')
    .where('type', '==', 'encrypted_attachment')
    .select('encryptedAttachment')
    .limit(5000)
    .get();
  const referencedPaths = new Set(messages.docs
    .map((item) => item.data()?.encryptedAttachment?.path)
    .filter((path) => typeof path === 'string' && path.startsWith(PREFIX)));
  const [files] = await bucket.getFiles({ prefix: PREFIX, maxResults: maximum, autoPaginate: false });
  const cutoff = Date.now() - (graceHours * 60 * 60 * 1000);
  const orphaned = selectOrphanedEncryptedAttachments(files, referencedPaths, cutoff);

  console.log(`Scanned ${files.length} encrypted attachment object(s); found ${orphaned.length} orphan candidate(s). Mode: ${apply ? 'apply' : 'dry-run'}.`);
  for (const file of orphaned) {
    console.log(`encrypted-object-ref:${privateObjectRef(file.name)}`);
    if (apply) await file.delete({ ignoreNotFound: true });
  }
  return { scanned: files.length, orphaned: orphaned.length, applied: apply };
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || 'Encrypted attachment orphan audit failed');
    process.exitCode = 1;
  });
}

module.exports = { main, privateObjectRef, selectOrphanedEncryptedAttachments };
