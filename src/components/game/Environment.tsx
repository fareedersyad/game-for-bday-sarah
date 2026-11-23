import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useWorld } from '../../stores/worldStore';
import { runtime } from '../../systems/runtime';
import { LANDMARKS } from '../../systems/WorldManager/worldLayout';
import { mulberry32 } from '../../utils/rng';
import { useQuality } from './quality';

// Palettes for each mood: [zenith, horizon, fog, sun, hemiSky, hemiGround]
const DAY = ['#9ec3ee', '#ffdbe4', '#f8dfe6', '#fff1d6', '#fdf1f5', '#b9d59f'].map((c) => new THREE.Color(c));
const STORM = ['#3d4556', '#6b7488', '#6f7789', '#9aa3b5', '#8d96a8', '#47524a'].map((c) => new THREE.Color(c));
const NIGHT = ['#090a26', '#3b2a63', '#231a40', '#b9b6ff', '#4a4a8c', '#1e2433'].map((c) => new THREE.Color(c));
const INDOOR = ['#f6d3dc', '#fdf3e4', '#f9e6ea', '#fff3e0', '#fff4f2', '#d9b9a8'].map((c) => new THREE.Color(c));

const scratch = Array.from({ length: 6 }, () => new THREE.Color());

function mix(out: THREE.Color[], storm: number, night: number) {
  for (let i = 0; i < 6; i++) {
    out[i].copy(DAY[i]).lerp(NIGHT[i], night).lerp(STORM[i], storm * (1 - night * 0.5));
  }
  return out;
}

const skyVert = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const skyFrag = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uFlash;
uniform vec3 uCenter;
varying vec3 vWorld;
void main() {
  vec3 dir = normalize(vWorld - uCenter);
  float h = clamp(dir.y, -0.2, 1.0);
  vec3 col = mix(uHorizon, uZenith, pow(smoothstep(-0.05, 0.85, h), 0.8));
  float sun = max(dot(dir, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(sun, 64.0) * 0.9 + pow(sun, 6.0) * 0.18);
  col += vec3(0.85, 0.88, 1.0) * uFlash * 0.5;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

export function Environment() {
  const area = useWorld((s) => s.area);
  const q = useQuality();
  const scene = useThree((s) => s.scene);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const skyRef = useRef<THREE.Mesh>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const fog = useMemo(() => new THREE.Fog('#f8dfe6', 40, 180), []);
  const skyMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uZenith: { value: new THREE.Color() },
          uHorizon: { value: new THREE.Color() },
          uSunDir: { value: new THREE.Vector3(0.4, 0.35, -0.8) },
          uSunColor: { value: new THREE.Color() },
          uFlash: { value: 0 },
          uCenter: { value: new THREE.Vector3() },
        },
      }),
    [],
  );

  useFrame(({ camera }) => {
    const w = runtime.weather;
    const indoor = area === 'castle';
    const c = indoor ? INDOOR : mix(scratch, w.storm, w.night);
    scene.fog = fog;
    fog.color.copy(c[2]);
    if (indoor) {
      fog.near = 30;
      fog.far = 90;
    } else {
      const thick = Math.max(w.storm * 0.6, w.fog);
      fog.near = THREE.MathUtils.lerp(q.tier === 'low' ? 30 : 45, 2, thick);
      fog.far = THREE.MathUtils.lerp(q.tier === 'low' ? 125 : 190, 30, thick);
    }
    (scene.background as THREE.Color | null)?.copy?.(c[1]);

    const u = skyMat.uniforms;
    (u.uZenith.value as THREE.Color).copy(c[0]);
    (u.uHorizon.value as THREE.Color).copy(c[1]);
    (u.uSunColor.value as THREE.Color).copy(c[3]).multiplyScalar(1 - w.storm * 0.9);
    u.uFlash.value = w.flash;
    (u.uCenter.value as THREE.Vector3).copy(camera.position);
    if (w.night > 0.5) (u.uSunDir.value as THREE.Vector3).set(-0.3, 0.45, -0.85); // moon
    else (u.uSunDir.value as THREE.Vector3).set(0.45, 0.32, -0.83);
    skyRef.current?.position.copy(camera.position);

    const sun = sunRef.current;
    if (sun) {
      const p = runtime.player;
      sun.position.set(p.x + 30, p.y + 42, p.z + 18);
      target.position.set(p.x, p.y, p.z);
      sun.target = target;
      sun.intensity = indoor ? 0.55 : THREE.MathUtils.lerp(2.3, 0.35, Math.max(w.storm, w.night * 0.85)) + w.flash * 1.5;
      sun.color.copy(c[3]);
    }
    if (hemiRef.current) {
      hemiRef.current.color.copy(c[4]);
      hemiRef.current.groundColor.copy(c[5]);
      hemiRef.current.intensity = indoor ? 0.8 : THREE.MathUtils.lerp(1.15, 0.6, w.storm) + w.flash * 0.8;
    }
    if (ambRef.current) ambRef.current.intensity = indoor ? 0.22 : 0.25 + w.night * 0.35;
  });

  return (
    <>
      <mesh ref={skyRef} material={skyMat} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[380, 32, 16]} />
      </mesh>
      <hemisphereLight ref={hemiRef} args={['#fdf1f5', '#b9d59f', 1.1]} />
      <ambientLight ref={ambRef} intensity={0.25} />
      <directionalLight
        ref={sunRef}
        intensity={2.2}
        castShadow={q.shadows}
        shadow-mapSize-width={q.shadowMapSize}
        shadow-mapSize-height={q.shadowMapSize}
        shadow-camera-left={-34}
        shadow-camera-right={34}
        shadow-camera-top={34}
        shadow-camera-bottom={-34}
        shadow-camera-near={1}
        shadow-camera-far={120}
        shadow-bias={-0.0006}
        shadow-normalBias={0.04}
      />
      <primitive object={target} />
      {area === 'overworld' && (
        <>
          <Clouds />
          <Stars />
          <Rainbow />
        </>
      )}
    </>
  );
}

