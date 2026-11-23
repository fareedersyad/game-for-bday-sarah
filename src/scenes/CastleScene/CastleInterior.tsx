import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { BouquetModel } from '../../components/game/Characters';
import { goldMat, mat, PALETTE, roseGoldMat } from '../../components/game/materials';
import { useGameStore } from '../../stores/gameStore';
import { runtime } from '../../systems/runtime';
import { STATIC_COLLIDERS } from '../../systems/WorldManager/worldLayout';
import type { BoxShape } from '../../systems/WorldManager/worldTypes';
import { Floating, Glow, Pillar } from '../common';
import { StaticBatch } from '../../components/game/StaticBatch';
import { SecretRoomScene } from '../SecretRoomScene/SecretRoomScene';

const WALL_H = 7;

function checkerTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  for (let y = 0; y < 4; y++)
    for (let x = 0; x < 4; x++) {
      g.fillStyle = (x + y) % 2 ? '#e9eddc' : '#fbf9f2';
      g.fillRect(x * 32, y * 32, 32, 32);
    }
  g.strokeStyle = 'rgba(212,168,79,0.35)';
  g.lineWidth = 1.5;
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo(i * 32, 0);
    g.lineTo(i * 32, 128);
    g.moveTo(0, i * 32);
    g.lineTo(128, i * 32);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function CastleInterior() {
  const walls = STATIC_COLLIDERS.castle.filter((c) => c.tag === 'wall') as BoxShape[];
  const floorTex = useMemo(() => {
    const t = checkerTexture();
    t.repeat.set(11, 4.5);
    return t;
  }, []);
  const wallMat = mat(PALETTE.creamWarm, { rough: 0.85 });
  const wainscot = mat(PALETTE.ivory, { rough: 0.6 });
  const bouquetPlaced = useGameStore((s) => !!s.flags.bouquetPlaced);
  const letterRead = useGameStore((s) => !!s.flags.letterRead);

  return (
    <group>
      {/* Floor & ceiling */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[1, 0, 0]} receiveShadow>
        <planeGeometry args={[44, 18]} />
        <meshStandardMaterial map={floorTex} roughness={0.35} metalness={0.05} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[1, WALL_H, 0]}>
        <planeGeometry args={[44, 18]} />
        <meshStandardMaterial color={PALETTE.ivoryWarm} roughness={0.9} />
      </mesh>
      <StaticBatch>
      {/* Walls with gold-trimmed ivory wainscot */}
      {walls.map((w, i) => (
        <group key={i}>
          <mesh material={wallMat} position={[(w.minX + w.maxX) / 2, WALL_H / 2, (w.minZ + w.maxZ) / 2]} receiveShadow>
            <boxGeometry args={[w.maxX - w.minX, WALL_H, w.maxZ - w.minZ]} />
          </mesh>
          <mesh material={wainscot} position={[(w.minX + w.maxX) / 2, 0.6, (w.minZ + w.maxZ) / 2]}>
            <boxGeometry args={[w.maxX - w.minX + 0.06, 1.2, w.maxZ - w.minZ + 0.06]} />
          </mesh>
          <mesh material={goldMat()} position={[(w.minX + w.maxX) / 2, 1.22, (w.minZ + w.maxZ) / 2]}>
            <boxGeometry args={[w.maxX - w.minX + 0.08, 0.06, w.maxZ - w.minZ + 0.08]} />
          </mesh>
        </group>
      ))}
      {/* Doorway arches */}
      {[10.25, -10.25].map((x) => (
        <mesh key={x} material={goldMat()} position={[x, 3.4, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[1.65, 0.1, 8, 24, Math.PI]} />
        </mesh>
      ))}
      {[10.25, -10.25].map((x) => (
        <mesh key={x} material={wallMat} position={[x, 5.25, 0]}>
          <boxGeometry args={[0.5, 3.5, 3.2]} />
        </mesh>
      ))}

      <GrandHall bouquetPlaced={bouquetPlaced} />
      <Bedroom letterRead={letterRead} />
      </StaticBatch>
      <SecretDoor />
      <SecretRoomScene />

    </group>
  );
}

