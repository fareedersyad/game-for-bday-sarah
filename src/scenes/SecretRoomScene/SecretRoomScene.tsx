import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { goldMat, mat, PALETTE, roseGoldMat } from '../../components/game/materials';
import { useGameStore } from '../../stores/gameStore';
import { runtime } from '../../systems/runtime';
import { Floating, Glow } from '../common';
import { StaticBatch } from '../../components/game/StaticBatch';
import { BirthdayCake, WindowFireworks } from './BirthdayCake';

function Candle({ x, z, y = 0.82 }: { x: number; z: number; y?: number }) {
  const flame = useRef<THREE.Mesh>(null);
  const light = useRef<THREE.PointLight>(null);
  const seed = x * 13.1 + z * 7.7;
  useFrame(() => {
    const f = 0.85 + Math.sin(runtime.time * 9 + seed) * 0.08 + Math.sin(runtime.time * 23 + seed) * 0.05;
    if (flame.current) flame.current.scale.set(1, f, 1);
    if (light.current) light.current.intensity = 1.6 * f;
  });
  return (
    <group position={[x, y, z]} userData={{ noBatch: true }}>
      <mesh material={mat('#fff6ea', { rough: 0.6 })} position={[0, 0.09, 0]}>
        <cylinderGeometry args={[0.04, 0.045, 0.18, 10]} />
      </mesh>
      <mesh ref={flame} material={mat('#ffd37a', { emissive: '#ffb347', emissiveIntensity: 2.4 })} position={[0, 0.22, 0]}>
        <coneGeometry args={[0.025, 0.08, 8]} />
      </mesh>
      <pointLight ref={light} color="#ffbe6b" intensity={1.6} distance={3.5} decay={1.8} position={[0, 0.3, 0]} />
    </group>
  );
}

function Chair({ x, z, rot }: { x: number; z: number; rot: number }) {
  const cushion = mat(PALETTE.sageSoft, { rough: 0.95 });
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh material={cushion} position={[0, 0.46, 0]} castShadow>
        <boxGeometry args={[0.7, 0.14, 0.7]} />
      </mesh>
      <mesh material={cushion} position={[0, 0.95, -0.32]} castShadow>
        <boxGeometry args={[0.7, 0.85, 0.1]} />
      </mesh>
      <mesh material={goldMat()} position={[0, 1.42, -0.32]}>
        <torusGeometry args={[0.28, 0.035, 6, 16, Math.PI]} />
      </mesh>
      {[[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]].map(([dx, dz], i) => (
        <mesh key={i} material={goldMat()} position={[dx, 0.2, dz]}>
          <cylinderGeometry args={[0.03, 0.03, 0.42, 6]} />
        </mesh>
      ))}
    </group>
  );
}

