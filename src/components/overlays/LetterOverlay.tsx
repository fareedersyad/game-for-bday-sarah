import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Music, Music2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { gameConfig, type LetterContent } from '../../config/gameConfig';
import { useSettings } from '../../stores/settingsStore';
import { audio } from '../../systems/AudioManager/audioEngine';
import { fill, paragraphs } from '../../utils/text';
import { Handwriting, handwritingDuration } from './Handwriting';
import { personalContent } from '../../config/personalContent';

const O = personalContent.ui.overlays;

const PARAS_PER_PAGE = 4;

/**
 * Love letter / final letter: sealed envelope → flap opens → paper rises and
 * unfolds → handwriting reveal, paginated with next/previous controls.
 */
export function LetterOverlay({ which, onClose }: { which: 'loveLetter' | 'finalLetter'; onClose: () => void }) {
  const letter: LetterContent = which === 'loveLetter' ? gameConfig.LOVE_LETTER : gameConfig.FINAL_SECRET_MESSAGE;
  const reduced = useSettings((s) => s.reducedMotion);
  const letterMusic = useSettings((s) => s.letterMusic);
  const update = useSettings((s) => s.update);
  const [stage, setStage] = useState<'sealed' | 'opening' | 'reading'>(reduced ? 'reading' : 'sealed');
  const [page, setPage] = useState(0);
  const [revealAll, setRevealAll] = useState(reduced);
  const paras = useMemo(() => paragraphs(letter.body), [letter.body]);
  const pages = useMemo(() => {
    const out: string[][] = [];
    for (let i = 0; i < paras.length; i += PARAS_PER_PAGE) out.push(paras.slice(i, i + PARAS_PER_PAGE));
    return out;
  }, [paras]);
  const last = page === pages.length - 1;

  const open = () => {
    audio.sfx('page');
    setStage('opening');
    window.setTimeout(() => {
      audio.sfx('page', 0.6);
      setStage('reading');
    }, 1500);
  };

  const turn = (d: number) => {
    audio.sfx('page', 0.7);
    setPage((p) => Math.max(0, Math.min(pages.length - 1, p + d)));
    setRevealAll(reduced);
  };

  let delay = 0.35;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-b from-plum-deep/70 via-plum/50 to-plum-deep/70 p-3 sm:p-6">
      <button className="icon-btn absolute right-[max(12px,var(--safe-right))] top-[max(12px,var(--safe-top))] z-10" onClick={onClose} aria-label={O.closeLetter}>
        <X size={20} />
      </button>
      <button
        className="icon-btn absolute left-[max(12px,var(--safe-left))] top-[max(12px,var(--safe-top))] z-10"
        onClick={() => update({ letterMusic: !letterMusic })}
        aria-label={letterMusic ? O.letterMusicOff : O.letterMusicOn}
        title={O.backgroundMusic}
      >
        {letterMusic ? <Music size={18} /> : <Music2 size={18} className="opacity-40" />}
      </button>

      <AnimatePresence mode="wait">
        {stage !== 'reading' ? (
          <motion.div
            key="envelope"
            className="relative"
            initial={{ scale: 0.8, opacity: 0, rotate: -4 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ y: 60, opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 160, damping: 18 }}
            style={{ perspective: 900 }}
          >
            <Envelope opening={stage === 'opening'} />
            {stage === 'sealed' && (
              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="royal-btn absolute -bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap" onClick={open}>
                {O.openEnvelope}
              </motion.button>
            )}
          </motion.div>
        ) : (
          <motion.article
            key="paper"
            className="paper relative flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-[6px]"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 120, scaleY: 0.2, rotateX: 50 }}
            animate={{ opacity: 1, y: 0, scaleY: 1, rotateX: 0 }}
            transition={{ duration: reduced ? 0.2 : 1.1, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: 'top center' }}
            onClick={() => setRevealAll(true)}
            aria-label={fill(letter.title)}
          >
            <div className="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-[rgba(150,110,60,0.12)]" />
            <div className="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-[rgba(150,110,60,0.12)]" />
            <div className="scroll-y flex-1 px-6 pb-4 pt-7 sm:px-10 sm:pt-9">
              {page === 0 && <p className="mb-4 text-center font-serif text-sm font-semibold uppercase tracking-[0.3em] text-rosy-deep/80">{fill(letter.title)}</p>}
              <div key={page} className="flex flex-col gap-3.5">
                {pages[page].map((p, i) => {
                  const d = delay;
                  delay += handwritingDuration(p) * 0.85;
                  return <Handwriting key={i} text={p} delay={d} instant={revealAll} className="font-script text-[23px] leading-[1.45] text-[#4a2a3a] sm:text-[26px]" />;
                })}
                {last && (
                  <div className="mt-3 text-right">
                    <Handwriting text={fill(letter.signOff)} delay={delay} instant={revealAll} className="font-script text-[24px] text-[#4a2a3a] sm:text-[27px]" />
                    <Handwriting text={fill(letter.signature)} delay={delay + 0.6} instant={revealAll} className="font-script text-[28px] font-bold text-rosy-deep sm:text-[32px]" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[rgba(150,110,60,0.18)] px-4 py-3">
              <button className="soft-btn !px-3" disabled={page === 0} onClick={(e) => (e.stopPropagation(), turn(-1))} aria-label={O.previousPage}>
                <ChevronLeft size={18} />
              </button>
              <span className="text-xs font-semibold text-plum/60">
                {page + 1} / {pages.length}
              </span>
              {last ? (
                <button className="royal-btn" onClick={(e) => (e.stopPropagation(), onClose())}>
                  {O.closeLetter}
                </button>
              ) : (
                <button className="royal-btn" onClick={(e) => (e.stopPropagation(), turn(1))} aria-label={O.nextPage}>
                  {O.next} <ChevronRight size={18} />
                </button>
              )}
            </div>
          </motion.article>
        )}
      </AnimatePresence>
    </div>
  );
}

