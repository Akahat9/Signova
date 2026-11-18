import { evaluateE2EEReadiness, REQUIRED_E2EE_GATES, SELECTED_E2EE_PROTOCOL } from './e2eeReadiness';

test('fails closed when any protocol activation evidence is missing', () => {
  const evidence = Object.fromEntries(REQUIRED_E2EE_GATES.map((gate) => [gate, true]));
  evidence.externalReviewPassed = false;
  const result = evaluateE2EEReadiness({ ...evidence, verifiedDevices: 2 });
  expect(result.available).toBe(false);
  expect(result.protocol).toBeNull();
  expect(result.missing).toContain('externalReviewPassed');
});

test('requires at least two verified devices even when engineering gates pass', () => {
  const evidence = Object.fromEntries(REQUIRED_E2EE_GATES.map((gate) => [gate, true]));
  expect(evaluateE2EEReadiness({ ...evidence, verifiedDevices: 1 }).missing).toContain('verifiedDeviceCoverage');
});

test('exposes the selected protocol only after every gate is proven', () => {
  const evidence = Object.fromEntries(REQUIRED_E2EE_GATES.map((gate) => [gate, true]));
  const result = evaluateE2EEReadiness({ ...evidence, verifiedDevices: 3 });
  expect(result).toMatchObject({ available: true, protocol: SELECTED_E2EE_PROTOCOL, verifiedDevices: 3, missing: [] });
});

