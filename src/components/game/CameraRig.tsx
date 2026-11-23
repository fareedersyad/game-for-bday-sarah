import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { useSettings } from '../../stores/settingsStore';
import { useUI } from '../../stores/uiStore';
import { game } from '../../systems/GameLoop/game';
import { runtime } from '../../systems/runtime';
import { AREA_BOUNDS, heightAt } from '../../systems/WorldManager/worldLayout';
import type { AreaId } from '../../systems/WorldManager/worldTypes';
import { damp } from '../../utils/math';

const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();

/** Visual heights of colliders that can block the camera's view of her. */
const OCCLUDER_HEIGHT: Record<string, number> = {
  wall: 5.8,
  castleWall: 3.8,
  keep: 9.5,
  tower: 15,
  shelf: 4.5,
  shed: 3.2,
  judgeBench: 1.9,
  witnessStand: 1.3,
  bigTree: 3.4,
  oldTree: 4.6,
  shelterHut: 2.6,
  storyShelf: 2,
  wardrobe: 3.2,
  pillar: 7,
  hedge: 1.6,
  slide: 1.4,
};

function occluderHeight(area: AreaId, x: number, z: number) {
  let h = -Infinity;
  for (const c of game.worlds[area].overlapping(x, z, 0.22)) {
    const base = c.tag ? OCCLUDER_HEIGHT[c.tag] : undefined;
    if (base === undefined) continue;
    const hh = area === 'castle' && c.tag === 'wall' ? 7.2 : base;
    if (hh > h) h = hh;
  }
  return h;
}

/**
 * Third-person camera with three modes:
 *  - follow: orbit around the Princess (yaw/pitch/zoom from input), pulled
 *    in automatically when a wall or tower would block the view
 *  - cinematic: blend to shots requested by cutscene scripts
 *  - showcase: slow orbit over the courtyard for the title / opening
 */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const look = useRef(new THREE.Vector3(0, 1.5, 6));
  const lastEpoch = useRef(-1);
  const pull = useRef(1);

  useFrame((_, rawDt) => {
    // Use the real frame time (capped) so blends finish on time even at low FPS.
    const dt = Math.min(rawDt, 0.25);
    const cam = runtime.camera;
    const p = runtime.player;
    const screen = useUI.getState().screen;
    const reduced = useSettings.getState().reducedMotion;
    let k = damp(6, dt);

    if (screen !== 'playing' && screen !== 'boot') {
      // Showcase orbit for title & opening.
      const t = runtime.time * (reduced ? 0 : 0.035);
      tmpPos.set(Math.sin(t) * 19, 7.5 + Math.sin(t * 0.7) * 1.2, 12 + Math.cos(t) * 19);
      tmpLook.set(0, 2.2, 5);
      k = damp(1.2, dt);
    } else if (cam.mode === 'cinematic') {
      tmpPos.set(...cam.pos);
      tmpLook.set(...cam.look);
      k = cam.blend <= 0.01 ? 1 : damp(3 / cam.blend, dt);
    } else {
      const yaw = cam.yaw;
      const pitch = cam.pitch;
      const dist = cam.distance;
      const ty = p.y + 1.45;
      tmpLook.set(p.x, ty, p.z);
      const dx = -Math.sin(yaw) * Math.cos(pitch) * dist;
      const dy = Math.sin(pitch) * dist;
      const dz = -Math.cos(yaw) * Math.cos(pitch) * dist;

      // Camera collision: march from her towards the desired camera spot and
      // stop just before anything tall enough to hide her.
      const steps = Math.ceil(dist / 0.3);
      let allowed = 1;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const sx = p.x + dx * t;
        const sz = p.z + dz * t;
        const sy = ty + dy * t;
        const ground = p.area === 'overworld' ? heightAt('overworld', sx, sz) : 0;
        if (sy < ground + occluderHeight(p.area, sx, sz) + 0.25) {
          allowed = Math.max(0, (i - 1) / steps);
          break;
        }
      }
      allowed = Math.max(allowed, 0.22);
      // Pull in instantly (never show the inside of a wall), ease back out.
      pull.current = allowed < pull.current ? allowed : pull.current + (allowed - pull.current) * damp(2.5, dt);
      const f = pull.current;
      tmpPos.set(p.x + dx * f, ty + dy * f, p.z + dz * f);

      if (p.area === 'castle') {
        const b = AREA_BOUNDS.castle;
        tmpPos.x = Math.min(b.maxX - 0.4, Math.max(b.minX + 0.4, tmpPos.x));
        tmpPos.z = Math.min(b.maxZ - 0.4, Math.max(b.minZ + 0.4, tmpPos.z));
        tmpPos.y = Math.min(6.4, tmpPos.y);
      } else {
        const g = heightAt('overworld', tmpPos.x, tmpPos.z) + 0.6;
        if (tmpPos.y < g) tmpPos.y = g;
      }
      k = damp(cam.blend > 0.05 ? 3 / cam.blend : 10, dt);
      cam.blend = Math.max(0, cam.blend - dt);
      if (f < 0.999 && allowed <= pull.current + 1e-3) k = Math.max(k, damp(20, dt));
    }

    // Snap after teleports / area changes instead of swooping across the map.
    if (lastEpoch.current !== runtime.areaEpoch) {
      lastEpoch.current = runtime.areaEpoch;
      if (lastEpoch.current > 0 || screen === 'playing') k = 1;
    }

    camera.position.lerp(tmpPos, k);
    look.current.lerp(tmpLook, k);
    if (runtime.camera.shake > 0 && !reduced) {
      camera.position.x += (Math.random() - 0.5) * runtime.camera.shake;
      runtime.camera.shake = Math.max(0, runtime.camera.shake - dt);
    }
    camera.lookAt(look.current);
  });
  return null;
}
