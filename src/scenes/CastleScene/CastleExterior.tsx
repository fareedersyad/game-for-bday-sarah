import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { glowTexture, goldMat, mat, PALETTE, roseGoldMat } from '../../components/game/materials';
import { FlowerField, type FlowerInstance } from '../../components/game/Vegetation';
import { runtime } from '../../systems/runtime';
import { LANDMARKS } from '../../systems/WorldManager/worldLayout';
import { mulberry32 } from '../../utils/rng';
import { StaticBatch } from '../../components/game/StaticBatch';
import { Fountain, LampPost, Proximity } from '../common';

function Tower({ x, z, r = 2.4, h = 14, roof = PALETTE.sage }: { x: number; z: number; r?: number; h?: number; roof?: string }) {
  const wall = mat(PALETTE.ivory, { rough: 0.7 });
  const pink = mat(PALETTE.sageSoft, { rough: 0.65 });
  const win = mat('#dff1ff', { emissive: '#fff0d2', emissiveIntensity: 0.6, rough: 0.1, metal: 0.3 });
  return (
    <group position={[x, 0, z]}>
      <mesh material={wall} position={[0, h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r * 1.06, h, 24]} />
      </mesh>
      {[0.3, 0.62].map((t) => (
        <mesh key={t} material={pink} position={[0, h * t, 0]}>
          <cylinderGeometry args={[r * 1.04, r * 1.04, 0.35, 24]} />
        </mesh>
      ))}
      <mesh material={goldMat()} position={[0, h + 0.1, 0]}>
        <cylinderGeometry args={[r * 1.15, r * 1.15, 0.25, 24]} />
      </mesh>
      <mesh material={mat(roof, { rough: 0.6 })} position={[0, h + 2.6, 0]} castShadow>
        <coneGeometry args={[r * 1.25, 5, 24]} />
      </mesh>
      <mesh material={goldMat()} position={[0, h + 5.4, 0]}>
        <sphereGeometry args={[0.22, 10, 8]} />
      </mesh>
      {Array.from({ length: 4 }, (_, i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} material={win} position={[Math.sin(a) * r * 1.01, h * 0.78, Math.cos(a) * r * 1.01]} rotation={[0, a, 0]}>
            <planeGeometry args={[0.7, 1.3]} />
          </mesh>
        );
      })}
    </group>
  );
}

function GateDoors() {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const glow = useRef<THREE.Sprite>(null);
  const glowMat = useMemo(() => new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffe3a3', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  useFrame(() => {
    const open = runtime.anim.castleGate;
    if (left.current) left.current.rotation.y = -open * 1.75;
    if (right.current) right.current.rotation.y = open * 1.75;
    glowMat.opacity = Math.min(1, runtime.anim.archGlow) * (1 - open * 0.6) * (0.8 + Math.sin(runtime.time * 3) * 0.2);
    if (glow.current) glow.current.scale.setScalar(6 + Math.sin(runtime.time * 2) * 0.5);
  });
  const door = roseGoldMat();
  const lattice = mat('#fff3e6', { rough: 0.4, metal: 0.4 });
  const g = LANDMARKS.castleGate;
  return (
    <group position={[g.x, 0, g.z]}>
      {/* Arch */}
      {[-3.3, 3.3].map((x) => (
        <mesh key={x} material={mat(PALETTE.ivory, { rough: 0.6 })} position={[x, 2.6, 0]} castShadow>
          <boxGeometry args={[1.2, 5.2, 1.4]} />
        </mesh>
      ))}
      <mesh material={roseGoldMat()} position={[0, 5.15, 0]} castShadow>
        <torusGeometry args={[3.3, 0.35, 10, 40, Math.PI]} />
      </mesh>
      <mesh material={mat(PALETTE.blush, { rough: 0.6 })} position={[0, 8.7, 0]}>
        <octahedronGeometry args={[0.55, 0]} />
      </mesh>
      {/* Doors hinge on the arch sides */}
      <group ref={left} position={[-2.7, 0, 0]}>
        <mesh material={door} position={[1.35, 2.3, 0]} castShadow>
          <boxGeometry args={[2.7, 4.6, 0.18]} />
        </mesh>
        <mesh material={lattice} position={[1.35, 2.6, 0.1]}>
          <torusGeometry args={[0.7, 0.07, 6, 20]} />
        </mesh>
      </group>
      <group ref={right} position={[2.7, 0, 0]}>
        <mesh material={door} position={[-1.35, 2.3, 0]} castShadow>
          <boxGeometry args={[2.7, 4.6, 0.18]} />
        </mesh>
        <mesh material={lattice} position={[-1.35, 2.6, 0.1]}>
          <torusGeometry args={[0.7, 0.07, 6, 20]} />
        </mesh>
      </group>
      <sprite ref={glow} material={glowMat} position={[0, 3, 0.6]} />
    </group>
  );
}

