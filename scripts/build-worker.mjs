/**
 * Bundles proxy/src/worker.ts (+ persona.ts) into ONE plain JavaScript file,
 * proxy/worker-dashboard.js, ready to paste into the Cloudflare dashboard
 * editor ("Edit code"). No API key is ever part of this file.
 *
 *   npm run proxy:bundle            → (re)write proxy/worker-dashboard.js
 *   node scripts/build-worker.mjs --check   → exit 1 if the file is out of date
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'proxy', 'worker-dashboard.js');

const banner = `// ============================================================================
//  FAREED AI PROXY — Cloudflare Worker (GENERATED FILE — do not edit by hand)
//  Source: proxy/src/ (worker.ts + persona.ts)  →  npm run proxy:bundle
//  Paste this whole file into: Cloudflare dashboard → Workers & Pages →
//  fareed-ai-proxy → Edit code → worker.js, then press Deploy.
//  The Gemini API key is NOT in this file: it is the secret GEMINI_API_KEY.
// ============================================================================`;

const result = await build({
  entryPoints: [join(root, 'proxy', 'src', 'index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  write: false,
  minify: false,
  legalComments: 'none',
  charset: 'utf8',
  banner: { js: banner },
});
const code = result.outputFiles[0].text.replace(/\r\n/g, '\n');

if (/AIza[0-9A-Za-z_-]{20,}/.test(code)) {
  console.error('Refusing to write: something that looks like a Google API key is in the bundle.');
  process.exit(1);
}

if (process.argv.includes('--check')) {
  const current = existsSync(out) ? readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : '';
  if (current !== code) {
    console.error('proxy/worker-dashboard.js is out of date — run: npm run proxy:bundle');
    process.exit(1);
  }
  console.log('proxy/worker-dashboard.js is up to date.');
} else {
  writeFileSync(out, code);
  console.log(`Wrote ${out} (${code.length} bytes).`);
}
