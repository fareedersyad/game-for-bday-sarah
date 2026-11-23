import { beforeEach, describe, expect, it } from 'vitest';
import { MAIN_QUESTS, QUEST_BY_ID } from '../config/questConfig';
import { gameConfig } from '../config/gameConfig';
import { getSave, PROGRESS_KEY, useGameStore } from '../stores/gameStore';
import {
  birthdayState,
  blowOutCandles,
  harvestStrawberry,
  makeBirthdayWish,
  picnicUnlocked,
  STRAWBERRIES_REQUIRED,
  STRAWBERRY_IDS,
  strawberriesPicked,
} from '../systems/Story/celebrations';
import { safeStorage } from '../systems/SaveManager/safeStorage';
import { saveManager } from '../systems/SaveManager/saveManager';
import { allMainQuestsComplete, isGateOpen, objectiveProgress, pendingCompletions, questStatus } from '../systems/QuestManager/questManager';
import { CollisionWorld } from '../systems/PlayerController/collision';
import { NavGrid } from '../systems/CompanionNavigation/navGrid';
import {
  AREA_BOUNDS,
  collidersFor,
  GATE_INFO,
  LANDMARKS,
  SEATS,
  STRAWBERRY_GARDEN,
  STRAWBERRY_SPOTS,
  TREES,
} from '../systems/WorldManager/worldLayout';
import type { AreaId, GateId } from '../systems/WorldManager/worldTypes';
import {
  COMPANION_RADIUS,
  commandGoto,
  commandSit,
  createCompanionState,
  updateCompanion,
  type PlayerSnapshot,
} from '../systems/CompanionController/companionController';
import { dirToYaw } from '../utils/math';

const st = () => useGameStore.getState();

/** Fresh save with the kingdom open (love letter read). */
function openKingdom() {
  st().resetProgress();
  st().setFlag('letterRead');
  for (const q of ['coronation', 'bouquet', 'castle', 'letter'] as const) st().markQuestComplete(q);
}

describe('Strawberry quest — The Sweetest Little Harvest', () => {
  beforeEach(openKingdom);

  it('is an optional side quest that never gates the hill or the ending', () => {
    const q = QUEST_BY_ID.strawberries;
    expect(q.side).toBe(true);
    expect(MAIN_QUESTS).not.toContain('strawberries');
    expect(QUEST_BY_ID.finale.prerequisites).not.toContain('strawberries');
    // Finish the six main quests without touching strawberries → hill opens.
    for (const id of MAIN_QUESTS) st().markQuestComplete(id);
    expect(allMainQuestsComplete(getSave())).toBe(true);
    expect(isGateOpen(getSave(), 'hillBridge')).toBe(true);
    expect(questStatus(getSave(), 'strawberries')).toBe('active');
  });

  it('has exactly five picking spots matching the configured requirement', () => {
    expect(STRAWBERRY_IDS).toHaveLength(STRAWBERRIES_REQUIRED);
    expect(new Set(STRAWBERRY_IDS).size).toBe(STRAWBERRIES_REQUIRED);
    expect(gameConfig.STRAWBERRY_GARDEN.required).toBe(5);
  });

  it('collects all five, updating the counter and inventory one by one', () => {
    const q = QUEST_BY_ID.strawberries;
    STRAWBERRY_IDS.forEach((id, i) => {
      expect(harvestStrawberry(id)).toBe('collected');
      expect(strawberriesPicked(getSave())).toBe(i + 1);
      expect(getSave().inventory.strawberry).toBe(i + 1);
      expect(objectiveProgress(getSave(), q.objectives[0]).current).toBe(i + 1);
    });
    expect(objectiveProgress(getSave(), q.objectives[0])).toEqual({ current: 5, target: 5, done: true });
    expect(pendingCompletions(getSave())).toContain('strawberries');
  });

  it('prevents collecting the same strawberry twice (no duplicate inventory)', () => {
    expect(harvestStrawberry('straw_2')).toBe('collected');
    expect(harvestStrawberry('straw_2')).toBe('duplicate');
    expect(harvestStrawberry('straw_2')).toBe('duplicate');
    expect(getSave().inventory.strawberry).toBe(1);
    expect(strawberriesPicked(getSave())).toBe(1);
  });

  it('rejects unknown spots and is locked before the kingdom opens', () => {
    expect(harvestStrawberry('straw_99')).toBe('unknown');
    st().resetProgress();
    expect(harvestStrawberry('straw_1')).toBe('locked');
    expect(getSave().inventory.strawberry).toBeUndefined();
  });

  it('saves to localStorage and restores progress after a reload', async () => {
    harvestStrawberry('straw_1');
    harvestStrawberry('straw_4');
    // Writes are coalesced; a tab close / hide flushes them — do the same here.
    saveManager.flush();
    const raw = safeStorage.getItem(PROGRESS_KEY);
    expect(raw).toContain('berry:straw_1');
    expect(raw).toContain('berry:straw_4');
    // Simulate a fresh page: wipe memory state, put the saved string back, rehydrate.
    st().resetProgress();
    saveManager.flush();
    expect(strawberriesPicked(getSave())).toBe(0);
    safeStorage.setItem(PROGRESS_KEY, raw!);
    await useGameStore.persist.rehydrate();
    expect(strawberriesPicked(getSave())).toBe(2);
    expect(getSave().inventory.strawberry).toBe(2);
    // Restored spots still refuse a second harvest.
    expect(harvestStrawberry('straw_1')).toBe('duplicate');
  });

  it('unlocks the picnic only after the harvest quest is completed (reward granted once)', () => {
    expect(picnicUnlocked(getSave())).toBe(false);
    STRAWBERRY_IDS.forEach(harvestStrawberry);
    expect(picnicUnlocked(getSave())).toBe(false); // completion is a story moment
    expect(st().markQuestComplete('strawberries')).toBe(true);
    expect(st().markQuestComplete('strawberries')).toBe(false); // never twice
    expect(picnicUnlocked(getSave())).toBe(true);
  });
});

