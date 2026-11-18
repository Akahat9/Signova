export function summarizeCallStats(items, previous = { at: 0, bytes: 0 }, now = Date.now()) {
  let packetsLost = 0;
  let packetsReceived = 0;
  let currentRoundTripTime = 0;
  let bytesSent = 0;

  items.forEach((item) => {
    if (item.type === 'inbound-rtp' && !item.isRemote) {
      packetsLost += Number(item.packetsLost || 0);
      packetsReceived += Number(item.packetsReceived || 0);
    }
    if (item.type === 'outbound-rtp' && !item.isRemote) bytesSent += Number(item.bytesSent || 0);
    if (item.type === 'candidate-pair' && item.state === 'succeeded' && (item.nominated || item.selected)) {
      currentRoundTripTime = Number(item.currentRoundTripTime || 0);
    }
  });

  const elapsedSeconds = previous.at ? Math.max(0.25, (now - previous.at) / 1000) : 0;
  const bitrateKbps = elapsedSeconds
    ? Math.max(0, Math.round(((bytesSent - previous.bytes) * 8) / elapsedSeconds / 1000))
    : 0;
  const packetLoss = packetsLost + packetsReceived > 0
    ? (packetsLost / (packetsLost + packetsReceived)) * 100
    : 0;
  const rttMs = Math.round(currentRoundTripTime * 1000);
  const label = packetLoss > 5 || rttMs > 400 ? 'Poor' : packetLoss > 2 || rttMs > 220 ? 'Fair' : 'Good';

  return {
    quality: { label, rttMs, packetLoss, bitrateKbps },
    next: { at: now, bytes: bytesSent },
  };
}

