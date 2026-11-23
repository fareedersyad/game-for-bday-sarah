import { damp, dirToYaw, lerpAngle } from '../../utils/math';
import type { CollisionWorld } from '../PlayerController/collision';
import type { NavGrid, Point } from '../CompanionNavigation/navGrid';
import type { AreaId } from '../WorldManager/worldTypes';

export const COMPANION_RADIUS = 0.42;

export type CompanionMode =
  /** Not yet introduced (before the coronation). */
  | 'absent'
  /** Default: follows the Princess in formation. */
  | 'follow'
  /** Scripted: walk to a target, then hold there. */
  | 'goto'
  /** Scripted: stand still (optionally facing a direction). */
  | 'hold'
  /** Walk to a seat and sit until she moves away. */
  | 'sit'
  /** Just came through a door — hidden for a moment, then steps in. */
  | 'arriving';

export interface PlayerSnapshot {
  area: AreaId;
  x: number;
  z: number;
  yaw: number;
  moving: boolean;
  speed: number;
}

export interface CompanionState {
  area: AreaId;
  x: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  speed: number;
  moving: boolean;
  visible: boolean;
  mode: CompanionMode;
  /** Target for goto/sit. */
  target: (Point & { yaw?: number; seatHeight?: number }) | null;
  arriveRadius: number;
  /** Seated pose blend 0..1 (renderer reads this). */
  sit: number;
  seatHeight: number;
  /** Yaw to face while holding (null = face the player). */
  holdYaw: number | null;
  arrivingTimer: number;
  // navigation bookkeeping
  path: Point[];
  pathGoal: Point | null;
  repathTimer: number;
  pathFailures: number;
  stuckTimer: number;
  stuckRefX: number;
  stuckRefZ: number;
  side: 1 | -1;
  /** Count of emergency recoveries (diagnostics + tests). */
  recoveries: number;
  /** Set for one frame when a scripted goto completes. */
  arrivedFlag: boolean;
}

export function createCompanionState(area: AreaId, x: number, z: number, yaw = 0): CompanionState {
  return {
    area,
    x,
    z,
    yaw,
    vx: 0,
    vz: 0,
    speed: 0,
    moving: false,
    visible: true,
    mode: 'absent',
    target: null,
    arriveRadius: 0.35,
    sit: 0,
    seatHeight: 0.45,
    holdYaw: null,
    arrivingTimer: 0,
    path: [],
    pathGoal: null,
    repathTimer: 0,
    pathFailures: 0,
    stuckTimer: 0,
    stuckRefX: x,
    stuckRefZ: z,
    side: 1,
    recoveries: 0,
    arrivedFlag: false,
  };
}

export interface CompanionEnv {
  world: CollisionWorld;
  grid: NavGrid;
}

export interface CompanionEvents {
  onRecover?: (reason: string) => void;
}

const WALK = 3.9;
const JOG = 5.6;
const RUN = 7.4;
const STOP_DIST = 1.75;
const START_DIST = 2.5;
const FAR_RECOVER = 38;

/**
 * Advance the companion by dt seconds. Pure with respect to its inputs
 * (mutates only `s`), so it runs identically under the 3D renderer, the 2D
 * fallback renderer and the unit tests.
 */
