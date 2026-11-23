/**
 * CELEBRATIONS — rules for Sarah's Strawberry Garden, the picnic and the
 * birthday cake. Kept free of rendering / UI so they can be unit-tested and
 * so every reward is granted exactly once (idempotent against replays,
 * reloads and double-taps).
 */
import { gameConfig } from '../../config/gameConfig';
import { useGameStore } from '../../stores/gameStore';
import type { SaveData } from '../../stores/progressTypes';
import { countCollected, isQuestCompleted } from '../QuestManager/questManager';
import { STRAWBERRY_SPOTS } from '../WorldManager/worldLayout';

export const STRAWBERRY_IDS: readonly string[] = STRAWBERRY_SPOTS.map((s) => s.id);
export const STRAWBERRIES_REQUIRED = gameConfig.STRAWBERRY_GARDEN.required;

export type HarvestResult = 'collected' | 'duplicate' | 'locked' | 'unknown';

/** The Strawberry Garden opens together with the rest of the kingdom (after the love letter). */
export function strawberryGardenOpen(save: SaveData) {
  return !!save.flags.letterRead;
}

export function isStrawberryPicked(save: SaveData, id: string) {
  return save.collected[`berry:${id}`] !== undefined;
}

export function strawberriesPicked(save: SaveData) {
  return countCollected(save, 'berry:');
}

/**
 * Pick one ripe strawberry. Adds exactly one strawberry to the inventory the
 * first time a given spot is harvested; repeated calls are harmless no-ops.
 */
export function harvestStrawberry(id: string): HarvestResult {
  if (!STRAWBERRY_IDS.includes(id)) return 'unknown';
  const st = useGameStore.getState();
  if (!strawberryGardenOpen(st)) return 'locked';
  if (!st.collect(`berry:${id}`)) return 'duplicate';
  st.addItem('strawberry');
  return 'collected';
}

export function picnicUnlocked(save: SaveData) {
  return isQuestCompleted(save, 'strawberries');
}

export interface BirthdayState {
  /** The cake table is set up (Secret Room unlocked by the fireworks finale). */
  cakeVisible: boolean;
  /** Fareed has not yet revealed the cake. */
  revealPending: boolean;
  /** She can make her wish now. */
  canWish: boolean;
  /** Wish made — the candles are waiting to be blown out. */
  canBlow: boolean;
  /** Candles are out (the celebration happened). */
  celebrated: boolean;
  /** The final letter can be opened (after the candles; always for saves that already read it). */
  finalLetterAvailable: boolean;
}

export function birthdayState(save: SaveData): BirthdayState {
  const f = save.flags;
  const unlocked = !!f.secretUnlocked;
  return {
    cakeVisible: unlocked,
    revealPending: unlocked && !f.cakeRevealed,
    canWish: unlocked && !!f.cakeRevealed && !f.wishMade && !f.candlesBlown,
    canBlow: unlocked && !!f.wishMade && !f.candlesBlown,
    celebrated: !!f.candlesBlown,
    finalLetterAvailable: unlocked && (!!f.candlesBlown || !!f.finalLetterRead),
  };
}

/** Record the wish. Returns true only the first time. */
export function makeBirthdayWish(): boolean {
  const st = useGameStore.getState();
  if (!st.flags.secretUnlocked || st.flags.wishMade || st.flags.candlesBlown) return false;
  st.setFlag('wishMade');
  return true;
}

/**
 * Blow out the candles. Returns true only the first time, so the fireworks
 * celebration and its rewards can never be triggered twice.
 */
export function blowOutCandles(): boolean {
  const st = useGameStore.getState();
  if (!st.flags.secretUnlocked || st.flags.candlesBlown) return false;
  if (!st.flags.wishMade) st.setFlag('wishMade');
  st.setFlag('candlesBlown');
  return true;
}
