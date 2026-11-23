import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../../stores/gameStore';
import type { Appearance } from '../../stores/progressTypes';
import { runtime } from '../../systems/runtime';
import { heightAt, LANDMARKS } from '../../systems/WorldManager/worldLayout';
import { damp, lerpAngle } from '../../utils/math';
import { goldMat, heartShape, mat, PALETTE, roseGoldMat, starShape } from './materials';
import { StaticBatch } from './StaticBatch';

export function Characters() {
  return (
    <>
      <Princess />
      <Companion />
    </>
  );
}

// ============================================================================
// PRINCESS
// ============================================================================
function gownProfile() {
  const pts: THREE.Vector2[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 bottom → 1 waist
    const y = t * 1.02;
    const r = 0.17 + (0.42 - 0.17) * Math.pow(1 - t, 1.6) + Math.sin(t * Math.PI) * 0.015;
    pts.push(new THREE.Vector2(r, y));
  }
  pts.unshift(new THREE.Vector2(0.001, 0));
  return pts;
}

function Crown({ gem }: { gem: string }) {
  const points = 7;
  const gemMat = mat(gem, { rough: 0.15, metal: 0.1, emissive: gem, emissiveIntensity: 0.35 });
  const crystal = mat(PALETTE.crystal, { rough: 0.05, metal: 0.2, emissive: '#ffffff', emissiveIntensity: 0.25 });
  return (
    <group>
      <mesh material={roseGoldMat()} castShadow>
        <cylinderGeometry args={[0.105, 0.115, 0.045, 24, 1, true]} />
      </mesh>
      <mesh material={roseGoldMat()} position={[0, -0.022, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.114, 0.01, 6, 28]} />
      </mesh>
      {Array.from({ length: points }, (_, i) => {
        const a = (i / points) * Math.PI * 2;
        const tall = i % 2 === 0 ? 0.085 : 0.06;
        return (
          <group key={i} position={[Math.sin(a) * 0.106, 0.022, Math.cos(a) * 0.106]} rotation={[0, a, 0]}>
            <mesh material={roseGoldMat()} position={[0, tall / 2, 0]}>
              <coneGeometry args={[0.022, tall, 4]} />
            </mesh>
            <mesh material={i % 2 === 0 ? crystal : gemMat} position={[0, tall + 0.008, 0]}>
              <octahedronGeometry args={[0.014, 0]} />
            </mesh>
          </group>
        );
      })}
      {/* Front floral centrepiece with the big pink gem */}
      <mesh material={gemMat} position={[0, 0.035, 0.112]} scale={[1, 1.25, 0.6]}>
        <octahedronGeometry args={[0.026, 0]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={mat(PALETTE.blush, { rough: 0.5 })} position={[s * 0.04, 0.012, 0.107]} scale={[1, 0.7, 0.5]}>
          <sphereGeometry args={[0.016, 8, 6]} />
        </mesh>
      ))}
    </group>
  );
}

