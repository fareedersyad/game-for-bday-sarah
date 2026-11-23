export type AreaId = 'overworld' | 'castle';

export type LocationId =
  | 'courtyard'
  | 'castleGrounds'
  | 'garden'
  | 'mirror'
  | 'library'
  | 'courtroom'
  | 'children'
  | 'storm'
  | 'fireworks'
  | 'paths'
  | 'castleHall'
  | 'bedroom'
  | 'secretRoom'
  | 'strawberryGarden';

/** Barriers / doors whose collision depends on story progress. */
export type GateId = 'castleGate' | 'worldEast' | 'worldWest' | 'worldSouth' | 'hillBridge' | 'secretDoor';

export interface CircleShape {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
}

export interface BoxShape {
  kind: 'box';
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export type Shape = CircleShape | BoxShape;

export type Collider = Shape & {
  /** When set, the collider only exists while that gate is closed. */
  gate?: GateId;
  /** Optional tag for debugging / rendering. */
  tag?: string;
};

export interface Zone {
  id: LocationId;
  area: AreaId;
  shape: Shape;
  /** Higher priority zones win when they overlap. */
  priority: number;
}

export interface SpawnPoint {
  area: AreaId;
  x: number;
  z: number;
  yaw: number;
}

export interface Seat {
  id: string;
  area: AreaId;
  x: number;
  z: number;
  /** Yaw the character faces while seated. */
  yaw: number;
  /** Seat surface height. */
  height: number;
}

export interface InteractableSpot {
  id: string;
  area: AreaId;
  x: number;
  z: number;
  /** Interaction range in metres. */
  radius: number;
  /** Height of the floating marker / prompt anchor. */
  markerHeight?: number;
}

export interface AreaBounds {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export interface TreeInstance {
  x: number;
  z: number;
  scale: number;
  rot: number;
  kind: 'round' | 'pine' | 'blossom' | 'dark';
}

export interface PathDef {
  points: ReadonlyArray<readonly [number, number]>;
  width: number;
}

export interface DoorLink {
  id: string;
  from: AreaId;
  to: SpawnPoint;
  /** Where the companion appears (through the door, behind her) after the transition. */
  companionEntry: { x: number; z: number };
}
