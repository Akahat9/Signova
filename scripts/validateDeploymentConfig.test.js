const assert = require('node:assert/strict');
const test = require('node:test');
const { validateDeploymentConfig } = require('./validateDeploymentConfig');

const valid = {
  SIGNOVA_DEPLOY_ENVIRONMENT: 'staging',
  REACT_APP_PUBLIC_SITE_URL: 'https://staging.signova.example',
  REACT_APP_SIGNOVA_API_URL: 'https://api-staging.signova.example',
  REACT_APP_FIREBASE_PROJECT_ID: 'signova-staging',
  REACT_APP_FIREBASE_STORAGE_BUCKET: 'signova-staging.firebasestorage.app',
  REACT_APP_FIREBASE_API_KEY: 'public-web-key',
  REACT_APP_FIREBASE_APP_ID: '1:123:web:abc',
};

test('accepts isolated HTTPS deployment configuration', () => {
  assert.deepEqual(validateDeploymentConfig(valid), { valid: true, issues: [] });
});

test('rejects localhost, insecure, same-origin, and malformed production configuration', () => {
  const result = validateDeploymentConfig({
    ...valid,
    SIGNOVA_DEPLOY_ENVIRONMENT: 'production',
    REACT_APP_PUBLIC_SITE_URL: 'http://localhost:3000',
    REACT_APP_SIGNOVA_API_URL: 'http://localhost:3000/',
    REACT_APP_FIREBASE_PROJECT_ID: 'BAD',
    REACT_APP_FIREBASE_STORAGE_BUCKET: 'invalid',
  });
  assert.equal(result.valid, false);
  const text = result.issues.join(' ');
  assert.match(text, /must use https/);
  assert.match(text, /cannot target localhost/);
  assert.match(text, /distinct origins/);
  assert.match(text, /PROJECT_ID has an invalid format/);
  assert.match(text, /STORAGE_BUCKET has an invalid format/);
});

test('reports every missing required deployment value', () => {
  const result = validateDeploymentConfig({});
  assert.equal(result.valid, false);
  assert.ok(result.issues.length >= 7);
});