describe('Birthday cake in the Secret Room', () => {
  beforeEach(openKingdom);

  it('is hidden until the Secret Room unlocks, then waits to be revealed', () => {
    expect(birthdayState(getSave())).toMatchObject({ cakeVisible: false, revealPending: false, canWish: false, canBlow: false });
    st().setFlag('secretUnlocked');
    expect(birthdayState(getSave())).toMatchObject({ cakeVisible: true, revealPending: true, canWish: false, finalLetterAvailable: false });
    st().setFlag('cakeRevealed');
    expect(birthdayState(getSave())).toMatchObject({ revealPending: false, canWish: true, canBlow: false });
  });

  it('wish → blow candles completes once; repeats never re-trigger the celebration', () => {
    st().setFlag('secretUnlocked');
    st().setFlag('cakeRevealed');
    expect(makeBirthdayWish()).toBe(true);
    expect(makeBirthdayWish()).toBe(false);
    expect(birthdayState(getSave()).canBlow).toBe(true);
    expect(blowOutCandles()).toBe(true);
    expect(blowOutCandles()).toBe(false);
    expect(blowOutCandles()).toBe(false);
    expect(birthdayState(getSave())).toMatchObject({ celebrated: true, canWish: false, canBlow: false, finalLetterAvailable: true });
    // Wishing after the celebration is a no-op too.
    expect(makeBirthdayWish()).toBe(false);
  });

  it('cannot blow candles before the Secret Room is unlocked', () => {
    expect(blowOutCandles()).toBe(false);
    expect(getSave().flags.candlesBlown).toBeUndefined();
  });

  it('places the final letter after the candles, but keeps it for saves that already read it', () => {
    st().setFlag('secretUnlocked');
    expect(birthdayState(getSave()).finalLetterAvailable).toBe(false);
    st().setFlag('finalLetterRead'); // a save from before the cake existed
    expect(birthdayState(getSave()).finalLetterAvailable).toBe(true);
  });

  it('the Secret Room quest now includes the candles, before the final letter', () => {
    const ids = QUEST_BY_ID.secret.objectives.map((o) => o.id);
    expect(ids).toEqual(['enter', 'candles', 'read']);
  });

  it('keeps the birthday date configurable (no hard-coded date in the cake config)', () => {
    expect(JSON.stringify(gameConfig.BIRTHDAY_CAKE)).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

// ---------------------------------------------------------------- world & companion
function world(area: AreaId, open: GateId[]) {
  const w = new CollisionWorld(collidersFor(area), AREA_BOUNDS[area]);
  (Object.keys(GATE_INFO) as GateId[]).forEach((g) => w.setGateOpen(g, open.includes(g)));
  return w;
}
const ALL = Object.keys(GATE_INFO) as GateId[];

function* walk(w: CollisionWorld, start: { x: number; z: number }, waypoints: Array<[number, number]>, speed = 4.4, dt = 1 / 60) {
  const p: PlayerSnapshot = { area: 'overworld', x: start.x, z: start.z, yaw: 0, moving: false, speed: 0 };
  for (const [tx, tz] of waypoints) {
    let guard = 0;
    while (Math.hypot(tx - p.x, tz - p.z) > 0.3 && guard++ < 6000) {
      const dx = tx - p.x;
      const dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      const r = w.move(p.x, p.z, (dx / d) * speed * dt, (dz / d) * speed * dt, 0.38);
      p.x = r.x;
      p.z = r.z;
      p.yaw = dirToYaw(dx, dz);
      p.moving = true;
      p.speed = speed;
      yield p;
    }
  }
  p.moving = false;
  p.speed = 0;
  for (let i = 0; i < 180; i++) yield p;
}

describe('Strawberry Garden world layout', () => {
  it('clears trees from the garden footprint only', () => {
    const a = STRAWBERRY_GARDEN.area;
    expect(TREES.some((t) => t.x > a.minX && t.x < a.maxX && t.z > a.minZ && t.z < a.maxZ)).toBe(false);
    expect(TREES.length).toBeGreaterThan(200);
  });

  it('is sealed by the world gates before the love letter, and walkable after', () => {
    const sealed = new NavGrid(world('overworld', []), 0.8, 0.46);
    expect(sealed.findPath(LANDMARKS.spawn, STRAWBERRY_SPOTS[0])).toBeNull();
    const open = new NavGrid(world('overworld', ALL), 0.8, 0.46);
    for (const sp of STRAWBERRY_SPOTS) expect(open.findPath(LANDMARKS.spawn, sp), sp.id).not.toBeNull();
  });
});

describe('Prince Fareed during the new interactions', () => {
  it('stays close while she visits all five strawberries, never clipping beds or the gazebo', () => {
    const w = world('overworld', ALL);
    const env = { world: w, grid: new NavGrid(w, 0.8, 0.46) };
    const c = createCompanionState('overworld', 38, -7);
    c.mode = 'follow';
    const route: Array<[number, number]> = [[41, -9.2], ...STRAWBERRY_SPOTS.flatMap((sp) => [[sp.x, sp.z] as [number, number]]), [47, -11]];
    let maxD = 0;
    let frames = 0;
    let last: PlayerSnapshot | null = null;
    for (const p of walk(w, { x: 37, z: -7.5 }, route)) {
      updateCompanion(c, p, env, 1 / 60);
      frames++;
      if (frames > 120) maxD = Math.max(maxD, Math.hypot(c.x - p.x, c.z - p.z));
      expect(w.isBlocked(c.x, c.z, COMPANION_RADIUS - 0.05)).toBe(false);
      last = { ...p };
    }
    expect(maxD).toBeLessThan(7);
    expect(Math.hypot(c.x - last!.x, c.z - last!.z)).toBeLessThan(2.8);
    expect(c.moving).toBe(false);
  });

  it('walks into the gazebo and sits on his picnic cushion', () => {
    const w = world('overworld', ALL);
    const env = { world: w, grid: new NavGrid(w, 0.8, 0.46) };
    const c = createCompanionState('overworld', 46.5, -12);
    c.mode = 'follow';
    const seat = SEATS.find((s) => s.id === 'picnicHim')!;
    commandSit(c, seat);
    const her: PlayerSnapshot = { area: 'overworld', ...STRAWBERRY_GARDEN.princessSeat, yaw: 0, moving: false, speed: 0 };
    for (let i = 0; i < 60 * 12; i++) updateCompanion(c, her, env, 1 / 60);
    expect(Math.hypot(c.x - seat.x, c.z - seat.z)).toBeLessThan(0.3);
    expect(c.sit).toBeGreaterThan(0.9);
    expect(c.recoveries).toBe(0);
    // Close to her on the blanket.
    expect(Math.hypot(c.x - her.x, c.z - her.z)).toBeLessThan(2);
  });

  it('joins her at the birthday table in the Secret Room', () => {
    const w = world('castle', ALL);
    const env = { world: w, grid: new NavGrid(w, 0.5, 0.46) };
    const c = createCompanionState('castle', -8.5, 1.5);
    c.mode = 'follow';
    const her: PlayerSnapshot = { area: 'castle', x: -16.6, z: 2.5, yaw: 0, moving: false, speed: 0 };
    commandGoto(c, { x: -17.2, z: 4.35, yaw: 0 }, 0.35);
    let arrived = false;
    for (let i = 0; i < 60 * 15 && !arrived; i++) {
      updateCompanion(c, her, env, 1 / 60);
      if (c.arrivedFlag) arrived = true;
    }
    expect(arrived).toBe(true);
    expect(c.mode).toBe('hold');
    expect(Math.hypot(c.x - her.x, c.z - her.z)).toBeLessThan(2.5);
  });
});
