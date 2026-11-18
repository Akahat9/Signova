const { spawnSync } = require('child_process');

function windowsCommandPath(command) {
  const result = spawnSync('where.exe', [command], { encoding: 'utf8' });
  if (result.status !== 0) return command;
  const matches = (result.stdout || '').split(/\r?\n/).filter(Boolean);
  return matches.find((entry) => entry.toLowerCase().endsWith('.cmd'))
    || matches.find((entry) => entry.toLowerCase().endsWith('.exe'))
    || matches[0]
    || command;
}

function commandOutput(command, args) {
  const resolved = process.platform === 'win32' ? windowsCommandPath(command) : command;
  const result = process.platform === 'win32' && resolved.toLowerCase().endsWith('.cmd')
    ? spawnSync('cmd.exe', ['/d', '/c', `${/\s/.test(resolved) ? `"${resolved}"` : resolved} ${args.join(' ')}`], { encoding: 'utf8' })
    : spawnSync(resolved, args, { encoding: 'utf8' });
  return {
    status: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`.trim(),
    error: result.error,
  };
}

function parseJavaMajor(versionOutput) {
  const match = versionOutput.match(/version\s+"(?:(\d+)\.)?(\d+)(?:[._]\d+)?/i);
  if (!match) return null;
  const first = Number(match[1] || match[2]);
  const second = Number(match[2]);
  return first === 1 ? second : first;
}

module.exports = { parseJavaMajor };

if (require.main !== module) {
  return;
}

function fail(message) {
  console.error(`\nSignova E2E preflight failed:\n${message}\n`);
  process.exit(1);
}

function warn(message) {
  console.warn(`Signova E2E preflight warning: ${message}`);
}

const java = commandOutput('java', ['-version']);
if (java.error || java.status !== 0) {
  fail('Java is required for Firebase emulators. Install Java 21 LTS and ensure `java` is on PATH.');
}

const javaMajor = parseJavaMajor(java.output);
if (!javaMajor) {
  warn(`Could not parse Java version from: ${java.output}`);
} else if (javaMajor > 21 && process.env.SIGNOVA_E2E_ALLOW_UNSUPPORTED_JAVA !== 'true') {
  fail(`Detected Java ${javaMajor}. Firebase emulators for Signova are validated with Java 21 LTS. `
    + 'Install Java 21 or set SIGNOVA_E2E_ALLOW_UNSUPPORTED_JAVA=true if you intentionally want to bypass this guard.');
}

const firebase = commandOutput('firebase', ['--version']);
if (firebase.error || firebase.status !== 0) {
  fail('Firebase CLI is required because Playwright starts Auth/Firestore/Storage emulators. Install firebase-tools or expose `firebase` on PATH.');
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (nodeMajor < 22) {
  warn(`Detected Node ${process.versions.node}. CI uses Node 22; older local versions may behave differently.`);
}

console.log(`Signova E2E preflight passed. Java ${javaMajor || 'unknown'}, Firebase CLI ${firebase.output.split(/\s+/)[0] || 'available'}, Node ${process.versions.node}.`);
