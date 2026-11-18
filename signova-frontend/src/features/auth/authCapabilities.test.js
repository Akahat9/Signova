import { AUTH_RECOVERY_METHODS, AUTH_SECURITY_CAPABILITIES, availableRecoveryMethods } from './authCapabilities';

test('advertises only the implemented Firebase email recovery path as available', () => {
  expect(availableRecoveryMethods()).toEqual([expect.objectContaining({ id: 'email', available: true })]);
  expect(AUTH_RECOVERY_METHODS.filter((method) => !method.available).map((method) => method.id)).toEqual(['voice', 'pin']);
});

test('separates implemented Firebase controls from unavailable advanced security', () => {
  expect(AUTH_SECURITY_CAPABILITIES).toMatchObject({
    firebaseEmailVerification: true,
    firebasePasswordReset: true,
    localSessionPersistence: true,
    twoFactorAuthentication: false,
    globalAppLock: false,
    biometricUnlock: false,
    sensitiveActionReauthentication: true,
    serverSessionManagement: false,
    accountDeletion: true,
  });
});
