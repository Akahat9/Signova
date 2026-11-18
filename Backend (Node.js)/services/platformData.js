const crypto = require('crypto');
const { readJson, sendJson } = require('./aiClient');
const { getFirebaseAdmin, verifyFirebaseRequest } = require('./firebaseAdmin');
const { getMongoDatabase, mongoHealth } = require('./mongoClient');

const SIGN_TYPES = new Set(['letter', 'word', 'sentence']);
const SIGN_STATUSES = new Set(['draft', 'published', 'archived']);

function cleanText(value, maximum = 500) {
  return String(value || '').trim().slice(0, maximum);
}

function cleanStringArray(value, maximum = 8) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item, 500)).filter(Boolean).slice(0, maximum);
}

function safeLimit(url, fallback = 20, maximum = 50) {
  const requested = Number(url.searchParams.get('limit') || fallback);
  return Number.isInteger(requested) && requested > 0
    ? Math.min(maximum, requested)
    : fallback;
}

async function handlePlatformHealth(req, res) {
  sendJson(res, 200, {
    service: 'Signova data platform',
    firebase: {
      role: 'authentication, private identity mapping, realtime chat/calling, live community posts, and media',
      configured: Boolean(process.env.FIREBASE_PROJECT_ID),
    },
    mongodb: {
      ...(await mongoHealth()),
      role: 'sign catalogue, post moderation/search projections, AI feedback, benchmark metadata, and aggregates',
    },
  });
}

function buildModerationCase(payload, reporterUid, now = new Date()) {
  const postId = cleanText(payload.postId, 128);
  const reason = cleanText(payload.reason, 500);
  const category = cleanText(payload.category, 40).toLowerCase();
  const allowedCategories = new Set(['safety', 'harassment', 'spam', 'misinformation', 'copyright', 'other']);
  if (!postId || !reason || !allowedCategories.has(category)) {
    const error = new Error('postId, reason, and a valid category are required');
    error.statusCode = 400;
    throw error;
  }
  const requestedRetention = Number(process.env.MONGODB_MODERATION_RETENTION_DAYS || 365);
  const retentionDays = Number.isFinite(requestedRetention)
    ? Math.min(730, Math.max(30, requestedRetention))
    : 365;
  return {
    moderationId: crypto.randomUUID(),
    postId,
    reporterUid,
    category,
    reason,
    status: 'open',
    source: 'firestore-publicCommunityPosts',
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + retentionDays * 86_400_000),
  };
}

async function handleCommunityPostReport(req, res) {
  return handleCommunityPostReportWithDependencies(req, res);
}

async function assertCommunityPostExists(postId, sdk = getFirebaseAdmin()) {
  const snapshot = await sdk.firestore().collection('publicCommunityPosts').doc(postId).get();
  if (!snapshot.exists) {
    const error = new Error('Community post not found');
    error.statusCode = 404;
    throw error;
  }
  return snapshot.data() || {};
}

async function handleCommunityPostReportWithDependencies(req, res, dependencies = {}) {
  const authenticate = dependencies.verifyFirebaseRequest || verifyFirebaseRequest;
  const parseJson = dependencies.readJson || readJson;
  const openMongo = dependencies.getMongoDatabase || getMongoDatabase;
  const ensurePostExists = dependencies.assertCommunityPostExists || assertCommunityPostExists;
  try {
    const token = await authenticate(req);
    const document = buildModerationCase(await parseJson(req), token.uid);
    await ensurePostExists(document.postId);
    const database = await openMongo();
    const saved = await database.collection('communityPostModeration').findOneAndUpdate(
      { postId: document.postId, reporterUid: token.uid },
      {
        $set: {
          category: document.category,
          reason: document.reason,
          status: 'open',
          source: document.source,
          updatedAt: document.updatedAt,
          expiresAt: document.expiresAt,
        },
        $setOnInsert: {
          moderationId: document.moderationId,
          postId: document.postId,
          reporterUid: token.uid,
          createdAt: document.createdAt,
        },
      },
      { upsert: true, returnDocument: 'after', projection: { _id: 0, moderationId: 1 } },
    );
    sendJson(res, 201, { reported: true, moderationId: saved?.moderationId || document.moderationId });
  } catch (error) {
    sendJson(res, error.statusCode || 503, { error: error.message });
  }
}

