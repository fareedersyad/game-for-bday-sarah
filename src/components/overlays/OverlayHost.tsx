import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Gift, Heart, Sparkles, Star, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { gameConfig } from '../../config/gameConfig';
import { ITEMS, QUEST_BY_ID } from '../../config/questConfig';
import { useGameStore } from '../../stores/gameStore';
import { useSettings } from '../../stores/settingsStore';
import { useUI, type Overlay } from '../../stores/uiStore';
import { audio } from '../../systems/AudioManager/audioEngine';
import { countCollected } from '../../systems/QuestManager/questManager';
import { fill, formatBirthday, paragraphs, fmt } from '../../utils/text';
import { Icon } from '../ui/icons';
import { PrincessPortrait } from '../ui/PrincessPortrait';
import { BirthdayOverlay } from './BirthdayOverlay';
import { BookOverlay } from './BookOverlay';
import { ClueCard, VerdictOverlay } from './CourtOverlay';
import { Handwriting, handwritingDuration } from './Handwriting';
import { LetterOverlay } from './LetterOverlay';
import { MirrorOverlay } from './MirrorOverlay';
import { personalContent } from '../../config/personalContent';

const O = personalContent.ui.overlays;

/** Renders the top-most overlay from the UI store. */
export function OverlayHost() {
  const overlays = useUI((s) => s.overlays);
  const close = useUI((s) => s.closeOverlay);
  const top = overlays[overlays.length - 1];
  return (
    <AnimatePresence>
      {top && (
        <motion.div key={top.key} className="absolute inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
          {render(top.overlay, close)}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function render(o: Overlay, close: (r?: unknown) => void) {
  switch (o.type) {
    case 'story':
      return <StoryOverlay lines={o.lines} tone={o.tone ?? 'gold'} onClose={() => close()} />;
    case 'royalCard':
      return <RoyalCard onClose={() => close()} />;
    case 'banner':
      return <Banner title={o.title} subtitle={o.subtitle} button={o.button} tone={o.tone ?? 'gold'} onClose={close} />;
    case 'letter':
      return <LetterOverlay which={o.which} onClose={() => close()} />;
    case 'book':
      return <BookOverlay bookId={o.bookId} onClose={() => close()} />;
    case 'mirror':
      return <MirrorOverlay onClose={() => close()} />;
    case 'court':
      return o.mode === 'clue' ? <ClueCard clueId={o.clueId} onClose={() => close()} /> : <VerdictOverlay onClose={(ok) => close(ok)} />;
    case 'note':
      return <NoteOverlay title={o.title} text={o.text} kind={o.kind} onClose={() => close()} />;
    case 'finalMessage':
      return <FinalMessage onClose={() => close()} />;
    case 'gift':
      return <GiftOverlay onClose={() => close()} />;
    case 'birthday':
      return <BirthdayOverlay startAt={o.startAt} onClose={(r) => close(r)} />;
    case 'questComplete':
      return <QuestComplete questId={o.questId} onClose={() => close()} />;
    case 'credits':
      return <Credits onClose={() => close()} />;
    case 'confirm':
      return <Confirm {...o} onClose={(v) => close(v)} />;
  }
}

const TONES = {
  gold: 'from-[#3a2135]/80 via-[#5a3553]/70 to-[#3a2135]/80',
  soft: 'from-[#f6d3dc]/85 via-[#fdf3e4]/80 to-[#e6dcf5]/85',
  night: 'from-[#0f0b25]/85 via-[#1d1640]/80 to-[#0f0b25]/85',
};

function StoryOverlay({ lines, tone, onClose }: { lines: string[]; tone: keyof typeof TONES; onClose: () => void }) {
  const reduced = useSettings((s) => s.reducedMotion);
  const [ready, setReady] = useState(false);
  const step = reduced ? 0.2 : 1.6;
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), (lines.length * step + 0.6) * 1000);
    return () => window.clearTimeout(t);
  }, [lines.length, step]);
  const light = tone === 'soft';
  return (
    <button
      className={`absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-5 bg-gradient-to-b ${TONES[tone]} px-6 text-center`}
      onClick={() => (ready ? onClose() : setReady(true))}
      aria-label={O.continue}
    >
      <span className={`text-2xl ${light ? 'text-gold-deep' : 'text-gold-soft'}`}>✦</span>
      {lines.map((l, i) => (
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: ready && i * step > 0.1 ? 0 : i * step, duration: reduced ? 0.2 : 1.2 }}
          className={`max-w-2xl font-serif text-[26px] italic leading-snug sm:text-4xl ${light ? 'text-plum' : 'text-ivory drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)]'}`}
        >
          {l}
        </motion.p>
      ))}
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: ready ? 1 : 0 }}
        className={`mt-6 text-xs font-bold uppercase tracking-[0.3em] ${light ? 'text-plum/60' : 'text-gold-soft/80'}`}
      >
        {O.tapToContinue}
      </motion.span>
    </button>
  );
}

