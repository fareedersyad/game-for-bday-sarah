import { MotionConfig } from 'framer-motion';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useGameStore } from '../stores/gameStore';
import { saveManager, useSaveStatus } from '../systems/SaveManager/saveManager';
import { useSettings } from '../stores/settingsStore';
import { useUI } from '../stores/uiStore';
import { useWorld } from '../stores/worldStore';
import { audio } from '../systems/AudioManager/audioEngine';
import { game } from '../systems/GameLoop/game';
import { installKeyboard, onInteract, onPauseKey } from '../systems/input';
import { runtime } from '../systems/runtime';
import { activeCutscene, skipCutscene } from '../systems/Story/cutscene';
import { initStory, storyDebug } from '../systems/Story/story';
import { detectWebGL, isTouchDevice } from '../utils/device';
import { DialogueBox } from './dialogue/DialogueBox';
import { PanelHost } from './menus/Panels';
import { LoadingScreen, OpeningScreen, TitleScreen } from './menus/Screens';
import { OverlayHost } from './overlays/OverlayHost';
import { Bark, Fade, Letterbox, LocationBanner, Toasts } from './ui/Feedback';
import { HUD } from './ui/HUD';
import { MobileControls } from './ui/MobileControls';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { World2D } from './fallback/World2D';
import { personalContent } from '../config/personalContent';

const GameCanvas = lazy(() => import('./game/GameCanvas'));

let booted = false;
function boot() {
  if (booted) return;
  booted = true;
  initStory();
  game.init();
  installKeyboard();
  onInteract(() => game.interact());
  onPauseKey(() => {
    const ui = useUI.getState();
    if (ui.panel) return ui.closePanel();
    if (activeCutscene() && ui.cutscene?.skippable && !ui.dialogue && ui.overlays.length === 0) return skipCutscene();
    if (ui.screen === 'playing' && !ui.dialogue && ui.overlays.length === 0) ui.openPanel('pause');
  });
  window.addEventListener('keydown', (e) => {
    const ui = useUI.getState();
    if (ui.screen !== 'playing' || ui.overlays.length || ui.dialogue || ui.cutscene || (e.target as HTMLElement)?.tagName === 'INPUT') return;
    const map: Record<string, Parameters<typeof ui.openPanel>[0]> = { KeyJ: 'journal', KeyM: 'map', KeyI: 'inventory' };
    const p = map[e.code];
    if (p) ui.openPanel(ui.panel === p ? null : p);
  });
  // Any first gesture unlocks audio (browser autoplay policies).
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  // QA hook (used by the automated end-to-end test; harmless for players).
  (window as unknown as Record<string, unknown>).__awmjfh = { game, runtime, ui: useUI, store: useGameStore, settings: useSettings, world: useWorld, story: storyDebug, save: saveManager, saveStatus: useSaveStatus };
}

export function GameRoot() {
  const screen = useUI((s) => s.screen);
  const panelOpen = useUI((s) => s.panel !== null);
  const renderMode = useSettings((s) => s.renderMode);
  const reducedMotion = useSettings((s) => s.reducedMotion);
  const [progress, setProgress] = useState(0.15);
  const [webglFailed, setWebglFailed] = useState(false);
  const touch = isTouchDevice();

  useEffect(() => {
    boot();
    const start = performance.now();
    const fontsReady = (document as Document & { fonts?: FontFaceSet }).fonts?.ready ?? Promise.resolve();
    void fontsReady.then(() => setProgress((p) => Math.max(p, 0.5)));
    // Fallback in case the world never reports ready (e.g. 2D mode).
    const t = window.setTimeout(() => finishBoot(start), 6000);
    return () => window.clearTimeout(t);
  }, []);

  const finishBoot = useCallback((start = 0) => {
    const wait = Math.max(0, 900 - (performance.now() - start));
    setProgress(1);
    window.setTimeout(() => {
      if (useUI.getState().screen === 'boot') useUI.getState().setScreen('title');
    }, wait);
  }, []);

  const gl = detectWebGL();
  const use2D = webglFailed || renderMode === '2d' || (renderMode === 'auto' && !gl.supported);

  useEffect(() => {
    if (use2D) finishBoot(performance.now() - 400);
  }, [use2D, finishBoot]);

  const playing = screen === 'playing';

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
      <div className={`relative h-full w-full overflow-hidden ${reducedMotion ? 'reduced-motion' : ''}`}>
        {use2D ? (
          <World2D />
        ) : (
          <ErrorBoundary
            fallback={() => {
              // A rendering failure in WebGL (driver bug, context loss) → storybook mode.
              window.setTimeout(() => setWebglFailed(true), 0);
              return null;
            }}
          >
            <Suspense fallback={null}>
              <GameCanvas
                onReady={() => finishBoot()}
                onProgress={(p) => setProgress((x) => Math.max(x, p))}
                onContextLost={() => {
                  useUI.getState().toast(personalContent.ui.misc.graphicsFallback, 'sparkles');
                  setWebglFailed(true);
                }}
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {playing && <HUD />}
        {playing && (touch || use2D) && !panelOpen && <MobileControls />}
        <Letterbox />
        <LocationBanner />
        <Bark />
        <Toasts />
        <DialogueBox />
        {screen === 'title' && <TitleScreen />}
        {screen === 'opening' && <OpeningScreen />}
        <PanelHost />
        <OverlayHost />
        <Fade />
        {screen === 'boot' && <LoadingScreen progress={progress} />}
      </div>
    </MotionConfig>
  );
}
