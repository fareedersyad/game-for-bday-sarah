/**
 * CHAT HISTORY — remembers the free-chat conversation with Prince Fareed in
 * THIS browser (localStorage key "awmjfh.chat.v1"), so the conversation
 * survives a refresh and continues when Sarah comes back on the same browser.
 *
 * Deliberately separate from the save system (SaveManager): resetting or
 * importing game progress does not touch the chat, and vice versa. Nothing
 * is synced between devices. Sarah can clear it from the chat panel.
 */
import { safeStorage } from '../SaveManager/safeStorage';
import type { ChatTurn } from './remoteAI';

export const CHAT_KEY = 'awmjfh.chat.v1';
/** Turns kept in the browser (oldest are dropped first). */
export const MAX_STORED_TURNS = 80;
/** Turns sent to the AI as conversation memory (newest last). */
export const MAX_AI_TURNS = 16;
const MAX_CHARS = 800;

/**
 * `gemini` / `local` = what replied; `notice` = a status line shown to her
 * (e.g. "AI unavailable") that is never sent to the AI as something he said.
 */
export type TurnSource = 'user' | 'gemini' | 'local' | 'notice';

export interface StoredTurn {
  role: 'user' | 'assistant';
  content: string;
  source: TurnSource;
  at: number;
}

interface StoredChat {
  version: 1;
  turns: StoredTurn[];
}

type Backend = Pick<typeof safeStorage, 'getItem' | 'setItem' | 'removeItem'>;

function isTurn(t: unknown): t is StoredTurn {
  if (!t || typeof t !== 'object') return false;
  const x = t as Record<string, unknown>;
  return (
    (x.role === 'user' || x.role === 'assistant') &&
    typeof x.content === 'string' &&
    x.content.length > 0 &&
    ['user', 'gemini', 'local', 'notice'].includes(x.source as string) &&
    typeof x.at === 'number' &&
    Number.isFinite(x.at)
  );
}

export function loadChat(backend: Backend = safeStorage): StoredTurn[] {
  try {
    const raw = backend.getItem(CHAT_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as Partial<StoredChat>;
    if (data?.version !== 1 || !Array.isArray(data.turns)) return [];
    return data.turns
      .filter(isTurn)
      .map((t) => ({ ...t, content: t.content.slice(0, MAX_CHARS) }))
      .slice(-MAX_STORED_TURNS);
  } catch {
    return []; // unreadable chat → start a fresh conversation, never crash
  }
}

export function saveChat(turns: StoredTurn[], backend: Backend = safeStorage) {
  const data: StoredChat = { version: 1, turns: turns.slice(-MAX_STORED_TURNS) };
  try {
    return backend.setItem(CHAT_KEY, JSON.stringify(data));
  } catch {
    return 'error' as const;
  }
}

export function clearChat(backend: Backend = safeStorage) {
  try {
    backend.removeItem(CHAT_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * The conversation memory sent to the AI: real turns only (no status
 * notices), in chronological order, newest last, limited to MAX_AI_TURNS.
 */
export function turnsForAI(turns: StoredTurn[]): ChatTurn[] {
  return turns
    .filter((t) => t.source !== 'notice')
    .slice(-MAX_AI_TURNS)
    .map((t) => ({ role: t.role, content: t.content }));
}
