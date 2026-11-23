/**
 * ============================================================================
 *  FAREED AI PROXY — Cloudflare Worker for Google Gemini
 * ============================================================================
 *  The game (GitHub Pages) sends   POST /chat  { messages, context }
 *  and receives                     { reply }    or  { error: { code, message } }
 *
 *  The Gemini API key NEVER reaches the browser: it is stored as the Worker
 *  secret GEMINI_API_KEY (Cloudflare dashboard → Settings → Variables and
 *  Secrets) and only used here, server-side, in a request header.
 *
 *  Optional plain-text variables:
 *    ALLOWED_ORIGINS  comma-separated sites allowed to call the proxy
 *                     (default: DEFAULT_ORIGINS below)
 *    GEMINI_MODEL     Gemini model id (default: DEFAULT_MODEL below)
 *
 *  Uses only standard Web APIs (fetch, Request, Response) — no npm packages —
 *  so the bundled file can be pasted straight into the Cloudflare dashboard.
 * ============================================================================
 */
import { PERSONA, withGameSituation } from './persona';

export interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  ALLOWED_ORIGINS?: string;
}

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_ORIGINS = [
  'https://fareedersyad.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
];

export const LIMITS = {
  /** Most recent turns forwarded to Gemini (the "memory" window). */
  maxTurns: 16,
  /** Turns accepted in one request (older ones are ignored). */
  maxTurnsAccepted: 40,
  maxCharsPerTurn: 800,
  maxContextChars: 600,
  maxBodyBytes: 32_000,
  maxReplyChars: 700,
  /** Gemini request timeout (ms). The game itself gives up after 25 s. */
  upstreamTimeoutMs: 15_000,
  /** Best-effort per-visitor limits (per Worker instance). */
  perMinute: 8,
  perDay: 150,
};

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

type Role = 'user' | 'assistant';
export interface Turn {
  role: Role;
  content: string;
}

export type ErrorCode =
  | 'not_found'
  | 'method_not_allowed'
  | 'origin_not_allowed'
  | 'unsupported_media_type'
  | 'payload_too_large'
  | 'invalid_json'
  | 'invalid_messages'
  | 'rate_limited'
  | 'not_configured'
  | 'upstream_auth'
  | 'upstream_model'
  | 'upstream_rate_limited'
  | 'upstream_bad_request'
  | 'upstream_error'
  | 'upstream_timeout'
  | 'upstream_empty';

// ---------------------------------------------------------------- helpers

function allowedOrigins(env: Env) {
  const list = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return list.length ? list : DEFAULT_ORIGINS;
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> | null {
  if (!origin || !allowedOrigins(env).includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const BASE_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function json(body: unknown, status: number, cors: Record<string, string> | null, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, Vary: 'Origin', ...(cors ?? {}), ...extra } });
}

const MESSAGES: Record<ErrorCode, string> = {
  not_found: 'Not found. Use POST /chat.',
  method_not_allowed: 'Method not allowed. Use POST /chat.',
  origin_not_allowed: 'This website is not allowed to use the proxy.',
  unsupported_media_type: 'Content-Type must be application/json.',
  payload_too_large: 'Request is too large.',
  invalid_json: 'Request body is not valid JSON.',
  invalid_messages: 'messages must be a list of {role, content} ending with a user message.',
  rate_limited: 'Too many messages. Please wait a moment.',
  not_configured: 'The proxy is missing its GEMINI_API_KEY secret.',
  upstream_auth: 'Gemini rejected the API key.',
  upstream_model: 'The configured Gemini model is not available.',
  upstream_rate_limited: 'Gemini Free Tier limit reached. Please try again later.',
  upstream_bad_request: 'Gemini could not process the request.',
  upstream_error: 'Gemini is temporarily unavailable.',
  upstream_timeout: 'Gemini took too long to answer.',
  upstream_empty: 'Gemini returned an empty answer.',
};

function fail(code: ErrorCode, status: number, cors: Record<string, string> | null, extra?: Record<string, string>) {
  return json({ error: { code, message: MESSAGES[code] } }, status, cors, extra);
}

