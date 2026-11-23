/**
 * GAME SIMULATION — renderer-agnostic.
 *
 * `game.step(dt)` is called once per frame by whichever renderer is active
 * (React Three Fiber's useFrame, or the 2D fallback's requestAnimationFrame).
 * It owns player movement, the companion, zone/interaction detection, story
 * triggers, weather and animation blending, and the audio director.
 */
import { dialogueConfig } from '../../config/dialogueConfig';
import { getSave, useGameStore } from '../../stores/gameStore';
import { useSettings } from '../../stores/settingsStore';
import { isGameplayBlocked, useUI } from '../../stores/uiStore';
import { useWorld, type ActiveSpot } from '../../stores/worldStore';
import { wait } from '../../utils/async';
import { damp, dirToYaw, lerpAngle, wrapAngle } from '../../utils/math';
import { audio } from '../AudioManager/audioEngine';
import { updateAudioDirector } from '../AudioManager/audioDirector';
import {
  arriveThroughDoor,
  commandFollow,
  commandSit,
  updateCompanion,
  type PlayerSnapshot,
} from '../CompanionController/companionController';
import { NavGrid } from '../CompanionNavigation/navGrid';
import { emit } from '../events';
import { consumeCameraDelta, input, readMoveIntent } from '../input';
import { getInteraction, getTalkHandler } from '../Interaction/registry';
import { CollisionWorld } from '../PlayerController/collision';
import { ALL_GATES, isGateOpen } from '../QuestManager/questManager';
import { runtime } from '../runtime';
import {
  AREA_BOUNDS,
  collidersFor,
  GATE_INFO,
  heightAt,
  HILLTOP_TRIGGER,
  INTERACTABLE_SPOTS,
  SEATS,
  STORM_TRIGGER,
  ZONES,
} from '../WorldManager/worldLayout';
import type { AreaId, GateId, LocationId, Shape, SpawnPoint } from '../WorldManager/worldTypes';
import { personalContent } from '../../config/personalContent';

export const PLAYER_RADIUS = 0.38;
const WALK_SPEED = 4.4;
const SPRINT_SPEED = 6.8;

const inShape = (s: Shape, x: number, z: number) =>
  s.kind === 'circle' ? (x - s.x) ** 2 + (z - s.z) ** 2 <= s.r * s.r : x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ;

export function locationAt(area: AreaId, x: number, z: number): LocationId {
  let best: LocationId = area === 'castle' ? 'castleHall' : 'paths';
  let prio = -1;
  for (const zone of ZONES) {
    if (zone.area !== area || zone.priority <= prio) continue;
    if (inShape(zone.shape, x, z)) {
      best = zone.id;
      prio = zone.priority;
    }
  }
  return best;
}

class Game {
  readonly worlds: Record<AreaId, CollisionWorld> = {
    overworld: new CollisionWorld(collidersFor('overworld'), AREA_BOUNDS.overworld),
    castle: new CollisionWorld(collidersFor('castle'), AREA_BOUNDS.castle),
  };
  private grids: Partial<Record<AreaId, NavGrid>> = {};
  private activeSpots: typeof INTERACTABLE_SPOTS = [];
  private spotsDirty = true;
  private zoneTimer = 0;
  private saveTimer = 0;
  private playTimer = 0;
  private lastSaved = { x: 0, z: 0 };
  private triggerState = { storm: false, hilltop: false, stormCompanion: false };
  private gateToastAt = 0;
  private lastCamInputAt = 0;
  private lightningTimer = 6;
  private pendingThunder: number | null = null;
  private barkTimer = 35;
  private stormCallTimer = 6;
  private initialised = false;
  /** When true, story scripts own the companion; ambient behaviour pauses. */
  companionScripted = false;
  private _stormSearching = false;
  /** True while she is searching for him in the storm (he calls out to her). */
  get stormSearching() {
    return this._stormSearching;
  }
  set stormSearching(v: boolean) {
    if (v !== this._stormSearching) {
      this._stormSearching = v;
      // Storm clue objects only exist during the search.
      this.spotsDirty = true;
    }
  }

