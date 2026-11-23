/**
 * Chooses music theme and ambience levels from context (screen, area,
 * location, weather, open overlays), and applies the volume settings.
 */
import { useSettings } from '../../stores/settingsStore';
import { useUI } from '../../stores/uiStore';
import { runtime } from '../runtime';
import { LANDMARKS } from '../WorldManager/worldLayout';
import { audio, type MusicTheme } from './audioEngine';
import { musicBox } from './musicBoxPlayer';

let timer = 0;
let lastLevelsKey = '';
/** A story script may pin a theme (e.g. the fireworks finale). */
let pinnedTheme: MusicTheme | null = null;

export function pinMusic(theme: MusicTheme | null) {
  pinnedTheme = theme;
  timer = 0;
}

export function updateAudioDirector(dt: number) {
  timer -= dt;
  if (timer > 0) return;
  timer = 0.5;

  const s = useSettings.getState();
  const key = `${s.masterVolume}|${s.musicVolume}|${s.sfxVolume}|${s.muted}|${s.thunderEnabled}|${s.thunderVolume}`;
  if (key !== lastLevelsKey) {
    lastLevelsKey = key;
    audio.applyLevels(s);
  }
  if (!audio.unlocked) return;

  const ui = useUI.getState();
  const p = runtime.player;
  // The Music Box song only plays in the Grand Hall (never elsewhere).
  musicBox.enforce({ screen: ui.screen, location: ui.location, area: p.area, hidden: typeof document !== 'undefined' && document.hidden });
  const w = runtime.weather;
  const topOverlay = ui.overlays[ui.overlays.length - 1]?.overlay;

  let theme: MusicTheme = 'kingdom';
  if (ui.screen === 'title' || ui.screen === 'opening' || ui.screen === 'boot') theme = 'title';
  else if (pinnedTheme) theme = pinnedTheme;
  else if (topOverlay?.type === 'letter' && s.letterMusic) theme = 'letter';
  else if (ui.location === 'secretRoom') theme = 'secret';
  else if (p.area === 'castle') theme = 'castle';
  else if (w.storm > 0.35) theme = 'storm';
  else if (w.night > 0.5) theme = 'night';
  audio.setMusic(theme);

  const outdoors = p.area === 'overworld';
  const nearFountain = Math.min(
    Math.hypot(p.x - LANDMARKS.gardenFountain.x, p.z - LANDMARKS.gardenFountain.z),
    Math.hypot(p.x - LANDMARKS.castleFountain.x, p.z - LANDMARKS.castleFountain.z),
  );
  audio.setAmbience({
    birds: outdoors ? (1 - w.storm) * (1 - w.night) * (ui.location === 'garden' || ui.location === 'children' ? 1 : 0.55) : 0,
    wind: outdoors ? 0.12 + w.storm * 0.7 + (ui.location === 'fireworks' ? 0.15 : 0) : 0.02,
    fountain: outdoors ? Math.max(0, 1 - nearFountain / 14) : 0,
    rain: outdoors ? w.storm : w.storm * 0.15,
  });
}
