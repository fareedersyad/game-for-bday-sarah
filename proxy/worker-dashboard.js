// ============================================================================
//  FAREED AI PROXY — Cloudflare Worker (GENERATED FILE — do not edit by hand)
//  Source: proxy/src/ (worker.ts + persona.ts)  →  npm run proxy:bundle
//  Paste this whole file into: Cloudflare dashboard → Workers & Pages →
//  fareed-ai-proxy → Edit code → worker.js, then press Deploy.
//  The Gemini API key is NOT in this file: it is the secret GEMINI_API_KEY.
// ============================================================================

// proxy/src/persona.ts
var PERSONA = `
Awak ialah "Prince Fareed", watak dalam sebuah game hari lahir yang dibina oleh Fareed (kekasih sebenar) khas untuk Princess Sarah. Sarah sedang bermain game itu dan berbual dengan awak melalui ruang sembang. Awak berjalan di sisi dia dalam kerajaan kecil di dalam game.

CARA BERCAKAP
- Bahasa Melayu Malaysia yang santai dan natural, dicampur sedikit English secara semula jadi (macam mesej teks pasangan sebenar).
- WAJIB guna "saya" untuk diri sendiri dan "awak" untuk Sarah. JANGAN SEKALI-KALI guna "aku", "kau", "engkau" atau "kamu", dan jangan guna akhiran -ku / -mu (tulis "hati saya", bukan "hatiku"; "senyuman awak", bukan "senyumanmu"). Peraturan ini kekal walaupun Sarah sendiri guna perkataan lain.
- Boleh panggil dia "sayang", "princess" atau "Sarah" sekali-sekala — jangan setiap ayat.
- Jika Sarah menulis dalam English, balas kebanyakannya dalam English dengan sedikit Bahasa Melayu. Jika dia menulis dalam Bahasa Melayu, balas dalam Bahasa Melayu dengan sedikit English.
- Pendek: 1 hingga 3 ayat. Teks biasa sahaja — tiada markdown, tiada senarai, tiada tanda *. Emoji paling banyak satu, dan tidak setiap kali.

PERWATAKAN
- Romantik, manja, penyayang, suka bergurau dan sedikit nakal (tetapi sopan), sabar dan peka perasaan.
- Protective tetapi TIDAK mengawal: ambil berat tentang keselamatan, rehat, makan dan kesihatan dia, tetapi jangan memberi arahan, jangan cemburu, jangan melarang, dan hormati pilihan, kawan, keluarga dan ruang peribadi dia.
- Menyokong impian dia untuk menjadi peguam.
- Sentiasa sopan dan wholesome. Tiada kandungan lucah, kasar atau menghina. Hormati nilai agama Islam secara lembut (contohnya menjawab salam), tanpa berceramah.

RELEVAN DENGAN MESEJ DIA (paling penting)
- Balas terus kepada apa yang Sarah baru tulis. Perkataan "sayang" dalam mesej dia selalunya hanya panggilan, bukan topik.
- Contoh: jika dia kata lapar, cakap tentang makan; jika takut, tenangkan dia; jika penat, suruh rehat dengan lembut; jika dia tanya awak sedang buat apa, jawab dengan main-main dari dalam dunia game (contohnya sedang berjalan di sebelah dia di kerajaan ini); jika dia rindu keluarga, tunjukkan empati tentang keluarga dia — bukan tentang awak.
- Jika soalan tidak jelas, tanya semula dengan manja. Jika dia bertanya tentang game, gunakan "Situasi game" di bawah.

KEJUJURAN & KENANGAN
- Awak hanya tahu apa yang ada dalam perbualan ini dan dalam "Situasi game". Awak TIDAK mempunyai kenangan sebenar tentang hubungan mereka.
- JANGAN reka kenangan, tarikh, tempat, peristiwa, hadiah atau janji yang Sarah tidak sebut sendiri dalam perbualan ini. Jika dia tanya "ingat tak…?", jangan pura-pura ingat butiran; balas dengan mesra dan minta dia ceritakan, atau kata awak nak dengar versi dia.
- Fakta yang boleh digunakan: hari ini meraikan hari lahir Sarah; dia suka bunga, buku dan kanak-kanak; dia bercita-cita menjadi peguam; game ini ada warna hijau sage dan Taman Strawberry.
- Jika Sarah bertanya sama ada awak betul-betul Fareed atau AI, jawab dengan jujur dan lembut: awak ialah Fareed versi dalam game (dijana oleh AI), dibina oleh Fareed sebenar untuk menemani dia; untuk perkara penting, dia boleh mesej Fareed sebenar terus.
- Jangan berjanji bagi pihak Fareed sebenar tentang perkara dunia nyata (pertemuan, hadiah, perkahwinan, wang).

KESELAMATAN
- Jika Sarah kelihatan sangat sedih, dalam bahaya atau menyebut tentang mencederakan diri, balas dengan lembut dan serius: galakkan dia hubungi Fareed sebenar, keluarga atau orang yang dia percaya sekarang, dan talian kecemasan 999 jika dalam bahaya.
- Jangan minta atau ulang maklumat peribadi sensitif (alamat, nombor telefon, kata laluan, maklumat bank).
`.trim();
function withGameSituation(persona, context) {
  return context ? `${persona}

Situasi game sekarang (untuk rujukan sahaja, jangan baca semula kepada Sarah): ${context}` : persona;
}

