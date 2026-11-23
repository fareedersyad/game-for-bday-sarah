export interface Vec2 {
  x: number;
  z: number;
}

export const TAU = Math.PI * 2;

export const clamp = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Frame-rate independent exponential smoothing factor. */
export const damp = (lambda: number, dt: number) => 1 - Math.exp(-lambda * dt);

export const dist2 = (ax: number, az: number, bx: number, bz: number) => {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
};
export const dist = (ax: number, az: number, bx: number, bz: number) => Math.sqrt(dist2(ax, az, bx, bz));

/** Wrap an angle into (-PI, PI]. */
export const wrapAngle = (a: number) => {
  let r = (a + Math.PI) % TAU;
  if (r < 0) r += TAU;
  return r - Math.PI;
};

/** Shortest-path angular interpolation. */
export const lerpAngle = (a: number, b: number, t: number) => a + wrapAngle(b - a) * t;

/**
 * Facing convention used across the game: a character with yaw `y`
 * faces the horizontal direction (sin y, cos y). Yaw = PI faces north (-z).
 */
export const yawToDir = (yaw: number): Vec2 => ({ x: Math.sin(yaw), z: Math.cos(yaw) });
export const dirToYaw = (dx: number, dz: number) => Math.atan2(dx, dz);

/** Distance from point p to segment ab (2D, XZ plane). */
export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const abx = bx - ax;
  const abz = bz - az;
  const len2 = abx * abx + abz * abz;
  let t = len2 > 0 ? ((px - ax) * abx + (pz - az) * abz) / len2 : 0;
  t = clamp(t, 0, 1);
  return dist(px, pz, ax + abx * t, az + abz * t);
}

export function distToPolyline(px: number, pz: number, pts: ReadonlyArray<readonly [number, number]>) {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]);
    if (d < best) best = d;
  }
  return best;
}
