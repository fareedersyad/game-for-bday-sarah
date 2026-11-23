import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { goldMat, mat, PALETTE, roseGoldMat } from '../../components/game/materials';
import { FlowerField, type FlowerInstance } from '../../components/game/Vegetation';
import { useGameStore } from '../../stores/gameStore';
import { runtime } from '../../systems/runtime';
import { FLOWER_SPOTS, LANDMARKS, PLANT_PLOTS } from '../../systems/WorldManager/worldLayout';
import { mulberry32 } from '../../utils/rng';
import { StaticBatch } from '../../components/game/StaticBatch';
import { Bench, Floating, Fountain, Glow, LampPost, Proximity } from '../common';

const BEDS: Array<{ x0: number; z0: number; x1: number; z1: number; kind: FlowerInstance['kind']; colors: string[]; n: number }> = [
  { x0: 27.5, z0: 1.5, x1: 31.5, z1: 6, kind: 'round', colors: ['#f19bb4', '#f7b6c8', '#e8899e'], n: 50 }, // pink roses
  { x0: 29, z0: 11.5, x1: 33, z1: 15.5, kind: 'round', colors: ['#fffaf4', '#fff1ec', '#f9ece4'], n: 45 }, // white roses
  { x0: 32, z0: -5.5, x1: 41.5, z1: -2.5, kind: 'cup', colors: ['#f6c1d2', '#fff4f0', '#f3a9bb', '#e6dcf5'], n: 70 }, // tulips
  { x0: 43.5, z0: 6, x1: 48.5, z1: 15, kind: 'sun', colors: ['#f5c542', '#f7d36a'], n: 34 }, // sunflowers
  { x0: 33, z0: 16, x1: 40, z1: 19.5, kind: 'cluster', colors: ['#a9b8ee', '#c9b6ec', '#b9c8f4', '#e6c6ea'], n: 40 }, // hydrangeas
  { x0: 38.5, z0: 10.5, x1: 41.5, z1: 13.5, kind: 'round', colors: ['#f19bb4', '#ffd6e0'], n: 24 },
];

const PICK_COLORS: Record<string, string> = {
  pinkRose: '#ef8fac',
  whiteRose: '#fffaf4',
  tulip: '#f6b4c8',
  sunflower: '#f5c542',
  hydrangea: '#a9b8ee',
  cherryBlossom: '#f9c8d8',
};

function PickableFlower({ id, x, z, type }: { id: string; x: number; z: number; type: string }) {
  const collected = useGameStore((s) => s.collected[`flower:${id}`] !== undefined);
  if (collected) return null;
  const color = PICK_COLORS[type] ?? '#f19bb4';
  const petal = mat(color, { emissive: color, emissiveIntensity: 0.35, rough: 0.5 });
  return (
    <group position={[x, 0, z]}>
      <mesh material={mat('#6fa75c')} position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.02, 0.025, 0.7, 5]} />
      </mesh>
      <Floating amp={0.03} speed={2} spin={0.6} offset={x}>
        <group position={[0, 0.78, 0]}>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} material={petal} position={[Math.cos((i / 6) * Math.PI * 2) * 0.1, 0, Math.sin((i / 6) * Math.PI * 2) * 0.1]} scale={[0.09, 0.04, 0.06]}>
              <sphereGeometry args={[1, 8, 6]} />
            </mesh>
          ))}
          <mesh material={mat(type === 'sunflower' ? '#6b4a2b' : '#fff1b8')}>
            <sphereGeometry args={[0.055, 8, 6]} />
          </mesh>
        </group>
      </Floating>
      <Glow position={[0, 0.8, 0]} size={1} color="#ffe9f0" opacity={0.7} />
    </group>
  );
}

function Plot({ id, x, z }: { id: string; x: number; z: number }) {
  const sprout = useRef<THREE.Group>(null);
  const bloom = useRef<THREE.Group>(null);
  useFrame(() => {
    const st = runtime.anim.plots[id] ?? { growth: 0, bloom: 0 };
    if (sprout.current) {
      sprout.current.scale.setScalar(Math.max(0.001, st.growth));
      sprout.current.visible = st.growth > 0.01;
    }
    if (bloom.current) {
      bloom.current.scale.setScalar(Math.max(0.001, st.bloom * 1.2));
      bloom.current.visible = st.bloom > 0.01;
      bloom.current.rotation.y = runtime.time * 0.4;
    }
  });
  return (
    <group position={[x, 0, z]} userData={{ noBatch: true }}>
      <mesh material={mat('#7d5a40', { rough: 1 })} position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[0.75, 0.85, 0.12, 18]} />
      </mesh>
      <mesh material={mat('#5c4030', { rough: 1 })} position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.62, 0.62, 0.02, 18]} />
      </mesh>
      <group ref={sprout} position={[0, 0.13, 0]}>
        <mesh material={mat('#79b765')} position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.025, 0.03, 0.5, 5]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={mat('#8fcc77')} position={[s * 0.1, 0.3, 0]} rotation={[0, 0, s * 0.8]} scale={[0.12, 0.05, 0.07]}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        ))}
      </group>
      <group ref={bloom} position={[0, 0.7, 0]}>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} material={mat('#f7a9c0', { emissive: '#ffb3c9', emissiveIntensity: 0.5 })} position={[Math.cos((i / 8) * Math.PI * 2) * 0.16, 0, Math.sin((i / 8) * Math.PI * 2) * 0.16]} rotation={[0.4, (i / 8) * Math.PI * 2, 0]} scale={[0.12, 0.05, 0.08]}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        ))}
        <mesh material={mat('#ffe58a', { emissive: '#ffd56a', emissiveIntensity: 0.8 })}>
          <sphereGeometry args={[0.08, 10, 8]} />
        </mesh>
      </group>
    </group>
  );
}

