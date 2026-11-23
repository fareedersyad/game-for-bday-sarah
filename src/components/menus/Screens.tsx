import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Play, RotateCcw, Settings as SettingsIcon, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { gameConfig } from '../../config/gameConfig';
import { useGameStore } from '../../stores/gameStore';
import { useSettings } from '../../stores/settingsStore';
import { useUI } from '../../stores/uiStore';
import { audio } from '../../systems/AudioManager/audioEngine';
import { beginAdventure, resetProgress } from '../../systems/Story/story';
import { useSaveStatus } from '../../systems/SaveManager/saveManager';
import { fill } from '../../utils/text';
import { personalContent } from '../../config/personalContent';

const T = personalContent.ui.titleScreen;

export function LoadingScreen({ progress }: { progress: number }) {
  return (
    <div className="absolute inset-0 z-[70] flex flex-col items-center justify-center bg-gradient-to-b from-[#f6d3dc] via-[#fdf3e4] to-[#e6dcf5]">
      <Crown className="floaty text-gold-deep" size={44} />
      <p className="mt-4 font-serif text-3xl font-semibold text-plum">{T.gameTitle}</p>
      <p className="mt-1 text-sm italic text-plum/60">{T.loading}</p>
      <div className="mt-6 h-1.5 w-56 overflow-hidden rounded-full bg-white/70">
        <div className="h-full rounded-full bg-gradient-to-r from-rosy to-gold transition-all duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
    </div>
  );
}

export function TitleScreen() {
  const started = useGameStore((s) => !!s.flags.gameStarted);
  const lastSavedAt = useSaveStatus((s) => s.lastSavedAt);
  const recovery = useSaveStatus((s) => s.recovery);
  const openPanel = useUI((s) => s.openPanel);
  const setScreen = useUI((s) => s.setScreen);
  const openOverlay = useUI((s) => s.openOverlay);

  const begin = () => {
    audio.unlock();
    audio.sfx('magic');
    setScreen('opening');
  };
  const cont = () => {
    audio.unlock();
    beginAdventure();
  };
  const restart = async () => {
    audio.unlock();
    const ok = await openOverlay<boolean>({
      type: 'confirm',
      title: T.confirmNewGame.title,
      message:
        T.confirmNewGame.body,
      confirmLabel: T.confirmNewGame.confirm,
      danger: true,
    });
    if (ok) {
      resetProgress();
      setScreen('opening');
    }
  };

  return (
    <div className="safe-pad absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-plum-deep/40 via-transparent to-plum-deep/60 text-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.4 }} className="flex flex-col items-center">
        <Crown className="floaty text-gold-soft drop-shadow-[0_0_14px_rgba(243,220,164,0.9)]" size={40} />
        <h1 className="gold-text mt-3 font-serif text-[44px] font-bold leading-[0.95] drop-shadow-[0_4px_18px_rgba(60,20,50,0.55)] sm:text-7xl">
          {T.titleLine1}
          <br />
          {T.titleLine2}
        </h1>
        <p className="mt-3 font-serif text-xl italic text-ivory drop-shadow sm:text-2xl">{T.subtitle}</p>
        <div className="divider-gold my-4 w-64" />
        <p className="max-w-md font-serif text-lg italic leading-snug text-ivory/90 drop-shadow sm:text-xl">“{fill(gameConfig.OPENING.tagline)}”</p>
      </motion.div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 1 }} className="mt-9 flex w-full max-w-xs flex-col gap-2.5">
        {started ? (
          <>
            <button className="royal-btn text-lg" onClick={cont}>
              <Play size={18} /> {T.continue}
            </button>
            {lastSavedAt && (
              <p className="-mt-1 text-[11px] text-ivory/80 drop-shadow">
                {T.savedAt} {new Date(lastSavedAt).toLocaleString('ms-MY', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <button className="soft-btn" onClick={() => void restart()}>
              <RotateCcw size={16} /> {T.newGame}
            </button>
          </>
        ) : (
          <button className="royal-btn text-lg" onClick={begin}>
            <Sparkles size={18} /> {T.start}
          </button>
        )}
        <button className="soft-btn" onClick={() => openPanel('settings')}>
          <SettingsIcon size={16} /> {T.settings}
        </button>
      </motion.div>
      {recovery && (
        <p role="status" className="royal-glass mt-4 max-w-sm rounded-2xl px-3 py-2 text-xs text-plum">
          {recovery.from === 'backup'
            ? T.restoredFromBackup
            : T.unreadableSave}
        </p>
      )}
      <p className="absolute bottom-[max(10px,var(--safe-bottom))] text-[11px] text-ivory/70">{T.soundHint}</p>
    </div>
  );
}

/** Chapter 0 — The Royal Invitation. */
export function OpeningScreen() {
  const reduced = useSettings((s) => s.reducedMotion);
  const [step, setStep] = useState(0);
  useEffect(() => {
    const d = reduced ? 400 : 2600;
    const t1 = window.setTimeout(() => setStep(1), d * 0.4);
    const t2 = window.setTimeout(() => setStep(2), d * 1.4);
    const t3 = window.setTimeout(() => setStep(3), d * 2.3);
    return () => [t1, t2, t3].forEach(window.clearTimeout);
  }, [reduced]);
  const o = gameConfig.OPENING;
  return (
    <div className="safe-pad absolute inset-0 z-30 flex flex-col items-center justify-center bg-gradient-to-b from-plum-deep/55 via-plum/10 to-plum-deep/55 px-6 text-center" onClick={() => setStep((s) => Math.max(s, 3))}>
      <AnimatePresence>
        {step >= 1 && (
          <motion.p
            key="l1"
            initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 1.6 }}
            className="max-w-2xl font-serif text-3xl italic leading-snug text-ivory drop-shadow-[0_2px_14px_rgba(60,20,50,0.8)] sm:text-5xl"
          >
            {fill(o.line1)}
          </motion.p>
        )}
        {step >= 2 && (
          <motion.p
            key="l2"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.4 }}
            className="gold-text mt-6 font-script text-5xl font-bold drop-shadow sm:text-7xl"
          >
            {fill(o.line2)}
          </motion.p>
        )}
        {step >= 3 && (
          <motion.button
            key="btn"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9 }}
            className="royal-btn pulse-ring mt-10 px-8 py-3.5 text-xl"
            onClick={(e) => {
              e.stopPropagation();
              beginAdventure();
            }}
          >
            <Crown size={20} /> {fill(o.button)}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
