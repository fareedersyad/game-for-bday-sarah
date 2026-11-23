import { MeshReflectorMaterial } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useState } from 'react';
import * as THREE from 'three';
import { runtime } from '../../systems/runtime';
import { AREA_BOUNDS, heightAt, LANDMARKS, PATHS, STATIC_COLLIDERS } from '../../systems/WorldManager/worldLayout';
import type { BoxShape } from '../../systems/WorldManager/worldTypes';
import { smoothstep } from '../../utils/math';
import { mulberry32 } from '../../utils/rng';
import { goldMat, mat, PALETTE } from './materials';
import { useQuality } from './quality';
import { StaticBatch } from './StaticBatch';

export const WATER_Y = -0.28;

/** Visual ground height: gameplay height plus the carved river bed. */
export function groundHeight(x: number, z: number) {
  const r = LANDMARKS.river;
  const inside = Math.min(z - r.minZ, r.maxZ - z);
  const carve = inside > -0.8 ? -1.5 * smoothstep(-0.8, 1.2, inside) : 0;
  return heightAt('overworld', x, z) + carve;
}

function noise(x: number, z: number) {
  return (Math.sin(x * 0.21 + z * 0.13) + Math.sin(x * 0.07 - z * 0.19) * 0.7 + Math.sin(x * 0.53 + z * 0.41) * 0.25) / 1.95;
}

const C = {
  grass: new THREE.Color('#b4d494'),
  grassAlt: new THREE.Color('#a2c985'),
  lush: new THREE.Color('#9fd08c'),
  forest: new THREE.Color('#5f7d63'),
  hill: new THREE.Color('#c7c2e3'),
  sand: new THREE.Color('#e8d4ad'),
  courtyard: new THREE.Color('#c6dfa9'),
  meadow: new THREE.Color('#c9dc98'),
};

function groundColor(x: number, z: number, out: THREE.Color) {
  const n = noise(x, z);
  out.copy(C.grass).lerp(C.grassAlt, 0.5 + n * 0.5);
  // Stormy forest: darker, cooler.
  const df = Math.hypot(x - LANDMARKS.stormCenter.x, z - LANDMARKS.stormCenter.z);
  out.lerp(C.forest, smoothstep(20, 10, df) * 0.75);
  // Garden & wonderland: lush.
  if (x > 20 && x < 54 && z > -10 && z < 48) out.lerp(C.lush, 0.35);
  // Hill: soft lavender meadow.
  const dh = Math.hypot(x - LANDMARKS.hillCenter.x, z - LANDMARKS.hillCenter.z);
  out.lerp(C.hill, smoothstep(17, 4, dh) * 0.55);
  // Riverbanks.
  const r = LANDMARKS.river;
  const edge = Math.min(Math.abs(z - r.minZ), Math.abs(z - r.maxZ));
  if (z > r.minZ - 2 && z < r.maxZ + 2) out.lerp(C.sand, smoothstep(2, 0.2, edge) * 0.8 + (z > r.minZ && z < r.maxZ ? 0.6 : 0));
  // Meadow near the north edge.
  if (z < -46) out.lerp(C.meadow, 0.3);
  return out;
}

export function Ground() {
  const q = useQuality();
  const geo = useMemo(() => {
    const b = AREA_BOUNDS.overworld;
    const margin = 30;
    const w = b.maxX - b.minX + margin * 2;
    const h = b.maxZ - b.minZ + margin * 2;
    const seg = q.tier === 'low' ? 90 : q.tier === 'medium' ? 130 : 170;
    const g = new THREE.PlaneGeometry(w, h, seg, Math.round((seg * h) / w));
    g.rotateX(-Math.PI / 2);
    g.translate((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, groundHeight(x, z));
      groundColor(x, z, col);
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [q.tier]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), []);
  return (
    <>
      <mesh geometry={geo} material={material} receiveShadow />
      {/* Distant ground to the horizon */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.6, 14]} receiveShadow={false}>
        <planeGeometry args={[900, 900]} />
        <meshStandardMaterial color="#a6c98a" roughness={1} />
      </mesh>
    </>
  );
}

