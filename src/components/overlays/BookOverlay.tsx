import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';
import { gameConfig } from '../../config/gameConfig';
import { useSettings } from '../../stores/settingsStore';
import { audio } from '../../systems/AudioManager/audioEngine';
import { fill, fmt } from '../../utils/text';
import { personalContent } from '../../config/personalContent';

const O = personalContent.ui.overlays;

/** A magical book: the cover swings open, then pages turn with a flip. */
export function BookOverlay({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const book = gameConfig.CUSTOM_BOOK_MESSAGES.find((b) => b.id === bookId) ?? gameConfig.CUSTOM_BOOK_MESSAGES[0];
  const reduced = useSettings((s) => s.reducedMotion);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const last = page === book.pages.length - 1;

  const turn = (d: number) => {
    audio.sfx('page');
    setDir(d);
    setPage((p) => Math.max(0, Math.min(book.pages.length - 1, p + d)));
  };

  const close = () => {
    audio.sfx('close');
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-plum-deep/60 p-3 sm:p-6">
      <button className="icon-btn absolute right-[max(12px,var(--safe-right))] top-[max(12px,var(--safe-top))]" onClick={close} aria-label={O.closeBook}>
        <X size={20} />
      </button>
      <div style={{ perspective: 1400 }} className="w-full max-w-lg">
        <AnimatePresence mode="wait">
          {!open ? (
            <motion.button
              key="cover"
              onClick={() => {
                audio.sfx('page');
                setOpen(true);
              }}
              className="relative mx-auto block aspect-[3/4] w-[min(78vw,330px)] origin-left rounded-r-xl rounded-l-sm text-left"
              style={{
                background: `linear-gradient(135deg, ${book.cover}, ${book.cover}cc 60%, ${book.cover}99)`,
                boxShadow: '0 30px 60px -18px rgba(40,10,30,0.7), inset 6px 0 0 rgba(0,0,0,0.15), inset 0 0 0 2px rgba(243,220,164,0.6)',
              }}
              initial={{ rotateY: 0, scale: 0.85, opacity: 0 }}
              animate={{ rotateY: 0, scale: 1, opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { rotateY: -110, opacity: 0, transition: { duration: 0.7 } }}
              aria-label={fmt(O.openBook, { title: book.title })}
            >
              <div className="absolute inset-4 rounded-lg border-2 border-gold-soft/70" />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
                <span className="text-4xl text-gold-soft">✦</span>
                <h3 className="mt-3 font-serif text-3xl font-bold leading-tight text-ivory drop-shadow">{fill(book.title)}</h3>
                <div className="divider-gold my-3 w-24" />
                <p className="font-serif text-lg italic text-ivory/90">{fill(book.subtitle)}</p>
                <p className="mt-8 animate-pulse text-xs font-bold uppercase tracking-[0.3em] text-gold-soft">{O.tapToOpen}</p>
              </div>
            </motion.button>
          ) : (
            <motion.div
              key="pages"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="paper relative flex min-h-[min(70vh,520px)] flex-col rounded-lg"
              style={{ boxShadow: `0 30px 60px -18px rgba(40,10,30,0.7), inset 10px 0 18px -10px ${book.cover}88` }}
            >
              <p className="pt-5 text-center font-serif text-sm font-bold uppercase tracking-[0.25em] text-rosy-deep/80">{fill(book.title)}</p>
              <div className="relative flex-1 overflow-hidden px-6 py-5 sm:px-10">
                <AnimatePresence mode="wait" custom={dir}>
                  <motion.div
                    key={page}
                    custom={dir}
                    initial={reduced ? { opacity: 0 } : { rotateY: dir * 70, opacity: 0, x: dir * 30 }}
                    animate={{ rotateY: 0, opacity: 1, x: 0 }}
                    exit={reduced ? { opacity: 0 } : { rotateY: -dir * 70, opacity: 0, x: -dir * 30 }}
                    transition={{ duration: 0.45 }}
                    className="origin-left whitespace-pre-line font-serif text-[21px] leading-relaxed text-[#4a2a3a] sm:text-[23px]"
                  >
                    {fill(book.pages[page])}
                  </motion.div>
                </AnimatePresence>
              </div>
              <div className="flex items-center justify-between border-t border-[rgba(150,110,60,0.18)] px-4 py-3">
                <button className="soft-btn !px-3" disabled={page === 0} onClick={() => turn(-1)} aria-label={O.previousPage}>
                  <ChevronLeft size={18} />
                </button>
                <span className="font-serif text-sm italic text-plum/60">
                  ~ {page + 1} / {book.pages.length} ~
                </span>
                {last ? (
                  <button className="royal-btn" onClick={close}>
                    {O.closeBook}
                  </button>
                ) : (
                  <button className="royal-btn" onClick={() => turn(1)} aria-label={O.nextPage}>
                    {O.turnPage} <ChevronRight size={18} />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
