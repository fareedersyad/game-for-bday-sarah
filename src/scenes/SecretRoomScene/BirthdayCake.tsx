import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { gameConfig } from '../../config/gameConfig';
import { glowTexture, goldMat, heartShape, mat, PALETTE } from '../../components/game/materials';
import { useQuality } from '../../components/game/quality';
import { StaticBatch } from '../../components/game/StaticBatch';
import { useGameStore } from '../../stores/gameStore';
import { useSettings } from '../../stores/settingsStore';
import { runtime } from '../../systems/runtime';
import { StrawberryModel } from '../StrawberryGardenScene/StrawberryGardenScene';

const CAKE_POS = { x: -18.3, z: 3.3 };
const TABLE_H = 0.8;

interface Tier {
  geo: THREE.ExtrudeGeometry;
  outline: Array<[number, number]>;
  height: number;
}

/** Extruded heart tier, lying flat, centred on the origin, bottom at y=0. */
function makeTier(scale: number, height: number): Tier {
  const shape = heartShape(scale);
  const pts = shape.getSpacedPoints(56);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 18 });
  // Lay it flat: shape (x, y) → world (x, -y), extrusion → +y.
  geo.rotateX(-Math.PI / 2);
  geo.translate(-cx, 0, cy);
  geo.computeVertexNormals();
  return { geo, outline: pts.map((p) => [p.x - cx, -(p.y - cy)] as [number, number]), height };
}

function Piping({ outline, y, color, every = 2, size = 0.024 }: { outline: Array<[number, number]>; y: number; color: string; every?: number; size?: number }) {
  return (
    <group>
      {outline
        .filter((_, i) => i % every === 0)
        .map(([x, z], i) => (
          <mesh key={i} material={mat(color, { rough: 0.6 })} position={[x * 1.02, y, z * 1.02]}>
            <sphereGeometry args={[size, 6, 5]} />
          </mesh>
        ))}
    </group>
  );
}

/** Candle with a flame that flickers, then fades out when the candles are blown. */
function Candle({ x, z, color, index }: { x: number; z: number; color: string; index: number }) {
  const flame = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const smoke = useRef<THREE.Sprite>(null);
  const reduced = useSettings((s) => s.reducedMotion);
  const smokeMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTexture(), color: '#d9d6d0', transparent: true, opacity: 0, depthWrite: false }), []);
  useFrame(() => {
    const out = runtime.anim.candlesOut;
    const lit = 1 - out;
    const flicker = reduced ? 1 : 0.88 + Math.sin(runtime.time * 11 + index * 1.7) * 0.08 + Math.sin(runtime.time * 23 + index) * 0.05;
    if (flame.current) {
      flame.current.scale.set(lit, Math.max(0.001, lit * flicker), lit);
      flame.current.visible = lit > 0.02;
    }
    if (light.current) light.current.intensity = index === 0 ? 2.2 * lit * flicker : 0;
    // A wisp of smoke as each flame goes out (skipped with reduced motion).
    if (smoke.current) {
      const s = !reduced && out > 0.05 && out < 0.995 ? Math.sin(out * Math.PI) : 0;
      smokeMat.opacity = s * 0.55;
      smoke.current.position.y = 0.17 + out * 0.35;
      smoke.current.scale.setScalar(0.08 + out * 0.16);
    }
  });
  return (
    <group position={[x, 0, z]}>
      <mesh material={mat(color, { rough: 0.6 })} position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
      </mesh>
      <mesh material={goldMat()} position={[0, 0.06, 0]}>
        <torusGeometry args={[0.0125, 0.003, 4, 10]} />
      </mesh>
      <mesh ref={flame} material={mat('#ffd37a', { emissive: '#ffb347', emissiveIntensity: 2.6 })} position={[0, 0.145, 0]}>
        <coneGeometry args={[0.011, 0.04, 8]} />
      </mesh>
      {index === 0 && <pointLight ref={light} color="#ffbe6b" intensity={2} distance={3} decay={1.8} position={[0, 0.25, 0]} />}
      <sprite ref={smoke} material={smokeMat} position={[0, 0.2, 0]} />
    </group>
  );
}

