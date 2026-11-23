/**
 * QUEST CONFIGURATION — purely declarative.
 *
 * Objectives are evaluated from save data by systems/QuestManager.
 * To change what a quest SAYS, edit src/config/personalContent.ts (section 7).
 */
import type { FlagId, ItemId, QuestId } from '../stores/progressTypes';
import type { LocationId } from '../systems/WorldManager/worldTypes';
import { personalContent } from './personalContent';

/** All quest & item TEXT lives in personalContent.ts — this file only holds logic. */
const QT = personalContent.quests;
const IT = personalContent.items;

export type ObjectiveSource =
  | { type: 'flag'; flag: FlagId }
  /** Counts collected ids that start with the prefix, e.g. "flower:". */
  | { type: 'collected'; prefix: string };

export interface QuestObjective {
  id: string;
  text: string;
  target: number;
  source: ObjectiveSource;
  optional?: boolean;
}

export interface QuestDef {
  id: QuestId;
  chapter: string;
  name: string;
  description: string;
  location: LocationId;
  objectives: QuestObjective[];
  rewards: ItemId[];
  prerequisites: QuestId[];
  /** Main quests gate the Fireworks finale. */
  main?: boolean;
  side?: boolean;
  /** Short hint used by the companion and the objective tracker. */
  hint: string;
}

const flag = (flag: FlagId): ObjectiveSource => ({ type: 'flag', flag });
const collected = (prefix: string): ObjectiveSource => ({ type: 'collected', prefix });

export const QUESTS: QuestDef[] = [
  {
    id: 'coronation',
    chapter: QT.coronation.chapter,
    name: QT.coronation.name,
    description: QT.coronation.description,
    location: 'courtyard',
    objectives: [{ id: 'crown', text: QT.coronation.objectives.crown, target: 1, source: flag('crownAccepted') }],
    rewards: ['crown'],
    prerequisites: [],
    hint: QT.coronation.hint,
  },
  {
    id: 'bouquet',
    chapter: QT.bouquet.chapter,
    name: QT.bouquet.name,
    description: QT.bouquet.description,
    location: 'courtyard',
    objectives: [{ id: 'bouquet', text: QT.bouquet.objectives.bouquet, target: 1, source: flag('bouquetReceived') }],
    rewards: ['bouquet'],
    prerequisites: ['coronation'],
    hint: QT.bouquet.hint,
  },
  {
    id: 'castle',
    chapter: QT.castle.chapter,
    name: QT.castle.name,
    description: QT.castle.description,
    location: 'castleGrounds',
    objectives: [
      { id: 'reveal', text: QT.castle.objectives.reveal, target: 1, source: flag('castleRevealed') },
      { id: 'enter', text: QT.castle.objectives.enter, target: 1, source: flag('castleEntered') },
    ],
    rewards: ['castleKey'],
    prerequisites: ['bouquet'],
    hint: QT.castle.hint,
  },
  {
    id: 'letter',
    chapter: QT.letter.chapter,
    name: QT.letter.name,
    description: QT.letter.description,
    location: 'bedroom',
    objectives: [{ id: 'read', text: QT.letter.objectives.read, target: 1, source: flag('letterRead') }],
    rewards: ['loveLetter'],
    prerequisites: ['castle'],
    hint: QT.letter.hint,
  },
  {
    id: 'garden',
    chapter: QT.garden.chapter,
    name: QT.garden.name,
    description: QT.garden.description,
    location: 'garden',
    objectives: [
      { id: 'flowers', text: QT.garden.objectives.flowers, target: 10, source: collected('flower:') },
      { id: 'bloom', text: QT.garden.objectives.bloom, target: 3, source: collected('bloom:') },
      { id: 'notes', text: QT.garden.objectives.notes, target: 3, source: collected('note:'), optional: true },
    ],
    rewards: ['roseCharm'],
    prerequisites: ['letter'],
    main: true,
    hint: QT.garden.hint,
  },
  {
    id: 'mirror',
    chapter: QT.mirror.chapter,
    name: QT.mirror.name,
    description: QT.mirror.description,
    location: 'mirror',
    objectives: [{ id: 'ask', text: QT.mirror.objectives.ask, target: 1, source: flag('mirrorAnswered') }],
    rewards: ['pearlMirror'],
    prerequisites: ['letter'],
    main: true,
    hint: QT.mirror.hint,
  },
  {
    id: 'library',
    chapter: QT.library.chapter,
    name: QT.library.name,
    description: QT.library.description,
    location: 'library',
    objectives: [{ id: 'books', text: QT.library.objectives.books, target: 4, source: collected('book:') }],
    rewards: ['starBookmark'],
    prerequisites: ['letter'],
    main: true,
    hint: QT.library.hint,
  },
  {
    id: 'courtroom',
    chapter: QT.courtroom.chapter,
    name: QT.courtroom.name,
    description: QT.courtroom.description,
    location: 'courtroom',
    objectives: [
      { id: 'clues', text: QT.courtroom.objectives.clues, target: 3, source: collected('court:') },
      { id: 'verdict', text: QT.courtroom.objectives.verdict, target: 1, source: flag('courtVerdict') },
    ],
    rewards: ['justiceBadge'],
    prerequisites: ['letter'],
    main: true,
    hint: QT.courtroom.hint,
  },
  {
    id: 'children',
    chapter: QT.children.chapter,
    name: QT.children.name,
    description: QT.children.description,
    location: 'children',
    objectives: [
      { id: 'talk', text: QT.children.objectives.talk, target: 1, source: flag('momoTalked') },
      { id: 'clues', text: QT.children.objectives.clues, target: 2, source: collected('kids:') },
      { id: 'find', text: QT.children.objectives.find, target: 1, source: flag('toyFound') },
      { id: 'return', text: QT.children.objectives.return, target: 1, source: flag('toyReturned') },
    ],
    rewards: ['kindnessBadge'],
    prerequisites: ['letter'],
    main: true,
    hint: QT.children.hint,
  },
  {
    id: 'storm',
    chapter: QT.storm.chapter,
    name: QT.storm.name,
    description: QT.storm.description,
    location: 'storm',
    objectives: [
      { id: 'enter', text: QT.storm.objectives.enter, target: 1, source: flag('stormStarted') },
      { id: 'clues', text: QT.storm.objectives.clues, target: 4, source: collected('storm:'), optional: true },
      { id: 'found', text: QT.storm.objectives.found, target: 1, source: flag('stormFound') },
    ],
    rewards: ['rainbowCrystal'],
    prerequisites: ['letter'],
    main: true,
    hint: QT.storm.hint,
  },
  {
    id: 'finale',
    chapter: QT.finale.chapter,
    name: QT.finale.name,
    description: QT.finale.description,
    location: 'fireworks',
    objectives: [{ id: 'watch', text: QT.finale.objectives.watch, target: 1, source: flag('finaleWatched') }],
    rewards: ['starlightLocket'],
    prerequisites: ['garden', 'mirror', 'library', 'courtroom', 'children', 'storm'],
    hint: QT.finale.hint,
  },
  {
    id: 'secret',
    chapter: QT.secret.chapter,
    name: QT.secret.name,
    description: QT.secret.description,
    location: 'secretRoom',
    objectives: [
      { id: 'enter', text: QT.secret.objectives.enter, target: 1, source: flag('secretEntered') },
      { id: 'candles', text: QT.secret.objectives.candles, target: 1, source: flag('candlesBlown') },
      { id: 'read', text: QT.secret.objectives.read, target: 1, source: flag('finalLetterRead') },
    ],
    rewards: ['finalLetter'],
    prerequisites: ['finale'],
    hint: QT.secret.hint,
  },
  {
    id: 'memories',
    chapter: QT.memories.chapter,
    name: QT.memories.name,
    description: QT.memories.description,
    location: 'paths',
    objectives: [{ id: 'stars', text: QT.memories.objectives.stars, target: 8, source: collected('star:') }],
    rewards: [],
    prerequisites: ['coronation'],
    side: true,
    hint: QT.memories.hint,
  },
  {
    id: 'strawberries',
    chapter: QT.strawberries.chapter,
    name: QT.strawberries.name,
    description: QT.strawberries.description,
    location: 'strawberryGarden',
    objectives: [{ id: 'pick', text: QT.strawberries.objectives.pick, target: 5, source: collected('berry:') }],
    rewards: ['strawberryBasket'],
    prerequisites: ['letter'],
    side: true,
    hint: QT.strawberries.hint,
  },
];