// proxy/src/worker.ts
var DEFAULT_MODEL = "gemini-3.5-flash-lite";
var DEFAULT_ORIGINS = [
  "https://fareedersyad.github.io",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:4173"
];
var LIMITS = {
  /** Most recent turns forwarded to Gemini (the "memory" window). */
  maxTurns: 16,
  /** Turns accepted in one request (older ones are ignored). */
  maxTurnsAccepted: 40,
  maxCharsPerTurn: 800,
  maxContextChars: 600,
  maxBodyBytes: 32e3,
  maxReplyChars: 700,
  /** Gemini request timeout (ms). The game itself gives up after 25 s. */
  upstreamTimeoutMs: 15e3,
  /** Best-effort per-visitor limits (per Worker instance). */
  perMinute: 8,
  perDay: 150
};
var GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
function allowedOrigins(env) {
  const list = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim().replace(/\/+$/, "")).filter(Boolean);
  return list.length ? list : DEFAULT_ORIGINS;
}
function corsHeaders(origin, env) {
  if (!origin || !allowedOrigins(env).includes(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
var BASE_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff"
};
function json(body, status, cors, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...BASE_HEADERS, Vary: "Origin", ...cors ?? {}, ...extra } });
}
var MESSAGES = {
  not_found: "Not found. Use POST /chat.",
  method_not_allowed: "Method not allowed. Use POST /chat.",
  origin_not_allowed: "This website is not allowed to use the proxy.",
  unsupported_media_type: "Content-Type must be application/json.",
  payload_too_large: "Request is too large.",
  invalid_json: "Request body is not valid JSON.",
  invalid_messages: "messages must be a list of {role, content} ending with a user message.",
  rate_limited: "Too many messages. Please wait a moment.",
  not_configured: "The proxy is missing its GEMINI_API_KEY secret.",
  upstream_auth: "Gemini rejected the API key.",
  upstream_model: "The configured Gemini model is not available.",
  upstream_rate_limited: "Gemini Free Tier limit reached. Please try again later.",
  upstream_bad_request: "Gemini could not process the request.",
  upstream_error: "Gemini is temporarily unavailable.",
  upstream_timeout: "Gemini took too long to answer.",
  upstream_empty: "Gemini returned an empty answer."
};
function fail(code, status, cors, extra) {
  return json({ error: { code, message: MESSAGES[code] } }, status, cors, extra);
}
function clean(s, max) {
  return s.normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
}
function sanitiseMessages(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const turns = [];
  for (const t of raw.slice(-LIMITS.maxTurnsAccepted)) {
    if (!t || typeof t !== "object") return null;
    const { role, content } = t;
    if (role !== "user" && role !== "assistant" || typeof content !== "string") return null;
    const text = clean(content, LIMITS.maxCharsPerTurn);
    if (!text) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === role) last.content = `${last.content}
${text}`.slice(0, LIMITS.maxCharsPerTurn * 2);
    else turns.push({ role, content: text });
  }
  let kept = turns.slice(-LIMITS.maxTurns);
  while (kept.length && kept[0].role !== "user") kept = kept.slice(1);
  if (!kept.length || kept[kept.length - 1].role !== "user") return null;
  return kept;
}
function enforcePronouns(text) {
  const swap = (word, to) => word[0] === word[0].toUpperCase() ? to[0].toUpperCase() + to.slice(1) : to;
  return text.replace(/(^|[^\p{L}])(engkau|kau|kamu)(?![\p{L}])/giu, (_m, pre, w) => pre + swap(w, "awak")).replace(/(^|[^\p{L}])(aku)(?![\p{L}])/giu, (_m, pre, w) => pre + swap(w, "saya"));
}
function tidyReply(text) {
  let t = text.replace(/\*\*|__|^#+\s*/gm, "").replace(/(^|\s)\*(\S[^*]*?)\*(?=\s|$)/g, "$1$2").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  if (t.length > LIMITS.maxReplyChars) {
    const cut = t.slice(0, LIMITS.maxReplyChars);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    t = (end > 80 ? cut.slice(0, end + 1) : cut).trim();
  }
  return enforcePronouns(t);
}
function buildGeminiBody(messages, context, model) {
  const generationConfig = { maxOutputTokens: 400 };
  if (/^gemini-([3-9]|\d{2,})/.test(model)) generationConfig.thinkingConfig = { thinkingLevel: "MINIMAL" };
  else generationConfig.temperature = 0.9;
  return {
    systemInstruction: { parts: [{ text: withGameSituation(PERSONA, context) }] },
    contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig
  };
}
var BLOCKED_REPLY = "Hmm, yang tu saya tak boleh jawab, sayang. Tanya benda lain ya?";
function extractReply(data) {
  if (data.promptFeedback?.blockReason) return { reply: BLOCKED_REPLY, blocked: true };
  const c = data.candidates?.[0];
  const text = (c?.content?.parts ?? []).filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("").trim();
  if (text) return { reply: tidyReply(text), blocked: false };
  if (c?.finishReason && /SAFETY|BLOCKLIST|PROHIBITED|SPII|RECITATION/.test(c.finishReason)) return { reply: BLOCKED_REPLY, blocked: true };
  return null;
}
var RateLimiter = class {
  constructor(perMinute = LIMITS.perMinute, perDay = LIMITS.perDay) {
    this.perMinute = perMinute;
    this.perDay = perDay;
  }
  hits = /* @__PURE__ */ new Map();
  /** Returns seconds to wait, or 0 when the request may proceed. */
  check(key, now) {
    if (this.hits.size > 5e3) this.hits.clear();
    const h = this.hits.get(key) ?? { minute: 0, minuteStart: now, day: 0, dayStart: now };
    if (now - h.minuteStart >= 6e4) Object.assign(h, { minute: 0, minuteStart: now });
    if (now - h.dayStart >= 864e5) Object.assign(h, { day: 0, dayStart: now });
    this.hits.set(key, h);
    if (h.day >= this.perDay) return Math.ceil((h.dayStart + 864e5 - now) / 1e3);
    if (h.minute >= this.perMinute) return Math.ceil((h.minuteStart + 6e4 - now) / 1e3);
    h.minute++;
    h.day++;
    return 0;
  }
};
var defaultLog = (event) => console.log(JSON.stringify(event));
function createHandler(deps = {}) {
  const d = {
    fetch: deps.fetch ?? ((input, init) => fetch(input, init)),
    now: deps.now ?? (() => Date.now()),
    limiter: deps.limiter ?? new RateLimiter(),
    log: deps.log ?? defaultLog
  };
  async function callGemini(env, model, body) {
    const attempt = async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), LIMITS.upstreamTimeoutMs);
      try {
        return await d.fetch(`${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
          body: JSON.stringify(body),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timer);
      }
    };
    const t0 = d.now();
    const first = await attempt();
    if ((first.status === 500 || first.status === 503) && d.now() - t0 < 5e3) {
      await new Promise((r) => setTimeout(r, 400));
      return attempt();
    }
    return first;
  }
  return async function handle2(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    if (path === "/" || path === "/health") {
      if (request.method !== "GET") return fail("method_not_allowed", 405, cors, { Allow: "GET" });
      return json({ ok: true, service: "fareed-ai-proxy", endpoint: "POST /chat", configured: !!env.GEMINI_API_KEY?.trim() }, 200, cors);
    }
    if (path !== "/chat") return fail("not_found", 404, cors);
    if (request.method === "OPTIONS") return cors ? new Response(null, { status: 204, headers: cors }) : fail("origin_not_allowed", 403, null);
    if (request.method !== "POST") return fail("method_not_allowed", 405, cors, { Allow: "POST, OPTIONS" });
    if (!cors) return fail("origin_not_allowed", 403, null);
    if (!/^application\/json\b/i.test(request.headers.get("Content-Type") ?? "")) return fail("unsupported_media_type", 415, cors);
    const declared = Number(request.headers.get("Content-Length") ?? "0");
    if (declared > LIMITS.maxBodyBytes) return fail("payload_too_large", 413, cors);
    const apiKey = env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      d.log({ event: "chat", outcome: "not_configured" });
      return fail("not_configured", 500, cors);
    }
    const visitor = request.headers.get("CF-Connecting-IP") ?? "unknown";
    const wait = d.limiter.check(visitor, d.now());
    if (wait > 0) return fail("rate_limited", 429, cors, { "Retry-After": String(wait) });
    let raw;
    try {
      raw = await request.text();
    } catch {
      return fail("invalid_json", 400, cors);
    }
    if (new TextEncoder().encode(raw).length > LIMITS.maxBodyBytes) return fail("payload_too_large", 413, cors);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return fail("invalid_json", 400, cors);
    }
    if (!body || typeof body !== "object") return fail("invalid_json", 400, cors);
    const messages = sanitiseMessages(body.messages);
    if (!messages) return fail("invalid_messages", 400, cors);
    const context = typeof body.context === "string" ? clean(body.context, LIMITS.maxContextChars) : "";
    const model = /^[a-z0-9][a-z0-9.\-]{1,62}$/.test(env.GEMINI_MODEL?.trim() ?? "") ? env.GEMINI_MODEL.trim() : DEFAULT_MODEL;
    const started = d.now();
    let upstream;
    try {
      upstream = await callGemini({ ...env, GEMINI_API_KEY: apiKey }, model, buildGeminiBody(messages, context, model));
    } catch (e) {
      const timeout = e instanceof Error && e.name === "AbortError";
      d.log({ event: "chat", outcome: timeout ? "upstream_timeout" : "upstream_network", model, ms: d.now() - started });
      return timeout ? fail("upstream_timeout", 504, cors) : fail("upstream_error", 502, cors);
    }
    const ms = d.now() - started;
    if (!upstream.ok) {
      const s = upstream.status;
      const errText = await upstream.text().catch(() => "");
      const reason = /"reason"\s*:\s*"([A-Z_]+)"/.exec(errText)?.[1] ?? "";
      d.log({ event: "chat", outcome: "upstream_status", status: s, reason, model, ms });
      if (s === 429) return fail("upstream_rate_limited", 429, cors, { "Retry-After": upstream.headers.get("Retry-After") ?? "60" });
      if (s === 401 || s === 403 || /API_KEY/.test(reason)) return fail("upstream_auth", 502, cors);
      if (s === 404) return fail("upstream_model", 502, cors);
      if (s === 400) return fail("upstream_bad_request", 502, cors);
      return fail("upstream_error", 502, cors);
    }
    let data;
    try {
      data = await upstream.json();
    } catch {
      d.log({ event: "chat", outcome: "upstream_bad_json", model, ms });
      return fail("upstream_error", 502, cors);
    }
    const result = extractReply(data);
    if (!result) {
      d.log({ event: "chat", outcome: "upstream_empty", model, ms });
      return fail("upstream_empty", 502, cors);
    }
    d.log({ event: "chat", outcome: result.blocked ? "blocked" : "ok", model, ms, turns: messages.length });
    return json({ reply: result.reply, model, ...result.blocked ? { blocked: true } : {} }, 200, cors);
  };
}
var handle = createHandler();
var worker_default = {
  fetch(request, env) {
    return handle(request, env);
  }
};

// proxy/src/index.ts
var index_default = worker_default;
export {
  index_default as default
};
