/**
 * OPTIONAL remote AI client (Prince Fareed via Google Gemini).
 *
 * The browser never sees an API key. It only talks to YOUR Cloudflare Worker
 * (see /proxy), whose public URL is configured through VITE_AI_PROXY_URL,
 * e.g. https://fareed-ai-proxy.<account>.workers.dev
 * When the variable is empty — the default — the game uses the local
 * dialogue engine exclusively and this module is inert.
 */
export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** Base URL of the proxy, normalised so both ".../" and ".../chat" work. */
export function chatEndpoint(base: string | undefined): string {
  const b = (base ?? '').trim().replace(/\/+$/, '');
  if (!b) return '';
  return b.endsWith('/chat') ? b : `${b}/chat`;
}

const ENDPOINT = chatEndpoint(import.meta.env.VITE_AI_PROXY_URL as string | undefined);

export function isRemoteAIEnabled() {
  return ENDPOINT.length > 0;
}

export type RemoteAIErrorCode = 'not_configured' | 'timeout' | 'network' | 'rate_limited' | 'bad_response' | 'server';

export class RemoteAIError extends Error {
  constructor(
    public code: RemoteAIErrorCode,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'RemoteAIError';
  }
}

export interface RemoteReply {
  reply: string;
  blocked: boolean;
}

/**
 * Sends the conversation (oldest → newest, ending with her message) plus a
 * short description of the game situation, and returns Fareed's reply.
 */
export async function askRemoteCompanion(
  history: ChatTurn[],
  context: string,
  {
    timeoutMs = 25_000,
    endpoint = ENDPOINT,
    fetchImpl = (input, init) => fetch(input, init),
  }: { timeoutMs?: number; endpoint?: string; fetchImpl?: typeof fetch } = {},
): Promise<RemoteReply> {
  if (!endpoint) throw new RemoteAIError('not_configured', 'Remote AI is not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, context }),
        signal: controller.signal,
      });
    } catch (e) {
      if (controller.signal.aborted) throw new RemoteAIError('timeout', 'The AI took too long to answer');
      throw new RemoteAIError('network', e instanceof Error ? e.message : 'Network error');
    }
    let data: { reply?: unknown; blocked?: unknown; error?: { code?: unknown } } = {};
    try {
      data = await res.json();
    } catch {
      /* handled below */
    }
    if (!res.ok) {
      const code = typeof data.error?.code === 'string' ? data.error.code : `http_${res.status}`;
      throw new RemoteAIError(res.status === 429 ? 'rate_limited' : 'server', `Proxy responded ${res.status} (${code})`, res.status);
    }
    if (typeof data.reply !== 'string' || !data.reply.trim()) throw new RemoteAIError('bad_response', 'Empty reply');
    return { reply: data.reply.trim(), blocked: data.blocked === true };
  } catch (e) {
    if (e instanceof RemoteAIError) throw e;
    if (controller.signal.aborted) throw new RemoteAIError('timeout', 'The AI took too long to answer');
    throw new RemoteAIError('network', e instanceof Error ? e.message : 'Network error');
  } finally {
    clearTimeout(timer);
  }
}
