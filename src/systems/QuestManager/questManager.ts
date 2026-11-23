/**
 * Quest logic as pure functions of SaveData — easy to test and impossible to
 * desynchronise from the save file.
 */
import { MAIN_QUESTS, QUESTS, QUEST_BY_ID, type QuestDef, type QuestObjective } from '../../config/questConfig';
import type { QuestId, QuestStatus, SaveData } from '../../stores/progressTypes';
import type { GateId } from '../WorldManager/worldTypes';

export function countCollected(save: Pick<SaveData, 'collected'>, prefix: string) {
  let n = 0;
  for (const k in save.collected) if (k.startsWith(prefix)) n++;
  return n;
}

export function objectiveProgress(save: SaveData, o: QuestObjective): { current: number; target: number; done: boolean } {
  let current = 0;
  if (o.source.type === 'flag') current = save.flags[o.source.flag] ? 1 : 0;
  else current = countCollected(save, o.source.prefix);
  current = Math.min(current, o.target);
  return { current, target: o.target, done: current >= o.target };
}

export function isQuestCompleted(save: SaveData, id: QuestId) {
  return save.completedQuests[id] !== undefined;
}

export function prerequisitesMet(save: SaveData, q: QuestDef) {
  return q.prerequisites.every((p) => isQuestCompleted(save, p));
}

export function questStatus(save: SaveData, id: QuestId): QuestStatus {
  if (isQuestCompleted(save, id)) return 'completed';
  return prerequisitesMet(save, QUEST_BY_ID[id]) ? 'active' : 'locked';
}

export function requiredObjectivesDone(save: SaveData, q: QuestDef) {
  return q.objectives.filter((o) => !o.optional).every((o) => objectiveProgress(save, o).done);
}

/**
 * Quests whose required objectives are all satisfied but that are not yet
 * marked complete. The game completes these automatically — a safety net
 * that guarantees no quest can dead-end (e.g. after skipping a cutscene).
 */
export function pendingCompletions(save: SaveData): QuestId[] {
  return QUESTS.filter((q) => !isQuestCompleted(save, q.id) && prerequisitesMet(save, q) && requiredObjectivesDone(save, q)).map(
    (q) => q.id,
  );
}

export function mainQuestsCompleted(save: SaveData) {
  return MAIN_QUESTS.filter((id) => isQuestCompleted(save, id)).length;
}

export function allMainQuestsComplete(save: SaveData) {
  return mainQuestsCompleted(save) === MAIN_QUESTS.length;
}

/** Which story gates are open, derived purely from progress. */
export function isGateOpen(save: SaveData, gate: GateId): boolean {
  switch (gate) {
    case 'castleGate':
      return !!save.flags.bouquetReceived && !!save.flags.castleRevealed;
    case 'worldEast':
    case 'worldWest':
    case 'worldSouth':
      return !!save.flags.letterRead;
    case 'hillBridge':
      return allMainQuestsComplete(save);
    case 'secretDoor':
      return !!save.flags.secretUnlocked;
  }
}

export const ALL_GATES: GateId[] = ['castleGate', 'worldEast', 'worldWest', 'worldSouth', 'hillBridge', 'secretDoor'];

/**
 * The quest the tracker should spotlight: the story chain first, then the
 * nearest unfinished main quest in a sensible order, then the finale/secret.
 */
export function focusQuest(save: SaveData): QuestDef | null {
  const order: QuestId[] = [
    'coronation',
    'bouquet',
    'castle',
    'letter',
    'garden',
    'mirror',
    'library',
    'courtroom',
    'children',
    'storm',
    'finale',
    'secret',
  ];
  for (const id of order) {
    if (questStatus(save, id) === 'active') return QUEST_BY_ID[id];
  }
  return null;
}

/** First unfinished required objective of a quest. */
export function nextObjective(save: SaveData, q: QuestDef) {
  return q.objectives.find((o) => !o.optional && !objectiveProgress(save, o).done) ?? null;
}

/** Overall completion percentage across all story quests (side quest excluded). */
export function overallProgress(save: SaveData) {
  const story = QUESTS.filter((q) => !q.side);
  const done = story.filter((q) => isQuestCompleted(save, q.id)).length;
  return Math.round((done / story.length) * 100);
}
