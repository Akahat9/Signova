import { evaluateE2EEReadiness } from './security/e2eeReadiness';

/*
 * Security capability state must come from verified protocol state, never from
 * a UI preference or build flag. This remains unavailable until authenticated
 * multi-device key exchange is implemented and verified.
 */
export const conversationE2EE = evaluateE2EEReadiness({});
