#!/usr/bin/env node
'use strict';

const targets = [
  { name: 'frontend', base: process.env.SIGNOVA_FRONTEND_URL, path: '/', json: false },
  { name: 'backend', base: process.env.SIGNOVA_BACKEND_URL, path: '/api/health', json: true },
  { name: 'ai', base: process.env.SIGNOVA_AI_URL, path: '/health', json: true },
].filter((target) => target.base);

const timeoutMs = Number(process.env.SIGNOVA_SMOKE_TIMEOUT_MS || 15000);
const attempts = Number(process.env.SIGNOVA_SMOKE_ATTEMPTS || 4);

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probe(target) {
  const url = new URL(target.path, target.base).toString();
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'User-Agent': 'signova-deployment-smoke/1.0' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (target.json) {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) throw new Error(`unexpected content type ${contentType || 'missing'}`);
        const body = await response.json();
        if (!body || typeof body !== 'object') throw new Error('invalid JSON health payload');
      }
      return { name: target.name, url, attempt, ok: true };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(attempt * 1000);
    }
  }
  throw new Error(`${target.name} smoke check failed at ${url}: ${lastError?.message || 'unknown error'}`);
}

async function main() {
  if (targets.length === 0) {
    throw new Error('Set at least one of SIGNOVA_FRONTEND_URL, SIGNOVA_BACKEND_URL, or SIGNOVA_AI_URL.');
  }
  const results = await Promise.all(targets.map(probe));
  for (const result of results) console.log(JSON.stringify({ event: 'smoke_check', ...result }));
}

main().catch((error) => {
  console.error(JSON.stringify({ event: 'smoke_check_failed', error: error.message }));
  process.exitCode = 1;
});