function Envelope({ opening }: { opening: boolean }) {
  return (
    <div className="relative h-[200px] w-[300px] sm:h-[240px] sm:w-[360px]" style={{ transformStyle: 'preserve-3d' }}>
      {/* Letter peeking out */}
      <motion.div
        className="paper absolute inset-x-5 top-3 h-[80%] rounded-sm"
        animate={opening ? { y: -110 } : { y: 0 }}
        transition={{ delay: 0.55, duration: 0.9, ease: 'easeOut' }}
      />
      {/* Envelope body */}
      <div
        className="absolute inset-0 rounded-md"
        style={{
          background: 'linear-gradient(160deg, #f8dfe6 0%, #f1c4d0 100%)',
          boxShadow: '0 30px 60px -20px rgba(60,20,40,0.6), inset 0 0 0 1px rgba(212,168,79,0.5)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(135deg, transparent 49.5%, rgba(184,92,120,0.18) 50%, transparent 50.5%), linear-gradient(225deg, transparent 49.5%, rgba(184,92,120,0.18) 50%, transparent 50.5%)' }}
      />
      {/* Flap */}
      <motion.div
        className="absolute inset-x-0 top-0 h-1/2 origin-top"
        style={{
          clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
          background: 'linear-gradient(180deg, #f3cdd8, #e9afc0)',
          transformStyle: 'preserve-3d',
          zIndex: opening ? 0 : 5,
        }}
        animate={opening ? { rotateX: 180 } : { rotateX: 0 }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />
      {/* Wax seal */}
      <motion.div
        className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
        style={{
          background: 'radial-gradient(circle at 35% 30%, #e88aa2, #b8466a 60%, #8e2f50)',
          boxShadow: '0 4px 10px rgba(80,20,40,0.5), inset 0 -3px 6px rgba(0,0,0,0.25)',
        }}
        animate={opening ? { scale: 0, opacity: 0, rotate: 40 } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.35 }}
      >
        <span className="font-script text-3xl text-[#fde3ea]">♡</span>
      </motion.div>
    </div>
  );
}
