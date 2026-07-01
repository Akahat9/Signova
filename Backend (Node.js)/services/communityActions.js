const { readJson, sendJson } = require('./aiClient');
const { getFirebaseAdmin, verifyFirebaseRequest } = require('./firebaseAdmin');
const { enforceRateLimit, statusForError } = require('./requestSecurity');

const ACTIONS = new Set(['toggle-like', 'share']);

async function handleCommunityPostAction(req, res) {
  try {
    const token = await verifyFirebaseRequest(req);
    enforceRateLimit(req, token.uid, { scope: 'community-action', maximum: 60 });
    const payload = await readJson(req);
    const postId = String(payload.postId || '').trim();
    const action = String(payload.action || '').trim();
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(postId) || !ACTIONS.has(action)) {
      sendJson(res, 400, { error: 'A valid postId and action are required' });
      return;
    }

    const firestore = getFirebaseAdmin().firestore();
    const postRef = firestore.collection('publicCommunityPosts').doc(postId);
    const result = await firestore.runTransaction(async (transaction) => {
      const postSnapshot = await transaction.get(postRef);
      if (!postSnapshot.exists) {
        const error = new Error('Community post not found');
        error.statusCode = 404;
        throw error;
      }

      const stats = postSnapshot.data().stats || {};
      if (action === 'toggle-like') {
        const likeRef = postRef.collection('likes').doc(token.uid);
        const likeSnapshot = await transaction.get(likeRef);
        const liked = !likeSnapshot.exists;
        if (liked) {
          transaction.set(likeRef, {
            userId: token.uid,
            createdAt: getFirebaseAdmin().firestore.FieldValue.serverTimestamp(),
          });
        } else {
          transaction.delete(likeRef);
        }
        const likes = Math.max(0, Number(stats.likes || 0) + (liked ? 1 : -1));
        transaction.update(postRef, {
          'stats.likes': likes,
          updatedAt: getFirebaseAdmin().firestore.FieldValue.serverTimestamp(),
        });
        return { liked, likes };
      }

      const shareRef = postRef.collection('shares').doc(token.uid);
      const shareSnapshot = await transaction.get(shareRef);
      if (!shareSnapshot.exists) {
        transaction.set(shareRef, {
          userId: token.uid,
          createdAt: getFirebaseAdmin().firestore.FieldValue.serverTimestamp(),
        });
        transaction.update(postRef, {
          'stats.shares': Math.max(0, Number(stats.shares || 0) + 1),
          updatedAt: getFirebaseAdmin().firestore.FieldValue.serverTimestamp(),
        });
      }
      return {
        shared: true,
        shares: Math.max(0, Number(stats.shares || 0) + (shareSnapshot.exists ? 0 : 1)),
      };
    });

    sendJson(res, 200, result);
  } catch (error) {
    sendJson(res, statusForError(error), { error: error.message });
  }
}

module.exports = {
  handleCommunityPostAction,
};
