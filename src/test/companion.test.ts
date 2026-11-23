import { describe, expect, it } from 'vitest';
import {
  arriveThroughDoor,
  COMPANION_RADIUS,
  commandGoto,
  createCompanionState,
  updateCompanion,
  type PlayerSnapshot,
} from '../systems/CompanionController/companionController';
import { NavGrid } from '../systems/CompanionNavigation/navGrid';
import { CollisionWorld } from '../systems/PlayerController/collision';
import { AREA_BOUNDS, collidersFor, GATE_INFO, LANDMARKS } from '../systems/WorldManager/worldLayout';
import type { GateId } from '../systems/WorldManager/worldTypes';
import { dirToYaw } from '../utils/math';

function overworld() {
  const w = new CollisionWorld(collidersFor('overworld'), AREA_BOUNDS.overworld);
  (Object.keys(GATE_INFO) as GateId[]).forEach((g) => w.setGateOpen(g, true));
  return { world: w, grid: new NavGrid(w, 0.8, 0.46) };
}

/** Walk the player along waypoints at walking speed, with collision. */
function* walk(world: CollisionWorld, start: { x: number; z: number }, waypoints: Array<[number, number]>, speed = 4.4, dt = 1 / 60) {
  const p: PlayerSnapshot = { area: 'overworld', x: start.x, z: start.z, yaw: 0, moving: false, speed: 0 };
  for (const [tx, tz] of waypoints) {
    let guard = 0;
    while (Math.hypot(tx - p.x, tz - p.z) > 0.3 && guard++ < 6000) {
      const dx = tx - p.x;
      const dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      const res = world.move(p.x, p.z, (dx / d) * speed * dt, (dz / d) * speed * dt, 0.38);
      p.x = res.x;
      p.z = res.z;
      p.yaw = dirToYaw(dx, dz);
      p.moving = true;
      p.speed = speed;
      yield p;
    }
  }
  p.moving = false;
  p.speed = 0;
  for (let i = 0; i < 180; i++) yield p; // stand still 3 s
}

describe('Royal Companion follower', () => {
  it('follows her from the courtyard to the garden, never clipping obstacles', () => {
    const env = overworld();
    const c = createCompanionState('overworld', -1, 18);
    c.mode = 'follow';
    let maxDist = 0;
    let frames = 0;
    let last: PlayerSnapshot | null = null;
    for (const p of walk(env.world, LANDMARKS.spawn, [[0, 10], [14, 10], [26, 10], [33, 9], [40, 12]])) {
      updateCompanion(c, p, env, 1 / 60);
      frames++;
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (frames > 120) maxDist = Math.max(maxDist, d);
      expect(env.world.isBlocked(c.x, c.z, COMPANION_RADIUS - 0.05)).toBe(false);
      last = { ...p };
    }
    expect(maxDist).toBeLessThan(6);
    const dEnd = Math.hypot(c.x - last!.x, c.z - last!.z);
    expect(dEnd).toBeLessThan(2.6);
    expect(dEnd).toBeGreaterThan(0.85); // stands beside her, not inside her
    expect(c.moving).toBe(false); // stops when she stops
    expect(c.recoveries).toBe(0);
  });

  it('navigates around the courtroom walls via A* when she walks inside', () => {
    const env = overworld();
    const c = createCompanionState('overworld', -20, 8);
    c.mode = 'follow';
    let last: PlayerSnapshot | null = null;
    for (const p of walk(env.world, { x: -22, z: 8 }, [[-27, 7], [-36, 7], [-38, 4]])) {
      updateCompanion(c, p, env, 1 / 60);
      last = { ...p };
    }
    expect(Math.hypot(c.x - last!.x, c.z - last!.z)).toBeLessThan(3);
    expect(c.recoveries).toBe(0);
  });

  it('recovers gracefully when she is suddenly far away (e.g. fast travel)', () => {
    const env = overworld();
    const c = createCompanionState('overworld', 0, 15);
    c.mode = 'follow';
    const p: PlayerSnapshot = { area: 'overworld', x: 34, z: -18, yaw: Math.PI, moving: false, speed: 0 };
    updateCompanion(c, p, env, 1 / 60);
    expect(c.recoveries).toBe(1);
    expect(Math.hypot(c.x - p.x, c.z - p.z)).toBeLessThan(4);
    expect(env.world.isBlocked(c.x, c.z, COMPANION_RADIUS - 0.05)).toBe(false);
  });

  it('comes through a door after her and walks up instead of teleporting beside her', () => {
    const env = overworld();
    const c = createCompanionState('overworld', 0, 0);
    c.mode = 'follow';
    arriveThroughDoor(c, 'overworld', -0.9, -26.6, 0, 0.5);
    const p: PlayerSnapshot = { area: 'overworld', x: 0, z: -22, yaw: 0, moving: false, speed: 0 };
    updateCompanion(c, p, env, 0.25);
    expect(c.visible).toBe(false);
    for (let i = 0; i < 60 * 4; i++) updateCompanion(c, p, env, 1 / 60);
    expect(c.visible).toBe(true);
    expect(Math.hypot(c.x - p.x, c.z - p.z)).toBeLessThan(2.6);
  });

  it('scripted goto reaches a target and holds there', () => {
    const env = overworld();
    const c = createCompanionState('overworld', -20, 34);
    c.mode = 'follow';
    commandGoto(c, { x: LANDMARKS.stormCompanionSpot.x, z: LANDMARKS.stormCompanionSpot.z, yaw: 0 });
    const p: PlayerSnapshot = { area: 'overworld', x: -18, z: 34, yaw: 0, moving: false, speed: 0 };
    let arrived = false;
    for (let i = 0; i < 60 * 20 && !arrived; i++) {
      updateCompanion(c, p, env, 1 / 60);
      if (c.arrivedFlag) arrived = true;
    }
    expect(arrived).toBe(true);
    expect(c.mode).toBe('hold');
    expect(Math.hypot(c.x - LANDMARKS.stormCompanionSpot.x, c.z - LANDMARKS.stormCompanionSpot.z)).toBeLessThan(0.6);
  });
});
