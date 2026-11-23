/**
 * WORLD LAYOUT — the single source of truth for the kingdom's geometry.
 *
 * Rendering (3D and the 2D fallback), collision, the companion's navigation
 * grid, the world map, and the automated tests all read from this module, so
 * the world you see is exactly the world you collide with.
 *
 * Coordinates are metres on the XZ plane. North is -Z. Yaw PI faces north.
 */
import { mulberry32, range } from '../../utils/rng';
import { distToPolyline } from '../../utils/math';
import type {
  AreaBounds,
  AreaId,
  BoxShape,
  CircleShape,
  Collider,
  DoorLink,
  GateId,
  InteractableSpot,
  PathDef,
  Seat,
  SpawnPoint,
  TreeInstance,
  Zone,
} from './worldTypes';

const N = Math.PI; // facing north
const S = 0; // facing south

export const box = (minX: number, minZ: number, maxX: number, maxZ: number, gate?: GateId, tag?: string): Collider => ({
  kind: 'box',
  minX,
  minZ,
  maxX,
  maxZ,
  gate,
  tag,
});
export const circle = (x: number, z: number, r: number, tag?: string): Collider => ({ kind: 'circle', x, z, r, tag });

// ============================================================================
// AREA BOUNDS
// ============================================================================
export const AREA_BOUNDS: Record<AreaId, AreaBounds> = {
  overworld: { minX: -62, minZ: -56, maxX: 62, maxZ: 84 },
  castle: { minX: -21, minZ: -9, maxX: 23, maxZ: 9 },
};

// ============================================================================
// KEY LANDMARKS (shared by renderers)
// ============================================================================
export const LANDMARKS = {
  spawn: { area: 'overworld', x: 0, z: 17, yaw: N } as SpawnPoint,
  crownPedestal: { x: 0, z: 6 },
  bouquetDisplay: { x: 8, z: 4 },
  companionDebut: { x: -7, z: 1 },
  castleGate: { x: 0, z: -8 },
  castleDoor: { x: 0, z: -28 },
  castleFountain: { x: 0, z: -18 },
  gardenFountain: { x: 36, z: 6 },
  gardenArch: { x: 26, z: 10 },
  gardenBench: { x: 42, z: 14.6 },
  gardenShed: { x: 49, z: -4 },
  mirrorCenter: { x: 34, z: -26 },
  libraryCenter: { x: -34, z: -27 },
  courtroomCenter: { x: -37, z: 6 },
  childrenCenter: { x: 33, z: 36 },
  stormCenter: { x: -31, z: 36 },
  stormCompanionSpot: { x: -43, z: 32.5 },
  stormBigTree: { x: -45.5, z: 31 },
  hillCenter: { x: 0, z: 70 },
  hillTop: { x: 0, z: 67.5 },
  river: { minZ: 50, maxZ: 57 },
  bridge: { minX: -2.8, maxX: 2.8 },
  fireworksOrigin: { x: 0, z: 34 },
} as const;

// ============================================================================
// TERRAIN
// ============================================================================
const HILL_RADIUS = 17;
const HILL_HEIGHT = 5.5;

/** Ground height at a point. Only Fireworks Hill rises above zero. */
export function heightAt(area: AreaId, x: number, z: number): number {
  if (area !== 'overworld') return 0;
  const dx = x - LANDMARKS.hillCenter.x;
  const dz = z - LANDMARKS.hillCenter.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d >= HILL_RADIUS) return 0;
  return HILL_HEIGHT * (0.5 + 0.5 * Math.cos((Math.PI * d) / HILL_RADIUS));
}

// ============================================================================
// PATHS (visual ribbons; trees avoid them)
// ============================================================================
function ring(cx: number, cz: number, r: number, segments = 14): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return pts;
}

const BASE_PATHS: PathDef[] = [
  { points: [[0, 22], [0, -8], [0, -14]], width: 4.2 },
  { points: ring(0, -18, 4.6), width: 2.4 },
  { points: [[0, -22.6], [0, -27]], width: 3.6 },
  { points: [[14, 10], [26, 10], [31.5, 7.6]], width: 3.2 },
  { points: ring(36, 6, 5.2), width: 2.2 },
  { points: [[36, 0.8], [36, -8], [34, -19.5]], width: 2.8 },
  { points: [[40.5, 8.6], [46, 12], [50, 15]], width: 2 },
  { points: [[-14, 10], [-28, 8]], width: 3.2 },
  { points: [[-26, 4], [-23, -6], [-30, -16], [-34, -19.5]], width: 2.8 },
  { points: [[0, 22], [0, 32], [0, 49.2]], width: 3.6 },
  { points: [[0, 57], [0, 64]], width: 3.2 },
  { points: [[0, 32], [12, 33], [20, 34]], width: 3 },
  { points: [[0, 32], [-12, 33], [-18, 34], [-25, 35.5], [-31, 35]], width: 2.8 },
  { points: [[-31, 35], [-37, 34], [-42, 33]], width: 2.2 },
  { points: [[-31, 35], [-35, 39.4]], width: 2 },
  { points: [[-31, 35], [-27.5, 41.5]], width: 1.8 },
];

