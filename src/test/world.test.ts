import { describe, expect, it } from 'vitest';
import { CollisionWorld } from '../systems/PlayerController/collision';
import { NavGrid } from '../systems/CompanionNavigation/navGrid';
import {
  AREA_BOUNDS,
  collidersFor,
  DOORS,
  GATE_INFO,
  INTERACTABLE_SPOTS,
  LANDMARKS,
  SEATS,
  TRAVEL_POINTS,
} from '../systems/WorldManager/worldLayout';
import type { AreaId, GateId } from '../systems/WorldManager/worldTypes';

const PLAYER_R = 0.38;

function makeWorld(area: AreaId, open: GateId[]) {
  const w = new CollisionWorld(collidersFor(area), AREA_BOUNDS[area]);
  (Object.keys(GATE_INFO) as GateId[]).forEach((g) => w.setGateOpen(g, open.includes(g)));
  return w;
}

/** Flood-fill reachability on a fine grid for a player-sized circle. */
function reachable(world: CollisionWorld, start: { x: number; z: number }, cell = 0.5) {
  const b = world.bounds;
  const cols = Math.ceil((b.maxX - b.minX) / cell);
  const rows = Math.ceil((b.maxZ - b.minZ) / cell);
  const seen = new Uint8Array(cols * rows);
  const free = (c: number, r: number) => !world.isBlocked(b.minX + (c + 0.5) * cell, b.minZ + (r + 0.5) * cell, PLAYER_R);
  const sc = Math.floor((start.x - b.minX) / cell);
  const sr = Math.floor((start.z - b.minZ) / cell);
  const stack = [sr * cols + sc];
  seen[sr * cols + sc] = 1;
  while (stack.length) {
    const i = stack.pop()!;
    const c = i % cols;
    const r = (i - c) / cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const ni = nr * cols + nc;
      if (seen[ni] || !free(nc, nr)) continue;
      seen[ni] = 1;
      stack.push(ni);
    }
  }
  return (x: number, z: number, radius: number) => {
    // Is any reachable cell within `radius` of (x, z)?
    for (let dz = -radius; dz <= radius; dz += cell / 2) {
      for (let dx = -radius; dx <= radius; dx += cell / 2) {
        if (dx * dx + dz * dz > radius * radius) continue;
        const c = Math.floor((x + dx - b.minX) / cell);
        const r = Math.floor((z + dz - b.minZ) / cell);
        if (c >= 0 && r >= 0 && c < cols && r < rows && seen[r * cols + c]) return true;
      }
    }
    return false;
  };
}

const ALL_GATES = Object.keys(GATE_INFO) as GateId[];

describe('world layout', () => {
  it('spawn, door arrivals and travel points are on free ground', () => {
    const ow = makeWorld('overworld', ALL_GATES);
    const castle = makeWorld('castle', ALL_GATES);
    expect(ow.isBlocked(LANDMARKS.spawn.x, LANDMARKS.spawn.z, PLAYER_R)).toBe(false);
    for (const d of Object.values(DOORS)) {
      const w = d.to.area === 'castle' ? castle : ow;
      expect(w.isBlocked(d.to.x, d.to.z, PLAYER_R), `door ${d.id}`).toBe(false);
      expect(w.isBlocked(d.companionEntry.x, d.companionEntry.z, 0.42), `door entry ${d.id}`).toBe(false);
    }
    for (const [id, p] of Object.entries(TRAVEL_POINTS)) {
      const w = p.area === 'castle' ? castle : ow;
      expect(w.isBlocked(p.x, p.z, PLAYER_R), `travel ${id}`).toBe(false);
    }
  });

  it('every interactable is reachable once all gates are open (no dead ends)', () => {
    const ow = makeWorld('overworld', ALL_GATES);
    const castle = makeWorld('castle', ALL_GATES);
    const reachOw = reachable(ow, LANDMARKS.spawn);
    const reachCastle = reachable(castle, DOORS.enterCastle.to);
    const unreachable = INTERACTABLE_SPOTS.filter((s) => !(s.area === 'castle' ? reachCastle : reachOw)(s.x, s.z, s.radius - 0.1)).map((s) => s.id);
    expect(unreachable).toEqual([]);
  });

  it('companion seats are reachable', () => {
    const castle = makeWorld('castle', ALL_GATES);
    const ow = makeWorld('overworld', ALL_GATES);
    const rc = reachable(castle, DOORS.enterCastle.to);
    const ro = reachable(ow, LANDMARKS.spawn);
    for (const s of SEATS) expect((s.area === 'castle' ? rc : ro)(s.x, s.z, 1.2), s.id).toBe(true);
  });

  it('story gates actually block progress before they open', () => {
    const closed = makeWorld('overworld', []);
    const r = reachable(closed, LANDMARKS.spawn);
    // Prologue objects are reachable…
    expect(r(LANDMARKS.crownPedestal.x, LANDMARKS.crownPedestal.z, 2.5)).toBe(true);
    expect(r(LANDMARKS.bouquetDisplay.x, LANDMARKS.bouquetDisplay.z, 2.5)).toBe(true);
    // …but the castle door, garden and hill are not.
    expect(r(0, -26.4, 1)).toBe(false);
    expect(r(LANDMARKS.gardenFountain.x, LANDMARKS.gardenFountain.z + 3.2, 0.5)).toBe(false);
    expect(r(LANDMARKS.hillTop.x, LANDMARKS.hillTop.z, 1)).toBe(false);

    // After the bouquet (castle gate open) the castle door is reachable but the world isn't.
    const castleOpen = makeWorld('overworld', ['castleGate']);
    const r2 = reachable(castleOpen, LANDMARKS.spawn);
    expect(r2(0, -26.4, 1.5)).toBe(true);
    expect(r2(36, 10, 1)).toBe(false);

    // After the letter, everything but the hill is reachable.
    const worldOpen = makeWorld('overworld', ['castleGate', 'worldEast', 'worldWest', 'worldSouth']);
    const r3 = reachable(worldOpen, LANDMARKS.spawn);
    expect(r3(36, 10, 1)).toBe(true);
    expect(r3(LANDMARKS.stormCompanionSpot.x, LANDMARKS.stormCompanionSpot.z, 1)).toBe(true);
    expect(r3(LANDMARKS.hillTop.x, LANDMARKS.hillTop.z, 1)).toBe(false);
  });

  it('secret room is sealed until its door opens', () => {
    const closed = makeWorld('castle', []);
    const r = reachable(closed, DOORS.enterCastle.to);
    expect(r(16.1, -4, 1.5)).toBe(true); // bedroom letter
    expect(r(-15, 0, 1.5)).toBe(false); // secret table
  });
});

