require('dotenv').config({ quiet: true });

const { getFirebaseAdmin } = require('../services/firebaseAdmin');

const APPLY = process.argv.includes('--apply');
const LIMIT = Math.min(500, Math.max(1, Number(process.env.SIGNOVA_CALL_CLEANUP_BATCH_SIZE || 200)));

async function main() {
  const admin = getFirebaseAdmin();
  const firestore = admin.firestore();
  const snapshot = await firestore.collection('callRooms')
    .where('expiresAtMillis', '<=', Date.now())
    .limit(LIMIT)
    .get();

  console.log(`Found ${snapshot.size} expired call room(s). Mode: ${APPLY ? 'apply' : 'dry-run'}.`);
  if (!APPLY) {
    snapshot.docs.forEach((item) => console.log(item.id));
    return;
  }

  for (const item of snapshot.docs) {
    await firestore.recursiveDelete(item.ref);
    console.log(`Deleted expired call room ${item.id}`);
  }
}

main().catch(() => {
  console.error('Expired call cleanup failed');
  process.exitCode = 1;
});