function GrandHall({ bouquetPlaced }: { bouquetPlaced: boolean }) {
  const carpet = mat(PALETTE.sage, { rough: 0.95 });
  const sofa = mat(PALETTE.sageSoft, { rough: 0.9 });
  const win = mat('#e6f3ff', { emissive: '#ffe8ef', emissiveIntensity: 0.85, rough: 0.1 });
  return (
    <group>
      {/* Carpet runner door → throne */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0.4]} receiveShadow>
        <planeGeometry args={[2.6, 14.6]} />
        <primitive object={carpet} attach="material" />
      </mesh>
      {[-1.3, 1.3].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.015, 0.4]}>
          <planeGeometry args={[0.1, 14.6]} />
          <primitive object={goldMat()} attach="material" />
        </mesh>
      ))}
      {[[-6, -4], [6, -4], [-6, 4], [6, 4]].map(([x, z]) => (
        <Pillar key={`${x}${z}`} x={x} z={z} h={WALL_H - 0.2} r={0.45} />
      ))}
      {/* Throne */}
      <group position={[0, 0, -7]}>
        <mesh material={goldMat()} position={[0, 0.25, 0.1]} castShadow>
          <boxGeometry args={[2.6, 0.5, 1.6]} />
        </mesh>
        <mesh material={goldMat()} position={[0, 1.2, -0.45]} castShadow>
          <boxGeometry args={[1.5, 2.2, 0.25]} />
        </mesh>
        <mesh material={goldMat()} position={[0, 2.5, -0.45]}>
          <sphereGeometry args={[0.55, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh material={mat(PALETTE.sageDeep, { rough: 0.95 })} position={[0, 0.62, 0.15]}>
          <boxGeometry args={[1.3, 0.22, 1.0]} />
        </mesh>
        <mesh material={mat(PALETTE.sageDeep, { rough: 0.95 })} position={[0, 1.25, -0.3]}>
          <boxGeometry args={[1.2, 1.6, 0.12]} />
        </mesh>
        <mesh material={mat(PALETTE.rose, { emissive: PALETTE.rose, emissiveIntensity: 0.4 })} position={[0, 2.35, -0.3]}>
          <octahedronGeometry args={[0.18, 0]} />
        </mesh>
      </group>
      {/* Sofas */}
      {[-7, 7].map((x) => (
        <group key={x} position={[x, 0, 6]}>
          <mesh material={sofa} position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[3.2, 0.5, 1.1]} />
          </mesh>
          <mesh material={sofa} position={[0, 0.8, 0.45]} castShadow>
            <boxGeometry args={[3.2, 0.7, 0.25]} />
          </mesh>
          {[-1.55, 1.55].map((dx) => (
            <mesh key={dx} material={sofa} position={[dx, 0.6, 0]}>
              <boxGeometry args={[0.2, 0.5, 1.1]} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Vase table with the first bouquet */}
      <group position={[6.5, 0, -6.6]}>
        <mesh material={mat(PALETTE.ivory, { rough: 0.4 })} position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.65, 0.4, 1, 18]} />
        </mesh>
        <mesh material={mat('#e6f0ff', { rough: 0.1, metal: 0.2, transparent: true, opacity: 0.7 })} position={[0, 1.3, 0]}>
          <cylinderGeometry args={[0.18, 0.12, 0.6, 14]} />
        </mesh>
        {bouquetPlaced && (
          <group position={[0, 1.35, 0]} scale={0.95} userData={{ noBatch: true }}>
            <BouquetModel />
          </group>
        )}
      </group>
      {/* Music box */}
      <group position={[-6.5, 0, -6.6]}>
        <mesh material={mat(PALETTE.ivory, { rough: 0.4 })} position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.55, 0.38, 1, 18]} />
        </mesh>
        <mesh material={roseGoldMat()} position={[0, 1.15, 0]}>
          <boxGeometry args={[0.5, 0.3, 0.36]} />
        </mesh>
        <Floating amp={0.04} spin={1.2}>
          <mesh material={mat(PALETTE.blush, { emissive: '#ffd3e0', emissiveIntensity: 0.6 })} position={[0, 1.45, 0]}>
            <coneGeometry args={[0.08, 0.22, 8]} />
          </mesh>
        </Floating>
      </group>
      {/* Windows */}
      {[-6, 0, 6].map((x) => (
        <group key={x} position={[x, 3.6, -7.95]}>
          <mesh material={win}>
            <planeGeometry args={[1.6, 3]} />
          </mesh>
          <mesh material={goldMat()} position={[0, 1.5, 0.02]}>
            <torusGeometry args={[0.8, 0.07, 6, 16, Math.PI]} />
          </mesh>
        </group>
      ))}
      {/* Entrance doors */}
      <group position={[0, 0, 7.98]}>
        {[-0.8, 0.8].map((x) => (
          <mesh key={x} material={roseGoldMat()} position={[x, 1.7, 0]}>
            <boxGeometry args={[1.5, 3.4, 0.1]} />
          </mesh>
        ))}
        <mesh material={roseGoldMat()} position={[0, 3.4, 0]} rotation={[0, 0, 0]}>
          <torusGeometry args={[1.6, 0.12, 8, 20, Math.PI]} />
        </mesh>
      </group>
      <Chandelier x={0} z={0} />
      <Chandelier x={16.2} z={0} small />
    </group>
  );
}

