import { MeshReflectorMaterial } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { goldMat, mat, PALETTE, roseGoldMat } from '../../components/game/materials';
import { useQuality } from '../../components/game/quality';
import { runtime } from '../../systems/runtime';
import { ROOF_REGIONS } from '../../systems/WorldManager/worldLayout';
import { Glow, Proximity } from '../common';
import { Pavilion } from '../Pavilion';

/** The ornate magical mirror. On capable devices it reflects for real when she is close. */
function MagicMirror() {
  const q = useQuality();
  const [near, setNear] = useState(false);
  const glow = useRef<THREE.PointLight>(null);
  const frame = useRef<THREE.Group>(null);
  useFrame(() => {
    const p = runtime.player;
    const n = p.area === 'overworld' && Math.hypot(p.x - 34, p.z + 29) < 8;
    if (n !== near) setNear(n);
    if (glow.current) glow.current.intensity = 1.5 + runtime.anim.mirrorGlow * 10 + Math.sin(runtime.time * 2) * 0.4;
    if (frame.current) frame.current.scale.setScalar(1 + runtime.anim.mirrorGlow * 0.02 * Math.sin(runtime.time * 6));
  });
  const reflective = near && q.tier !== 'low';
  return (
    <group position={[34, 0, -31.7]} userData={{ noBatch: true }}>
      <group ref={frame}>
        {/* Gilded oval frame */}
        <mesh material={goldMat()} position={[0, 2.5, 0]} scale={[1, 1.45, 1]}>
          <torusGeometry args={[1.2, 0.14, 12, 48]} />
        </mesh>
        <mesh material={roseGoldMat()} position={[0, 4.45, 0.05]}>
          <octahedronGeometry args={[0.3, 0]} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} material={mat(PALETTE.blush, { rough: 0.5 })} position={[Math.cos(a) * 1.25, 2.5 + Math.sin(a) * 1.8, 0.1]}>
              <icosahedronGeometry args={[0.1, 0]} />
            </mesh>
          );
        })}
        <mesh position={[0, 2.5, 0.02]} scale={[1, 1.45, 1]}>
          <circleGeometry args={[1.15, 48]} />
          {reflective ? (
            <MeshReflectorMaterial resolution={q.tier === 'high' ? 1024 : 512} mirror={1} mixStrength={1.4} blur={[0, 0]} depthScale={0} color="#f6eef8" metalness={0.5} roughness={0.05} />
          ) : (
            <meshStandardMaterial color="#e9e4f4" metalness={0.9} roughness={0.08} emissive="#efe4ff" emissiveIntensity={0.25} />
          )}
        </mesh>
      </group>
      <pointLight ref={glow} color="#ffe6f0" intensity={1.5} distance={8} position={[0, 2.6, 1.2]} />
      <Glow position={[0, 2.5, 0.3]} size={4.2} color="#fff0f6" opacity={0.25} />
    </group>
  );
}

