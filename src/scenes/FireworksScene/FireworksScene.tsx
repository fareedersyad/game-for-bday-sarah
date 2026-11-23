import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { glowTexture, goldMat, mat, PALETTE } from '../../components/game/materials';
import { useQuality } from '../../components/game/quality';
import { FlowerField, type FlowerInstance } from '../../components/game/Vegetation';
import { runtime } from '../../systems/runtime';
import { heightAt, LANDMARKS } from '../../systems/WorldManager/worldLayout';
import { mulberry32 } from '../../utils/rng';
import { Bench, LampPost } from '../common';
import { StaticBatch } from '../../components/game/StaticBatch';

const PALETTES: string[][] = [
  ['#ff8fb4', '#ffd1e0'],
  ['#ffd27a', '#fff1c4'],
  ['#b18cff', '#e6d6ff'],
  ['#7fb6ff', '#d4e8ff'],
  ['#ff8fb4', '#ffd27a'],
  ['#ffffff', '#ffd1e0'],
];

const vert = /* glsl */ `
attribute float aAlpha;
attribute float aSize;
attribute vec3 aColor;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vAlpha = aAlpha;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const frag = /* glsl */ `
uniform sampler2D uTex;
varying float vAlpha;
varying vec3 vColor;
void main() {
  vec4 t = texture2D(uTex, gl_PointCoord);
  gl_FragColor = vec4(vColor * 1.6, t.a * vAlpha);
}`;

/**
 * CPU-simulated fireworks (shells → bursts → falling sparks) rendered as one
 * additive point cloud. Includes heart-shaped bursts. Particle budget scales
 * with the device's quality tier.
 */
function Fireworks() {
  const q = useQuality();
  const MAX = Math.max(900, Math.round(3200 * q.particles));
  const sim = useMemo(() => {
    const pos = new Float32Array(MAX * 3);
    const vel = new Float32Array(MAX * 3);
    const col = new Float32Array(MAX * 3);
    const alpha = new Float32Array(MAX);
    const size = new Float32Array(MAX);
    const life = new Float32Array(MAX);
    const maxLife = new Float32Array(MAX);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 25, 10), 120);
    return { pos, vel, col, alpha, size, life, maxLife, geo, cursor: 0, shells: [] as Array<{ x: number; y: number; z: number; vy: number; top: number; pal: string[]; kind: number }>, timer: 0 };
  }, [MAX]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTex: { value: glowTexture() } },
        fog: false,
      }),
    [],
  );
  const tmp = useMemo(() => new THREE.Color(), []);

  const spawn = (x: number, y: number, z: number, vx: number, vy: number, vz: number, color: string, lifeS: number, s: number) => {
    const i = sim.cursor;
    sim.cursor = (sim.cursor + 1) % MAX;
    sim.pos[i * 3] = x;
    sim.pos[i * 3 + 1] = y;
    sim.pos[i * 3 + 2] = z;
    sim.vel[i * 3] = vx;
    sim.vel[i * 3 + 1] = vy;
    sim.vel[i * 3 + 2] = vz;
    tmp.set(color);
    sim.col[i * 3] = tmp.r;
    sim.col[i * 3 + 1] = tmp.g;
    sim.col[i * 3 + 2] = tmp.b;
    sim.life[i] = lifeS;
    sim.maxLife[i] = lifeS;
    sim.size[i] = s;
  };

  const burst = (x: number, y: number, z: number, pal: string[], kind: number) => {
    const n = Math.round((kind === 1 ? 140 : 160) * Math.max(0.45, q.particles));
    for (let k = 0; k < n; k++) {
      let vx: number;
      let vy: number;
      let vz: number;
      if (kind === 1) {
        // Heart burst (in the plane facing the hill).
        const t = (k / n) * Math.PI * 2;
        const hx = 16 * Math.pow(Math.sin(t), 3);
        const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
        vx = hx * 0.55;
        vy = hy * 0.55;
        vz = (Math.random() - 0.5) * 1.2;
      } else if (kind === 2) {
        const a = (k / n) * Math.PI * 2;
        vx = Math.cos(a) * 11;
        vy = Math.sin(a) * 11;
        vz = (Math.random() - 0.5) * 2;
      } else {
        const u = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const r = Math.sqrt(1 - u * u);
        const sp = 9 + Math.random() * 4;
        vx = r * Math.cos(th) * sp;
        vy = u * sp;
        vz = r * Math.sin(th) * sp;
      }
      spawn(x, y, z, vx, vy, vz, pal[k % pal.length], 1.7 + Math.random() * 1.0, 4.2 + Math.random() * 2.2);
    }
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const a = runtime.anim;
    if (a.fireworks) {
      sim.timer -= dt * Math.max(0.3, a.fireworksIntensity);
      if (sim.timer <= 0) {
        sim.timer = 0.35 + Math.random() * 0.5;
        const launches = Math.random() < 0.3 ? 2 : 1;
        for (let l = 0; l < launches; l++) {
        const pal = PALETTES[Math.floor(Math.random() * PALETTES.length)];
        sim.shells.push({ x: -26 + Math.random() * 52, y: 2, z: -2 + Math.random() * 24, vy: 27 + Math.random() * 7, top: 24 + Math.random() * 14, pal, kind: Math.random() < 0.22 ? 1 : Math.random() < 0.2 ? 2 : 0 });
        }
      }
    }
    // Shells rise with a small trail.
    for (let s = sim.shells.length - 1; s >= 0; s--) {
      const sh = sim.shells[s];
      sh.y += sh.vy * dt;
      sh.vy -= 4 * dt;
      spawn(sh.x, sh.y, sh.z, (Math.random() - 0.5) * 0.6, -1, (Math.random() - 0.5) * 0.6, '#ffe8c0', 0.5, 1.6);
      if (sh.y >= sh.top || sh.vy < 4) {
        burst(sh.x, sh.y, sh.z, sh.pal, sh.kind);
        sim.shells.splice(s, 1);
      }
    }
    const drag = Math.pow(0.35, dt);
    for (let i = 0; i < MAX; i++) {
      if (sim.life[i] <= 0) {
        sim.alpha[i] = 0;
        continue;
      }
      sim.life[i] -= dt;
      sim.vel[i * 3] *= drag;
      sim.vel[i * 3 + 1] = sim.vel[i * 3 + 1] * drag - 5.5 * dt;
      sim.vel[i * 3 + 2] *= drag;
      sim.pos[i * 3] += sim.vel[i * 3] * dt;
      sim.pos[i * 3 + 1] += sim.vel[i * 3 + 1] * dt;
      sim.pos[i * 3 + 2] += sim.vel[i * 3 + 2] * dt;
      const t = sim.life[i] / sim.maxLife[i];
      sim.alpha[i] = Math.max(0, t * t) * (0.75 + Math.random() * 0.25);
    }
    const g = sim.geo;
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
  });

  return <points geometry={sim.geo} material={material} frustumCulled={false} renderOrder={5} />;
}

export function FireworksScene() {
  const top = LANDMARKS.hillTop;
  const y = heightAt('overworld', top.x, top.z);
  const flowers = useMemo(() => {
    const rng = mulberry32(808);
    const out: FlowerInstance[] = [];
    for (let i = 0; i < 160; i++) {
      const a = rng() * Math.PI * 2;
      const r = 4 + rng() * 11;
      const x = LANDMARKS.hillCenter.x + Math.cos(a) * r;
      const z = LANDMARKS.hillCenter.z + Math.sin(a) * r;
      if (Math.abs(x) < 2.2 && z < 66) continue;
      out.push({ x, z, color: ['#c9b6ec', '#e6dcf5', '#f7c4d2', '#fff4f0'][i % 4], scale: 0.9 + rng() * 0.5, kind: rng() < 0.3 ? 'cluster' : 'round' });
    }
    return out;
  }, []);
  return (
    <group>
      <StaticBatch>
      {/* Lookout platform */}
      <group position={[top.x, y, top.z]}>
        <mesh material={mat(PALETTE.stone, { rough: 0.6 })} position={[0, 0.06, 0]} receiveShadow>
          <cylinderGeometry args={[3.6, 3.8, 0.16, 32]} />
        </mesh>
        <mesh material={goldMat()} position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.3, 3.5, 40]} />
        </mesh>
        {Array.from({ length: 9 }, (_, i) => {
          const ang = Math.PI + (i / 8) * Math.PI;
          return (
            <mesh key={i} material={goldMat()} position={[Math.cos(ang) * 3.5, 0.5, Math.sin(ang) * 3.5]}>
              <cylinderGeometry args={[0.04, 0.04, 0.8, 6]} />
            </mesh>
          );
        })}
      </group>
      <group position={[0, heightAt('overworld', 0, 72.6), 72.6]}>
        <Bench x={0} z={0} rot={Math.PI} />
      </group>
      <group position={[0, heightAt('overworld', -4, 64), 0]}>
        <LampPost x={-4} z={64} color="#ffd1e0" />
      </group>
      <group position={[0, heightAt('overworld', 4, 64), 0]}>
        <LampPost x={4} z={64} color="#ffd1e0" />
      </group>
      </StaticBatch>
      <FlowerField flowers={flowers} />
      <Fireworks />
    </group>
  );
}
