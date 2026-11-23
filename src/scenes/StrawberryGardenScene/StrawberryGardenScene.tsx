import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { goldMat, mat, PALETTE } from '../../components/game/materials';
import { useQuality } from '../../components/game/quality';
import { StaticBatch } from '../../components/game/StaticBatch';
import { FlowerField, type FlowerInstance } from '../../components/game/Vegetation';
import { useGameStore } from '../../stores/gameStore';
import { useSettings } from '../../stores/settingsStore';
import { runtime } from '../../systems/runtime';
import { GAZEBO_POSTS, STRAWBERRY_GARDEN, STRAWBERRY_SPOTS } from '../../systems/WorldManager/worldLayout';
import { mulberry32 } from '../../utils/rng';
import { Glow, LampPost, Proximity } from '../common';

/** A low-poly strawberry: rounded shoulders tapering to a point (8 radial segments). */
function strawberryGeometry() {
  const pts: THREE.Vector2[] = [];
  const steps = 7;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 = tip, 1 = top
    const r = Math.sin(t * Math.PI * 0.62) * 0.5 * (0.55 + 0.45 * t);
    pts.push(new THREE.Vector2(Math.max(0.001, r), t));
  }
  pts.push(new THREE.Vector2(0.001, 1));
  const g = new THREE.LatheGeometry(pts, 8);
  g.translate(0, -0.5, 0);
  return g;
}

const STRAWBERRY_GEO = strawberryGeometry();
const berryMat = () => mat(PALETTE.strawberry, { rough: 0.45, emissive: '#7a1520', emissiveIntensity: 0.15 });
const calyxMat = () => mat('#5f8f4e', { rough: 0.8 });

export function StrawberryModel({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      <mesh geometry={STRAWBERRY_GEO} material={berryMat()} scale={[0.1, 0.13, 0.1]} castShadow />
      <mesh material={calyxMat()} position={[0, 0.07, 0]} scale={[1, 0.25, 1]}>
        <coneGeometry args={[0.06, 0.06, 5]} />
      </mesh>
    </group>
  );
}

const o = new THREE.Object3D();
const col = new THREE.Color();