function PrincessModel({ a, crowned, holdBouquet, refs }: { a: Appearance; crowned: boolean; holdBouquet: boolean; refs: PrincessRefs }) {
  const gownGeo = useMemo(() => new THREE.LatheGeometry(gownProfile(), 28), []);
  const gown = mat(a.gownColor, { rough: 0.6 });
  const gownAccent = mat(a.gownAccent, { rough: 0.35, metal: 0.5 });
  const hijab = mat(a.hijabColor, { rough: 0.85 });
  const trim = mat(a.hijabTrim, { rough: 0.35, metal: 0.55 });
  const skin = mat(a.skinTone, { rough: 0.7 });
  const dark = mat('#3d2633', { rough: 0.5 });
  const blush = mat('#f2a1b4', { rough: 0.8, transparent: true, opacity: 0.6 });
  return (
    <group>
      {/* Gown */}
      <group ref={refs.skirt}>
        <StaticBatch>
        <mesh geometry={gownGeo} material={gown} castShadow receiveShadow />
        {/* Hem trim & overlay layer */}
        <mesh material={gownAccent} position={[0, 0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.415, 0.014, 6, 36]} />
        </mesh>
        <mesh material={mat(a.gownColor, { rough: 0.5, transparent: true, opacity: 0.45 })} position={[0, 0.36, 0]} scale={[1.06, 1, 1.06]}>
          <cylinderGeometry args={[0.21, 0.38, 0.62, 24, 1, true]} />
        </mesh>
        </StaticBatch>
      </group>
      <StaticBatch>
      {/* Waist sash */}
      <mesh material={gownAccent} position={[0, 1.02, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.06, 20]} />
      </mesh>
      {/* Bodice (long sleeved, modest) */}
      <mesh material={gown} position={[0, 1.2, 0]} castShadow>
        <cylinderGeometry args={[0.165, 0.175, 0.32, 18]} />
      </mesh>
      <mesh material={hijab} position={[0, 1.27, 0]} castShadow>
        <cylinderGeometry args={[0.13, 0.27, 0.3, 22]} />
      </mesh>
      <mesh material={trim} position={[0, 1.13, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.265, 0.011, 6, 30]} />
      </mesh>
      </StaticBatch>
      {/* Arms */}
      {[-1, 1].map((s) => (
        <group key={s} ref={s < 0 ? refs.armL : refs.armR} position={[s * 0.2, 1.33, 0]}>
          <StaticBatch>
          <mesh material={gown} position={[0, -0.22, 0]} castShadow>
            <capsuleGeometry args={[0.052, 0.36, 4, 10]} />
          </mesh>
          <mesh material={gownAccent} position={[0, -0.43, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.05, 0.01, 6, 14]} />
          </mesh>
          <mesh material={skin} position={[0, -0.49, 0.01]}>
            <sphereGeometry args={[0.042, 10, 8]} />
          </mesh>
          </StaticBatch>
        </group>
      ))}
      {/* Head */}
      <group ref={refs.head} position={[0, 1.55, 0]}>
        <StaticBatch>
        <mesh material={skin} position={[0, -0.005, 0.028]}>
          <sphereGeometry args={[0.118, 20, 16]} />
        </mesh>
        <mesh material={hijab} position={[0, 0.012, -0.012]} scale={[1, 1.08, 1.04]} castShadow>
          <sphereGeometry args={[0.15, 22, 18]} />
        </mesh>
        {/* Fabric falling down the back */}
        <mesh material={hijab} position={[0, -0.2, -0.035]} castShadow>
          <cylinderGeometry args={[0.135, 0.25, 0.42, 20, 1, true, Math.PI / 2, Math.PI]} />
        </mesh>
        <mesh material={trim} position={[0, -0.002, 0.098]} rotation={[0.15, 0, 0]}>
          <torusGeometry args={[0.098, 0.01, 6, 26]} />
        </mesh>
        {/* Face */}
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh material={dark} position={[s * 0.04, 0.005, 0.138]} scale={[1, 1.3, 0.6]}>
              <sphereGeometry args={[0.013, 8, 6]} />
            </mesh>
            <mesh material={blush} position={[s * 0.066, -0.032, 0.122]} scale={[1.4, 0.8, 0.3]}>
              <sphereGeometry args={[0.018, 8, 6]} />
            </mesh>
          </group>
        ))}
        <mesh material={mat('#c76a83')} position={[0, -0.046, 0.137]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.017, 0.0045, 4, 10, Math.PI]} />
        </mesh>
        </StaticBatch>
        {crowned && (
          <group ref={refs.crownSlot} position={[0, 0.14, -0.01]} rotation={[-0.12, 0, 0]}>
            <StaticBatch>
              <Crown gem={a.crownGem} />
            </StaticBatch>
          </group>
        )}
      </group>
      {holdBouquet && (
        <group position={[0, 1.12, 0.24]} rotation={[0.4, 0, 0]} scale={0.6}>
          <BouquetModel />
        </group>
      )}
    </group>
  );
}

interface PrincessRefs {
  skirt: React.RefObject<THREE.Group | null>;
  armL: React.RefObject<THREE.Group | null>;
  armR: React.RefObject<THREE.Group | null>;
  head: React.RefObject<THREE.Group | null>;
  crownSlot: React.RefObject<THREE.Group | null>;
}