// ============================================================================
// STATIC COLLIDERS — OVERWORLD
// ============================================================================
const H = 0.6; // half thickness of hedges / walls

const courtyardHedges: Collider[] = [
  // north (gap x[-3.2,3.2] leads to castle gate corridor)
  box(-14.6, -2 - H, -3.2, -2 + H, undefined, 'hedge'),
  box(3.2, -2 - H, 14.6, -2 + H, undefined, 'hedge'),
  // south (gap -> southern lands)
  box(-14.6, 22 - H, -3.2, 22 + H, undefined, 'hedge'),
  box(3.2, 22 - H, 14.6, 22 + H, undefined, 'hedge'),
  // west (gap z[7,13] -> courtroom)
  box(-14 - H, -2.6, -14 + H, 7, undefined, 'hedge'),
  box(-14 - H, 13, -14 + H, 22.6, undefined, 'hedge'),
  // east (gap z[7,13] -> garden)
  box(14 - H, -2.6, 14 + H, 7, undefined, 'hedge'),
  box(14 - H, 13, 14 + H, 22.6, undefined, 'hedge'),
  // corridor walls between courtyard and castle gate
  box(-3.2 - H, -8, -3.2 + H, -2, undefined, 'hedge'),
  box(3.2 - H, -8, 3.2 + H, -2, undefined, 'hedge'),
];

const courtyardProps: Collider[] = [
  circle(LANDMARKS.crownPedestal.x, LANDMARKS.crownPedestal.z, 0.95, 'pedestal'),
  circle(LANDMARKS.bouquetDisplay.x, LANDMARKS.bouquetDisplay.z, 1.15, 'bouquetDisplay'),
  // corner rose planters
  circle(-11.5, 0.5, 1.2, 'planter'),
  circle(11.5, 0.5, 1.2, 'planter'),
  circle(-11.5, 19.5, 1.2, 'planter'),
  circle(11.5, 19.5, 1.2, 'planter'),
];

const castleWalls: Collider[] = [
  box(-16.6, -46.6, 16.6, -45.4, undefined, 'castleWall'), // north
  box(-16.6, -46.6, -15.4, -7.4, undefined, 'castleWall'), // west
  box(15.4, -46.6, 16.6, -7.4, undefined, 'castleWall'), // east
  box(-16.6, -8.6, -3, -7.4, undefined, 'castleWall'), // south-left
  box(3, -8.6, 16.6, -7.4, undefined, 'castleWall'), // south-right
  // keep + towers
  box(-9, -40, 9, -28, undefined, 'keep'),
  circle(-10, -28.4, 2.4, 'tower'),
  circle(10, -28.4, 2.4, 'tower'),
  circle(-10, -40, 2.6, 'tower'),
  circle(10, -40, 2.6, 'tower'),
  circle(LANDMARKS.castleFountain.x, LANDMARKS.castleFountain.z, 2.7, 'fountain'),
  box(-12.5, -22, -8, -14, undefined, 'flowerbed'),
  box(8, -22, 12.5, -14, undefined, 'flowerbed'),
];

const gardenProps: Collider[] = [
  circle(LANDMARKS.gardenFountain.x, LANDMARKS.gardenFountain.z, 2.5, 'fountain'),
  circle(26, 8.5, 0.35, 'archPost'),
  circle(26, 11.5, 0.35, 'archPost'),
  box(40.8, 14.2, 43.2, 15.1, undefined, 'bench'),
  box(47, -6, 51, -2, undefined, 'shed'),
  circle(30, -3, 0.6, 'blossomTrunk'),
  circle(45, -2, 0.6, 'blossomTrunk'),
  circle(49.5, 9, 0.6, 'blossomTrunk'),
  circle(29.5, 17.5, 0.6, 'blossomTrunk'),
  circle(51, 18, 0.6, 'blossomTrunk'),
];

const mirrorWalls: Collider[] = [
  box(27.5, -32.5, 40.5, -32, undefined, 'wall'),
  box(27.5, -32.5, 28, -19.5, undefined, 'wall'),
  box(40, -32.5, 40.5, -19.5, undefined, 'wall'),
  box(27.5, -20, 31, -19.5, undefined, 'wall'),
  box(37, -20, 40.5, -19.5, undefined, 'wall'),
  box(36.6, -31.9, 39.4, -30.6, undefined, 'vanity'),
  box(28.2, -28.2, 30, -26.4, undefined, 'sideTable'),
];