/** Instanced strawberry plants (leaves + berries) filling every bed. */
function StrawberryBeds() {
  const q = useQuality();
  const leaves = useRef<THREE.InstancedMesh>(null);
  const berries = useRef<THREE.InstancedMesh>(null);
  const flowers = useRef<THREE.InstancedMesh>(null);
  const plants = useMemo(() => {
    const rng = mulberry32(5150);
    const out: Array<{ x: number; z: number; s: number }> = [];
    const spacing = q.tier === 'low' ? 0.75 : 0.55;
    for (const b of STRAWBERRY_GARDEN.beds) {
      for (let x = b.minX + 0.35; x < b.maxX - 0.2; x += spacing) {
        for (let z = b.minZ + 0.3; z < b.maxZ - 0.15; z += spacing) {
          out.push({ x: x + (rng() - 0.5) * 0.12, z: z + (rng() - 0.5) * 0.12, s: 0.8 + rng() * 0.35 });
        }
      }
    }
    return out;
  }, [q.tier]);
  const LEAVES_PER = 4;
  const BERRIES_PER = 2;

  useLayoutEffect(() => {
    const rng = mulberry32(77);
    let li = 0;
    let bi = 0;
    let fi = 0;
    for (const p of plants) {
      for (let k = 0; k < LEAVES_PER; k++) {
        const a = (k / LEAVES_PER) * Math.PI * 2 + rng();
        o.position.set(p.x + Math.cos(a) * 0.1, 0.36, p.z + Math.sin(a) * 0.1);
        o.rotation.set(-0.5, a, 0);
        o.scale.set(0.13 * p.s, 0.03, 0.09 * p.s);
        o.updateMatrix();
        leaves.current!.setMatrixAt(li, o.matrix);
        leaves.current!.setColorAt(li, col.set(k % 2 ? '#6f9e5a' : '#7fae66'));
        li++;
      }
      for (let k = 0; k < BERRIES_PER; k++) {
        const a = rng() * Math.PI * 2;
        o.position.set(p.x + Math.cos(a) * 0.14, 0.3, p.z + Math.sin(a) * 0.14);
        o.rotation.set(Math.PI + (rng() - 0.5) * 0.6, a, 0);
        const s = 0.07 + rng() * 0.03;
        o.scale.set(s, s * 1.3, s);
        o.updateMatrix();
        berries.current!.setMatrixAt(bi, o.matrix);
        const ripe = rng() > 0.25;
        berries.current!.setColorAt(bi, col.set(ripe ? '#d94b55' : rng() > 0.5 ? '#f0a2a6' : '#c7d9a0'));
        bi++;
      }
      o.position.set(p.x, 0.42, p.z);
      o.rotation.set(0, 0, 0);
      o.scale.setScalar(0.035);
      o.updateMatrix();
      flowers.current!.setMatrixAt(fi, o.matrix);
      fi++;
    }
    for (const m of [leaves.current!, berries.current!, flowers.current!]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.computeBoundingSphere();
    }
  }, [plants]);

  return (
    <group>
      <instancedMesh ref={leaves} args={[undefined, undefined, plants.length * LEAVES_PER]} castShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={berries} args={[STRAWBERRY_GEO, undefined, plants.length * BERRIES_PER]}>
        <meshStandardMaterial roughness={0.45} />
      </instancedMesh>
      <instancedMesh ref={flowers} args={[undefined, undefined, plants.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#fffaf2" roughness={0.6} />
      </instancedMesh>
    </group>
  );
}

/** One of the five ripe strawberries. Hops into her basket when picked. */
function RipeStrawberry({ id, x, z }: { id: string; x: number; z: number }) {
  const picked = useGameStore((s) => s.collected[`berry:${id}`] !== undefined);
  const reduced = useSettings((s) => s.reducedMotion);
  const ref = useRef<THREE.Group>(null);
  const pickedAtMount = useRef(picked);
  const popStart = useRef<number | null>(null);
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = runtime.time;
    if (!picked) {
      g.visible = true;
      g.position.y = 0.48 + Math.sin(t * 2.2 + x) * 0.03;
      g.rotation.y = t * 0.8 + x;
      g.scale.setScalar(1);
      return;
    }
    if (pickedAtMount.current || reduced) {
      g.visible = false;
      return;
    }
    // Small collection animation: hop up, spin, shrink away.
    popStart.current ??= t;
    const k = Math.min(1, (t - popStart.current) / 0.7);
    g.position.y = 0.48 + Math.sin(k * Math.PI) * 0.7 + k * 0.4;
    g.rotation.y += 0.3;
    g.scale.setScalar(Math.max(0.001, 1.2 * (1 - k)));
    g.visible = k < 1;
  });
  return (
    <group position={[x, 0, z]}>
      <group ref={ref} userData={{ noBatch: true }}>
        <StrawberryModel scale={2.1} />
      </group>
      {!picked && <Glow position={[0, 0.55, 0]} size={0.9} color="#ffd0d4" opacity={0.75} />}
    </group>
  );
}

function PicnicBasket() {
  const picked = useGameStore((s) => STRAWBERRY_SPOTS.filter((sp) => s.collected[`berry:${sp.id}`] !== undefined).length);
  const wicker = mat('#b98a62', { rough: 0.9 });
  return (
    <group position={[STRAWBERRY_GARDEN.blanket.x, 0.18, STRAWBERRY_GARDEN.blanket.z]}>
      <mesh material={wicker} position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.2, 0.24, 14]} />
      </mesh>
      <mesh material={wicker} position={[0, 0.3, 0]} rotation={[0, 0, 0]}>
        <torusGeometry args={[0.22, 0.02, 6, 18, Math.PI]} />
      </mesh>
      <mesh material={mat(PALETTE.ivoryWarm, { rough: 0.9 })} position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.24, 0.24, 0.02, 14]} />
      </mesh>
      {Array.from({ length: picked }, (_, i) => {
        const a = (i / Math.max(1, picked)) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * 0.1, 0.3, Math.sin(a) * 0.1]} rotation={[Math.PI, a, 0.2]}>
            <StrawberryModel scale={1.2} />
          </group>
        );
      })}
    </group>
  );
}