function Princess() {
  const appearance = useGameStore((s) => s.appearance);
  const crowned = useGameStore((s) => !!s.flags.crownAccepted);
  const bouquet = useGameStore((s) => !!s.flags.bouquetReceived && !s.flags.bouquetPlaced);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const emote = useRef<THREE.Group>(null);
  const flyingCrown = useRef<THREE.Group>(null);
  const refs: PrincessRefs = { skirt: useRef(null), armL: useRef(null), armR: useRef(null), head: useRef(null), crownSlot: useRef(null) };
  const phase = useRef(0);
  const bob = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const p = runtime.player;
    const g = root.current;
    if (!g) return;
    g.position.set(p.x, p.y, p.z);
    g.rotation.y = lerpAngle(g.rotation.y, p.yaw, damp(14, dt));
    const sp = Math.min(1, p.speed / 4.4);
    phase.current += dt * (4 + p.speed * 1.9);
    const swing = Math.sin(phase.current) * 0.55 * sp;
    bob.current = Math.abs(Math.sin(phase.current)) * 0.035 * sp;
    const sitting = p.pose === 'sit';
    // Sitting on the picnic blanket: the gown pools on the ground around her.
    const sitGround = p.pose === 'sitGround';
    if (body.current) {
      body.current.position.y = sitGround ? -0.58 : sitting ? -0.25 : bob.current + Math.sin(runtime.time * 1.6) * 0.004;
      body.current.rotation.x = sitGround ? 0.05 : sp * 0.06;
      body.current.scale.set(sitGround ? 1.12 : 1, 1, sitGround ? 1.12 : 1);
    }
    if (refs.armL.current) refs.armL.current.rotation.x = p.pose === 'hold' ? -0.9 : swing * 0.6;
    if (refs.armR.current) refs.armR.current.rotation.x = p.pose === 'hold' ? -0.6 : -swing * 0.6;
    if (refs.armR.current && bouquet) refs.armR.current.rotation.x = -1.0;
    if (refs.armL.current && bouquet) refs.armL.current.rotation.x = -1.0;
    if (refs.skirt.current) refs.skirt.current.rotation.z = Math.sin(phase.current) * 0.035 * sp;
    if (refs.head.current) refs.head.current.rotation.z = Math.sin(runtime.time * 0.9) * 0.02;
    if (refs.crownSlot.current) refs.crownSlot.current.visible = !runtime.anim.crownFlightActive;
    // Emote above her head.
    if (emote.current) {
      const on = runtime.anim.playerEmote !== 'none' && runtime.time < runtime.anim.playerEmoteUntil;
      emote.current.visible = on;
      emote.current.position.y = 2.15 + Math.sin(runtime.time * 3) * 0.06;
      emote.current.rotation.y = runtime.time * 1.5;
    }
    // The crown flying from the cushion to her hijab.
    const fc = flyingCrown.current;
    if (fc) {
      const a = runtime.anim;
      fc.visible = a.crownFlightActive;
      if (a.crownFlightActive) {
        const t = a.crownFlight;
        const cp = LANDMARKS.crownPedestal;
        const start = new THREE.Vector3(cp.x, 1.18, cp.z);
        const end = new THREE.Vector3(p.x, p.y + 1.71, p.z);
        const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 2.4, 0));
        const it = 1 - t;
        fc.position.set(
          it * it * start.x + 2 * it * t * mid.x + t * t * end.x,
          it * it * start.y + 2 * it * t * mid.y + t * t * end.y,
          it * it * start.z + 2 * it * t * mid.z + t * t * end.z,
        );
        fc.rotation.y = t * Math.PI * 4;
        fc.scale.setScalar(1.6 - t * 0.6);
      }
    }
  });

  return (
    <>
      <group ref={root}>
        <group ref={body}>
          <PrincessModel key={JSON.stringify([appearance, crowned, bouquet])} a={appearance} crowned={crowned} holdBouquet={bouquet} refs={refs} />
        </group>
        <group ref={emote} visible={false}>
          <EmoteHeart color="#ff9fbd" />
        </group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <circleGeometry args={[0.45, 20]} />
          <meshBasicMaterial color="#5a3553" transparent opacity={0.18} depthWrite={false} />
        </mesh>
      </group>
      <group ref={flyingCrown} visible={false}>
        <Crown gem={appearance.crownGem} />
        <pointLight color="#ffd9a0" intensity={3} distance={4} />
      </group>
    </>
  );
}

