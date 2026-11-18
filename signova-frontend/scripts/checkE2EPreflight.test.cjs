const assert = require('assert/strict');
const test = require('node:test');
const { parseJavaMajor } = require('./checkE2EPreflight');

test('parses modern and legacy Java major versions for emulator preflight', () => {
  assert.equal(parseJavaMajor('openjdk version "21.0.5" 2024-10-15'), 21);
  assert.equal(parseJavaMajor('java version "1.8.0_402"'), 8);
  assert.equal(parseJavaMajor('java version "25.0.3" 2026-04-15'), 25);
  assert.equal(parseJavaMajor('not a java version'), null);
});
