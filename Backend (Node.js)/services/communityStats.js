const { sendJson } = require('./aiClient');
const { verifyFirebaseRequest } = require('./firebaseAdmin');
const { getMongoDatabase } = require('./mongoClient');
const { enforceRateLimit, statusForError } = require('./requestSecurity');

const ACTIVE_WINDOW_MS = 60 * 1000;
const MAX_CONTACT_IDS = 200;

function cleanContactIds(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || '').split(',');
  return [...new Set(source
    .map((item) => String(item || '').trim())
    .filter((item) => /^[A-Za-z0-9_-]{1,128}$/.test(item))
    .slice(0, MAX_CONTACT_IDS))];
}

async function summarizeStats(database, contactIds = []) {
  const activeSince = new Date(Date.now() - ACTIVE_WINDOW_MS);
  const contacts = cleanContactIds(contactIds);
  const [downloads, activeUsers, countries, onlineFriends] = await Promise.all([
    database.collection('communityInstalls').estimatedDocumentCount(),
    database.collection('communityPresence').countDocuments({ lastSeenAt: { $gte: activeSince } }),
    database.collection('communityPresence').distinct('country', {
      lastSeenAt: { $gte: activeSince },
      country: { $ne: '' },
    }),
    contacts.length
      ? database.collection('communityPresence').find(
        { userId: { $in: contacts }, lastSeenAt: { $gte: activeSince } },
        { projection: { _id: 0, userId: 1 } },
      ).limit(MAX_CONTACT_IDS).toArray()
      : [],
  ]);

  return {
    downloads,
    activeUsers,
    onlineFriends: onlineFriends.length,
    countries: countries.length,
    onlineFriendIds: onlineFriends.map((item) => item.userId),
    updatedAt: new Date().toISOString(),
  };
}

async function authenticatedContext(req, scope) {
  const token = await verifyFirebaseRequest(req);
  enforceRateLimit(req, token.uid, { scope, maximum: 30 });
  return token;
}

async function handleCommunityInstall(req, res) {
  try {
    const token = await authenticatedContext(req, 'community-install');
    const database = await getMongoDatabase();
    const now = new Date();
    await database.collection('communityInstalls').updateOne(
      { userId: token.uid },
      {
        $setOnInsert: { userId: token.uid, firstSeenAt: now },
        $set: { lastSeenAt: now },
      },
      { upsert: true },
    );
    sendJson(res, 200, await summarizeStats(database));
  } catch (error) {
    sendJson(res, statusForError(error), { error: error.message });
  }
}

async function handleCommunityHeartbeat(req, res) {
  try {
    const token = await authenticatedContext(req, 'community-heartbeat');
    const database = await getMongoDatabase();
    const now = new Date();
    await database.collection('communityPresence').updateOne(
      { userId: token.uid },
      {
        $set: {
          userId: token.uid,
          country: String(token.country || '').slice(0, 2).toUpperCase(),
          lastSeenAt: now,
          expiresAt: new Date(now.getTime() + ACTIVE_WINDOW_MS * 2),
        },
      },
      { upsert: true },
    );
    sendJson(res, 200, await summarizeStats(database));
  } catch (error) {
    sendJson(res, statusForError(error), { error: error.message });
  }
}

async function handleCommunityStats(req, res, url) {
  try {
    await authenticatedContext(req, 'community-stats');
    const database = await getMongoDatabase();
    sendJson(res, 200, await summarizeStats(database, url.searchParams.get('contacts')));
  } catch (error) {
    sendJson(res, statusForError(error), { error: error.message });
  }
}

module.exports = {
  handleCommunityHeartbeat,
  handleCommunityInstall,
  handleCommunityStats,
};
