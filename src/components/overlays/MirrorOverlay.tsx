import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { gameConfig } from '../../config/gameConfig';
import { useGameStore } from '../../stores/gameStore';
import { useSettings } from '../../stores/settingsStore';
import { audio } from '../../systems/AudioManager/audioEngine';
import { fill } from '../../utils/text';
import { PrincessPortrait } from '../ui/PrincessPortrait';
import { personalContent } from '../../config/personalContent';

const O = personalContent.ui.overlays;

/** The magical mirror: asks the question, waits ~2 s, then reveals the answer with sparkles. */
export function MirrorOverlay({ onClose }: { onClose: () => void }) {
  const [phase, setPhase] = useState<'ask' | 'wait' | 'reveal'>('ask');
  const reduced = useSettings((s) => s.reducedMotion);
  const appearance = useGameStore((s) => s.appearance);

  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase('wait'), 1600);
    const t2 = window.setTimeout(() => {
      setPhase('reveal');
      audio.sfx('magic');
    }, 1600 + gameConfig.MIRROR.revealDelayMs);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-plum-deep/70 to-plum/60 p-4">
      <div className="flex w-full max-w-md flex-col items-center">
        <div
          className="relative flex aspect-[3/4] w-[min(70vw,300px)] items-center justify-center overflow-hidden"
          style={{
            borderRadius: '50% 50% 12px 12px / 38% 38% 12px 12px',
            background: 'radial-gradient(ellipse at 50% 35%, #fff 0%, #e6dcf5 45%, #b9a7d8 100%)',
            boxShadow: '0 0 0 10px #e7c98f, 0 0 0 14px #a87c2a, 0 0 60px rgba(243,220,164,0.9), inset 0 0 50px rgba(255,255,255,0.8)',
          }}
          aria-hidden
        >
          {!reduced && <div className="shimmer absolute inset-0 opacity-70" />}
          <AnimatePresence>
            {phase === 'reveal' && (
              <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.2 }}>
                <PrincessPortrait a={appearance} size={170} />
              </motion.div>
            )}
          </AnimatePresence>
          {phase === 'reveal' && !reduced && <Sparkles />}
        </div>

        <div className="mt-8 min-h-[130px] text-center">
          <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1 }} className="font-serif text-2xl italic text-ivory drop-shadow sm:text-3xl">
            “{fill(gameConfig.MIRROR.question)}”
          </motion.p>
          {phase === 'wait' && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.4 }} className="mt-4 text-2xl text-gold-soft">
              ✦ ✦ ✦
            </motion.p>
          )}
          {phase === 'reveal' && (
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2 }} className="gold-text mt-4 font-serif text-3xl font-bold sm:text-4xl">
              {fill(gameConfig.MIRROR.answer)}
            </motion.p>
          )}
        </div>
        {phase === 'reveal' && (
          <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} className="royal-btn mt-2" onClick={onClose}>
            {O.thankMirror}
          </motion.button>
        )}
      </div>
    </div>
  );
}

function Sparkles() {
  const dots = Array.from({ length: 18 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0">
      {dots.map((i) => (
        <motion.span
          key={i}
          className="absolute text-gold-soft"
          style={{ left: `${(i * 53) % 100}%`, top: `${(i * 37) % 100}%`, fontSize: 10 + (i % 4) * 5 }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: [0, 1, 0], scale: [0, 1.2, 0] }}
          transition={{ duration: 2, delay: (i % 6) * 0.3, repeat: Infinity }}
        >
          ✦
        </motion.span>
      ))}
    </div>
  );
}