export function SecretRoomScene() {
  const unlocked = useGameStore((s) => !!s.flags.secretUnlocked);
  const letterRead = useGameStore((s) => !!s.flags.finalLetterRead);
  const giftOpened = useGameStore((s) => !!s.flags.giftOpened);
  const fairy = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!fairy.current) return;
    fairy.current.children.forEach((c, i) => {
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.emissiveIntensity = 1.2 + Math.sin(runtime.time * 2 + i) * 0.6;
    });
  });
  return (
    <>
    <BirthdayCake />
    <WindowFireworks />
    <StaticBatch>
      {/* Warm rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-15, 0.013, 0]}>
        <circleGeometry args={[2.8, 36]} />
        <meshStandardMaterial color="#f2c6d2" roughness={1} />
      </mesh>
      {/* Round table with candles, flowers and the final letter */}
      <group position={[-15, 0, 0]}>
        <mesh material={mat(PALETTE.ivory, { rough: 0.4 })} position={[0, 0.72, 0]} castShadow>
          <cylinderGeometry args={[0.85, 0.85, 0.06, 28]} />
        </mesh>
        <mesh material={goldMat()} position={[0, 0.36, 0]}>
          <cylinderGeometry args={[0.08, 0.25, 0.72, 12]} />
        </mesh>
        <mesh material={mat('#fdeff3', { rough: 0.9 })} position={[0, 0.74, 0]}>
          <cylinderGeometry args={[0.88, 0.9, 0.02, 28]} />
        </mesh>
        <Candle x={-0.45} z={-0.35} />
        <Candle x={0.45} z={-0.3} />
        <Candle x={-0.15} z={0.45} />
        {/* Little vase of roses */}
        <mesh material={mat('#e6f0ff', { rough: 0.1, transparent: true, opacity: 0.75 })} position={[0.35, 0.88, 0.3]}>
          <cylinderGeometry args={[0.07, 0.05, 0.25, 10]} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} material={mat(i % 2 ? '#f19bb4' : '#fff4f0', { rough: 0.6 })} position={[0.35 + Math.cos(i * 1.3) * 0.08, 1.07 + (i % 2) * 0.04, 0.3 + Math.sin(i * 1.3) * 0.08]}>
            <dodecahedronGeometry args={[0.05, 0]} />
          </mesh>
        ))}
        {/* Final letter */}
        {unlocked && (
          <Floating amp={letterRead ? 0 : 0.03} speed={2}>
            <group position={[0, 0.78, 0]} rotation={[0, -0.4, 0]}>
              <mesh material={mat('#fff6ea', { rough: 0.7 })}>
                <boxGeometry args={[0.5, 0.02, 0.34]} />
              </mesh>
              <mesh material={mat('#b8466a', { emissive: '#b8466a', emissiveIntensity: 0.4 })} position={[0, 0.02, 0]}>
                <cylinderGeometry args={[0.06, 0.06, 0.02, 12]} />
              </mesh>
              {!letterRead && <Glow position={[0, 0.15, 0]} size={1.1} color="#ffe3a3" opacity={0.75} />}
            </group>
          </Floating>
        )}
      </group>
      {/* Two chairs, facing each other */}
      <Chair x={-15} z={-1.6} rot={0} />
      <Chair x={-15} z={1.6} rot={Math.PI} />
      {/* Gift display */}
      <group position={[-18.6, 0, -3.8]}>
        <mesh material={mat(PALETTE.ivory, { rough: 0.4 })} position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[1.8, 1, 1.4]} />
        </mesh>
        <mesh material={goldMat()} position={[0, 1.02, 0]}>
          <boxGeometry args={[1.85, 0.05, 1.45]} />
        </mesh>
        <Floating amp={0.05} speed={1.2} spin={0.3}>
          <group position={[0, 1.35, 0]}>
            <mesh material={mat('#e8899e', { rough: 0.5 })} castShadow>
              <boxGeometry args={[0.55, 0.45, 0.55]} />
            </mesh>
            <mesh material={mat('#f3dca4', { rough: 0.4, metal: 0.4 })}>
              <boxGeometry args={[0.12, 0.47, 0.57]} />
            </mesh>
            <mesh material={mat('#f3dca4', { rough: 0.4, metal: 0.4 })}>
              <boxGeometry args={[0.57, 0.47, 0.12]} />
            </mesh>
            {!giftOpened && (
              <mesh material={roseGoldMat()} position={[0, 0.32, 0]}>
                <torusGeometry args={[0.12, 0.04, 6, 14]} />
              </mesh>
            )}
          </group>
        </Floating>
        <Glow position={[0, 1.4, 0]} size={2} color="#ffd1e3" opacity={0.5} />
      </group>
      {/* Window with the moon */}
      <group position={[-19.95, 3.4, 0.5]} rotation={[0, Math.PI / 2, 0]}>
        <mesh material={mat('#1d1a45', { emissive: '#251f5a', emissiveIntensity: 0.8 })}>
          <planeGeometry args={[2.6, 3.2]} />
        </mesh>
        <mesh material={mat('#fff6dc', { emissive: '#fff1c8', emissiveIntensity: 1.4 })} position={[0.55, 0.7, 0.02]}>
          <circleGeometry args={[0.35, 24]} />
        </mesh>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i} material={mat('#ffffff', { emissive: '#ffffff', emissiveIntensity: 1.5 })} position={[((i * 37) % 24) / 10 - 1.2, ((i * 53) % 30) / 10 - 1.5, 0.02]}>
            <circleGeometry args={[0.025, 6]} />
          </mesh>
        ))}
        <mesh material={goldMat()} position={[0, 1.6, 0.03]}>
          <torusGeometry args={[1.3, 0.07, 6, 20, Math.PI]} />
        </mesh>
        <mesh material={goldMat()} position={[0, 0, 0.03]}>
          <boxGeometry args={[0.06, 3.2, 0.04]} />
        </mesh>
      </group>
      {/* Flowers in the corner */}
      <group position={[-12, 0, -4.2]}>
        <mesh material={mat(PALETTE.blush, { rough: 0.5 })} position={[0, 0.4, 0]}>
          <cylinderGeometry args={[0.35, 0.25, 0.8, 14]} />
        </mesh>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} material={mat(['#f19bb4', '#fff4f0', '#e6dcf5'][i % 3], { rough: 0.6 })} position={[Math.cos(i) * 0.25, 0.95 + (i % 3) * 0.12, Math.sin(i) * 0.25]}>
            <icosahedronGeometry args={[0.1, 0]} />
          </mesh>
        ))}
      </group>
      {/* Fairy lights */}
      <group ref={fairy} userData={{ noBatch: true }}>
        {Array.from({ length: 22 }, (_, i) => {
          const t = i / 21;
          return (
            <mesh key={i} material={mat('#fff1c8', { emissive: '#ffd98a', emissiveIntensity: 1.4 })} position={[-20.3 + t * 9.6, 6.2 - Math.sin(t * Math.PI) * 0.6, -4.7]}>
              <sphereGeometry args={[0.05, 6, 5]} />
            </mesh>
          );
        })}
      </group>
      <pointLight color="#ffc98a" intensity={4} distance={10} position={[-15, 4, 0]} />
    </StaticBatch>
    </>
  );
}
