import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { mat, roseGoldMat } from '../components/game/materials';
import { useWorld } from '../stores/worldStore';
import { runtime } from '../systems/runtime';
import { GATE_INFO } from '../systems/WorldManager/worldLayout';
import type { GateId } from '../systems/WorldManager/worldTypes';

const curtainFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uColorA;
uniform vec3 uColorB;
varying vec2 vUv;
void main() {
  float w = sin(vUv.x * 18.0 + uTime * 2.0) * 0.5 + sin(vUv.y * 11.0 - uTime * 1.4) * 0.5;
  float sparkle = smoothstep(0.96, 1.0, sin(vUv.x * 61.0 + uTime * 3.0) * sin(vUv.y * 47.0 - uTime * 2.3));
  vec3 col = mix(uColorA, uColorB, 0.5 + w * 0.5) + sparkle;
  float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x) * smoothstep(1.0, 0.7, vUv.y);
  gl_FragColor = vec4(col, (0.2 + w * 0.08 + sparkle * 0.4) * edge);
}`;

/** Shimmering rose barriers that seal paths until the story opens them. */
function Barrier({ gate }: { gate: GateId }) {
  const info = GATE_INFO[gate];
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: curtainFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uColorA: { value: new THREE.Color(gate === 'hillBridge' ? '#8f78b8' : '#e8899e') },
          uColorB: { value: new THREE.Color(gate === 'hillBridge' ? '#d4c2ff' : '#ffe3a3') },
        },
      }),
    [gate],
  );
  useFrame(() => {
    material.uniforms.uTime.value = runtime.time;
  });
  return (
    <group position={[info.x, 0, info.z]} rotation={[0, info.rotY, 0]}>
      <mesh material={material} position={[0, 1.6, 0]}>
        <planeGeometry args={[info.width, 3.2]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s} position={[(s * info.width) / 2, 0, 0]}>
          <mesh material={roseGoldMat()} position={[0, 1.7, 0]}>
            <cylinderGeometry args={[0.12, 0.15, 3.4, 10]} />
          </mesh>
          <mesh material={mat('#ffd1e0', { emissive: '#ffb3c9', emissiveIntensity: 1.2 })} position={[0, 3.55, 0]}>
            <octahedronGeometry args={[0.2, 0]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Decorative arch that stays after a world gate opens. */
function OpenArch({ gate }: { gate: GateId }) {
  const info = GATE_INFO[gate];
  return (
    <group position={[info.x, 0, info.z]} rotation={[0, info.rotY, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} material={roseGoldMat()} position={[(s * info.width) / 2, 1.7, 0]}>
          <cylinderGeometry args={[0.12, 0.15, 3.4, 10]} />
        </mesh>
      ))}
      <mesh material={roseGoldMat()} position={[0, 3.4, 0]}>
        <torusGeometry args={[info.width / 2, 0.1, 8, 24, Math.PI]} />
      </mesh>
    </group>
  );
}

export function Gates() {
  const gates = useWorld((s) => s.gates);
  const list: GateId[] = ['worldEast', 'worldWest', 'worldSouth', 'hillBridge'];
  return (
    <group>
      {list.map((g) => (gates[g] ? <OpenArch key={g} gate={g} /> : <Barrier key={g} gate={g} />))}
    </group>
  );
}
