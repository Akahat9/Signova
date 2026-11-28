import { evaluateE2EEReadiness } from './security/e2eeReadiness';

/*
 * Security capability state must come from verified protocol state, never from
 * a UI preference or build flag. This remains unavailable until authenticated
 * multi-device key exchange is implemented and verified.
 */
export const conversationE2EE = evaluateE2EEReadiness({});

export function resolveConversationE2EEState(session) {
  if (session?.available && session?.protocol && Number(session?.verifiedDevices) >= 2) {
    return Object.freeze({
      available: true,
      protocol: session.protocol,
      verifiedDevices: Number(session.verifiedDevices),
      localFingerprint: session.localFingerprint || '',
      peerFingerprint: session.peerFingerprint || '',
      reason: '',
    });
  }
  return Object.freeze({
    available: false,
    protocol: null,
    verifiedDevices: Number(session?.verifiedDevices || 0),
    reason: session?.reason || conversationE2EE.reason,
  });
}
