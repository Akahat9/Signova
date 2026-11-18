require('dotenv').config({ quiet: true });

const http = require('http');
const { handleSentence, handleTranslate } = require('./Routes/translate');
const { health, metrics, predictionTelemetry, sendJson, signs, wholebodyMetrics } = require('./services/aiClient');
const { handleCommunityHeartbeat, handleCommunityInstall, handleCommunityStats } = require('./services/communityStats');
const { handleCommunityPostAction, handleCommunityPostLikes } = require('./services/communityActions');
const { handleIceConfig } = require('./services/callInfrastructure');
const { mongoHealth } = require('./services/mongoClient');
const { handleClaimMlsKeyPackage } = require('./services/mlsKeyPackages');
const { handleClientError } = require('./services/clientErrors');
const { handleDeleteAccount } = require('./services/accountDeletion');
const { handleIdentityCheck, handleIdentityLogin, handleIdentityRecovery, handleIdentityRegister, handleIdentityResolve } = require('./services/identityResolver');
const { verifyFirebaseRequest } = require('./services/firebaseAdmin');
const { statusForError } = require('./services/requestSecurity');
const { instrumentRequest, write: log } = require('./services/logger');
const {
  handleAiFeedback,
  handleCreateCommunitySign,
  handleCommunityPostReport,
  handleListCommunitySigns,
  handlePlatformHealth,
} = require('./services/platformData');

const PORT = Number(process.env.PORT || 5000);

