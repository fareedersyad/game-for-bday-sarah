import { Heart, Lock, Map as MapIcon, Navigation } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useUI } from '../../stores/uiStore';
import { useWorld } from '../../stores/worldStore';
import { focusQuest } from '../../systems/QuestManager/questManager';
import { runtime } from '../../systems/runtime';
import { fastTravel } from '../../systems/Story/story';
import { LOCATION_INFO, MAP_DESTINATIONS } from '../../systems/WorldManager/locations';
import { AREA_BOUNDS, LANDMARKS, PATHS, TREES } from '../../systems/WorldManager/worldLayout';
import type { LocationId } from '../../systems/WorldManager/worldTypes';
import { Icon } from '../ui/icons';
import { Modal } from '../ui/Modal';
import { personalContent } from '../../config/personalContent';

const M = personalContent.ui.map;

const B = AREA_BOUNDS.overworld;
const W = B.maxX - B.minX;
const H = B.maxZ - B.minZ;

function usePositions() {
  const [pos, setPos] = useState(() => snapshot());
  useEffect(() => {
    const id = window.setInterval(() => setPos(snapshot()), 120);
    return () => window.clearInterval(id);
  }, []);
  return pos;
}
function snapshot() {
  const p = runtime.player;
  const c = runtime.companion;
  return { px: p.x, pz: p.z, pyaw: p.yaw, parea: p.area, cx: c.x, cz: c.z, carea: c.area, cvisible: c.visible && c.mode !== 'absent' };
}

