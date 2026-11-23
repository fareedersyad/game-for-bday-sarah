/** Lightweight feedback layers: toasts, companion barks, location banner, fades, letterbox. */
import { AnimatePresence, motion } from 'framer-motion';
import { FastForward } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useUI } from '../../stores/uiStore';
import { LOCATION_INFO } from '../../systems/WorldManager/locations';
import { skipCutscene } from '../../systems/Story/cutscene';
import { speakerName } from '../../systems/Story/cutscene';
import { Icon } from './icons';
import { personalContent } from '../../config/personalContent';

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--safe-top)+76px)] z-30 flex flex-col items-center gap-2 px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            className="royal-glass flex max-w-md items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-plum"
            role="status"
          >
            <Icon name={t.icon} className="shrink-0 text-gold-deep" size={16} />
            <span>{t.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/** Ambient lines from the companion (or narrator captions) that don't block play. */
export function Bark() {
  const bark = useUI((s) => s.bark);
  const dialogueOpen = useUI((s) => s.dialogue !== null);
  const show = bark && !dialogueOpen;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--safe-bottom)+150px)] z-20 flex justify-center px-6 sm:bottom-[calc(var(--safe-bottom)+120px)]">
      <AnimatePresence>
        {show &&
          (bark.speaker === 'narrator' ? (
            <motion.p
              key={bark.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="max-w-xl text-center font-serif text-2xl italic text-ivory drop-shadow-[0_2px_10px_rgba(60,20,50,0.85)] sm:text-3xl"
            >
              {bark.text}
            </motion.p>
          ) : (
            <motion.div
              key={bark.id}
              initial={{ opacity: 0, y: 10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              className="royal-glass max-w-lg rounded-2xl px-4 py-2.5 text-center"
            >
              <span className="mr-1.5 font-serif text-base font-bold text-rosy-deep">{speakerName(bark.speaker)}:</span>
              <span className="text-[15px] text-plum">{bark.text}</span>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  );
}

export function LocationBanner() {
  const banner = useUI((s) => s.locationBanner);
  const screen = useUI((s) => s.screen);
  const [visible, setVisible] = useState<typeof banner>(null);
  useEffect(() => {
    if (!banner || screen !== 'playing') return;
    setVisible(banner);
    const t = setTimeout(() => setVisible(null), 2600);
    return () => clearTimeout(t);
  }, [banner, screen]);
  const info = visible ? LOCATION_INFO[visible.location] : null;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(var(--safe-top)+18%)] z-10 flex justify-center">
      <AnimatePresence>
        {info && (
          <motion.div
            key={visible!.id}
            initial={{ opacity: 0, letterSpacing: '0.05em' }}
            animate={{ opacity: 1, letterSpacing: '0.18em' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1 }}
            className="text-center"
          >
            <div className="divider-gold mx-auto mb-2 w-48" />
            <p className="font-serif text-3xl font-semibold uppercase text-ivory drop-shadow-[0_2px_12px_rgba(60,20,50,0.9)] sm:text-4xl">
              {info.name}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.3em] text-gold-soft drop-shadow">{info.english}</p>
            <div className="divider-gold mx-auto mt-2 w-48" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Fade() {
  const fade = useUI((s) => s.fade);
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[60] bg-[#fdf0f3] transition-opacity duration-500"
      style={{ opacity: fade }}
      aria-hidden
    />
  );
}

export function Letterbox() {
  const letterbox = useUI((s) => s.letterbox);
  const cut = useUI((s) => s.cutscene);
  return (
    <>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[15] bg-black/70 transition-all duration-700"
        style={{ height: letterbox ? '7vh' : 0 }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[15] bg-black/70 transition-all duration-700"
        style={{ height: letterbox ? '7vh' : 0 }}
      />
      {cut?.active && cut.skippable && (
        <button
          className="soft-btn absolute right-[max(12px,var(--safe-right))] top-[calc(max(12px,var(--safe-top))+4px)] z-[55] text-sm"
          onClick={skipCutscene}
          aria-label={personalContent.ui.misc.skipScene}
        >
          <FastForward size={16} /> {personalContent.ui.misc.skip}
        </button>
      )}
    </>
  );
}