  /** Force the interactable list to be recomputed (runtime-only conditions changed). */
  invalidateSpots() {
    this.spotsDirty = true;
  }
  /** Set by the 2D fallback renderer: fixed north-up camera. */
  topDown = false;

  init() {
    if (this.initialised) return;
    this.initialised = true;
    this.restoreFromSave();
    useGameStore.subscribe(() => {
      this.spotsDirty = true;
      this.syncGates();
    });
  }

  /**
   * Put the Princess at her saved checkpoint (or the start), with the
   * companion beside her and gates matching the saved story. Used at boot and
   * after importing / restoring a save.
   */
  restoreFromSave() {
    const save = getSave();
    const p = runtime.player;
    const spawn = save.player ?? { area: 'overworld' as const, x: 0, z: 17, yaw: Math.PI };
    p.area = spawn.area;
    p.x = spawn.x;
    p.z = spawn.z;
    p.yaw = spawn.yaw;
    p.vx = p.vz = p.speed = 0;
    p.moving = false;
    p.pose = 'normal';
    runtime.camera.yaw = spawn.yaw;
    runtime.areaEpoch++;
    this.syncGates();
    // Validate the restored position (older saves / changed layouts).
    const w = this.worlds[p.area];
    const free = w.nearestFree(p.x, p.z, PLAYER_RADIUS, 10);
    if (free) {
      p.x = free.x;
      p.z = free.z;
    }
    p.y = heightAt(p.area, p.x, p.z);
    this.lastSaved = { x: p.x, z: p.z };
    this.companionScripted = false;
    this.placeCompanionNearPlayer();
    this.spotsDirty = true;
    this.triggerState = { storm: false, hilltop: false, stormCompanion: false };
    useWorld.getState().setArea(p.area);
    useUI.getState().setLocation(locationAt(p.area, p.x, p.z));
  }

  /** Put the companion beside her on load (only used when restoring a save). */
  placeCompanionNearPlayer() {
    const save = getSave();
    const c = runtime.companion;
    if (!save.flags.crownAccepted) {
      c.mode = 'absent';
      c.visible = false;
      return;
    }
    const p = runtime.player;
    const w = this.worlds[p.area];
    const spot = w.nearestFree(p.x - Math.sin(p.yaw) * 1.4 + Math.cos(p.yaw) * 0.9, p.z - Math.cos(p.yaw) * 1.4 - Math.sin(p.yaw) * 0.9, 0.45, 6) ?? { x: p.x, z: p.z };
    c.area = p.area;
    c.x = spot.x;
    c.z = spot.z;
    c.yaw = p.yaw;
    c.mode = 'follow';
    c.visible = true;
  }

  grid(area: AreaId): NavGrid {
    let g = this.grids[area];
    if (!g) {
      g = new NavGrid(this.worlds[area], area === 'castle' ? 0.5 : 0.8, 0.46);
      this.grids[area] = g;
    } else {
      g.syncWithWorld();
    }
    return g;
  }

  /** Mirror story progress into collision gates and the world store. */
  syncGates() {
    const save = getSave();
    const state = {} as Record<GateId, boolean>;
    for (const gate of ALL_GATES) {
      const open = isGateOpen(save, gate);
      state[gate] = open;
      this.worlds[GATE_INFO[gate].area].setGateOpen(gate, open);
    }
    useWorld.getState().setGates(state);
  }

  playerSnapshot(): PlayerSnapshot {
    const p = runtime.player;
    return { area: p.area, x: p.x, z: p.z, yaw: p.yaw, moving: p.moving, speed: p.speed };
  }

  // ------------------------------------------------------------------ step
  /**
   * Advance the world. Long frames are split into fixed sub-steps so the
   * game runs in real time even at low frame rates (weak phones), while a
   * cap prevents a huge jump after a tab switch.
   */
  step(rawDt: number) {
    let remaining = Math.min(Math.max(rawDt, 0), 0.25);
    const MAX_STEP = 1 / 30;
    do {
      const dt = Math.min(remaining, MAX_STEP);
      this.tick(dt);
      remaining -= dt;
    } while (remaining > 1e-4);
  }