export function Paths() {
  const geo = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    const push = (x: number, z: number) => {
      positions.push(x, groundHeight(x, z) + 0.035, z);
      return positions.length / 3 - 1;
    };
    for (const path of PATHS) {
      const pts = path.points;
      const hw = path.width / 2;
      // Densify so the ribbon follows the hill.
      const dense: Array<[number, number]> = [];
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i];
        const [bx, bz] = pts[i + 1];
        const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 1.5));
        for (let k = 0; k < n; k++) dense.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
      }
      dense.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
      let prevL = -1;
      let prevR = -1;
      for (let i = 0; i < dense.length; i++) {
        const [x, z] = dense[i];
        const [nx, nz] = dense[Math.min(i + 1, dense.length - 1)];
        const [px, pz] = dense[Math.max(i - 1, 0)];
        let dx = nx - px;
        let dz = nz - pz;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
        const L = push(x - dz * hw, z + dx * hw);
        const R = push(x + dz * hw, z - dx * hw);
        if (prevL >= 0) indices.push(prevL, L, prevR, prevR, L, R);
        prevL = L;
        prevR = R;
      }
      // Round caps at the ends.
      for (const [x, z] of [dense[0], dense[dense.length - 1]]) {
        const c = push(x, z);
        const seg = 12;
        const first = positions.length / 3;
        for (let k = 0; k <= seg; k++) {
          const a = (k / seg) * Math.PI * 2;
          push(x + Math.cos(a) * hw, z + Math.sin(a) * hw);
        }
        for (let k = 0; k < seg; k++) indices.push(c, first + k + 1, first + k);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geo} receiveShadow>
      <meshStandardMaterial color={PALETTE.path} roughness={0.95} polygonOffset polygonOffsetFactor={-2} side={THREE.DoubleSide} />
    </mesh>
  );
}

