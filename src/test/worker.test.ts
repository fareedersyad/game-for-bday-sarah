/// <reference types="node" />
/**
 * Gemini proxy (Cloudflare Worker) — tested with a MOCKED fetch.
 * These tests never contact Google; the real Gemini call is verified
 * separately after deployment.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { PERSONA } from '../../proxy/src/persona';
import { createHandler, DEFAULT_MODEL, enforcePronouns, LIMITS, RateLimiter, sanitiseMessages, type Env } from '../../proxy/src/worker';
import { gameConfig } from '../config/gameConfig';

const KEY = 'test-key-THIS-MUST-NEVER-LEAK-123';
const ENV: Env = { GEMINI_API_KEY: KEY };
const ORIGIN = 'https://fareedersyad.github.io';

function geminiOk(text: string, extra: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }], ...extra }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function setup(responder: (url: string, init: RequestInit) => Response | Promise<Response> = () => geminiOk('Jom makan, sayang!')) {
  const calls: Array<{ url: string; init: RequestInit; body: any }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init!, body: JSON.parse(String(init!.body)) });
    return responder(url, init!);
  });
  const handle = createHandler({ fetch: fetchMock as unknown as typeof fetch, log: () => {}, limiter: new RateLimiter(1000, 1000) });
  return { handle, calls, fetchMock };
}

function chat(body: unknown, { origin = ORIGIN, type = 'application/json', method = 'POST' }: { origin?: string | null; type?: string; method?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': type, 'CF-Connecting-IP': '203.0.113.7' };
  if (origin) headers.Origin = origin;
  return new Request('https://fareed-ai-proxy.example.workers.dev/chat', {
    method,
    headers,
    body: method === 'GET' || method === 'OPTIONS' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const hello = { messages: [{ role: 'user', content: 'Sayang, saya lapar' }], context: 'Location: garden.' };

async function read(res: Response) {
  const text = await res.text();
  expect(text).not.toContain(KEY);
  return JSON.parse(text);
}

describe('Gemini proxy — routing, CORS and validation', () => {
  it('GET /health reports status without exposing the key', async () => {
    const { handle, fetchMock } = setup();
    const res = await handle(new Request('https://x.workers.dev/health'), ENV);
    expect(res.status).toBe(200);
    expect(await read(res)).toMatchObject({ ok: true, endpoint: 'POST /chat', configured: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('answers the CORS preflight only for allowed sites', async () => {
    const { handle } = setup();
    const ok = await handle(chat(null, { method: 'OPTIONS' }), ENV);
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(ok.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    for (const local of ['http://localhost:5173', 'http://localhost:4173']) {
      const r = await handle(chat(null, { method: 'OPTIONS', origin: local }), ENV);
      expect(r.headers.get('Access-Control-Allow-Origin')).toBe(local);
    }
    const bad = await handle(chat(null, { method: 'OPTIONS', origin: 'https://evil.example' }), ENV);
    expect(bad.status).toBe(403);
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('rejects other websites, missing Origin, wrong method, path and content type', async () => {
    const { handle, fetchMock } = setup();
    expect((await handle(chat(hello, { origin: 'https://evil.example' }), ENV)).status).toBe(403);
    expect((await handle(chat(hello, { origin: null }), ENV)).status).toBe(403);
    expect((await handle(chat(null, { method: 'GET' }), ENV)).status).toBe(405);
    expect((await handle(chat(hello, { type: 'text/plain' }), ENV)).status).toBe(415);
    const nf = await handle(new Request('https://x.workers.dev/other', { method: 'POST', headers: { Origin: ORIGIN } }), ENV);
    expect(nf.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ALLOWED_ORIGINS overrides the default list', async () => {
    const { handle } = setup();
    const env = { ...ENV, ALLOWED_ORIGINS: 'https://custom.example, http://localhost:5173/' };
    expect((await handle(chat(hello, { origin: 'https://custom.example' }), env)).status).toBe(200);
    expect((await handle(chat(hello), env)).status).toBe(403);
  });

  it('validates JSON, messages and size', async () => {
    const { handle, fetchMock } = setup();
    const bad = async (body: unknown) => read(await handle(chat(body), ENV));
    expect((await bad('{not json')).error.code).toBe('invalid_json');
    expect((await bad({})).error.code).toBe('invalid_messages');
    expect((await bad({ messages: [] })).error.code).toBe('invalid_messages');
    expect((await bad({ messages: [{ role: 'system', content: 'x' }] })).error.code).toBe('invalid_messages');
    expect((await bad({ messages: [{ role: 'user', content: 42 }] })).error.code).toBe('invalid_messages');
    expect((await bad({ messages: [{ role: 'user', content: 'hai' }, { role: 'assistant', content: 'hai juga' }] })).error.code).toBe('invalid_messages');
    const huge = await handle(chat({ messages: [{ role: 'user', content: 'x'.repeat(LIMITS.maxBodyBytes + 10) }] }), ENV);
    expect(huge.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a clear error when the GEMINI_API_KEY secret is missing', async () => {
    const { handle, fetchMock } = setup();
    const res = await handle(chat(hello), {});
    expect(res.status).toBe(500);
    expect((await read(res)).error.code).toBe('not_configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Gemini proxy — the Gemini request', () => {
  it('sends the key in a header (never the URL) and returns the reply', async () => {
    const { handle, calls } = setup();
    const res = await handle(chat(hello), ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(await read(res)).toEqual({ reply: 'Jom makan, sayang!', model: DEFAULT_MODEL });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent`);
    expect(calls[0].url).not.toContain(KEY);
    expect((calls[0].init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
    expect(calls[0].body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'MINIMAL' });
  });

  it('uses the Fareed persona and the game situation as the system instruction', async () => {
    const { handle, calls } = setup();
    await handle(chat(hello), ENV);
    const system: string = calls[0].body.systemInstruction.parts[0].text;
    expect(system.startsWith(PERSONA)).toBe(true);
    expect(system).toContain('Location: garden.');
    expect(PERSONA).toContain('"saya"');
    expect(PERSONA).toContain('"awak"');
    expect(PERSONA).toMatch(/JANGAN reka kenangan/);
  });

  it('never sends the in-game memory stars (SHARED_MEMORIES) to Gemini', async () => {
    const { handle, calls } = setup();
    await handle(chat(hello), ENV);
    const sent = JSON.stringify(calls[0].body);
    for (const m of gameConfig.SHARED_MEMORIES) {
      expect(sent).not.toContain(m.text);
      expect(PERSONA).not.toContain(m.text);
    }
  });

  it('keeps the conversation in order, newest last, and maps roles', async () => {
    const { handle, calls } = setup();
    const messages = [
      { role: 'assistant', content: 'Taip apa-apa je, sayang. Saya dengar.' },
      { role: 'user', content: 'Hai' },
      { role: 'assistant', content: 'Hai cantik!' },
      { role: 'user', content: 'Saya penat' },
      { role: 'user', content: 'sangat' },
    ];
    await handle(chat({ messages }), ENV);
    expect(calls[0].body.contents).toEqual([
      { role: 'user', parts: [{ text: 'Hai' }] },
      { role: 'model', parts: [{ text: 'Hai cantik!' }] },
      { role: 'user', parts: [{ text: 'Saya penat\nsangat' }] },
    ]);
  });

  it('forwards only the most recent turns (memory window)', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
    many.push({ role: 'user', content: 'last' });
    const kept = sanitiseMessages(many)!;
    expect(kept.length).toBeLessThanOrEqual(LIMITS.maxTurns);
    expect(kept[0].role).toBe('user');
    expect(kept[kept.length - 1]).toEqual({ role: 'user', content: 'last' });
    expect(kept[kept.length - 2]).toEqual({ role: 'assistant', content: 'm29' });
  });

  it('older models get temperature instead of thinkingLevel; bad model ids fall back', async () => {
    const { handle, calls } = setup();
    await handle(chat(hello), { ...ENV, GEMINI_MODEL: 'gemini-2.5-flash-lite' });
    expect(calls[0].url).toContain('/gemini-2.5-flash-lite:generateContent');
    expect(calls[0].body.generationConfig.thinkingConfig).toBeUndefined();
    await handle(chat(hello), { ...ENV, GEMINI_MODEL: '../../evil?x=' });
    expect(calls[1].url).toContain(`/${DEFAULT_MODEL}:generateContent`);
  });

  it('enforces "saya / awak" and plain text in the reply', async () => {
    const { handle } = setup(() => geminiOk('**Aku** rindu kau, kamu tahu? Engkau comel.'));
    const data = await read(await handle(chat(hello), ENV));
    expect(data.reply).toBe('Saya rindu awak, awak tahu? Awak comel.');
    expect(enforcePronouns('kaunter dan sakura')).toBe('kaunter dan sakura');
  });
});

describe('Gemini proxy — failures', () => {
  const status = (code: number, body = '{}') => () => new Response(body, { status: code, headers: { 'Content-Type': 'application/json' } });

  it('maps Gemini errors to safe, clear codes (no upstream text echoed)', async () => {
    const cases: Array<[() => Response, number, string]> = [
      [status(429), 429, 'upstream_rate_limited'],
      [status(400, '{"error":{"message":"API key not valid. secret-detail","details":[{"reason":"API_KEY_INVALID"}]}}'), 502, 'upstream_auth'],
      [status(403), 502, 'upstream_auth'],
      [status(404), 502, 'upstream_model'],
      [status(400, '{"error":{"message":"bad"}}'), 502, 'upstream_bad_request'],
    ];
    for (const [responder, httpStatus, code] of cases) {
      const { handle } = setup(responder);
      const res = await handle(chat(hello), ENV);
      expect(res.status).toBe(httpStatus);
      const text = await res.text();
      expect(JSON.parse(text).error.code).toBe(code);
      expect(text).not.toContain('secret-detail');
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    }
  });

  it('retries a transient 503 once, then gives up', async () => {
    const { handle, fetchMock } = setup(status(503));
    const res = await handle(chat(hello), ENV);
    expect(res.status).toBe(502);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports a timeout when Gemini does not answer', async () => {
    const { handle } = setup(() => {
      throw new DOMException('aborted', 'AbortError');
    });
    const res = await handle(chat(hello), ENV);
    expect(res.status).toBe(504);
    expect((await read(res)).error.code).toBe('upstream_timeout');
  });

  it('reports a network failure', async () => {
    const { handle } = setup(() => {
      throw new TypeError('fetch failed');
    });
    expect((await handle(chat(hello), ENV)).status).toBe(502);
  });

  it('handles blocked and empty answers', async () => {
    const blocked = setup(() => new Response(JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } }), { status: 200 }));
    const b = await read(await blocked.handle(chat(hello), ENV));
    expect(b.blocked).toBe(true);
    expect(b.reply).toMatch(/saya tak boleh jawab/);
    const empty = setup(() => new Response(JSON.stringify({ candidates: [{ content: { parts: [] }, finishReason: 'STOP' }] }), { status: 200 }));
    const e = await empty.handle(chat(hello), ENV);
    expect(e.status).toBe(502);
    expect((await read(e)).error.code).toBe('upstream_empty');
  });

  it('rate-limits a visitor who sends too many messages', async () => {
    const fetchMock = vi.fn(async () => geminiOk('ok'));
    const handle = createHandler({ fetch: fetchMock as unknown as typeof fetch, log: () => {}, now: () => 1_000_000 });
    const statuses: number[] = [];
    for (let i = 0; i < LIMITS.perMinute + 1; i++) statuses.push((await handle(chat(hello), ENV)).status);
    expect(statuses.slice(0, LIMITS.perMinute).every((s) => s === 200)).toBe(true);
    const last = await handle(chat(hello), ENV);
    expect(last.status).toBe(429);
    expect(Number(last.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('logs only counters — never message text or the key', async () => {
    const events: string[] = [];
    const handle = createHandler({ fetch: (async () => geminiOk('Rehat dulu')) as unknown as typeof fetch, log: (e) => events.push(JSON.stringify(e)) });
    await handle(chat(hello), ENV);
    expect(events.length).toBeGreaterThan(0);
    for (const e of events) {
      expect(e).not.toContain(KEY);
      expect(e).not.toContain('lapar');
      expect(e).not.toContain('Rehat');
    }
  });
});

describe('Gemini proxy — dashboard bundle', () => {
  const root = join(__dirname, '..', '..');
  it('proxy/worker-dashboard.js is up to date with proxy/src and contains no key', () => {
    execFileSync(process.execPath, [join(root, 'scripts', 'build-worker.mjs'), '--check'], { cwd: root, stdio: 'pipe' });
    const bundle = readFileSync(join(root, 'proxy', 'worker-dashboard.js'), 'utf8');
    expect(bundle).not.toMatch(/AIza[0-9A-Za-z_-]{20,}/);
    expect(bundle).toMatch(/export \{\s*index_default as default\s*\}/);
    expect(bundle).not.toMatch(/import\s/);
  });
});
