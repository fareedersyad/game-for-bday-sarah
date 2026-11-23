import { AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  Crown,
  Home,
  Map as MapIcon,
  Pause,
  Play,
  Settings as SettingsIcon,
  Shirt,
  Backpack,
  Volume2,
  VolumeX,
  Keyboard,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { gameConfig } from '../../config/gameConfig';
import { DEFAULT_APPEARANCE, useGameStore } from '../../stores/gameStore';
import type { Appearance } from '../../stores/progressTypes';
import { useSettings, type GraphicsQuality, type RenderMode, type TextSpeed } from '../../stores/settingsStore';
import { useUI } from '../../stores/uiStore';
import { audio } from '../../systems/AudioManager/audioEngine';
import { countCollected, overallProgress } from '../../systems/QuestManager/questManager';
import { SaveManagement } from './SaveManagement';
import { detectWebGL } from '../../utils/device';
import { fill, formatBirthday, fmt } from '../../utils/text';
import { ChatPanel } from '../dialogue/ChatPanel';
import { InventoryPanel } from '../inventory/InventoryPanel';
import { WorldMap } from '../navigation/WorldMap';
import { QuestJournal } from '../quests/QuestJournal';
import { Modal } from '../ui/Modal';
import { PrincessPortrait } from '../ui/PrincessPortrait';
import { personalContent } from '../../config/personalContent';

const PM = personalContent.ui.pauseMenu;
const ST = personalContent.ui.settings;
const W = personalContent.ui.wardrobe;
const PR = personalContent.ui.profile;

export function PanelHost() {
  const panel = useUI((s) => s.panel);
  return (
    <AnimatePresence>
      {panel === 'pause' && <PauseMenu key="pause" />}
      {panel === 'journal' && <QuestJournal key="journal" />}
      {panel === 'map' && <WorldMap key="map" />}
      {panel === 'inventory' && <InventoryPanel key="inv" />}
      {panel === 'settings' && <SettingsPanel key="settings" />}
      {panel === 'wardrobe' && <WardrobePanel key="wardrobe" />}
      {panel === 'profile' && <ProfilePanel key="profile" />}
      {panel === 'chat' && <ChatPanel key="chat" />}
    </AnimatePresence>
  );
}

// --------------------------------------------------------------------- Pause
function PauseMenu() {
  const { closePanel, openPanel, setScreen } = useUI.getState();
  const go = (p: Parameters<typeof openPanel>[0]) => () => {
    audio.sfx('ui');
    openPanel(p);
  };
  return (
    <Modal title={PM.title} subtitle={PM.subtitle} icon={<Pause size={18} />} onClose={closePanel} width="max-w-sm">
      <div className="flex flex-col gap-2.5">
        <button className="royal-btn w-full" onClick={closePanel}>
          <Play size={18} /> {PM.resume}
        </button>
        <MenuButton icon={<BookOpen size={18} />} label={PM.journal} onClick={go('journal')} />
        <MenuButton icon={<MapIcon size={18} />} label={PM.map} onClick={go('map')} />
        <MenuButton icon={<Backpack size={18} />} label={PM.inventory} onClick={go('inventory')} />
        <MenuButton icon={<Crown size={18} />} label={PM.profile} onClick={go('profile')} />
        <MenuButton icon={<SettingsIcon size={18} />} label={PM.settings} onClick={go('settings')} />
        <MenuButton
          icon={<Home size={18} />}
          label={PM.mainMenu}
          onClick={() => {
            closePanel();
            setScreen('title');
          }}
        />
      </div>
    </Modal>
  );
}

function MenuButton({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button className="soft-btn w-full justify-start !py-2.5" onClick={onClick}>
      <span className="text-gold-deep">{icon}</span> {label}
    </button>
  );
}

// --------------------------------------------------------------------- Settings
export function SettingsPanel() {
  const s = useSettings();
  const close = useUI((st) => st.closePanel);
  const gl = detectWebGL();

  return (
    <Modal title={ST.title} subtitle={ST.subtitle} icon={<SettingsIcon size={18} />} onClose={close} width="max-w-xl">
      <Section title={ST.audio}>
        <Slider label={ST.masterVolume} value={s.masterVolume} onChange={(v) => s.update({ masterVolume: v })} onRelease={() => audio.sfx('chime')} />
        <Slider label={ST.music} value={s.musicVolume} onChange={(v) => s.update({ musicVolume: v })} />
        <Slider label={ST.sfx} value={s.sfxVolume} onChange={(v) => s.update({ sfxVolume: v })} onRelease={() => audio.sfx('chime')} />
        <Toggle label={ST.muteAll} icon={s.muted ? <VolumeX size={16} /> : <Volume2 size={16} />} value={s.muted} onChange={(v) => s.update({ muted: v })} />
        <Toggle label={ST.thunder} value={s.thunderEnabled} onChange={(v) => s.update({ thunderEnabled: v })} />
        {s.thunderEnabled && <Slider label={ST.thunderVolume} value={s.thunderVolume} onChange={(v) => s.update({ thunderVolume: v })} onRelease={() => audio.sfx('thunder', 0.4)} />}
        <Toggle label={ST.letterMusic} value={s.letterMusic} onChange={(v) => s.update({ letterMusic: v })} />
      </Section>
      <Section title={ST.display}>
        <Toggle label={ST.reducedMotion} value={s.reducedMotion} onChange={(v) => s.update({ reducedMotion: v })} />
        <Select<GraphicsQuality>
          label={ST.graphicsQuality}
          value={s.graphics}
          onChange={(v) => s.update({ graphics: v })}
          options={[
            ['auto', ST.qualityAuto],
            ['low', ST.qualityLow],
            ['medium', ST.qualityMedium],
            ['high', ST.qualityHigh],
          ]}
        />
        <Select<RenderMode>
          label={ST.renderMode}
          value={s.renderMode}
          onChange={(v) => s.update({ renderMode: v })}
          options={[
            ['auto', ST.modeAuto],
            ['3d', ST.mode3d],
            ['2d', ST.mode2d],
          ]}
        />
        {!gl.supported && <p className="text-xs text-rosy-deep">{ST.noWebGL}</p>}
        <Select<TextSpeed>
          label={ST.textSpeed}
          value={s.textSpeed}
          onChange={(v) => s.update({ textSpeed: v })}
          options={[
            ['slow', ST.speedSlow],
            ['normal', ST.speedNormal],
            ['fast', ST.speedFast],
            ['instant', ST.speedInstant],
          ]}
        />
      </Section>
      <Section title={ST.controls}>
        <Slider label={ST.cameraSensitivity} min={0.3} max={2} value={s.cameraSensitivity} onChange={(v) => s.update({ cameraSensitivity: v })} />
        <Toggle label={ST.invertY} value={s.invertCameraY} onChange={(v) => s.update({ invertCameraY: v })} />
        <div className="mt-1 rounded-2xl bg-white/60 p-3 text-xs leading-relaxed text-plum/80">
          <p className="mb-1 flex items-center gap-1.5 font-bold text-plum">
            <Keyboard size={14} /> {ST.computer}
          </p>
          <p>{ST.computerHelp}</p>
          <p className="mb-1 mt-2 font-bold text-plum">{ST.touch}</p>
          <p>{ST.touchHelp}</p>
        </div>
      </Section>
      <Section title={ST.saves}>
        <SaveManagement />
      </Section>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h3 className="mb-2 font-serif text-lg font-bold text-plum">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Slider({ label, value, onChange, onRelease, min = 0, max = 1 }: { label: string; value: number; onChange: (v: number) => void; onRelease?: () => void; min?: number; max?: number }) {
  return (
    <label className="flex items-center gap-3 text-sm text-plum">
      <span className="w-36 shrink-0 sm:w-44">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onPointerUp={onRelease}
        onKeyUp={onRelease}
        className="h-2 flex-1 cursor-pointer accent-[#d4a84f]"
        aria-label={label}
      />
      <span className="w-10 text-right text-xs font-bold text-plum/60">{Math.round(((value - min) / (max - min)) * 100)}%</span>
    </label>
  );
}

function Toggle({ label, value, onChange, icon }: { label: string; value: boolean; onChange: (v: boolean) => void; icon?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-plum">
      <span className="flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => {
          audio.sfx('ui');
          onChange(!value);
        }}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${value ? 'bg-gradient-to-r from-rosy to-gold' : 'bg-plum/20'}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </label>
  );
}

function Select<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: Array<[T, string]> }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm text-plum">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded-full border border-gold/50 bg-white/80 px-3 py-1.5 text-sm font-semibold text-plum outline-none"
        aria-label={label}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

