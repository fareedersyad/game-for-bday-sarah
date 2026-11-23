/**
 * LOCAL DIALOGUE ENGINE
 *
 * Fully offline, deterministic-enough conversation logic for the Royal
 * Companion. Responses depend on: current location, the focused quest and its
 * next objective, completed quests (queued "reactions"), how often and how
 * recently she has talked to him, which lines she has already heard, and
 * which shared memories he has already told.
 */
import { dialogueConfig } from '../../config/dialogueConfig';
import { gameConfig } from '../../config/gameConfig';
import { QUEST_BY_ID } from '../../config/questConfig';
import type { QuestId, SaveData } from '../../stores/progressTypes';
import { fill, fmt } from '../../utils/text';
import { focusQuest, nextObjective, objectiveProgress } from '../QuestManager/questManager';
import type { LocationId } from '../WorldManager/worldTypes';
import { personalContent } from '../../config/personalContent';

export interface PickedLine {
  id: string;
  text: string;
}

export interface TalkContext {
  location: LocationId;
  save: SaveData;
  now?: number;
  /** Injectable randomness for tests. */
  random?: () => number;
}

/** Choose the least-heard line from a pool (random among ties). */
export function pickLine(pool: readonly string[], keyPrefix: string, seen: Record<string, number>, random = Math.random): PickedLine {
  if (pool.length === 0) return { id: `${keyPrefix}:none`, text: '' };
  let min = Infinity;
  const candidates: number[] = [];
  pool.forEach((_, i) => {
    const n = seen[`${keyPrefix}:${i}`] ?? 0;
    if (n < min) {
      min = n;
      candidates.length = 0;
      candidates.push(i);
    } else if (n === min) {
      candidates.push(i);
    }
  });
  const idx = candidates[Math.floor(random() * candidates.length) % candidates.length];
  return { id: `${keyPrefix}:${idx}`, text: fill(pool[idx]) };
}

export function greeting(ctx: TalkContext): { lines: PickedLine[]; consumedReactions: string[] } {
  const { save, location } = ctx;
  const now = ctx.now ?? Date.now();
  const random = ctx.random ?? Math.random;
  const lines: PickedLine[] = [];
  const t = dialogueConfig.talk;

  const reactions = save.dialogue.pendingReactions.filter((r) => r in t.reactions) as QuestId[];
  if (save.dialogue.talkCount === 0) {
    lines.push({ id: 'talk:first', text: fill(t.firstEver) });
  } else if (reactions.length > 0) {
    // React to the most recent accomplishment first.
    const latest = reactions[reactions.length - 1];
    lines.push({ id: `reaction:${latest}`, text: fill((t.reactions as Partial<Record<QuestId, string>>)[latest] ?? '') });
  } else if (location in t.greetingByLocation) {
    lines.push({ id: `greet:${location}`, text: fill((t.greetingByLocation as Partial<Record<LocationId, string>>)[location]!) });
  } else if (save.dialogue.lastTalkAt !== null && now - save.dialogue.lastTalkAt < 60_000) {
    lines.push(pickLine(t.greetingsRepeat, 'greetRepeat', save.dialogue.seen, random));
  } else {
    lines.push(pickLine(t.greetings, 'greet', save.dialogue.seen, random));
  }
  return { lines, consumedReactions: reactions };
}

export function hintLines(ctx: TalkContext): PickedLine[] {
  const q = focusQuest(ctx.save);
  const random = ctx.random ?? Math.random;
  if (!q) return [{ id: 'hint:done', text: fill(dialogueConfig.talk.allDone) }];
  const prefix = pickLine(dialogueConfig.talk.hintPrefix, 'hintPrefix', ctx.save.dialogue.seen, random);
  const out: PickedLine[] = [{ id: `hint:${q.id}`, text: `${prefix.text} ${fill(q.hint)}` }];
  const obj = nextObjective(ctx.save, q);
  if (obj) {
    const p = objectiveProgress(ctx.save, obj);
    const count = p.target > 1 ? ` (${p.current}/${p.target})` : '';
    out.push({ id: `hintObj:${q.id}:${obj.id}`, text: fmt(personalContent.ui.misc.currentQuestHint, { quest: q.name, objective: obj.text, count }) });
  }
  return out;
}

