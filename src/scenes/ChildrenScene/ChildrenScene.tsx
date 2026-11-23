import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { goldMat, mat, starShape } from '../../components/game/materials';
import { FlowerField, type FlowerInstance } from '../../components/game/Vegetation';
import { useGameStore } from '../../stores/gameStore';
import { runtime } from '../../systems/runtime';
import { mulberry32 } from '../../utils/rng';
import { StaticBatch } from '../../components/game/StaticBatch';
import { Floating, Glow, Proximity } from '../common';

const CANDY = ['#f7a9c0', '#a9d8f5', '#fbe38c', '#b9e6a5', '#d6c1f5', '#ffc59e'];

/** A round, fluffy, family-friendly fantasy creature. */
export function Creature({ color, happy = true, scale = 1 }: { color: string; happy?: boolean; scale?: number }) {
  const body = mat(color, { rough: 0.95 });
  const white = mat('#ffffff', { rough: 0.4 });
  const dark = mat('#3d2633', { rough: 0.4 });
  return (
    <group scale={scale}>
      <StaticBatch>
      <mesh material={body} position={[0, 0.45, 0]} castShadow>
        <sphereGeometry args={[0.45, 20, 16]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh material={body} position={[s * 0.24, 0.88, -0.02]} rotation={[0, 0, -s * 0.4]}>
            <coneGeometry args={[0.1, 0.25, 10]} />
          </mesh>
          <mesh material={white} position={[s * 0.15, 0.55, 0.37]}>
            <sphereGeometry args={[0.1, 12, 10]} />
          </mesh>
          <mesh material={dark} position={[s * 0.15, happy ? 0.56 : 0.53, 0.45]}>
            <sphereGeometry args={[0.055, 10, 8]} />
          </mesh>
          <mesh material={mat('#ff9fbd', { rough: 0.8, transparent: true, opacity: 0.7 })} position={[s * 0.27, 0.42, 0.33]} scale={[1, 0.6, 0.4]}>
            <sphereGeometry args={[0.06, 8, 6]} />
          </mesh>
          <mesh material={body} position={[s * 0.18, 0.06, 0.12]} scale={[1, 0.5, 1.3]}>
            <sphereGeometry args={[0.11, 8, 6]} />
          </mesh>
        </group>
      ))}
      <mesh material={dark} position={[0, 0.38, 0.43]} rotation={[0, 0, happy ? Math.PI : 0]}>
        <torusGeometry args={[0.05, 0.012, 4, 10, Math.PI]} />
      </mesh>
      {!happy && (
        <mesh material={mat('#9fd8ff', { emissive: '#9fd8ff', emissiveIntensity: 0.5 })} position={[0.17, 0.44, 0.44]} scale={[0.6, 1, 0.6]}>
          <sphereGeometry args={[0.03, 6, 6]} />
        </mesh>
      )}
      </StaticBatch>
    </group>
  );
}

function StarToy() {
  return (
    <mesh material={mat('#fbe38c', { emissive: '#ffd56a', emissiveIntensity: 0.6, rough: 0.9 })} scale={0.4}>
      <extrudeGeometry args={[starShape(0.5, 0.24), { depth: 0.18, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2 }]} />
    </mesh>
  );
}

function Wanderer({ cx, cz, r, color, speed, phase }: { cx: number; cz: number; r: number; color: string; speed: number; phase: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const t = runtime.time * speed + phase;
    ref.current.position.set(cx + Math.cos(t) * r, Math.abs(Math.sin(t * 6)) * 0.12, cz + Math.sin(t) * r);
    ref.current.rotation.y = -t + (speed > 0 ? 0 : Math.PI);
  });
  return (
    <group ref={ref} userData={{ noBatch: true }}>
      <Creature color={color} scale={0.55} />
    </group>
  );
}

