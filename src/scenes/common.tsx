import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { glowTexture, goldMat, mat, PALETTE } from '../components/game/materials';
import { useWaterMaterial } from '../components/game/Terrain';
import { useQuality } from '../components/game/quality';
import { runtime } from '../systems/runtime';
import type { BoxShape } from '../systems/WorldManager/worldTypes';

/** Hides its children while the camera is far away (cheap culling for big set pieces). */
export function Proximity({ x, z, radius = 70, children }: { x: number; z: number; radius?: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const q = useQuality();
  const r = radius * (q.tier === 'low' ? 0.7 : q.tier === 'medium' ? 0.85 : 1);
  useFrame(({ camera }) => {
    if (!ref.current) return;
    const d = Math.hypot(camera.position.x - x, camera.position.z - z);
    ref.current.visible = d < r;
  });
  return <group ref={ref}>{children}</group>;
}

/** Roof that fades away while the Princess is inside the building, so the camera can see her. */
export function FadingRoof({ region, children }: { region: BoxShape; children: (m: THREE.Material) => ReactNode }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: PALETTE.roof, roughness: 0.7, transparent: true, opacity: 1 }), []);
  useFrame((_, dt) => {
    const p = runtime.player;
    const inside = p.area === 'overworld' && p.x > region.minX && p.x < region.maxX && p.z > region.minZ && p.z < region.maxZ;
    const target = inside ? 0 : 1;
    material.opacity += (target - material.opacity) * Math.min(1, dt * 5);
    material.visible = material.opacity > 0.03;
    material.depthWrite = material.opacity > 0.95;
  });
  return <>{children(material)}</>;
}

export function Fountain({ x, z, scale = 1 }: { x: number; z: number; scale?: number }) {
  const water = useWaterMaterial(0.85);
  const jets = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!jets.current) return;
    jets.current.children.forEach((c, i) => {
      const t = (runtime.time * 0.9 + i / jets.current!.children.length) % 1;
      c.position.y = 1.9 + Math.sin(t * Math.PI) * 0.9;
      const r = t * 1.4;
      const a = (i / jets.current!.children.length) * Math.PI * 2;
      c.position.x = Math.cos(a) * r;
      c.position.z = Math.sin(a) * r;
      c.scale.setScalar(1 - t * 0.5);
    });
  });
  const stone = mat(PALETTE.stone, { rough: 0.7 });
  return (
    <group position={[x, 0, z]} scale={scale}>
      <mesh material={stone} position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.4, 2.55, 0.6, 32]} />
      </mesh>
      <mesh material={water} position={[0, 0.62, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.15, 32]} />
      </mesh>
      <mesh material={stone} position={[0, 1.05, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.4, 1.2, 14]} />
      </mesh>
      <mesh material={stone} position={[0, 1.65, 0]} castShadow>
        <cylinderGeometry args={[0.9, 0.5, 0.25, 22]} />
      </mesh>
      <mesh material={water} position={[0, 1.78, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.8, 22]} />
      </mesh>
      <mesh material={goldMat()} position={[0, 2.05, 0]}>
        <sphereGeometry args={[0.18, 12, 10]} />
      </mesh>
      <group ref={jets} userData={{ noBatch: true }}>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i} material={mat('#d9f0ff', { transparent: true, opacity: 0.75, emissive: '#bfe6ff', emissiveIntensity: 0.4 })}>
            <sphereGeometry args={[0.07, 6, 5]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function LampPost({ x, z, color = '#ffe2a8' }: { x: number; z: number; color?: string }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(() => {
    if (ref.current) ref.current.intensity = 0.4 + runtime.weather.night * 5 + runtime.weather.storm * 2;
  });
  return (
    <group position={[x, 0, z]}>
      <mesh material={goldMat()} position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.06, 0.09, 2.8, 8]} />
      </mesh>
      <mesh material={mat(color, { emissive: color, emissiveIntensity: 1.6 })} position={[0, 2.95, 0]}>
        <sphereGeometry args={[0.2, 12, 10]} />
      </mesh>
      <mesh material={goldMat()} position={[0, 3.2, 0]}>
        <coneGeometry args={[0.25, 0.25, 8]} />
      </mesh>
      <pointLight ref={ref} color={color} intensity={0.5} distance={10} decay={1.8} position={[0, 2.9, 0]} />
    </group>
  );
}

export function Bench({ x, z, rot = 0, color = PALETTE.wood }: { x: number; z: number; rot?: number; color?: string }) {
  const wood = mat(color, { rough: 0.8 });
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh material={wood} position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 0.1, 0.6]} />
      </mesh>
      <mesh material={wood} position={[0, 0.85, -0.27]} castShadow>
        <boxGeometry args={[2.2, 0.55, 0.08]} />
      </mesh>
      {[-0.95, 0.95].map((dx) => (
        <mesh key={dx} material={goldMat()} position={[dx, 0.22, 0]}>
          <boxGeometry args={[0.08, 0.45, 0.55]} />
        </mesh>
      ))}
    </group>
  );
}

export function Pillar({ x, z, h = 4, r = 0.32, material }: { x: number; z: number; h?: number; r?: number; material?: THREE.Material }) {
  const m = material ?? mat(PALETTE.ivory, { rough: 0.6 });
  return (
    <group position={[x, 0, z]}>
      <mesh material={m} position={[0, h / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r, r * 1.1, h, 14]} />
      </mesh>
      <mesh material={goldMat()} position={[0, h + 0.08, 0]}>
        <boxGeometry args={[r * 2.6, 0.18, r * 2.6]} />
      </mesh>
      <mesh material={goldMat()} position={[0, 0.08, 0]}>
        <boxGeometry args={[r * 2.6, 0.16, r * 2.6]} />
      </mesh>
    </group>
  );
}

/** Box mesh straight from a collider rectangle. */
export function WallFromBox({ b, h, material, y0 = 0 }: { b: BoxShape; h: number; material: THREE.Material; y0?: number }) {
  return (
    <mesh material={material} position={[(b.minX + b.maxX) / 2, y0 + h / 2, (b.minZ + b.maxZ) / 2]} castShadow receiveShadow>
      <boxGeometry args={[b.maxX - b.minX, h, b.maxZ - b.minZ]} />
    </mesh>
  );
}

/** Soft additive glow sprite. */
export function Glow({ position, color = '#ffe3a3', size = 1.5, opacity = 0.8 }: { position: [number, number, number]; color?: string; size?: number; opacity?: number }) {
  const m = useMemo(
    () => new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }),
    [color, opacity],
  );
  return <sprite position={position} scale={[size, size, size]} material={m} />;
}

/** Gentle bobbing + rotation for magical objects. */
export function Floating({ children, amp = 0.08, speed = 1.4, spin = 0, offset = 0 }: { children: ReactNode; amp?: number; speed?: number; spin?: number; offset?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.y = Math.sin(runtime.time * speed + offset) * amp;
    ref.current.rotation.y = runtime.time * spin + offset;
  });
  return (
    <group ref={ref} userData={{ noBatch: true }}>
      {children}
    </group>
  );
}
