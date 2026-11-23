import { AnimatePresence, motion } from 'framer-motion';
import { Check, Gavel, Scale, X } from 'lucide-react';
import { useState } from 'react';
import { dialogueConfig } from '../../config/dialogueConfig';
import { getSave } from '../../stores/gameStore';
import { audio } from '../../systems/AudioManager/audioEngine';
import { personalContent } from '../../config/personalContent';
import { fmt } from '../../utils/text';

const O = personalContent.ui.overlays;

type ClueId = keyof typeof dialogueConfig.courtroom.clues;

/** Evidence card for a single clue. */
export function ClueCard({ clueId, onClose }: { clueId: string; onClose: () => void }) {
  const clue = dialogueConfig.courtroom.clues[clueId as ClueId];
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-plum-deep/55 p-4">
      <motion.div initial={{ rotate: -3, y: 30, opacity: 0 }} animate={{ rotate: 0, y: 0, opacity: 1 }} className="paper w-full max-w-md rounded-md p-6">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-rosy-deep">
          <Scale size={14} /> {dialogueConfig.courtroom.caseTitle}
        </div>
        <h3 className="font-serif text-2xl font-bold text-plum">{clue.title}</h3>
        <div className="divider-gold my-3" />
        <p className="font-serif text-xl leading-relaxed text-[#4a2a3a]">{clue.text}</p>
        <div className="mt-5 flex justify-end">
          <button className="royal-btn" onClick={onClose}>
            <Check size={16} /> {O.noteEvidence}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/**
 * The verdict mini-game: review the case file, then answer two questions.
 * Wrong answers give gentle feedback and allow another try — no fail state.
 * Resolves true when a fair decision has been reached.
 */
export function VerdictOverlay({ onClose }: { onClose: (solved: boolean) => void }) {
  const c = dialogueConfig.courtroom;
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [feedback, setFeedback] = useState<{ text: string; ok: boolean } | null>(null);
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const q = step === 0 ? c.q1 : c.q2;
  const save = getSave();

  const answer = (id: string, correct: boolean, text: string) => {
    setFeedback({ text, ok: correct });
    if (correct) {
      audio.sfx('chime');
      window.setTimeout(() => {
        setFeedback(null);
        setWrong(new Set());
        setStep((s) => (s === 0 ? 1 : 2));
      }, 2400);
    } else {
      audio.sfx('soft');
      setWrong((w) => new Set(w).add(id));
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-plum-deep/55 p-3 sm:p-6">
      <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="royal-panel relative flex max-h-full w-full max-w-2xl flex-col overflow-hidden">
        <button className="icon-btn absolute right-3 top-3" onClick={() => onClose(false)} aria-label={O.close}>
          <X size={18} />
        </button>
        <div className="px-5 pb-2 pt-5 sm:px-7">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-rosy-deep">
            <Gavel size={14} /> {O.courtroom}
          </p>
          <h2 className="font-serif text-3xl font-bold text-plum">{c.caseTitle}</h2>
        </div>
        <div className="scroll-y flex-1 px-5 pb-5 sm:px-7">
          <p className="rounded-2xl bg-white/60 p-3 text-sm leading-relaxed text-plum/85">{c.caseIntro}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {(Object.keys(c.clues) as ClueId[]).map((k) => (
              <div key={k} className="rounded-xl border border-gold/30 bg-white/70 p-2.5 text-xs leading-snug text-plum/80">
                <p className="mb-0.5 font-bold text-plum">
                  {save.collected[`court:${k}`] !== undefined ? '✓ ' : ''}
                  {c.clues[k].title}
                </p>
                {c.clues[k].text}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step < 2 ? (
              <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="mt-5">
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-gold-deep">{fmt(O.question, { count: step + 1, total: 2 })}</p>
                <h3 className="mb-3 font-serif text-2xl font-bold text-plum">{q.question}</h3>
                <div className="flex flex-col gap-2">
                  {q.options.map((o) => (
                    <button
                      key={o.id}
                      disabled={wrong.has(o.id) || feedback?.ok}
                      onClick={() => answer(o.id, o.correct, o.feedback)}
                      className={`rounded-2xl border px-4 py-3 text-left text-[15px] font-semibold transition ${
                        wrong.has(o.id) ? 'border-plum/10 bg-plum/5 text-plum/40 line-through' : 'border-gold/40 bg-white/80 text-plum hover:border-rosy active:scale-[0.99]'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <AnimatePresence>
                  {feedback && (
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className={`mt-3 rounded-2xl px-4 py-2.5 text-sm ${feedback.ok ? 'bg-gold-soft/60 text-plum' : 'bg-rosy-soft/70 text-plum'}`}
                      role="status"
                    >
                      {feedback.ok ? '⚖️ ' : '💭 '}
                      {feedback.text}
                    </motion.p>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-6 text-center">
                <Scale size={42} className="mx-auto text-gold-deep" />
                <h3 className="mt-2 font-serif text-3xl font-bold text-plum">{O.fairVerdict}</h3>
                <p className="mt-1 text-sm text-plum/75">{O.fairVerdictText}</p>
                <button className="royal-btn mt-4" onClick={() => onClose(true)}>
                  <Gavel size={16} /> {O.announceVerdict}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