async function handler(req, res) {
  instrumentRequest(req, res);
  try {
    res.signovaReq = req;
    const url = new URL(req.url || '/', 'http://signova.internal');
    const path = url.pathname;

    if (req.method === 'OPTIONS') {
      sendJson(res, 204, {});
      return;
    }

  if (req.method === 'GET' && (path === '/health' || path === '/api/health')) {
    try {
      const [aiHealth, mongo] = await Promise.all([
        health().catch((error) => ({ data: { status: 'offline', error: error.message } })),
        mongoHealth().catch(() => ({ configured: false, status: 'unavailable' })),
      ]);
      const isDegraded = aiHealth.data?.status !== 'ok';
      sendJson(res, 200, {
        service: 'Signova Backend',
        apiSource: 'backend',
        status: isDegraded ? 'degraded' : 'ok',
        ai: aiHealth.data,
        mongo,
      });
    } catch (error) {
      sendJson(res, 200, {
        service: 'Signova Backend',
        apiSource: 'backend',
        status: 'degraded',
        ai: { status: 'offline', error: error.message },
        mongo: { configured: false, status: 'error' },
      });
    }
    return;
  }

  if (req.method === 'GET' && path === '/api/signs') {
    try {
      const result = await signs();
      sendJson(res, result.statusCode, result.data);
    } catch (error) {
      sendJson(res, 503, { error: error.message, signs: [] });
    }
    return;
  }

  if (req.method === 'GET' && path === '/api/metrics') {
    try {
      await verifyFirebaseRequest(req);
      const result = await metrics();
      sendJson(res, result.statusCode, result.data);
    } catch (error) {
      sendJson(res, statusForError(error), { error: error.message, metrics: {} });
    }
    return;
  }

  if (req.method === 'GET' && path === '/api/wholebody/metrics') {
    try {
      await verifyFirebaseRequest(req);
      const result = await wholebodyMetrics();
      sendJson(res, result.statusCode, result.data);
    } catch (error) {
      sendJson(res, statusForError(error), { error: error.message, metrics: {} });
    }
    return;
  }

  if (req.method === 'GET' && path === '/api/prediction-telemetry') {
    try {
      await verifyFirebaseRequest(req);
      const result = await predictionTelemetry();
      sendJson(res, result.statusCode, result.data);
    } catch (error) {
      sendJson(res, statusForError(error), { error: error.message, signs: [] });
    }
    return;
  }

  if (req.method === 'GET' && path === '/api/community/stats') {
    await handleCommunityStats(req, res, url);
    return;
  }

  if (req.method === 'GET' && path === '/api/community/posts/likes') {
    await handleCommunityPostLikes(req, res, url);
    return;
  }

  if (req.method === 'GET' && path === '/api/platform/health') {
    await handlePlatformHealth(req, res);
    return;
  }

  if (req.method === 'GET' && path === '/api/calls/ice-config') {
    await handleIceConfig(req, res);
    return;
  }

  if (req.method === 'GET' && path === '/api/community/signs') {
    await handleListCommunitySigns(req, res, url);
    return;
  }

  if (req.method === 'POST' && path === '/api/community/signs') {
    await handleCreateCommunitySign(req, res);
    return;
  }

  if (req.method === 'POST' && path === '/api/ai/feedback') {
    await handleAiFeedback(req, res);
    return;
  }

  if (req.method === 'POST' && path === '/api/community/install') {
    await handleCommunityInstall(req, res);
    return;
  }

  if (req.method === 'POST' && path === '/api/community/heartbeat') {
    await handleCommunityHeartbeat(req, res);
    return;
  }

  if (req.method === 'POST' && path === '/api/community/posts/action') {
    await handleCommunityPostAction(req, res);
    return;
  }

  if (req.method === 'POST' && path === '/api/community/posts/report') {
    await handleCommunityPostReport(req, res);
    return;
  }

  if (req.method === 'POST' && path === '/api/e2ee/mls/key-packages/claim') {
    await handleClaimMlsKeyPackage(req, res);
    return;
  }

  if (req.method === 'POST' && path === '/api/observability/client-errors') {
    await handleClientError(req, res);
    return;
  }

  if (req.method === 'POST' && path === '/api/account/delete') {
    await handleDeleteAccount(req, res);
    return;
  }

  if (
    req.method === 'POST'
    && (
      path === '/api/predict-landmarks'
      || path === '/api/predict-sequence'
      || path === '/api/predict-sequence-v2'
      || path === '/api/predict-image'
      || path === '/api/wholebody/frame'
      || path === '/api/wholebody/session/clear'
    )
  ) {
    await handleTranslate(req, res, path);
    return;
  }

  if (req.method === 'POST' && path === '/api/sentence') {
    await handleSentence(req, res);
    return;
  }

  if (req.method === 'POST' && path === '/api/auth/identity/check') {
    await handleIdentityCheck(req, res);
    return;
  }
  if (req.method === 'POST' && path === '/api/auth/identity/register') {
    await handleIdentityRegister(req, res);
    return;
  }
  if (req.method === 'POST' && path === '/api/auth/identity/resolve') {
    await handleIdentityResolve(req, res);
    return;
  }
  if (req.method === 'POST' && path === '/api/auth/identity/login') {
    await handleIdentityLogin(req, res);
    return;
  }
  if (req.method === 'POST' && path === '/api/auth/identity/recovery') {
    await handleIdentityRecovery(req, res);
    return;
  }

  sendJson(res, 404, { error: 'Route not found' });
  } catch (error) {
    log('error', 'unhandled_request_error', {
      requestId: req.signovaRequestId,
      method: req.method,
      path: String(req.url || '').split('?')[0],
      errorName: error.name || 'Error',
      statusCode: error.statusCode || 500,
    });
    if (!res.headersSent) {
      sendJson(res, error.statusCode || 500, { error: error.message || 'Internal service error' });
    } else {
      res.destroy();
    }
  }
}

if (require.main === module) {
  const server = http.createServer(handler);
  server.listen(PORT, () => {
    console.log(`Signova backend running at http://127.0.0.1:${PORT}`);
  });

  async function shutdown(signal) {
    console.log(`Received ${signal}; shutting down Signova backend.`);
    server.close((error) => {
      if (error) {
        console.error('Backend shutdown failed');
        process.exitCode = 1;
      }
    });
  }

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

module.exports = handler;