/** Strip control characters (keeps newlines and tabs), normalise, trim. */
function clean(s: string, max: number) {
  return s
    .normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

/**
 * Validate and normalise the conversation:
 *  - every entry must be { role: 'user' | 'assistant', content: string }
 *  - order is preserved (oldest → newest); only the newest turns are kept
 *  - consecutive turns from the same speaker are merged
 *  - the conversation must start with, and end with, a message from Sarah
 */
export function sanitiseMessages(raw: unknown): Turn[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const turns: Turn[] = [];
  for (const t of raw.slice(-LIMITS.maxTurnsAccepted)) {
    if (!t || typeof t !== 'object') return null;
    const { role, content } = t as Record<string, unknown>;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') return null;
    const text = clean(content, LIMITS.maxCharsPerTurn);
    if (!text) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content = `${last.content}\n${text}`.slice(0, LIMITS.maxCharsPerTurn * 2);
    else turns.push({ role, content: text });
  }
  let kept = turns.slice(-LIMITS.maxTurns);
  while (kept.length && kept[0].role !== 'user') kept = kept.slice(1);
  if (!kept.length || kept[kept.length - 1].role !== 'user') return null;
  return kept;
}

/** Last line of defence for the "saya / awak" rule. */
export function enforcePronouns(text: string) {
  const swap = (word: string, to: string) => (word[0] === word[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to);
  return text
    .replace(/(^|[^\p{L}])(engkau|kau|kamu)(?![\p{L}])/giu, (_m, pre: string, w: string) => pre + swap(w, 'awak'))
    .replace(/(^|[^\p{L}])(aku)(?![\p{L}])/giu, (_m, pre: string, w: string) => pre + swap(w, 'saya'));
}

/** Plain text only: no markdown emphasis/headings, tidy whitespace, bounded length. */
export function tidyReply(text: string) {
  let t = text
    .replace(/\*\*|__|^#+\s*/gm, '')
    .replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$)/g, '$1$2')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (t.length > LIMITS.maxReplyChars) {
    const cut = t.slice(0, LIMITS.maxReplyChars);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    t = (end > 80 ? cut.slice(0, end + 1) : cut).trim();
  }
  return enforcePronouns(t);
}

export function buildGeminiBody(messages: Turn[], context: string, model: string) {
  const generationConfig: Record<string, unknown> = { maxOutputTokens: 400 };
  // Gemini 3+ models: keep "thinking" minimal for fast, short chat replies.
  // (thinkingLevel is rejected by older models, so only send it to 3+.)
  if (/^gemini-([3-9]|\d{2,})/.test(model)) generationConfig.thinkingConfig = { thinkingLevel: 'MINIMAL' };
  else generationConfig.temperature = 0.9;
  return {
    systemInstruction: { parts: [{ text: withGameSituation(PERSONA, context) }] },
    contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    generationConfig,
  };
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }>;
  promptFeedback?: { blockReason?: string };
}

const BLOCKED_REPLY = 'Hmm, yang tu saya tak boleh jawab, sayang. Tanya benda lain ya?';

/** Returns the reply text, a "blocked" marker, or null when empty. */
export function extractReply(data: GeminiResponse): { reply: string; blocked: boolean } | null {
  if (data.promptFeedback?.blockReason) return { reply: BLOCKED_REPLY, blocked: true };
  const c = data.candidates?.[0];
  const text = (c?.content?.parts ?? [])
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('')
    .trim();
  if (text) return { reply: tidyReply(text), blocked: false };
  if (c?.finishReason && /SAFETY|BLOCKLIST|PROHIBITED|SPII|RECITATION/.test(c.finishReason)) return { reply: BLOCKED_REPLY, blocked: true };
  return null;
}

// ---------------------------------------------------------------- rate limit

export class RateLimiter {
  private hits = new Map<string, { minute: number; minuteStart: number; day: number; dayStart: number }>();
  constructor(
    private perMinute = LIMITS.perMinute,
    private perDay = LIMITS.perDay,
  ) {}
  /** Returns seconds to wait, or 0 when the request may proceed. */
  check(key: string, now: number): number {
    if (this.hits.size > 5000) this.hits.clear(); // bounded memory
    const h = this.hits.get(key) ?? { minute: 0, minuteStart: now, day: 0, dayStart: now };
    if (now - h.minuteStart >= 60_000) Object.assign(h, { minute: 0, minuteStart: now });
    if (now - h.dayStart >= 86_400_000) Object.assign(h, { day: 0, dayStart: now });
    this.hits.set(key, h);
    if (h.day >= this.perDay) return Math.ceil((h.dayStart + 86_400_000 - now) / 1000);
    if (h.minute >= this.perMinute) return Math.ceil((h.minuteStart + 60_000 - now) / 1000);
    h.minute++;
    h.day++;
    return 0;
  }
}

// ---------------------------------------------------------------- handler

export interface Deps {
  fetch: typeof fetch;
  now: () => number;
  limiter: RateLimiter;
  log: (event: Record<string, unknown>) => void;
}

/** Logs never contain message text or the API key — only counters and codes. */
const defaultLog = (event: Record<string, unknown>) => console.log(JSON.stringify(event));

