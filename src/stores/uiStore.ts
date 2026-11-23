/**
 * Runtime UI state (not persisted): screens, panels, overlays, dialogue,
 * prompts and toasts. Overlays and dialogue are promise-based so cutscene
 * scripts can simply `await` them.
 */
import { create } from 'zustand';
import type { LocationId } from '../systems/WorldManager/worldTypes';
import type { QuestId } from './progressTypes';

export type Screen = 'boot' | 'title' | 'opening' | 'playing';
export type Panel = null | 'pause' | 'journal' | 'map' | 'inventory' | 'settings' | 'wardrobe' | 'profile' | 'chat';

export type Speaker = 'him' | 'her' | 'narrator' | 'momo' | 'bunny' | 'mirror' | 'judge';

export interface DialogueLine {
  speaker: Speaker;
  text: string;
  /** Stable id for dialogue memory (optional). */
  id?: string;
}

export interface DialogueChoice {
  id: string;
  label: string;
}

export interface DialogueState {
  key: number;
  lines: DialogueLine[];
  index: number;
  choices: DialogueChoice[] | null;
  resolve: (choice: string | null) => void;
}

export type Overlay =
  | { type: 'story'; lines: string[]; tone?: 'gold' | 'soft' | 'night'; holdMs?: number }
  | { type: 'royalCard' }
  | { type: 'banner'; title: string; subtitle?: string; button?: string; tone?: 'gold' | 'rose' | 'night' }
  | { type: 'letter'; which: 'loveLetter' | 'finalLetter' }
  | { type: 'book'; bookId: string }
  | { type: 'mirror' }
  | { type: 'court'; mode: 'clue'; clueId: string }
  | { type: 'court'; mode: 'verdict' }
  | { type: 'note'; title: string; text: string; kind: 'note' | 'memory' | 'bloom' | 'clue' }
  | { type: 'finalMessage' }
  | { type: 'gift' }
  | { type: 'birthday'; startAt: 'message' | 'blow' }
  | { type: 'questComplete'; questId: QuestId }
  | { type: 'credits' }
  | { type: 'confirm'; title: string; message: string; confirmLabel: string; danger?: boolean };

interface OverlayEntry {
  key: number;
  overlay: Overlay;
  resolve: (result: unknown) => void;
}

export interface Prompt {
  id: string;
  label: string;
  /** 'talk' prompts target the companion. */
  kind: 'object' | 'talk';
}

export interface Toast {
  id: number;
  text: string;
  icon?: string;
}

export interface Bark {
  id: number;
  text: string;
  speaker: Speaker;
  until: number;
}

interface UIStore {
  screen: Screen;
  panel: Panel;
  overlays: OverlayEntry[];
  dialogue: DialogueState | null;
  prompt: Prompt | null;
  location: LocationId;
  locationBanner: { id: number; location: LocationId } | null;
  toasts: Toast[];
  bark: Bark | null;
  cutscene: { active: boolean; skippable: boolean; id: string } | null;
  fade: number;
  savedAt: number;
  /** Companion within talking range (for the HUD talk button). */
  companionNear: boolean;
  letterbox: boolean;

  setScreen: (s: Screen) => void;
  openPanel: (p: Panel) => void;
  closePanel: () => void;
  openOverlay: <T = unknown>(o: Overlay) => Promise<T>;
  closeOverlay: (result?: unknown) => void;
  closeAllOverlays: () => void;
  showDialogue: (lines: DialogueLine[], choices?: DialogueChoice[] | null) => Promise<string | null>;
  advanceDialogue: () => void;
  chooseDialogue: (id: string) => void;
  endDialogue: () => void;
  setPrompt: (p: Prompt | null) => void;
  setLocation: (l: LocationId) => void;
  toast: (text: string, icon?: string) => void;
  dismissToast: (id: number) => void;
  showBark: (text: string, speaker?: Speaker, ms?: number) => void;
  clearBark: () => void;
  setCutscene: (c: UIStore['cutscene']) => void;
  setFade: (f: number) => void;
  flashSaved: () => void;
  setCompanionNear: (v: boolean) => void;
  setLetterbox: (v: boolean) => void;
}