export function BouquetModel() {
  const wrap = mat('#fff1f4', { rough: 0.8, side: THREE.DoubleSide });
  const ribbon = mat(PALETTE.rose, { rough: 0.4 });
  const rose = mat('#ef8fac', { rough: 0.55 });
  const tulip = mat('#fffaf2', { rough: 0.55 });
  const small = mat('#c9b6ec', { rough: 0.6 });
  const leaf = mat(PALETTE.leaf, { rough: 0.7 });
  const blooms = useMemo(() => {
    const out: Array<{ p: [number, number, number]; m: THREE.Material; s: number; kind: 'rose' | 'tulip' | 'small' }> = [];
    for (let i = 0; i < 13; i++) {
      const a = i * 2.4;
      const r = 0.05 + (i % 4) * 0.035;
      const kind = i % 3 === 0 ? 'tulip' : i % 3 === 1 ? 'rose' : 'small';
      out.push({ p: [Math.cos(a) * r, 0.36 + (i % 3) * 0.03, Math.sin(a) * r], m: kind === 'rose' ? rose : kind === 'tulip' ? tulip : small, s: kind === 'small' ? 0.03 : 0.05, kind });
    }
    return out;
  }, [rose, tulip, small]);
  return (
    <group>
      <mesh material={wrap} position={[0, 0.17, 0]}>
        <coneGeometry args={[0.19, 0.42, 14, 1, true]} />
      </mesh>
      <mesh material={ribbon} position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.075, 0.016, 6, 16]} />
      </mesh>
      <mesh material={ribbon} position={[0.05, 0.08, 0.06]} rotation={[0.3, 0.2, 0.8]}>
        <boxGeometry args={[0.03, 0.14, 0.008]} />
      </mesh>
      {blooms.map((b, i) => (
        <mesh key={i} material={b.m} position={b.p} scale={b.kind === 'tulip' ? [b.s, b.s * 1.5, b.s] : [b.s, b.s * 0.85, b.s]}>
          {b.kind === 'rose' ? <dodecahedronGeometry args={[1, 0]} /> : <sphereGeometry args={[1, 8, 6]} />}
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} material={leaf} position={[Math.cos(i * 1.6) * 0.15, 0.3, Math.sin(i * 1.6) * 0.15]} rotation={[0.6, i * 1.6, 0]} scale={[0.04, 0.09, 0.01]}>
          <sphereGeometry args={[1, 6, 4]} />
        </mesh>
      ))}
    </group>
  );
}