export const QUEST_BY_ID = Object.fromEntries(QUESTS.map((q) => [q.id, q])) as Record<QuestId, QuestDef>;

export const MAIN_QUESTS: QuestId[] = QUESTS.filter((q) => q.main).map((q) => q.id);

export interface ItemDef {
  name: string;
  description: string;
  icon: string;
  /** Items that can be re-read / re-opened from the inventory. */
  readable?: 'loveLetter' | 'finalLetter';
}

export const ITEMS: Record<ItemId, ItemDef> = {
  crown: { ...IT.crown, icon: 'crown' },
  bouquet: { ...IT.bouquet, icon: 'flower' },
  castleKey: { ...IT.castleKey, icon: 'key' },
  loveLetter: { ...IT.loveLetter, icon: 'mail', readable: 'loveLetter' },
  seeds: { ...IT.seeds, icon: 'sprout' },
  wateringCan: { ...IT.wateringCan, icon: 'droplets' },
  roseCharm: { ...IT.roseCharm, icon: 'flower2' },
  pearlMirror: { ...IT.pearlMirror, icon: 'sparkles' },
  starBookmark: { ...IT.starBookmark, icon: 'bookmark' },
  justiceBadge: { ...IT.justiceBadge, icon: 'scale' },
  momoToy: { ...IT.momoToy, icon: 'star' },
  kindnessBadge: { ...IT.kindnessBadge, icon: 'heart' },
  rainbowCrystal: { ...IT.rainbowCrystal, icon: 'gem' },
  starlightLocket: { ...IT.starlightLocket, icon: 'moon' },
  finalLetter: { ...IT.finalLetter, icon: 'scroll', readable: 'finalLetter' },
  strawberry: { ...IT.strawberry, icon: 'cherry' },
  strawberryBasket: { ...IT.strawberryBasket, icon: 'basket' },
};