  private tick(dt: number) {
    runtime.time += dt;
    const ui = useUI.getState();
    const playing = ui.screen === 'playing';
    const blocked = isGameplayBlocked();
    const settings = useSettings.getState();

    this.updateCamera(dt, blocked, settings.cameraSensitivity, settings.invertCameraY);
    if (playing) this.updatePlayer(dt, blocked);

    // Companion
    const c = runtime.companion;
    if (c.mode !== 'absent') {
      updateCompanion(c, this.playerSnapshot(), { world: this.worlds[c.area], grid: this.grid(c.area) }, dt, {
        onRecover: (reason) => {
          emit('companionRecovered', { reason });
          if (!blocked && reason !== 'area-mismatch') {
            const lines = dialogueConfig.recoveryLines;
            useUI.getState().showBark(lines[Math.floor(Math.random() * lines.length)]);
          }
        },
      });
      c.visible = c.mode !== 'arriving';
      if (playing) this.updateCompanionBehaviour(dt, blocked);
    }

    if (playing) {
      this.updateZones(dt);
      this.updatePrompt(blocked);
      this.updateTriggers();
      this.updatePersistence(dt);
    }
    this.frameHooks.forEach((h) => h(dt));
    this.updateWeather(dt, settings.reducedMotion);
    updateAudioDirector(dt);
  }

  private frameHooks = new Set<(dt: number) => void>();
  onFrame(fn: (dt: number) => void) {
    this.frameHooks.add(fn);
    return () => this.frameHooks.delete(fn);
  }

  private updateCamera(dt: number, blocked: boolean, sensitivity: number, invertY: boolean) {
    const cam = runtime.camera;
    const d = consumeCameraDelta();
    if (this.topDown) {
      // 2D storybook mode: screen-up is always north.
      cam.yaw = Math.PI;
      return;
    }
    if (cam.mode !== 'follow') return;
    if (d.dx !== 0 || d.dy !== 0) this.lastCamInputAt = runtime.time;
    cam.yaw = wrapAngle(cam.yaw - d.dx * 0.0055 * sensitivity);
    cam.pitch = Math.min(1.15, Math.max(0.1, cam.pitch + d.dy * 0.0042 * sensitivity * (invertY ? -1 : 1)));
    const maxDist = runtime.player.area === 'castle' ? 8 : 12;
    cam.distance = Math.min(maxDist, Math.max(3.6, cam.distance + d.zoom * 0.01));
    // Gentle auto-follow behind her while walking (helps on touch screens).
    const p = runtime.player;
    if (!blocked && p.moving && runtime.time - this.lastCamInputAt > 1.8) {
      const diff = wrapAngle(p.yaw - cam.yaw);
      if (Math.abs(diff) < 2.2) cam.yaw = lerpAngle(cam.yaw, p.yaw, damp(0.9, dt));
    }
  }

  private updatePlayer(dt: number, blocked: boolean) {
    const p = runtime.player;
    const intent = blocked ? { x: 0, y: 0, magnitude: 0 } : readMoveIntent();
    const camYaw = runtime.camera.mode === 'follow' || this.topDown ? runtime.camera.yaw : p.yaw;
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    const rx = -Math.cos(camYaw);
    const rz = Math.sin(camYaw);
    let wx = fx * intent.y + rx * intent.x;
    let wz = fz * intent.y + rz * intent.x;
    const wl = Math.hypot(wx, wz);
    if (wl > 1e-4) {
      wx /= wl;
      wz /= wl;
    }
    const maxSpeed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
    const target = intent.magnitude * maxSpeed;
    const k = damp(intent.magnitude > 0 ? 11 : 14, dt);
    p.vx += (wx * target - p.vx) * k;
    p.vz += (wz * target - p.vz) * k;
    const sp = Math.hypot(p.vx, p.vz);
    if (sp < 0.03) {
      p.vx = p.vz = 0;
    }
    const world = this.worlds[p.area];
    if (sp > 0) {
      const res = world.move(p.x, p.z, p.vx * dt, p.vz * dt, PLAYER_RADIUS);
      if (res.hit && intent.magnitude > 0) this.checkGateBump(res.x, res.z);
      if (dt > 0) {
        const realSpeed = Math.hypot(res.x - p.x, res.z - p.z) / dt;
        p.speed = Math.min(sp, realSpeed);
      }
      p.x = res.x;
      p.z = res.z;
    } else {
      p.speed = 0;
    }
    if (intent.magnitude > 0.05 && wl > 1e-4) p.yaw = lerpAngle(p.yaw, dirToYaw(wx, wz), damp(12, dt));
    p.moving = p.speed > 0.25;
    p.idleTime = p.moving ? 0 : p.idleTime + dt;
    p.y = heightAt(p.area, p.x, p.z);
  }