export function MirrorScene() {
  const r = ROOF_REGIONS.mirror;
  const lip = ['#c96d86', '#e8899e', '#b8466a', '#d99aa8'];
  return (
    <Proximity x={34} z={-26} radius={85}>
      <Pavilion region={r} wallColor="#fbe3ea" floorColor="#fff6f2" roofColor={PALETTE.roof} height={5.2} columns={[[31.3, -19.7], [36.7, -19.7]]}>
        <MagicMirror />
        {/* Vanity with lipsticks, perfumes, brushes */}
        <group position={[38, 0, -31.2]}>
          <mesh material={mat(PALETTE.ivory, { rough: 0.4 })} position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[2.8, 0.9, 1.2]} />
          </mesh>
          <mesh material={goldMat()} position={[0, 0.92, 0]}>
            <boxGeometry args={[2.85, 0.05, 1.25]} />
          </mesh>
          <mesh material={mat('#e9e4f4', { metal: 0.9, rough: 0.1 })} position={[0, 1.8, -0.5]}>
            <circleGeometry args={[0.7, 32]} />
          </mesh>
          <mesh material={goldMat()} position={[0, 1.8, -0.52]}>
            <torusGeometry args={[0.72, 0.06, 8, 32]} />
          </mesh>
          {/* Vanity bulbs */}
          {Array.from({ length: 7 }, (_, i) => {
            const a = Math.PI * (i / 6);
            return (
              <mesh key={i} material={mat('#fff3e0', { emissive: '#ffe6c2', emissiveIntensity: 1.6 })} position={[Math.cos(a) * 0.95, 1.8 + Math.sin(a) * 0.95, -0.45]}>
                <sphereGeometry args={[0.06, 8, 6]} />
              </mesh>
            );
          })}
          {lip.map((c, i) => (
            <group key={i} position={[-1 + i * 0.18, 1.0, 0.25]}>
              <mesh material={goldMat()}>
                <cylinderGeometry args={[0.035, 0.035, 0.12, 10]} />
              </mesh>
              <mesh material={mat(c, { rough: 0.3 })} position={[0, 0.09, 0]}>
                <cylinderGeometry args={[0.028, 0.03, 0.07, 10]} />
              </mesh>
            </group>
          ))}
          {/* Brushes in a cup */}
          <mesh material={mat(PALETTE.blush, { rough: 0.5 })} position={[0.9, 1.05, 0.2]}>
            <cylinderGeometry args={[0.08, 0.07, 0.2, 12]} />
          </mesh>
          {[-0.03, 0.02, 0.05].map((dx, i) => (
            <mesh key={i} material={mat(PALETTE.woodDark)} position={[0.9 + dx, 1.25, 0.2]} rotation={[0, 0, dx * 4]}>
              <cylinderGeometry args={[0.012, 0.02, 0.32, 6]} />
            </mesh>
          ))}
        </group>
        {/* Side table: lipstick & perfume bottles */}
        <group position={[29.2, 0, -27.3]}>
          <mesh material={mat(PALETTE.ivory, { rough: 0.4 })} position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[1.8, 0.9, 1.8]} />
          </mesh>
          {['#f7c4d2', '#e6dcf5', '#f3dca4'].map((c, i) => (
            <group key={i} position={[0.5, 1.05, -0.5 + i * 0.5]}>
              <mesh material={mat(c, { rough: 0.05, metal: 0.1, transparent: true, opacity: 0.8 })}>
                <sphereGeometry args={[0.13, 14, 10]} />
              </mesh>
              <mesh material={goldMat()} position={[0, 0.16, 0]}>
                <cylinderGeometry args={[0.03, 0.04, 0.08, 8]} />
              </mesh>
            </group>
          ))}
          <group position={[0.5, 0.95, -1.05]}>
            <mesh material={goldMat()}>
              <cylinderGeometry args={[0.05, 0.05, 0.14, 10]} />
            </mesh>
            <mesh material={mat('#c96d86', { rough: 0.3 })} position={[0, 0.11, 0]}>
              <cylinderGeometry args={[0.04, 0.045, 0.08, 10]} />
            </mesh>
          </group>
        </group>
        {/* Decorative lighting */}
        <pointLight color="#ffd7e4" intensity={6} distance={12} position={[34, 4.4, -26]} />
        {[30, 34, 38].map((x) => (
          <Glow key={x} position={[x, 4.6, -26]} size={1.4} color="#ffe6f0" opacity={0.6} />
        ))}
        {/* Pink & gold rug */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[34, 0.13, -27]}>
          <circleGeometry args={[2.6, 40]} />
          <meshStandardMaterial color="#f2b8c6" roughness={1} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[34, 0.135, -27]}>
          <ringGeometry args={[2.4, 2.6, 40]} />
          <meshStandardMaterial color="#e7c98f" roughness={0.6} />
        </mesh>
      </Pavilion>
    </Proximity>
  );
}