// ============================================================================
// COMPANION
// ============================================================================
function CompanionModel({ refs }: { refs: CompanionRefs }) {
  const baju = mat('#f3e6cf', { rough: 0.7 });
  const bajuTrim = goldMat();
  const sampin = mat('#c96d86', { rough: 0.55 });
  const trousers = mat('#efe2c9', { rough: 0.8 });
  const skin = mat('#e2b48f', { rough: 0.7 });
  const hair = mat('#2b1f1c', { rough: 0.9 });
  const songkok = mat('#26202e', { rough: 0.6 });
  const dark = mat('#2b1f1c', { rough: 0.5 });
  const shoe = mat('#5a3a2e', { rough: 0.6 });
  return (
    <group>
      {/* Legs */}
      {[-1, 1].map((s) => (
        <group key={s} ref={s < 0 ? refs.legL : refs.legR} position={[s * 0.1, 0.86, 0]}>
          <StaticBatch>
          <mesh material={trousers} position={[0, -0.4, 0]} castShadow>
            <capsuleGeometry args={[0.072, 0.68, 4, 10]} />
          </mesh>
          <mesh material={shoe} position={[0, -0.82, 0.04]} scale={[1, 0.6, 1.6]}>
            <sphereGeometry args={[0.07, 10, 8]} />
          </mesh>
          </StaticBatch>
        </group>
      ))}
      <group ref={refs.torso}>
        <StaticBatch>
        {/* Sampin (songket wrap) */}
        <mesh material={sampin} position={[0, 0.86, 0]} castShadow>
          <cylinderGeometry args={[0.215, 0.235, 0.34, 20]} />
        </mesh>
        <mesh material={bajuTrim} position={[0, 0.98, 0]}>
          <cylinderGeometry args={[0.218, 0.218, 0.03, 20]} />
        </mesh>
        <mesh material={bajuTrim} position={[0, 0.74, 0]}>
          <cylinderGeometry args={[0.237, 0.237, 0.02, 20]} />
        </mesh>
        {/* Baju Melayu */}
        <mesh material={baju} position={[0, 1.24, 0]} castShadow>
          <cylinderGeometry args={[0.2, 0.215, 0.56, 20]} />
        </mesh>
        <mesh material={baju} position={[0, 1.53, 0]} scale={[1, 0.45, 0.85]}>
          <sphereGeometry args={[0.235, 16, 10]} />
        </mesh>
        {/* Collar (cekak musang) & buttons */}
        <mesh material={baju} position={[0, 1.6, 0]}>
          <cylinderGeometry args={[0.07, 0.085, 0.07, 14]} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} material={bajuTrim} position={[0, 1.5 - i * 0.07, 0.205]}>
            <sphereGeometry args={[0.012, 6, 5]} />
          </mesh>
        ))}
        </StaticBatch>
        {/* Arms */}
        {[-1, 1].map((s) => (
          <group key={s} ref={s < 0 ? refs.armL : refs.armR} position={[s * 0.255, 1.52, 0]}>
            <StaticBatch>
            <mesh material={baju} position={[0, -0.27, 0]} castShadow>
              <capsuleGeometry args={[0.062, 0.44, 4, 10]} />
            </mesh>
            <mesh material={skin} position={[0, -0.56, 0.01]}>
              <sphereGeometry args={[0.05, 10, 8]} />
            </mesh>
            </StaticBatch>
          </group>
        ))}
        {/* Head */}
        <group ref={refs.head} position={[0, 1.79, 0]}>
          <StaticBatch>
          <mesh material={skin} castShadow>
            <sphereGeometry args={[0.135, 20, 16]} />
          </mesh>
          <mesh material={hair} position={[0, 0.03, -0.02]} scale={[1.04, 0.9, 1.04]}>
            <sphereGeometry args={[0.137, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh material={songkok} position={[0, 0.11, -0.005]} rotation={[-0.08, 0, 0]}>
            <cylinderGeometry args={[0.122, 0.135, 0.1, 22]} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} material={dark} position={[s * 0.045, 0.0, 0.124]} scale={[1, 1.2, 0.6]}>
              <sphereGeometry args={[0.013, 8, 6]} />
            </mesh>
          ))}
          <mesh material={mat('#a5614f')} position={[0, -0.05, 0.125]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[0.022, 0.005, 4, 10, Math.PI]} />
          </mesh>
          </StaticBatch>
        </group>
      </group>
    </group>
  );
}

interface CompanionRefs {
  legL: React.RefObject<THREE.Group | null>;
  legR: React.RefObject<THREE.Group | null>;
  armL: React.RefObject<THREE.Group | null>;
  armR: React.RefObject<THREE.Group | null>;
  head: React.RefObject<THREE.Group | null>;
  torso: React.RefObject<THREE.Group | null>;
}

