/**
 * Shared palette and cached materials. Reusing material instances keeps
 * draw-call state changes low and memory small on mobile GPUs.
 */
import * as THREE from 'three';

export const PALETTE = {
  ivory: '#fff6ea',
  pearl: '#fbf3ef',
  cream: '#f7e9d4',
  stone: '#efe2d2',
  stoneDark: '#d9c6b0',
  rose: '#e8899e',
  roseDeep: '#c96d86',
  dusty: '#d8a7b1',
  blush: '#f6c9d4',
  roseGold: '#e6b18f',
  gold: '#d9b25f',
  goldDeep: '#b38a3b',
  lavender: '#c3b1e1',
  lavenderDeep: '#9c85c8',
  grass: '#a9cf8f',
  grassDeep: '#86b571',
  hedge: '#6f9e63',
  leaf: '#7fb36c',
  blossom: '#f6bfd0',
  wood: '#b98a62',
  woodDark: '#7d5a40',
  water: '#8fc8e6',
  path: '#efdcb8',
  roof: '#e79bb0',
  roofDeep: '#cf7d97',
  crystal: '#e9f4ff',
  // Sage Green royal theme (Princess Sarah)
  sage: '#A3B18A',
  sageSoft: '#CCD5AE',
  sageDeep: '#6F8560',
  forest: '#344E41',
  ivoryWarm: '#F8F6EF',
  creamWarm: '#F3EBDD',
  mutedGold: '#D4AF70',
  strawberry: '#D94B55',
  softPink: '#F3D6D8',
};

const cache = new Map<string, THREE.Material>();

export function mat(color: string, opts: { rough?: number; metal?: number; emissive?: string; emissiveIntensity?: number; flat?: boolean; transparent?: boolean; opacity?: number; side?: THREE.Side } = {}) {
  const key = JSON.stringify([color, opts]);
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.75,
      metalness: opts.metal ?? 0,
      emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color('#000'),
      emissiveIntensity: opts.emissiveIntensity ?? 1,
      flatShading: opts.flat ?? false,
      transparent: opts.transparent ?? false,
      opacity: opts.opacity ?? 1,
      side: opts.side ?? THREE.FrontSide,
    });
    cache.set(key, m);
  }
  return m;
}

export const goldMat = () => mat(PALETTE.gold, { rough: 0.28, metal: 0.85 });
export const roseGoldMat = () => mat(PALETTE.roseGold, { rough: 0.25, metal: 0.9 });
export const glowMat = (color: string, intensity = 1.6) => mat(color, { emissive: color, emissiveIntensity: intensity, rough: 0.4 });

/** A soft radial sprite texture generated on the fly (for glows / particles). */
let glowTex: THREE.Texture | null = null;
export function glowTexture() {
  if (glowTex) return glowTex;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** Heart shape (for emotes, decorations). */
export function heartShape(scale = 1) {
  const s = new THREE.Shape();
  const x = 0;
  const y = 0;
  s.moveTo(x, y + 0.25 * scale);
  s.bezierCurveTo(x, y + 0.25 * scale, x - 0.05 * scale, y, x - 0.25 * scale, y);
  s.bezierCurveTo(x - 0.55 * scale, y, x - 0.55 * scale, y + 0.35 * scale, x - 0.55 * scale, y + 0.35 * scale);
  s.bezierCurveTo(x - 0.55 * scale, y + 0.55 * scale, x - 0.35 * scale, y + 0.77 * scale, x, y + 0.95 * scale);
  s.bezierCurveTo(x + 0.35 * scale, y + 0.77 * scale, x + 0.55 * scale, y + 0.55 * scale, x + 0.55 * scale, y + 0.35 * scale);
  s.bezierCurveTo(x + 0.55 * scale, y + 0.35 * scale, x + 0.55 * scale, y, x + 0.25 * scale, y);
  s.bezierCurveTo(x + 0.1 * scale, y, x, y + 0.25 * scale, x, y + 0.25 * scale);
  return s;
}

export function starShape(outer = 0.5, inner = 0.22, points = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}
