import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Crown, Feather, Heart, Scale, Sparkles, Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { TEXT_SPEED_CPS, useSettings } from '../../stores/settingsStore';
import { useUI, type Speaker } from '../../stores/uiStore';
import { onAdvanceKey } from '../../systems/input';
import { speakerName } from '../../systems/Story/cutscene';
import { audio } from '../../systems/AudioManager/audioEngine';
import { personalContent } from '../../config/personalContent';
import { fmt } from '../../utils/text';

const D = personalContent.ui.dialogueBox;

const SPEAKER_STYLE: Record<Speaker, { color: string; icon: typeof Heart; ring: string }> = {
  him: { color: 'text-rosy-deep', icon: Heart, ring: 'from-rosy to-rosy-deep' },
  her: { color: 'text-gold-deep', icon: Crown, ring: 'from-gold-soft to-gold' },
  narrator: { color: 'text-plum/70', icon: Feather, ring: 'from-lavender-soft to-lavender' },
  momo: { color: 'text-lavender-deep', icon: Star, ring: 'from-lavender-soft to-lavender-deep' },
  bunny: { color: 'text-lavender-deep', icon: Star, ring: 'from-rosy-soft to-lavender' },
  mirror: { color: 'text-gold-deep', icon: Sparkles, ring: 'from-gold-soft to-lavender' },
  judge: { color: 'text-plum', icon: Scale, ring: 'from-champagne to-gold-deep' },
};

export function DialogueBox() {
  const d = useUI((s) => s.dialogue);
  const advance = useUI((s) => s.advanceDialogue);
  const choose = useUI((s) => s.chooseDialogue);
  const speed = useSettings((s) => s.textSpeed);
  const line = d ? d.lines[d.index] : null;
  const [shown, setShown] = useState(0);
  const typingRef = useRef(false);

  // Typewriter effect.
  useEffect(() => {
    if (!line) return;
    setShown(0);
    const cps = TEXT_SPEED_CPS[speed];
    if (cps >= 100000) {
      setShown(line.text.length);
      return;
    }
    typingRef.current = true;
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const n = Math.min(line.text.length, Math.floor(((performance.now() - start) / 1000) * cps));
      setShown(n);
      if (n < line.text.length) raf = requestAnimationFrame(tick);
      else typingRef.current = false;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [line, d?.key, d?.index, speed]);

  const done = !!line && shown >= line.text.length;
  const atEnd = !!d && d.index === d.lines.length - 1;
  const showChoices = !!d?.choices?.length && atEnd && done;

  const onAdvance = () => {
    if (!d || !line) return;
    if (!done) {
      setShown(line.text.length);
      typingRef.current = false;
      return;
    }
    if (showChoices) return;
    audio.sfx('soft');
    advance();
  };

  useEffect(() => {
    if (!d) return;
    const off = onAdvanceKey(onAdvance);
    return () => {
      off();
    };
  });

  // When the line is still typing, E / interact completes it instead of skipping.
  useEffect(() => {
    if (!d || !line) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyE' && !done) {
        e.stopImmediatePropagation();
        setShown(line.text.length);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [d, line, done]);

  const style = line ? SPEAKER_STYLE[line.speaker] : SPEAKER_STYLE.him;
  const SpeakerIcon = style.icon;
  const name = line ? speakerName(line.speaker) : '';

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[45] flex justify-center px-3 pb-[max(14px,var(--safe-bottom))] sm:px-6">
      <AnimatePresence>
        {d && line && (
          <motion.div
            key={d.key}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="pointer-events-auto w-full max-w-3xl"
          >
            {showChoices && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-2 flex flex-wrap justify-end gap-2">
                {d.choices!.map((c) => (
                  <button
                    key={c.id}
                    className="soft-btn bg-ivory/95 text-sm shadow-royal sm:text-[15px]"
                    onClick={() => {
                      audio.sfx('ui');
                      choose(c.id);
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </motion.div>
            )}
            <div
              className="royal-panel relative cursor-pointer select-none px-4 pb-4 pt-3 sm:px-6"
              onClick={onAdvance}
              role="dialog"
              aria-live="polite"
              aria-label={name ? fmt(D.speaking, { name }) : D.narration}
            >
              {name && (
                <div className="mb-1 flex items-center gap-2">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${style.ring} text-white shadow`}>
                    <SpeakerIcon size={15} className={line.speaker === 'him' ? 'fill-current' : ''} />
                  </span>
                  <span className={`font-serif text-xl font-bold ${style.color}`}>{name}</span>
                </div>
              )}
              <p
                className={`min-h-[3.2em] text-[16px] leading-relaxed text-plum sm:text-[17px] ${line.speaker === 'narrator' ? 'text-center font-serif text-xl italic' : ''}`}
              >
                {line.text.slice(0, shown)}
                <span className="invisible">{line.text.slice(shown)}</span>
              </p>
              {done && !showChoices && (
                <ChevronDown className="floaty absolute bottom-2 right-4 text-gold-deep" size={20} aria-label={D.next} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