const libraryWalls: Collider[] = [
  box(-42.5, -34.5, -25.5, -34, undefined, 'wall'),
  box(-42.5, -34.5, -42, -19.5, undefined, 'wall'),
  box(-26, -34.5, -25.5, -19.5, undefined, 'wall'),
  box(-42.5, -20, -37, -19.5, undefined, 'wall'),
  box(-31, -20, -25.5, -19.5, undefined, 'wall'),
  box(-41.5, -33.9, -26.5, -33, undefined, 'shelf'),
  box(-41.9, -32, -41, -22, undefined, 'shelf'),
  box(-27, -32, -26.1, -22, undefined, 'shelf'),
  box(-35.6, -26.9, -32.4, -25.1, undefined, 'table'),
  circle(-38.5, -30, 0.45, 'pedestal'),
  circle(-34, -31.6, 0.45, 'pedestal'),
  circle(-29.5, -30, 0.45, 'pedestal'),
  circle(-39.2, -23.4, 0.45, 'pedestal'),
];

const courtroomWalls: Collider[] = [
  box(-46.5, -2.5, -28, -2, undefined, 'wall'),
  box(-46.5, 14, -28, 14.5, undefined, 'wall'),
  box(-46.5, -2.5, -46, 14.5, undefined, 'wall'),
  box(-28.5, -2.5, -28, 3, undefined, 'wall'),
  box(-28.5, 11, -28, 14.5, undefined, 'wall'),
  box(-45.6, 2, -42.6, 10, undefined, 'judgeBench'),
  box(-37, 2.2, -35, 3.4, undefined, 'evidenceTable'),
  box(-41, 11.6, -39, 13, undefined, 'witnessStand'),
  box(-34, 11.6, -32, 13, undefined, 'documentDesk'),
  box(-34, -1.2, -30.5, -0.2, undefined, 'bench'),
];

const childrenProps: Collider[] = [
  box(37, 28, 39.5, 32, undefined, 'slide'),
  circle(25.5, 29.5, 0.3, 'swingPost'),
  circle(30.5, 29.5, 0.3, 'swingPost'),
  circle(36, 41, 2.3, 'carousel'),
  box(24, 39.6, 28, 40.4, undefined, 'seesaw'),
  circle(23, 44, 1.3, 'bigTree'),
  circle(45.2, 28.4, 0.5, 'storyteller'),
  circle(31, 35, 0.55, 'momo'),
  box(43, 31, 46.5, 32, undefined, 'storyShelf'),
];

const stormProps: Collider[] = [
  box(-38.6, 41.4, -35.4, 44.2, undefined, 'shelterHut'),
  circle(LANDMARKS.stormBigTree.x, LANDMARKS.stormBigTree.z, 1.5, 'oldTree'),
  circle(-27, 43.8, 0.6, 'crystal'),
];

const riverAndBridge: Collider[] = [
  box(-62, LANDMARKS.river.minZ, LANDMARKS.bridge.minX, LANDMARKS.river.maxZ, undefined, 'river'),
  box(LANDMARKS.bridge.maxX, LANDMARKS.river.minZ, 62, LANDMARKS.river.maxZ, undefined, 'river'),
];

const hillProps: Collider[] = [box(-1.6, 72.2, 1.6, 73, undefined, 'hillBench')];

function strawberryColliders(): Collider[] {
  const out: Collider[] = STRAWBERRY_GARDEN.beds.map((b) => box(b.minX, b.minZ, b.maxX, b.maxZ, undefined, 'strawberryBed'));
  for (const p of GAZEBO_POSTS) out.push(circle(p.x, p.z, 0.2, 'gazeboPost'));
  // Low railings between neighbouring posts (not across the west entrance).
  for (let i = 0; i < GAZEBO_POSTS.length - 1; i++) {
    if (i === 3) continue; // 135° → 225° spans the entrance
    const a = GAZEBO_POSTS[i];
    const b = GAZEBO_POSTS[i + 1];
    for (const t of [0.25, 0.5, 0.75]) out.push(circle(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.14, 'gazeboRail'));
  }
  // Close the ring between the last post (315°) and the first (0°).
  const l = GAZEBO_POSTS[GAZEBO_POSTS.length - 1];
  const f = GAZEBO_POSTS[0];
  for (const t of [0.25, 0.5, 0.75]) out.push(circle(l.x + (f.x - l.x) * t, l.z + (f.z - l.z) * t, 0.14, 'gazeboRail'));
  return out;
}

/** Gates: magical barriers that open as the story progresses. */
export const GATE_COLLIDERS: Collider[] = [
  box(-3, -8.6, 3, -7.4, 'castleGate', 'gate'),
  box(14 - H, 7, 14 + H, 13, 'worldEast', 'gate'),
  box(-14 - H, 7, -14 + H, 13, 'worldWest', 'gate'),
  box(-3.2, 22 - H, 3.2, 22 + H, 'worldSouth', 'gate'),
  box(-2.8, 48.6, 2.8, 49.6, 'hillBridge', 'gate'),
  box(-10.5, -1.6, -10, 1.6, 'secretDoor', 'gate'),
];

