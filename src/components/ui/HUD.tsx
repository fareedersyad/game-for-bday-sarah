import { AnimatePresence, motion } from 'framer-motion';
import { Backpack, Check, Crown, Heart, LoaderCircle, Map as MapIcon, Menu, ScrollText, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useUI } from '../../stores/uiStore';
import { focusQuest, nextObjective, objectiveProgress, overallProgress, questStatus } from '../../systems/QuestManager/questManager';
import { QUEST_BY_ID } from '../../config/questConfig';
import { game } from '../../systems/GameLoop/game';
import { getStorageStatus, onStorageStatusChange } from '../../systems/SaveManager/safeStorage';
import { useSaveStatus } from '../../systems/SaveManager/saveManager';
import { isTouchDevice } from '../../utils/device';
import { fmt } from '../../utils/text';
import { audio } from '../../systems/AudioManager/audioEngine';
import { personalContent } from '../../config/personalContent';

const H = personalContent.ui.hud;

export function HUD() {
  const openPanel = useUI((s) => s.openPanel);
  const blocked = useUI((s) => !!s.cutscene?.active);
  const click = (p: Parameters<typeof openPanel>[0]) => () => {
    audio.sfx('open');
    openPanel(p);
  };
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 flex items-start justify-between gap-2"
        style={{ padding: 'max(10px, var(--safe-top)) max(10px, var(--safe-right)) 0 max(10px, var(--safe-left))' }}
      >
        <div className={`flex min-w-0 flex-col gap-2 transition-opacity ${blocked ? 'opacity-0' : 'opacity-100'}`}>
          <RoyalProfileChip onClick={click('profile')} />
          <ObjectiveTracker onClick={click('journal')} />
        </div>
        <div className={`pointer-events-auto flex shrink-0 gap-2 transition-opacity ${blocked ? 'pointer-events-none opacity-0' : ''}`}>
          <button className="icon-btn" onClick={click('journal')} aria-label={H.journal} title={H.journalTip}>
            <ScrollText size={20} />
          </button>
          <button className="icon-btn" onClick={click('map')} aria-label={H.map} title={H.mapTip}>
            <MapIcon size={20} />
          </button>
          <button className="icon-btn" onClick={click('inventory')} aria-label={H.inventory} title={H.inventoryTip}>
            <Backpack size={20} />
          </button>
          <button className="icon-btn" onClick={click('pause')} aria-label={H.pause} title={H.pauseTip}>
            <Menu size={20} />
          </button>
        </div>
      </div>
      <InteractionPrompt />
      <SaveIndicator />
      <StorageWarning />
    </div>
  );
}

