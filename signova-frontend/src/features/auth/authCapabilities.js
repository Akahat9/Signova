export const AUTH_RECOVERY_METHODS = Object.freeze([
  { id: 'email', icon: 'document', label: 'Email reset link', available: true },
  { id: 'voice', icon: 'audio', label: 'Voice recovery unavailable', available: false },
  { id: 'pin', icon: 'lock', label: 'PIN recovery unavailable', available: false },
]);

export const AUTH_SECURITY_CAPABILITIES = Object.freeze({
  firebaseEmailVerification: true,
  firebasePasswordReset: true,
  localSessionPersistence: true,
  twoFactorAuthentication: false,
  globalAppLock: false,
  biometricUnlock: false,
  loginAlerts: false,
  childSafetyEnforcement: false,
  sensitiveActionReauthentication: true,
  sensitivePreviewHiding: false,
  automaticSessionLock: false,
  serverSessionManagement: false,
  accountDeletion: true,
});

export function availableRecoveryMethods() {
  return AUTH_RECOVERY_METHODS.filter((method) => method.available);
}
