/**
 * Unified input: keyboard (WASD / arrows / E / Shift / Esc), the on-screen
 * virtual joystick, and pointer-drag camera control (mouse or touch).
 * Everything is polled by the simulation each frame.
 */
type Listener = () => void;

export const input = {
  keys: new Set<string>(),
  /** Virtual joystick vector, x = right, y = forward, magnitude 0..1. */
  stick: { x: 0, y: 0, active: false },
  /** Accumulated camera drag in pixels since last read. */
  camDX: 0,
  camDY: 0,
  zoomDelta: 0,
  sprint: false,
};

const interactListeners = new Set<Listener>();
const pauseListeners = new Set<Listener>();
const advanceListeners = new Set<Listener>();

export function onInteract(fn: Listener) {
  interactListeners.add(fn);
  return () => interactListeners.delete(fn);
}
export function onPauseKey(fn: Listener) {
  pauseListeners.add(fn);
  return () => pauseListeners.delete(fn);
}
/** Space / Enter while dialogue is open. */
export function onAdvanceKey(fn: Listener) {
  advanceListeners.add(fn);
  return () => advanceListeners.delete(fn);
}

export function triggerInteract() {
  interactListeners.forEach((l) => l());
}

const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

function isTypingTarget(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

let installed = false;

export function installKeyboard() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target)) return;
    if (MOVE_KEYS.has(e.code)) {
      input.keys.add(e.code);
      e.preventDefault();
    }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = true;
    if (e.repeat) return;
    if (e.code === 'KeyE') interactListeners.forEach((l) => l());
    if (e.code === 'Escape') pauseListeners.forEach((l) => l());
    if (e.code === 'Space' || e.code === 'Enter') {
      if (advanceListeners.size) {
        advanceListeners.forEach((l) => l());
      }
    }
  });
  window.addEventListener('keyup', (e) => {
    input.keys.delete(e.code);
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') input.sprint = false;
  });
  // Releasing keys when the window loses focus prevents "stuck" movement.
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInput();
  });
}

export function clearInput() {
  input.keys.clear();
  input.stick.x = input.stick.y = 0;
  input.stick.active = false;
  input.sprint = false;
  input.camDX = input.camDY = 0;
}

/** Movement intent in camera space: x = strafe right, y = forward. */
export function readMoveIntent(): { x: number; y: number; magnitude: number } {
  let x = 0;
  let y = 0;
  const k = input.keys;
  if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
  if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
  if (input.stick.active) {
    x += input.stick.x;
    y += input.stick.y;
  }
  const m = Math.hypot(x, y);
  if (m > 1) {
    x /= m;
    y /= m;
  }
  return { x, y, magnitude: Math.min(1, m) };
}

export function consumeCameraDelta() {
  const d = { dx: input.camDX, dy: input.camDY, zoom: input.zoomDelta };
  input.camDX = 0;
  input.camDY = 0;
  input.zoomDelta = 0;
  return d;
}