export const GATE_INFO: Record<GateId, { area: AreaId; x: number; z: number; width: number; rotY: number }> = {
  castleGate: { area: 'overworld', x: 0, z: -8, width: 6, rotY: 0 },
  worldEast: { area: 'overworld', x: 14, z: 10, width: 6, rotY: Math.PI / 2 },
  worldWest: { area: 'overworld', x: -14, z: 10, width: 6, rotY: Math.PI / 2 },
  worldSouth: { area: 'overworld', x: 0, z: 22, width: 6.4, rotY: 0 },
  hillBridge: { area: 'overworld', x: 0, z: 49.1, width: 5.6, rotY: 0 },
  secretDoor: { area: 'castle', x: -10.25, z: 0, width: 3.2, rotY: Math.PI / 2 },
};

// ============================================================================
// TREES (deterministic procedural placement)
// ============================================================================
interface Exclusion {
  test: (x: number, z: number) => boolean;
}

const rect = (minX: number, minZ: number, maxX: number, maxZ: number): Exclusion => ({
  test: (x, z) => x > minX && x < maxX && z > minZ && z < maxZ,
});
const disc = (cx: number, cz: number, r: number): Exclusion => ({
  test: (x, z) => (x - cx) ** 2 + (z - cz) ** 2 < r * r,
});

const TREE_EXCLUSIONS: Exclusion[] = [
  rect(-17.5, -48, 17.5, 24.5), // courtyard + castle grounds
  rect(19, -10, 54, 22), // garden
  rect(25.5, -34, 42.5, -17), // mirror pavilion
  rect(-44.5, -36, -23.5, -17), // library
  rect(-48.5, -5, -25.5, 16.5), // courtroom
  rect(18, 24, 49, 48), // children's wonderland
  rect(-64, 47, 64, 60), // river band
  disc(0, 70, 13), // hill top
  disc(LANDMARKS.stormCompanionSpot.x, LANDMARKS.stormCompanionSpot.z, 4.5),
  disc(-37, 41.5, 4), // shelter
  disc(-27, 43.8, 3), // crystal
  disc(-22, 34.5, 2.6), // umbrella
  disc(-29, 30, 2.6), // lantern
  disc(-40, 44, 2.4), // memory star
];

function nearPath(x: number, z: number, margin: number) {
  for (const p of BASE_PATHS) {
    if (distToPolyline(x, z, p.points) < p.width / 2 + margin) return true;
  }
  return false;
}

function generateTrees(): TreeInstance[] {
  const rng = mulberry32(20261201);
  const trees: TreeInstance[] = [];
  const minSpacing = 2.6;
  const tooClose = (x: number, z: number, s: number) => trees.some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < s * s);
  const b = AREA_BOUNDS.overworld;

  const tryPlace = (x: number, z: number, kind: TreeInstance['kind'], spacing = minSpacing) => {
    if (x < b.minX + 1 || x > b.maxX - 1 || z < b.minZ + 1 || z > b.maxZ - 1) return false;
    if (TREE_EXCLUSIONS.some((e) => e.test(x, z))) return false;
    if (nearPath(x, z, 1.6)) return false;
    if (tooClose(x, z, spacing)) return false;
    trees.push({ x, z, kind, scale: range(rng, 0.85, 1.35), rot: range(rng, 0, Math.PI * 2) });
    return true;
  };

  // Boundary tree line (forms the soft edge of the world).
  for (let i = 0; i < 420; i++) {
    const side = Math.floor(rng() * 4);
    const t = rng();
    const inset = range(rng, 1.5, 6);
    let x = 0;
    let z = 0;
    if (side === 0) { x = b.minX + inset; z = b.minZ + t * (b.maxZ - b.minZ); }
    if (side === 1) { x = b.maxX - inset; z = b.minZ + t * (b.maxZ - b.minZ); }
    if (side === 2) { z = b.minZ + inset; x = b.minX + t * (b.maxX - b.minX); }
    if (side === 3) { z = b.maxZ - inset; x = b.minX + t * (b.maxX - b.minX); }
    tryPlace(x, z, rng() < 0.4 ? 'pine' : 'round', 3.2);
  }

  // Stormy forest — dense and dark.
  const sc = LANDMARKS.stormCenter;
  for (let i = 0; i < 600; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 17;
    tryPlace(sc.x + Math.cos(a) * r, sc.z + Math.sin(a) * r, rng() < 0.65 ? 'dark' : 'pine', 2.5);
  }

  // Scattered meadow trees.
  for (let i = 0; i < 700; i++) {
    const x = range(rng, b.minX, b.maxX);
    const z = range(rng, b.minZ, b.maxZ);
    const kind: TreeInstance['kind'] = rng() < 0.25 ? 'blossom' : rng() < 0.3 ? 'pine' : 'round';
    tryPlace(x, z, kind, 5.5);
  }
  return trees;
}