export function updateCompanion(
  s: CompanionState,
  player: PlayerSnapshot,
  env: CompanionEnv,
  dt: number,
  events: CompanionEvents = {},
) {
  s.arrivedFlag = false;
  if (s.mode === 'absent') {
    s.visible = false;
    s.moving = false;
    return;
  }

  if (s.mode === 'arriving') {
    s.visible = false;
    s.arrivingTimer -= dt;
    if (s.arrivingTimer <= 0) {
      s.visible = true;
      s.mode = 'follow';
    }
    return;
  }
  s.visible = true;

  // Different area than the Princess (should only happen transiently): recover.
  if (s.area !== player.area) {
    recover(s, player, env, events, 'area-mismatch');
    return;
  }

  const dPlayer = Math.hypot(player.x - s.x, player.z - s.z);
  if (s.mode === 'follow' && dPlayer > FAR_RECOVER) {
    recover(s, player, env, events, 'too-far');
    return;
  }

  // Sitting blend.
  const wantsSit = s.mode === 'sit' && s.target !== null && Math.hypot(s.target.x - s.x, s.target.z - s.z) < 0.3;
  s.sit += ((wantsSit ? 1 : 0) - s.sit) * damp(6, dt);

  let goal: Point | null = null;
  let desiredSpeed = 0;

  switch (s.mode) {
    case 'follow': {
      const shouldMove = dPlayer > START_DIST || (player.moving && dPlayer > STOP_DIST);
      if (!shouldMove && (!s.moving || dPlayer < STOP_DIST)) {
        s.path.length = 0;
        break;
      }
      goal = formationSlot(s, player, env);
      const dGoal = Math.hypot(goal.x - s.x, goal.z - s.z);
      desiredSpeed = dPlayer > 9 ? RUN : dPlayer > 4.5 ? JOG : Math.max(WALK, player.speed * 0.98);
      if (dGoal < 0.6) desiredSpeed *= dGoal / 0.6;
      break;
    }
    case 'goto':
    case 'sit': {
      if (!s.target) {
        s.mode = 'follow';
        break;
      }
      const dT = Math.hypot(s.target.x - s.x, s.target.z - s.z);
      if (dT <= s.arriveRadius) {
        if (s.mode === 'goto') {
          s.mode = 'hold';
          s.holdYaw = s.target.yaw ?? null;
          s.arrivedFlag = true;
        } else {
          // Snap onto the seat.
          s.x += (s.target.x - s.x) * damp(8, dt);
          s.z += (s.target.z - s.z) * damp(8, dt);
          if (s.target.yaw !== undefined) s.yaw = lerpAngle(s.yaw, s.target.yaw, damp(6, dt));
          s.seatHeight = s.target.seatHeight ?? 0.45;
        }
        s.vx = s.vz = 0;
        s.speed = 0;
        s.moving = false;
        return;
      }
      goal = s.target;
      desiredSpeed = dT > 8 ? JOG : WALK;
      if (dT < 1) desiredSpeed *= Math.max(0.35, dT);
      break;
    }
    case 'hold':
      break;
  }

  if (goal && desiredSpeed > 0.01) {
    steerTowards(s, goal, desiredSpeed, env, dt, player, events);
  } else {
    // Decelerate.
    const k = damp(10, dt);
    s.vx -= s.vx * k;
    s.vz -= s.vz * k;
    s.speed = Math.hypot(s.vx, s.vz);
    if (s.speed < 0.05) {
      s.vx = s.vz = 0;
      s.speed = 0;
    }
    if (s.speed > 0) {
      const res = env.world.move(s.x, s.z, s.vx * dt, s.vz * dt, COMPANION_RADIUS);
      s.x = res.x;
      s.z = res.z;
    }
    s.moving = s.speed > 0.15;
    s.stuckTimer = 0;
    s.stuckRefX = s.x;
    s.stuckRefZ = s.z;
  }

  // Never stand inside her.
  if (s.mode !== 'sit') separateFromPlayer(s, player, env);

  // Facing.
  if (s.speed > 0.35) {
    s.yaw = lerpAngle(s.yaw, dirToYaw(s.vx, s.vz), damp(10, dt));
  } else if (s.mode === 'hold' && s.holdYaw !== null) {
    s.yaw = lerpAngle(s.yaw, s.holdYaw, damp(5, dt));
  } else if (s.mode !== 'sit') {
    const toPlayer = dirToYaw(player.x - s.x, player.z - s.z);
    if (dPlayer > 0.4) s.yaw = lerpAngle(s.yaw, toPlayer, damp(3.5, dt));
  }
}