export function StrawberryGardenScene() {
  const g = STRAWBERRY_GARDEN.gazebo;
  const ivory = mat(PALETTE.ivoryWarm, { rough: 0.5 });
  const sage = mat(PALETTE.sage, { rough: 0.6 });
  const sageSoft = mat(PALETTE.sageSoft, { rough: 0.7 });
  const frame = mat('#8a9b6e', { rough: 0.75 });
  const soil = mat('#7a5a42', { rough: 1 });

  const flowers = useMemo(() => {
    const rng = mulberry32(2024);
    const out: FlowerInstance[] = [];
    const colors = ['#fffaf2', '#F3D6D8', '#CCD5AE', '#ffffff', '#f7c4d2'];
    const a = STRAWBERRY_GARDEN.area;
    for (let i = 0; i < 140; i++) {
      const x = a.minX + 0.6 + rng() * (a.maxX - a.minX - 1.2);
      const z = a.minZ + 0.6 + rng() * (a.maxZ - a.minZ - 1.2);
      const inBed = STRAWBERRY_GARDEN.beds.some((b) => x > b.minX - 0.6 && x < b.maxX + 0.6 && z > b.minZ - 0.6 && z < b.maxZ + 0.6);
      const inGazebo = Math.hypot(x - g.x, z - g.z) < g.r + 0.8;
      const onPath = x > 46.5 && x < 49 && z > -15 && z < -10;
      if (inBed || inGazebo || onPath) continue;
      out.push({ x, z, color: colors[Math.floor(rng() * colors.length)], scale: 0.8 + rng() * 0.5, kind: rng() < 0.35 ? 'cluster' : 'round' });
    }
    return out;
  }, [g.x, g.z, g.r]);

  // Bunting flags around the gazebo roof edge (white & sage), skipping the entrance.
  const bunting = useMemo(() => {
    const out: Array<{ x: number; z: number; rot: number; c: number }> = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.45) continue;
      out.push({ x: g.x + Math.cos(a) * (g.r + 0.05), z: g.z + Math.sin(a) * (g.r + 0.05), rot: -a + Math.PI / 2, c: i % 2 });
    }
    return out;
  }, [g.x, g.z, g.r]);

  return (
    <Proximity x={g.x - 3} z={g.z} radius={75}>
      <StaticBatch>
        {/* Raised beds: soil inside sage-painted frames */}
        {STRAWBERRY_GARDEN.beds.map((b, i) => {
          const w = b.maxX - b.minX;
          const d = b.maxZ - b.minZ;
          const cx = (b.minX + b.maxX) / 2;
          const cz = (b.minZ + b.maxZ) / 2;
          return (
            <group key={i}>
              <mesh material={frame} position={[cx, 0.15, cz]} castShadow receiveShadow>
                <boxGeometry args={[w, 0.3, d]} />
              </mesh>
              <mesh material={soil} position={[cx, 0.305, cz]}>
                <boxGeometry args={[w - 0.14, 0.02, d - 0.14]} />
              </mesh>
            </group>
          );
        })}
        {/* Gazebo floor */}
        <mesh material={ivory} position={[g.x, 0.08, g.z]} receiveShadow>
          <cylinderGeometry args={[g.r + 0.35, g.r + 0.45, 0.16, 8]} />
        </mesh>
        <mesh material={goldMat()} position={[g.x, 0.17, g.z]} rotation={[-Math.PI / 2, 0, Math.PI / 8]}>
          <ringGeometry args={[g.r + 0.1, g.r + 0.22, 8]} />
        </mesh>
        {/* Posts with gold caps */}
        {GAZEBO_POSTS.map((p, i) => (
          <group key={i} position={[p.x, 0, p.z]}>
            <mesh material={ivory} position={[0, 1.4, 0]} castShadow>
              <cylinderGeometry args={[0.1, 0.13, 2.8, 10]} />
            </mesh>
            <mesh material={sageSoft} position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.15, 0.15, 0.1, 10]} />
            </mesh>
            <mesh material={goldMat()} position={[0, 2.82, 0]}>
              <sphereGeometry args={[0.13, 10, 8]} />
            </mesh>
          </group>
        ))}
        {/* Sage railings between posts (west side open) */}
        {GAZEBO_POSTS.map((p, i) => {
          const nxt = GAZEBO_POSTS[(i + 1) % GAZEBO_POSTS.length];
          if (i === 3) return null; // entrance
          const mx = (p.x + nxt.x) / 2;
          const mz = (p.z + nxt.z) / 2;
          const len = Math.hypot(nxt.x - p.x, nxt.z - p.z);
          const rot = -Math.atan2(nxt.z - p.z, nxt.x - p.x);
          return (
            <group key={`r${i}`} position={[mx, 0, mz]} rotation={[0, rot, 0]}>
              <mesh material={sage} position={[0, 0.85, 0]}>
                <boxGeometry args={[len, 0.07, 0.07]} />
              </mesh>
              <mesh material={sage} position={[0, 0.45, 0]}>
                <boxGeometry args={[len, 0.05, 0.05]} />
              </mesh>
              {[-0.25, 0, 0.25].map((t) => (
                <mesh key={t} material={ivory} position={[t * len, 0.62, 0]}>
                  <boxGeometry args={[0.04, 0.42, 0.04]} />
                </mesh>
              ))}
            </group>
          );
        })}
        {/* Roof: sage dome with a soft-sage band and a gold finial */}
        <mesh material={sage} position={[g.x, 3.55, g.z]} rotation={[0, Math.PI / 8, 0]} castShadow>
          <coneGeometry args={[g.r + 0.55, 1.5, 8]} />
        </mesh>
        <mesh material={sageSoft} position={[g.x, 2.88, g.z]} rotation={[0, Math.PI / 8, 0]}>
          <cylinderGeometry args={[g.r + 0.55, g.r + 0.55, 0.16, 8]} />
        </mesh>
        <mesh material={goldMat()} position={[g.x, 4.45, g.z]}>
          <sphereGeometry args={[0.16, 10, 8]} />
        </mesh>
        <mesh material={goldMat()} position={[g.x, 4.7, g.z]}>
          <coneGeometry args={[0.07, 0.3, 8]} />
        </mesh>
        {bunting.map((b, i) => (
          <mesh key={i} material={b.c ? sage : ivory} position={[b.x, 2.66, b.z]} rotation={[0, b.rot, Math.PI]}>
            <coneGeometry args={[0.09, 0.22, 3]} />
          </mesh>
        ))}
        {/* Picnic: ivory blanket with sage stripes, cushions, plates, little white flowers */}
        <mesh material={mat(PALETTE.ivoryWarm, { rough: 0.95 })} position={[STRAWBERRY_GARDEN.blanket.x, 0.17, STRAWBERRY_GARDEN.blanket.z]} receiveShadow>
          <boxGeometry args={[2.1, 0.02, 1.7]} />
        </mesh>
        {[-0.6, 0, 0.6].map((dz) => (
          <mesh key={dz} material={sageSoft} position={[STRAWBERRY_GARDEN.blanket.x, 0.183, STRAWBERRY_GARDEN.blanket.z + dz]}>
            <boxGeometry args={[2.1, 0.005, 0.12]} />
          </mesh>
        ))}
        {[
          [STRAWBERRY_GARDEN.princessSeat.x, STRAWBERRY_GARDEN.princessSeat.z],
          [52.1, -14.05],
        ].map(([x, z], i) => (
          <mesh key={i} material={sage} position={[x, 0.24, z]} scale={[1, 0.4, 1]} castShadow>
            <sphereGeometry args={[0.3, 12, 8]} />
          </mesh>
        ))}
        {[
          [51.6, -14.9],
          [51.0, -14.1],
        ].map(([x, z], i) => (
          <mesh key={`p${i}`} material={mat('#ffffff', { rough: 0.3 })} position={[x, 0.19, z]}>
            <cylinderGeometry args={[0.16, 0.13, 0.025, 16]} />
          </mesh>
        ))}
        <mesh material={mat('#e6f0ff', { rough: 0.1, metal: 0.2 })} position={[51.9, 0.28, -14.95]}>
          <cylinderGeometry args={[0.05, 0.04, 0.2, 10]} />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={`f${i}`} material={mat('#ffffff', { rough: 0.6 })} position={[51.9 + Math.cos(i * 1.6) * 0.05, 0.42, -14.95 + Math.sin(i * 1.6) * 0.05]}>
            <icosahedronGeometry args={[0.04, 0]} />
          </mesh>
        ))}
        <LampPost x={47.2} z={-9.6} />
        <LampPost x={47.4} z={-19.5} />
      </StaticBatch>
      <StrawberryBeds />
      <PicnicBasket />
      {STRAWBERRY_SPOTS.map((sp) => (
        <RipeStrawberry key={sp.id} id={sp.id} x={sp.berry.x} z={sp.berry.z} />
      ))}
      <FlowerField flowers={flowers} />
    </Proximity>
  );
}