describe('collision', () => {
  const w = new CollisionWorld(
    [
      { kind: 'box', minX: -1, minZ: -5, maxX: 1, maxZ: 5 },
      { kind: 'circle', x: 10, z: 0, r: 1 },
    ],
    { minX: -20, minZ: -20, maxX: 20, maxZ: 20 },
  );

  it('pushes a circle out of a box and a circle', () => {
    const a = w.resolve(0.5, 0, 0.4);
    expect(Math.abs(a.x)).toBeGreaterThanOrEqual(1.4 - 1e-6);
    const b = w.resolve(10.5, 0, 0.4);
    expect(Math.hypot(b.x - 10, b.z)).toBeGreaterThanOrEqual(1.4 - 1e-6);
  });

  it('does not tunnel through thin walls on large moves', () => {
    const res = w.move(-3, 0, 6, 0, 0.4);
    expect(res.x).toBeLessThan(-1);
  });

  it('respects world bounds', () => {
    const res = w.move(19, 0, 5, 0, 0.4);
    expect(res.x).toBeLessThanOrEqual(19.6 + 1e-6);
  });
});

describe('nav grid', () => {
  it('finds a path around a wall and the path is walkable', () => {
    const world = new CollisionWorld([{ kind: 'box', minX: -1, minZ: -8, maxX: 1, maxZ: 8 }], { minX: -15, minZ: -15, maxX: 15, maxZ: 15 });
    const grid = new NavGrid(world, 0.5, 0.45);
    const path = grid.findPath({ x: -5, z: 0 }, { x: 5, z: 0 });
    expect(path).not.toBeNull();
    let prev = { x: -5, z: 0 };
    for (const p of path!) {
      expect(world.isBlocked(p.x, p.z, 0.4)).toBe(false);
      expect(grid.lineOfSight(prev.x, prev.z, p.x, p.z)).toBe(true);
      prev = p;
    }
    expect(Math.hypot(prev.x - 5, prev.z)).toBeLessThan(0.6);
  });

  it('returns null when the goal is enclosed', () => {
    const world = new CollisionWorld(
      [
        { kind: 'box', minX: 3, minZ: -3, maxX: 9, maxZ: -2 },
        { kind: 'box', minX: 3, minZ: 2, maxX: 9, maxZ: 3 },
        { kind: 'box', minX: 3, minZ: -3, maxX: 4, maxZ: 3 },
        { kind: 'box', minX: 8, minZ: -3, maxX: 9, maxZ: 3 },
      ],
      { minX: -15, minZ: -15, maxX: 15, maxZ: 15 },
    );
    const grid = new NavGrid(world, 0.5, 0.45);
    expect(grid.findPath({ x: -5, z: 0 }, { x: 6, z: 0 })).toBeNull();
  });

  it('builds the full overworld grid and paths from the courtyard to the storm clearing', () => {
    const world = makeWorld('overworld', ALL_GATES);
    const grid = new NavGrid(world, 0.8, 0.46);
    const path = grid.findPath(LANDMARKS.spawn, LANDMARKS.stormCompanionSpot);
    expect(path).not.toBeNull();
  });
});