// ============================================================================
// SARAH'S STRAWBERRY GARDEN (north-east of the Garden of Her Dreams)
// ============================================================================
export const STRAWBERRY_GARDEN = {
  /** Footprint (trees are cleared from it). */
  area: { minX: 40, minZ: -21.6, maxX: 57.5, maxZ: -7.5 },
  gazebo: { x: 51, z: -14.5, r: 2.8 },
  /** Raised strawberry beds (solid). */
  beds: [
    { minX: 41.5, minZ: -19.6, maxX: 46.2, maxZ: -18.6 },
    { minX: 41.5, minZ: -16.6, maxX: 46.2, maxZ: -15.6 },
    { minX: 41.5, minZ: -13.6, maxX: 46.2, maxZ: -12.6 },
    { minX: 48.5, minZ: -20.6, maxX: 54, maxZ: -19.6 },
  ],
  /** Picnic blanket centre (inside the gazebo, walkable). */
  blanket: { x: 51.4, z: -14.5 },
  /** Where the Princess sits on the blanket during the picnic. */
  princessSeat: { x: 50.65, z: -14.95 },
} as const;

/** The five ripe strawberries: `x/z` is where she stands, `berry` is the fruit on the bed edge. */
export const STRAWBERRY_SPOTS = [
  { id: 'straw_1', x: 42.6, z: -17.6, berry: { x: 42.6, z: -18.78 } },
  { id: 'straw_2', x: 45.4, z: -14.6, berry: { x: 45.4, z: -15.78 } },
  { id: 'straw_3', x: 43.4, z: -11.7, berry: { x: 43.4, z: -12.78 } },
  { id: 'straw_4', x: 50.2, z: -18.4, berry: { x: 50.2, z: -19.78 } },
  { id: 'straw_5', x: 53.0, z: -18.4, berry: { x: 53.0, z: -19.78 } },
] as const;

/** Gazebo posts (octagon with the west side open as the entrance). */
export const GAZEBO_POSTS: Array<{ x: number; z: number }> = Array.from({ length: 8 }, (_, k) => k)
  .filter((k) => k !== 4)
  .map((k) => ({
    x: STRAWBERRY_GARDEN.gazebo.x + Math.cos((k * Math.PI) / 4) * STRAWBERRY_GARDEN.gazebo.r,
    z: STRAWBERRY_GARDEN.gazebo.z + Math.sin((k * Math.PI) / 4) * STRAWBERRY_GARDEN.gazebo.r,
  }));

const STRAWBERRY_PATHS: PathDef[] = [{ points: [[36.5, -7.2], [42, -8.9], [47.2, -10.9], [48.4, -14.5]], width: 2.2 }];

/** All paths (base world + Strawberry Garden). */
export const PATHS: PathDef[] = [...BASE_PATHS, ...STRAWBERRY_PATHS];

const inStrawberryClearing = (x: number, z: number) => {
  const a = STRAWBERRY_GARDEN.area;
  if (x > a.minX - 0.5 && x < a.maxX && z > a.minZ && z < a.maxZ) return true;
  return STRAWBERRY_PATHS.some((p) => distToPolyline(x, z, p.points) < p.width / 2 + 1.8);
};

/** Trees: identical to the original generation, minus the Strawberry Garden clearing. */
export const TREES: TreeInstance[] = generateTrees().filter((t) => !inStrawberryClearing(t.x, t.z));

const treeColliders: Collider[] = TREES.map((t) => circle(t.x, t.z, 0.45 * t.scale + 0.1, 'tree'));

