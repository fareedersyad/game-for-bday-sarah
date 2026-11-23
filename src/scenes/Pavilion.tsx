import type { ReactNode } from 'react';
import * as THREE from 'three';
import { goldMat, mat } from '../components/game/materials';
import { STATIC_COLLIDERS } from '../systems/WorldManager/worldLayout';
import type { BoxShape } from '../systems/WorldManager/worldTypes';
import { FadingRoof, Pillar, WallFromBox } from './common';
import { StaticBatch } from '../components/game/StaticBatch';

interface PavilionProps {
  region: BoxShape;
  wallColor: string;
  floorColor: string;
  roofColor: string;
  height?: number;
  /** Columns flanking the entrance. */
  columns?: Array<[number, number]>;
  children?: ReactNode;
}

/** Generic open-fronted building: walls from colliders, floor slab, fading pitched roof. */
export function Pavilion({ region, wallColor, floorColor, roofColor, height = 5, columns = [], children }: PavilionProps) {
  const walls = STATIC_COLLIDERS.overworld.filter(
    (c) => c.tag === 'wall' && c.kind === 'box' && c.minX >= region.minX - 0.6 && c.maxX <= region.maxX + 0.6 && c.minZ >= region.minZ - 0.6 && c.maxZ <= region.maxZ + 0.6,
  ) as BoxShape[];
  const wall = mat(wallColor, { rough: 0.8 });
  const w = region.maxX - region.minX;
  const d = region.maxZ - region.minZ;
  const cx = (region.minX + region.maxX) / 2;
  const cz = (region.minZ + region.maxZ) / 2;
  return (
    <StaticBatch>
      <mesh material={mat(floorColor, { rough: 0.45 })} position={[cx, 0.06, cz]} receiveShadow>
        <boxGeometry args={[w, 0.12, d]} />
      </mesh>
      {walls.map((b, i) => (
        <group key={i}>
          <WallFromBox b={b} h={height} material={wall} />
          <mesh material={goldMat()} position={[(b.minX + b.maxX) / 2, height + 0.06, (b.minZ + b.maxZ) / 2]}>
            <boxGeometry args={[b.maxX - b.minX + 0.1, 0.12, b.maxZ - b.minZ + 0.1]} />
          </mesh>
        </group>
      ))}
      {columns.map(([x, z]) => (
        <Pillar key={`${x}${z}`} x={x} z={z} h={height} r={0.3} />
      ))}
      <FadingRoof region={region}>
        {(m) => {
          (m as THREE.MeshStandardMaterial).color.set(roofColor);
          return (
            <group position={[cx, height, cz]}>
              <mesh material={m} position={[0, 0.15, 0]}>
                <boxGeometry args={[w + 0.8, 0.3, d + 0.8]} />
              </mesh>
              <mesh material={m} position={[0, 1.7, 0]} rotation={[0, Math.PI / 4, 0]} scale={[w / d > 1 ? w / d : 1, 1, w / d > 1 ? 1 : d / w]}>
                <coneGeometry args={[(Math.min(w, d) / 2 + 0.6) * Math.SQRT2, 2.8, 4]} />
              </mesh>
            </group>
          );
        }}
      </FadingRoof>
      {children}
    </StaticBatch>
  );
}
