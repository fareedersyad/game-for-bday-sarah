import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptySave, PROGRESS_KEY, SAVE_VERSION } from '../stores/saveDefaults';
import type { SaveData } from '../stores/progressTypes';
import { getSave, useGameStore } from '../stores/gameStore';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../stores/settingsStore';
import {
  BACKUP_KEY,
  CORRUPT_KEY,
  EXPORT_APP_ID,
  EXPORT_KIND,
  parseStoredSave,
  SaveManager,
  saveManager,
  useSaveStatus,
  validateSaveData,
  type StorageBackend,
} from '../systems/SaveManager/saveManager';
import type { WriteResult } from '../systems/SaveManager/safeStorage';

/** In-memory storage that can be told to fail (quota exceeded). */
class FakeBackend implements StorageBackend {
  data = new Map<string, string>();
  writes = 0;
  failNext = 0;
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string): WriteResult {
    if (this.failNext > 0) {
      this.failNext--;
      return 'error';
    }
    this.writes++;
    this.data.set(k, v);
    return 'ok';
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

function progressedSave(): SaveData {
  const s = createEmptySave();
  s.flags = { gameStarted: true, crownAccepted: true, bouquetReceived: true, letterRead: true };
  s.completedQuests = { coronation: 1, bouquet: 2, castle: 3, letter: 4 };
  s.collected = { 'flower:flower_01': 5, 'berry:straw_1': 6, 'berry:straw_2': 7 };
  s.inventory = { crown: 1, bouquet: 1, strawberry: 2 };
  s.visited = { courtyard: 1, garden: 2 };
  s.player = { area: 'overworld', x: 30, z: 5, yaw: 1 };
  s.stats = { startedAt: 100, completedAt: null, playSeconds: 600 };
  return s;
}

const envelope = (state: unknown, version = SAVE_VERSION) => JSON.stringify({ state, version, savedAt: 123 });

beforeEach(() => {
  useSaveStatus.getState().set({ state: 'idle', lastSavedAt: null, error: null, recovery: null, repaired: 0 });
});

describe('save validation & schema', () => {
  it('accepts a complete save unchanged (no repairs)', () => {
    const s = progressedSave();
    const v = validateSaveData(s);
    expect(v.ok).toBe(true);
    expect(v.issues).toEqual([]);
    expect(v.data).toEqual({ ...s, version: SAVE_VERSION });
  });

  it('never discards a valid save because fields are missing — defaults fill the gaps', () => {
    const s: Partial<SaveData> = progressedSave();
    delete s.inventory;
    delete s.dialogue;
    delete s.appearance;
    delete s.stats;
    const v = validateSaveData(s);
    expect(v.ok).toBe(true);
    expect(v.data.flags.crownAccepted).toBe(true);
    expect(Object.keys(v.data.completedQuests)).toHaveLength(4);
    expect(v.data.inventory).toEqual({});
    expect(v.data.dialogue.talkCount).toBe(0);
    expect(v.data.appearance.gownColor).toMatch(/^#/);
  });

  it('repairs malformed values instead of failing', () => {
    const bad = {
      ...progressedSave(),
      flags: { crownAccepted: true, letterRead: 'yes', hack: 5 },
      completedQuests: { coronation: 1, notAQuest: 2 },
      inventory: { strawberry: -3, crown: 2.7, unknownItem: 1 },
      collected: { 'berry:straw_1': 1, '<script>': 1, 'flower:x': 'nope' },
      player: { area: 'moon', x: 1e9, z: 0 },
      appearance: { gownColor: 'red', hijabColor: '#ffffff' },
    };
    const v = validateSaveData(bad);
    expect(v.ok).toBe(true);
    expect(v.data.flags).toEqual({ crownAccepted: true });
    expect(v.data.completedQuests).toEqual({ coronation: 1 });
    expect(v.data.inventory).toEqual({ crown: 2 });
    expect(v.data.collected).toEqual({ 'berry:straw_1': 1 });
    expect(v.data.player).toBeNull();
    expect(v.data.appearance.hijabColor).toBe('#ffffff');
    expect(v.data.appearance.gownColor).not.toBe('red');
    expect(v.issues.length).toBeGreaterThan(5);
  });

  it('rejects data that is not a save at all', () => {
    expect(validateSaveData(null).ok).toBe(false);
    expect(validateSaveData('hello').ok).toBe(false);
    expect(validateSaveData([1, 2]).ok).toBe(false);
    expect(validateSaveData({ foo: 1 }).ok).toBe(false);
  });

  it('migrates a v1 save (original release format) to the current schema', () => {
    const v1 = { ...progressedSave(), version: 1 };
    const raw = JSON.stringify({ state: v1, version: 1 }); // exactly how v1 wrote it
    const r = parseStoredSave(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.save.version).toBe(1);
    expect(r.save.data.version).toBe(SAVE_VERSION);
    expect(r.save.data.flags.letterRead).toBe(true);
    expect(r.save.data.collected['berry:straw_2']).toBe(7);
  });

  it('refuses saves from a newer, unknown schema version', () => {
    const r = parseStoredSave(envelope(progressedSave(), SAVE_VERSION + 1));
    expect(r).toEqual({ ok: false, reason: 'future' });
  });

  it('detects corrupted JSON', () => {
    expect(parseStoredSave('{"state": {"flags":')).toEqual({ ok: false, reason: 'json' });
    expect(parseStoredSave('')).toEqual({ ok: false, reason: 'empty' });
  });
});

describe('loading, corruption & backups', () => {
  it('loads a valid save and keeps a session-start backup of it', () => {
    const b = new FakeBackend();
    b.data.set(PROGRESS_KEY, envelope(progressedSave()));
    const m = new SaveManager(b);
    const loaded = m.progressStorage.getItem(PROGRESS_KEY) as { state: SaveData };
    expect(loaded.state.flags.crownAccepted).toBe(true);
    expect(useSaveStatus.getState().lastSavedAt).toBe(123);
    const backup = m.readBackup();
    expect(backup?.info.reason).toBe('session-start');
    expect(backup?.info.summary.strawberries).toBe(2);
  });

  it('corrupted main save: quarantines it and restores the last valid backup', () => {
    const b = new FakeBackend();
    b.data.set(BACKUP_KEY, JSON.stringify({ savedAt: 50, reason: 'session-start', version: SAVE_VERSION, state: progressedSave() }));
    b.data.set(PROGRESS_KEY, '{"state":{"flags":{"crownAcc'); // truncated write
    const m = new SaveManager(b);
    const loaded = m.progressStorage.getItem(PROGRESS_KEY) as { state: SaveData };
    expect(loaded.state.completedQuests.letter).toBe(4);
    expect(b.data.get(CORRUPT_KEY)).toContain('crownAcc'); // evidence kept, never deleted
    expect(parseStoredSave(b.data.get(PROGRESS_KEY)!).ok).toBe(true); // main rewritten
    expect(useSaveStatus.getState().recovery?.from).toBe('backup');
  });

  it('corrupted main save without a backup: keeps the raw data and starts fresh without crashing', () => {
    const b = new FakeBackend();
    b.data.set(PROGRESS_KEY, 'not json at all');
    const m = new SaveManager(b);
    expect(m.progressStorage.getItem(PROGRESS_KEY)).toBeNull();
    expect(b.data.get(CORRUPT_KEY)).toBe('not json at all');
    expect(useSaveStatus.getState().recovery).toMatchObject({ from: 'none', reason: 'json' });
  });

  it('a save from a newer game version is preserved, not overwritten', () => {
    const b = new FakeBackend();
    const future = envelope({ ...progressedSave() }, SAVE_VERSION + 3);
    b.data.set(PROGRESS_KEY, future);
    const m = new SaveManager(b);
    m.progressStorage.getItem(PROGRESS_KEY);
    expect(b.data.get(CORRUPT_KEY)).toBe(future);
  });

  it('only backs up saves that contain progress', () => {
    const b = new FakeBackend();
    const m = new SaveManager(b);
    expect(m.backup(createEmptySave(), 'test')).toBe(false);
    expect(b.data.has(BACKUP_KEY)).toBe(false);
    expect(m.backup(progressedSave(), 'before-reset')).toBe(true);
    expect(m.readBackup()?.info.reason).toBe('before-reset');
  });
});

describe('autosave writes', () => {
  it('coalesces a burst of changes into one write and reports Saving… → Progress saved', () => {
    const b = new FakeBackend();
    const m = new SaveManager(b);
    m.progressStorage.getItem(PROGRESS_KEY); // empty start
    const s = progressedSave();
    m.progressStorage.setItem(PROGRESS_KEY, { state: { ...s, flags: { gameStarted: true } }, version: SAVE_VERSION });
    expect(useSaveStatus.getState().state).toBe('saving');
    m.progressStorage.setItem(PROGRESS_KEY, { state: s, version: SAVE_VERSION });
    expect(b.writes).toBe(0); // nothing written yet (debounced)
    expect(m.flush()).toBe('ok');
    expect(b.writes).toBe(1);
    expect(useSaveStatus.getState().state).toBe('saved');
    const stored = parseStoredSave(b.data.get(PROGRESS_KEY)!);
    expect(stored.ok && stored.save.data.flags.letterRead).toBe(true);
    expect(m.flush()).toBe('nothing');
  });

  it('walking around saves quietly (no "Saving…" flash for position-only changes)', () => {
    const b = new FakeBackend();
    const s = progressedSave();
    b.data.set(PROGRESS_KEY, envelope(s));
    const m = new SaveManager(b);
    m.progressStorage.getItem(PROGRESS_KEY);
    m.progressStorage.setItem(PROGRESS_KEY, { state: { ...s, player: { area: 'overworld', x: 31, z: 6, yaw: 0 } }, version: SAVE_VERSION });
    expect(useSaveStatus.getState().state).toBe('idle');
    m.flush();
    expect(b.writes).toBeGreaterThanOrEqual(1);
  });

  it('reports "Save failed" when storage is full, and retries once after freeing space', () => {
    const b = new FakeBackend();
    const m = new SaveManager(b);
    b.data.set(CORRUPT_KEY, 'x'.repeat(1000));
    m.progressStorage.setItem(PROGRESS_KEY, { state: progressedSave(), version: SAVE_VERSION });
    b.failNext = 1; // first attempt fails, retry succeeds
    expect(m.flush()).toBe('ok');
    expect(b.data.has(CORRUPT_KEY)).toBe(false);
    expect(useSaveStatus.getState().state).toBe('saved');

    m.progressStorage.setItem(PROGRESS_KEY, { state: { ...progressedSave(), flags: { crownAccepted: true, stormFound: true } }, version: SAVE_VERSION });
    b.failNext = 2; // both attempts fail
    expect(m.flush()).toBe('error');
    expect(useSaveStatus.getState().state).toBe('failed');
  });
});

describe('export & import', () => {
  const m = new SaveManager(new FakeBackend());

  it('round-trips progress and settings through an export file', () => {
    const s = progressedSave();
    const text = m.exportText(s, { ...DEFAULT_SETTINGS, musicVolume: 0.3 });
    const json = JSON.parse(text);
    expect(Object.keys(json).sort()).toEqual(['app', 'exportedAt', 'kind', 'progress', 'schemaVersion', 'settings']);
    expect(json.app).toBe(EXPORT_APP_ID);
    const r = m.parseImport(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data).toEqual({ ...s, version: SAVE_VERSION });
    expect(r.settings?.musicVolume).toBe(0.3);
    expect(r.summary).toMatchObject({ quests: 4, strawberries: 2, flowers: 1, crowned: true });
  });

  it('rejects invalid or incompatible files with a clear message', () => {
    const good = JSON.parse(m.exportText(progressedSave(), {}));
    const cases: Array<[string, string]> = [
      ['not json {', 'JSON'],
      [JSON.stringify({ hello: 'world' }), 'bukan fail simpanan'],
      [JSON.stringify({ ...good, app: 'another-game' }), 'bukan fail simpanan'],
      [JSON.stringify({ ...good, schemaVersion: SAVE_VERSION + 1 }), 'lebih baharu'],
      [JSON.stringify({ ...good, schemaVersion: 'x' }), 'tidak dikenali'],
      [JSON.stringify({ ...good, progress: 'garbage' }), 'rosak'],
      ['x'.repeat(600 * 1024), 'terlalu besar'],
    ];
    for (const [text, expected] of cases) {
      const r = m.parseImport(text);
      expect(r.ok, text.slice(0, 40)).toBe(false);
      if (!r.ok) expect(r.error).toContain(expected);
    }
  });

  it('accepts an older-schema export and migrates it', () => {
    const text = JSON.stringify({ app: EXPORT_APP_ID, kind: EXPORT_KIND, schemaVersion: 1, progress: { ...progressedSave(), version: 1 } });
    const r = m.parseImport(text);
    expect(r.ok && r.data.version).toBe(SAVE_VERSION);
  });
});

describe('progress store integration', () => {
  it('reset keeps a restorable backup of the progress it erases', () => {
    const st = useGameStore.getState();
    st.hydrateFrom(progressedSave());
    st.resetProgress();
    expect(getSave().flags.crownAccepted).toBeUndefined();
    const b = saveManager.readBackup();
    expect(b?.info.reason).toBe('before-reset');
    expect(b?.data.flags.crownAccepted).toBe(true);
  });

  it('hydrateFrom validates data before applying it', () => {
    useGameStore.getState().hydrateFrom({ ...progressedSave(), inventory: { strawberry: -1, crown: 1 } as SaveData['inventory'] });
    expect(getSave().inventory).toEqual({ crown: 1 });
  });
});

describe('settings safety', () => {
  it('drops wrong types and clamps ranges', () => {
    expect(sanitizeSettings({ masterVolume: 7, musicVolume: 'loud', muted: 'yes', graphics: 'ultra', textSpeed: 'fast', cameraSensitivity: 0 })).toEqual({
      masterVolume: 1,
      textSpeed: 'fast',
      cameraSensitivity: 0.3,
    });
    expect(sanitizeSettings(null)).toEqual({});
  });
});
