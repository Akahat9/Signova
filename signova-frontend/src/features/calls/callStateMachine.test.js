import {
  canTransitionCallStatus,
  isIncomingCallStatus,
  isTerminalCallStatus,
} from './callStateMachine';

test('allows the negotiated and reconnecting call lifecycle', () => {
  expect(canTransitionCallStatus('ringing', 'connecting')).toBe(true);
  expect(canTransitionCallStatus('connecting', 'connected')).toBe(true);
  expect(canTransitionCallStatus('connected', 'reconnecting')).toBe(true);
  expect(canTransitionCallStatus('reconnecting', 'connected')).toBe(true);
  expect(canTransitionCallStatus('connected', 'ended')).toBe(true);
});

test('terminal call rooms cannot be resurrected', () => {
  for (const terminal of ['ended', 'rejected', 'failed']) {
    expect(isTerminalCallStatus(terminal)).toBe(true);
    expect(canTransitionCallStatus(terminal, 'ringing')).toBe(false);
    expect(canTransitionCallStatus(terminal, 'connected')).toBe(false);
  }
});

test('only live invitations are treated as incoming', () => {
  expect(isIncomingCallStatus('ringing')).toBe(true);
  expect(isIncomingCallStatus('connecting')).toBe(true);
  expect(isIncomingCallStatus('ended')).toBe(false);
});
