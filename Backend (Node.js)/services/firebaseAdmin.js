const admin = require('firebase-admin');

function getFirebaseAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
  return admin;
}

async function verifyFirebaseRequest(req, options = {}) {
  const {
    requireVerifiedEmail = true,
    checkRevoked = true,
  } = options;
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) {
    const error = new Error('Authentication is required');
    error.statusCode = 401;
    throw error;
  }
  try {
    const token = await getFirebaseAdmin().auth().verifyIdToken(header.slice(7), checkRevoked);
    if (requireVerifiedEmail && token.email_verified !== true) {
      const error = new Error('A verified email is required');
      error.statusCode = 403;
      throw error;
    }
    return token;
  } catch (caughtError) {
    if (caughtError.statusCode === 403) throw caughtError;
    const error = new Error('Invalid authentication token');
    error.statusCode = 401;
    throw error;
  }
}

module.exports = {
  getFirebaseAdmin,
  verifyFirebaseRequest,
};
