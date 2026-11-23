/**
 * SAVE MANAGER — the persistence layer behind the progress store.
 *
 * Plugged into zustand `persist` as its storage. Responsibilities:
 *  - Schema versioning + forward migrations (v1 → v2 …).
 *  - Validation & normalisation of every loaded save: a missing or broken
 *    field is repaired with its default — a valid save is never discarded
 *    because one field is missing.
 *  - Corruption handling: unreadable data is quarantined (never deleted) and
 *    the last valid backup is restored automatically.
 *  - Backups: the last valid save is copied aside at session start and
 *    before destructive actions (reset, import, restore).
 *  - Debounced writes (coalesces bursts; flushed on tab hide / close), so
 *    storage is never written every frame.
 *  - Save status for the UI ("Saving…", "Progress saved", "Save failed").
 *  - Export / import of a validated JSON backup file.
 *
 * Storage is local to this browser only (localStorage). Nothing is synced.
 */
import { create } from 'zustand';
import type { PersistStorage, StorageValue } from 'zustand/middleware';
import { ITEMS, QUESTS } from '../../config/questConfig';
import type { Appearance, ItemId, QuestId, SaveData } from '../../stores/progressTypes';
import { createEmptySave, DEFAULT_APPEARANCE, PROGRESS_KEY, SAVE_VERSION } from '../../stores/saveDefaults';
import { LOCATION_INFO } from '../WorldManager/locations';
import { AREA_BOUNDS } from '../WorldManager/worldLayout';
import type { AreaId, LocationId } from '../WorldManager/worldTypes';
import { safeStorage, type WriteResult } from './safeStorage';

export const BACKUP_KEY = 'awmjfh.progress.backup';
export const CORRUPT_KEY = 'awmjfh.progress.corrupt';
export const EXPORT_APP_ID = 'a-world-made-just-for-her';
export const EXPORT_KIND = 'save-backup';
const WRITE_DELAY_MS = 350;
const MAX_IMPORT_BYTES = 512 * 1024;

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): WriteResult;
  removeItem(key: string): void;
}

// ============================================================================
// VALIDATION & NORMALISATION
// ============================================================================
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const HEX = /^#[0-9a-fA-F]{6}$/;
const COLLECTED_KEY = /^[a-z]+:[A-Za-z0-9_]{1,40}$/;
const QUEST_IDS = new Set<string>(QUESTS.map((q) => q.id));
const ITEM_IDS = new Set<string>(Object.keys(ITEMS));
const LOCATION_IDS = new Set<string>(Object.keys(LOCATION_INFO));
const AREAS: AreaId[] = ['overworld', 'castle'];
const SAVE_KEYS = ['flags', 'collected', 'completedQuests', 'inventory', 'visited', 'dialogue', 'player', 'appearance', 'stats'];

export interface ValidationResult {
  /** False only when the input is not a save at all (nothing recognisable). */
  ok: boolean;
  data: SaveData;
  /** Human-readable list of repaired / dropped fields. */
  issues: string[];
}

function numberRecord(v: unknown, allow: (k: string) => boolean, field: string, issues: string[], opts: { int?: boolean; min?: number } = {}) {
  const out: Record<string, number> = {};
  if (v === undefined) return out;
  if (!isObj(v)) {
    issues.push(`${field}: not an object (reset)`);
    return out;
  }
  for (const [k, raw] of Object.entries(v)) {
    const value: unknown = typeof raw === 'boolean' ? (raw ? 1 : 0) : raw;
    if (!allow(k) || !finite(value)) {
      issues.push(`${field}.${k}: invalid (dropped)`);
      continue;
    }
    let n: number = value;
    if (opts.int) n = Math.floor(n);
    if (opts.min !== undefined && n < opts.min) {
      issues.push(`${field}.${k}: below ${opts.min} (dropped)`);
      continue;
    }
    out[k] = n;
  }
  return out;
}

/**
 * Validate and repair save data. Never throws. Unknown extra keys are
 * ignored; missing / malformed fields fall back to defaults.
 */
