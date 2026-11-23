import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BouquetModel } from '../../components/game/Characters';
import { goldMat, mat, PALETTE, roseGoldMat } from '../../components/game/materials';
import { FlowerField, type FlowerInstance } from '../../components/game/Vegetation';
import { useGameStore } from '../../stores/gameStore';
import { runtime } from '../../systems/runtime';
import { LANDMARKS } from '../../systems/WorldManager/worldLayout';
import { mulberry32 } from '../../utils/rng';
import { StaticBatch } from '../../components/game/StaticBatch';
import { Floating, Glow, LampPost } from '../common';

/** The crown model used on the cushion (larger, more detailed than the worn one). */
export function DisplayCrown({ gem = PALETTE.rose }: { gem?: string }) {
  const gemMat = mat(gem, { rough: 0.15, emissive: gem, emissiveIntensity: 0.5 });
  const crystal = mat(PALETTE.crystal, { rough: 0.05, metal: 0.2, emissive: '#ffffff', emissiveIntensity: 0.5 });
  const leafGold = roseGoldMat();
  return (
    <group scale={2.1}>
      <mesh material={leafGold} castShadow>
        <cylinderGeometry args={[0.105, 0.115, 0.05, 28, 1, true]} />
      </mesh>
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        const tall = i % 2 === 0 ? 0.1 : 0.065;
        return (
          <group key={i} position={[Math.sin(a) * 0.107, 0.025, Math.cos(a) * 0.107]} rotation={[0, a, 0]}>
            <mesh material={leafGold} position={[0, tall / 2, 0]}>
              <coneGeometry args={[0.02, tall, 4]} />
            </mesh>
            <mesh material={i % 2 === 0 ? crystal : gemMat} position={[0, tall + 0.01, 0]}>
              <octahedronGeometry args={[0.015, 0]} />
            </mesh>
            {/* floral filigree */}
            <mesh material={mat(PALETTE.blush, { rough: 0.5 })} position={[0, 0.012, 0.004]} scale={[1, 0.7, 0.5]}>
              <sphereGeometry args={[0.013, 8, 6]} />
            </mesh>
          </group>
        );
      })}
      <mesh material={gemMat} position={[0, 0.04, 0.113]} scale={[1, 1.3, 0.6]}>
        <octahedronGeometry args={[0.028, 0]} />
      </mesh>
    </group>
  );
}

