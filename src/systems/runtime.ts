/**
 * Mutable per-frame runtime state shared by the simulation and renderers.
 * Kept outside React on purpose: positions change 60×/second and must not
 * trigger re-renders. UI-relevant changes are pushed to the zustand stores.
 */
import { createCompanionState, type CompanionState } from './CompanionController/companionController';
import type { AreaId } from './WorldManager/worldTypes';
import { LANDMARKS } from './WorldManager/worldLayout';

export interface PlayerRuntime {
  area: AreaId;
  x: number;
  z: number;
  y: number;
  yaw: number;
  vx: number;
  vz: number;
  speed: number;
  moving: boolean;
  /** Seconds since she last moved. */
  idleTime: number;
  /** Optional pose override for scripted moments. */
  pose: 'normal' | 'sit' | 'wave' | 'hold' | 'sitGround';
}

export type CameraMode = 'follow' | 'cinematic' | 'showcase';

export interface CameraRuntime {
  mode: CameraMode;
  yaw: number;
  pitch: number;
  distance: number;
  /** Cinematic targets (world space). */
  pos: [number, number, number];
  look: [number, number, number];
  /** Seconds to blend to the new cinematic shot (0 = cut). */
  blend: number;
  shake: number;
}

export interface WeatherRuntime {
  /** 0 clear … 1 full storm. */
  storm: number;
  stormTarget: number;
  rainbow: number;
  rainbowTarget: number;
  /** 0 day … 1 night. */
  night: number;
  nightTarget: number;
  /** Brief gentle lightning brightening (0..1). */
  flash: number;
  /** Fog thickness for the "separated" moment in the forest. */
  fog: number;
  fogTarget: number;
}

export interface AnimRuntime {
  /** Coronation crown flight 0..1 (0 = on cushion, 1 = on her head). */
  crownFlight: number;
  crownFlightActive: boolean;
  /** Flowers blooming around the coronation plaza 0..1. */
  coronationBloom: number;
  /** Bouquet lift into her hands 0..1. */
  bouquetLift: number;
  /** Castle gate open amount 0..1. */
  castleGate: number;
  /** Golden particles gathering at the arch 0..1. */
  archGlow: number;
  /** Per-plot growth 0..1 (sprout) and bloom 0..1. */
  plots: Record<string, { growth: number; bloom: number }>;
  /** Mirror magical glow 0..1. */
  mirrorGlow: number;
  /** Fireworks running. */
  fireworks: boolean;
  fireworksIntensity: number;
  /** Secret door open 0..1. */
  secretDoor: number;
  /** Ball offset for the children's ball toy. */
  ballKick: number;
  ballDir: number;
  /** Companion emote. */
  companionEmote: 'none' | 'heart' | 'laugh' | 'wave' | 'note';
  companionEmoteUntil: number;
  /** Birthday cake: cloche lifted 0..1, candles extinguished 0..1, fireworks seen through the window. */
  cakeReveal: number;
  candlesOut: number;
  windowFireworks: boolean;
  /** Princess emote (sparkle hearts). */
  playerEmote: 'none' | 'heart' | 'sparkle';
  playerEmoteUntil: number;
}

export interface SparkleEvent {
  id: number;
  area: AreaId;
  x: number;
  y: number;
  z: number;
  color: string;
  count: number;
  born: number;
}

export const runtime = {
  player: {
    area: 'overworld',
    x: LANDMARKS.spawn.x,
    z: LANDMARKS.spawn.z,
    y: 0,
    yaw: LANDMARKS.spawn.yaw,
    vx: 0,
    vz: 0,
    speed: 0,
    moving: false,
    idleTime: 0,
    pose: 'normal',
  } as PlayerRuntime,
  companion: createCompanionState('overworld', LANDMARKS.companionDebut.x, LANDMARKS.companionDebut.z) as CompanionState,
  camera: {
    mode: 'showcase',
    yaw: Math.PI,
    pitch: 0.42,
    distance: 7.5,
    pos: [0, 6, 20],
    look: [0, 1.5, 6],
    blend: 1,
    shake: 0,
  } as CameraRuntime,
  weather: {
    storm: 0,
    stormTarget: 0,
    rainbow: 0,
    rainbowTarget: 0,
    night: 0,
    nightTarget: 0,
    flash: 0,
    fog: 0,
    fogTarget: 0,
  } as WeatherRuntime,
  anim: {
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
    ballKick: 0,
    ballDir: 0,
    companionEmote: 'none',
    companionEmoteUntil: 0,
    playerEmote: 'none',
    playerEmoteUntil: 0,
  } as AnimRuntime,
  sparkles: [] as SparkleEvent[],
  /** Elapsed simulated seconds. */
  time: 0,
  /** Incremented whenever the area changes, so renderers can reset. */
  areaEpoch: 0,
};

let sparkleId = 1;
export function emitSparkle(x: number, y: number, z: number, color = '#ffe3a3', count = 24, area: AreaId = runtime.player.area) {
  runtime.sparkles.push({ id: sparkleId++, area, x, y, z, color, count, born: runtime.time });
  if (runtime.sparkles.length > 24) runtime.sparkles.shift();
}

export function setCompanionEmote(e: AnimRuntime['companionEmote'], seconds = 2.5) {
  runtime.anim.companionEmote = e;
  runtime.anim.companionEmoteUntil = runtime.time + seconds;
}

export function setPlayerEmote(e: AnimRuntime['playerEmote'], seconds = 2.5) {
  runtime.anim.playerEmote = e;
  runtime.anim.playerEmoteUntil = runtime.time + seconds;
}
