/**
 * Free chat: offline replies are relevant, the conversation is remembered in
 * the browser in the right order, and the Gemini client handles failures.
 */
import { describe, expect, it, vi } from 'vitest';
import { dialogueConfig } from '../config/dialogueConfig';
import { createEmptySave } from '../stores/gameStore';
import { CHAT_KEY, clearChat, loadChat, MAX_AI_TURNS, MAX_STORED_TURNS, saveChat, turnsForAI, type StoredTurn } from '../systems/DialogueManager/chatHistory';
import { describeContext, localFreeChat } from '../systems/DialogueManager/dialogueEngine';
import { askRemoteCompanion, chatEndpoint, RemoteAIError } from '../systems/DialogueManager/remoteAI';
import { gameConfig } from '../config/gameConfig';

const rules = dialogueConfig.freeChat.rules;
/** Index of the first rule whose keywords include `kw`. */
const ruleWith = (kw: string) => rules.findIndex((r) => (r.match as readonly string[]).includes(kw));
const reply = (text: string) => localFreeChat(text, { location: 'paths', save: createEmptySave(), random: () => 0 });

describe('offline replies answer what she actually said', () => {
  // These are the exact messages that used to get an unrelated "Saya sayang awak…" or fallback.
  it.each<[string, string, boolean?]>([
    ['Sayang, saya lapar', 'lapar'],
    ['Sayang, saya takut petir', 'takut'],
    ['Hai sayang, saya penat sangat', 'penat'],
    ['Awak tengah buat apa?', 'tengah buat'],
    ['What are you doing?', 'tengah buat'],
    ['Saya rindu mak saya', 'rindu', true],
  ])('%s', (message, keyword, family = false) => {
    const id = reply(message).id;
    const expected = family ? rules.findIndex((r) => 'andAny' in r) : ruleWith(keyword);
    expect(expected).toBeGreaterThanOrEqual(0);
    expect(id).toMatch(new RegExp(`^free:${expected}:`));
  });

  it('still answers love, missing him, greetings and salam as before', () => {
    expect(reply('Saya sayang awak').id).toMatch(new RegExp(`^free:${ruleWith('sayang')}:`));
    expect(reply('I love you').id).toMatch(new RegExp(`^free:${ruleWith('sayang')}:`));
    expect(reply('Saya rindu awak').id).toMatch(/^free:1:/);
    expect(reply('Hai sayang').id).toMatch(new RegExp(`^free:${ruleWith('hai')}:`));
    expect(reply('Assalamualaikum').id).toMatch(new RegExp(`^free:${ruleWith('assalamualaikum')}:`));
    expect(reply('qwerty').id).toMatch(/^free:fallback/);
  });

  it('short keywords match whole words only ("lawa" is not "law")', () => {
    expect(reply('Awak lawa hari ni').id).toMatch(new RegExp(`^free:${ruleWith('lawa')}:`));
    expect(reply('Saya hilang arah').id).not.toMatch(new RegExp(`^free:${ruleWith('hai')}:`));
  });

  it('when asked, he is honest that he is the in-game Fareed', () => {
    expect(reply('Awak ni AI ke? Are you real?').text).toMatch(/versi dalam game/);
  });
});