/** Glass cloche that lifts away during Prince Fareed's reveal. */
function Cloche() {
  const ref = useRef<THREE.Mesh>(null);
  const m = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f4fbff', transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.1, depthWrite: false }), []);
  useFrame(() => {
    const r = runtime.anim.cakeReveal;
    if (!ref.current) return;
    ref.current.position.y = 0.04 + r * 1.4;
    m.opacity = 0.28 * (1 - r);
    ref.current.visible = r < 0.98;
  });
  return (
    <mesh ref={ref} material={m} userData={{ noBatch: true }}>
      <sphereGeometry args={[0.55, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
    </mesh>
  );
}

export function BirthdayCake() {
  const visible = useGameStore((s) => !!s.flags.secretUnlocked);
  const q = useQuality();
  const tiers = useMemo(() => [makeTier(0.78, 0.17), makeTier(0.52, 0.13)], []);
  const candles = Math.max(1, Math.min(12, Math.round(gameConfig.BIRTHDAY_CAKE.candles)));
  if (!visible) return null;
  const [t1, t2] = tiers;
  const frosting = mat(PALETTE.ivoryWarm, { rough: 0.55 });
  const frosting2 = mat('#fffdf8', { rough: 0.5 });
  const top1 = t1.height + 0.02;
  const top2 = top1 + t2.height + 0.02;
  const candlePalette = [PALETTE.sageSoft, PALETTE.softPink, PALETTE.ivoryWarm];
  return (
    <group position={[CAKE_POS.x, 0, CAKE_POS.z]}>
      <StaticBatch>
        {/* Elegant birthday table: ivory cloth, sage runner, gold trim */}
        <mesh material={mat(PALETTE.ivoryWarm, { rough: 0.9 })} position={[0, TABLE_H / 2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.92, 1.0, TABLE_H, 28]} />
        </mesh>
        <mesh material={goldMat()} position={[0, TABLE_H + 0.005, 0]}>
          <torusGeometry args={[0.92, 0.015, 6, 40]} />
        </mesh>
        <mesh material={mat(PALETTE.sage, { rough: 0.8 })} position={[0, TABLE_H + 0.006, 0]} rotation={[0, 0.5, 0]}>
          <boxGeometry args={[1.95, 0.012, 0.34]} />
        </mesh>
        {/* Little flowers & rose petals scattered on the table */}
        {Array.from({ length: q.tier === 'low' ? 6 : 12 }, (_, i) => {
          const a = (i / (q.tier === 'low' ? 6 : 12)) * Math.PI * 2 + 0.3;
          return (
            <mesh key={i} material={mat(i % 3 === 0 ? PALETTE.softPink : i % 3 === 1 ? '#ffffff' : PALETTE.sageSoft, { rough: 0.6 })} position={[Math.cos(a) * 0.72, TABLE_H + 0.03, Math.sin(a) * 0.72]}>
              <icosahedronGeometry args={[0.035, 0]} />
            </mesh>
          );
        })}
        <group position={[0, TABLE_H, 0]} rotation={[0, Math.PI / 2, 0]}>
          {/* Gold cake board */}
          <mesh material={goldMat()} position={[0, 0.012, 0]}>
            <cylinderGeometry args={[0.6, 0.62, 0.024, 36]} />
          </mesh>
          <group position={[0, 0.024, 0]}>
            {/* Tier 1 & 2: heart-shaped, ivory frosting */}
            <mesh geometry={t1.geo} material={frosting} castShadow receiveShadow />
            <group position={[0, top1, 0]}>
              <mesh geometry={t2.geo} material={frosting2} castShadow />
            </group>
            {/* Sage piping along the edges */}
            <Piping outline={t1.outline} y={0.02} color={PALETTE.sage} every={q.tier === 'low' ? 3 : 2} />
            <Piping outline={t1.outline} y={top1} color={PALETTE.sage} every={q.tier === 'low' ? 3 : 2} size={0.02} />
            <Piping outline={t2.outline} y={top2} color={PALETTE.sageDeep} every={2} size={0.017} />
            {/* Gold pearls on the lower tier */}
            {t1.outline
              .filter((_, i) => i % 7 === 0)
              .map(([x, z], i) => (
                <mesh key={i} material={goldMat()} position={[x * 1.03, t1.height * 0.55, z * 1.03]}>
                  <sphereGeometry args={[0.012, 6, 5]} />
                </mesh>
              ))}
            {/* Fresh strawberries around the lower tier's top edge */}
            {t1.outline
              .filter((_, i) => i % 8 === 4)
              .map(([x, z], i) => (
                <group key={`s${i}`} position={[x * 0.86, top1 + 0.045, z * 0.86]} rotation={[0.25, i, 0]}>
                  <StrawberryModel scale={0.85} />
                </group>
              ))}
            {/* Strawberries crowning the top tier + tiny sage leaves */}
            {[
              [0, 0.02],
              [0.07, -0.08],
              [-0.07, -0.08],
            ].map(([x, z], i) => (
              <group key={`t${i}`} position={[x, top2 + 0.05, z]} rotation={[0.2, i * 2, 0]}>
                <StrawberryModel scale={0.9} />
              </group>
            ))}
            {[0, 1, 2, 3].map((i) => (
              <mesh key={`l${i}`} material={mat(PALETTE.sage, { rough: 0.7 })} position={[Math.cos(i * 1.57) * 0.11, top2 + 0.012, -0.03 + Math.sin(i * 1.57) * 0.11]} rotation={[-Math.PI / 2, 0, i]} scale={[1, 0.5, 1]}>
                <circleGeometry args={[0.03, 5]} />
              </mesh>
            ))}
            {/* Delicate floral details */}
            {[-0.16, 0.16].map((x) => (
              <mesh key={x} material={mat(PALETTE.softPink, { rough: 0.6 })} position={[x, top1 + 0.025, 0.2]}>
                <icosahedronGeometry args={[0.026, 0]} />
              </mesh>
            ))}
          </group>
        </group>
      </StaticBatch>
      {/* Candles (flames animate, so they are not batched) */}
      <group position={[0, TABLE_H + 0.024 + top2, 0]} rotation={[0, Math.PI / 2, 0]} userData={{ noBatch: true }}>
        {Array.from({ length: candles }, (_, i) => {
          const a = Math.PI * 0.15 + (i / Math.max(1, candles - 1)) * Math.PI * 0.7;
          const r = candles === 1 ? 0 : 0.14;
          return <Candle key={i} index={i} x={Math.cos(a) * r} z={0.08 - Math.sin(a) * r * 0.9} color={candlePalette[i % candlePalette.length]} />;
        })}
      </group>
      <group position={[0, TABLE_H, 0]}>
        <Cloche />
      </group>
    </group>
  );
}

/**
 * Fireworks seen through the Secret Room window after the candles are blown:
 * small additive bursts confined to the window pane.
 */
export function WindowFireworks() {
  const q = useQuality();
  const MAX = q.tier === 'low' ? 160 : 320;
  const sim = useMemo(() => {
    const pos = new Float32Array(MAX * 3);
    const vel = new Float32Array(MAX * 2);
    const col = new Float32Array(MAX * 3);
    const life = new Float32Array(MAX);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    return { pos, vel, col, life, g, cursor: 0, timer: 0 };
  }, [MAX]);
  const material = useMemo(() => new THREE.PointsMaterial({ map: glowTexture(), size: 0.17, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  const c = useMemo(() => new THREE.Color(), []);
  const palette = ['#ff8fb4', '#ffd27a', '#CCD5AE', '#ffffff', '#D94B55'];
  // Window pane on the west wall: x≈-19.95, z∈[-0.8, 1.8], y∈[1.8, 5.0].
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    if (runtime.anim.windowFireworks) {
      sim.timer -= dt;
      if (sim.timer <= 0) {
        sim.timer = 0.45 + Math.random() * 0.5;
        const cz = -0.3 + Math.random() * 1.6;
        const cy = 3.4 + Math.random() * 1.1;
        c.set(palette[Math.floor(Math.random() * palette.length)]);
        const n = Math.round(MAX / 6);
        for (let k = 0; k < n; k++) {
          const i = sim.cursor;
          sim.cursor = (sim.cursor + 1) % MAX;
          const a = (k / n) * Math.PI * 2;
          const sp = 0.5 + Math.random() * 0.3;
          sim.pos[i * 3] = -19.88;
          sim.pos[i * 3 + 1] = cy;
          sim.pos[i * 3 + 2] = cz;
          sim.vel[i * 2] = Math.cos(a) * sp;
          sim.vel[i * 2 + 1] = Math.sin(a) * sp;
          sim.life[i] = 1.2 + Math.random() * 0.4;
          sim.col[i * 3] = c.r;
          sim.col[i * 3 + 1] = c.g;
          sim.col[i * 3 + 2] = c.b;
        }
      }
    }
    for (let i = 0; i < MAX; i++) {
      if (sim.life[i] <= 0) {
        sim.pos[i * 3 + 1] = -50;
        continue;
      }
      sim.life[i] -= dt;
      sim.vel[i * 2 + 1] -= dt * 0.25;
      sim.pos[i * 3 + 2] += sim.vel[i * 2] * dt;
      sim.pos[i * 3 + 1] += sim.vel[i * 2 + 1] * dt;
      // Stay inside the pane.
      const z = sim.pos[i * 3 + 2];
      const y = sim.pos[i * 3 + 1];
      if (z < -0.75 || z > 1.75 || y < 1.85 || y > 4.95) sim.life[i] = 0;
      const fade = Math.max(0, Math.min(1, sim.life[i]));
      sim.col[i * 3] *= 0.985 + fade * 0.015;
      sim.col[i * 3 + 1] *= 0.985 + fade * 0.015;
      sim.col[i * 3 + 2] *= 0.985 + fade * 0.015;
    }
    sim.g.attributes.position.needsUpdate = true;
    sim.g.attributes.color.needsUpdate = true;
  });
  return <points geometry={sim.g} material={material} frustumCulled={false} userData={{ noBatch: true }} />;
}