export function validateSaveData(input: unknown): ValidationResult {
  const issues: string[] = [];
  const empty = createEmptySave();
  if (!isObj(input) || !SAVE_KEYS.some((k) => k in input)) {
    return { ok: false, data: empty, issues: ['not a save object'] };
  }
  const data = createEmptySave();

  // flags: booleans only
  if (input.flags !== undefined) {
    if (isObj(input.flags)) {
      for (const [k, v] of Object.entries(input.flags)) {
        if (typeof v === 'boolean') (data.flags as Record<string, boolean>)[k] = v;
        else issues.push(`flags.${k}: not boolean (dropped)`);
      }
    } else issues.push('flags: not an object (reset)');
  } else issues.push('flags: missing (default)');

  data.collected = numberRecord(input.collected, (k) => COLLECTED_KEY.test(k), 'collected', issues, { min: 0 });
  data.completedQuests = numberRecord(input.completedQuests, (k) => QUEST_IDS.has(k), 'completedQuests', issues, { min: 0 }) as Partial<Record<QuestId, number>>;
  const inv = numberRecord(input.inventory, (k) => ITEM_IDS.has(k), 'inventory', issues, { int: true, min: 0 });
  for (const k of Object.keys(inv)) if (inv[k] === 0) delete inv[k];
  data.inventory = inv as Partial<Record<ItemId, number>>;
  data.visited = numberRecord(input.visited, (k) => LOCATION_IDS.has(k), 'visited', issues, { min: 0 }) as Partial<Record<LocationId, number>>;

  // dialogue memory
  const d = input.dialogue;
  if (isObj(d)) {
    data.dialogue.seen = numberRecord(d.seen, () => true, 'dialogue.seen', issues, { int: true, min: 0 });
    if (finite(d.talkCount) && d.talkCount >= 0) data.dialogue.talkCount = Math.floor(d.talkCount);
    if (Array.isArray(d.recentTopics)) data.dialogue.recentTopics = d.recentTopics.filter((t): t is string => typeof t === 'string').slice(-8);
    if (Array.isArray(d.pendingReactions)) data.dialogue.pendingReactions = d.pendingReactions.filter((t): t is string => typeof t === 'string').slice(-20);
    if (finite(d.memoryCursor) && d.memoryCursor >= 0) data.dialogue.memoryCursor = Math.floor(d.memoryCursor);
    if (finite(d.lastTalkAt)) data.dialogue.lastTalkAt = d.lastTalkAt;
  } else if (d !== undefined) issues.push('dialogue: not an object (reset)');

  // player checkpoint
  const p = input.player;
  if (isObj(p)) {
    const area = AREAS.includes(p.area as AreaId) ? (p.area as AreaId) : null;
    const b = area ? AREA_BOUNDS[area] : null;
    if (area && b && finite(p.x) && finite(p.z) && p.x >= b.minX && p.x <= b.maxX && p.z >= b.minZ && p.z <= b.maxZ) {
      data.player = { area, x: p.x, z: p.z, yaw: finite(p.yaw) ? p.yaw : Math.PI };
    } else issues.push('player: invalid checkpoint (start position used)');
  } else if (p !== undefined && p !== null) issues.push('player: invalid (start position used)');

  // appearance colours
  if (isObj(input.appearance)) {
    for (const k of Object.keys(DEFAULT_APPEARANCE) as Array<keyof Appearance>) {
      const v = input.appearance[k];
      if (typeof v === 'string' && HEX.test(v)) data.appearance[k] = v;
      else if (v !== undefined) issues.push(`appearance.${k}: invalid colour (default)`);
    }
  }

  // stats
  if (isObj(input.stats)) {
    const s = input.stats;
    data.stats.startedAt = finite(s.startedAt) ? s.startedAt : null;
    data.stats.completedAt = finite(s.completedAt) ? s.completedAt : null;
    data.stats.playSeconds = finite(s.playSeconds) && s.playSeconds >= 0 ? s.playSeconds : 0;
  }

  data.version = SAVE_VERSION;
  return { ok: true, data, issues };
}

// ============================================================================
// MIGRATIONS
// ============================================================================
/**
 * Upgrade raw state from an older schema version. Each step is small and
 * pure; the result is then validated. Add new steps here when the schema
 * changes (never edit an existing step).
 */
export function migrateSave(state: unknown, fromVersion: number): unknown {
  let s = state;
  let v = fromVersion;
  if (v < 2 && isObj(s)) {
    // v1 → v2: identical shape. v1 never validated anything, so values are
    // normalised by validateSaveData; mark the new version.
    s = { ...s, version: 2 };
    v = 2;
  }
  return s;
}

export interface ParsedSave {
  data: SaveData;
  version: number;
  savedAt: number | null;
  issues: string[];
}

export type ParseFailure = 'empty' | 'json' | 'future' | 'invalid';

/** Parse a stored string (persist envelope `{state, version}` or a bare save). */
export function parseStoredSave(raw: string | null): { ok: true; save: ParsedSave } | { ok: false; reason: ParseFailure } {
  if (raw === null || raw === '') return { ok: false, reason: 'empty' };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'json' };
  }
  let state: unknown = json;
  let version = 1;
  let savedAt: number | null = null;
  if (isObj(json) && 'state' in json) {
    state = json.state;
    version = finite(json.version) ? json.version : 1;
    savedAt = finite(json.savedAt) ? json.savedAt : null;
  } else if (isObj(json) && finite(json.version)) {
    version = json.version;
  }
  if (version > SAVE_VERSION) return { ok: false, reason: 'future' };
  const migrated = migrateSave(state, version);
  const v = validateSaveData(migrated);
  if (!v.ok) return { ok: false, reason: 'invalid' };
  return { ok: true, save: { data: v.data, version, savedAt, issues: v.issues } };
}