// ============================================================================
// STATIC COLLIDERS — CASTLE INTERIOR
// ============================================================================
const T = 0.5; // wall thickness
const castleInterior: Collider[] = [
  // Grand hall
  box(-10.5, -8 - T, 10.5, -8, undefined, 'wall'),
  box(-10.5, 8, 10.5, 8 + T, undefined, 'wall'),
  box(10, -8.5, 10 + T, -1.6, undefined, 'wall'),
  box(10, 1.6, 10 + T, 8.5, undefined, 'wall'),
  box(-10 - T, -8.5, -10, -1.6, undefined, 'wall'),
  box(-10 - T, 1.6, -10, 8.5, undefined, 'wall'),
  circle(-6, -4, 0.6, 'pillar'),
  circle(6, -4, 0.6, 'pillar'),
  circle(-6, 4, 0.6, 'pillar'),
  circle(6, 4, 0.6, 'pillar'),
  box(-1.4, -7.9, 1.4, -6.2, undefined, 'throne'),
  box(-8.6, 5.4, -5.4, 6.6, undefined, 'sofa'),
  box(5.4, 5.4, 8.6, 6.6, undefined, 'sofa'),
  circle(6.5, -6.6, 0.7, 'vaseTable'),
  circle(-6.5, -6.6, 0.6, 'musicBoxTable'),
  // Bedroom
  box(10.5, -6 - T, 22.5, -6, undefined, 'wall'),
  box(10.5, 6, 22.5, 6 + T, undefined, 'wall'),
  box(22, -6.5, 22 + T, 6.5, undefined, 'wall'),
  box(17, -5.8, 21.9, -1.6, undefined, 'bed'),
  box(15.6, -5.8, 16.6, -4.6, undefined, 'bedsideTable'),
  box(20.6, 2.2, 21.9, 5.8, undefined, 'wardrobe'),
  circle(13, -4.6, 0.5, 'chair'),
  // Secret room
  box(-20.5, -5 - T, -10.5, -5, undefined, 'wall'),
  box(-20.5, 5, -10.5, 5 + T, undefined, 'wall'),
  box(-20 - T, -5.5, -20, 5.5, undefined, 'wall'),
  circle(-15, 0, 0.8, 'secretTable'),
  circle(-15, -1.6, 0.4, 'chair'),
  circle(-15, 1.6, 0.4, 'chair'),
  box(-19.6, -4.6, -17.6, -3, undefined, 'giftDisplay'),
  circle(-12, -4.2, 0.45, 'flowerVase'),
  circle(-18.3, 3.3, 0.95, 'cakeTable'),
];

export const STATIC_COLLIDERS: Record<AreaId, Collider[]> = {
  overworld: [
    ...courtyardHedges,
    ...courtyardProps,
    ...castleWalls,
    ...gardenProps,
    ...mirrorWalls,
    ...libraryWalls,
    ...courtroomWalls,
    ...childrenProps,
    ...stormProps,
    ...riverAndBridge,
    ...hillProps,
    ...strawberryColliders(),
    ...treeColliders,
  ],
  castle: castleInterior,
};

export function collidersFor(area: AreaId): Collider[] {
  return [...STATIC_COLLIDERS[area], ...GATE_COLLIDERS.filter((g) => GATE_INFO[g.gate!].area === area)];
}

// ============================================================================
// ZONES (location detection)
// ============================================================================
const zb = (minX: number, minZ: number, maxX: number, maxZ: number): BoxShape => ({ kind: 'box', minX, minZ, maxX, maxZ });
const zc = (x: number, z: number, r: number): CircleShape => ({ kind: 'circle', x, z, r });

export const ZONES: Zone[] = [
  { id: 'mirror', area: 'overworld', shape: zb(27, -33, 41, -19), priority: 10 },
  { id: 'library', area: 'overworld', shape: zb(-43, -35, -25, -19), priority: 10 },
  { id: 'courtroom', area: 'overworld', shape: zb(-47, -3, -27, 15), priority: 10 },
  { id: 'courtyard', area: 'overworld', shape: zb(-15, -3, 15, 23), priority: 9 },
  { id: 'castleGrounds', area: 'overworld', shape: zb(-17, -47, 17, -7.4), priority: 9 },
  { id: 'garden', area: 'overworld', shape: zb(20, -10, 54, 22), priority: 8 },
  { id: 'children', area: 'overworld', shape: zb(18, 24, 49, 48), priority: 8 },
  { id: 'storm', area: 'overworld', shape: zc(-31, 36, 17), priority: 8 },
  { id: 'fireworks', area: 'overworld', shape: zc(0, 70, 15), priority: 8 },
  { id: 'strawberryGarden', area: 'overworld', shape: zb(40, -21.6, 57.5, -8), priority: 9 },
  { id: 'secretRoom', area: 'castle', shape: zb(-20.5, -5, -10.2, 5), priority: 10 },
  { id: 'bedroom', area: 'castle', shape: zb(10.2, -6, 22.5, 6), priority: 10 },
  { id: 'castleHall', area: 'castle', shape: zb(-10.2, -8.5, 10.2, 8.5), priority: 5 },
];

/** Region used to trigger the storm (slightly inside the forest edge). */
export const STORM_TRIGGER = zc(-31, 36, 13.5);
export const HILLTOP_TRIGGER = zc(LANDMARKS.hillTop.x, LANDMARKS.hillTop.z, 4);

/** Building interiors whose roofs fade out while the player is inside. */
export const ROOF_REGIONS = {
  mirror: zb(27.5, -32.5, 40.5, -19.5),
  library: zb(-42.5, -34.5, -25.5, -19.5),
  courtroom: zb(-46.5, -2.5, -28, 14.5),
};

// ============================================================================
// INTERACTABLE SPOTS
// ============================================================================
const spot = (id: string, area: AreaId, x: number, z: number, radius = 2, markerHeight = 2.2): InteractableSpot => ({
  id,
  area,
  x,
  z,
  radius,
  markerHeight,
});