function Companion() {
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const emote = useRef<THREE.Group>(null);
  const heart = useRef<THREE.Group>(null);
  const note = useRef<THREE.Group>(null);
  const lantern = useRef<THREE.Group>(null);
  const refs: CompanionRefs = { legL: useRef(null), legR: useRef(null), armL: useRef(null), armR: useRef(null), head: useRef(null), torso: useRef(null) };
  const phase = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const c = runtime.companion;
    const g = root.current;
    if (!g) return;
    const visible = c.visible && c.mode !== 'absent' && c.area === runtime.player.area;
    g.visible = visible;
    if (!visible) return;
    const ground = heightAt(c.area, c.x, c.z);
    g.position.set(c.x, ground, c.z);
    g.rotation.y = lerpAngle(g.rotation.y, c.yaw, damp(14, dt));
    const sp = Math.min(1, c.speed / 4);
    phase.current += dt * (4 + c.speed * 1.8);
    const swing = Math.sin(phase.current) * 0.7 * sp;
    const sit = c.sit;
    if (refs.legL.current) refs.legL.current.rotation.x = swing * (1 - sit) - sit * 1.45;
    if (refs.legR.current) refs.legR.current.rotation.x = -swing * (1 - sit) - sit * 1.45;
    if (refs.armL.current) refs.armL.current.rotation.x = -swing * 0.8 * (1 - sit) - sit * 0.5;
    if (refs.armR.current) refs.armR.current.rotation.x = swing * 0.8 * (1 - sit) - sit * 0.5;
    if (body.current) {
      body.current.position.y = Math.abs(Math.sin(phase.current)) * 0.045 * sp - sit * (0.86 - c.seatHeight) + Math.sin(runtime.time * 1.4) * 0.004;
    }
    if (refs.head.current) {
      // Glance towards her while idle.
      const p = runtime.player;
      const toHer = Math.atan2(p.x - c.x, p.z - c.z) - g.rotation.y;
      const look = Math.max(-0.6, Math.min(0.6, Math.atan2(Math.sin(toHer), Math.cos(toHer))));
      refs.head.current.rotation.y += ((c.speed < 0.3 ? look : 0) - refs.head.current.rotation.y) * damp(4, dt);
    }
    const a = runtime.anim;
    const on = a.companionEmote !== 'none' && runtime.time < a.companionEmoteUntil;
    if (emote.current) {
      emote.current.visible = on;
      emote.current.position.y = 2.25 + Math.sin(runtime.time * 3) * 0.06;
      emote.current.rotation.y = runtime.time * 1.5;
      if (heart.current) heart.current.visible = a.companionEmote === 'heart' || a.companionEmote === 'laugh' || a.companionEmote === 'wave';
      if (note.current) note.current.visible = a.companionEmote === 'note';
    }
    if (lantern.current) lantern.current.visible = runtime.weather.storm > 0.2 || runtime.weather.night > 0.6;
  });

  return (
    <group ref={root} visible={false}>
      <group ref={body}>
        <CompanionModel refs={refs} />
      </group>
      <group ref={emote} visible={false}>
        <group ref={heart}>
          <EmoteHeart color="#ff7ea4" />
        </group>
        <group ref={note} visible={false}>
          <mesh material={mat('#c3b1e1', { emissive: '#c3b1e1', emissiveIntensity: 0.8 })} scale={0.35}>
            <shapeGeometry args={[starShape(0.5, 0.22)]} />
          </mesh>
        </group>
      </group>
      {/* A warm glow he carries in the storm / at night so she can find him. */}
      <group ref={lantern} visible={false} position={[0.32, 1.0, 0.18]}>
        <mesh material={mat('#ffe3a6', { emissive: '#ffcf7a', emissiveIntensity: 2.2 })}>
          <sphereGeometry args={[0.07, 10, 8]} />
        </mesh>
        <pointLight color="#ffcf8a" intensity={4} distance={9} decay={1.6} />
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <circleGeometry args={[0.42, 20]} />
        <meshBasicMaterial color="#5a3553" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
  );
}

function EmoteHeart({ color }: { color: string }) {
  const geo = useMemo(() => {
    const g = new THREE.ShapeGeometry(heartShape(0.5));
    g.center();
    g.rotateZ(Math.PI);
    return g;
  }, []);
  return (
    <mesh geometry={geo} material={mat(color, { emissive: color, emissiveIntensity: 0.9, side: THREE.DoubleSide })} scale={0.42} />
  );
}