export function placeLines(ctx: TalkContext): PickedLine[] {
  const pool = (dialogueConfig.talk.place as Partial<Record<LocationId, readonly string[]>>)[ctx.location] ?? dialogueConfig.talk.place.paths;
  return [pickLine(pool, `place:${ctx.location}`, ctx.save.dialogue.seen, ctx.random)];
}

export function manjaLines(ctx: TalkContext): PickedLine[] {
  return [pickLine(dialogueConfig.talk.manja, 'manja', ctx.save.dialogue.seen, ctx.random)];
}

/** Tells shared memories in order, one per ask. */
export function memoryLines(ctx: TalkContext): { lines: PickedLine[]; advance: boolean } {
  const mems = gameConfig.SHARED_MEMORIES;
  const i = ctx.save.dialogue.memoryCursor;
  if (i >= mems.length) return { lines: [{ id: 'memory:end', text: fill(dialogueConfig.talk.noMoreMemories) }], advance: false };
  const m = mems[i];
  return { lines: [{ id: `memory:${m.id}`, text: `${fill(m.title)}… ${fill(m.text)}` }], advance: true };
}

export function goodbyeLine(ctx: TalkContext): PickedLine {
  return pickLine(dialogueConfig.talk.goodbye, 'bye', ctx.save.dialogue.seen, ctx.random);
}

const normalise = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Does the (normalised, space-padded) message contain this keyword?
 * Short keywords (hi, tq, law…) must be whole words so "law" doesn't match
 * "lawa"; longer ones may carry a suffix ("sayangku", "rindunya").
 */
function hasKeyword(paddedMessage: string, keyword: string) {
  const k = normalise(keyword);
  if (!k) return false;
  return k.length <= 3 ? paddedMessage.includes(` ${k} `) : paddedMessage.includes(` ${k}`);
}

const ADDRESS_WEIGHT = 0.5;
const ANDANY_BONUS = 1.5;

/**
 * How well a rule fits the message (0 = not at all). Address words such as
 * "sayang" count less than real topics, multi-word phrases count more, and
 * rules with `andAny` only fit when one of those extra words is present.
 */
function ruleScore(rule: (typeof dialogueConfig.freeChat.rules)[number], padded: string, address: Set<string>) {
  let score = 0;
  for (const k of rule.match) {
    if (!hasKeyword(padded, k)) continue;
    const key = normalise(k);
    score = Math.max(score, address.has(key) ? ADDRESS_WEIGHT : key.includes(' ') ? 2 : 1);
  }
  if (score && 'andAny' in rule) {
    if (!rule.andAny.some((k) => hasKeyword(padded, k))) return 0;
    score += ANDANY_BONUS;
  }
  return score;
}

/**
 * Offline responder for free chat (used when no AI proxy is configured or the
 * AI cannot be reached). Picks the rule that best fits the WHOLE message —
 * ties go to the rule listed first in personalContent.ts.
 */
export function localFreeChat(text: string, ctx: TalkContext): PickedLine {
  const padded = ` ${normalise(text)} `;
  const random = ctx.random ?? Math.random;
  const rules = dialogueConfig.freeChat.rules;
  const address = new Set<string>(dialogueConfig.freeChat.addressWords.map(normalise));
  let best = -1;
  let bestScore = 0;
  rules.forEach((rule, r) => {
    const s = ruleScore(rule, padded, address);
    if (s > bestScore) {
      best = r;
      bestScore = s;
    }
  });
  if (best >= 0) return pickLine(rules[best].replies, `free:${best}`, ctx.save.dialogue.seen, random);
  return pickLine(dialogueConfig.freeChat.fallback, 'free:fallback', ctx.save.dialogue.seen, random);
}

/** Compact, human-readable game context for the optional remote AI. */
export function describeContext(ctx: TalkContext): string {
  const q = focusQuest(ctx.save);
  const done = Object.keys(ctx.save.completedQuests)
    .map((id) => QUEST_BY_ID[id as QuestId]?.name)
    .filter(Boolean)
    .join(', ');
  return [
    `Location: ${ctx.location}.`,
    q ? `Current quest: ${q.name} — ${q.hint}` : 'All quests complete.',
    done ? `Completed: ${done}.` : 'No quests completed yet.',
  ].join(' ');
}