export function createHandler(deps: Partial<Deps> = {}) {
  const d: Deps = {
    fetch: deps.fetch ?? ((input, init) => fetch(input, init)),
    now: deps.now ?? (() => Date.now()),
    limiter: deps.limiter ?? new RateLimiter(),
    log: deps.log ?? defaultLog,
  };

  async function callGemini(env: Env, model: string, body: unknown): Promise<Response> {
    const attempt = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LIMITS.upstreamTimeoutMs);
      try {
        return await d.fetch(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY! },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    };
    const t0 = d.now();
    const first = await attempt();
    // One quick retry for transient server errors (never for 4xx / quota),
    // only while there is still time before the game gives up waiting.
    if ((first.status === 500 || first.status === 503) && d.now() - t0 < 5_000) {
      await new Promise((r) => setTimeout(r, 400));
      return attempt();
    }
    return first;
  }

  return async function handle(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (path === '/' || path === '/health') {
      if (request.method !== 'GET') return fail('method_not_allowed', 405, cors, { Allow: 'GET' });
      return json({ ok: true, service: 'fareed-ai-proxy', endpoint: 'POST /chat', configured: !!env.GEMINI_API_KEY?.trim() }, 200, cors);
    }
    if (path !== '/chat') return fail('not_found', 404, cors);

    if (request.method === 'OPTIONS') return cors ? new Response(null, { status: 204, headers: cors }) : fail('origin_not_allowed', 403, null);
    if (request.method !== 'POST') return fail('method_not_allowed', 405, cors, { Allow: 'POST, OPTIONS' });
    if (!cors) return fail('origin_not_allowed', 403, null);
    if (!/^application\/json\b/i.test(request.headers.get('Content-Type') ?? '')) return fail('unsupported_media_type', 415, cors);
    const declared = Number(request.headers.get('Content-Length') ?? '0');
    if (declared > LIMITS.maxBodyBytes) return fail('payload_too_large', 413, cors);

    const apiKey = env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      d.log({ event: 'chat', outcome: 'not_configured' });
      return fail('not_configured', 500, cors);
    }

    const visitor = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const wait = d.limiter.check(visitor, d.now());
    if (wait > 0) return fail('rate_limited', 429, cors, { 'Retry-After': String(wait) });

    let raw: string;
    try {
      raw = await request.text();
    } catch {
      return fail('invalid_json', 400, cors);
    }
    if (new TextEncoder().encode(raw).length > LIMITS.maxBodyBytes) return fail('payload_too_large', 413, cors);
    let body: { messages?: unknown; context?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return fail('invalid_json', 400, cors);
    }
    if (!body || typeof body !== 'object') return fail('invalid_json', 400, cors);
    const messages = sanitiseMessages(body.messages);
    if (!messages) return fail('invalid_messages', 400, cors);
    const context = typeof body.context === 'string' ? clean(body.context, LIMITS.maxContextChars) : '';

    const model = /^[a-z0-9][a-z0-9.\-]{1,62}$/.test(env.GEMINI_MODEL?.trim() ?? '') ? env.GEMINI_MODEL!.trim() : DEFAULT_MODEL;
    const started = d.now();
    let upstream: Response;
    try {
      upstream = await callGemini({ ...env, GEMINI_API_KEY: apiKey }, model, buildGeminiBody(messages, context, model));
    } catch (e) {
      const timeout = e instanceof Error && e.name === 'AbortError';
      d.log({ event: 'chat', outcome: timeout ? 'upstream_timeout' : 'upstream_network', model, ms: d.now() - started });
      return timeout ? fail('upstream_timeout', 504, cors) : fail('upstream_error', 502, cors);
    }

    const ms = d.now() - started;
    if (!upstream.ok) {
      const s = upstream.status;
      // Gemini reports an invalid key as HTTP 400 with reason API_KEY_INVALID.
      // Only the machine-readable reason is read; nothing is echoed back.
      const errText = await upstream.text().catch(() => '');
      const reason = /"reason"\s*:\s*"([A-Z_]+)"/.exec(errText)?.[1] ?? '';
      d.log({ event: 'chat', outcome: 'upstream_status', status: s, reason, model, ms });
      if (s === 429) return fail('upstream_rate_limited', 429, cors, { 'Retry-After': upstream.headers.get('Retry-After') ?? '60' });
      if (s === 401 || s === 403 || /API_KEY/.test(reason)) return fail('upstream_auth', 502, cors);
      if (s === 404) return fail('upstream_model', 502, cors);
      if (s === 400) return fail('upstream_bad_request', 502, cors);
      return fail('upstream_error', 502, cors);
    }

    let data: GeminiResponse;
    try {
      data = (await upstream.json()) as GeminiResponse;
    } catch {
      d.log({ event: 'chat', outcome: 'upstream_bad_json', model, ms });
      return fail('upstream_error', 502, cors);
    }
    const result = extractReply(data);
    if (!result) {
      d.log({ event: 'chat', outcome: 'upstream_empty', model, ms });
      return fail('upstream_empty', 502, cors);
    }
    d.log({ event: 'chat', outcome: result.blocked ? 'blocked' : 'ok', model, ms, turns: messages.length });
    return json({ reply: result.reply, model, ...(result.blocked ? { blocked: true } : {}) }, 200, cors);
  };
}

const handle = createHandler();

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return handle(request, env);
  },
};
