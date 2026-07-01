const crypto = require('crypto');
const { readJson, sendJson } = require('./aiClient');
const { verifyFirebaseRequest } = require('./firebaseAdmin');
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
      role: 'authentication, private identity mapping, realtime chat, user-owned operational state',
      configured: Boolean(process.env.FIREBASE_PROJECT_ID),
    },
    mongodb: {
      ...(await mongoHealth()),
      role: 'community content, sign catalogue, AI feedback, benchmark metadata',
    },
  });
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
  handleAiFeedback,
  handleCreateCommunitySign,
  handleListCommunitySigns,
  handlePlatformHealth,
};