// --------------------------------------------------------------------- Wardrobe
const PALETTES: Record<keyof Appearance, string[]> = {
  gownColor: ['#A3B18A', '#CCD5AE', '#f2b8c6', '#e8899e', '#d8a7b1', '#c3b1e1', '#fbf3e4', '#f3dca4', '#a9c8e8', '#b9dcc2'],
  gownAccent: ['#e7c98f', '#d4a84f', '#fffaf0', '#b85c78', '#8f78b8'],
  hijabColor: ['#F8F6EF', '#CCD5AE', '#fbe9ee', '#fffaf0', '#f6d3dc', '#e6dcf5', '#f3dca4', '#d8a7b1', '#cfe3f2', '#e9d6c5'],
  hijabTrim: ['#d4a84f', '#fffaf0', '#e8899e', '#8f78b8', '#c3b1e1'],
  skinTone: ['#f8dccb', '#f3d2bd', '#e8bf9f', '#d9a982', '#c18b65', '#9c6b4a'],
  crownGem: ['#e8899e', '#f6d3dc', '#c3b1e1', '#9fd3e8', '#fffaf0', '#e05c7a'],
};
const LABELS: Record<keyof Appearance, string> = {
  gownColor: W.gownColor,
  gownAccent: W.gownAccent,
  hijabColor: W.hijabColor,
  hijabTrim: W.hijabTrim,
  skinTone: W.skinTone,
  crownGem: W.crownGem,
};
const PRESETS: Array<{ name: string; a: Appearance }> = [
  { name: W.presets.rose, a: DEFAULT_APPEARANCE },
  { name: W.presets.sage, a: { ...DEFAULT_APPEARANCE, gownColor: '#A3B18A', gownAccent: '#D4AF70', hijabColor: '#F8F6EF', hijabTrim: '#D4AF70', crownGem: '#D94B55' } },
  { name: W.presets.lavender, a: { ...DEFAULT_APPEARANCE, gownColor: '#c3b1e1', gownAccent: '#fffaf0', hijabColor: '#ece4f7', hijabTrim: '#d4a84f', crownGem: '#c3b1e1' } },
  { name: W.presets.champagne, a: { ...DEFAULT_APPEARANCE, gownColor: '#fbf3e4', gownAccent: '#d4a84f', hijabColor: '#fffaf0', hijabTrim: '#e7c98f', crownGem: '#f6d3dc' } },
  { name: W.presets.sunset, a: { ...DEFAULT_APPEARANCE, gownColor: '#d8a7b1', gownAccent: '#f3dca4', hijabColor: '#f6d3dc', hijabTrim: '#b85c78', crownGem: '#e05c7a' } },
];

