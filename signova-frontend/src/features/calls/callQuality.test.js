import { summarizeCallStats } from './callQuality';

test('summarizes healthy WebRTC stats', () => {
  const result = summarizeCallStats([
    { type: 'inbound-rtp', packetsLost: 1, packetsReceived: 199 },
    { type: 'outbound-rtp', bytesSent: 250000 },
    { type: 'candidate-pair', state: 'succeeded', nominated: true, currentRoundTripTime: 0.08 },
  ], { at: 1000, bytes: 100000 }, 2000);

  expect(result.quality.label).toBe('Good');
  expect(result.quality.rttMs).toBe(80);
  expect(result.quality.packetLoss).toBeCloseTo(0.5);
  expect(result.quality.bitrateKbps).toBe(1200);
});

test('labels high loss or latency as poor', () => {
  const result = summarizeCallStats([
    { type: 'inbound-rtp', packetsLost: 10, packetsReceived: 90 },
    { type: 'candidate-pair', state: 'succeeded', selected: true, currentRoundTripTime: 0.5 },
  ], { at: 0, bytes: 0 }, 2000);

  expect(result.quality.label).toBe('Poor');
  expect(result.quality.packetLoss).toBe(10);
  expect(result.quality.rttMs).toBe(500);
});

