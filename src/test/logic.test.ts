import { describe, expect, it } from 'vitest';
import { MAIN_QUESTS, QUESTS } from '../config/questConfig';
import { createEmptySave } from '../stores/gameStore';
import type { SaveData } from '../stores/progressTypes';
import {
  allMainQuestsComplete,
  focusQuest,
  isGateOpen,
  objectiveProgress,
  overallProgress,
  pendingCompletions,
  questStatus,
} from '../systems/QuestManager/questManager';
import { greeting, hintLines, localFreeChat, memoryLines, pickLine } from '../systems/DialogueManager/dialogueEngine';
import { fill, paragraphs } from '../utils/text';
import { gameConfig } from '../config/gameConfig';

const complete = (s: SaveData, ...ids: string[]) => {
  ids.forEach((id) => (s.completedQuests[id as keyof SaveData['completedQuests']] = 1));
  return s;
};

describe('quest manager', () => {
  it('starts with only the coronation active', () => {
    const s = createEmptySave();
    expect(questStatus(s, 'coronation')).toBe('active');
    expect(questStatus(s, 'bouquet')).toBe('locked');
    expect(questStatus(s, 'garden')).toBe('locked');
    expect(focusQuest(s)?.id).toBe('coronation');
  });

  it('auto-detects completable quests from objectives (safety net)', () => {
    const s = createEmptySave();
    s.flags.crownAccepted = true;
    expect(pendingCompletions(s)).toEqual(['coronation']);
    complete(s, 'coronation');
    expect(pendingCompletions(s)).toEqual([]);
    expect(questStatus(s, 'bouquet')).toBe('active');
  });

  it('counts collected objectives and ignores optional ones for completion', () => {
    const s = complete(createEmptySave(), 'coronation', 'bouquet', 'castle', 'letter');
    for (let i = 1; i <= 10; i++) s.collected[`flower:flower_${String(i).padStart(2, '0')}`] = 1;
    const garden = QUESTS.find((q) => q.id === 'garden')!;
    expect(objectiveProgress(s, garden.objectives[0])).toEqual({ current: 10, target: 10, done: true });
    expect(pendingCompletions(s)).not.toContain('garden');
    ['plot_1', 'plot_2', 'plot_3'].forEach((p) => (s.collected[`bloom:${p}`] = 1));
    expect(pendingCompletions(s)).toContain('garden'); // notes are optional
  });

  it('unlocks the hill only after all six main quests, then the secret room after the finale', () => {
    const s = complete(createEmptySave(), 'coronation', 'bouquet', 'castle', 'letter');
    expect(MAIN_QUESTS).toHaveLength(6);
    expect(isGateOpen(s, 'hillBridge')).toBe(false);
    complete(s, ...MAIN_QUESTS.slice(0, 5));
    expect(allMainQuestsComplete(s)).toBe(false);
    expect(questStatus(s, 'finale')).toBe('locked');
    complete(s, MAIN_QUESTS[5]);
    expect(isGateOpen(s, 'hillBridge')).toBe(true);
    expect(questStatus(s, 'finale')).toBe('active');
    expect(isGateOpen(s, 'secretDoor')).toBe(false);
    s.flags.secretUnlocked = true;
    expect(isGateOpen(s, 'secretDoor')).toBe(true);
  });

  it('castle and world gates follow the story order', () => {
    const s = createEmptySave();
    expect(isGateOpen(s, 'castleGate')).toBe(false);
    s.flags.bouquetReceived = true;
    s.flags.castleRevealed = true;
    expect(isGateOpen(s, 'castleGate')).toBe(true);
    expect(isGateOpen(s, 'worldEast')).toBe(false);
    s.flags.letterRead = true;
    expect(isGateOpen(s, 'worldEast') && isGateOpen(s, 'worldWest') && isGateOpen(s, 'worldSouth')).toBe(true);
  });

  it('every quest prerequisite exists and the story chain has no cycles', () => {
    const ids = new Set(QUESTS.map((q) => q.id));
    for (const q of QUESTS) for (const p of q.prerequisites) expect(ids.has(p)).toBe(true);
    // Completing quests in dependency order must eventually reach every quest.
    const s = createEmptySave();
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const q of QUESTS) {
        if (questStatus(s, q.id) === 'active') {
          complete(s, q.id);
          progressed = true;
        }
      }
    }
    expect(QUESTS.every((q) => questStatus(s, q.id) === 'completed')).toBe(true);
    expect(overallProgress(s)).toBe(100);
  });
});

describe('local dialogue engine', () => {
  it('prefers lines she has not heard yet', () => {
    const pool = ['a', 'b', 'c'];
    const seen = { 'x:0': 2, 'x:1': 0, 'x:2': 1 };
    expect(pickLine(pool, 'x', seen, () => 0).text).toBe('b');
  });

  it('greets differently the first time, and reacts to recent achievements', () => {
    const s = createEmptySave();
    expect(greeting({ location: 'garden', save: s }).lines[0].id).toBe('talk:first');
    s.dialogue.talkCount = 3;
    s.dialogue.pendingReactions = ['courtroom'];
    const g = greeting({ location: 'garden', save: s });
    expect(g.lines[0].id).toBe('reaction:courtroom');
    expect(g.consumedReactions).toEqual(['courtroom']);
  });

  it('gives quest-aware hints with objective progress', () => {
    const s = complete(createEmptySave(), 'coronation', 'bouquet', 'castle', 'letter');
    s.collected['flower:flower_01'] = 1;
    const lines = hintLines({ location: 'garden', save: s, random: () => 0 });
    expect(lines[0].id).toBe('hint:garden');
    expect(lines[1].text).toContain('1/10');
  });

  it('tells shared memories in order and then a closing line', () => {
    const s = createEmptySave();
    expect(memoryLines({ location: 'paths', save: s }).lines[0].id).toBe(`memory:${gameConfig.SHARED_MEMORIES[0].id}`);
    s.dialogue.memoryCursor = gameConfig.SHARED_MEMORIES.length;
    expect(memoryLines({ location: 'paths', save: s }).advance).toBe(false);
  });

  it('answers free chat by keyword, with a fallback', () => {
    const s = createEmptySave();
    expect(localFreeChat('Saya rindu awak', { location: 'paths', save: s }).id).toMatch(/^free:1:/);
    expect(localFreeChat('qwerty', { location: 'paths', save: s }).id).toMatch(/^free:fallback/);
  });
});

describe('text utils', () => {
  it('substitutes config tokens', () => {
    expect(fill('Hai {HER_NAME} dari {YOUR_NAME}')).toBe(`Hai ${gameConfig.HER_NAME} dari ${gameConfig.YOUR_NAME}`);
    expect(fill('{UNKNOWN}')).toBe('{UNKNOWN}');
  });
  it('splits letters into paragraphs', () => {
    expect(paragraphs(gameConfig.LOVE_LETTER.body).length).toBeGreaterThan(5);
  });
});