/** Does this save contain any real progress worth protecting? */
export function hasProgress(s: SaveData) {
  return Object.keys(s.flags).length > 0 || Object.keys(s.completedQuests).length > 0 || Object.keys(s.collected).length > 0;
}

/** Fields whose change means "meaningful progress" (not just walking around). */
export function progressSignature(s: Pick<SaveData, 'flags' | 'completedQuests' | 'collected' | 'inventory' | 'visited' | 'appearance'>) {
  return JSON.stringify([s.flags, s.completedQuests, Object.keys(s.collected).sort(), s.inventory, Object.keys(s.visited).sort(), s.appearance]);
}

export function summarize(s: SaveData) {
  return {
    quests: Object.keys(s.completedQuests).length,
    strawberries: Object.keys(s.collected).filter((k) => k.startsWith('berry:')).length,
    flowers: Object.keys(s.collected).filter((k) => k.startsWith('flower:')).length,
    crowned: !!s.flags.crownAccepted,
    finished: !!s.flags.finalLetterRead,
  };
}

// ============================================================================
// STATUS (for the UI)
// ============================================================================
export type SaveState = 'idle' | 'saving' | 'saved' | 'failed' | 'memory';

interface SaveStatusStore {
  state: SaveState;
  lastSavedAt: number | null;
  error: string | null;
  /** Set when the stored save could not be read and something was recovered. */
  recovery: null | { from: 'backup' | 'none'; reason: ParseFailure | 'missing'; at: number };
  /** Number of repaired fields in the loaded save (diagnostics). */
  repaired: number;
  set: (p: Partial<Omit<SaveStatusStore, 'set'>>) => void;
}

export const useSaveStatus = create<SaveStatusStore>()((set) => ({
  state: 'idle',
  lastSavedAt: null,
  error: null,
  recovery: null,
  repaired: 0,
  set: (p) => set(p),
}));

// ============================================================================
// BACKUP RECORD
// ============================================================================
export interface BackupInfo {
  savedAt: number;
  reason: string;
  summary: ReturnType<typeof summarize>;
}

// ============================================================================
// MANAGER
// ============================================================================
export class SaveManager {
  private pending: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastSignature: string | null = null;
  private sessionBackupDone = false;