function Clouds() {
  const q = useQuality();
  const group = useRef<THREE.Group>(null);
  const count = Math.round(10 * Math.max(0.5, q.detail));
  const clouds = useMemo(() => {
    const rng = mulberry32(77);
    return Array.from({ length: count }, (_, i) => ({
      x: -150 + (i / count) * 300 + rng() * 20,
      z: -120 + rng() * 260,
      y: 55 + rng() * 25,
      s: 6 + rng() * 7,
      puffs: Array.from({ length: 5 }, () => [rng() * 2.2 - 1.1, rng() * 0.5, rng() * 1.4 - 0.7, 0.7 + rng() * 0.6] as const),
      speed: 1 + rng() * 1.5,
    }));
  }, [count]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, transparent: true, opacity: 0.92, fog: false }), []);
  const stormCol = useMemo(() => new THREE.Color('#5b6274'), []);
  const nightCol = useMemo(() => new THREE.Color('#3b3a6b'), []);
  const dayCol = useMemo(() => new THREE.Color('#fff7fa'), []);
  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    const w = runtime.weather;
    material.color.copy(dayCol).lerp(nightCol, w.night).lerp(stormCol, w.storm);
    material.opacity = 0.85 + w.storm * 0.15;
    g.children.forEach((c, i) => {
      c.position.x += clouds[i].speed * dt * (1 + w.storm * 2);
      if (c.position.x > 170) c.position.x = -170;
    });
  });
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]} scale={c.s}>
          {c.puffs.map(([x, y, z, s], j) => (
            <mesh key={j} position={[x, y, z]} scale={[s * 1.4, s * 0.75, s]} material={material}>
              <icosahedronGeometry args={[1, 1]} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Stars() {
  const q = useQuality();
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const n = Math.round(900 * Math.max(0.4, q.particles));
    const rng = mulberry32(9);
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const theta = rng() * Math.PI * 2;
      const phi = Math.acos(rng() * 0.9 + 0.1);
      const r = 330;
      pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      pos[i * 3 + 1] = Math.cos(phi) * r;
      pos[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, [q.particles]);
  const material = useMemo(() => new THREE.PointsMaterial({ color: '#fff7e8', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }), []);
  useFrame(({ camera }) => {
    const n = runtime.weather.night * (1 - runtime.weather.storm);
    material.opacity = n * (0.75 + Math.sin(runtime.time * 1.3) * 0.08);
    if (ref.current) {
      ref.current.visible = n > 0.02;
      ref.current.position.copy(camera.position);
    }
  });
  return <points ref={ref} geometry={geo} material={material} renderOrder={-9} frustumCulled={false} />;
}

const rainbowFrag = /* glsl */ `
varying vec2 vUv;
uniform float uOpacity;
vec3 band(float t) {
  vec3 c = vec3(0.0);
  c += vec3(1.0, 0.45, 0.55) * smoothstep(0.0, 0.18, t) * (1.0 - smoothstep(0.18, 0.34, t));
  c += vec3(1.0, 0.75, 0.45) * smoothstep(0.16, 0.32, t) * (1.0 - smoothstep(0.32, 0.48, t));
  c += vec3(1.0, 0.95, 0.55) * smoothstep(0.30, 0.46, t) * (1.0 - smoothstep(0.46, 0.62, t));
  c += vec3(0.6, 0.95, 0.65) * smoothstep(0.44, 0.60, t) * (1.0 - smoothstep(0.60, 0.76, t));
  c += vec3(0.55, 0.75, 1.0) * smoothstep(0.58, 0.74, t) * (1.0 - smoothstep(0.74, 0.88, t));
  c += vec3(0.75, 0.6, 1.0) * smoothstep(0.72, 0.86, t) * (1.0 - smoothstep(0.88, 1.0, t));
  return c;
}
varying vec2 vPos;
void main() {
  float t = clamp((length(vPos) - 34.0) / 6.0, 0.0, 1.0);
  float ang = atan(vPos.y, vPos.x) / 3.14159265;
  float edge = smoothstep(0.0, 0.14, ang) * smoothstep(1.0, 0.86, ang);
  gl_FragColor = vec4(band(t), uOpacity * edge * 0.55);
}`;

function Rainbow() {
  const ref = useRef<THREE.Mesh>(null);
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: `varying vec2 vUv; varying vec2 vPos; void main(){ vUv = uv; vPos = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);} `,
        fragmentShader: rainbowFrag,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: { uOpacity: { value: 0 } },
        fog: false,
      }),
    [],
  );
  useFrame(() => {
    const r = runtime.weather.rainbow * (1 - runtime.weather.storm) * (1 - THREE.MathUtils.smoothstep(runtime.weather.night, 0.05, 0.4));
    mat.uniforms.uOpacity.value = r;
    if (ref.current) ref.current.visible = r > 0.01;
  });
  const c = LANDMARKS.stormCenter;
  return (
    <mesh ref={ref} position={[c.x - 6, -6, c.z - 26]} rotation={[0, 0.5, 0]} material={mat}>
      <ringGeometry args={[34, 40, 64, 1, 0, Math.PI]} />
    </mesh>
  );
}