function RoyalProfileChip({ onClick }: { onClick: () => void }) {
  const crowned = useGameStore((s) => !!s.flags.crownAccepted);
  const pct = useGameStore((s) => overallProgress(s));
  return (
    <button
      onClick={onClick}
      className="royal-glass pointer-events-auto flex max-w-[60vw] items-center gap-2 rounded-full py-1.5 pl-1.5 pr-4 text-left"
      aria-label={H.profile}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${crowned ? 'bg-gradient-to-b from-sage-soft to-sage text-forest' : 'bg-white/70 text-plum/40'}`}
      >
        <Crown size={18} />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-serif text-base font-bold leading-tight text-plum">
          {crowned ? fmt(H.princessName) : H.guest}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-sage-soft">
            <span className="block h-full rounded-full bg-gradient-to-r from-sage-deep to-gold" style={{ width: `${pct}%` }} />
          </span>
          <span className="text-[11px] font-semibold text-plum/70">{pct}%</span>
        </span>
      </span>
    </button>
  );
}

function ObjectiveTracker({ onClick }: { onClick: () => void }) {
  const save = useGameStore();
  const location = useUI((s) => s.location);
  // In the Strawberry Garden, spotlight the optional harvest quest while it is active.
  const q = location === 'strawberryGarden' && questStatus(save, 'strawberries') === 'active' ? QUEST_BY_ID.strawberries : focusQuest(save);
  if (!q) return null;
  const o = nextObjective(save, q);
  const prog = o ? objectiveProgress(save, o) : null;
  return (
    <button onClick={onClick} className="royal-glass pointer-events-auto max-w-[min(78vw,340px)] rounded-2xl px-3.5 py-2 text-left" aria-label={H.currentQuest}>
      <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-forest">{fmt(H.questChapter, { chapter: q.chapter })}</span>
      <span className="block font-serif text-[17px] font-bold leading-snug text-plum">{q.name}</span>
      {o && (
        <span className="mt-0.5 flex items-start gap-1.5 text-[13px] leading-snug text-plum/85">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rotate-45 bg-sage-deep" />
          <span>
            {o.text}
            {prog && prog.target > 1 && (
              <span className="ml-1 font-bold text-gold-deep">
                {prog.current}/{prog.target}
              </span>
            )}
          </span>
        </span>
      )}
    </button>
  );
}

export function InteractionPrompt() {
  const prompt = useUI((s) => s.prompt);
  const touch = isTouchDevice();
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[calc(var(--safe-bottom)+28px)] flex justify-center px-28 sm:bottom-[calc(var(--safe-bottom)+40px)]">
      <AnimatePresence>
        {prompt && (
          <motion.button
            key={prompt.id + prompt.label}
            initial={{ opacity: 0, y: 12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            className={`pointer-events-auto flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[15px] font-bold ${prompt.kind === 'talk' ? 'rose-btn' : 'royal-btn'}`}
            onClick={() => game.interact()}
            aria-label={prompt.label}
          >
            {!touch && (
              <kbd className="flex h-6 min-w-6 items-center justify-center rounded-md border border-current/40 bg-white/40 px-1.5 text-xs font-black">E</kbd>
            )}
            {prompt.kind === 'talk' && <Heart size={16} className="fill-current" />}
            <span className="max-w-[46vw] truncate sm:max-w-none">{prompt.label}</span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

function SaveIndicator() {
  const state = useSaveStatus((s) => s.state);
  const lastSavedAt = useSaveStatus((s) => s.lastSavedAt);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (state === 'saving' || state === 'failed') {
      setVisible(true);
      return;
    }
    if (state === 'saved') {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 1800);
      return () => clearTimeout(t);
    }
    setVisible(false);
  }, [state, lastSavedAt]);
  const label = state === 'saving' ? H.saving : state === 'failed' ? H.saveFailed : H.saved;
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={state}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`royal-glass pointer-events-none absolute right-[max(10px,var(--safe-right))] top-[calc(max(10px,var(--safe-top))+52px)] flex items-center gap-1.5 rounded-full p-1.5 text-xs font-semibold sm:px-3 sm:py-1 ${state === 'failed' ? 'text-strawberry' : 'text-forest/85'}`}
          role="status"
          aria-live="polite"
          data-save-state={state}
        >
          {state === 'saving' ? (
            <LoaderCircle size={14} className="animate-spin text-sage-deep motion-reduce:animate-none" />
          ) : state === 'failed' ? (
            <TriangleAlert size={14} />
          ) : (
            <Check size={14} className="text-sage-deep" />
          )}
          {/* Icon-only on narrow phones so it never covers the quest tracker. */}
          <span className="sr-only sm:not-sr-only">{label}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StorageWarning() {
  const [status, setStatus] = useState(getStorageStatus());
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const off = onStorageStatusChange(setStatus);
    return () => {
      off();
    };
  }, []);
  if (status === 'persistent' || dismissed) return null;
  return (
    <div className="pointer-events-auto absolute bottom-[calc(var(--safe-bottom)+80px)] left-1/2 w-[min(92vw,420px)] -translate-x-1/2">
      <div className="royal-glass flex items-start gap-2 rounded-2xl px-3 py-2 text-xs text-plum">
        <TriangleAlert size={16} className="mt-0.5 shrink-0 text-rosy-deep" />
        <span className="flex-1">
          {H.noPersistentStorage}
        </span>
        <button className="font-bold text-rosy-deep" onClick={() => setDismissed(true)}>
          {H.ok}
        </button>
      </div>
    </div>
  );
}