export const FLOWER_SPOTS = [
  { id: 'flower_01', x: 28.5, z: 4, type: 'pinkRose' },
  { id: 'flower_02', x: 30.5, z: 12.5, type: 'whiteRose' },
  { id: 'flower_03', x: 33, z: -3.5, type: 'tulip' },
  { id: 'flower_04', x: 40.5, z: -3.5, type: 'tulip' },
  { id: 'flower_05', x: 45, z: 7.5, type: 'sunflower' },
  { id: 'flower_06', x: 47, z: 13.5, type: 'sunflower' },
  { id: 'flower_07', x: 38.5, z: 16.5, type: 'hydrangea' },
  { id: 'flower_08', x: 33.5, z: 18.5, type: 'hydrangea' },
  { id: 'flower_09', x: 51, z: 5, type: 'cherryBlossom' },
  { id: 'flower_10', x: 41.5, z: 11.5, type: 'pinkRose' },
  { id: 'flower_11', x: 34.5, z: 13.2, type: 'whiteRose' },
  { id: 'flower_12', x: 25.5, z: -4.5, type: 'cherryBlossom' },
] as const;

export type FlowerType = (typeof FLOWER_SPOTS)[number]['type'];

export const PLANT_PLOTS = [
  { id: 'plot_1', x: 40, z: 0.6 },
  { id: 'plot_2', x: 42.6, z: 0.6 },
  { id: 'plot_3', x: 45.2, z: 0.6 },
] as const;

export const MEMORY_STARS = [
  { id: 'star_m1', memory: 'm1', area: 'overworld', x: -9, z: 19.8 },
  { id: 'star_m2', memory: 'm2', area: 'overworld', x: 13.6, z: -36 },
  { id: 'star_m3', memory: 'm3', area: 'overworld', x: 50.5, z: 16.5 },
  { id: 'star_m4', memory: 'm4', area: 'overworld', x: 39, z: -22.4 },
  { id: 'star_m5', memory: 'm5', area: 'overworld', x: -40.6, z: -21.4 },
  { id: 'star_m6', memory: 'm6', area: 'overworld', x: 46, z: 45.5 },
  { id: 'star_m7', memory: 'm7', area: 'overworld', x: -40, z: 44 },
  { id: 'star_m8', memory: 'm8', area: 'overworld', x: 7, z: 74 },
] as const;

export const INTERACTABLE_SPOTS: InteractableSpot[] = [
  // Prologue
  spot('crown', 'overworld', LANDMARKS.crownPedestal.x, LANDMARKS.crownPedestal.z, 2.7, 2.4),
  spot('bouquet', 'overworld', LANDMARKS.bouquetDisplay.x, LANDMARKS.bouquetDisplay.z, 2.8, 2.4),
  spot('castleDoor', 'overworld', 0, -26.4, 2.4, 3.4),
  // Garden
  ...FLOWER_SPOTS.map((f) => spot(f.id, 'overworld', f.x, f.z, 1.5, 1.4)),
  ...PLANT_PLOTS.map((p) => spot(p.id, 'overworld', p.x, p.z, 1.25, 1.2)),
  spot('seedBasket', 'overworld', 48.8, -0.9, 1.6, 1.6),
  spot('wateringCan', 'overworld', 39.6, 8.8, 1.5, 1.4),
  spot('wishFountain', 'overworld', 36, 9.1, 1.4, 2.2),
  spot('note_bench', 'overworld', 42, 13.4, 1.5, 1.3),
  spot('note_arch', 'overworld', 26.9, 12.3, 1.4, 2.6),
  spot('note_tree', 'overworld', 44.8, -0.8, 1.4, 1.8),
  // Mirror room
  spot('mirror', 'overworld', 34, -29.8, 2.1, 3.2),
  spot('vanity', 'overworld', 38, -29.4, 1.6, 2),
  spot('lipstick', 'overworld', 30.8, -27.9, 1.2, 1.5),
  spot('perfume', 'overworld', 30.8, -26.5, 1.2, 1.5),
  // Library
  spot('book1', 'overworld', -38.5, -29, 1.6, 1.9),
  spot('book2', 'overworld', -34, -30.6, 1.6, 1.9),
  spot('book3', 'overworld', -29.5, -29, 1.6, 1.9),
  spot('book4', 'overworld', -38.4, -22.6, 1.6, 1.9),
  // Courtroom
  spot('clue_footprints', 'overworld', -36, 4.2, 1.6, 1.8),
  spot('clue_witness', 'overworld', -40, 10.6, 1.6, 2.2),
  spot('clue_log', 'overworld', -33, 10.6, 1.6, 1.8),
  spot('verdict', 'overworld', -41.6, 6, 2, 2.8),
  // Children's wonderland
  spot('momo', 'overworld', 31, 35, 2.2, 1.6),
  spot('clue_sandbox', 'overworld', 42, 37.4, 1.9, 1.2),
  spot('clue_swing', 'overworld', 28, 31, 1.8, 2.4),
  spot('clue_story', 'overworld', 44.4, 29.6, 1.7, 1.8),
  spot('toyTree', 'overworld', 24.4, 42.6, 1.7, 1.8),
  spot('ball', 'overworld', 33.6, 37.8, 1.4, 1),
  spot('xylophone', 'overworld', 35.4, 33.4, 1.4, 1.2),
  // Storm
  spot('storm_umbrella', 'overworld', -22, 34.5, 1.6, 1.8),
  spot('storm_lantern', 'overworld', -29, 30, 1.6, 2.4),
  spot('storm_shelter', 'overworld', -37, 40.4, 1.8, 2.8),
  spot('storm_crystal', 'overworld', -27, 42.6, 1.7, 1.8),
  // Hill
  spot('lookout', 'overworld', LANDMARKS.hillTop.x, LANDMARKS.hillTop.z, 2.6, 2.4),
  // Memory stars
  ...MEMORY_STARS.map((s) => spot(s.id, s.area as AreaId, s.x, s.z, 1.4, 1.4)),
  // Castle interior
  spot('castleExit', 'castle', 0, 7, 1.8, 2.6),
  spot('envelope', 'castle', 16.1, -4, 1.7, 1.6),
  spot('throne', 'castle', 0, -5.6, 1.6, 2.4),
  spot('musicBox', 'castle', -6.5, -5.6, 1.5, 1.6),
  spot('vase', 'castle', 6.5, -5.6, 1.5, 1.8),
  spot('secretDoor', 'castle', -9.2, 0, 1.8, 2.8),
  spot('finalLetter', 'castle', -13.9, 0, 1.6, 1.6),
  spot('secretGift', 'castle', -17.2, -2.6, 1.6, 1.8),
  spot('cake', 'castle', -16.6, 2.5, 1.9, 2.1),
  // Strawberry Garden
  ...STRAWBERRY_SPOTS.map((sp) => spot(sp.id, 'overworld', sp.x, sp.z, 1.35, 1.1)),
  spot('picnic', 'overworld', 49.5, -14.5, 1.9, 1.6),
];