let keySeq = 1;

export const useUI = create<UIStore>()((set, get) => ({
  screen: 'boot',
  panel: null,
  overlays: [],
  dialogue: null,
  prompt: null,
  location: 'courtyard',
  locationBanner: null,
  toasts: [],
  bark: null,
  cutscene: null,
  fade: 0,
  savedAt: 0,
  companionNear: false,
  letterbox: false,

  setScreen: (screen) => set({ screen }),
  openPanel: (panel) => set({ panel }),
  closePanel: () => set({ panel: null }),

  openOverlay: <T,>(overlay: Overlay) =>
    new Promise<T>((resolve) => {
      const entry: OverlayEntry = { key: keySeq++, overlay, resolve: resolve as (r: unknown) => void };
      set((s) => ({ overlays: [...s.overlays, entry] }));
    }),

  closeOverlay: (result) => {
    const top = get().overlays[get().overlays.length - 1];
    if (!top) return;
    set((s) => ({ overlays: s.overlays.slice(0, -1) }));
    top.resolve(result);
  },

  closeAllOverlays: () => {
    const all = get().overlays;
    set({ overlays: [] });
    all.reverse().forEach((o) => o.resolve(undefined));
  },

  showDialogue: (lines, choices = null) =>
    new Promise<string | null>((resolve) => {
      // If a dialogue is already open, resolve it first (never leak promises).
      const prev = get().dialogue;
      if (prev) prev.resolve(null);
      if (lines.length === 0 && !choices) {
        resolve(null);
        return;
      }
      set({ dialogue: { key: keySeq++, lines, index: 0, choices, resolve } });
    }),

  advanceDialogue: () => {
    const d = get().dialogue;
    if (!d) return;
    if (d.index < d.lines.length - 1) {
      set({ dialogue: { ...d, index: d.index + 1 } });
      return;
    }
    if (d.choices && d.choices.length) return; // waiting for a choice
    set({ dialogue: null });
    d.resolve(null);
  },

  chooseDialogue: (id) => {
    const d = get().dialogue;
    if (!d) return;
    set({ dialogue: null });
    d.resolve(id);
  },

  endDialogue: () => {
    const d = get().dialogue;
    if (!d) return;
    set({ dialogue: null });
    d.resolve(null);
  },

  setPrompt: (prompt) => {
    const cur = get().prompt;
    if (cur?.id === prompt?.id && cur?.label === prompt?.label) return;
    set({ prompt });
  },

  setLocation: (location) => {
    if (get().location === location) return;
    set({ location, locationBanner: { id: keySeq++, location } });
  },

  toast: (text, icon) => {
    const id = keySeq++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, icon }] }));
    setTimeout(() => get().dismissToast(id), 3800);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  showBark: (text, speaker = 'him', ms = 4800) => {
    const id = keySeq++;
    set({ bark: { id, text, speaker, until: Date.now() + ms } });
    setTimeout(() => {
      if (get().bark?.id === id) set({ bark: null });
    }, ms);
  },
  clearBark: () => set({ bark: null }),

  setCutscene: (cutscene) => set({ cutscene }),
  setFade: (fade) => set({ fade }),
  flashSaved: () => set({ savedAt: Date.now() }),
  setCompanionNear: (companionNear) => {
    if (get().companionNear !== companionNear) set({ companionNear });
  },
  setLetterbox: (letterbox) => set({ letterbox }),
}));

/** True when gameplay input (movement, interaction) should be suspended. */
export function isGameplayBlocked(): boolean {
  const s = useUI.getState();
  return s.screen !== 'playing' || s.panel !== null || s.overlays.length > 0 || s.dialogue !== null || !!s.cutscene?.active;
}
