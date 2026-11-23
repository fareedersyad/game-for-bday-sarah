import type { AreaId, LocationId } from '../systems/WorldManager/worldTypes';

export type FlagId =
  | 'gameStarted'
  | 'crownAccepted'
  | 'bouquetReceived'
  | 'castleRevealed'
  | 'castleEntered'
  | 'bouquetPlaced'
  | 'letterRead'
  | 'kingdomAnnounced'
  | 'gardenMessageShown'
  | 'hasSeeds'
  | 'hasWateringCan'
  | 'mirrorAnswered'
  | 'courtVerdict'
  | 'momoTalked'
  | 'toyFound'
  | 'toyReturned'
  | 'stormStarted'
  | 'stormFound'
  | 'hillAnnounced'
  | 'finaleWatched'
  | 'secretUnlocked'
  | 'secretEntered'
  | 'finalLetterRead'
  | 'giftOpened'
  | 'creditsSeen'
  // Strawberry Garden & picnic (optional)
  | 'strawberryIntro'
  | 'picnicDone'
  // Birthday cake in the Secret Room
  | 'cakeRevealed'
  | 'wishMade'
  | 'candlesBlown';

export type QuestId =
  | 'coronation'
  | 'bouquet'
  | 'castle'
  | 'letter'
  | 'garden'
  | 'mirror'
  | 'library'
  | 'courtroom'
  | 'children'
  | 'storm'
  | 'finale'
  | 'secret'
  | 'memories'
  | 'strawberries';

export type ItemId =
  | 'crown'
  | 'bouquet'
  | 'castleKey'
  | 'loveLetter'
  | 'seeds'
  | 'wateringCan'
  | 'roseCharm'
  | 'pearlMirror'
  | 'starBookmark'
  | 'justiceBadge'
  | 'momoToy'
  | 'kindnessBadge'
  | 'rainbowCrystal'
  | 'starlightLocket'
  | 'finalLetter'
  | 'strawberry'
  | 'strawberryBasket';

export interface Appearance {
  gownColor: string;
  gownAccent: string;
  hijabColor: string;
  hijabTrim: string;
  skinTone: string;
  crownGem: string;
}

export interface PlayerSave {
  area: AreaId;
  x: number;
  z: number;
  yaw: number;
}

export interface DialogueMemory {
  /** line id -> times shown */
  seen: Record<string, number>;
  talkCount: number;
  /** Topics chosen recently (most recent last). */
  recentTopics: string[];
  /** Reactions queued by story events, consumed on the next conversation. */
  pendingReactions: string[];
  memoryCursor: number;
  lastTalkAt: number | null;
}

export interface SaveData {
  version: number;
  flags: Partial<Record<FlagId, boolean>>;
  /** Namespaced ids ("flower:flower_01", "book:book2", …) → timestamp collected. */
  collected: Record<string, number>;
  completedQuests: Partial<Record<QuestId, number>>;
  inventory: Partial<Record<ItemId, number>>;
  visited: Partial<Record<LocationId, number>>;
  dialogue: DialogueMemory;
  player: PlayerSave | null;
  appearance: Appearance;
  stats: { startedAt: number | null; completedAt: number | null; playSeconds: number };
}

export type QuestStatus = 'locked' | 'active' | 'completed';
