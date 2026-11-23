import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PATHS, TREES, ZONES } from '../../systems/WorldManager/worldLayout';
import { distToPolyline } from '../../utils/math';
import { mulberry32 } from '../../utils/rng';
import { groundHeight } from './Terrain';
import { useQuality } from './quality';

const o = new THREE.Object3D();
const col = new THREE.Color();

const TREE_COLORS = {
  round: ['#86b96e', '#93c27a', '#7aad66'],
  blossom: ['#f6bccd', '#f9cfdc', '#f0a9bf'],
  pine: ['#5f9a6a', '#6aa574', '#558f61'],
  dark: ['#3f5e55', '#47685d', '#38554d'],
};

export function Trees() {
  const q = useQuality();
  const detail = q.tier === 'high' ? 1 : 0;
  const trunks = useRef<THREE.InstancedMesh>(null);
  const balls = useRef<THREE.InstancedMesh>(null);
  const cones = useRef<THREE.InstancedMesh>(null);
  const roundish = TREES.filter((t) => t.kind === 'round' || t.kind === 'blossom');
  const pointy = TREES.filter((t) => t.kind === 'pine' || t.kind === 'dark');

  useLayoutEffect(() => {
    const rng = mulberry32(11);
    TREES.forEach((t, i) => {
      const y = groundHeight(t.x, t.z);
      o.position.set(t.x, y + 0.9 * t.scale, t.z);
      o.rotation.set(0, t.rot, 0);
      o.scale.set(t.scale, t.scale * (t.kind === 'pine' || t.kind === 'dark' ? 1.1 : 1), t.scale);
      o.updateMatrix();
      trunks.current!.setMatrixAt(i, o.matrix);
      trunks.current!.setColorAt(i, col.set(t.kind === 'dark' ? '#5b4636' : '#9a7352'));
    });
    let bi = 0;
    roundish.forEach((t) => {
      const y = groundHeight(t.x, t.z);
      const palette = TREE_COLORS[t.kind];
      for (let k = 0; k < 3; k++) {
        const a = t.rot + k * 2.1;
        const off = k === 0 ? 0 : 0.55 * t.scale;
        o.position.set(t.x + Math.cos(a) * off, y + (2.3 + (k === 0 ? 0.35 : 0) + rng() * 0.2) * t.scale, t.z + Math.sin(a) * off);
        o.rotation.set(rng(), rng(), rng());
        const s = (k === 0 ? 1.25 : 0.85) * t.scale;
        o.scale.set(s, s * 0.9, s);
        o.updateMatrix();
        balls.current!.setMatrixAt(bi, o.matrix);
        balls.current!.setColorAt(bi, col.set(palette[(bi + k) % 3]));
        bi++;
      }
    });
    let ci = 0;
    pointy.forEach((t) => {
      const y = groundHeight(t.x, t.z);
      const palette = TREE_COLORS[t.kind];
      for (let k = 0; k < 2; k++) {
        o.position.set(t.x, y + (2.0 + k * 1.1) * t.scale, t.z);
        o.rotation.set(0, t.rot, 0);
        const s = (k === 0 ? 1.2 : 0.85) * t.scale;
        o.scale.set(s, s, s);
        o.updateMatrix();
        cones.current!.setMatrixAt(ci, o.matrix);
        cones.current!.setColorAt(ci, col.set(palette[(ci + k) % 3]));
        ci++;
      }
    });
    for (const m of [trunks.current!, balls.current!, cones.current!]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [roundish, pointy]);

  return (
    <group>
      <instancedMesh ref={trunks} args={[undefined, undefined, TREES.length]} castShadow receiveShadow>
        <cylinderGeometry args={[0.16, 0.24, 1.8, 6, 1, true]} />
        <meshStandardMaterial roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={balls} args={[undefined, undefined, roundish.length * 3]} castShadow>
        <icosahedronGeometry args={[1, detail]} />
        <meshStandardMaterial roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={cones} args={[undefined, undefined, pointy.length * 2]} castShadow>
        <coneGeometry args={[1.15, 2.1, 8]} />
        <meshStandardMaterial roughness={0.85} flatShading />
      </instancedMesh>
    </group>
  );
}

export interface FlowerInstance {
  x: number;
  z: number;
  y?: number;
  color: string;
  scale?: number;
  kind?: 'round' | 'cup' | 'sun' | 'cluster';
}

/**
 * Instanced flowers. `grow` (0..1, read every frame) lets the coronation
 * bloom animate whole fields at once.
 */
export function FlowerField({ flowers, grow }: { flowers: FlowerInstance[]; grow?: () => number }) {
  const stems = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const centers = useRef<THREE.InstancedMesh>(null);
  const lastGrow = useRef(-1);

  const apply = (g: number) => {
    flowers.forEach((f, i) => {
      const s = (f.scale ?? 1) * Math.max(0.0001, g);
      const y = f.y ?? groundHeight(f.x, f.z);
      const h = f.kind === 'sun' ? 0.85 : 0.42;
      o.position.set(f.x, y + (h / 2) * s, f.z);
      o.rotation.set(0, 0, 0);
      o.scale.set(s, s * (h / 0.42), s);
      o.updateMatrix();
      stems.current!.setMatrixAt(i, o.matrix);
      o.position.set(f.x, y + h * s, f.z);
      o.rotation.set(f.kind === 'cup' ? 0 : -0.2, i, 0);
      const hs = f.kind === 'sun' ? 1.7 : f.kind === 'cluster' ? 1.6 : f.kind === 'cup' ? 1 : 1.1;
      o.scale.set(s * hs, s * (f.kind === 'cup' ? 1.5 : f.kind === 'sun' ? 0.4 : 0.8) * hs, s * hs);
      o.updateMatrix();
      heads.current!.setMatrixAt(i, o.matrix);
      o.position.y += 0.02 * s;
      o.scale.multiplyScalar(f.kind === 'sun' ? 0.45 : 0.3);
      o.updateMatrix();
      centers.current!.setMatrixAt(i, o.matrix);
    });
    stems.current!.instanceMatrix.needsUpdate = true;
    heads.current!.instanceMatrix.needsUpdate = true;
    centers.current!.instanceMatrix.needsUpdate = true;
  };

  useLayoutEffect(() => {
    flowers.forEach((f, i) => {
      heads.current!.setColorAt(i, col.set(f.color));
      centers.current!.setColorAt(i, col.set(f.kind === 'sun' ? '#6b4a2b' : '#fff1b8'));
    });
    heads.current!.instanceColor!.needsUpdate = true;
    centers.current!.instanceColor!.needsUpdate = true;
    apply(grow ? grow() : 1);
    lastGrow.current = grow ? grow() : 1;
    for (const m of [stems.current!, heads.current!, centers.current!]) m.computeBoundingSphere();
  }, [flowers]);

  useFrame(() => {
    if (!grow) return;
    const g = grow();
    if (Math.abs(g - lastGrow.current) > 0.004) {
      lastGrow.current = g;
      apply(g);
    }
  });

  if (flowers.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={stems} args={[undefined, undefined, flowers.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.012, 0.016, 0.42, 3, 1, true]} />
        <meshStandardMaterial color="#6fa75c" roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, flowers.length]} frustumCulled={false}>
        <icosahedronGeometry args={[0.07, 0]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={centers} args={[undefined, undefined, flowers.length]} frustumCulled={false}>
        <octahedronGeometry args={[0.07, 0]} />
        <meshStandardMaterial roughness={0.6} />
      </instancedMesh>
    </group>
  );
}

const MEADOW_COLORS = ['#f7c3d1', '#fff4f0', '#e6dcf5', '#f3dca4', '#f19bb4', '#c9b6ec'];

/** Wildflowers and grass tufts sprinkled over the open meadows. */
export function Meadows() {
  const q = useQuality();
  const flowers = useMemo(() => {
    const rng = mulberry32(31);
    const out: FlowerInstance[] = [];
    const n = Math.round(650 * q.detail);
    let guard = 0;
    while (out.length < n && guard++ < n * 8) {
      const x = -58 + rng() * 116;
      const z = -52 + rng() * 132;
      if (z > 47 && z < 60) continue; // river
      if (PATHS.some((p) => distToPolyline(x, z, p.points) < p.width / 2 + 0.4)) continue;
      // Keep building floors clear.
      const inBuilding = ZONES.some((zo) => (zo.id === 'mirror' || zo.id === 'library' || zo.id === 'courtroom' || zo.id === 'castleGrounds') && zo.shape.kind === 'box' && x > zo.shape.minX && x < zo.shape.maxX && z > zo.shape.minZ && z < zo.shape.maxZ);
      if (inBuilding) continue;
      out.push({ x, z, color: MEADOW_COLORS[Math.floor(rng() * MEADOW_COLORS.length)], scale: 0.6 + rng() * 0.5, kind: rng() < 0.15 ? 'cluster' : 'round' });
    }
    return out;
  }, [q.detail]);

  const tufts = useRef<THREE.InstancedMesh>(null);
  const tuftCount = Math.round(1400 * q.detail);
  useLayoutEffect(() => {
    const rng = mulberry32(99);
    for (let i = 0; i < tuftCount; i++) {
      const x = -60 + rng() * 120;
      const z = -54 + rng() * 136;
      const y = z > 49 && z < 58 ? -5 : groundHeight(x, z);
      o.position.set(x, y + 0.12, z);
      o.rotation.set(0, rng() * 6, 0);
      const s = 0.6 + rng() * 0.7;
      o.scale.set(s, s, s);
      o.updateMatrix();
      tufts.current!.setMatrixAt(i, o.matrix);
      tufts.current!.setColorAt(i, col.setHSL(0.27 + rng() * 0.05, 0.38, 0.5 + rng() * 0.12));
    }
    tufts.current!.instanceMatrix.needsUpdate = true;
    tufts.current!.instanceColor!.needsUpdate = true;
    tufts.current!.computeBoundingSphere();
  }, [tuftCount]);

  return (
    <group>
      <FlowerField flowers={flowers} />
      <instancedMesh ref={tufts} args={[undefined, undefined, tuftCount]}>
        <coneGeometry args={[0.09, 0.28, 3]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
    </group>
  );
}