async function handleCreateCommunitySign(req, res) {
  try {
    const token = await verifyFirebaseRequest(req);
    const payload = await readJson(req);
    const type = cleanText(payload.type, 20).toLowerCase();
    const status = 'draft';
    if (!cleanText(payload.title, 120) || !SIGN_TYPES.has(type) || !SIGN_STATUSES.has(status)) {
      sendJson(res, 400, { error: 'title, valid type, and valid status are required' });
      return;
    }
    const now = new Date();
    const document = {
      signId: cleanText(payload.signId, 80) || crypto.randomUUID(),
      creatorUid: token.uid,
      title: cleanText(payload.title, 120),
      meaning: cleanText(payload.meaning, 300),
      languageFamily: cleanText(payload.languageFamily, 40).toUpperCase(),
      type,
      category: cleanText(payload.category, 60),
      difficulty: cleanText(payload.difficulty, 30),
      description: cleanText(payload.description, 2_000),
      buildPath: cleanText(payload.buildPath, 500),
      media: {
        videoUrl: cleanText(payload.media?.videoUrl, 1_000),
        imageUrls: cleanStringArray(payload.media?.imageUrls),
      },
      visibility: cleanText(payload.visibility || 'community', 30),
      trainingConsent: Boolean(payload.trainingConsent),
      verificationStatus: 'pending',
      status,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
    };
    const database = await getMongoDatabase();
    await database.collection('communitySigns').updateOne(
      { signId: document.signId, creatorUid: token.uid },
      {
        $set: document,
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    );
    sendJson(res, 201, {
      signId: document.signId,
      status: document.status,
    });
  } catch (error) {
    sendJson(res, error.statusCode || 503, { error: error.message });
  }
}

async function handleListCommunitySigns(req, res, url) {
  try {
    const database = await getMongoDatabase();
    const signs = await database.collection('communitySigns')
      .find(
        {
          status: 'published',
          verificationStatus: 'approved',
          visibility: { $in: ['public', 'community'] },
        },
        {
          projection: {
            _id: 0,
            creatorUid: 0,
            trainingConsent: 0,
          },
        },
      )
      .sort({ publishedAt: -1 })
      .limit(safeLimit(url))
      .toArray();
    sendJson(res, 200, { signs });
  } catch (error) {
    sendJson(res, error.statusCode || 503, { error: error.message, signs: [] });
  }
}

async function handleAiFeedback(req, res) {
  try {
    const token = await verifyFirebaseRequest(req);
    const payload = await readJson(req);
    const label = cleanText(payload.label, 120);
    if (!label) {
      sendJson(res, 400, { error: 'label is required' });
      return;
    }
    const now = new Date();
    const configuredRetention = Number(process.env.MONGODB_FEEDBACK_RETENTION_DAYS || 90);
    const retentionDays = Number.isFinite(configuredRetention)
      ? Math.min(365, Math.max(7, configuredRetention))
      : 90;
    const requestedConfidence = Number(payload.confidence);
    const confidence = Number.isFinite(requestedConfidence)
      ? Math.max(0, Math.min(1, requestedConfidence))
      : 0;
    const database = await getMongoDatabase();
    await database.collection('aiFeedback').insertOne({
      feedbackId: crypto.randomUUID(),
      firebaseUid: token.uid,
      label,
      expectedLabel: cleanText(payload.expectedLabel, 120),
      model: cleanText(payload.model, 80),
      language: cleanText(payload.language, 40),
      mode: cleanText(payload.mode, 40),
      confidence,
      reason: cleanText(payload.reason, 500),
      consentForTraining: Boolean(payload.consentForTraining),
      createdAt: now,
      expiresAt: new Date(now.getTime() + retentionDays * 86_400_000),
      privacy: 'No raw frame, landmark array, transcript, email, or phone stored.',
    });
    sendJson(res, 201, { recorded: true });
  } catch (error) {
    sendJson(res, error.statusCode || 503, { error: error.message });
  }
}

module.exports = {
  assertCommunityPostExists,
  buildModerationCase,
  handleAiFeedback,
  handleCreateCommunitySign,
  handleCommunityPostReport,
  handleCommunityPostReportWithDependencies,
  handleListCommunitySigns,
  handlePlatformHealth,
};
