import { create } from 'zustand';
import { persist, type PersistStorage } from 'zustand/middleware';
import { safeStorage } from '../systems/SaveManager/safeStorage';
import { prefersReducedMotion } from '../utils/device';

export type GraphicsQuality = 'auto' | 'low' | 'medium' | 'high';
export type RenderMode = 'auto' | '3d' | '2d';
export type TextSpeed = 'slow' | 'normal' | 'fast' | 'instant';

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  thunderEnabled: boolean;
  thunderVolume: number;
  reducedMotion: boolean;
  graphics: GraphicsQuality;
  renderMode: RenderMode;
  cameraSensitivity: number;
  invertCameraY: boolean;
  textSpeed: TextSpeed;
  letterMusic: boolean;
  showFps: boolean;
}

export const SETTINGS_KEY = 'awmjfh.settings.v1';

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8,
  musicVolume: 0.6,
  sfxVolume: 0.8,
  muted: false,
  thunderEnabled: true,
  thunderVolume: 0.5,
  reducedMotion: prefersReducedMotion(),
  graphics: 'auto',
  renderMode: 'auto',
  cameraSensitivity: 1,
  invertCameraY: false,
  textSpeed: 'normal',
  letterMusic: true,
  showFps: false,
};

const ENUMS = {
  graphics: ['auto', 'low', 'medium', 'high'],
  renderMode: ['auto', '3d', '2d'],
  textSpeed: ['slow', 'normal', 'fast', 'instant'],
} as const;
const RANGES: Partial<Record<keyof Settings, [number, number]>> = {
  masterVolume: [0, 1],
  musicVolume: [0, 1],
  sfxVolume: [0, 1],
  thunderVolume: [0, 1],
  cameraSensitivity: [0.3, 2],
};

/** Keep only valid setting values (wrong types / ranges fall back to defaults). */
export function sanitizeSettings(input: unknown): Partial<Settings> {
  const out: Partial<Settings> = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  const src = input as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof Settings>) {
    const v = src[key];
    const def = DEFAULT_SETTINGS[key];
    if (v === undefined) continue;
    if (typeof def === 'boolean' && typeof v === 'boolean') (out as Record<string, unknown>)[key] = v;
    else if (typeof def === 'number' && typeof v === 'number' && Number.isFinite(v)) {
      const [min, max] = RANGES[key] ?? [-Infinity, Infinity];
      (out as Record<string, unknown>)[key] = Math.min(max, Math.max(min, v));
    } else if (key in ENUMS && typeof v === 'string' && (ENUMS[key as keyof typeof ENUMS] as readonly string[]).includes(v)) {
      (out as Record<string, unknown>)[key] = v;
    }
  }
  return out;
}

/** Settings storage that tolerates corrupted JSON (falls back to defaults instead of crashing). */
const settingsStorage: PersistStorage<Partial<Settings>> = {
  getItem: (name) => {
    const raw = safeStorage.getItem(name);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { state?: unknown; version?: number };
      return { state: sanitizeSettings(parsed?.state), version: typeof parsed?.version === 'number' ? parsed.version : 1 };
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    safeStorage.setItem(name, JSON.stringify(value));
  },
  removeItem: (name) => safeStorage.removeItem(name),
};

interface SettingsStore extends Settings {
  update: (patch: Partial<Settings>) => void;
  resetSettings: () => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      update: (patch) => set(sanitizeSettings(patch)),
      resetSettings: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: SETTINGS_KEY,
      version: 1,
      storage: settingsStorage,
      partialize: ({ update: _u, resetSettings: _r, ...rest }) => rest,
      merge: (persisted, current) => ({ ...current, ...DEFAULT_SETTINGS, ...sanitizeSettings(persisted) }),
    },
  ),
);

/** Current settings without the store's action functions (for export). */
export function currentSettings(): Settings {
  const { update: _u, resetSettings: _r, ...rest } = useSettings.getState();
  return rest;
}

export const TEXT_SPEED_CPS: Record<TextSpeed, number> = { slow: 28, normal: 48, fast: 90, instant: 100000 };
