import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useSettings } from '../../stores/settingsStore';
import { useUI } from '../../stores/uiStore';
import { useWorld } from '../../stores/worldStore';
import { runtime } from '../../systems/runtime';
import { LANDMARKS } from '../../systems/WorldManager/worldLayout';
import { mulberry32 } from '../../utils/rng';
import { glowTexture } from './materials';
import { useQuality } from './quality';

const o = new THREE.Object3D();

export function Effects() {
  const area = useWorld((s) => s.area);
  return (
    <>
      <Petals />
      {area === 'overworld' && <Butterflies />}
      <Fireflies />
      {area === 'overworld' && <Rain />}
      <Sparkles />
      <Dust />
    </>
  );
}

/** Rose petals drifting down around the camera. */
function Petals() {
  const q = useQuality();
  const reduced = useSettings((s) => s.reducedMotion);
  const count = Math.round((reduced ? 40 : 160) * q.particles);
  const ref = useRef<THREE.InstancedMesh>(null);
  const data = useMemo(() => {
    const rng = mulberry32(1);
    return Array.from({ length: count }, () => ({ x: (rng() - 0.5) * 40, y: rng() * 14, z: (rng() - 0.5) * 40, s: 0.6 + rng() * 0.8, r: rng() * 6, v: 0.5 + rng() * 0.6 }));
  }, [count]);
  const geo = useMemo(() => {
    const g = new THREE.CircleGeometry(0.07, 5);
    g.scale(1, 1.5, 1);
    return g;
  }, []);
  useFrame(({ camera }, rawDt) => {
    const m = ref.current;
    if (!m) return;
    const dt = Math.min(rawDt, 0.05);
    const w = runtime.weather;
    const indoor = runtime.player.area === 'castle';
    m.visible = !indoor && w.storm < 0.5;
    if (!m.visible) return;
    const cx = camera.position.x;
    const cz = camera.position.z;
    const wind = 0.6 + w.storm * 3;
    data.forEach((p, i) => {
      p.y -= p.v * dt;
      p.x += Math.sin(runtime.time * 0.7 + p.r) * dt * 0.6 + wind * dt * 0.3;
      p.r += dt * 1.5;
      if (p.y < 0) {
        p.y = 10 + Math.random() * 5;
        p.x = cx + (Math.random() - 0.5) * 40;
        p.z = cz + (Math.random() - 0.5) * 40;
      }
      if (Math.abs(p.x - cx) > 22) p.x = cx + (Math.random() - 0.5) * 40;
      if (Math.abs(p.z - cz) > 22) p.z = cz + (Math.random() - 0.5) * 40;
      o.position.set(p.x, p.y, p.z);
      o.rotation.set(p.r, p.r * 0.7, p.r * 0.3);
      o.scale.setScalar(p.s);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[geo, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial color="#f7b6c8" side={THREE.DoubleSide} roughness={0.8} emissive="#f7b6c8" emissiveIntensity={0.15} />
    </instancedMesh>
  );
}

/** Butterflies fluttering around flowery places (courtyard, garden, wonderland, title). */
function Butterflies() {
  const q = useQuality();
  const count = Math.round(36 * Math.max(0.4, q.particles));
  const wingsL = useRef<THREE.InstancedMesh>(null);
  const wingsR = useRef<THREE.InstancedMesh>(null);
  const homes = useMemo(
    () => [
      { x: 0, z: 9, r: 9 },
      { x: 36, z: 6, r: 12 },
      { x: 33, z: 36, r: 10 },
      { x: 0, z: -18, r: 8 },
      { x: 0, z: 70, r: 10 },
      { x: 47, z: -14, r: 6 },
    ],
    [],
  );
  const data = useMemo(() => {
    const rng = mulberry32(2);
    return Array.from({ length: count }, (_, i) => {
      const h = homes[i % homes.length];
      return { h, a: rng() * 6, r: 1 + rng() * h.r, y: 0.8 + rng() * 2, sp: 0.2 + rng() * 0.4, f: 10 + rng() * 6, col: ['#f7b6c8', '#c9b6ec', '#fff1a8', '#a9d8f5'][i % 4] };
    });
  }, [count, homes]);
  const wingGeo = useMemo(() => {
    const g = new THREE.CircleGeometry(0.12, 6);
    g.translate(0.12, 0, 0);
    return g;
  }, []);
  useFrame(() => {
    const L = wingsL.current;
    const R = wingsR.current;
    if (!L || !R) return;
    const t = runtime.time;
    const w = runtime.weather;
    const vis = w.storm < 0.3 && w.night < 0.6;
    L.visible = R.visible = vis;
    if (!vis) return;
    const col = new THREE.Color();
    data.forEach((b, i) => {
      const a = b.a + t * b.sp;
      const x = b.h.x + Math.cos(a) * b.r;
      const z = b.h.z + Math.sin(a * 1.3) * b.r;
      const y = b.y + Math.sin(t * 1.7 + b.a) * 0.4;
      const yaw = -a;
      const flap = Math.sin(t * b.f) * 0.9;
      for (const [mesh, side] of [[L, 1], [R, -1]] as const) {
        o.position.set(x, y, z);
        o.rotation.set(0, yaw, 0);
        o.rotateZ(side * flap);
        if (side < 0) o.rotateY(Math.PI);
        o.scale.setScalar(1);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
        mesh.setColorAt(i, col.set(b.col));
      }
    });
    L.instanceMatrix.needsUpdate = true;
    R.instanceMatrix.needsUpdate = true;
    if (L.instanceColor) L.instanceColor.needsUpdate = true;
    if (R.instanceColor) R.instanceColor.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh ref={wingsL} args={[wingGeo, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial side={THREE.DoubleSide} emissive="#ffffff" emissiveIntensity={0.25} roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={wingsR} args={[wingGeo, undefined, count]} frustumCulled={false}>
        <meshStandardMaterial side={THREE.DoubleSide} emissive="#ffffff" emissiveIntensity={0.25} roughness={0.6} />
      </instancedMesh>
    </>
  );
}

/** Glowing fireflies: always some magic, more at night and in the forest. */
function Fireflies() {
  const q = useQuality();
  const count = Math.round(120 * q.particles);
  const ref = useRef<THREE.Points>(null);
  const { geo, seeds } = useMemo(() => {
    const rng = mulberry32(3);
    const pos = new Float32Array(count * 3);
    const seeds = Array.from({ length: count }, () => ({ x: (rng() - 0.5) * 36, y: 0.5 + rng() * 3, z: (rng() - 0.5) * 36, p: rng() * 10 }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    return { geo: g, seeds };
  }, [count]);
  const material = useMemo(
    () => new THREE.PointsMaterial({ map: glowTexture(), color: '#fff1a8', size: 0.45, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }),
    [],
  );
  useFrame(() => {
    const p = runtime.player;
    const w = runtime.weather;
    const forest = Math.max(0, 1 - Math.hypot(p.x - LANDMARKS.stormCenter.x, p.z - LANDMARKS.stormCenter.z) / 22);
    const indoor = p.area === 'castle';
    const amount = indoor ? 0.25 : Math.min(1, 0.25 + w.night * 0.9 + forest * 0.6 + w.storm * 0.3);
    material.opacity = amount;
    const arr = geo.attributes.position.array as Float32Array;
    const t = runtime.time;
    seeds.forEach((s, i) => {
      arr[i * 3] = p.x + s.x + Math.sin(t * 0.4 + s.p) * 1.4;
      arr[i * 3 + 1] = (indoor ? 1.5 : p.y) + s.y + Math.sin(t * 0.9 + s.p * 2) * 0.5;
      arr[i * 3 + 2] = p.z + s.z + Math.cos(t * 0.35 + s.p) * 1.4;
    });
    geo.attributes.position.needsUpdate = true;
    if (ref.current) ref.current.visible = amount > 0.05;
  });
  return <points ref={ref} geometry={geo} material={material} frustumCulled={false} />;
}

/** Rain streaks around the camera while the storm is active. */
function Rain() {
  const q = useQuality();
  const count = Math.round(900 * q.particles);
  const ref = useRef<THREE.InstancedMesh>(null);
  const drops = useMemo(() => {
    const rng = mulberry32(4);
    return Array.from({ length: count }, () => ({ x: (rng() - 0.5) * 30, y: rng() * 16, z: (rng() - 0.5) * 30, v: 16 + rng() * 6 }));
  }, [count]);
  const geo = useMemo(() => new THREE.BoxGeometry(0.03, 0.8, 0.03), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ color: '#e3eefc', transparent: true, opacity: 0.65, depthWrite: false, fog: false }), []);
  useFrame(({ camera }, rawDt) => {
    const m = ref.current;
    if (!m) return;
    const dt = Math.min(rawDt, 0.05);
    const s = runtime.weather.storm;
    m.visible = s > 0.04;
    if (!m.visible) return;
    material.opacity = 0.65 * s;
    const active = Math.floor(count * s);
    m.count = active;
    const cx = camera.position.x;
    const cz = camera.position.z;
    const cy = camera.position.y;
    for (let i = 0; i < active; i++) {
      const d = drops[i];
      d.y -= d.v * dt;
      d.x += dt * 2.2;
      if (d.y < cy - 6) {
        d.y = cy + 8 + Math.random() * 6;
        d.x = cx + (Math.random() - 0.5) * 30;
        d.z = cz + (Math.random() - 0.5) * 30;
      }
      o.position.set(d.x, d.y, d.z);
      o.rotation.set(0, 0, 0.12);
      o.scale.setScalar(1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });
  return <instancedMesh ref={ref} args={[geo, material, count]} frustumCulled={false} />;
}

/** Golden/rose sparkle bursts emitted by story moments (runtime.sparkles). */
function Sparkles() {
  const q = useQuality();
  const MAX = Math.round(600 * Math.max(0.5, q.particles));
  const ref = useRef<THREE.Points>(null);
  const state = useMemo(() => {
    const pos = new Float32Array(MAX * 3);
    const col = new Float32Array(MAX * 3);
    const vel = new Float32Array(MAX * 3);
    const life = new Float32Array(MAX);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
    return { pos, col, vel, life, g, cursor: 0, seen: new Set<number>() };
  }, [MAX]);
  const material = useMemo(
    () => new THREE.PointsMaterial({ map: glowTexture(), size: 0.32, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  const c = useMemo(() => new THREE.Color(), []);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const reduced = useSettings.getState().reducedMotion;
    for (const s of runtime.sparkles) {
      if (state.seen.has(s.id)) continue;
      state.seen.add(s.id);
      if (s.area !== runtime.player.area) continue;
      c.set(s.color);
      const n = Math.round(s.count * (reduced ? 0.4 : 1));
      for (let k = 0; k < n; k++) {
        const i = state.cursor;
        state.cursor = (state.cursor + 1) % MAX;
        state.pos[i * 3] = s.x;
        state.pos[i * 3 + 1] = s.y;
        state.pos[i * 3 + 2] = s.z;
        const a = Math.random() * Math.PI * 2;
        const up = Math.random();
        const sp = 0.8 + Math.random() * 2.2;
        state.vel[i * 3] = Math.cos(a) * sp * (1 - up * 0.5);
        state.vel[i * 3 + 1] = 0.6 + up * 2.5;
        state.vel[i * 3 + 2] = Math.sin(a) * sp * (1 - up * 0.5);
        state.life[i] = 1.2 + Math.random() * 0.8;
        state.col[i * 3] = c.r;
        state.col[i * 3 + 1] = c.g;
        state.col[i * 3 + 2] = c.b;
      }
    }
    if (state.seen.size > 64) state.seen = new Set(runtime.sparkles.map((s) => s.id));
    for (let i = 0; i < MAX; i++) {
      if (state.life[i] <= 0) {
        state.pos[i * 3 + 1] = -100;
        continue;
      }
      state.life[i] -= dt;
      state.vel[i * 3 + 1] -= dt * 1.2;
      state.pos[i * 3] += state.vel[i * 3] * dt;
      state.pos[i * 3 + 1] += state.vel[i * 3 + 1] * dt;
      state.pos[i * 3 + 2] += state.vel[i * 3 + 2] * dt;
      const fade = Math.min(1, state.life[i]);
      state.col[i * 3] *= 0.995 + fade * 0.005;
    }
    state.g.attributes.position.needsUpdate = true;
    state.g.attributes.color.needsUpdate = true;
  });
  return <points ref={ref} geometry={state.g} material={material} frustumCulled={false} />;
}

/** Magical dust motes in the library and castle. */
function Dust() {
  const location = useUI((s) => s.location);
  const show = location === 'library' || location === 'castleHall' || location === 'secretRoom' || location === 'bedroom';
  const ref = useRef<THREE.Points>(null);
  const { geo, seeds } = useMemo(() => {
    const rng = mulberry32(6);
    const n = 160;
    const seeds = Array.from({ length: n }, () => ({ x: (rng() - 0.5) * 16, y: rng() * 5, z: (rng() - 0.5) * 14, p: rng() * 10 }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
    return { geo: g, seeds };
  }, []);
  const material = useMemo(() => new THREE.PointsMaterial({ map: glowTexture(), color: '#ffe9b0', size: 0.14, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }), []);
  useFrame(() => {
    if (!show || !ref.current) return;
    const p = runtime.player;
    const arr = geo.attributes.position.array as Float32Array;
    const t = runtime.time;
    seeds.forEach((s, i) => {
      arr[i * 3] = p.x + s.x + Math.sin(t * 0.2 + s.p) * 0.8;
      arr[i * 3 + 1] = 0.3 + ((s.y + t * 0.12 + s.p) % 5);
      arr[i * 3 + 2] = p.z + s.z + Math.cos(t * 0.25 + s.p) * 0.8;
    });
    geo.attributes.position.needsUpdate = true;
  });
  if (!show) return null;
  return <points ref={ref} geometry={geo} material={material} frustumCulled={false} />;
}
