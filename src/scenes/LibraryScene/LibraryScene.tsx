import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { gameConfig } from '../../config/gameConfig';
import { goldMat, mat, PALETTE } from '../../components/game/materials';
import { useGameStore } from '../../stores/gameStore';
import { runtime } from '../../systems/runtime';
import { ROOF_REGIONS, SPOT_BY_ID } from '../../systems/WorldManager/worldLayout';
import { mulberry32 } from '../../utils/rng';
import { Floating, Glow, Proximity } from '../common';
import { Pavilion } from '../Pavilion';

const BOOK_COLORS = ['#c97b93', '#8f78b8', '#d4a84f', '#e8899e', '#7aa6c2', '#9ac28a', '#f3dca4', '#b85c78'];
const o = new THREE.Object3D();
const c = new THREE.Color();

/** Instanced books filling a shelf box. */
function Shelf({ x, z, w, d, h = 4.4 }: { x: number; z: number; w: number; d: number; h?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const horizontal = w > d;
  const length = horizontal ? w : d;
  const rows = 5;
  const perRow = Math.floor(length / 0.14);
  const count = rows * perRow;
  useLayoutEffect(() => {
    const rng = mulberry32(Math.round(x * 100 + z));
    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < perRow; k++) {
        const t = -length / 2 + (k + 0.5) * (length / perRow);
        const bh = 0.5 + rng() * 0.25;
        o.position.set(horizontal ? x + t : x, 0.4 + r * 0.82 + bh / 2, horizontal ? z : z + t);
        o.rotation.set(0, horizontal ? 0 : Math.PI / 2, (rng() - 0.5) * 0.06);
        o.scale.set(0.11, bh, 0.42);
        o.updateMatrix();
        ref.current!.setMatrixAt(i, o.matrix);
        ref.current!.setColorAt(i, c.set(BOOK_COLORS[Math.floor(rng() * BOOK_COLORS.length)]));
        i++;
      }
    }
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.instanceColor!.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [x, z, length, horizontal, perRow]);
  const wood = mat('#a77a58', { rough: 0.8 });
  return (
    <group>
      <mesh material={wood} position={[x, h / 2, z]} castShadow receiveShadow>
        <boxGeometry args={[horizontal ? w : w * 0.45, h, horizontal ? d * 0.45 : d]} />
      </mesh>
      {Array.from({ length: rows + 1 }, (_, r) => (
        <mesh key={r} material={wood} position={[x, 0.35 + r * 0.82, z]}>
          <boxGeometry args={[w, 0.06, d]} />
        </mesh>
      ))}
      <instancedMesh ref={ref} args={[undefined, undefined, count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.8} />
      </instancedMesh>
    </group>
  );
}

function MagicBook({ id, color, read }: { id: string; color: string; read: boolean }) {
  const s = SPOT_BY_ID[id];
  // Pedestal sits on the collider just behind the interaction point.
  const pedestal: Record<string, [number, number]> = { book1: [-38.5, -30], book2: [-34, -31.6], book3: [-29.5, -30], book4: [-39.2, -23.4] };
  const [px, pz] = pedestal[id] ?? [s.x, s.z];
  return (
    <group position={[px, 0, pz]} userData={{ noBatch: true }}>
      <mesh material={mat(PALETTE.ivory, { rough: 0.4 })} position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.32, 1.1, 12]} />
      </mesh>
      <mesh material={goldMat()} position={[0, 1.12, 0]}>
        <cylinderGeometry args={[0.38, 0.3, 0.06, 14]} />
      </mesh>
      <Floating amp={0.06} speed={1.6} spin={0.5} offset={px}>
        <group position={[0, 1.5, 0]} rotation={[0.3, 0, 0]}>
          {[-1, 1].map((sd) => (
            <mesh key={sd} material={mat(color, { emissive: color, emissiveIntensity: read ? 0.15 : 0.5, rough: 0.5 })} position={[sd * 0.16, 0, 0]} rotation={[0, 0, sd * 0.25]}>
              <boxGeometry args={[0.32, 0.03, 0.42]} />
            </mesh>
          ))}
          <mesh material={mat('#fffaf0', { rough: 0.8 })} position={[0, 0.03, 0]}>
            <boxGeometry args={[0.58, 0.04, 0.38]} />
          </mesh>
        </group>
      </Floating>
      {!read && <Glow position={[0, 1.55, 0]} size={1.6} color="#fff0c4" opacity={0.7} />}
    </group>
  );
}

