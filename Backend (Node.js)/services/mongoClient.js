const dns = require('node:dns');
const { MongoClient, ServerApiVersion } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DATABASE = process.env.MONGODB_DATABASE || 'signova';
const MONGODB_DNS_SERVERS = String(process.env.MONGODB_DNS_SERVERS || '')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);

if (MONGODB_DNS_SERVERS.length > 0) {
  dns.setServers(MONGODB_DNS_SERVERS);
}

let clientPromise = null;
let indexesPromise = null;

function configured() {
  return Boolean(MONGODB_URI);
}

async function getMongoDatabase() {
  if (!configured()) {
    const error = new Error('MongoDB is not configured');
    error.statusCode = 503;
    throw error;
  }
  if (!clientPromise) {
    const client = new MongoClient(MONGODB_URI, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
      maxPoolSize: Number(process.env.MONGODB_MAX_POOL_SIZE || 20),
      minPoolSize: Number(process.env.MONGODB_MIN_POOL_SIZE || 0),
      connectTimeoutMS: Number(process.env.MONGODB_CONNECT_TIMEOUT_MS || 10_000),
      serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || 10_000),
      waitQueueTimeoutMS: Number(process.env.MONGODB_WAIT_QUEUE_TIMEOUT_MS || 5_000),
    });
    clientPromise = client.connect().catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  const client = await clientPromise;
  const database = client.db(MONGODB_DATABASE);
  if (!indexesPromise) {
    indexesPromise = ensureIndexes(database).catch((error) => {
      indexesPromise = null;
      throw error;
    });
  }
  await indexesPromise;
  return database;
}

async function ensureIndexes(database) {
  await Promise.all([
    database.collection('communitySigns').createIndexes([
      { key: { signId: 1 }, name: 'unique_sign_id', unique: true },
      { key: { status: 1, publishedAt: -1 }, name: 'published_signs' },
      { key: { languageFamily: 1, type: 1, category: 1 }, name: 'sign_discovery' },
      { key: { creatorUid: 1, updatedAt: -1 }, name: 'creator_signs' },
    ]),
    database.collection('communityPosts').createIndexes([
      { key: { visibility: 1, createdAt: -1 }, name: 'community_feed' },
      { key: { authorUid: 1, createdAt: -1 }, name: 'author_posts' },
    ]),
    database.collection('aiFeedback').createIndexes([
      { key: { firebaseUid: 1, createdAt: -1 }, name: 'user_feedback' },
      { key: { model: 1, label: 1, createdAt: -1 }, name: 'weak_sign_analysis' },
      { key: { expiresAt: 1 }, name: 'feedback_ttl', expireAfterSeconds: 0 },
    ]),
    database.collection('benchmarkRuns').createIndex(
      { createdAt: -1 },
      { name: 'recent_benchmarks' },
    ),
    database.collection('communityPresence').createIndexes([
      { key: { userId: 1 }, name: 'unique_presence_user', unique: true },
      { key: { expiresAt: 1 }, name: 'presence_ttl', expireAfterSeconds: 0 },
    ]),
    database.collection('communityInstalls').createIndex(
      { userId: 1 },
      { name: 'unique_install_user', unique: true },
    ),
  ]);
}

async function mongoHealth() {
  if (!configured()) return { configured: false, status: 'disabled' };
  try {
    const database = await getMongoDatabase();
    await database.command({ ping: 1 });
    return {
      configured: true,
      status: 'ok',
    };
  } catch {
    return {
      configured: true,
      status: 'unavailable',
    };
  }
}

module.exports = {
  getMongoDatabase,
  mongoHealth,
};