  constructor(private readonly backend: StorageBackend) {
    if (typeof window !== 'undefined') {
      const flush = () => this.flush();
      window.addEventListener('pagehide', flush);
      window.addEventListener('beforeunload', flush);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush();
      });
    }
  }

  /** zustand `persist` storage adapter. */
  readonly progressStorage: PersistStorage<SaveData> = {
    getItem: (name) => this.load(name),
    setItem: (name, value) => this.queueWrite(name, value),
    removeItem: (name) => {
      this.cancelPending();
      this.backend.removeItem(name);
    },
  };

  // --------------------------------------------------------------- loading
  private load(name: string): StorageValue<SaveData> | null {
    const status = useSaveStatus.getState();
    const raw = this.backend.getItem(name);
    const parsed = parseStoredSave(raw);
    if (parsed.ok) {
      const { data, issues, savedAt } = parsed.save;
      this.lastSignature = progressSignature(data);
      status.set({ repaired: issues.length, lastSavedAt: savedAt, state: 'idle' });
      if (issues.length) console.info('[save] repaired fields:', issues);
      // Keep a copy of the last good save from the start of this session.
      if (!this.sessionBackupDone && hasProgress(data)) {
        this.writeBackup(data, 'session-start');
        this.sessionBackupDone = true;
      }
      return { state: data, version: SAVE_VERSION };
    }

    // Unreadable or missing → keep the evidence, try the backup.
    if (parsed.reason !== 'empty' && raw !== null) this.backend.setItem(CORRUPT_KEY, raw);
    const backup = this.readBackup();
    if (backup) {
      console.warn(`[save] main save unreadable (${parsed.reason}); restored backup saved at`, new Date(backup.info.savedAt).toISOString());
      this.lastSignature = progressSignature(backup.data);
      status.set({ recovery: { from: 'backup', reason: parsed.reason === 'empty' ? 'missing' : parsed.reason, at: Date.now() }, state: 'idle' });
      // Re-write the recovered save as the main save right away.
      this.backend.setItem(name, JSON.stringify({ state: backup.data, version: SAVE_VERSION, savedAt: Date.now() }));
      return { state: backup.data, version: SAVE_VERSION };
    }
    if (parsed.reason !== 'empty') {
      console.warn(`[save] main save unreadable (${parsed.reason}); no backup — starting fresh. Raw data kept under "${CORRUPT_KEY}".`);
      status.set({ recovery: { from: 'none', reason: parsed.reason, at: Date.now() } });
    }
    return null;
  }

  // --------------------------------------------------------------- writing
  private queueWrite(name: string, value: StorageValue<SaveData>) {
    const state = value.state;
    const signature = progressSignature(state);
    const meaningful = signature !== this.lastSignature;
    this.lastSignature = signature;
    this.pending = JSON.stringify({ state, version: SAVE_VERSION, savedAt: Date.now() });
    this.pendingName = name;
    if (meaningful) useSaveStatus.getState().set({ state: 'saving', error: null });
    if (this.timer === null) this.timer = setTimeout(() => this.flush(), WRITE_DELAY_MS);
  }
  private pendingName = PROGRESS_KEY;

  private cancelPending() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.pending = null;
  }

  /** Write any pending save now (called automatically on tab hide / close). */
  flush(): WriteResult | 'nothing' {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    const data = this.pending;
    if (data === null) return 'nothing';
    this.pending = null;
    let res = this.backend.setItem(this.pendingName, data);
    if (res === 'error') {
      // Storage full? Free our own diagnostic copy and try once more.
      this.backend.removeItem(CORRUPT_KEY);
      res = this.backend.setItem(this.pendingName, data);
    }
    const status = useSaveStatus.getState();
    if (res === 'ok') status.set({ state: status.state === 'saving' ? 'saved' : status.state === 'failed' ? 'saved' : status.state, lastSavedAt: Date.now(), error: null });
    else if (res === 'memory') status.set({ state: 'memory' });
    else status.set({ state: 'failed', error: 'Storan pelayar penuh atau tidak dibenarkan.' });
    return res;
  }

  // --------------------------------------------------------------- backups
  private writeBackup(data: SaveData, reason: string) {
    const rec = { savedAt: Date.now(), reason, version: SAVE_VERSION, state: data };
    return this.backend.setItem(BACKUP_KEY, JSON.stringify(rec));
  }

  /** Copy the given (current) save aside before something destructive. */
  backup(data: SaveData, reason: string) {
    if (!hasProgress(data)) return false;
    return this.writeBackup(data, reason) !== 'error';
  }

  readBackup(): { data: SaveData; info: BackupInfo } | null {
    const raw = this.backend.getItem(BACKUP_KEY);
    if (!raw) return null;
    try {
      const rec = JSON.parse(raw) as { savedAt?: number; reason?: string; version?: number; state?: unknown };
      const version = finite(rec.version) ? rec.version : 1;
      if (version > SAVE_VERSION) return null;
      const v = validateSaveData(migrateSave(rec.state, version));
      if (!v.ok || !hasProgress(v.data)) return null;
      return { data: v.data, info: { savedAt: finite(rec.savedAt) ? rec.savedAt : 0, reason: rec.reason ?? 'unknown', summary: summarize(v.data) } };
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------- export / import
  /** Build the JSON text of an export file. Contains only game progress & game settings. */
  exportText(save: SaveData, settings: Record<string, unknown>) {
    const progress = validateSaveData(save).data;
    return JSON.stringify(
      {
        app: EXPORT_APP_ID,
        kind: EXPORT_KIND,
        schemaVersion: SAVE_VERSION,
        exportedAt: new Date().toISOString(),
        progress,
        settings,
      },
      null,
      2,
    );
  }

  /** Validate an import file. Never touches the current save. */
  parseImport(text: string):
    | { ok: true; data: SaveData; settings: Record<string, unknown> | null; summary: ReturnType<typeof summarize>; issues: string[]; exportedAt: string | null }
    | { ok: false; error: string } {
    if (text.length > MAX_IMPORT_BYTES) return { ok: false, error: 'Fail terlalu besar untuk fail simpanan.' };
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, error: 'Fail ini bukan JSON yang sah.' };
    }
    if (!isObj(json) || json.app !== EXPORT_APP_ID || json.kind !== EXPORT_KIND) {
      return { ok: false, error: 'Fail ini bukan fail simpanan "A World Made Just For Her".' };
    }
    const version = finite(json.schemaVersion) ? json.schemaVersion : 0;
    if (version < 1) return { ok: false, error: 'Versi fail simpanan tidak dikenali.' };
    if (version > SAVE_VERSION) return { ok: false, error: 'Fail simpanan ini dari versi permainan yang lebih baharu. Kemas kini permainan dahulu.' };
    const v = validateSaveData(migrateSave(json.progress, version));
    if (!v.ok) return { ok: false, error: 'Kandungan fail simpanan rosak atau tidak lengkap.' };
    const settings = isObj(json.settings) ? json.settings : null;
    return { ok: true, data: v.data, settings, summary: summarize(v.data), issues: v.issues, exportedAt: typeof json.exportedAt === 'string' ? json.exportedAt : null };
  }
}

export const saveManager = new SaveManager(safeStorage);
