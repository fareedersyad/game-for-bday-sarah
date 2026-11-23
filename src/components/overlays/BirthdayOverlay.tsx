import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Wind, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { gameConfig } from '../../config/gameConfig';
import { useSettings } from '../../stores/settingsStore';
import { audio } from '../../systems/AudioManager/audioEngine';
import { fill, formatBirthday, paragraphs } from '../../utils/text';
import { personalContent } from '../../config/personalContent';

const O = personalContent.ui.overlays;

type Step = 'message' | 'wishing' | 'blow';

/**
 * Birthday wish & candles. Resolves with:
 *  - 'blown'  → she made a wish and blew out the candles
 *  - 'wished' → she made a wish but closed before blowing (she can come back to the cake)
 *  - undefined → closed before wishing
 * Big buttons, no hover-only states, works with touch, mouse and keyboard.
 */
export function BirthdayOverlay({ startAt, onClose }: { startAt: 'message' | 'blow'; onClose: (r?: 'wished' | 'blown') => void }) {
  const cfg = gameConfig.BIRTHDAY_CAKE;
  const reduced = useSettings((s) => s.reducedMotion);
  const [step, setStep] = useState<Step>(startAt);
  const [wishReady, setWishReady] = useState(false);
  const [wished, setWished] = useState(startAt === 'blow');

  useEffect(() => {
    if (step !== 'wishing') return;
    const t = window.setTimeout(() => setWishReady(true), reduced ? 300 : 2600);
    return () => window.clearTimeout(t);
  }, [step, reduced]);

  const close = () => onClose(wished ? 'wished' : undefined);

  return (
    <div className="safe-pad absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#1f2a22]/75 via-[#344E41]/60 to-[#1f2a22]/80 p-4">
      <button className="icon-btn absolute right-[max(12px,var(--safe-right))] top-[max(12px,var(--safe-top))]" onClick={close} aria-label={O.close}>
        <X size={20} />
      </button>
      <AnimatePresence mode="wait">
        {step === 'message' && (
          <motion.div
            key="message"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="royal-panel w-full max-w-lg p-6 text-center sm:p-8"
            role="dialog"
            aria-label={fill(cfg.messageTitle)}
          >
            <p className="text-4xl" aria-hidden>
              🎂
            </p>
            <h2 className="mt-2 font-serif text-3xl font-bold text-forest sm:text-4xl">{fill(cfg.messageTitle)}</h2>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.25em] text-gold-deep">{formatBirthday(gameConfig.BIRTHDAY_DATE)}</p>
            <div className="divider-gold mx-auto my-4 w-40" />
            {paragraphs(cfg.message).map((p, i) => (
              <p key={i} className="mb-2 font-serif text-xl leading-snug text-plum">
                {p}
              </p>
            ))}
            <button
              className="royal-btn mt-5 w-full py-3.5 text-lg sm:w-auto sm:px-8"
              onClick={() => {
                audio.sfx('chime');
                setStep('wishing');
              }}
            >
              <Sparkles size={18} /> {fill(cfg.wishButton)}
            </button>
          </motion.div>
        )}

        {step === 'wishing' && (
          <motion.div key="wishing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex max-w-md flex-col items-center text-center">
            <motion.div
              className="h-24 w-24 rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(255,226,160,0.95) 0%, rgba(255,226,160,0.25) 45%, transparent 70%)' }}
              animate={reduced ? undefined : { scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
              transition={{ repeat: Infinity, duration: 2.4 }}
              aria-hidden
            />
            <p className="mt-4 font-serif text-3xl italic leading-snug text-ivory drop-shadow">{fill(cfg.wishPrompt)}</p>
            <button
              className="royal-btn mt-8 py-3.5 text-lg"
              disabled={!wishReady}
              style={{ opacity: wishReady ? 1 : 0.55 }}
              onClick={() => {
                audio.sfx('heart');
                setWished(true);
                setStep('blow');
              }}
            >
              {fill(cfg.wishDoneButton)}
            </button>
          </motion.div>
        )}

        {step === 'blow' && (
          <motion.div key="blow" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex max-w-md flex-col items-center text-center">
            <div className="flex items-end gap-2" aria-hidden>
              {Array.from({ length: Math.max(1, Math.min(9, cfg.candles)) }, (_, i) => (
                <div key={i} className="flex flex-col items-center">
                  <motion.span
                    className="block h-4 w-2.5 rounded-full bg-gradient-to-t from-[#ff9d3d] to-[#ffe7a1] shadow-[0_0_14px_rgba(255,200,110,0.9)]"
                    animate={reduced ? undefined : { scaleY: [1, 1.2, 0.9, 1], opacity: [1, 0.9, 1] }}
                    transition={{ repeat: Infinity, duration: 0.6 + i * 0.07 }}
                  />
                  <span className="mt-0.5 block h-10 w-2 rounded-sm" style={{ background: i % 2 ? '#CCD5AE' : '#F3D6D8' }} />
                </div>
              ))}
            </div>
            <p className="mt-5 font-serif text-2xl italic text-ivory drop-shadow">{O.wishKept}</p>
            <button
              className="rose-btn pulse-ring mt-6 px-8 py-4 text-xl"
              onClick={() => {
                audio.sfx('blow');
                onClose('blown');
              }}
            >
              <Wind size={20} /> {fill(cfg.blowButton)}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