function Chandelier({ x, z, small = false }: { x: number; z: number; small?: boolean }) {
  const crystal = mat('#fff7fb', { emissive: '#fff2d9', emissiveIntensity: 1.2, rough: 0.1 });
  const s = small ? 0.7 : 1;
  return (
    <group position={[x, WALL_H - 1.6 * s, z]} scale={s}>
      <mesh material={goldMat()}>
        <torusGeometry args={[1.1, 0.06, 8, 30]} />
      </mesh>
      <mesh material={goldMat()} position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 1.6, 6]} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return (
          <mesh key={i} material={crystal} position={[Math.cos(a) * 1.1, -0.18, Math.sin(a) * 1.1]}>
            <octahedronGeometry args={[0.1, 0]} />
          </mesh>
        );
      })}
      <pointLight color="#fff1dd" intensity={small ? 10 : 18} distance={small ? 12 : 18} decay={1.5} castShadow={false} />
      <Glow position={[0, -0.1, 0]} size={3} color="#fff3dd" opacity={0.5} />
    </group>
  );
}

function Bedroom({ letterRead }: { letterRead: boolean }) {
  const drape = mat(PALETTE.sageSoft, { rough: 0.9, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const sheets = mat('#fffaf4', { rough: 0.9 });
  const wood = mat('#f1e0d0', { rough: 0.6 });
  const envRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (envRef.current) envRef.current.position.y = 1.02 + (letterRead ? 0 : Math.sin(runtime.time * 2) * 0.03);
  });
  return (
    <group>
      {/* Rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[16.5, 0.012, 0.5]}>
        <circleGeometry args={[3.2, 40]} />
        <meshStandardMaterial color={PALETTE.sageSoft} roughness={1} />
      </mesh>
      {/* Canopy bed */}
      <group position={[19.45, 0, -3.7]}>
        <mesh material={wood} position={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[4.9, 0.6, 4.2]} />
        </mesh>
        <mesh material={sheets} position={[0, 0.72, 0]} castShadow>
          <boxGeometry args={[4.7, 0.3, 4]} />
        </mesh>
        <mesh material={mat(PALETTE.sage, { rough: 0.9 })} position={[-0.5, 0.9, 0]}>
          <boxGeometry args={[3.4, 0.12, 4.05]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} material={sheets} position={[2.0, 1.0, s * 0.95]} scale={[0.5, 0.25, 0.8]}>
            <sphereGeometry args={[0.7, 14, 10]} />
          </mesh>
        ))}
        {[[-2.3, -1.95], [2.3, -1.95], [-2.3, 1.95], [2.3, 1.95]].map(([x, z], i) => (
          <mesh key={i} material={goldMat()} position={[x, 2.2, z]}>
            <cylinderGeometry args={[0.07, 0.07, 4.4, 8]} />
          </mesh>
        ))}
        <mesh material={drape} position={[0, 4.4, 0]}>
          <boxGeometry args={[4.8, 0.1, 4.1]} />
        </mesh>
        {[-2.35, 2.35].map((x) => (
          <mesh key={x} material={drape} position={[x, 3.2, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[4.1, 2.4]} />
          </mesh>
        ))}
      </group>
      {/* Bedside table with the sealed envelope */}
      <group position={[16.1, 0, -5.2]}>
        <mesh material={wood} position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[1, 0.9, 1.1]} />
        </mesh>
        <mesh material={goldMat()} position={[0, 0.92, 0]}>
          <boxGeometry args={[1.05, 0.04, 1.15]} />
        </mesh>
        <group ref={envRef} position={[0, 1.02, 0]} rotation={[0, 0.3, 0]} userData={{ noBatch: true }}>
          <mesh material={mat('#fbe3ea', { rough: 0.7 })}>
            <boxGeometry args={[0.55, 0.03, 0.38]} />
          </mesh>
          <mesh material={mat('#b8466a', { rough: 0.4, emissive: '#b8466a', emissiveIntensity: 0.3 })} position={[0, 0.025, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 0.02, 14]} />
          </mesh>
          {!letterRead && <Glow position={[0, 0.15, 0]} size={1.2} color="#ffd1dc" opacity={0.7} />}
        </group>
        {/* Little lamp */}
        <mesh material={mat('#fff2d6', { emissive: '#ffe3b3', emissiveIntensity: 1 })} position={[0.3, 1.25, -0.3]}>
          <sphereGeometry args={[0.12, 10, 8]} />
        </mesh>
        <pointLight color="#ffe3b3" intensity={3} distance={5} position={[0.3, 1.4, -0.3]} />
      </group>
      {/* Wardrobe */}
      <mesh material={wood} position={[21.25, 1.6, 4]} castShadow>
        <boxGeometry args={[1.3, 3.2, 3.6]} />
      </mesh>
      <mesh material={goldMat()} position={[20.58, 1.6, 4]}>
        <boxGeometry args={[0.04, 2.6, 0.05]} />
      </mesh>
      {/* Chair */}
      <group position={[13, 0, -4.6]}>
        <mesh material={mat(PALETTE.sageSoft, { rough: 0.9 })} position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.8, 0.12, 0.8]} />
        </mesh>
        <mesh material={mat(PALETTE.sageSoft, { rough: 0.9 })} position={[0, 0.9, -0.36]}>
          <boxGeometry args={[0.8, 0.8, 0.1]} />
        </mesh>
        {[[-0.33, -0.33], [0.33, -0.33], [-0.33, 0.33], [0.33, 0.33]].map(([x, z], i) => (
          <mesh key={i} material={goldMat()} position={[x, 0.2, z]}>
            <cylinderGeometry args={[0.03, 0.03, 0.42, 6]} />
          </mesh>
        ))}
      </group>
      {/* Window */}
      <mesh material={mat('#e6f3ff', { emissive: '#ffe8ef', emissiveIntensity: 0.9 })} position={[21.95, 3.6, -0.5]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[2.2, 3]} />
      </mesh>
    </group>
  );
}

