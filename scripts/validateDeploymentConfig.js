function required(env, name, issues) {
  const value = String(env[name] || '').trim();
  if (!value) issues.push(`${name} is required.`);
  return value;
}

function validateHttpsUrl(value, name, issues) {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') issues.push(`${name} must use https.`);
    if (['localhost', '127.0.0.1', '::1'].includes(url.hostname)) issues.push(`${name} cannot target localhost.`);
    if (url.username || url.password) issues.push(`${name} must not contain embedded credentials.`);
  } catch {
    issues.push(`${name} must be a valid absolute URL.`);
  }
}

function validateDeploymentConfig(env = process.env) {
  const issues = [];
  const environment = required(env, 'SIGNOVA_DEPLOY_ENVIRONMENT', issues);
  const frontendUrl = required(env, 'REACT_APP_PUBLIC_SITE_URL', issues);
  const backendUrl = required(env, 'REACT_APP_SIGNOVA_API_URL', issues);
  const firebaseProject = required(env, 'REACT_APP_FIREBASE_PROJECT_ID', issues);
  const storageBucket = required(env, 'REACT_APP_FIREBASE_STORAGE_BUCKET', issues);
  required(env, 'REACT_APP_FIREBASE_API_KEY', issues);
  required(env, 'REACT_APP_FIREBASE_APP_ID', issues);
  validateHttpsUrl(frontendUrl, 'REACT_APP_PUBLIC_SITE_URL', issues);
  validateHttpsUrl(backendUrl, 'REACT_APP_SIGNOVA_API_URL', issues);
  if (frontendUrl && backendUrl && frontendUrl.replace(/\/$/, '') === backendUrl.replace(/\/$/, '')) {
    issues.push('Frontend and backend URLs must be distinct origins.');
  }
  if (firebaseProject && !/^[a-z0-9][a-z0-9-]{4,28}[a-z0-9]$/.test(firebaseProject)) {
    issues.push('REACT_APP_FIREBASE_PROJECT_ID has an invalid format.');
  }
  if (storageBucket && !storageBucket.includes('.')) issues.push('REACT_APP_FIREBASE_STORAGE_BUCKET has an invalid format.');
  if (!['staging', 'production'].includes(environment)) issues.push('SIGNOVA_DEPLOY_ENVIRONMENT must be staging or production.');
  return { valid: issues.length === 0, issues };
}

if (require.main === module) {
  const result = validateDeploymentConfig();
  if (!result.valid) {
    console.error(JSON.stringify({ level: 'error', event: 'deployment_config_invalid', issues: result.issues }));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ level: 'info', event: 'deployment_config_valid' }));
  }
}

module.exports = { validateDeploymentConfig };

