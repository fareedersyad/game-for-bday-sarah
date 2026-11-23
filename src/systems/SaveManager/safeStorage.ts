/**
 * localStorage wrapper that never throws.
 *
 * Safari private mode, disabled cookies, sandboxed iframes and quota errors
 * can all make localStorage throw. In those cases we transparently fall back
 * to in-memory storage so the game stays playable, and expose the status so
 * the UI can tell her progress won't survive a reload.
 */
export type StorageStatus = 'persistent' | 'memory';
/** Result of a write: persisted ('ok'), memory-only fallback ('memory'), or failed ('error'). */
export type WriteResult = 'ok' | 'memory' | 'error';

const memory = new Map<string, string>();
let status: StorageStatus = 'memory';
let native: Storage | null = null;

try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const probe = '__awmjfh_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    native = window.localStorage;
    status = 'persistent';
  }
} catch {
  native = null;
  status = 'memory';
}

const listeners = new Set<(s: StorageStatus) => void>();

function degrade() {
  if (status === 'memory') return;
  status = 'memory';
  listeners.forEach((l) => l(status));
}

export const safeStorage = {
  getItem(key: string): string | null {
    if (native) {
      try {
        return native.getItem(key);
      } catch {
        degrade();
      }
    }
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string): WriteResult {
    memory.set(key, value);
    if (!native) return 'memory';
    try {
      native.setItem(key, value);
      return 'ok';
    } catch {
      // Quota exceeded or storage revoked mid-session. The value stays in
      // memory; the caller decides whether to retry. We only switch to
      // memory mode permanently if storage is gone entirely.
      try {
        native.setItem('__awmjfh_probe__', '1');
        native.removeItem('__awmjfh_probe__');
      } catch {
        degrade();
      }
      return 'error';
    }
  },
  removeItem(key: string): void {
    memory.delete(key);
    if (native) {
      try {
        native.removeItem(key);
      } catch {
        degrade();
      }
    }
  },
};

export function getStorageStatus(): StorageStatus {
  return status;
}

export function onStorageStatusChange(fn: (s: StorageStatus) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
