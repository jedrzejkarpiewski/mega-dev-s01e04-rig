import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const mode = args[args.indexOf('--mode') + 1];
const output = args[args.indexOf('--out') + 1];
if (args.length !== 4 || !args.includes('--mode') || !args.includes('--out') ||
    !['marked', 'clean'].includes(mode) || !output || output.startsWith('--')) {
  throw new Error('Usage: node scripts/export-preview.mjs --mode marked|clean --out <directory>');
}

const destination = resolve(output);
const inside = relative(root, destination);
if (!isAbsolute(inside) && inside !== '..' && !inside.startsWith(`..${sep}`) &&
    !['.preview', '_site'].includes(inside.split(sep)[0])) {
  throw new Error('Output inside the checkout must be under ignored .preview/ or _site/.');
}

const marker = mode === 'marked' ? process.env.LANE_MARKER?.trim() : undefined;
if (mode === 'marked' && !marker) throw new Error('Marked export requires LANE_MARKER.');
await mkdir(destination, { recursive: true });
if ((await readdir(destination)).some((name) => name !== 'index.html')) {
  throw new Error('The output directory may contain only index.html.');
}

// Reserve a free loopback port; the service keeps its usual localhost-only binding.
const probe = createServer();
probe.listen(0, '127.0.0.1');
await once(probe, 'listening');
const port = probe.address().port;
await new Promise((accept, reject) => probe.close((error) => error ? reject(error) : accept()));

const env = { ...process.env, PORT: String(port), LANE_ID: 'lane-07' };
// Launch Node directly: pnpm start would load the local .env again.
delete env.NODE_OPTIONS;
delete env.LANE_MARKER;
if (marker) env.LANE_MARKER = marker;
const server = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
  cwd: root, env, stdio: 'ignore', windowsHide: true,
});
let spawnError;
server.on('error', (error) => { spawnError = error; });
const stopped = new Promise((accept) => server.once('exit', accept));
const base = `http://127.0.0.1:${port}`;

try {
  let ready = false;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (spawnError || server.exitCode !== null) throw new Error('Preview server could not start.');
    try {
      const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(500) });
      ready = health.ok;
      await health.body?.cancel();
      if (ready) break;
    } catch { /* Wait for the server to bind. */ }
    await delay(100);
  }
  if (!ready) throw new Error('Preview server did not become ready.');
  const response = await fetch(`${base}/digest/2026-10-28`, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
    throw new Error('Digest did not return HTML with HTTP 200.');
  }
  const html = await response.text();
  const escape = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  const expectedBanner = `<span class="marker">${escape(marker ?? 'no marker set')}</span>`;
  if (!html.startsWith('<!doctype html>') || !html.includes(expectedBanner) ||
      !html.includes('<h1>digest · 2026-10-28</h1>') || /<script\b|<link\b|<iframe\b/i.test(html)) {
    throw new Error('Digest export failed the self-contained page and banner checks.');
  }
  // This is the exact HTTP body; never print it or the marker.
  await writeFile(resolve(destination, 'index.html'), html, { encoding: 'utf8', mode: 0o600 });
  console.log(`Exported the ${mode} digest as one index.html file.`);
} finally {
  if (server.exitCode === null && !spawnError) {
    server.kill();
    await stopped;
  }
}
