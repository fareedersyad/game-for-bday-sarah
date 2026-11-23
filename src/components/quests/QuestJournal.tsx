import { Check, Circle, Lock, MapPin, ScrollText, Gift } from 'lucide-react';
import { useState } from 'react';
import { ITEMS, QUESTS, type QuestDef } from '../../config/questConfig';
import { useGameStore } from '../../stores/gameStore';
import type { SaveData } from '../../stores/progressTypes';
import { useUI } from '../../stores/uiStore';
import { focusQuest, objectiveProgress, overallProgress, questStatus } from '../../systems/QuestManager/questManager';
import { LOCATION_INFO } from '../../systems/WorldManager/locations';
import { Modal } from '../ui/Modal';
import { personalContent } from '../../config/personalContent';

const J = personalContent.ui.journal;

type Tab = 'active' | 'completed' | 'all';

export function QuestJournal() {
  const close = useUI((s) => s.closePanel);
  const save = useGameStore();
  const [tab, setTab] = useState<Tab>('active');
  const focus = focusQuest(save);
  const pct = overallProgress(save);
  const list = QUESTS.filter((q) => {
    const st = questStatus(save, q.id);
    if (tab === 'active') return st === 'active';
    if (tab === 'completed') return st === 'completed';
    return true;
  });

  return (
    <Modal title={J.title} subtitle={J.subtitle} icon={<ScrollText size={18} />} onClose={close}>
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs font-semibold text-plum/70">
          <span>{J.progress}</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-sage-soft">
          <div className="h-full rounded-full bg-gradient-to-r from-sage-deep via-sage to-gold transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="mb-4 flex gap-2" role="tablist">
        {(['active', 'completed', 'all'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`rounded-full px-3.5 py-1.5 text-sm font-bold transition ${tab === t ? 'bg-gradient-to-b from-gold-soft to-gold text-plum shadow' : 'bg-white/60 text-plum/70'}`}
            onClick={() => setTab(t)}
          >
            {t === 'active' ? J.tabActive : t === 'completed' ? J.tabCompleted : J.tabAll}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {list.length === 0 && <p className="py-6 text-center text-sm text-plum/60">{J.empty}</p>}
        {list.map((q) => (
          <QuestCard key={q.id} q={q} save={save} focused={focus?.id === q.id} />
        ))}
      </div>
    </Modal>
  );
}

function QuestCard({ q, save, focused }: { q: QuestDef; save: SaveData; focused: boolean }) {
  const status = questStatus(save, q.id);
  const loc = LOCATION_INFO[q.location];
  return (
    <article
      className={`rounded-2xl border p-4 transition ${
        status === 'completed'
          ? 'border-gold/40 bg-gold-soft/25'
          : status === 'locked'
            ? 'border-plum/10 bg-white/40 opacity-70'
            : focused
              ? 'border-sage-deep bg-white/85 shadow-royal'
              : 'border-gold/30 bg-white/70'
      }`}
      aria-label={q.name}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            status === 'completed' ? 'bg-gold text-white' : status === 'locked' ? 'bg-plum/10 text-plum/50' : 'bg-sage-deep text-white'
          }`}
        >
          {status === 'completed' ? <Check size={16} /> : status === 'locked' ? <Lock size={14} /> : <Circle size={10} className="fill-current" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 text-[11px] font-bold uppercase tracking-wider text-forest">
            <span>{q.chapter}</span>
            <span className="text-plum/30">•</span>
            <span className="flex items-center gap-1 text-plum/60">
              <MapPin size={11} /> {loc.name}
            </span>
            <span className="text-plum/30">•</span>
            <span className="text-plum/50">#{q.id}</span>
          </div>
          <h3 className="font-serif text-xl font-bold leading-tight text-plum">{status === 'locked' ? '???' : q.name}</h3>
          <p className="mt-0.5 text-sm text-plum/75">{status === 'locked' ? J.locked : q.description}</p>
          {status !== 'locked' && (
            <ul className="mt-2.5 flex flex-col gap-1.5">
              {q.objectives.map((o) => {
                const p = objectiveProgress(save, o);
                return (
                  <li key={o.id} className="flex items-start gap-2 text-sm">
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${p.done ? 'border-gold bg-gold text-white' : 'border-plum/30 bg-white'}`}
                    >
                      {p.done && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className={p.done ? 'text-plum/50 line-through' : 'text-plum'}>
                      {o.text}
                      {o.target > 1 && (
                        <span className="ml-1 font-bold text-gold-deep">
                          {p.current}/{p.target}
                        </span>
                      )}
                      {o.optional && <span className="ml-1 text-xs italic text-plum/50">(pilihan)</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {status !== 'locked' && q.rewards.length > 0 && (
            <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-plum/70">
              <Gift size={13} className="text-gold-deep" />
              <span className="font-semibold">{J.rewards}</span>
              {q.rewards.map((r) => ITEMS[r].name).join(', ')}
            </p>
          )}
          {status === 'active' && focused && <p className="mt-2 rounded-xl bg-sage-soft/60 px-3 py-1.5 text-xs italic text-plum/80">💬 {q.hint}</p>}
        </div>
      </div>
    </article>
  );
}