export function ChildrenScene() {
  const toyFound = useGameStore((s) => !!s.flags.toyFound);
  const toyReturned = useGameStore((s) => !!s.flags.toyReturned);
  const carousel = useRef<THREE.Group>(null);
  const swingA = useRef<THREE.Group>(null);
  const swingB = useRef<THREE.Group>(null);
  const seesaw = useRef<THREE.Group>(null);
  const momo = useRef<THREE.Group>(null);
  const ball = useRef<THREE.Group>(null);

  useFrame(() => {
    const t = runtime.time;
    if (carousel.current) carousel.current.rotation.y = t * 0.35;
    if (swingA.current) swingA.current.rotation.x = Math.sin(t * 1.8) * 0.45;
    if (swingB.current) swingB.current.rotation.x = Math.sin(t * 1.8 + 1.4) * 0.35;
    if (seesaw.current) seesaw.current.rotation.z = Math.sin(t * 1.2) * 0.22;
    if (momo.current) {
      momo.current.position.y = toyReturned ? Math.abs(Math.sin(t * 5)) * 0.25 : Math.sin(t * 2) * 0.02;
      const p = runtime.player;
      momo.current.rotation.y = Math.atan2(p.x - 31, p.z - 35);
    }
    if (ball.current) {
      const k = runtime.anim.ballKick; // 1 → 0 after a kick
      const travel = Math.sin(k * Math.PI) * 2.2;
      const dir = runtime.anim.ballDir;
      ball.current.position.set(33.6 + Math.sin(dir) * travel, 0.25 + Math.abs(Math.sin(k * Math.PI * 3)) * 0.4 * k, 37.8 + Math.cos(dir) * travel);
      ball.current.rotation.x = k * 12;
    }
  });

  const flowers = useMemo(() => {
    const rng = mulberry32(21);
    const out: FlowerInstance[] = [];
    for (let i = 0; i < 120; i++) {
      const x = 19 + rng() * 29;
      const z = 25 + rng() * 22;
      if (x > 23 && x < 47 && z > 27 && z < 45) continue;
      out.push({ x, z, color: CANDY[Math.floor(rng() * CANDY.length)], scale: 1 + rng() * 0.6, kind: rng() < 0.4 ? 'cluster' : 'round' });
    }
    return out;
  }, []);

  const pastel = (i: number) => mat(CANDY[i % CANDY.length], { rough: 0.6 });

  return (
    <Proximity x={33} z={36} radius={85}>
      <StaticBatch>
      {/* Soft playground mat */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[33, 0.04, 36]} receiveShadow>
        <circleGeometry args={[12.5, 48]} />
        <meshStandardMaterial color="#f6e4ec" roughness={1} />
      </mesh>
      {/* Slide */}
      <group position={[38.25, 0, 30]}>
        <mesh material={pastel(1)} position={[0, 1.4, -1.6]} castShadow>
          <boxGeometry args={[2.2, 0.15, 1.2]} />
        </mesh>
        {[[-1, -2.1], [1, -2.1], [-1, -1.1], [1, -1.1]].map(([x, z], i) => (
          <mesh key={i} material={pastel(2)} position={[x, 0.7, z]}>
            <cylinderGeometry args={[0.07, 0.07, 1.4, 8]} />
          </mesh>
        ))}
        <mesh material={pastel(0)} position={[0, 0.75, 0.6]} rotation={[0.62, 0, 0]} castShadow>
          <boxGeometry args={[1, 0.08, 3.2]} />
        </mesh>
        <mesh material={pastel(4)} position={[0, 0.8, -2.25]} rotation={[-0.3, 0, 0]}>
          <boxGeometry args={[0.9, 0.06, 1.8]} />
        </mesh>
      </group>
      {/* Swings */}
      <group position={[28, 0, 29.5]}>
        {[-2.5, 2.5].map((x) => (
          <mesh key={x} material={pastel(3)} position={[x, 1.4, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.12, 2.8, 8]} />
          </mesh>
        ))}
        <mesh material={pastel(3)} position={[0, 2.8, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 5.2, 8]} />
        </mesh>
        {[[-1.1, swingA], [1.1, swingB]].map(([x, ref], i) => (
          <group key={i} ref={ref as React.RefObject<THREE.Group>} position={[x as number, 2.8, 0]} userData={{ noBatch: true }}>
            {[-0.3, 0.3].map((dx) => (
              <mesh key={dx} material={goldMat()} position={[dx, -1.0, 0]}>
                <cylinderGeometry args={[0.015, 0.015, 2, 4]} />
              </mesh>
            ))}
            <mesh material={pastel(i)} position={[0, -2.0, 0]}>
              <boxGeometry args={[0.75, 0.07, 0.35]} />
            </mesh>
          </group>
        ))}
      </group>
      {/* Carousel */}
      <group position={[36, 0, 41]}>
        <mesh material={pastel(4)} position={[0, 0.2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[2.3, 2.3, 0.3, 32]} />
        </mesh>
        <group ref={carousel} userData={{ noBatch: true }}>
          <mesh material={goldMat()} position={[0, 1.6, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 3, 10]} />
          </mesh>
          <mesh material={pastel(0)} position={[0, 3.3, 0]} castShadow>
            <coneGeometry args={[2.5, 1.2, 16]} />
          </mesh>
          {Array.from({ length: 4 }, (_, i) => {
            const a = (i / 4) * Math.PI * 2;
            return (
              <group key={i} position={[Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6]}>
                <mesh material={goldMat()} position={[0, 1.7, 0]}>
                  <cylinderGeometry args={[0.03, 0.03, 3.1, 6]} />
                </mesh>
                <group position={[0, 0.7, 0]} rotation={[0, -a, 0]}>
                  <Creature color={CANDY[(i + 2) % CANDY.length]} scale={0.6} />
                </group>
              </group>
            );
          })}
        </group>
      </group>
      {/* Seesaw */}
      <group position={[26, 0, 40]}>
        <mesh material={pastel(2)} position={[0, 0.3, 0]}>
          <coneGeometry args={[0.3, 0.6, 4]} />
        </mesh>
        <group ref={seesaw} position={[0, 0.6, 0]} userData={{ noBatch: true }}>
          <mesh material={pastel(5)} castShadow>
            <boxGeometry args={[4, 0.1, 0.5]} />
          </mesh>
        </group>
      </group>
      {/* Sandbox */}
      <group position={[42, 0, 37.4]}>
        <mesh material={mat('#c79a6a', { rough: 0.9 })} position={[0, 0.15, 0]}>
          <boxGeometry args={[3.2, 0.3, 3.2]} />
        </mesh>
        <mesh material={mat('#f1dcae', { rough: 1 })} position={[0, 0.27, 0]}>
          <boxGeometry args={[2.9, 0.06, 2.9]} />
        </mesh>
        <mesh material={pastel(1)} position={[0.6, 0.45, -0.5]}>
          <coneGeometry args={[0.3, 0.4, 10]} />
        </mesh>
        <mesh material={pastel(0)} position={[-0.6, 0.36, 0.4]}>
          <cylinderGeometry args={[0.18, 0.14, 0.2, 10]} />
        </mesh>
      </group>
      {/* Storytelling corner */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[44, 0.06, 29.8]}>
        <circleGeometry args={[1.9, 30]} />
        <meshStandardMaterial color="#d6c1f5" roughness={1} />
      </mesh>
      <mesh material={mat('#b98a62')} position={[44.75, 1, 31.5]} castShadow>
        <boxGeometry args={[3.5, 2, 1]} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} material={pastel(i)} position={[43.3 + i * 0.5, 1.6, 31]}>
          <boxGeometry args={[0.15, 0.5, 0.4]} />
        </mesh>
      ))}
      <group position={[45.2, 0, 28.4]} rotation={[0, -2.4, 0]}>
        {/* Cik Arnab the storyteller bunny */}
        <mesh material={mat('#fff6f6', { rough: 0.95 })} position={[0, 0.4, 0]} castShadow>
          <sphereGeometry args={[0.4, 16, 12]} />
        </mesh>
        <mesh material={mat('#fff6f6', { rough: 0.95 })} position={[0, 0.95, 0]}>
          <sphereGeometry args={[0.28, 16, 12]} />
        </mesh>
        {[-0.1, 0.1].map((dx) => (
          <mesh key={dx} material={mat('#fff6f6', { rough: 0.95 })} position={[dx, 1.45, -0.02]} scale={[0.6, 1.8, 0.4]}>
            <sphereGeometry args={[0.13, 10, 8]} />
          </mesh>
        ))}
        {[-0.1, 0.1].map((dx) => (
          <mesh key={`e${dx}`} material={mat('#3d2633')} position={[dx, 1.0, 0.25]}>
            <sphereGeometry args={[0.035, 8, 6]} />
          </mesh>
        ))}
        <mesh material={mat('#ff9fbd')} position={[0, 0.92, 0.27]}>
          <sphereGeometry args={[0.03, 6, 5]} />
        </mesh>
        <mesh material={mat('#c97b93')} position={[0, 0.6, 0.35]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.35, 0.04, 0.26]} />
        </mesh>
      </group>
      {/* The old tree with a hollow */}
      <group position={[23, 0, 44]}>
        <mesh material={mat('#7b5a44', { rough: 0.9 })} position={[0, 1.8, 0]} castShadow>
          <cylinderGeometry args={[0.8, 1.3, 3.6, 10]} />
        </mesh>
        <mesh material={mat('#2e2118')} position={[0.75, 1.2, -0.75]} rotation={[0, Math.PI / 4, 0]}>
          <circleGeometry args={[0.38, 14]} />
        </mesh>
        {[[0, 5, 0, 2.6], [1.4, 4.4, 0.6, 1.8], [-1.3, 4.6, -0.4, 1.9]].map(([x, y, z, s], i) => (
          <mesh key={i} material={mat(i % 2 ? '#9ccf86' : '#8cc47a', { rough: 0.85, flat: true })} position={[x, y, z]} scale={s} castShadow>
            <icosahedronGeometry args={[1, 1]} />
          </mesh>
        ))}
        {!toyFound && (
          <group position={[0.85, 1.2, -0.85]} userData={{ noBatch: true }}>
            <Floating amp={0.03} spin={0.8}>
              <StarToy />
            </Floating>
            <Glow position={[0, 0, 0]} size={0.9} color="#fff1a8" opacity={0.6} />
          </group>
        )}
        {/* Kite caught in the branches */}
        <group position={[1.8, 4.2, 1.6]} rotation={[0.3, 0.6, 0.5]}>
          <mesh material={pastel(0)}>
            <octahedronGeometry args={[0.45, 0]} />
          </mesh>
        </group>
      </group>
      {/* Toys */}
      <group ref={ball} userData={{ noBatch: true }}>
        <mesh material={mat('#f7a9c0', { rough: 0.5 })} castShadow>
          <sphereGeometry args={[0.25, 16, 12]} />
        </mesh>
        <mesh material={mat('#fffaf0', { rough: 0.5 })} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.25, 0.03, 6, 20]} />
        </mesh>
      </group>
      <group position={[35.4, 0, 33.4]}>
        <mesh material={mat('#b98a62')} position={[0, 0.35, 0]}>
          <boxGeometry args={[1.2, 0.7, 0.6]} />
        </mesh>
        {CANDY.map((c, i) => (
          <mesh key={c} material={mat(c, { rough: 0.4 })} position={[-0.45 + i * 0.18, 0.74, 0]}>
            <boxGeometry args={[0.14, 0.05, 0.5 - i * 0.05]} />
          </mesh>
        ))}
      </group>
      {[[40.5, 34.5], [41.2, 34.2], [40.8, 35.2]].map(([x, z], i) => (
        <mesh key={i} material={pastel(i + 2)} position={[x, 0.2 + (i === 2 ? 0.4 : 0), z]} rotation={[0, i, 0]} castShadow>
          <boxGeometry args={[0.4, 0.4, 0.4]} />
        </mesh>
      ))}
      {/* Momo */}
      <group position={[31, 0, 35]}>
        <group ref={momo} userData={{ noBatch: true }}>
          <Creature key={String(toyReturned)} color="#d6c1f5" happy={toyReturned} scale={0.9} />
          {toyReturned && (
            <group position={[0.42, 0.55, 0.25]}>
              <StarToy />
            </group>
          )}
        </group>
      </group>
      <Wanderer cx={33} cz={38} r={5.5} color="#a9d8f5" speed={0.35} phase={0} />
      <Wanderer cx={28} cz={36} r={3} color="#fbe38c" speed={-0.5} phase={2} />
      <Wanderer cx={40} cz={42} r={2.5} color="#b9e6a5" speed={0.6} phase={4} />
      <FlowerField flowers={flowers} />
      </StaticBatch>
    </Proximity>
  );
}