describe('chat history in the browser', () => {
  function memoryBackend() {
    const m = new Map<string, string>();
    return {
      store: m,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => (m.set(k, v), 'ok' as const),
      removeItem: (k: string) => void m.delete(k),
    };
  }
  const t = (role: 'user' | 'assistant', content: string, source: StoredTurn['source'], at: number): StoredTurn => ({ role, content, source, at });

  it('survives a reload in the same order', () => {
    const b = memoryBackend();
    const turns = [t('user', 'Hai', 'user', 1), t('assistant', 'Hai cantik!', 'gemini', 2), t('user', 'Saya lapar', 'user', 3)];
    saveChat(turns, b);
    expect(loadChat(b)).toEqual(turns);
  });

  it('uses its own storage key, separate from the save system', () => {
    const b = memoryBackend();
    saveChat([t('user', 'x', 'user', 1)], b);
    expect([...b.store.keys()]).toEqual([CHAT_KEY]);
    expect(CHAT_KEY).not.toMatch(/progress|settings/);
  });

  it('ignores damaged data instead of crashing', () => {
    const b = memoryBackend();
    for (const raw of ['{broken', '{"version":2,"turns":[]}', '{"version":1,"turns":[{"role":"system","content":"x"}]}', 'null']) {
      b.store.set(CHAT_KEY, raw);
      expect(loadChat(b)).toEqual([]);
    }
  });

  it('keeps a bounded history and can be cleared', () => {
    const b = memoryBackend();
    const many = Array.from({ length: MAX_STORED_TURNS + 20 }, (_, i) => t(i % 2 ? 'assistant' : 'user', `m${i}`, i % 2 ? 'local' : 'user', i));
    saveChat(many, b);
    const loaded = loadChat(b);
    expect(loaded).toHaveLength(MAX_STORED_TURNS);
    expect(loaded[loaded.length - 1].content).toBe(`m${MAX_STORED_TURNS + 19}`);
    clearChat(b);
    expect(loadChat(b)).toEqual([]);
  });

  it('sends the AI only real turns, oldest → newest, newest last', () => {
    const turns = [
      t('user', 'Hai', 'user', 1),
      t('assistant', 'Hai cantik!', 'local', 2),
      t('assistant', dialogueConfig.freeChat.aiUnavailable, 'notice', 3),
      t('user', 'Saya penat', 'user', 4),
    ];
    expect(turnsForAI(turns)).toEqual([
      { role: 'user', content: 'Hai' },
      { role: 'assistant', content: 'Hai cantik!' },
      { role: 'user', content: 'Saya penat' },
    ]);
    const long = Array.from({ length: 40 }, (_, i) => t('user', `u${i}`, 'user', i));
    const sent = turnsForAI(long);
    expect(sent).toHaveLength(MAX_AI_TURNS);
    expect(sent[sent.length - 1].content).toBe('u39');
  });

  it('the game context sent to the AI contains no in-game memory stars', () => {
    const ctx = describeContext({ location: 'garden', save: createEmptySave() });
    for (const m of gameConfig.SHARED_MEMORIES) expect(ctx).not.toContain(m.text);
  });
});

describe('Gemini client (browser side)', () => {
  const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  it('accepts the Worker URL with or without /chat', () => {
    expect(chatEndpoint('https://fareed-ai-proxy.example.workers.dev')).toBe('https://fareed-ai-proxy.example.workers.dev/chat');
    expect(chatEndpoint('https://fareed-ai-proxy.example.workers.dev/')).toBe('https://fareed-ai-proxy.example.workers.dev/chat');
    expect(chatEndpoint('https://fareed-ai-proxy.example.workers.dev/chat')).toBe('https://fareed-ai-proxy.example.workers.dev/chat');
    expect(chatEndpoint('')).toBe('');
    expect(chatEndpoint(undefined)).toBe('');
  });

  it('posts the conversation and context, and returns the reply', async () => {
    const fetchImpl = vi.fn(async () => ok({ reply: ' Jom makan! ' }));
    const history = [{ role: 'user' as const, content: 'Saya lapar' }];
    const r = await askRemoteCompanion(history, 'Location: garden.', { endpoint: 'https://p.example/chat', fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(r).toEqual({ reply: 'Jom makan!', blocked: false });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://p.example/chat');
    expect(JSON.parse(String(init.body))).toEqual({ messages: history, context: 'Location: garden.' });
  });

  it('turns every failure into a RemoteAIError the chat can fall back from', async () => {
    const run = (f: () => Promise<Response>, timeoutMs = 2000) =>
      askRemoteCompanion([{ role: 'user', content: 'hai' }], '', { endpoint: 'https://p.example/chat', fetchImpl: f as unknown as typeof fetch, timeoutMs }).then(
        () => null,
        (e: unknown) => e as RemoteAIError,
      );
    expect((await run(async () => ok({ error: { code: 'upstream_rate_limited' } }, 429)))?.code).toBe('rate_limited');
    expect((await run(async () => ok({ error: { code: 'upstream_error' } }, 502)))?.code).toBe('server');
    expect((await run(async () => ok({ reply: '' })))?.code).toBe('bad_response');
    expect((await run(async () => new Response('not json', { status: 200 })))?.code).toBe('bad_response');
    expect((await run(async () => Promise.reject(new TypeError('Failed to fetch'))))?.code).toBe('network');
    const slow = (_: unknown, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError'))));
    expect((await run(slow as never, 30))?.code).toBe('timeout');
    await expect(askRemoteCompanion([], '', { endpoint: '' })).rejects.toMatchObject({ code: 'not_configured' });
  });
});
