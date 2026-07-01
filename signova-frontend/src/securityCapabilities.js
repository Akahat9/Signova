/*
 * Security capability state must come from verified protocol state, never from
 * a UI preference or build flag. This remains unavailable until authenticated
 * multi-device key exchange is implemented and verified.
 */
export const conversationE2EE = Object.freeze({
  available: false,
  protocol: null,
  verifiedDevices: 0,
  reason: 'This chat currently uses local-session protection only.',
});