  private checkGateBump(x: number, z: number) {
    if (runtime.time - this.gateToastAt < 5) return;
    const world = this.worlds[runtime.player.area];
    for (const gate of ALL_GATES) {
      const info = GATE_INFO[gate];
      if (info.area !== runtime.player.area || world.isGateOpen(gate)) continue;
      if (Math.hypot(x - info.x, z - info.z) < info.width / 2 + 1.6) {
        this.gateToastAt = runtime.time;
        emit('hitGate', { gate });
        const g = dialogueConfig.gates;
        const msg =
          gate === 'castleGate' ? g.castleGate : gate === 'hillBridge' ? g.hillBridge : gate === 'secretDoor' ? dialogueConfig.objects.secretDoorLocked : g.world;
        useUI.getState().toast(msg, 'lock');
        return;
      }
    }
  }

  private updateCompanionBehaviour(dt: number, blocked: boolean) {
    const c = runtime.companion;
    const p = runtime.player;
    const ui = useUI.getState();
    if (this.stormSearching && !blocked) this.stormCalls(dt);
    if (this.companionScripted) return;

    // Sit with her when she lingers near a seat.
    if (c.mode === 'follow' && !c.moving && p.idleTime > 8 && !blocked) {
      const seat = SEATS.filter((s) => s.area === p.area)
        .map((s) => ({ s, d: Math.hypot(s.x - p.x, s.z - p.z) }))
        .filter((e) => e.d < 6 && Math.hypot(e.s.x - c.x, e.s.z - c.z) < 10)
        .sort((a, b) => a.d - b.d)[0];
      if (seat) {
        commandSit(c, seat.s);
        if (Math.random() < 0.5) {
          const l = dialogueConfig.sitLines;
          ui.showBark(l[Math.floor(Math.random() * l.length)]);
        }
      }
    }
    if (c.mode === 'sit' && c.target && (p.moving || Math.hypot(c.target.x - p.x, c.target.z - p.z) > 6)) {
      if (Math.hypot(c.target.x - p.x, c.target.z - p.z) > 3.5) commandFollow(c);
    }

    // Contextual idle comments.
    if (!blocked && c.mode !== 'hold') {
      this.barkTimer -= dt;
      if (this.barkTimer <= 0) {
        this.barkTimer = 34 + Math.random() * 22;
        if (Math.hypot(c.x - p.x, c.z - p.z) < 8) {
          const pool = (dialogueConfig.barks as Partial<Record<LocationId, readonly string[]>>)[ui.location] ?? dialogueConfig.barks.paths;
          const line = pool[Math.floor(Math.random() * pool.length)];
          if (line) ui.showBark(line);
        }
      }
    }
  }

  private stormCalls(dt: number) {
    this.stormCallTimer -= dt;
    if (this.stormCallTimer <= 0) {
      this.stormCallTimer = 9 + Math.random() * 4;
      const calls = dialogueConfig.storm.calls;
      useUI.getState().showBark(calls[Math.floor(Math.random() * calls.length)], 'him', 4200);
    }
  }

  private updateZones(dt: number) {
    this.zoneTimer -= dt;
    if (this.zoneTimer > 0) return;
    this.zoneTimer = 0.25;
    const p = runtime.player;
    const loc = locationAt(p.area, p.x, p.z);
    const ui = useUI.getState();
    if (loc !== ui.location) {
      ui.setLocation(loc);
      const first = useGameStore.getState().visit(loc);
      emit('enterLocation', { id: loc, firstVisit: first });
    }
  }

