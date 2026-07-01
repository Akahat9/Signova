require('dotenv').config({ quiet: true });

const http = require('http');
const { handleSentence, handleTranslate } = require('./Routes/translate');
const { health, metrics, predictionTelemetry, sendJson, signs, wholebodyMetrics } = require('./services/aiClient');
const { handleCommunityHeartbeat, handleCommunityInstall, handleCommunityStats } = require('./services/communityStats');
const { handleCommunityPostAction } = require('./services/communityActions');
const { handleIdentityCheck, handleIdentityLogin, handleIdentityRecovery, handleIdentityRegister } = require('./services/identityResolver');
const { verifyFirebaseRequest } = require('./services/firebaseAdmin');
const {
  handleAiFeedback,
  handleCreateCommunitySign,
  handleListCommunitySigns,
  handlePlatformHealth,
} = require('./services/platformData');

const PORT = Number(process.env.PORT || 5000);

async function handler(req, res) {
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
      const aiHealth = await health();
      sendJson(res, 200, {
        service: 'Signova Backend',
        status: 'ok',
        ai: aiHealth.data,
      });
    } catch (error) {
      sendJson(res, 503, {
        service: 'Signova Backend',
        status: 'degraded',
        error: error.message,
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
      sendJson(res, 503, { error: error.message, metrics: {} });
    }
    return;
  }

  if (req.method === 'GET' && path === '/api/wholebody/metrics') {
    try {
      await verifyFirebaseRequest(req);
      const result = await wholebodyMetrics();
      sendJson(res, result.statusCode, result.data);
    } catch (error) {
      sendJson(res, 503, { error: error.message, metrics: {} });
    }
    return;
  }

  if (req.method === 'GET' && path === '/api/prediction-telemetry') {
    try {
      await verifyFirebaseRequest(req);
      const result = await predictionTelemetry();
      sendJson(res, result.statusCode, result.data);
    } catch (error) {
      sendJson(res, 503, { error: error.message, signs: [] });
    }
    return;
  }

  if (req.method === 'GET' && path === '/api/community/stats') {
    await handleCommunityStats(req, res, url);
    return;
  }

  if (req.method === 'GET' && path === '/api/platform/health') {
    await handlePlatformHealth(req, res);
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
