require('dotenv').config();
const { validateTurnEnvironment } = require('../services/callInfrastructure');

const result = validateTurnEnvironment();
if (!result.ready) {
  console.error(JSON.stringify({ level: 'error', event: 'turn_readiness_failed', issues: result.issues }));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({ level: 'info', event: 'turn_readiness_passed', urlCount: result.urls.length }));
}

