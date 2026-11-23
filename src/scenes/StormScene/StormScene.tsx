import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mat, PALETTE } from '../../components/game/materials';
import { runtime } from '../../systems/runtime';
import { LANDMARKS } from '../../systems/WorldManager/worldLayout';
import { mulberry32 } from '../../utils/rng';
import { StaticBatch } from '../../components/game/StaticBatch';
import { Floating, Glow, Proximity } from '../common';

function Mushrooms() {
  const items = useMemo(() => {
    const rng = mulberry32(64);
    return Array.from({ length: 40 }, () => {
      const a = rng() * Math.PI * 2;
      const r = 3 + rng() * 14;
      return { x: LANDMARKS.stormCenter.x + Math.cos(a) * r, z: LANDMARKS.stormCenter.z + Math.sin(a) * r, s: 0.5 + rng() * 0.9, c: rng() < 0.5 ? '#f3a9bb' : '#c3b1e1' };
    });
  }, []);
  return (
    <group>
      {items.map((m, i) => (
        <group key={i} position={[m.x, 0, m.z]} scale={m.s}>
          <mesh material={mat('#fff6ea')} position={[0, 0.15, 0]}>
            <cylinderGeometry args={[0.05, 0.07, 0.3, 6]} />
          </mesh>
          <mesh material={mat(m.c, { emissive: m.c, emissiveIntensity: 0.35 })} position={[0, 0.32, 0]}>
            <sphereGeometry args={[0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

export function StormScene() {
  const lanternLight = useRef<THREE.PointLight>(null);
  const crystal = useRef<THREE.Mesh>(null);
  const heartGlow = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const w = runtime.weather;
    if (lanternLight.current) lanternLight.current.intensity = 2 + w.storm * 5 + Math.sin(runtime.time * 3) * 0.4;
    if (crystal.current) (crystal.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + Math.sin(runtime.time * 1.7) * 0.4 + w.storm;
    if (heartGlow.current) heartGlow.current.intensity = 1 + w.storm * 4;
  });
  const t = LANDMARKS.stormBigTree;
  return (
    <Proximity x={LANDMARKS.stormCenter.x} z={LANDMARKS.stormCenter.z} radius={80}>
      <StaticBatch>
      <Mushrooms />
      {/* Pink umbrella planted in the ground */}
      <group position={[-22, 0, 34.5]} rotation={[0.15, 0.5, 0.1]}>
        <mesh material={mat(PALETTE.woodDark)} position={[0, 0.8, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.6, 6]} />
        </mesh>
        <mesh material={mat('#f3a9bb', { rough: 0.6, side: THREE.DoubleSide })} position={[0, 1.6, 0]}>
          <coneGeometry args={[0.85, 0.45, 10, 1, true]} />
        </mesh>
      </group>
      {/* Magical lantern on a post */}
      <group position={[-29, 0, 30]}>
        <mesh material={mat('#4c4258')} position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.07, 0.1, 2.4, 8]} />
        </mesh>
        <Floating amp={0.05} speed={2}>
          <mesh material={mat('#ffe3a6', { emissive: '#ffcf7a', emissiveIntensity: 2.2 })} position={[0, 2.6, 0]}>
            <octahedronGeometry args={[0.22, 0]} />
          </mesh>
        </Floating>
        <pointLight ref={lanternLight} color="#ffcf8a" intensity={3} distance={10} position={[0, 2.6, 0]} />
        <Glow position={[0, 2.6, 0]} size={2} color="#ffd98a" opacity={0.7} />
      </group>
      {/* Small shelter */}
      <group position={[-37, 0, 42.8]}>
        {[[-1.4, -1.2], [1.4, -1.2], [-1.4, 1.2], [1.4, 1.2]].map(([x, z], i) => (
          <mesh key={i} material={mat(PALETTE.woodDark)} position={[x, 1.2, z]}>
            <cylinderGeometry args={[0.1, 0.1, 2.4, 6]} />
          </mesh>
        ))}
        <mesh material={mat('#9c85c8', { rough: 0.7 })} position={[0, 2.9, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[2.6, 1.3, 4]} />
        </mesh>
        <mesh material={mat(PALETTE.wood)} position={[0, 0.45, 0.6]}>
          <boxGeometry args={[2.2, 0.12, 0.5]} />
        </mesh>
      </group>
      {/* Glowing crystal */}
      <group position={[-27, 0, 43.8]}>
        <mesh ref={crystal} material={new THREE.MeshStandardMaterial({ color: '#d9e8ff', emissive: '#9fc4ff', emissiveIntensity: 1, roughness: 0.1, metalness: 0.2 })} position={[0, 0.9, 0]} scale={[0.6, 1.4, 0.6]}>
          <octahedronGeometry args={[0.6, 0]} />
        </mesh>
        <pointLight color="#a9c8ff" intensity={2.5} distance={8} position={[0, 1.2, 0]} />
      </group>
      {/* The old tree with a warm heart-glow — where he waits for her */}
      <group position={[t.x, 0, t.z]}>
        <mesh material={mat('#5f4636', { rough: 0.9 })} position={[0, 2.4, 0]} castShadow>
          <cylinderGeometry args={[0.9, 1.5, 4.8, 10]} />
        </mesh>
        {[[0, 6.5, 0, 3.2], [1.8, 5.6, 1, 2.2], [-1.8, 5.8, -0.6, 2.3]].map(([x, y, z, s], i) => (
          <mesh key={i} material={mat(i % 2 ? '#4d6d5f' : '#557a68', { rough: 0.85, flat: true })} position={[x, y, z]} scale={s} castShadow>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
        ))}
        <pointLight ref={heartGlow} color="#ffc2d4" intensity={2} distance={12} position={[1.6, 2, 1.4]} />
        <Glow position={[1.4, 1.6, 1.6]} size={3.5} color="#ffd1dc" opacity={0.35} />
      </group>
      </StaticBatch>
    </Proximity>
  );
}
