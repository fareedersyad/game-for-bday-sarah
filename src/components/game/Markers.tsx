import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../stores/worldStore';
import { useUI } from '../../stores/uiStore';
import { runtime } from '../../systems/runtime';
import { SPOT_BY_ID } from '../../systems/WorldManager/worldLayout';
import type { MarkerKind } from '../../systems/Interaction/registry';
import { glowTexture, mat, starShape } from './materials';
import { groundHeight } from './Terrain';

function MarkerAt({ id, kind }: { id: string; kind: MarkerKind }) {
  const spot = SPOT_BY_ID[id];
  const ref = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const isStar = id.startsWith('star_');
  const base = spot.area === 'overworld' ? groundHeight(spot.x, spot.z) : 0;
  const seed = spot.x * 0.37 + spot.z * 0.11;
  const sprite = useMemo(
    () => new THREE.SpriteMaterial({ map: glowTexture(), color: kind === 'quest' ? '#ffe3a3' : kind === 'item' ? '#ffc4d6' : '#fff6c8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }),
    [kind],
  );
  useFrame(() => {
    const g = ref.current;
    if (!g) return;
    const t = runtime.time;
    g.position.y = base + (spot.markerHeight ?? 2) + Math.sin(t * 2.2 + seed) * 0.12;
    g.rotation.y = t * 1.6 + seed;
    // Hide markers far away (keeps the world clean) except quest markers.
    const d = Math.hypot(runtime.player.x - spot.x, runtime.player.z - spot.z);
    g.visible = kind === 'quest' ? d < 60 : d < 24;
    if (ring.current) {
      const s = 1 + ((t * 0.8 + seed) % 1) * 0.8;
      ring.current.scale.set(s, s, s);
      (ring.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - ((t * 0.8 + seed) % 1));
      ring.current.visible = g.visible && d < 30;
    }
  });
  const color = kind === 'quest' ? '#f3c96b' : kind === 'item' ? '#f19bb4' : '#fff1a8';
  return (
    <group>
      <group ref={ref} position={[spot.x, base + 2, spot.z]}>
        {isStar ? (
          <mesh material={mat('#fff1a8', { emissive: '#ffd56a', emissiveIntensity: 1.6 })} position={[0, -0.5, 0]} scale={0.7}>
            <extrudeGeometry args={[starShape(0.5, 0.22), { depth: 0.12, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 1 }]} />
          </mesh>
        ) : kind === 'quest' ? (
          <mesh material={mat(color, { emissive: color, emissiveIntensity: 1.1, metal: 0.4, rough: 0.3 })} scale={[0.22, 0.34, 0.22]}>
            <octahedronGeometry args={[1, 0]} />
          </mesh>
        ) : kind === 'item' ? (
          <mesh material={mat(color, { emissive: color, emissiveIntensity: 1, rough: 0.3 })} scale={[0.14, 0.2, 0.14]}>
            <octahedronGeometry args={[1, 0]} />
          </mesh>
        ) : null}
        <sprite material={sprite} scale={kind === 'quest' ? 1.4 : isStar ? 1.6 : 0.7} position={[0, isStar ? -0.45 : 0, 0]} />
      </group>
      {kind === 'quest' && (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[spot.x, base + 0.08, spot.z]}>
          <ringGeometry args={[0.55, 0.68, 32]} />
          <meshBasicMaterial color="#ffe3a3" transparent depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/** Floating quest markers / item glints for every currently available interactable. */
export function Markers() {
  const spots = useWorld((s) => s.activeSpots);
  // Markers never float in front of the characters during story scenes.
  const inCutscene = useUI((s) => !!s.cutscene?.active);
  return (
    <group visible={!inCutscene}>
      {spots
        .filter((s) => s.marker !== null)
        .map((s) => (
          <MarkerAt key={s.id} id={s.id} kind={s.marker} />
        ))}
    </group>
  );
}