function WardrobePanel() {
  const a = useGameStore((s) => s.appearance);
  const set = useGameStore((s) => s.setAppearance);
  const close = useUI((s) => s.closePanel);
  const crowned = useGameStore((s) => !!s.flags.crownAccepted);
  return (
    <Modal title={W.title} subtitle={W.subtitle} icon={<Shirt size={18} />} onClose={close}>
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <div className="rounded-3xl bg-gradient-to-b from-rosy-soft/70 to-lavender-soft p-3">
            <PrincessPortrait a={a} crowned={crowned} size={130} />
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {PRESETS.map((p) => (
              <button key={p.name} className="soft-btn !px-2.5 !py-1 text-xs" onClick={() => set(p.a)}>
                {p.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3">
          {(Object.keys(PALETTES) as Array<keyof Appearance>).map((k) => (
            <div key={k}>
              <p className="mb-1 text-sm font-bold text-plum">{LABELS[k]}</p>
              <div className="flex flex-wrap gap-2">
                {PALETTES[k].map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      audio.sfx('soft');
                      set({ [k]: c } as Partial<Appearance>);
                    }}
                    className={`h-9 w-9 rounded-full border-2 transition ${a[k] === c ? 'scale-110 border-gold-deep shadow-glow' : 'border-white'}`}
                    style={{ background: c }}
                    aria-label={`${LABELS[k]} ${c}`}
                    aria-pressed={a[k] === c}
                  />
                ))}
              </div>
            </div>
          ))}
          <p className="text-xs italic text-plum/60">{W.autoSaved}</p>
        </div>
      </div>
    </Modal>
  );
}

