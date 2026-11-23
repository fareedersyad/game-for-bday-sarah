/**
 * Interaction registry: maps interactable ids (from worldLayout) to their
 * behaviour. Story code registers handlers at boot; the simulation only
 * looks them up, which keeps the core free of import cycles.
 */
import type { SaveData } from '../../stores/progressTypes';

export type MarkerKind = 'quest' | 'item' | 'collectible' | null;

export interface InteractionDef {
  /** Prompt label, e.g. "Accept My Crown". */
  label: (save: SaveData) => string;
  /** Whether the spot can currently be interacted with. */
  available: (save: SaveData) => boolean;
  /** Floating marker style while available. */
  marker?: (save: SaveData) => MarkerKind;
  run: () => void | Promise<void>;
}

const registry = new Map<string, InteractionDef>();

export function registerInteraction(id: string, def: InteractionDef) {
  registry.set(id, def);
}

export function getInteraction(id: string) {
  return registry.get(id);
}

export function registeredIds() {
  return [...registry.keys()];
}

let talkHandler: (() => void | Promise<void>) | null = null;
export function registerTalkHandler(fn: () => void | Promise<void>) {
  talkHandler = fn;
}
export function getTalkHandler() {
  return talkHandler;
}