  private refreshSpots() {
    const save = getSave();
    const area = runtime.player.area;
    const list: ActiveSpot[] = [];
    this.activeSpots = INTERACTABLE_SPOTS.filter((s) => {
      if (s.area !== area) return false;
      const def = getInteraction(s.id);
      if (!def || !def.available(save)) return false;
      list.push({ id: s.id, marker: def.marker ? def.marker(save) : null });
      return true;
    });
    useWorld.getState().setActiveSpots(list);
    this.spotsDirty = false;
  }

  private updatePrompt(blocked: boolean) {
    if (this.spotsDirty) this.refreshSpots();
    const ui = useUI.getState();
    const p = runtime.player;
    const c = runtime.companion;
    const dc = c.visible && c.area === p.area && c.mode !== 'absent' ? Math.hypot(c.x - p.x, c.z - p.z) : Infinity;
    ui.setCompanionNear(dc < 6 && !this.companionScripted);
    if (blocked) {
      ui.setPrompt(null);
      return;
    }
    let best: (typeof this.activeSpots)[number] | null = null;
    let bestD = Infinity;
    for (const s of this.activeSpots) {
      const d = Math.hypot(s.x - p.x, s.z - p.z);
      if (d <= s.radius && d < bestD) {
        best = s;
        bestD = d;
      }
    }
    if (best) {
      const def = getInteraction(best.id)!;
      ui.setPrompt({ id: best.id, label: def.label(getSave()), kind: 'object' });
    } else if (dc < 2.6 && !this.companionScripted) {
      ui.setPrompt({ id: 'companion', label: personalContent.story.actions.talkToHim, kind: 'talk' });
    } else {
      ui.setPrompt(null);
    }
  }

  /** Perform the current prompt's action (E key / interact button). */
  interact() {
    const ui = useUI.getState();
    if (ui.dialogue) {
      if (!ui.dialogue.choices || ui.dialogue.index < ui.dialogue.lines.length - 1) ui.advanceDialogue();
      return;
    }
    if (isGameplayBlocked()) return;
    const prompt = ui.prompt;
    if (!prompt) return;
    audio.sfx('ui');
    if (prompt.kind === 'talk') {
      void getTalkHandler()?.();
      return;
    }
    const def = getInteraction(prompt.id);
    if (def && def.available(getSave())) void def.run();
  }

  /** Talk to him from anywhere nearby (HUD heart button). */
  talk() {
    if (isGameplayBlocked() || !useUI.getState().companionNear) return;
    audio.sfx('ui');
    void getTalkHandler()?.();
  }

  private updateTriggers() {
    const p = runtime.player;
    const c = runtime.companion;
    const check = (id: 'storm' | 'hilltop' | 'stormCompanion', inside: boolean) => {
      if (inside && !this.triggerState[id]) emit('trigger', { id });
      this.triggerState[id] = inside;
    };
    const ow = p.area === 'overworld';
    check('storm', ow && inShape(STORM_TRIGGER, p.x, p.z));
    check('hilltop', ow && inShape(HILLTOP_TRIGGER, p.x, p.z));
    check('stormCompanion', ow && c.visible && c.mode === 'hold' && Math.hypot(c.x - p.x, c.z - p.z) < 3.2);
  }

  private updatePersistence(dt: number) {
    this.saveTimer -= dt;
    this.playTimer += dt;
    if (this.playTimer >= 15) {
      useGameStore.getState().addPlayTime(Math.round(this.playTimer));
      this.playTimer = 0;
    }
    if (this.saveTimer > 0) return;
    this.saveTimer = 4;
    const p = runtime.player;
    if (Math.hypot(p.x - this.lastSaved.x, p.z - this.lastSaved.z) > 0.5) {
      this.lastSaved = { x: p.x, z: p.z };
      useGameStore.getState().savePlayer({ area: p.area, x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: +p.yaw.toFixed(3) });
    }
  }