function RoyalCard({ onClose }: { onClose: () => void }) {
  const appearance = useGameStore((s) => s.appearance);
  const t = gameConfig.ROYAL_TITLE;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-plum-deep/70 to-plum/70 p-4">
      <motion.div
        initial={{ scale: 0.6, rotateY: 90, opacity: 0 }}
        animate={{ scale: 1, rotateY: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
        className="relative w-full max-w-sm overflow-hidden rounded-[28px] p-7 text-center"
        style={{
          background: 'linear-gradient(160deg, #fffaf0 0%, #fbe3ea 55%, #f3dca4 120%)',
          boxShadow: '0 0 0 3px #e7c98f, 0 0 0 7px #fffaf0, 0 0 0 9px #a87c2a, 0 40px 80px -20px rgba(0,0,0,0.6)',
        }}
      >
        <div className="shimmer pointer-events-none absolute inset-0 opacity-60" />
        <Crown className="mx-auto text-gold-deep" size={30} />
        <div className="mx-auto mt-2 w-fit rounded-full bg-gradient-to-b from-rosy-soft to-lavender-soft p-2">
          <PrincessPortrait a={appearance} size={92} />
        </div>
        <p className="mt-3 text-[11px] font-black tracking-[0.4em] text-gold-deep">{t.line1}</p>
        <p className="gold-text font-serif text-[34px] font-bold leading-tight">
          {t.line2Prefix} {fill(gameConfig.HER_NAME).toUpperCase()}
        </p>
        <p className="mt-1 text-xs font-bold tracking-[0.22em] text-rosy-deep">{t.line3}</p>
        <div className="divider-gold mx-auto my-4 w-40" />
        <p className="text-xs text-plum/70">{O.crownedOn} {formatBirthday(gameConfig.BIRTHDAY_DATE)}</p>
        <button className="royal-btn mt-5" onClick={onClose}>
          <Sparkles size={16} /> {O.continuePrincess}
        </button>
      </motion.div>
    </div>
  );
}

function Banner({ title, subtitle, button, tone, onClose }: { title: string; subtitle?: string; button?: string; tone: 'gold' | 'rose' | 'night'; onClose: (r?: unknown) => void }) {
  const bg = tone === 'night' ? 'from-[#0f0b25]/80 to-[#2a1d55]/70' : tone === 'rose' ? 'from-[#b85c78]/55 to-[#5a3553]/70' : 'from-[#5a3553]/60 to-[#2e1a2c]/75';
  return (
    <div className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b ${bg} px-6 text-center`}>
      <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9 }} className="divider-gold mb-4 w-[min(80vw,420px)]" />
      <motion.h2
        initial={{ opacity: 0, letterSpacing: '0.02em' }}
        animate={{ opacity: 1, letterSpacing: '0.12em' }}
        transition={{ duration: 1.2 }}
        className="gold-text font-serif text-4xl font-bold sm:text-6xl"
      >
        {fill(title)}
      </motion.h2>
      {subtitle && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7, duration: 1 }} className="mt-3 max-w-xl font-serif text-xl italic text-ivory sm:text-2xl">
          {fill(subtitle)}
        </motion.p>
      )}
      <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.9 }} className="divider-gold mt-4 w-[min(80vw,420px)]" />
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }} className="mt-8 flex gap-3">
        {button ? (
          <>
            <button className="royal-btn text-lg" onClick={() => onClose('button')}>
              <Crown size={18} /> {button}
            </button>
            <button className="soft-btn" onClick={() => onClose('later')}>
              {O.notNow}
            </button>
          </>
        ) : (
          <button className="royal-btn" onClick={() => onClose()}>
            {O.continue}
          </button>
        )}
      </motion.div>
    </div>
  );
}

function NoteOverlay({ title, text, kind, onClose }: { title: string; text: string; kind: 'note' | 'memory' | 'bloom' | 'clue'; onClose: () => void }) {
  const reduced = useSettings((s) => s.reducedMotion);
  const icon = kind === 'memory' ? <Star size={18} className="fill-gold-soft text-gold-deep" /> : kind === 'bloom' ? <Sparkles size={18} className="text-rosy-deep" /> : kind === 'clue' ? <Sparkles size={18} className="text-lavender-deep" /> : <Heart size={18} className="fill-rosy text-rosy-deep" />;
  const label = kind === 'memory' ? O.noteMemory : kind === 'bloom' ? O.noteBloom : kind === 'clue' ? O.noteClue : O.noteSecret;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-plum-deep/50 p-4" onClick={onClose}>
      <motion.div
        initial={{ y: 40, rotate: -4, opacity: 0 }}
        animate={{ y: 0, rotate: kind === 'note' ? -1.5 : 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        className="paper w-full max-w-md rounded-md px-6 pb-5 pt-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-rosy-deep">
          {icon} {label}
        </p>
        <h3 className="mt-1 font-serif text-2xl font-bold text-plum">{title}</h3>
        <div className="divider-gold my-3" />
        {kind === 'clue' ? (
          <p className="font-serif text-xl leading-relaxed text-[#4a2a3a]">{text}</p>
        ) : (
          <Handwriting text={text} instant={reduced} className="font-script text-[25px] leading-snug text-[#4a2a3a]" />
        )}
        <div className="mt-5 flex justify-end">
          <button className="royal-btn" onClick={onClose}>
            {O.keepInHeart}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function FinalMessage({ onClose }: { onClose: () => void }) {
  const reduced = useSettings((s) => s.reducedMotion);
  const paras = useMemo(() => paragraphs(gameConfig.FINAL_MESSAGE.body), []);
  const [all, setAll] = useState(reduced);
  let delay = 0.6;
  const total = paras.reduce((acc, p) => acc + handwritingDuration(p) * 0.85, 0.6);
  const [canClose, setCanClose] = useState(reduced);
  useEffect(() => {
    if (all) {
      setCanClose(true);
      return;
    }
    const t = window.setTimeout(() => setCanClose(true), total * 1000);
    return () => window.clearTimeout(t);
  }, [all, total]);
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#0b0820]/40 via-[#140f30]/55 to-[#0b0820]/75 p-4" onClick={() => setAll(true)}>
      <div className="scroll-y max-h-full w-full max-w-2xl px-2 py-6 text-center">
        <Sparkles className="mx-auto mb-3 text-gold-soft" />
        <div className="flex flex-col gap-3">
          {paras.map((p, i) => {
            const d = delay;
            delay += handwritingDuration(p) * 0.85;
            return (
              <Handwriting
                key={i}
                text={p}
                delay={d}
                instant={all}
                className={`font-script leading-snug text-ivory drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] ${i === paras.length - 1 ? 'text-[40px] font-bold text-gold-soft' : 'text-[24px] sm:text-[28px]'}`}
              />
            );
          })}
        </div>
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: canClose ? 1 : 0, y: canClose ? 0 : 10 }}
          className="royal-btn mt-8 text-lg"
          disabled={!canClose}
          onClick={(e) => {
            e.stopPropagation();
            audio.sfx('magic');
            onClose();
          }}
        >
          <Gift size={18} /> {gameConfig.FINAL_MESSAGE.button}
        </motion.button>
      </div>
    </div>
  );
}

function GiftOverlay({ onClose }: { onClose: () => void }) {
  const [opened, setOpened] = useState(false);
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-plum-deep/60 p-4">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <button
          className="relative h-40 w-40"
          onClick={() => {
            audio.sfx('magic');
            setOpened(true);
          }}
          aria-label={O.openGift}
        >
          <motion.div
            className="absolute inset-x-2 bottom-0 h-28 rounded-xl"
            style={{ background: 'linear-gradient(180deg,#f3a9bb,#d77892)', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)' }}
          />
          <div className="absolute bottom-0 left-1/2 h-28 w-5 -translate-x-1/2 bg-gold-soft" />
          <motion.div
            className="absolute inset-x-0 top-6 h-10 rounded-lg"
            style={{ background: 'linear-gradient(180deg,#f7bccb,#e8899e)' }}
            animate={opened ? { y: -70, rotate: -18, opacity: 0.9 } : { y: [0, -4, 0] }}
            transition={opened ? { duration: 0.6 } : { repeat: Infinity, duration: 1.6 }}
          >
            <div className="absolute left-1/2 top-0 h-10 w-5 -translate-x-1/2 bg-gold-soft" />
            <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-4xl">🎀</div>
          </motion.div>
          {opened && <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1.6, opacity: [0, 1, 0] }} transition={{ duration: 1.2 }} className="absolute inset-0 rounded-full bg-gold-soft/70 blur-xl" />}
        </button>
        {!opened ? (
          <p className="mt-6 font-serif text-2xl italic text-ivory">{O.tapToOpenGift}</p>
        ) : (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="royal-panel mt-6 p-6">
            <h3 className="font-serif text-3xl font-bold text-plum">{fill(gameConfig.SECRET_GIFT.title)}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-plum/85">{fill(gameConfig.SECRET_GIFT.description)}</p>
            <button className="royal-btn mt-4" onClick={onClose}>
              <Heart size={16} className="fill-current" /> {O.thankYou}
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function QuestComplete({ questId, onClose }: { questId: keyof typeof QUEST_BY_ID; onClose: () => void }) {
  const q = QUEST_BY_ID[questId];
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-plum-deep/45 p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 16 }}
        className="royal-panel relative w-full max-w-sm overflow-hidden p-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shimmer pointer-events-none absolute inset-0 opacity-50" />
        <p className="text-[11px] font-black tracking-[0.4em] text-forest">{O.questComplete}</p>
        <div className="mx-auto my-3 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-b from-gold-soft to-gold shadow-glow">
          <Crown size={30} className="text-plum" />
        </div>
        <h3 className="font-serif text-3xl font-bold leading-tight text-plum">{q.name}</h3>
        <p className="mt-1 text-sm text-plum/70">{q.chapter}</p>
        {q.rewards.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {q.rewards.map((r) => (
              <div key={r} className="flex items-center gap-2.5 rounded-2xl border border-gold/40 bg-white/70 px-3 py-2 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sage-soft to-gold-soft">
                  <Icon name={ITEMS[r].icon} size={18} />
                </span>
                <span className="text-sm font-bold text-plum">{ITEMS[r].name}</span>
              </div>
            ))}
          </div>
        )}
        <button className="royal-btn mt-5" onClick={onClose}>
          {O.continue}
        </button>
      </motion.div>
    </div>
  );
}

function Credits({ onClose }: { onClose: () => void }) {
  const save = useGameStore();
  const c = gameConfig.CREDITS;
  const mins = Math.max(1, Math.round(save.stats.playSeconds / 60));
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#1a1033]/90 via-[#3a2150]/85 to-[#5a3553]/90 p-6 text-center">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.4 }} className="max-w-xl">
        <Crown className="mx-auto text-gold-soft" size={34} />
        <h2 className="gold-text mt-3 font-serif text-4xl font-bold sm:text-5xl">{fill(c.title)}</h2>
        <div className="divider-gold mx-auto my-5 w-60" />
        {c.lines.map((l, i) => (
          <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 + i * 1.2, duration: 1.2 }} className="font-serif text-2xl italic text-ivory">
            {fill(l)}
          </motion.p>
        ))}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4.6 }}>
          <p className="mt-6 font-script text-3xl text-rosy-soft">{fill(c.madeBy)}</p>
          <p className="mt-4 text-xs uppercase tracking-[0.25em] text-gold-soft/80">
            {fmt(O.creditsStats, { quests: Object.keys(save.completedQuests).length, flowers: countCollected(save, 'flower:'), stars: countCollected(save, 'star:'), minutes: mins })}
          </p>
          <button className="royal-btn mt-8" onClick={onClose}>
            <Heart size={16} className="fill-current" /> {O.keepExploring}
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}

function Confirm({ title, message, confirmLabel, danger, onClose }: { title: string; message: string; confirmLabel: string; danger?: boolean; onClose: (v: boolean) => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-plum-deep/55 p-4">
      <motion.div initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="royal-panel w-full max-w-sm p-6 text-center" role="alertdialog" aria-label={title}>
        {danger && <TriangleAlert className="mx-auto text-rosy-deep" size={30} />}
        <h3 className="mt-2 font-serif text-2xl font-bold text-plum">{title}</h3>
        <p className="mt-2 text-sm text-plum/80">{message}</p>
        <div className="mt-5 flex flex-col gap-2">
          <button className={danger ? 'rose-btn' : 'royal-btn'} onClick={() => onClose(true)}>
            {confirmLabel}
          </button>
          <button className="soft-btn" onClick={() => onClose(false)}>
            {O.cancel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
