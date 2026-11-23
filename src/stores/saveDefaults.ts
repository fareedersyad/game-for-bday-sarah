/** Save-file defaults shared by the progress store and the SaveManager (no store imports here). */
import type { Appearance, SaveData } from './progressTypes';

/**
 * Save schema version.
 *  1 — original release (no metadata, no validation).
 *  2 — validated & normalised on load, `savedAt` envelope metadata, backups.
 */
export const SAVE_VERSION = 2;

/** localStorage key. Kept identical across versions so existing saves are found. */
export const PROGRESS_KEY = 'awmjfh.progress.v1';

export const DEFAULT_APPEARANCE: Appearance = {
  gownColor: '#f2b8c6',
  gownAccent: '#e7c98f',
  hijabColor: '#fbe9ee',
  hijabTrim: '#d4a84f',
  skinTone: '#f3d2bd',
  crownGem: '#e8899e',
};

export function createEmptySave(): SaveData {
  return {
    version: SAVE_VERSION,
    flags: {},
    collected: {},
    completedQuests: {},
    inventory: {},
    visited: {},
    dialogue: { seen: {}, talkCount: 0, recentTopics: [], pendingReactions: [], memoryCursor: 0, lastTalkAt: null },
    player: null,
    appearance: { ...DEFAULT_APPEARANCE },
    stats: { startedAt: null, completedAt: null, playSeconds: 0 },
  };
}