  private updateWeather(dt: number, reducedMotion: boolean) {
    const w = runtime.weather;
    w.storm += (w.stormTarget - w.storm) * damp(0.45, dt);
    w.rainbow += (w.rainbowTarget - w.rainbow) * damp(0.35, dt);
    w.night += (w.nightTarget - w.night) * damp(0.4, dt);
    w.fog += (w.fogTarget - w.fog) * damp(0.8, dt);
    w.flash = Math.max(0, w.flash - dt * 1.6);

    // Controlled lightning: soft, infrequent, never strobing.
    if (w.storm > 0.55 && runtime.player.area === 'overworld') {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 8 + Math.random() * 7;
        if (!reducedMotion) w.flash = 0.55;
        this.pendingThunder = runtime.time + 0.5 + Math.random() * 0.9;
      }
    }
    if (this.pendingThunder !== null && runtime.time >= this.pendingThunder) {
      this.pendingThunder = null;
      audio.sfx('thunder', w.storm);
    }
  }

  // ------------------------------------------------------------- transitions
  /**
   * Move the Princess to another area or far point with a fade. The companion
   * comes through right behind her and walks up — he is never simply
   * teleported to her side.
   */
  async transition(to: SpawnPoint, companionEntry?: { x: number; z: number }) {
    const ui = useUI.getState();
    ui.setFade(1);
    await wait(420);
    const p = runtime.player;
    const changedArea = p.area !== to.area;
    p.area = to.area;
    p.x = to.x;
    p.z = to.z;
    p.yaw = to.yaw;
    p.vx = p.vz = 0;
    p.speed = 0;
    p.moving = false;
    p.y = heightAt(to.area, to.x, to.z);
    runtime.camera.yaw = to.yaw;
    if (changedArea) runtime.areaEpoch++;
    const c = runtime.companion;
    if (c.mode !== 'absent') {
      const entry = companionEntry ?? this.behind(to, 2.2);
      arriveThroughDoor(c, to.area, entry.x, entry.z, to.yaw, 0.65);
    }
    useWorld.getState().setArea(to.area);
    this.spotsDirty = true;
    this.triggerState = { storm: false, hilltop: false, stormCompanion: false };
    this.zoneTimer = 0;
    useGameStore.getState().savePlayer({ area: p.area, x: p.x, z: p.z, yaw: p.yaw });
    if (changedArea) emit('areaChanged', { area: to.area });
    await wait(180);
    ui.setFade(0);
  }

  private behind(to: SpawnPoint, d: number) {
    const w = this.worlds[to.area];
    const x = to.x - Math.sin(to.yaw) * d;
    const z = to.z - Math.cos(to.yaw) * d;
    return w.nearestFree(x, z, 0.45, 4) ?? { x: to.x, z: to.z };
  }

  /** Reset runtime state after "reset progress". */
  resetRuntime(spawn: SpawnPoint) {
    const p = runtime.player;
    p.area = spawn.area;
    p.x = spawn.x;
    p.z = spawn.z;
    p.yaw = spawn.yaw;
    p.vx = p.vz = p.speed = 0;
    p.pose = 'normal';
    runtime.camera.yaw = spawn.yaw;
    runtime.camera.mode = 'showcase';
    runtime.areaEpoch++;
    Object.assign(runtime.weather, { storm: 0, stormTarget: 0, rainbow: 0, rainbowTarget: 0, night: 0, nightTarget: 0, flash: 0, fog: 0, fogTarget: 0 });
    Object.assign(runtime.anim, {
      crownFlight: 0,
      crownFlightActive: false,
      coronationBloom: 0,
      bouquetLift: 0,
      castleGate: 0,
      archGlow: 0,
      plots: {},
      mirrorGlow: 0,
      fireworks: false,
      fireworksIntensity: 0,
      secretDoor: 0,
      cakeReveal: 0,
      candlesOut: 0,
      windowFireworks: false,
    });
    runtime.companion.mode = 'absent';
    runtime.companion.visible = false;
    this.companionScripted = false;
    this.spotsDirty = true;
    this.syncGates();
    useWorld.getState().setArea(spawn.area);
    useUI.getState().setLocation(locationAt(spawn.area, spawn.x, spawn.z));
  }
}

export const game = new Game();
