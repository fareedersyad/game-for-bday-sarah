/**
 * Persisted progress store (localStorage key: awmjfh.progress.v1).
 * Only durable story state lives here; per-frame state lives in systems/runtime.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { migrateSave, saveManager, validateSaveData } from '../systems/SaveManager/saveManager';
import { createEmptySave, DEFAULT_APPEARANCE, PROGRESS_KEY, SAVE_VERSION } from './saveDefaults';
import type { LocationId } from '../systems/WorldManager/worldTypes';
import type { Appearance, FlagId, ItemId, PlayerSave, QuestId, SaveData } from './progressTypes';

// Re-exported for existing imports.
export { createEmptySave, DEFAULT_APPEARANCE, PROGRESS_KEY, SAVE_VERSION };

export interface GameStore extends SaveData {
  setFlag: (flag: FlagId, value?: boolean) => void;
  collect: (id: string) => boolean;
  addItem: (item: ItemId, qty?: number) => void;
  removeItem: (item: ItemId, qty?: number) => void;
  markQuestComplete: (id: QuestId) => boolean;
  visit: (loc: LocationId) => boolean;
  savePlayer: (p: PlayerSave) => void;
  setAppearance: (a: Partial<Appearance>) => void;
  recordLine: (lineId: string) => void;
  recordTalk: (topic: string) => void;
  queueReaction: (key: string) => void;
  consumeReactions: () => string[];
  advanceMemoryCursor: () => number;
  addPlayTime: (seconds: number) => void;
  resetProgress: () => void;
  /** Replace everything (used by tests and the debug panel). */
  hydrateFrom: (data: SaveData) => void;
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...createEmptySave(),

      setFlag: (flag, value = true) => {
        if (!!get().flags[flag] === value) return;
        set((s) => ({ flags: { ...s.flags, [flag]: value } }));
      },

      collect: (id) => {
        if (get().collected[id] !== undefined) return false;
        set((s) => ({ collected: { ...s.collected, [id]: Date.now() } }));
        return true;
      },

      addItem: (item, qty = 1) =>
        set((s) => ({ inventory: { ...s.inventory, [item]: (s.inventory[item] ?? 0) + qty } })),

      removeItem: (item, qty = 1) =>
        set((s) => {
          const next = Math.max(0, (s.inventory[item] ?? 0) - qty);
          const inv = { ...s.inventory };
          if (next === 0) delete inv[item];
          else inv[item] = next;
          return { inventory: inv };
        }),

      markQuestComplete: (id) => {
        if (get().completedQuests[id] !== undefined) return false;
        set((s) => ({ completedQuests: { ...s.completedQuests, [id]: Date.now() } }));
        return true;
      },

      visit: (loc) => {
        if (get().visited[loc] !== undefined) return false;
        set((s) => ({ visited: { ...s.visited, [loc]: Date.now() } }));
        return true;
      },

      savePlayer: (p) => set({ player: p }),

      setAppearance: (a) => set((s) => ({ appearance: { ...s.appearance, ...a } })),

      recordLine: (lineId) =>
        set((s) => ({ dialogue: { ...s.dialogue, seen: { ...s.dialogue.seen, [lineId]: (s.dialogue.seen[lineId] ?? 0) + 1 } } })),

      recordTalk: (topic) =>
        set((s) => ({
          dialogue: {
            ...s.dialogue,
            talkCount: topic === 'greeting' ? s.dialogue.talkCount + 1 : s.dialogue.talkCount,
            recentTopics: [...s.dialogue.recentTopics, topic].slice(-8),
            lastTalkAt: Date.now(),
          },
        })),

      queueReaction: (key) =>
        set((s) =>
          s.dialogue.pendingReactions.includes(key)
            ? s
            : { dialogue: { ...s.dialogue, pendingReactions: [...s.dialogue.pendingReactions, key] } },
        ),

      consumeReactions: () => {
        const r = get().dialogue.pendingReactions;
        if (r.length) set((s) => ({ dialogue: { ...s.dialogue, pendingReactions: [] } }));
        return r;
      },

      advanceMemoryCursor: () => {
        const c = get().dialogue.memoryCursor;
        set((s) => ({ dialogue: { ...s.dialogue, memoryCursor: c + 1 } }));
        return c;
      },

      addPlayTime: (seconds) => set((s) => ({ stats: { ...s.stats, playSeconds: s.stats.playSeconds + seconds } })),

      resetProgress: () => {
        // Safety net: keep a copy of the progress being reset (restorable in Settings).
        saveManager.backup(get(), 'before-reset');
        const appearance = get().appearance;
        set({ ...createEmptySave(), appearance });
      },

      hydrateFrom: (data) => set({ ...validateSaveData(data).data }),
    }),
    {
      name: PROGRESS_KEY,
      version: SAVE_VERSION,
      // Validated, versioned, backed-up, debounced storage (see SaveManager).
      storage: saveManager.progressStorage,
      partialize: (s): SaveData => ({
        version: s.version,
        flags: s.flags,
        collected: s.collected,
        completedQuests: s.completedQuests,
        inventory: s.inventory,
        visited: s.visited,
        dialogue: s.dialogue,
        player: s.player,
        appearance: s.appearance,
        stats: s.stats,
      }),
      // Merge defensively so saves from older builds (missing keys) still load.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SaveData>;
        const empty = createEmptySave();
        return {
          ...current,
          ...empty,
          ...p,
          dialogue: { ...empty.dialogue, ...(p.dialogue ?? {}) },
          appearance: { ...empty.appearance, ...(p.appearance ?? {}) },
          stats: { ...empty.stats, ...(p.stats ?? {}) },
        };
      },
      migrate: (persisted, version) => validateSaveData(migrateSave(persisted, version)).data,
    },
  ),
);

/** Snapshot of the save data only (without actions). */
export function getSave(): SaveData {
  return useGameStore.getState();
}
