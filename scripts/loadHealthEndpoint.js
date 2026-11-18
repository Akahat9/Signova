#!/usr/bin/env node
'use strict';

const targetUrl = process.env.SIGNOVA_LOAD_URL;
const durationSeconds = Math.min(Math.max(Number(process.env.SIGNOVA_LOAD_DURATION_SECONDS || 30), 1), 600);
const concurrency = Math.min(Math.max(Number(process.env.SIGNOVA_LOAD_CONCURRENCY || 5), 1), 100);
const timeoutMs = Number(process.env.SIGNOVA_LOAD_TIMEOUT_MS || 10000);

if (!targetUrl) {
  console.error('Set SIGNOVA_LOAD_URL to a non-destructive GET endpoint, normally /api/health or /health.');
  process.exit(1);
}

const deadline = Date.now() + durationSeconds * 1000;
const latencies = [];
let succeeded = 0;
let failed = 0;

async function worker() {
  while (Date.now() < deadline) {
    const started = performance.now();
    try {
      const response = await fetch(targetUrl, { signal: AbortSignal.timeout(timeoutMs) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      succeeded += 1;
    } catch {
      failed += 1;
    } finally {
      latencies.push(performance.now() - started);
    }
  }
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(Math.ceil(sorted.length * ratio) - 1, sorted.length - 1)];
}

Promise.all(Array.from({ length: concurrency }, worker)).then(() => {
  const total = succeeded + failed;
  const summary = {
    targetUrl,
    durationSeconds,
    concurrency,
    requests: total,
    succeeded,
    failed,
    errorRate: total ? failed / total : 1,
    requestsPerSecond: total / durationSeconds,
    latencyMs: { p50: percentile(latencies, 0.5), p95: percentile(latencies, 0.95), p99: percentile(latencies, 0.99) },
  };
  console.log(JSON.stringify(summary, null, 2));
  if (summary.errorRate > Number(process.env.SIGNOVA_LOAD_MAX_ERROR_RATE || 0.01)) process.exitCode = 1;
});