// --------------------------------------------------------------------- Profile
function ProfilePanel() {
  const save = useGameStore();
  const close = useUI((s) => s.closePanel);
  const openPanel = useUI((s) => s.openPanel);
  const crowned = !!save.flags.crownAccepted;
  const mins = Math.max(1, Math.round(save.stats.playSeconds / 60));
  const quests = Object.keys(save.completedQuests).length;
  return (
    <Modal title={PR.title} subtitle={PR.subtitle} icon={<Crown size={18} />} onClose={close} width="max-w-lg">
      <div className="flex flex-col items-center text-center">
        <div className="rounded-3xl bg-gradient-to-b from-rosy-soft/70 to-lavender-soft p-3">
          <PrincessPortrait a={save.appearance} crowned={crowned} size={110} />
        </div>
        {crowned ? (
          <>
            <p className="mt-3 text-[11px] font-bold tracking-[0.35em] text-gold-deep">{gameConfig.ROYAL_TITLE.line1}</p>
            <p className="font-serif text-3xl font-bold text-plum">
              {gameConfig.ROYAL_TITLE.line2Prefix} {fill(gameConfig.HER_NAME)}
            </p>
            <p className="text-xs font-semibold tracking-[0.2em] text-rosy-deep">{gameConfig.ROYAL_TITLE.line3}</p>
          </>
        ) : (
          <p className="mt-3 font-serif text-2xl font-bold text-plum">{PR.guest}</p>
        )}
        <div className="mt-2 flex items-center gap-1.5 text-sm text-plum/70">
          <Crown size={14} className={crowned ? 'text-gold-deep' : 'text-plum/30'} /> {crowned ? PR.crownWorn : PR.crownWaiting}
        </div>
        <p className="mt-1 text-sm text-plum/70">{PR.birthday} {formatBirthday(gameConfig.BIRTHDAY_DATE)}</p>
        <div className="mt-4 grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={PR.progress} value={`${overallProgress(save)}%`} />
          <Stat label={PR.questsDone} value={String(quests)} />
          <Stat label={PR.flowers} value={String(countCollected(save, 'flower:'))} />
          <Stat label={PR.stars} value={`${countCollected(save, 'star:')}/8`} />
        </div>
        <p className="mt-3 text-xs text-plum/60">{fmt(PR.timeInKingdom, { minutes: mins })}</p>
        <button className="royal-btn mt-4" onClick={() => openPanel('wardrobe')}>
          <Shirt size={16} /> {PR.wardrobe}
        </button>
      </div>
    </Modal>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-gold/30 bg-white/70 px-2 py-2">
      <p className="font-serif text-2xl font-bold text-plum">{value}</p>
      <p className="text-[11px] font-semibold text-plum/60">{label}</p>
    </div>
  );
}
