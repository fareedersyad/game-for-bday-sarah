import { Backpack, BookOpen, Flower2, Star, StickyNote } from 'lucide-react';
import { useState } from 'react';
import { gameConfig } from '../../config/gameConfig';
import { ITEMS } from '../../config/questConfig';
import { useGameStore } from '../../stores/gameStore';
import type { ItemId } from '../../stores/progressTypes';
import { useUI } from '../../stores/uiStore';
import { countCollected } from '../../systems/QuestManager/questManager';
import { FLOWER_SPOTS, MEMORY_STARS } from '../../systems/WorldManager/worldLayout';
import { Icon } from '../ui/icons';
import { Modal } from '../ui/Modal';
import { personalContent } from '../../config/personalContent';
import { fmt } from '../../utils/text';

const I = personalContent.ui.inventory;

const FLOWER_LABEL: Record<string, string> = I.flowerNames;
const FLOWER_COLOR: Record<string, string> = {
  pinkRose: '#f19bb4',
  whiteRose: '#fbf5f0',
  tulip: '#f6c1d2',
  sunflower: '#f5c542',
  hydrangea: '#a9b8ee',
  cherryBlossom: '#f9d2e0',
};

export function InventoryPanel() {
  const close = useUI((s) => s.closePanel);
  const openOverlay = useUI((s) => s.openOverlay);
  const save = useGameStore();
  const [tab, setTab] = useState<'items' | 'flowers' | 'keepsakes'>('items');
  const items = (Object.keys(save.inventory) as ItemId[]).filter((k) => (save.inventory[k] ?? 0) > 0);

  const flowerCounts: Record<string, number> = {};
  for (const f of FLOWER_SPOTS) if (save.collected[`flower:${f.id}`] !== undefined) flowerCounts[f.type] = (flowerCounts[f.type] ?? 0) + 1;
  const totalFlowers = countCollected(save, 'flower:');

  const readItem = (id: ItemId) => {
    const r = ITEMS[id].readable;
    if (r) void openOverlay({ type: 'letter', which: r });
  };

  return (
    <Modal title={I.title} subtitle={I.subtitle} icon={<Backpack size={18} />} onClose={close}>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {[
          ['items', I.tabItems],
          ['flowers', fmt(I.tabFlowers, { count: totalFlowers })],
          ['keepsakes', I.tabKeepsakes],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id as typeof tab)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${tab === id ? 'bg-gradient-to-b from-gold-soft to-gold text-plum shadow' : 'bg-white/60 text-plum/70'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'items' && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {items.length === 0 && <p className="col-span-full py-6 text-center text-sm text-plum/60">{I.empty}</p>}
          {items.map((id) => {
            const def = ITEMS[id];
            const qty = save.inventory[id] ?? 0;
            return (
              <div key={id} className="flex items-start gap-3 rounded-2xl border border-gold/30 bg-white/75 p-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sage-soft to-gold-soft text-forest">
                  <Icon name={def.icon} size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg font-bold leading-tight text-plum">
                    {def.name} {qty > 1 && <span className="text-sm text-gold-deep">×{qty}</span>}
                  </p>
                  <p className="text-xs leading-snug text-plum/70">{def.description}</p>
                  {def.readable && (
                    <button className="soft-btn mt-2 !px-3 !py-1 text-xs" onClick={() => readItem(id)}>
                      <BookOpen size={13} /> {I.reread}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'flowers' && (
        <div>
          <p className="mb-3 text-sm text-plum/75">
            {I.flowersPicked} <b className="text-gold-deep">{totalFlowers}</b> / {FLOWER_SPOTS.length} {fmt(I.flowersNeeded, { count: gameConfig.GARDEN.flowersRequired })}
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {Object.keys(FLOWER_LABEL).map((type) => {
              const total = FLOWER_SPOTS.filter((f) => f.type === type).length;
              const got = flowerCounts[type] ?? 0;
              return (
                <div key={type} className={`rounded-2xl border p-3 text-center ${got ? 'border-gold/40 bg-white/80' : 'border-plum/10 bg-white/40'}`}>
                  <div className="mx-auto mb-1.5 flex h-10 w-10 items-center justify-center rounded-full" style={{ background: got ? FLOWER_COLOR[type] : '#eee' }}>
                    <Flower2 size={20} className={got ? 'text-plum/70' : 'text-plum/20'} />
                  </div>
                  <p className="text-sm font-bold text-plum">{FLOWER_LABEL[type]}</p>
                  <p className="text-xs text-plum/60">
                    {got}/{total}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-plum/75">{fmt(I.blooms, { count: countCollected(save, 'bloom:'), total: 3 })}</p>
        </div>
      )}

      {tab === 'keepsakes' && <Keepsakes />}
    </Modal>
  );
}

function Keepsakes() {
  const save = useGameStore();
  const openOverlay = useUI((s) => s.openOverlay);
  const notes = gameConfig.GARDEN.hiddenNotes.filter((n) => save.collected[`note:${n.id}`] !== undefined);
  const stars = MEMORY_STARS.filter((s) => save.collected[`star:${s.id}`] !== undefined);
  const books = gameConfig.CUSTOM_BOOK_MESSAGES.filter((b) => save.collected[`book:${b.id}`] !== undefined);
  return (
    <div className="flex flex-col gap-4">
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 font-serif text-lg font-bold text-plum">
          <Star size={16} className="text-gold-deep" /> {fmt(I.memoryStars, { count: stars.length, total: MEMORY_STARS.length })}
        </h3>
        <div className="flex flex-wrap gap-2">
          {stars.length === 0 && <p className="text-sm text-plum/60">{I.memoryStarsEmpty}</p>}
          {stars.map((s) => {
            const m = gameConfig.SHARED_MEMORIES.find((x) => x.id === s.memory)!;
            return (
              <button key={s.id} className="soft-btn !py-1.5 text-sm" onClick={() => void openOverlay({ type: 'note', title: m.title, text: m.text, kind: 'memory' })}>
                {m.title}
              </button>
            );
          })}
        </div>
      </section>
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 font-serif text-lg font-bold text-plum">
          <StickyNote size={16} className="text-gold-deep" /> {fmt(I.notes, { count: notes.length, total: gameConfig.GARDEN.hiddenNotes.length })}
        </h3>
        <div className="flex flex-wrap gap-2">
          {notes.length === 0 && <p className="text-sm text-plum/60">{I.notesEmpty}</p>}
          {notes.map((n) => (
            <button key={n.id} className="soft-btn !py-1.5 text-sm" onClick={() => void openOverlay({ type: 'note', title: n.title, text: n.text, kind: 'note' })}>
              {n.title}
            </button>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 font-serif text-lg font-bold text-plum">
          <BookOpen size={16} className="text-gold-deep" /> {fmt(I.books, { count: books.length, total: 4 })}
        </h3>
        <div className="flex flex-wrap gap-2">
          {books.length === 0 && <p className="text-sm text-plum/60">{I.booksEmpty}</p>}
          {books.map((b) => (
            <button key={b.id} className="soft-btn !py-1.5 text-sm" onClick={() => void openOverlay({ type: 'book', bookId: b.id })}>
              {b.title}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
