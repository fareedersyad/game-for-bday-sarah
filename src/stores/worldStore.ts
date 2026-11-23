/** Reactive world facts that renderers need to rebuild on (rarely changing). */
import { create } from 'zustand';
import type { MarkerKind } from '../systems/Interaction/registry';
import type { AreaId, GateId } from '../systems/WorldManager/worldTypes';

export interface ActiveSpot {
  id: string;
  marker: MarkerKind;
}

interface WorldStore {
  area: AreaId;
  activeSpots: ActiveSpot[];
  gates: Record<GateId, boolean>;
  setArea: (a: AreaId) => void;
  setActiveSpots: (s: ActiveSpot[]) => void;
  setGates: (g: Record<GateId, boolean>) => void;
}

const sameSpots = (a: ActiveSpot[], b: ActiveSpot[]) =>
  a.length === b.length && a.every((s, i) => s.id === b[i].id && s.marker === b[i].marker);

export const useWorld = create<WorldStore>()((set, get) => ({
  area: 'overworld',
  activeSpots: [],
  gates: { castleGate: false, worldEast: false, worldWest: false, worldSouth: false, hillBridge: false, secretDoor: false },
  setArea: (area) => get().area !== area && set({ area }),
  setActiveSpots: (activeSpots) => !sameSpots(get().activeSpots, activeSpots) && set({ activeSpots }),
  setGates: (gates) => {
    const cur = get().gates;
    if ((Object.keys(gates) as GateId[]).some((k) => cur[k] !== gates[k])) set({ gates });
  },
}));
