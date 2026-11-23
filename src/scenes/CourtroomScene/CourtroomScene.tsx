import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { goldMat, mat, PALETTE } from '../../components/game/materials';
import { useGameStore } from '../../stores/gameStore';
import { runtime } from '../../systems/runtime';
import { ROOF_REGIONS } from '../../systems/WorldManager/worldLayout';
import { Floating, Glow, Proximity } from '../common';
import { Pavilion } from '../Pavilion';

function JusticeScales({ x, y, z }: { x: number; y: number; z: number }) {
  const beam = useRef<THREE.Group>(null);
  useFrame(() => {
    if (beam.current) beam.current.rotation.z = Math.sin(runtime.time * 0.8) * 0.08;
  });
  return (
    <group position={[x, y, z]} userData={{ noBatch: true }}>
      <mesh material={goldMat()} position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.03, 0.05, 0.8, 8]} />
      </mesh>
      <mesh material={goldMat()}>
        <cylinderGeometry args={[0.16, 0.2, 0.05, 12]} />
      </mesh>
      <group ref={beam} position={[0, 0.8, 0]}>
        <mesh material={goldMat()} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.018, 0.018, 0.8, 6]} />
        </mesh>
        {[-0.38, 0.38].map((dx) => (
          <group key={dx} position={[dx, -0.22, 0]}>
            <mesh material={goldMat()} position={[0, 0.11, 0]}>
              <cylinderGeometry args={[0.005, 0.005, 0.22, 4]} />
            </mesh>
            <mesh material={goldMat()}>
              <cylinderGeometry args={[0.12, 0.08, 0.03, 12]} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

function EvidenceGlow({ id, x, y, z }: { id: string; x: number; y: number; z: number }) {
  const done = useGameStore((s) => s.collected[`court:${id}`] !== undefined);
  if (done) return null;
  return <Glow position={[x, y, z]} size={1.2} color="#ffe9b0" opacity={0.75} />;
}

export function CourtroomScene() {
  const r = ROOF_REGIONS.courtroom;
  const wood = mat('#8a5f43', { rough: 0.7 });
  const woodLight = mat('#b98a62', { rough: 0.7 });
  const green = mat('#5d7d5b', { rough: 0.9 });
  const paper = mat('#fff6e6', { rough: 0.9 });
  return (
    <Proximity x={-37} z={6} radius={90}>
      <Pavilion region={r} wallColor="#efe3d3" floorColor="#d9c3a5" roofColor="#b7a28d" height={6} columns={[[-28.2, 3.2], [-28.2, 10.8]]}>
        {/* Judge's bench */}
        <group position={[-44.1, 0, 6]}>
          <mesh material={wood} position={[0, 0.9, 0]} castShadow>
            <boxGeometry args={[3, 1.8, 8]} />
          </mesh>
          <mesh material={woodLight} position={[0.3, 1.85, 0]}>
            <boxGeometry args={[2.6, 0.1, 7.8]} />
          </mesh>
          <mesh material={goldMat()} position={[1.52, 1.1, 0]}>
            <boxGeometry args={[0.04, 0.6, 3]} />
          </mesh>
          <JusticeScales x={0.6} y={1.9} z={-2.4} />
          {/* Gavel */}
          <group position={[0.8, 1.95, 1.6]} rotation={[0, 0.5, 0]}>
            <mesh material={wood} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.07, 0.07, 0.3, 10]} />
            </mesh>
            <mesh material={wood} position={[0.2, 0, 0]} rotation={[0, 0, 0.2]}>
              <cylinderGeometry args={[0.02, 0.02, 0.4, 6]} />
            </mesh>
          </group>
          {/* Law books stacked */}
          {['#7a3b4b', '#3e5a7a', '#6a5a3a', '#8f78b8'].map((c, i) => (
            <mesh key={c} material={mat(c, { rough: 0.7 })} position={[0.4, 1.97 + i * 0.09, 3 - i * 0.03]} rotation={[0, i * 0.15, 0]}>
              <boxGeometry args={[0.5, 0.08, 0.36]} />
            </mesh>
          ))}
        </group>
        {/* Wise owl judge */}
        <group position={[-44.6, 2.1, 6]} rotation={[0, Math.PI / 2, 0]}>
          <Floating amp={0.03} speed={1.2}>
            <mesh material={mat('#a0826a', { rough: 0.9 })} position={[0, 0.45, 0]}>
              <sphereGeometry args={[0.42, 16, 12]} />
            </mesh>
            <mesh material={mat('#c9ab8f', { rough: 0.9 })} position={[0, 0.4, 0.28]} scale={[0.8, 0.9, 0.4]}>
              <sphereGeometry args={[0.35, 14, 10]} />
            </mesh>
            {[-0.15, 0.15].map((dx) => (
              <group key={dx}>
                <mesh material={mat('#fff6e6')} position={[dx, 0.62, 0.33]}>
                  <sphereGeometry args={[0.1, 10, 8]} />
                </mesh>
                <mesh material={mat('#2b1f1c')} position={[dx, 0.62, 0.42]}>
                  <sphereGeometry args={[0.045, 8, 6]} />
                </mesh>
              </group>
            ))}
            <mesh material={mat('#e7b85a')} position={[0, 0.5, 0.42]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.05, 0.12, 6]} />
            </mesh>
            {/* little judge's wig/cap */}
            <mesh material={mat('#2e2a36')} position={[0, 0.88, 0]}>
              <boxGeometry args={[0.5, 0.06, 0.5]} />
            </mesh>
          </Floating>
        </group>
        {/* Evidence table (footprints) */}
        <group position={[-36, 0, 2.8]}>
          <mesh material={woodLight} position={[0, 0.85, 0]} castShadow>
            <boxGeometry args={[2, 0.08, 1.2]} />
          </mesh>
          <mesh material={woodLight} position={[0, 0.42, 0]}>
            <boxGeometry args={[1.8, 0.84, 1]} />
          </mesh>
          {[-0.4, 0, 0.4].map((dx, i) => (
            <mesh key={i} material={mat('#6b4a2b')} position={[dx, 0.9, (i % 2) * 0.2 - 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.08, 2]} />
            </mesh>
          ))}
          <mesh material={mat('#ffffff', { rough: 1 })} position={[0.7, 0.92, 0.2]} scale={[1, 0.4, 1]}>
            <sphereGeometry args={[0.07, 8, 6]} />
          </mesh>
        </group>
        <EvidenceGlow id="clue_footprints" x={-36} y={1.3} z={2.8} />
        {/* Witness stand */}
        <group position={[-40, 0, 12.3]}>
          <mesh material={wood} position={[0, 0.6, 0]} castShadow>
            <boxGeometry args={[2, 1.2, 1.4]} />
          </mesh>
          <mesh material={goldMat()} position={[0, 1.22, 0]}>
            <boxGeometry args={[2.05, 0.05, 1.45]} />
          </mesh>
        </group>
        <EvidenceGlow id="clue_witness" x={-40} y={1.7} z={12} />
        {/* Document desk with the kitchen log */}
        <group position={[-33, 0, 12.3]}>
          <mesh material={woodLight} position={[0, 0.8, 0]} castShadow>
            <boxGeometry args={[2, 0.08, 1.4]} />
          </mesh>
          <mesh material={woodLight} position={[0, 0.4, 0]}>
            <boxGeometry args={[1.8, 0.8, 1.2]} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} material={paper} position={[-0.4 + i * 0.35, 0.86 + i * 0.01, 0]} rotation={[0, i * 0.3, 0]}>
              <boxGeometry args={[0.42, 0.01, 0.56]} />
            </mesh>
          ))}
          <mesh material={mat('#7a3b4b')} position={[0.6, 0.9, -0.3]}>
            <boxGeometry args={[0.45, 0.1, 0.35]} />
          </mesh>
        </group>
        <EvidenceGlow id="clue_log" x={-33} y={1.3} z={12.3} />
        {/* Gallery benches */}
        <mesh material={green} position={[-32.25, 0.45, -0.7]} castShadow>
          <boxGeometry args={[3.5, 0.9, 1]} />
        </mesh>
        {/* Beautiful windows with golden sunlight */}
        {[-42, -37, -32].map((x) => (
          <group key={x}>
            <mesh material={mat('#fff4d6', { emissive: '#ffe2a0', emissiveIntensity: 0.9 })} position={[x, 3.4, -1.98]}>
              <planeGeometry args={[1.6, 2.8]} />
            </mesh>
            <mesh material={goldMat()} position={[x, 4.8, -1.96]}>
              <torusGeometry args={[0.8, 0.07, 6, 16, Math.PI]} />
            </mesh>
          </group>
        ))}
        <pointLight color="#ffe0a0" intensity={6} distance={16} position={[-37, 4.2, 0.5]} />
        <pointLight color="#ffe6c0" intensity={4} distance={14} position={[-37, 4.5, 6]} />
        {/* Red carpet aisle */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-35.5, 0.13, 7]}>
          <planeGeometry args={[14, 1.6]} />
          <meshStandardMaterial color="#9a3f55" roughness={1} />
        </mesh>
        <mesh material={mat(PALETTE.gold, { rough: 0.4, metal: 0.6 })} position={[-45.9, 4.2, 6]} rotation={[0, Math.PI / 2, 0]}>
          <circleGeometry args={[0.9, 24]} />
        </mesh>
      </Pavilion>
    </Proximity>
  );
}
