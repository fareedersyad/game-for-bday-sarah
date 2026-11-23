/** Tiny typed event bus decoupling the simulation from story scripts. */
import type { LocationId } from './WorldManager/worldTypes';

export interface GameEvents {
  enterLocation: { id: LocationId; firstVisit: boolean };
  hitGate: { gate: string };
  companionRecovered: { reason: string };
  areaChanged: { area: string };
  trigger: { id: 'storm' | 'hilltop' | 'stormCompanion' };
}

type Handler<T> = (payload: T) => void;
const handlers = new Map<keyof GameEvents, Set<Handler<never>>>();

export function on<K extends keyof GameEvents>(event: K, fn: Handler<GameEvents[K]>) {
  let set = handlers.get(event);
  if (!set) handlers.set(event, (set = new Set()));
  set.add(fn as Handler<never>);
  return () => {
    set!.delete(fn as Handler<never>);
  };
}

export function emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]) {
  handlers.get(event)?.forEach((fn) => (fn as Handler<GameEvents[K]>)(payload));
}