function SecretDoor() {
  const door = useRef<THREE.Group>(null);
  const unlocked = useGameStore((s) => !!s.flags.secretUnlocked);
  const seal = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (door.current) door.current.rotation.y = runtime.anim.secretDoor * 1.6;
    if (seal.current) seal.current.rotation.z = runtime.time * 0.5;
  });
  return (
    <group position={[-10.25, 0, 0]}>
      <group ref={door} position={[0, 0, -1.55]}>
        <mesh material={mat('#9c85c8', { rough: 0.5, metal: 0.2 })} position={[0, 1.7, 1.55]} castShadow>
          <boxGeometry args={[0.22, 3.4, 3.1]} />
        </mesh>
        {/* Carved flower & star motif */}
        <mesh ref={seal} material={mat(unlocked ? '#ffe3a3' : '#e7c98f', { emissive: unlocked ? '#ffd27a' : '#6b4a8c', emissiveIntensity: unlocked ? 1.2 : 0.4, metal: 0.6, rough: 0.3 })} position={[0.13, 2, 1.55]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.5, 0.06, 6, 5]} />
        </mesh>
      </group>
      <Glow position={[0.4, 2, 0]} size={unlocked ? 4 : 1.6} color={unlocked ? '#ffe3a3' : '#c3b1e1'} opacity={unlocked ? 0.7 : 0.4} />
    </group>
  );
}
