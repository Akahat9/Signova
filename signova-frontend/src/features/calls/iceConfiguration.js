const ALLOWED_ICE_PROTOCOLS = new Set(['stun:', 'stuns:', 'turn:', 'turns:']);

function normalizeUrls(urls) {
  const values = Array.isArray(urls) ? urls : [urls];
  return values.map((value) => String(value || '').trim()).filter(Boolean);
}

function protocolForIceUrl(value) {
  const match = String(value).match(/^([a-z]+):/i);
  return match ? `${match[1].toLowerCase()}:` : '';
}

export function validateCallIceConfiguration(config, { requireTurn = false, nowMs = Date.now() } = {}) {
  if (!config || !Array.isArray(config.iceServers)) throw new Error('Invalid ICE configuration response.');
  const iceServers = config.iceServers.map((server) => {
    const urls = normalizeUrls(server?.urls);
    if (!urls.length || urls.some((url) => !ALLOWED_ICE_PROTOCOLS.has(protocolForIceUrl(url)))) {
      throw new Error('ICE configuration contains an unsupported server URL.');
    }
    const isTurn = urls.some((url) => ['turn:', 'turns:'].includes(protocolForIceUrl(url)));
    if (isTurn && (!String(server.username || '').trim() || !String(server.credential || '').trim())) {
      throw new Error('TURN credentials are incomplete.');
    }
    return { ...server, urls: Array.isArray(server.urls) ? urls : urls[0] };
  });
  if (!iceServers.length) throw new Error('No ICE servers are configured.');

  const hasTurn = iceServers.some((server) => normalizeUrls(server.urls).some((url) => ['turn:', 'turns:'].includes(protocolForIceUrl(url))));
  if (Boolean(config.turnConfigured) !== hasTurn) throw new Error('TURN readiness metadata does not match the ICE server list.');
  if (config.expiresAt) {
    const expiresAt = Date.parse(config.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= nowMs + 30_000) throw new Error('ICE credentials are expired or too close to expiry.');
  }
  if (requireTurn && !hasTurn) throw new Error('TURN relay is required but unavailable.');

  return { iceServers, turnConfigured: hasTurn, iceTransportPolicy: requireTurn ? 'relay' : 'all' };
}