export function CastleExterior() {
  const wall = mat(PALETTE.ivory, { rough: 0.7 });
  const pink = mat(PALETTE.sageSoft, { rough: 0.65 });
  const win = mat('#dff1ff', { emissive: '#fff0d2', emissiveIntensity: 0.65, rough: 0.1, metal: 0.3 });
  const beds = useMemo(() => {
    const rng = mulberry32(42);
    const out: FlowerInstance[] = [];
    for (const [x0, x1] of [[-12.4, -8.1], [8.1, 12.4]]) {
      for (let i = 0; i < 60; i++) out.push({ y: 0.24, x: x0 + rng() * (x1 - x0), z: -21.9 + rng() * 7.8, color: ['#f19bb4', '#fff4f0', '#e6dcf5', '#f7c4d2'][i % 4], scale: 1 + rng() * 0.5, kind: i % 5 === 0 ? 'cup' : 'round' });
    }
    return out;
  }, []);
  return (
    <Proximity x={0} z={-28} radius={140}>
      <group userData={{ noBatch: true }}>
        <GateDoors />
      </group>
      <StaticBatch>
      {/* Keep */}
      <mesh material={wall} position={[0, 4.5, -34]} castShadow receiveShadow>
        <boxGeometry args={[18, 9, 12]} />
      </mesh>
      <mesh material={pink} position={[0, 9.15, -34]}>
        <boxGeometry args={[18.4, 0.3, 12.4]} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} material={wall} position={[-8.25 + i * 1.5, 9.65, -27.9]} castShadow>
          <boxGeometry args={[0.8, 0.7, 0.5]} />
        </mesh>
      ))}
      {/* Central tower */}
      <Tower x={0} z={-36} r={3.2} h={18} roof={PALETTE.sageDeep} />
      <Tower x={-10} z={-28.4} />
      <Tower x={10} z={-28.4} />
      <Tower x={-10} z={-40} r={2.6} h={12} />
      <Tower x={10} z={-40} r={2.6} h={12} />
      {/* Crystal windows */}
      {[-6, -3, 3, 6].map((x) =>
        [3.2, 6.6].map((y) => (
          <group key={`${x}-${y}`} position={[x, y, -27.98]}>
            <mesh material={win}>
              <planeGeometry args={[1.1, 1.8]} />
            </mesh>
            <mesh material={goldMat()} position={[0, 0.95, 0.02]} rotation={[0, 0, 0]}>
              <torusGeometry args={[0.55, 0.06, 6, 16, Math.PI]} />
            </mesh>
          </group>
        )),
      )}
      {/* Balcony */}
      <group position={[0, 5.6, -27.2]}>
        <mesh material={wall} castShadow>
          <boxGeometry args={[5, 0.25, 1.6]} />
        </mesh>
        {Array.from({ length: 11 }, (_, i) => (
          <mesh key={i} material={goldMat()} position={[-2.4 + i * 0.48, 0.45, 0.75]}>
            <cylinderGeometry args={[0.04, 0.04, 0.7, 6]} />
          </mesh>
        ))}
        <mesh material={goldMat()} position={[0, 0.8, 0.75]}>
          <boxGeometry args={[5, 0.08, 0.1]} />
        </mesh>
      </group>
      {/* Grand entrance */}
      <group position={[0, 0, -27.9]}>
        <mesh material={roseGoldMat()} position={[0, 1.7, 0.05]}>
          <boxGeometry args={[2.8, 3.4, 0.2]} />
        </mesh>
        <mesh material={roseGoldMat()} position={[0, 3.4, 0.05]}>
          <cylinderGeometry args={[1.4, 1.4, 0.2, 24, 1, false, -Math.PI / 2, Math.PI]} />
        </mesh>
        <mesh material={mat('#fff1d6', { emissive: '#ffd9a0', emissiveIntensity: 0.6 })} position={[0, 1.7, 0.17]}>
          <planeGeometry args={[0.08, 3.2]} />
        </mesh>
        {[-1.9, 1.9].map((x) => (
          <mesh key={x} material={wall} position={[x, 2.2, 0.35]} castShadow>
            <cylinderGeometry args={[0.3, 0.34, 4.4, 14]} />
          </mesh>
        ))}
        {/* Steps */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={mat('#f5ebe2', { rough: 0.6 })} position={[0, 0.08 + i * 0.12, 1.4 - i * 0.35]} receiveShadow>
            <boxGeometry args={[4.6 - i * 0.5, 0.16, 0.9]} />
          </mesh>
        ))}
      </group>
      <Fountain x={LANDMARKS.castleFountain.x} z={LANDMARKS.castleFountain.z} />
      {/* Flower beds */}
      {[[-10.25, -18], [10.25, -18]].map(([x, z]) => (
        <mesh key={x} material={mat('#8a6a52', { rough: 1 })} position={[x, 0.12, z]} receiveShadow>
          <boxGeometry args={[4.5, 0.24, 8]} />
        </mesh>
      ))}
      <FlowerField flowers={beds} />
      <LampPost x={-3.4} z={-12} />
      <LampPost x={3.4} z={-12} />
      <LampPost x={-3.4} z={-24} />
      <LampPost x={3.4} z={-24} />
      </StaticBatch>
    </Proximity>
  );
}
