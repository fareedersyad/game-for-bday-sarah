/// <reference types="node" />
/**
 * CONTENT INTEGRITY — proves that moving text into personalContent.ts did
 * not lose or alter a single sentence, and keeps it that way.
 *
 * The baseline fixtures were captured from the game BEFORE the refactor:
 *   GEN_CONTENT_BASELINE=1 npx vitest run src/test/content-integrity.test.ts
 * Never regenerate them to make a failing test pass — a failure means text
 * was lost or changed. (Intentional edits to personalContent.ts by the owner
 * are expected to fail the first two tests: see PERSONAL_CONTENT_GUIDE.md.)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { personalContent } from '../config/personalContent';
import { fmt } from '../utils/text';
import { allSourceCode, configSnapshot, extractSourceTexts } from './contentBaseline';

const DIR = join(__dirname, 'fixtures');
const CONFIG_FILE = join(DIR, 'config-baseline.json');
const TEXT_FILE = join(DIR, 'text-baseline.json');
const GENERATE = process.env.GEN_CONTENT_BASELINE === '1';

/**
 * Every value in the baseline must still exist, unchanged, at the same path.
 * New content may be ADDED (e.g. extra chat topics) — nothing may be removed
 * or reworded. Returns the list of differences.
 */
function lostOrChanged(actual: unknown, baseline: unknown, path = '$'): string[] {
  if (baseline !== null && typeof baseline === 'object') {
    if (actual === null || typeof actual !== 'object') return [`${path}: missing`];
    const out: string[] = [];
    for (const [k, v] of Object.entries(baseline)) out.push(...lostOrChanged((actual as Record<string, unknown>)[k], v, `${path}.${k}`));
    return out;
  }
  return Object.is(actual, baseline) ? [] : [`${path}: ${JSON.stringify(baseline)} → ${JSON.stringify(actual)}`];
}

/** All string values inside an object (deep). */
function allStrings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) allStrings(x, out);
  return out;
}

/** Undo JS string escaping so source text can be compared with literal values. */
function unescapeForSearch(code: string) {
  return code.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');
}

describe('content integrity (verbatim after refactor)', () => {
  if (GENERATE) {
    it('writes the baseline fixtures', () => {
      mkdirSync(DIR, { recursive: true });
      if (existsSync(CONFIG_FILE) || existsSync(TEXT_FILE)) throw new Error('Baseline already exists — refusing to overwrite.');
      writeFileSync(CONFIG_FILE, JSON.stringify(configSnapshot(), null, 2));
      writeFileSync(TEXT_FILE, JSON.stringify(extractSourceTexts(), null, 2));
    });
    return;
  }

  it('every configured text (names, letters, dialogue, quests, items, locations) is unchanged', () => {
    const baseline = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    expect(lostOrChanged(configSnapshot(), baseline)).toEqual([]);
  });

  it('every player-visible sentence that was in the code still exists verbatim', () => {
    const baseline = JSON.parse(readFileSync(TEXT_FILE, 'utf8')) as Record<string, string[]>;
    const haystack = unescapeForSearch(allSourceCode());
    const missing: string[] = [];
    for (const [file, texts] of Object.entries(baseline)) {
      // JSX text may spell "&" as "&amp;"; both render the same.
      for (const t of texts) if (!haystack.includes(t) && !haystack.includes(t.replace(/&amp;/g, '&'))) missing.push(`${file}: ${JSON.stringify(t)}`);
    }
    expect(missing).toEqual([]);
  });

  it('player-visible text lives only in personalContent.ts', () => {
    // Not player-visible (CSS values, developer logs, the hidden AI context) or
    // deliberately untouched (saveManager.ts — the save system is frozen).
    const allowed: Record<string, RegExp> = {
      'components/navigation/WorldMap.tsx': /^\) rotate\($/,
      'components/overlays/BookOverlay.tsx': /^cc 60%, $/,
      'components/overlays/LetterOverlay.tsx': /^(polygon\(.*\)|top center)$/,
      'components/overlays/MirrorOverlay.tsx': /^50% 50%/,
      'components/ui/ErrorBoundary.tsx': /^\[A World Made Just For Her\]$/,
      'systems/DialogueManager/dialogueEngine.ts': /^(All quests complete\.|Current quest: |No quests completed yet\.|Completed: |Location: )$/,
      'systems/DialogueManager/remoteAI.ts': /./,
      'systems/SaveManager/saveManager.ts': /./,
    };
    const stray: string[] = [];
    for (const [file, texts] of Object.entries(extractSourceTexts())) {
      if (file === 'config/personalContent.ts') continue;
      for (const t of texts) {
        const looksVisible = /\s/.test(t.trim()) || /[^\x00-\x7F]/.test(t);
        if (looksVisible && !allowed[file]?.test(t)) stray.push(`${file}: ${JSON.stringify(t)}`);
      }
    }
    expect(stray).toEqual([]);
  });

  it('uses only "saya" and "awak" (never aku / kau / engkau / kamu)', () => {
    const banned = /(^|[^\p{L}])(aku|kau|engkau|kamu)(?![\p{L}])/iu;
    const offenders = allStrings(personalContent).filter((t) => banned.test(t));
    for (const texts of Object.values(extractSourceTexts())) offenders.push(...texts.filter((t) => banned.test(t)));
    expect(offenders).toEqual([]);
  });

  it('fills names and game placeholders', () => {
    expect(fmt(personalContent.ui.hud.princessName)).toBe('Princess Sarah');
    expect(fmt(personalContent.story.toasts.flowerPicked, { flower: 'Tulip', count: 3, total: 10 })).toBe('Tulip dikutip · 3/10');
    expect(fmt('Hai {unknown}', {})).toBe('Hai {unknown}');
  });

  it('keeps the names Princess Sarah and Prince Fareed', () => {
    expect(personalContent.names.HER_NAME).toBe('Sarah');
    expect(personalContent.names.YOUR_NAME).toBe('Fareed');
    expect(fmt(personalContent.speakerNames.him)).toBe('Prince Fareed');
    expect(fmt(personalContent.speakerNames.her)).toBe('Princess Sarah');
  });
});