function HiddenNote({ id, x, y, z }: { id: string; x: number; y: number; z: number }) {
  const found = useGameStore((s) => s.collected[`note:${id}`] !== undefined);
  const glint = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (glint.current) (glint.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + Math.max(0, Math.sin(runtime.time * 2.5 + x)) * 1.2;
  });
  if (found) return null;
  return (
    <group position={[x, y, z]} rotation={[0, x, 0.3]}>
      <mesh ref={glint} material={new THREE.MeshStandardMaterial({ color: '#fff6e6', emissive: '#ffe3a3', emissiveIntensity: 0.5, roughness: 0.7 })}>
        <cylinderGeometry args={[0.04, 0.04, 0.26, 8]} />
      </mesh>
      <mesh material={mat(PALETTE.rose)} position={[0, 0, 0]}>
        <torusGeometry args={[0.045, 0.01, 4, 10]} />
      </mesh>
    </group>
  );
}

export function GardenScene() {
  const hasCan = useGameStore((s) => !!s.flags.hasWateringCan);
  const hasSeeds = useGameStore((s) => !!s.flags.hasSeeds);
  const beds = useMemo(() => {
    const rng = mulberry32(1234);
    const out: FlowerInstance[] = [];
    for (const b of BEDS) {
      for (let i = 0; i < b.n; i++) {
        out.push({
          x: b.x0 + rng() * (b.x1 - b.x0),
          z: b.z0 + rng() * (b.z1 - b.z0),
          y: 0.18,
          color: b.colors[Math.floor(rng() * b.colors.length)],
          kind: b.kind,
          scale: (b.kind === 'sun' ? 1.5 : 1.1) + rng() * 0.4,
        });
      }
    }
    return out;
  }, []);
  const soil = mat('#9a7359', { rough: 1 });
  const blossomTrunks: Array<[number, number]> = [
    [30, -3],
    [45, -2],
    [49.5, 9],
    [29.5, 17.5],
    [51, 18],
  ];
  const fallen = useMemo(() => {
    const rng = mulberry32(55);
    const pts: Array<[number, number, number]> = [];
    for (const [tx, tz] of blossomTrunks) for (let i = 0; i < 18; i++) pts.push([tx + (rng() - 0.5) * 4, tz + (rng() - 0.5) * 4, rng() * 6]);
    return pts;
  }, []);
  const a = LANDMARKS.gardenArch;
  return (
    <Proximity x={36} z={6} radius={90}>
      <StaticBatch>
      {/* Raised flower beds */}
      {BEDS.map((b, i) => (
        <mesh key={i} material={soil} position={[(b.x0 + b.x1) / 2, 0.09, (b.z0 + b.z1) / 2]} receiveShadow>
          <boxGeometry args={[b.x1 - b.x0 + 0.4, 0.18, b.z1 - b.z0 + 0.4]} />
        </mesh>
      ))}
      <FlowerField flowers={beds} />
      {/* Cherry blossom trees */}
      {blossomTrunks.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh material={mat('#8a6450', { rough: 0.9 })} position={[0, 1.3, 0]} rotation={[0, 0, 0.08]} castShadow>
            <cylinderGeometry args={[0.18, 0.32, 2.6, 8]} />
          </mesh>
          {[[0, 3.2, 0, 1.7], [0.9, 2.8, 0.4, 1.2], [-0.8, 2.9, -0.3, 1.25], [0.2, 3.6, -0.8, 1.0]].map(([dx, y, dz, s], i) => (
            <mesh key={i} material={mat(i % 2 ? '#f9c8d8' : '#f6b4c8', { rough: 0.85, flat: true })} position={[dx, y, dz]} scale={s} castShadow>
              <icosahedronGeometry args={[1, 1]} />
            </mesh>
          ))}
        </group>
      ))}
      {fallen.map(([x, z, r], i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, r]} position={[x, 0.03, z]}>
          <circleGeometry args={[0.08, 5]} />
          <meshStandardMaterial color="#f9c8d8" />
        </mesh>
      ))}
      <Fountain x={LANDMARKS.gardenFountain.x} z={LANDMARKS.gardenFountain.z} />
      {/* Flower arch */}
      <group position={[a.x, 0, a.z]} rotation={[0, Math.PI / 2, 0]}>
        {[-1.5, 1.5].map((x) => (
          <mesh key={x} material={roseGoldMat()} position={[x, 1.4, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 2.8, 8]} />
          </mesh>
        ))}
        <mesh material={roseGoldMat()} position={[0, 2.8, 0]}>
          <torusGeometry args={[1.5, 0.08, 8, 24, Math.PI]} />
        </mesh>
        {Array.from({ length: 26 }, (_, i) => {
          const t = i / 25;
          const ang = Math.PI * t;
          const x = Math.cos(ang) * 1.5;
          const y = 2.8 + Math.sin(ang) * 1.5;
          return (
            <mesh key={i} material={mat(i % 3 === 0 ? '#fffaf4' : i % 3 === 1 ? '#f19bb4' : '#7fb36c', { rough: 0.7 })} position={[x, y, (i % 2) * 0.12 - 0.06]}>
              <icosahedronGeometry args={[0.2, 0]} />
            </mesh>
          );
        })}
      </group>
      <Bench x={LANDMARKS.gardenBench.x} z={LANDMARKS.gardenBench.z} rot={Math.PI} color={PALETTE.sage} />
      {/* Garden shed */}
      <group position={[LANDMARKS.gardenShed.x, 0, LANDMARKS.gardenShed.z]}>
        <mesh material={mat('#f3e1cf', { rough: 0.8 })} position={[0, 1.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[4, 2.6, 4]} />
        </mesh>
        <mesh material={mat(PALETTE.sage, { rough: 0.7 })} position={[0, 3.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[3.2, 1.6, 4]} />
        </mesh>
        <mesh material={mat(PALETTE.wood)} position={[0, 1, 2.01]}>
          <planeGeometry args={[1.1, 2]} />
        </mesh>
      </group>
      <LampPost x={33} z={9} />
      <LampPost x={39} z={3} />
      </StaticBatch>
      {/* Seed basket */}
      <group position={[48.8, 0, -0.9]}>
        <mesh material={mat('#c79a6a', { rough: 0.9 })} position={[0, 0.25, 0]} castShadow>
          <cylinderGeometry args={[0.38, 0.3, 0.5, 14]} />
        </mesh>
        {!hasSeeds && (
          <>
            {Array.from({ length: 7 }, (_, i) => (
              <mesh key={i} material={mat('#f3dca4', { emissive: '#ffd27a', emissiveIntensity: 0.6 })} position={[Math.cos(i) * 0.18, 0.52, Math.sin(i) * 0.18]}>
                <sphereGeometry args={[0.05, 6, 5]} />
              </mesh>
            ))}
            <Glow position={[0, 0.7, 0]} size={1} color="#fff1b8" opacity={0.6} />
          </>
        )}
      </group>
      {/* Golden watering can */}
      {!hasCan && (
        <group position={[39.6, 0, 8.8]}>
          <Floating amp={0.04} speed={1.5}>
            <group position={[0, 0.35, 0]}>
              <mesh material={goldMat()} castShadow>
                <cylinderGeometry args={[0.2, 0.24, 0.4, 14]} />
              </mesh>
              <mesh material={goldMat()} position={[0.3, 0.05, 0]} rotation={[0, 0, -0.9]}>
                <cylinderGeometry args={[0.03, 0.05, 0.45, 8]} />
              </mesh>
              <mesh material={goldMat()} position={[-0.12, 0.25, 0]} rotation={[0, 0, Math.PI / 2]}>
                <torusGeometry args={[0.14, 0.025, 6, 12, Math.PI]} />
              </mesh>
            </group>
          </Floating>
          <Glow position={[0, 0.5, 0]} size={1.1} color="#ffe3a3" opacity={0.55} />
        </group>
      )}
      {PLANT_PLOTS.map((p) => (
        <Plot key={p.id} id={p.id} x={p.x} z={p.z} />
      ))}
      {FLOWER_SPOTS.map((f) => (
        <PickableFlower key={f.id} id={f.id} x={f.x} z={f.z} type={f.type} />
      ))}
      <HiddenNote id="note_bench" x={42} y={0.12} z={14.3} />
      <HiddenNote id="note_arch" x={26.3} y={1.2} z={11.6} />
      <HiddenNote id="note_tree" x={44.6} y={0.15} z={-1.1} />
    </Proximity>
  );
}
