import type { SaveData } from '../../stores/progressTypes';
import { allMainQuestsComplete } from '../QuestManager/questManager';
import type { LocationId } from './worldTypes';
import { personalContent } from '../../config/personalContent';

/** Location names & descriptions live in personalContent.ts (section 9). */
const LT = personalContent.locations;

export interface LocationInfo {
  name: string;
  english: string;
  description: string;
  /** Map label anchor (overworld coordinates). */
  map: { x: number; z: number };
  icon: string;
  /** Can she travel here / is it open? */
  unlocked: (s: SaveData) => boolean;
  /** Fast-travel key in TRAVEL_POINTS (if any). */
  travel?: string;
}

const always = () => true;
const afterLetter = (s: SaveData) => !!s.flags.letterRead;

export const LOCATION_INFO: Record<LocationId, LocationInfo> = {
  courtyard: { ...LT.courtyard, map: { x: 0, z: 10 }, icon: 'crown', unlocked: always, travel: 'courtyard' },
  castleGrounds: { ...LT.castleGrounds, map: { x: 0, z: -30 }, icon: 'castle', unlocked: (s) => !!s.flags.castleRevealed, travel: 'castleGrounds' },
  castleHall: { ...LT.castleHall, map: { x: 0, z: -34 }, icon: 'castle', unlocked: (s) => !!s.flags.castleEntered, travel: 'castleHall' },
  bedroom: { ...LT.bedroom, map: { x: 0, z: -34 }, icon: 'moon', unlocked: (s) => !!s.flags.castleEntered },
  secretRoom: { ...LT.secretRoom, map: { x: 0, z: -34 }, icon: 'heart', unlocked: (s) => !!s.flags.secretUnlocked },
  garden: { ...LT.garden, map: { x: 37, z: 5 }, icon: 'flower', unlocked: afterLetter, travel: 'garden' },
  mirror: { ...LT.mirror, map: { x: 34, z: -26 }, icon: 'sparkles', unlocked: afterLetter, travel: 'mirror' },
  library: { ...LT.library, map: { x: -34, z: -27 }, icon: 'book', unlocked: afterLetter, travel: 'library' },
  courtroom: { ...LT.courtroom, map: { x: -37, z: 6 }, icon: 'scale', unlocked: afterLetter, travel: 'courtroom' },
  children: { ...LT.children, map: { x: 33, z: 36 }, icon: 'smile', unlocked: afterLetter, travel: 'children' },
  storm: { ...LT.storm, map: { x: -31, z: 36 }, icon: 'droplets', unlocked: afterLetter, travel: 'storm' },
  fireworks: { ...LT.fireworks, map: { x: 0, z: 70 }, icon: 'star', unlocked: (s) => allMainQuestsComplete(s), travel: 'fireworks' },
  strawberryGarden: { ...LT.strawberryGarden, map: { x: 49, z: -15 }, icon: 'cherry', unlocked: afterLetter, travel: 'strawberryGarden' },
  paths: { ...LT.paths, map: { x: 0, z: 30 }, icon: 'sparkles', unlocked: always },
};

/** Locations shown as map destinations (in display order). */
export const MAP_DESTINATIONS: LocationId[] = ['courtyard', 'castleGrounds', 'castleHall', 'garden', 'strawberryGarden', 'mirror', 'library', 'courtroom', 'children', 'storm', 'fireworks'];