/** The spot slightly behind and to one side of the Princess. */
function formationSlot(s: CompanionState, player: PlayerSnapshot, env: CompanionEnv): Point {
  const fx = Math.sin(player.yaw);
  const fz = Math.cos(player.yaw);
  const rx = -Math.cos(player.yaw);
  const rz = Math.sin(player.yaw);
  // Keep to whichever side he's already on so he doesn't cross in front of her.
  const relSide = (s.x - player.x) * rx + (s.z - player.z) * rz;
  if (Math.abs(relSide) > 0.6) s.side = relSide >= 0 ? 1 : -1;
  const candidates: Point[] = [
    { x: player.x + rx * s.side * 1.0 - fx * 1.0, z: player.z + rz * s.side * 1.0 - fz * 1.0 },
    { x: player.x - rx * s.side * 1.0 - fx * 1.0, z: player.z - rz * s.side * 1.0 - fz * 1.0 },
    { x: player.x - fx * 1.4, z: player.z - fz * 1.4 },
  ];
  for (const c of candidates) {
    if (!env.world.isBlocked(c.x, c.z, COMPANION_RADIUS)) return c;
  }
  return { x: player.x, z: player.z };
}

function steerTowards(
  s: CompanionState,
  goal: Point,
  speed: number,
  env: CompanionEnv,
  dt: number,
  player: PlayerSnapshot,
  events: CompanionEvents,
) {
  const { world, grid } = env;
  let aimX = goal.x;
  let aimZ = goal.z;

  const direct = world.segmentClear(s.x, s.z, goal.x, goal.z, COMPANION_RADIUS * 0.92, 0.3);
  if (direct) {
    s.path.length = 0;
    s.pathGoal = null;
    s.pathFailures = 0;
  } else {
    s.repathTimer -= dt;
    const goalMoved = !s.pathGoal || Math.hypot(goal.x - s.pathGoal.x, goal.z - s.pathGoal.z) > 1.6;
    if (s.path.length === 0 || s.repathTimer <= 0 || goalMoved) {
      const path = grid.findPath({ x: s.x, z: s.z }, goal);
      s.repathTimer = 0.7;
      if (path && path.length > 0) {
        s.path = path;
        s.pathGoal = { x: goal.x, z: goal.z };
        s.pathFailures = 0;
      } else {
        s.pathFailures++;
        s.path.length = 0;
        if (s.pathFailures >= 4) {
          recover(s, player, env, events, 'no-path');
          return;
        }
      }
    }
    // Advance along the path, skipping waypoints already reached or directly visible.
    while (s.path.length > 1) {
      const wp = s.path[0];
      const near = Math.hypot(wp.x - s.x, wp.z - s.z) < 0.45;
      const skip = world.segmentClear(s.x, s.z, s.path[1].x, s.path[1].z, COMPANION_RADIUS * 0.92, 0.3);
      if (near || skip) s.path.shift();
      else break;
    }
    if (s.path.length > 0) {
      aimX = s.path[0].x;
      aimZ = s.path[0].z;
    }
  }

  const dx = aimX - s.x;
  const dz = aimZ - s.z;
  const d = Math.hypot(dx, dz);
  const tx = d > 1e-4 ? (dx / d) * speed : 0;
  const tz = d > 1e-4 ? (dz / d) * speed : 0;
  const k = damp(9, dt);
  s.vx += (tx - s.vx) * k;
  s.vz += (tz - s.vz) * k;
  s.speed = Math.hypot(s.vx, s.vz);

  const before = { x: s.x, z: s.z };
  const res = world.move(s.x, s.z, s.vx * dt, s.vz * dt, COMPANION_RADIUS);
  s.x = res.x;
  s.z = res.z;
  if (dt > 0) {
    // Real velocity after collision (prevents "moonwalking" against walls).
    const rvx = (s.x - before.x) / dt;
    const rvz = (s.z - before.z) / dt;
    if (res.hit) {
      s.vx = rvx;
      s.vz = rvz;
      s.speed = Math.hypot(rvx, rvz);
    }
  }
  s.moving = s.speed > 0.15;

  // Stuck detection: little net movement while trying to move.
  s.stuckTimer += dt;
  if (s.stuckTimer > 1.6) {
    const moved = Math.hypot(s.x - s.stuckRefX, s.z - s.stuckRefZ);
    if (moved < 0.4) {
      s.path.length = 0;
      s.repathTimer = 0;
      s.pathFailures++;
      if (s.pathFailures >= 4) {
        recover(s, player, env, events, 'stuck');
        return;
      }
    } else {
      s.pathFailures = Math.max(0, s.pathFailures - 1);
    }
    s.stuckTimer = 0;
    s.stuckRefX = s.x;
    s.stuckRefZ = s.z;
  }
}

