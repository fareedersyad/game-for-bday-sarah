/**
 * MUSIC BOX SONG — "Jatuh Suka" played ONLY from the Music Box in the castle's
 * Grand Hall (next to the throne).
 *
 * - Play / pause: each interaction with the Music Box toggles; pausing keeps
 *   the position, so playing again resumes where it stopped.
 * - It plays only while Sarah is in the Grand Hall: leaving the hall, leaving
 *   the game screen or switching browser tab pauses it automatically.
 * - While it plays, the castle's procedural background theme is lowered and
 *   restored on pause/end. Other areas' music is never touched.
 * - Phones: play() is called directly inside the tap/key handler (a user
 *   gesture), and the file is only downloaded on the first play.
 * - Not part of the save system: nothing about the song is stored.
 */
import { useSyncExternalStore } from 'react';
import { gameConfig } from '../../config/gameConfig';
import { audio } from './audioEngine';

export type MusicBoxState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

/** The parts of HTMLAudioElement we use (lets the tests use a fake). */
export interface MediaLike {
  src: string;
  preload: string;
  currentTime: number;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(type: string, listener: () => void): void;
}

export interface MusicBoxDeps {
  /** URL of the song file. */
  src: string;
  createElement: () => MediaLike;
  /** Route the element through the game's music volume (returns false if not possible). */
  attach: (el: MediaLike) => boolean;
  /** Lower / restore the procedural background theme. */
  duck: (on: boolean) => void;
}

/** Where the song is allowed to keep playing. */
export interface MusicBoxContext {
  screen: string;
  location: string;
  area: string;
  hidden: boolean;
}

export const MUSIC_BOX_LOCATION = 'castleHall';

export function createMusicBox(deps: MusicBoxDeps) {
  let el: MediaLike | null = null;
  let state: MusicBoxState = 'idle';
  const listeners = new Set<() => void>();

  const audible = (s: MusicBoxState) => s === 'playing' || s === 'loading';
  const set = (next: MusicBoxState) => {
    if (next === state) return;
    const changedDuck = audible(next) !== audible(state);
    state = next;
    if (changedDuck) deps.duck(audible(next));
    listeners.forEach((l) => l());
  };

  const ensure = () => {
    if (el) return el;
    const e = deps.createElement();
    e.preload = 'auto';
    e.src = deps.src;
    e.addEventListener('playing', () => set('playing'));
    e.addEventListener('waiting', () => state === 'playing' && set('loading'));
    e.addEventListener('pause', () => (state === 'playing' || state === 'loading') && set('paused'));
    e.addEventListener('ended', () => {
      e.currentTime = 0;
      set('idle');
    });
    e.addEventListener('error', () => set('error'));
    try {
      deps.attach(e);
    } catch {
      /* plays directly through the element */
    }
    el = e;
    return e;
  };

  const play = () => {
    const retry = state === 'error' && el !== null;
    const e = ensure();
    if (retry) e.src = deps.src; // reload after a failed download
    set('loading');
    try {
      const p = e.play();
      if (p && typeof p.then === 'function') {
        p.then(
          () => state === 'loading' && set('playing'),
          (err: unknown) => {
            // Autoplay refusal (no gesture) or decode/network failure.
            const name = err instanceof Error ? err.name : '';
            set(name === 'NotAllowedError' || name === 'AbortError' ? 'paused' : 'error');
          },
        );
      }
    } catch {
      set('error');
    }
  };

  const pause = () => {
    if (!el) return;
    el.pause();
    if (state === 'playing' || state === 'loading') set('paused');
  };

  return {
    getState: () => state,
    /** Current position in seconds (0 before the first play). */
    position: () => el?.currentTime ?? 0,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    get isActive() {
      return state === 'playing' || state === 'loading';
    },
    /** Called from the Music Box interaction (inside the user's tap / key press). */
    toggle() {
      if (state === 'playing' || state === 'loading') pause();
      else play();
    },
    pause,
    /** Pause automatically when Sarah leaves the Grand Hall / the game / the tab. */
    enforce(ctx: MusicBoxContext) {
      if (!(state === 'playing' || state === 'loading')) return;
      const allowed = ctx.screen === 'playing' && ctx.area === 'castle' && ctx.location === MUSIC_BOX_LOCATION && !ctx.hidden;
      if (!allowed) pause();
    },
  };
}

export type MusicBox = ReturnType<typeof createMusicBox>;

// ------------------------------------------------------------------ app instance


export const musicBox = createMusicBox({
  src: `${import.meta.env.BASE_URL ?? './'}${gameConfig.MUSIC_BOX.file}`,
  createElement: () => {
    const a = new Audio();
    a.setAttribute('playsinline', '');
    return a;
  },
  attach: (el) => audio.attachMediaElement(el as HTMLMediaElement),
  duck: (on) => audio.duckThemes(on),
});

/** React hook: current Music Box state. */
export function useMusicBox(): MusicBoxState {
  return useSyncExternalStore(musicBox.subscribe, musicBox.getState, musicBox.getState);
}
