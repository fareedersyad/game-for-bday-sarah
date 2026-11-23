import type { CollisionWorld } from '../PlayerController/collision';

export interface Point {
  x: number;
  z: number;
}

const SQRT2 = Math.SQRT2;

/**
 * Occupancy grid + A* pathfinder used by the Royal Companion.
 * Cells are marked blocked when a circle of `agentRadius` centred on the
 * cell would overlap a collider, so any path through free cells is walkable
 * by an agent of that size. Rebuilt whenever a gate opens.
 */
export class NavGrid {
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  readonly originX: number;
  readonly originZ: number;
  readonly agentRadius: number;
  private blocked: Uint8Array;
  private readonly world: CollisionWorld;
  // A* scratch buffers (reused between searches).
  private g: Float32Array;
  private parent: Int32Array;
  private closed: Uint32Array;
  private openStamp: Uint32Array;
  private searchId = 0;
  private heap: Int32Array;
  private heapF: Float32Array;
  private heapSize = 0;
  builtSignature = '';

  constructor(world: CollisionWorld, cell = 0.8, agentRadius = 0.5) {
    this.world = world;
    this.cell = cell;
    this.agentRadius = agentRadius;
    const b = world.bounds;
    this.originX = b.minX;
    this.originZ = b.minZ;
    this.cols = Math.ceil((b.maxX - b.minX) / cell);
    this.rows = Math.ceil((b.maxZ - b.minZ) / cell);
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n);
    this.g = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.closed = new Uint32Array(n);
    this.openStamp = new Uint32Array(n);
    this.heap = new Int32Array(n);
    this.heapF = new Float32Array(n);
    this.rebuild();
  }

  rebuild() {
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const p = this.cellCenter(c, r);
        this.blocked[r * this.cols + c] = this.world.isBlocked(p.x, p.z, this.agentRadius) ? 1 : 0;
      }
    }
    this.builtSignature = this.world.gateSignature();
  }

  /** Rebuild if gates changed since the last build. Returns true when rebuilt. */
  syncWithWorld() {
    if (this.world.gateSignature() !== this.builtSignature) {
      this.rebuild();
      return true;
    }
    return false;
  }

  cellCenter(c: number, r: number): Point {
    return { x: this.originX + (c + 0.5) * this.cell, z: this.originZ + (r + 0.5) * this.cell };
  }

  toCell(x: number, z: number): [number, number] {
    return [Math.floor((x - this.originX) / this.cell), Math.floor((z - this.originZ) / this.cell)];
  }

  inGrid(c: number, r: number) {
    return c >= 0 && r >= 0 && c < this.cols && r < this.rows;
  }

  walkableCell(c: number, r: number) {
    return this.inGrid(c, r) && this.blocked[r * this.cols + c] === 0;
  }

  walkable(x: number, z: number) {
    const [c, r] = this.toCell(x, z);
    return this.walkableCell(c, r);
  }

  /** Nearest walkable cell centre to (x, z) within maxRing cells. */
  nearestWalkable(x: number, z: number, maxRing = 12): Point | null {
    const [c0, r0] = this.toCell(x, z);
    if (this.walkableCell(c0, r0)) return this.cellCenter(c0, r0);
    for (let ring = 1; ring <= maxRing; ring++) {
      let best: Point | null = null;
      let bestD = Infinity;
      for (let dc = -ring; dc <= ring; dc++) {
        for (let dr = -ring; dr <= ring; dr++) {
          if (Math.abs(dc) !== ring && Math.abs(dr) !== ring) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (!this.walkableCell(c, r)) continue;
          const p = this.cellCenter(c, r);
          const d = (p.x - x) ** 2 + (p.z - z) ** 2;
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** Grid line-of-sight: every cell the segment passes over is walkable. */
  lineOfSight(ax: number, az: number, bx: number, bz: number): boolean {
    const len = Math.hypot(bx - ax, bz - az);
    const step = this.cell * 0.35;
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      if (!this.walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  /**
   * A* search. Returns a smoothed list of waypoints from start (exclusive) to
   * goal (inclusive), or null if no path exists within the iteration budget.
   */
  findPath(start: Point, goal: Point, maxIterations = 40000): Point[] | null {
    const s = this.nearestWalkable(start.x, start.z, 4);
    const e = this.nearestWalkable(goal.x, goal.z, 10);
    if (!s || !e) return null;
    const [sc, sr] = this.toCell(s.x, s.z);
    const [ec, er] = this.toCell(e.x, e.z);
    const cols = this.cols;
    const startIdx = sr * cols + sc;
    const goalIdx = er * cols + ec;

    this.searchId++;
    if (this.searchId === 0xffffffff) {
      this.closed.fill(0);
      this.openStamp.fill(0);
      this.searchId = 1;
    }
    const id = this.searchId;
    this.heapSize = 0;
    this.g[startIdx] = 0;
    this.parent[startIdx] = -1;
    this.openStamp[startIdx] = id;
    this.push(startIdx, this.h(sc, sr, ec, er));

    let iterations = 0;
    let found = false;
    while (this.heapSize > 0) {
      if (++iterations > maxIterations) return null;
      const cur = this.pop();
      if (cur === goalIdx) {
        found = true;
        break;
      }
      if (this.closed[cur] === id) continue;
      this.closed[cur] = id;
      const cc = cur % cols;
      const cr = (cur - cc) / cols;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dc === 0 && dr === 0) continue;
          const nc = cc + dc;
          const nr = cr + dr;
          if (!this.walkableCell(nc, nr)) continue;
          // No corner cutting.
          if (dc !== 0 && dr !== 0 && (!this.walkableCell(cc + dc, cr) || !this.walkableCell(cc, cr + dr))) continue;
          const ni = nr * cols + nc;
          if (this.closed[ni] === id) continue;
          const ng = this.g[cur] + (dc !== 0 && dr !== 0 ? SQRT2 : 1);
          if (this.openStamp[ni] !== id || ng < this.g[ni]) {
            this.openStamp[ni] = id;
            this.g[ni] = ng;
            this.parent[ni] = cur;
            this.push(ni, ng + this.h(nc, nr, ec, er));
          }
        }
      }
    }
    if (!found) return null;

    const raw: Point[] = [];
    for (let i = goalIdx; i !== -1; i = this.parent[i]) {
      const c = i % cols;
      const r = (i - c) / cols;
      raw.push(this.cellCenter(c, r));
      if (i === startIdx) break;
    }
    raw.reverse();
    raw[raw.length - 1] = { x: e.x, z: e.z };
    return this.smooth({ x: start.x, z: start.z }, raw);
  }

  /** String-pulling: drop waypoints that are directly visible from an earlier one. */
  private smooth(start: Point, pts: Point[]): Point[] {
    if (pts.length <= 1) return pts;
    const out: Point[] = [];
    let anchor = start;
    let i = 0;
    while (i < pts.length) {
      let far = i;
      for (let j = pts.length - 1; j > i; j--) {
        if (this.lineOfSight(anchor.x, anchor.z, pts[j].x, pts[j].z)) {
          far = j;
          break;
        }
      }
      out.push(pts[far]);
      anchor = pts[far];
      i = far + 1;
    }
    return out;
  }

  private h(c: number, r: number, ec: number, er: number) {
    const dx = Math.abs(c - ec);
    const dz = Math.abs(r - er);
    return dx + dz + (SQRT2 - 2) * Math.min(dx, dz);
  }

  private push(idx: number, f: number) {
    let i = this.heapSize++;
    const heap = this.heap;
    const hf = this.heapF;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (hf[p] <= f) break;
      heap[i] = heap[p];
      hf[i] = hf[p];
      i = p;
    }
    heap[i] = idx;
    hf[i] = f;
  }

  private pop(): number {
    const heap = this.heap;
    const hf = this.heapF;
    const top = heap[0];
    const lastIdx = heap[--this.heapSize];
    const lastF = hf[this.heapSize];
    let i = 0;
    const n = this.heapSize;
    while (true) {
      const l = i * 2 + 1;
      if (l >= n) break;
      const r = l + 1;
      const m = r < n && hf[r] < hf[l] ? r : l;
      if (hf[m] >= lastF) break;
      heap[i] = heap[m];
      hf[i] = hf[m];
      i = m;
    }
    heap[i] = lastIdx;
    hf[i] = lastF;
    return top;
  }
}