export const SPOT_BY_ID: Record<string, InteractableSpot> = Object.fromEntries(INTERACTABLE_SPOTS.map((s) => [s.id, s]));

// ============================================================================
// SEATS (companion can sit while she lingers in the castle)
// ============================================================================
export const SEATS: Seat[] = [
  { id: 'sofaL', area: 'castle', x: -7, z: 5.1, yaw: N, height: 0.45 },
  { id: 'sofaR', area: 'castle', x: 7, z: 5.1, yaw: N, height: 0.45 },
  { id: 'bedChair', area: 'castle', x: 13, z: -4.6, yaw: S, height: 0.45 },
  { id: 'secretChair', area: 'castle', x: -15, z: -1.6, yaw: S, height: 0.45 },
  { id: 'gardenBench', area: 'overworld', x: 42, z: 14.25, yaw: N, height: 0.45 },
  { id: 'picnicHim', area: 'overworld', x: 52.1, z: -14.05, yaw: Math.atan2(50.65 - 52.1, -14.95 + 14.05), height: 0.06 },
];

// ============================================================================
// DOORS / TRANSITIONS
// ============================================================================
export const DOORS: Record<'enterCastle' | 'exitCastle', DoorLink> = {
  enterCastle: {
    id: 'enterCastle',
    from: 'overworld',
    to: { area: 'castle', x: 0, z: 5.6, yaw: N },
    companionEntry: { x: 0.9, z: 7.4 },
  },
  exitCastle: {
    id: 'exitCastle',
    from: 'castle',
    to: { area: 'overworld', x: 0, z: -24.6, yaw: S },
    companionEntry: { x: -0.9, z: -26.6 },
  },
};

/** Fast-travel arrival points (map), all on open walkable ground. */
export const TRAVEL_POINTS: Record<string, SpawnPoint> = {
  courtyard: { area: 'overworld', x: 0, z: 15, yaw: N },
  castleGrounds: { area: 'overworld', x: 0, z: -12, yaw: N },
  castleHall: { area: 'castle', x: 0, z: 5.6, yaw: N },
  garden: { area: 'overworld', x: 23, z: 10, yaw: -Math.PI / 2 + Math.PI },
  mirror: { area: 'overworld', x: 34, z: -17.5, yaw: N },
  library: { area: 'overworld', x: -34, z: -17.5, yaw: N },
  courtroom: { area: 'overworld', x: -25, z: 8, yaw: -Math.PI / 2 },
  children: { area: 'overworld', x: 18, z: 34, yaw: Math.PI / 2 },
  storm: { area: 'overworld', x: -16, z: 34, yaw: -Math.PI / 2 },
  fireworks: { area: 'overworld', x: 0, z: 60, yaw: S },
  strawberryGarden: { area: 'overworld', x: 40.5, z: -9.4, yaw: Math.PI / 2 },
};