export function CoronationScene() {
  const crowned = useGameStore((s) => !!s.flags.crownAccepted);
  const bouquetTaken = useGameStore((s) => !!s.flags.bouquetReceived);
  const crownRef = useRef<THREE.Group>(null);
  const bouquetRef = useRef<THREE.Group>(null);
  const cp = LANDMARKS.crownPedestal;
  const bp = LANDMARKS.bouquetDisplay;

  // Flowers that bloom during the coronation.
  const bloomFlowers = useMemo(() => {
    const rng = mulberry32(3);
    const out: FlowerInstance[] = [];
    const colors = ['#f19bb4', '#fff4f0', '#f7c4d2', '#e6dcf5', '#f3dca4'];
    for (let ring = 0; ring < 2; ring++) {
      const r = 3.1 + ring * 0.6;
      const n = 34 + ring * 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ring * 0.2;
        out.push({ x: cp.x + Math.cos(a) * r, z: cp.z + Math.sin(a) * r, color: colors[Math.floor(rng() * colors.length)], scale: 0.9 + rng() * 0.5, kind: rng() < 0.3 ? 'cluster' : 'round' });
      }
    }
    // Courtyard borders
    for (let i = 0; i < 90; i++) {
      const side = i % 4;
      const t = rng();
      const x = side < 2 ? -12.6 + t * 25.2 : side === 2 ? -12.6 : 12.6;
      const z = side === 0 ? -0.8 : side === 1 ? 20.8 : -0.8 + t * 21.6;
      if (Math.abs(x) < 3.6 && (side === 0 || side === 1)) continue;
      if (z > 6.5 && z < 13.5 && side >= 2) continue;
      out.push({ x, z, color: colors[Math.floor(rng() * colors.length)], scale: 0.8 + rng() * 0.6, kind: 'round' });
    }
    return out;
  }, [cp.x, cp.z]);

  const bouquetFlowers = useMemo(() => {
    const rng = mulberry32(8);
    const out: FlowerInstance[] = [];
    for (let i = 0; i < 26; i++) {
      const a = rng() * Math.PI * 2;
      const r = 1.3 + rng() * 0.7;
      out.push({ x: bp.x + Math.cos(a) * r, z: bp.z + Math.sin(a) * r, color: rng() < 0.5 ? '#f19bb4' : '#fff4f0', scale: 1 + rng() * 0.5, kind: rng() < 0.4 ? 'cup' : 'round' });
    }
    return out;
  }, [bp.x, bp.z]);

  useFrame(() => {
    if (crownRef.current) crownRef.current.visible = !crowned && !runtime.anim.crownFlightActive;
    if (bouquetRef.current) {
      const l = runtime.anim.bouquetLift;
      bouquetRef.current.visible = !bouquetTaken || l < 0.98;
      bouquetRef.current.position.y = 1.25 + l * 0.8;
      bouquetRef.current.scale.setScalar(1 - l * 0.6);
    }
  });

  const marble = mat('#fbf1ee', { rough: 0.35 });
  const velvet = mat('#b85c78', { rough: 0.95 });
  const pinkStone = mat('#f3cdd6', { rough: 0.6 });

  return (
    <StaticBatch>
      {/* Plaza mosaic */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 10]} receiveShadow>
        <circleGeometry args={[10.5, 64]} />
        <meshStandardMaterial color="#f6ece4" roughness={0.6} />
      </mesh>
      {[8.6, 6.2, 4.2].map((r, i) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05 + i * 0.002, 10]}>
          <ringGeometry args={[r - 0.25, r, 64]} />
          <meshStandardMaterial color={i === 1 ? '#e7c98f' : '#f0bfcc'} roughness={0.5} />
        </mesh>
      ))}
      {Array.from({ length: 16 }, (_, i) => {
        const a = (i / 16) * Math.PI * 2;
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, a]} position={[Math.cos(a) * 7.4, 0.055, 10 + Math.sin(a) * 7.4]}>
            <circleGeometry args={[0.35, 5]} />
            <meshStandardMaterial color="#e8899e" roughness={0.6} />
          </mesh>
        );
      })}

      {/* Crown pedestal with velvet cushion */}
      <group position={[cp.x, 0, cp.z]}>
        <mesh material={marble} position={[0, 0.12, 0]} receiveShadow castShadow>
          <cylinderGeometry args={[1.05, 1.15, 0.24, 28]} />
        </mesh>
        <mesh material={marble} position={[0, 0.55, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.55, 0.7, 20]} />
        </mesh>
        <mesh material={goldMat()} position={[0, 0.92, 0]}>
          <cylinderGeometry args={[0.6, 0.48, 0.08, 24]} />
        </mesh>
        <mesh material={velvet} position={[0, 1.03, 0]} scale={[1, 0.38, 1]} castShadow>
          <sphereGeometry args={[0.46, 22, 14]} />
        </mesh>
        {[[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]].map(([x, z], i) => (
          <mesh key={i} material={goldMat()} position={[x, 1.0, z]}>
            <sphereGeometry args={[0.05, 8, 6]} />
          </mesh>
        ))}
        <group ref={crownRef} position={[0, 1.16, 0]} userData={{ noBatch: true }}>
          <Floating amp={0.04} speed={1.6} spin={0.4}>
            <DisplayCrown />
          </Floating>
          <Glow position={[0, 0.2, 0]} size={2.4} color="#ffe0a8" opacity={0.6} />
          <pointLight color="#ffd9a0" intensity={2.5} distance={5} position={[0, 0.5, 0]} />
        </group>
      </group>
      <FlowerField flowers={bloomFlowers} grow={() => 0.15 + runtime.anim.coronationBloom * 0.85} />

      {/* Bouquet display */}
      <group position={[bp.x, 0, bp.z]}>
        <mesh material={pinkStone} position={[0, 0.5, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.7, 0.85, 1, 6]} />
        </mesh>
        <mesh material={goldMat()} position={[0, 1.02, 0]}>
          <cylinderGeometry args={[0.8, 0.72, 0.06, 6]} />
        </mesh>
        <mesh material={roseGoldMat()} position={[0, 2.0, -0.75]}>
          <torusGeometry args={[1.05, 0.05, 8, 30, Math.PI]} />
        </mesh>
        {[-1.05, 1.05].map((x) => (
          <mesh key={x} material={roseGoldMat()} position={[x, 1, -0.75]}>
            <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
          </mesh>
        ))}
        <group ref={bouquetRef} position={[0, 1.25, 0]} userData={{ noBatch: true }}>
          <BouquetModel />
          <Glow position={[0, 0.4, 0]} size={1.8} color="#ffc4d6" opacity={0.55} />
        </group>
      </group>
      <FlowerField flowers={bouquetFlowers} />

      <LampPost x={-9} z={4} />
      <LampPost x={9} z={16} />
      <LampPost x={-9} z={16} />
      <LampPost x={9} z={-0.5} />
      {/* Rose bushes in the corner planters */}
      {[[-11.5, 0.5], [11.5, 0.5], [-11.5, 19.5], [11.5, 19.5]].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh material={mat('#f0e4dc', { rough: 0.6 })} position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[1.2, 1.0, 0.7, 16]} />
          </mesh>
          <mesh material={mat(PALETTE.hedge, { rough: 0.9, flat: true })} position={[0, 1.15, 0]} castShadow>
            <icosahedronGeometry args={[1.05, 1]} />
          </mesh>
          {Array.from({ length: 9 }, (_, k) => (
            <mesh key={k} material={mat(k % 2 ? '#f19bb4' : '#fff4f0', { rough: 0.6 })} position={[Math.cos(k * 0.7) * 0.85, 1.2 + Math.sin(k * 1.9) * 0.4, Math.sin(k * 0.7) * 0.85]}>
              <icosahedronGeometry args={[0.15, 0]} />
            </mesh>
          ))}
        </group>
      ))}
    </StaticBatch>
  );
}
