/**
 * CUTSCENE RUNNER
 *
 * Story beats are plain async functions that receive a `Cut` helper. Every
 * helper becomes a no-op once the scene is skipped, so skipping simply
 * fast-forwards through the script: all state changes in the body still run,
 * and the world always ends in the correct state. No dead ends.
 */
import { SPEAKER_NAMES, type ScriptLine } from '../../config/dialogueConfig';
import { useSettings } from '../../stores/settingsStore';
import { useUI, type DialogueLine, type Overlay } from '../../stores/uiStore';
import { fill } from '../../utils/text';
import { runtime } from '../runtime';

export class Cut {
  cancelled = false;
  private cancelResolvers = new Set<() => void>();

  constructor(readonly id: string) {}

  cancel() {
    if (this.cancelled) return;
    this.cancelled = true;
    this.cancelResolvers.forEach((r) => r());
    this.cancelResolvers.clear();
  }

  private race<T>(p: Promise<T>): Promise<T | undefined> {
    if (this.cancelled) return Promise.resolve(undefined);
    return new Promise((resolve) => {
      const r = () => resolve(undefined);
      this.cancelResolvers.add(r);
      p.then((v) => {
        this.cancelResolvers.delete(r);
        resolve(v);
      });
    });
  }

  async say(lines: readonly ScriptLine[] | DialogueLine[]) {
    if (this.cancelled || lines.length === 0) return;
    await this.race(useUI.getState().showDialogue(toDialogue(lines)));
  }

  async overlay<T = unknown>(o: Overlay): Promise<T | undefined> {
    if (this.cancelled) return undefined;
    return this.race(useUI.getState().openOverlay<T>(o));
  }

  async story(lines: string[], tone: 'gold' | 'soft' | 'night' = 'gold') {
    return this.overlay({ type: 'story', lines: lines.map(fill), tone });
  }

  async wait(ms: number) {
    if (this.cancelled) return;
    await this.race(new Promise<void>((r) => setTimeout(r, ms)));
  }

  /** Point the camera. Reduced motion turns every blend into a cut. */
  shot(pos: [number, number, number], look: [number, number, number], blendSeconds = 1.6) {
    const cam = runtime.camera;
    cam.mode = 'cinematic';
    cam.pos = pos;
    cam.look = look;
    cam.blend = useSettings.getState().reducedMotion || this.cancelled ? 0 : blendSeconds;
  }

  /** Animate fn(t) for t in [0, 1]. Jumps to the end when skipped. */
  async tween(seconds: number, fn: (t: number) => void) {
    if (this.cancelled || seconds <= 0) {
      fn(1);
      return;
    }
    const start = performance.now();
    await this.race(
      new Promise<void>((resolve) => {
        const tick = () => {
          if (this.cancelled) return resolve();
          const t = Math.min(1, (performance.now() - start) / (seconds * 1000));
          fn(t);
          if (t >= 1) resolve();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    );
    fn(1);
  }

  /** Wait until a condition holds (polled per frame), with a timeout. */
  async until(cond: () => boolean, timeoutMs = 6000) {
    if (this.cancelled) return;
    const start = performance.now();
    await this.race(
      new Promise<void>((resolve) => {
        const tick = () => {
          if (this.cancelled || cond() || performance.now() - start > timeoutMs) return resolve();
          requestAnimationFrame(tick);
        };
        tick();
      }),
    );
  }
}

export function toDialogue(lines: readonly ScriptLine[] | DialogueLine[]): DialogueLine[] {
  return (lines as ReadonlyArray<ScriptLine | DialogueLine>).map((l) =>
    Array.isArray(l) ? { speaker: (l as ScriptLine)[0], text: fill((l as ScriptLine)[1]) } : { ...(l as DialogueLine), text: fill((l as DialogueLine).text) },
  );
}

export function speakerName(s: keyof typeof SPEAKER_NAMES) {
  return fill(SPEAKER_NAMES[s]);
}

let current: Cut | null = null;
const afterHooks: Array<() => void> = [];

export function activeCutscene() {
  return current;
}

/** Run a callback once no cutscene is playing. */
export function whenIdle(fn: () => void) {
  if (!current) fn();
  else afterHooks.push(fn);
}

let queue: Promise<void> = Promise.resolve();

/**
 * Run a cutscene. Scenes never overlap: a scene requested while another is
 * playing is queued. (Never call runCutscene from inside a cutscene body.)
 */
export function runCutscene(id: string, opts: { skippable?: boolean; letterbox?: boolean }, body: (c: Cut) => Promise<void>): Promise<void> {
  const run = queue.then(() => execute(id, opts, body));
  queue = run.catch(() => undefined);
  return run;
}

async function execute(id: string, opts: { skippable?: boolean; letterbox?: boolean }, body: (c: Cut) => Promise<void>) {
  const cut = new Cut(id);
  current = cut;
  const ui = useUI.getState();
  ui.setCutscene({ active: true, skippable: opts.skippable ?? true, id });
  ui.setLetterbox(opts.letterbox ?? true);
  ui.setPrompt(null);
  try {
    await body(cut);
  } catch (e) {
    console.error(`[cutscene:${id}]`, e);
  } finally {
    runtime.camera.mode = 'follow';
    runtime.camera.blend = 1.2;
    current = null;
    useUI.getState().setCutscene(null);
    useUI.getState().setLetterbox(false);
    const hooks = afterHooks.splice(0);
    hooks.forEach((h) => h());
  }
}

/** Skip the current cutscene (Skip button / Esc). */
export function skipCutscene() {
  const c = current;
  if (!c || !useUI.getState().cutscene?.skippable) return;
  c.cancel();
  const ui = useUI.getState();
  ui.endDialogue();
  ui.closeAllOverlays();
}