function FloatingBooks() {
  const group = useRef<THREE.Group>(null);
  const books = useMemo(() => {
    const rng = mulberry32(17);
    return Array.from({ length: 14 }, () => ({ x: -41 + rng() * 14, z: -33 + rng() * 11, y: 3 + rng() * 1.6, r: rng() * 6, s: rng(), color: BOOK_COLORS[Math.floor(rng() * BOOK_COLORS.length)] }));
  }, []);
  useFrame(() => {
    group.current?.children.forEach((ch, i) => {
      const b = books[i];
      ch.position.y = b.y + Math.sin(runtime.time * 0.8 + b.r) * 0.25;
      ch.rotation.y = runtime.time * (0.2 + b.s * 0.3) + b.r;
      ch.rotation.z = Math.sin(runtime.time + b.r) * 0.2;
    });
  });
  return (
    <group ref={group} userData={{ noBatch: true }}>
      {books.map((b, i) => (
        <mesh key={i} material={mat(b.color, { rough: 0.6 })} position={[b.x, b.y, b.z]}>
          <boxGeometry args={[0.35, 0.08, 0.5]} />
        </mesh>
      ))}
    </group>
  );
}

export function LibraryScene() {
  const collected = useGameStore((s) => s.collected);
  const r = ROOF_REGIONS.library;
  const wood = mat('#b98a62', { rough: 0.7 });
  return (
    <Proximity x={-34} z={-27} radius={85}>
      <Pavilion region={r} wallColor="#f3e6d6" floorColor="#e9d6bf" roofColor="#c9a2c9" height={5.6} columns={[[-37.3, -19.7], [-30.7, -19.7]]}>
        <Shelf x={-34} z={-33.45} w={15} d={0.9} />
        <Shelf x={-41.45} z={-27} w={0.9} d={10} />
        <Shelf x={-26.55} z={-27} w={0.9} d={10} />
        {/* Reading table with lamps */}
        <group position={[-34, 0, -26]}>
          <mesh material={wood} position={[0, 0.85, 0]} castShadow>
            <boxGeometry args={[3.2, 0.1, 1.8]} />
          </mesh>
          {[[-1.4, -0.75], [1.4, -0.75], [-1.4, 0.75], [1.4, 0.75]].map(([x, z], i) => (
            <mesh key={i} material={wood} position={[x, 0.42, z]}>
              <boxGeometry args={[0.12, 0.84, 0.12]} />
            </mesh>
          ))}
          {[-1, 1].map((sd) => (
            <group key={sd} position={[sd * 1.0, 0.9, 0]}>
              <mesh material={goldMat()} position={[0, 0.25, 0]}>
                <cylinderGeometry args={[0.03, 0.06, 0.5, 8]} />
              </mesh>
              <mesh material={mat('#fff1d6', { emissive: '#ffdca0', emissiveIntensity: 1.4 })} position={[0, 0.55, 0]}>
                <coneGeometry args={[0.2, 0.22, 12, 1, true]} />
              </mesh>
              <pointLight color="#ffd9a0" intensity={4} distance={6} position={[0, 0.5, 0]} />
            </group>
          ))}
          {/* Open book on the table */}
          <mesh material={mat('#fffaf0', { rough: 0.8 })} position={[0, 0.92, 0.2]} rotation={[0, 0.2, 0]}>
            <boxGeometry args={[0.6, 0.03, 0.4]} />
          </mesh>
        </group>
        {/* Comfortable reading corner */}
        <group position={[-29.5, 0, -22.4]}>
          <mesh material={mat('#d8a7b1', { rough: 0.95 })} position={[0, 0.35, 0]} castShadow>
            <boxGeometry args={[1.4, 0.6, 1.2]} />
          </mesh>
          <mesh material={mat('#d8a7b1', { rough: 0.95 })} position={[0, 0.85, -0.5]}>
            <boxGeometry args={[1.4, 0.8, 0.25]} />
          </mesh>
          <mesh material={mat('#fffaf0', { rough: 0.9 })} position={[0.3, 0.75, 0.1]} scale={[0.5, 0.25, 0.4]}>
            <sphereGeometry args={[0.5, 10, 8]} />
          </mesh>
        </group>
        {gameConfig.CUSTOM_BOOK_MESSAGES.map((b) => (
          <MagicBook key={b.id} id={b.id} color={b.cover} read={collected[`book:${b.id}`] !== undefined} />
        ))}
        <FloatingBooks />
        <pointLight color="#ffe0b0" intensity={5} distance={14} position={[-34, 4.8, -27]} />
      </Pavilion>
    </Proximity>
  );
}
