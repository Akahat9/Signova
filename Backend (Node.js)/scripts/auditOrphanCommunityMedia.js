require('dotenv').config({ quiet: true });

const { getFirebaseAdmin } = require('../services/firebaseAdmin');

const APPLY = process.argv.includes('--apply');
const MAX_FILES = Math.min(5000, Math.max(1, Number(process.env.SIGNOVA_MEDIA_AUDIT_MAX_FILES || 1000)));
const GRACE_HOURS = Math.min(168, Math.max(1, Number(process.env.SIGNOVA_MEDIA_ORPHAN_GRACE_HOURS || 24)));

async function main() {
  const admin = getFirebaseAdmin();
  const firestore = admin.firestore();
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET || undefined;
  const bucket = admin.storage().bucket(bucketName);
  const posts = await firestore.collection('publicCommunityPosts')
    .select('mediaPath', 'thumbnailPath')
    .limit(5000)
    .get();
  const referencedPaths = new Set();
  posts.docs.forEach((item) => {
    const data = item.data();
    if (data.mediaPath) referencedPaths.add(data.mediaPath);
    if (data.thumbnailPath) referencedPaths.add(data.thumbnailPath);
  });

  const [files] = await bucket.getFiles({ prefix: 'community/', maxResults: MAX_FILES, autoPaginate: false });
  const cutoff = Date.now() - (GRACE_HOURS * 60 * 60 * 1000);
  const orphaned = files.filter((file) => {
    if (referencedPaths.has(file.name)) return false;
    const createdAt = Date.parse(file.metadata?.timeCreated || '');
    return Number.isFinite(createdAt) && createdAt <= cutoff;
  });

  console.log(`Scanned ${files.length} community object(s); found ${orphaned.length} orphan candidate(s). Mode: ${APPLY ? 'apply' : 'dry-run'}.`);
  for (const file of orphaned) {
    console.log(file.name);
    if (APPLY) await file.delete({ ignoreNotFound: true });
  }
}

main().catch(() => {
  console.error('Community media orphan audit failed');
  process.exitCode = 1;
});