export function WorldMap() {
  const close = useUI((s) => s.closePanel);
  const save = useGameStore();
  const gates = useWorld((s) => s.gates);
  const pos = usePositions();
  const focus = focusQuest(save);
  const [selected, setSelected] = useState<LocationId | null>(null);

  const trees = useMemo(
    () => TREES.map((t, i) => <circle key={i} cx={t.x - B.minX} cy={t.z - B.minZ} r={0.9 * t.scale} fill={t.kind === 'dark' ? '#6f8a73' : t.kind === 'blossom' ? '#f2bccb' : '#9cc49a'} opacity={0.75} />),
    [],
  );

  const inCastle = pos.parea === 'castle';
  const toMap = (x: number, z: number) => ({ x: x - B.minX, y: z - B.minZ });
  const player = inCastle ? toMap(0, -34) : toMap(pos.px, pos.pz);
  const comp = pos.carea === 'castle' ? toMap(1.2, -33) : toMap(pos.cx, pos.cz);

  const sel = selected ? LOCATION_INFO[selected] : null;
  const selUnlocked = sel ? sel.unlocked(save) : false;
  const canTravel = !!sel?.travel && selUnlocked && useUI.getState().cutscene === null;

  return (
    <Modal title={M.title} subtitle={M.subtitle} icon={<MapIcon size={18} />} onClose={close} width="max-w-3xl">
      <div className="relative mx-auto w-full max-w-[560px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-2xl border border-gold/40 shadow-inner" role="img" aria-label={M.mapLabel}>
          <defs>
            <radialGradient id="mapGrass" cx="50%" cy="45%" r="70%">
              <stop offset="0%" stopColor="#e9f3d9" />
              <stop offset="100%" stopColor="#cfe3bd" />
            </radialGradient>
            <pattern id="paper" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="transparent" />
              <circle cx="1" cy="1" r="0.3" fill="#a88b5a" opacity="0.15" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#mapGrass)" />
          <circle cx={LANDMARKS.stormCenter.x - B.minX} cy={LANDMARKS.stormCenter.z - B.minZ} r={17} fill="#7d8f9e" opacity={save.flags.stormFound ? 0.15 : 0.35} />
          <circle cx={LANDMARKS.hillCenter.x - B.minX} cy={LANDMARKS.hillCenter.z - B.minZ} r={15} fill="#d9cdea" opacity={0.7} />
          <rect x={0} y={LANDMARKS.river.minZ - B.minZ} width={W} height={LANDMARKS.river.maxZ - LANDMARKS.river.minZ} fill="#a9d4ea" />
          <rect x={LANDMARKS.bridge.minX - B.minX} y={LANDMARKS.river.minZ - B.minZ - 0.6} width={LANDMARKS.bridge.maxX - LANDMARKS.bridge.minX} height={LANDMARKS.river.maxZ - LANDMARKS.river.minZ + 1.2} fill="#d8b98a" />
          {PATHS.map((p, i) => (
            <polyline key={i} points={p.points.map(([x, z]) => `${x - B.minX},${z - B.minZ}`).join(' ')} fill="none" stroke="#efdcb5" strokeWidth={p.width} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {trees}
          {/* Courtyard & castle */}
          <rect x={-14 - B.minX} y={-2 - B.minZ} width={28} height={24} fill="none" stroke="#7fae7a" strokeWidth={1.2} rx={1} />
          <rect x={-16 - B.minX} y={-46 - B.minZ} width={32} height={38} fill="#f7e8ec" stroke="#d4a84f" strokeWidth={0.8} rx={1} />
          <rect x={-9 - B.minX} y={-40 - B.minZ} width={18} height={12} fill="#f6c9d4" stroke="#b85c78" strokeWidth={0.5} />
          {[[-10, -28.4], [10, -28.4], [-10, -40], [10, -40]].map(([x, z], i) => (
            <circle key={i} cx={x - B.minX} cy={z - B.minZ} r={2.4} fill="#f3b4c4" stroke="#b85c78" strokeWidth={0.5} />
          ))}
          {/* Buildings */}
          <rect x={28 - B.minX} y={-32 - B.minZ} width={12} height={12} fill="#fbe3ea" stroke="#d4a84f" strokeWidth={0.6} />
          <rect x={-42 - B.minX} y={-34 - B.minZ} width={16} height={14} fill="#efe2cf" stroke="#a87c2a" strokeWidth={0.6} />
          <rect x={-46 - B.minX} y={-2 - B.minZ} width={18} height={16} fill="#eadbc8" stroke="#a87c2a" strokeWidth={0.6} />
          {/* Gates */}
          {(!gates.worldEast || !gates.worldWest || !gates.worldSouth) && (
            <g fill="#b85c78">
              {!gates.worldEast && <rect x={13.4 - B.minX} y={7 - B.minZ} width={1.2} height={6} />}
              {!gates.worldWest && <rect x={-14.6 - B.minX} y={7 - B.minZ} width={1.2} height={6} />}
              {!gates.worldSouth && <rect x={-3.2 - B.minX} y={21.4 - B.minZ} width={6.4} height={1.2} />}
            </g>
          )}
          {!gates.hillBridge && <rect x={-2.8 - B.minX} y={48.6 - B.minZ} width={5.6} height={1} fill="#8f78b8" />}
          {!gates.castleGate && <rect x={-3 - B.minX} y={-8.6 - B.minZ} width={6} height={1.2} fill="#b85c78" />}

          {/* Locations */}
          {MAP_DESTINATIONS.filter((id) => id !== 'castleHall').map((id) => {
            const info = LOCATION_INFO[id];
            const unlocked = info.unlocked(save);
            const isFocus = focus && (focus.location === id || (id === 'castleGrounds' && ['castleHall', 'bedroom', 'secretRoom'].includes(focus.location)));
            const { x, y } = toMap(info.map.x, info.map.z);
            return (
              <g key={id} onClick={() => setSelected(id)} style={{ cursor: 'pointer' }} role="button" aria-label={info.name}>
                {isFocus && <circle cx={x} cy={y} r={6.5} fill="none" stroke="#d4a84f" strokeWidth={1.2} className="pulse-ring" />}
                <circle cx={x} cy={y} r={4.6} fill={unlocked ? (selected === id ? '#b85c78' : '#e8899e') : '#9c8a97'} stroke="#fffaf0" strokeWidth={1} />
                <text x={x} y={y + 9.5} textAnchor="middle" fontSize={4.2} fontWeight={700} fill="#4a2c45" style={{ paintOrder: 'stroke', stroke: '#fffaf0', strokeWidth: 1.4 }}>
                  {unlocked ? info.name : '???'}
                </text>
              </g>
            );
          })}

          {/* Companion & player */}
          {pos.cvisible && <circle cx={comp.x} cy={comp.y} r={2} fill="#b85c78" stroke="#fff" strokeWidth={0.6} />}
          <g transform={`translate(${player.x} ${player.y}) rotate(${(-pos.pyaw * 180) / Math.PI + 180})`}>
            <circle r={3} fill="#d4a84f" stroke="#fff" strokeWidth={0.9} />
            <path d="M0,-5.5 L2.2,-1.8 L-2.2,-1.8 Z" fill="#fff" />
          </g>
          <rect width={W} height={H} fill="url(#paper)" pointerEvents="none" />
        </svg>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-plum/70">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-gold" /> {M.legendPrincess}
          </span>
          <span className="flex items-center gap-1">
            <Heart size={11} className="fill-rosy-deep text-rosy-deep" /> {M.legendHim}
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full border border-gold bg-white" /> {M.legendQuest}
          </span>
          {inCastle && <span className="font-semibold text-rosy-deep">{M.inCastle}</span>}
        </div>
      </div>

      {sel && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-gold/40 bg-white/75 p-4 sm:flex-row sm:items-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rosy-soft to-gold-soft">
            {selUnlocked ? <Icon name={sel.icon} size={20} /> : <Lock size={18} />}
          </div>
          <div className="flex-1">
            <p className="font-serif text-xl font-bold text-plum">{selUnlocked ? sel.name : M.locked}</p>
            <p className="text-sm text-plum/70">{selUnlocked ? `${sel.english} — ${sel.description}` : M.lockedHelp}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selected === 'castleGrounds' && save.flags.castleEntered && (
              <button className="soft-btn" onClick={() => void fastTravel('castleHall')}>
                <Navigation size={15} /> {M.insideCastle}
              </button>
            )}
            <button className="royal-btn" disabled={!canTravel} onClick={() => sel.travel && void fastTravel(sel.travel as never)}>
              <Navigation size={16} /> {M.travel}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