function separateFromPlayer(s: CompanionState, player: PlayerSnapshot, env: CompanionEnv) {
  const dx = s.x - player.x;
  const dz = s.z - player.z;
  const d = Math.hypot(dx, dz);
  const minD = 0.9;
  if (d < minD) {
    const nx = d > 1e-4 ? dx / d : -Math.cos(player.yaw);
    const nz = d > 1e-4 ? dz / d : Math.sin(player.yaw);
    const res = env.world.resolve(player.x + nx * minD, player.z + nz * minD, COMPANION_RADIUS);
    s.x = res.x;
    s.z = res.z;
  }
}

/**
 * Last-resort recovery when navigation fails: step back in just behind her
 * (out of the camera's usual view) on the nearest walkable ground.
 */
export function recover(
  s: CompanionState,
  player: PlayerSnapshot,
  env: CompanionEnv,
  events: CompanionEvents,
  reason: string,
) {
  const fx = Math.sin(player.yaw);
  const fz = Math.cos(player.yaw);
  const tries: Point[] = [
    { x: player.x - fx * 2.6, z: player.z - fz * 2.6 },
    { x: player.x - fx * 1.8 + fz * 1.2, z: player.z - fz * 1.8 - fx * 1.2 },
    { x: player.x - fx * 1.8 - fz * 1.2, z: player.z - fz * 1.8 + fx * 1.2 },
    { x: player.x + fz * 1.4, z: player.z - fx * 1.4 },
  ];
  let spot: Point | null = null;
  for (const t of tries) {
    if (!env.world.isBlocked(t.x, t.z, COMPANION_RADIUS) && env.world.segmentClear(player.x, player.z, t.x, t.z, 0.2)) {
      spot = t;
      break;
    }
  }
  if (!spot) spot = env.world.nearestFree(player.x - fx * 1.5, player.z - fz * 1.5, COMPANION_RADIUS, 6);
  if (!spot) spot = { x: player.x, z: player.z };
  s.area = player.area;
  s.x = spot.x;
  s.z = spot.z;
  s.vx = s.vz = 0;
  s.speed = 0;
  s.path.length = 0;
  s.pathGoal = null;
  s.pathFailures = 0;
  s.stuckTimer = 0;
  s.stuckRefX = s.x;
  s.stuckRefZ = s.z;
  if (s.mode === 'goto' || s.mode === 'sit') s.mode = 'follow';
  s.recoveries++;
  events.onRecover?.(reason);
}

/** Companion steps through a door after her: hidden briefly, then walks in. */
export function arriveThroughDoor(s: CompanionState, area: AreaId, x: number, z: number, yaw: number, delay = 0.7) {
  s.area = area;
  s.x = x;
  s.z = z;
  s.yaw = yaw;
  s.vx = s.vz = 0;
  s.speed = 0;
  s.path.length = 0;
  s.pathGoal = null;
  s.sit = 0;
  s.mode = 'arriving';
  s.arrivingTimer = delay;
  s.visible = false;
  s.stuckRefX = x;
  s.stuckRefZ = z;
}

export function commandGoto(s: CompanionState, target: Point & { yaw?: number }, arriveRadius = 0.35) {
  s.mode = 'goto';
  s.target = { ...target };
  s.arriveRadius = arriveRadius;
  s.path.length = 0;
  s.pathGoal = null;
  s.repathTimer = 0;
}

export function commandSit(s: CompanionState, seat: { x: number; z: number; yaw: number; height: number }) {
  s.mode = 'sit';
  s.target = { x: seat.x, z: seat.z, yaw: seat.yaw, seatHeight: seat.height };
  s.arriveRadius = 0.25;
  s.path.length = 0;
  s.pathGoal = null;
  s.repathTimer = 0;
}

export function commandFollow(s: CompanionState) {
  if (s.mode === 'absent') return;
  s.mode = 'follow';
  s.target = null;
  s.holdYaw = null;
}

export function commandHold(s: CompanionState, yaw: number | null = null) {
  s.mode = 'hold';
  s.holdYaw = yaw;
  s.target = null;
}
