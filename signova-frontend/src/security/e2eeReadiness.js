export const SELECTED_E2EE_PROTOCOL = 'MLS 1.0 (RFC 9420) / OpenMLS';

export const REQUIRED_E2EE_GATES = Object.freeze([
  'pinnedImplementation', 'platformQualified', 'durableEpochState', 'authenticatedKeyPackages',
  'deviceIdentityBinding', 'membershipLifecycleTested', 'ciphertextOnlyTransport',
  'recoveryReviewed', 'externalReviewPassed', 'plaintextFallbackDisabled',
]);

export function evaluateE2EEReadiness(evidence = {}) {
  const missing = REQUIRED_E2EE_GATES.filter((gate) => evidence[gate] !== true);
  const verifiedDevices = Number(evidence.verifiedDevices || 0);
  if (verifiedDevices < 2) missing.push('verifiedDeviceCoverage');
  return Object.freeze({
    available: missing.length === 0,
    protocol: missing.length === 0 ? SELECTED_E2EE_PROTOCOL : null,
    verifiedDevices: missing.length === 0 ? verifiedDevices : 0,
    missing: Object.freeze([...missing]),
    reason: missing.length
      ? `E2EE remains unavailable until ${missing.length} protocol gate${missing.length === 1 ? '' : 's'} pass.`
      : '',
  });
}

