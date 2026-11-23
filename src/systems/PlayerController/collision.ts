import type { AreaBounds, Collider, GateId } from '../WorldManager/worldTypes';

const CELL = 6;

/**
 * 2D collision world on the XZ plane. Characters are circles; obstacles are
 * circles or axis-aligned boxes. A uniform spatial hash keeps queries cheap
 * even with hundreds of trees. Gate colliders can be toggled at runtime.
 */
export class CollisionWorld {
  readonly bounds: AreaBounds;
  private readonly colliders: Collider[];
  private readonly buckets = new Map<number, number[]>();
  private readonly openGates = new Set<GateId>();
  private readonly scratch: number[] = [];
  private stamp = 1;
  private readonly marks: Uint32Array;

  constructor(colliders: Collider[], bounds: AreaBounds) {
    this.colliders = colliders;
    this.bounds = bounds;
    this.marks = new Uint32Array(colliders.length);
    colliders.forEach((c, i) => {
      const [minX, minZ, maxX, maxZ] = aabb(c);
      for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
        for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
          const k = key(cx, cz);
          let b = this.buckets.get(k);
          if (!b) this.buckets.set(k, (b = []));
          b.push(i);
        }
      }
    });
  }

  setGateOpen(gate: GateId, open: boolean) {
    if (open) this.openGates.add(gate);
    else this.openGates.delete(gate);
  }

  isGateOpen(gate: GateId) {
    return this.openGates.has(gate);
  }

  /** Signature of the current gate state (used to know when nav grids must rebuild). */
  gateSignature() {
    return [...this.openGates].sort().join('|');
  }

  private query(minX: number, minZ: number, maxX: number, maxZ: number): number[] {
    const out = this.scratch;
    out.length = 0;
    this.stamp++;
    if (this.stamp === 0xffffffff) {
      this.marks.fill(0);
      this.stamp = 1;
    }
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
      for (let cz = Math.floor(minZ / CELL); cz <= Math.floor(maxZ / CELL); cz++) {
        const b = this.buckets.get(key(cx, cz));
        if (!b) continue;
        for (const i of b) {
          if (this.marks[i] === this.stamp) continue;
          this.marks[i] = this.stamp;
          const c = this.colliders[i];
          if (c.gate && this.openGates.has(c.gate)) continue;
          out.push(i);
        }
      }
    }
    return out;
  }

  /** All (closed-gate-aware) colliders overlapping a circle. */
  overlapping(x: number, z: number, r: number): Collider[] {
    const ids = this.query(x - r, z - r, x + r, z + r);
    const out: Collider[] = [];
    for (const i of ids) if (penetration(this.colliders[i], x, z, r) !== null) out.push(this.colliders[i]);
    return out;
  }

  /** True when a circle of radius r at (x, z) overlaps anything (or leaves the bounds). */
  isBlocked(x: number, z: number, r: number): boolean {
    const b = this.bounds;
    if (x - r < b.minX || x + r > b.maxX || z - r < b.minZ || z + r > b.maxZ) return true;
    const ids = this.query(x - r, z - r, x + r, z + r);
    for (const i of ids) {
      if (penetration(this.colliders[i], x, z, r) !== null) return true;
    }
    return false;
  }

  /**
   * Push a circle out of all overlapping colliders. Returns the corrected
   * position. Sliding along walls falls out naturally from per-axis pushes.
   */
  resolve(x: number, z: number, r: number, iterations = 4): { x: number; z: number; hit: boolean } {
    let px = x;
    let pz = z;
    let hit = false;
    for (let it = 0; it < iterations; it++) {
      const ids = this.query(px - r - 0.1, pz - r - 0.1, px + r + 0.1, pz + r + 0.1);
      let moved = false;
      for (const i of ids) {
        const p = penetration(this.colliders[i], px, pz, r);
        if (p) {
          px += p.x;
          pz += p.z;
          moved = true;
          hit = true;
        }
      }
      if (!moved) break;
    }
    const b = this.bounds;
    const cx = Math.min(Math.max(px, b.minX + r), b.maxX - r);
    const cz = Math.min(Math.max(pz, b.minZ + r), b.maxZ - r);
    if (cx !== px || cz !== pz) hit = true;
    return { x: cx, z: cz, hit };
  }

  /** Sweep-tested move: splits long moves into sub-steps so fast movers cannot tunnel. */
  move(x: number, z: number, dx: number, dz: number, r: number) {
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / (r * 0.75)));
    let px = x;
    let pz = z;
    let hit = false;
    for (let s = 0; s < steps; s++) {
      const res = this.resolve(px + dx / steps, pz + dz / steps, r);
      px = res.x;
      pz = res.z;
      hit = hit || res.hit;
    }
    return { x: px, z: pz, hit };
  }

  /** Conservative clearance test along a segment. */
  segmentClear(ax: number, az: number, bx: number, bz: number, r: number, step = 0.35): boolean {
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (this.isBlocked(ax + (bx - ax) * t, az + (bz - az) * t, r)) return false;
    }
    return true;
  }

  /** Find the closest free spot around (x, z) by spiralling outwards. */
  nearestFree(x: number, z: number, r: number, maxRadius = 8): { x: number; z: number } | null {
    if (!this.isBlocked(x, z, r)) return { x, z };
    for (let rad = 0.5; rad <= maxRadius; rad += 0.5) {
      const samples = Math.max(8, Math.ceil(rad * 8));
      for (let i = 0; i < samples; i++) {
        const a = (i / samples) * Math.PI * 2;
        const px = x + Math.cos(a) * rad;
        const pz = z + Math.sin(a) * rad;
        if (!this.isBlocked(px, pz, r)) return { x: px, z: pz };
      }
    }
    return null;
  }
}

function key(cx: number, cz: number) {
  return (cx + 1024) * 4096 + (cz + 1024);
}

function aabb(c: Collider): [number, number, number, number] {
  if (c.kind === 'circle') return [c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r];
  return [c.minX, c.minZ, c.maxX, c.maxZ];
}

/** Returns the push vector that separates circle (x, z, r) from collider c, or null. */
export function penetration(c: Collider, x: number, z: number, r: number): { x: number; z: number } | null {
  if (c.kind === 'circle') {
    const dx = x - c.x;
    const dz = z - c.z;
    const d2 = dx * dx + dz * dz;
    const rr = r + c.r;
    if (d2 >= rr * rr) return null;
    const d = Math.sqrt(d2);
    if (d < 1e-6) return { x: rr, z: 0 };
    const push = rr - d;
    return { x: (dx / d) * push, z: (dz / d) * push };
  }
  const cx = Math.min(Math.max(x, c.minX), c.maxX);
  const cz = Math.min(Math.max(z, c.minZ), c.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 > 1e-12) {
    if (d2 >= r * r) return null;
    const d = Math.sqrt(d2);
    const push = r - d;
    return { x: (dx / d) * push, z: (dz / d) * push };
  }
  // Centre is inside the box: push out along the axis of least penetration.
  const left = x - c.minX;
  const right = c.maxX - x;
  const top = z - c.minZ;
  const bottom = c.maxZ - z;
  const m = Math.min(left, right, top, bottom);
  if (m === left) return { x: -(left + r), z: 0 };
  if (m === right) return { x: right + r, z: 0 };
  if (m === top) return { x: 0, z: -(top + r) };
  return { x: 0, z: bottom + r };
}