const waterVert = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const waterFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uShallow;
uniform vec3 uDeep;
uniform vec3 uSky;
uniform float uOpacity;
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz;
  float w = sin(p.x * 0.9 + uTime * 1.3) * 0.5 + sin(p.y * 1.7 - uTime * 0.9) * 0.3 + sin((p.x + p.y) * 2.3 + uTime * 2.1) * 0.2;
  vec3 view = normalize(cameraPosition - vWorld);
  float fres = pow(1.0 - clamp(view.y, 0.0, 1.0), 2.5);
  vec3 col = mix(uDeep, uShallow, 0.5 + w * 0.15);
  col = mix(col, uSky, fres * 0.65);
  float spark = smoothstep(0.92, 1.0, sin(p.x * 3.1 + uTime * 2.0) * sin(p.y * 2.7 - uTime * 1.6));
  col += vec3(1.0, 0.95, 0.9) * spark * 0.35;
  gl_FragColor = vec4(col, uOpacity);
  #include <colorspace_fragment>
}`;

export function useWaterMaterial(opacity = 0.82) {
  const m = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: waterVert,
        fragmentShader: waterFrag,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uShallow: { value: new THREE.Color('#9fd6ee') },
          uDeep: { value: new THREE.Color('#5aa7cf') },
          uSky: { value: new THREE.Color('#ffdbe4') },
          uOpacity: { value: opacity },
        },
      }),
    [opacity],
  );
  const night = useMemo(() => ({ shallow: new THREE.Color('#2b3a6e'), deep: new THREE.Color('#141c44'), sky: new THREE.Color('#4a3a7a') }), []);
  const day = useMemo(() => ({ shallow: new THREE.Color('#9fd6ee'), deep: new THREE.Color('#5aa7cf'), sky: new THREE.Color('#ffdbe4') }), []);
  const storm = useMemo(() => ({ shallow: new THREE.Color('#6f8494'), deep: new THREE.Color('#40525f'), sky: new THREE.Color('#7b8494') }), []);
  useFrame(() => {
    const w = runtime.weather;
    m.uniforms.uTime.value = runtime.time;
    (m.uniforms.uShallow.value as THREE.Color).copy(day.shallow).lerp(night.shallow, w.night).lerp(storm.shallow, w.storm);
    (m.uniforms.uDeep.value as THREE.Color).copy(day.deep).lerp(night.deep, w.night).lerp(storm.deep, w.storm);
    (m.uniforms.uSky.value as THREE.Color).copy(day.sky).lerp(night.sky, w.night).lerp(storm.sky, w.storm);
  });
  return m;
}

export function River() {
  const m = useWaterMaterial(0.78);
  const q = useQuality();
  const r = LANDMARKS.river;
  const [reflective, setReflective] = useState(false);
  // At night (the fireworks finale) the river becomes a true mirror on capable devices.
  useFrame(() => {
    const want = q.tier !== 'low' && runtime.weather.night > 0.35 && runtime.player.area === 'overworld' && runtime.player.z > 30;
    if (want !== reflective) setReflective(want);
  });
  if (!reflective) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y, (r.minZ + r.maxZ) / 2]} renderOrder={2} material={m}>
        <planeGeometry args={[190, r.maxZ - r.minZ + 1.4]} />
      </mesh>
    );
  }
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y, (r.minZ + r.maxZ) / 2]} renderOrder={2}>
      <planeGeometry args={[190, r.maxZ - r.minZ + 1.4]} />
      {reflective && (
        <MeshReflectorMaterial
          resolution={q.tier === 'high' ? 1024 : 512}
          mirror={0.85}
          mixStrength={2.2}
          blur={[120, 40]}
          mixBlur={0.6}
          depthScale={0}
          color="#141a3e"
          metalness={0.3}
          roughness={0.6}
        />
      )}
    </mesh>
  );
}

export function Bridge() {
  const wood = mat(PALETTE.wood, { rough: 0.8 });
  const woodDark = mat(PALETTE.woodDark, { rough: 0.8 });
  const r = LANDMARKS.river;
  const len = r.maxZ - r.minZ + 3;
  const cz = (r.minZ + r.maxZ) / 2;
  const planks = Math.round(len / 0.5);
  return (
    <StaticBatch>
    <group position={[0, 0, cz]}>
      {Array.from({ length: planks }, (_, i) => {
        const z = -len / 2 + (i + 0.5) * (len / planks);
        const arch = Math.cos((z / (len / 2)) * (Math.PI / 2)) * 0.35;
        return (
          <mesh key={i} material={i % 2 ? wood : woodDark} position={[0, 0.06 + arch, z]} castShadow receiveShadow>
            <boxGeometry args={[5.6, 0.12, len / planks - 0.04]} />
          </mesh>
        );
      })}
      {[-2.7, 2.7].map((x) => (
        <group key={x}>
          <mesh material={wood} position={[x, 0.85, 0]} castShadow>
            <boxGeometry args={[0.14, 0.12, len]} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => {
            const z = -len / 2 + (i / 5) * len;
            return (
              <group key={i} position={[x, 0, z]}>
                <mesh material={woodDark} position={[0, 0.45, 0]} castShadow>
                  <boxGeometry args={[0.18, 0.9, 0.18]} />
                </mesh>
                <mesh material={goldMat()} position={[0, 0.95, 0]}>
                  <sphereGeometry args={[0.1, 10, 8]} />
                </mesh>
              </group>
            );
          })}
        </group>
      ))}
    </group>
    </StaticBatch>
  );
}

/** Hedges with little roses, and castle walls with crenellations — straight from the colliders. */
export function HedgesAndWalls() {
  const q = useQuality();
  const hedges = STATIC_COLLIDERS.overworld.filter((c) => c.tag === 'hedge') as BoxShape[];
  const walls = STATIC_COLLIDERS.overworld.filter((c) => c.tag === 'castleWall') as BoxShape[];
  const hedgeMat = mat(PALETTE.hedge, { rough: 0.95 });
  const wallMat = mat(PALETTE.ivory, { rough: 0.85 });
  const trimMat = mat(PALETTE.sageSoft, { rough: 0.7 });

  const roses = useMemo(() => {
    const rng = mulberry32(5);
    const pts: Array<[number, number, number, string]> = [];
    const density = 1.6 * q.detail;
    for (const h of hedges) {
      const lx = h.maxX - h.minX;
      const lz = h.maxZ - h.minZ;
      const n = Math.round(Math.max(lx, lz) * density);
      for (let i = 0; i < n; i++) {
        const x = h.minX + rng() * lx;
        const z = h.minZ + rng() * lz;
        pts.push([x, 1.0 + rng() * 0.55, z, rng() < 0.5 ? '#f19bb4' : rng() < 0.5 ? '#fff4f0' : '#f7c4d2']);
      }
    }
    return pts;
  }, [hedges, q.detail]);

  const roseMesh = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(0.11, 0);
    const m = new THREE.MeshStandardMaterial({ roughness: 0.6 });
    const inst = new THREE.InstancedMesh(geo, m, roses.length);
    const o = new THREE.Object3D();
    const col = new THREE.Color();
    roses.forEach(([x, y, z, c], i) => {
      o.position.set(x, y, z);
      o.updateMatrix();
      inst.setMatrixAt(i, o.matrix);
      inst.setColorAt(i, col.set(c));
    });
    inst.instanceMatrix.needsUpdate = true;
    return inst;
  }, [roses]);

  const crenels = useMemo(() => {
    const pts: Array<[number, number]> = [];
    for (const w of walls) {
      const lx = w.maxX - w.minX;
      const lz = w.maxZ - w.minZ;
      const along = lx > lz;
      const len = along ? lx : lz;
      const n = Math.floor(len / 1.4);
      for (let i = 0; i <= n; i++) {
        const t = (i + 0.5) / (n + 1);
        pts.push(along ? [w.minX + t * lx, (w.minZ + w.maxZ) / 2] : [(w.minX + w.maxX) / 2, w.minZ + t * lz]);
      }
    }
    const geo = new THREE.BoxGeometry(0.7, 0.55, 0.7);
    const inst = new THREE.InstancedMesh(geo, wallMat, pts.length);
    const o = new THREE.Object3D();
    pts.forEach(([x, z], i) => {
      o.position.set(x, 3.45, z);
      o.updateMatrix();
      inst.setMatrixAt(i, o.matrix);
    });
    inst.castShadow = true;
    return inst;
  }, [walls, wallMat]);

  return (
    <StaticBatch>
      {hedges.map((h, i) => (
        <mesh key={i} material={hedgeMat} position={[(h.minX + h.maxX) / 2, 0.8, (h.minZ + h.maxZ) / 2]} castShadow receiveShadow>
          <boxGeometry args={[h.maxX - h.minX, 1.6, h.maxZ - h.minZ]} />
        </mesh>
      ))}
      <primitive object={roseMesh} />
      {walls.map((w, i) => (
        <group key={i} position={[(w.minX + w.maxX) / 2, 0, (w.minZ + w.maxZ) / 2]}>
          <mesh material={wallMat} position={[0, 1.6, 0]} castShadow receiveShadow>
            <boxGeometry args={[w.maxX - w.minX, 3.2, w.maxZ - w.minZ]} />
          </mesh>
          <mesh material={trimMat} position={[0, 3.12, 0]}>
            <boxGeometry args={[w.maxX - w.minX + 0.12, 0.16, w.maxZ - w.minZ + 0.12]} />
          </mesh>
        </group>
      ))}
      <primitive object={crenels} />
    </StaticBatch>
  );
}
