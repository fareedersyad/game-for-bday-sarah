/**
 * STORY — every chapter, quest beat and interaction of the adventure.
 *
 * Personal text comes from config/gameConfig.ts and config/dialogueConfig.ts;
 * this file only sequences it.
 */
import { dialogueConfig } from '../../config/dialogueConfig';
import { gameConfig } from '../../config/gameConfig';
import { ITEMS, QUEST_BY_ID } from '../../config/questConfig';
import { getSave, useGameStore } from '../../stores/gameStore';
import type { QuestId } from '../../stores/progressTypes';
import { useUI, type DialogueLine } from '../../stores/uiStore';
import { damp, dirToYaw } from '../../utils/math';
import { fill, fmt } from '../../utils/text';
import { audio } from '../AudioManager/audioEngine';
import { pinMusic } from '../AudioManager/audioDirector';
import { commandFollow, commandGoto, commandHold, commandSit, recover } from '../CompanionController/companionController';
import { greeting, hintLines, manjaLines, memoryLines, placeLines, goodbyeLine, type TalkContext } from '../DialogueManager/dialogueEngine';
import { on } from '../events';
import { game } from '../GameLoop/game';
import { registerInteraction, registerTalkHandler, type InteractionDef } from '../Interaction/registry';
import { allMainQuestsComplete, countCollected, isQuestCompleted, pendingCompletions, questStatus } from '../QuestManager/questManager';
import { emitSparkle, runtime, setCompanionEmote, setPlayerEmote } from '../runtime';
import { DOORS, FLOWER_SPOTS, heightAt, LANDMARKS, MEMORY_STARS, PLANT_PLOTS, SEATS, SPOT_BY_ID, STRAWBERRY_GARDEN, STRAWBERRY_SPOTS, TRAVEL_POINTS } from '../WorldManager/worldLayout';
import type { LocationId } from '../WorldManager/worldTypes';
import { activeCutscene, Cut, runCutscene, skipCutscene, toDialogue, whenIdle } from './cutscene';
import { saveManager } from '../SaveManager/saveManager';
import type { SaveData } from '../../stores/progressTypes';
import { sanitizeSettings, useSettings } from '../../stores/settingsStore';
import {
  birthdayState,
  blowOutCandles,
  harvestStrawberry,
  makeBirthdayWish,
  picnicUnlocked,
  STRAWBERRIES_REQUIRED,
  strawberriesPicked,
} from './celebrations';
import { personalContent } from '../../config/personalContent';

const ST = personalContent.story;
const A = personalContent.story.actions;

const S = () => getSave();
const store = () => useGameStore.getState();
const ui = () => useUI.getState();
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

/** Say lines outside a cutscene (simple dialogue). */
async function say(lines: Parameters<typeof toDialogue>[0]) {
  await ui().showDialogue(toDialogue(lines));
}

function him(text: string): DialogueLine[] {
  return [{ speaker: 'him', text: fill(text) }];
}

async function note(title: string, text: string, kind: 'note' | 'memory' | 'bloom' | 'clue' = 'note') {
  await ui().openOverlay({ type: 'note', title: fill(title), text: fill(text), kind });
}

/** Companion walks to a spot beside the Princess, facing her. */
function companionBeside(c: Cut | null, side: 1 | -1 = 1, dist = 1.15) {
  const p = runtime.player;
  const comp = runtime.companion;
  const rx = -Math.cos(p.yaw) * side;
  const rz = Math.sin(p.yaw) * side;
  const world = game.worlds[p.area];
  const spot = world.nearestFree(p.x + rx * dist, p.z + rz * dist, 0.45, 3) ?? { x: p.x + rx * dist, z: p.z + rz * dist };
  commandGoto(comp, { x: spot.x, z: spot.z, yaw: dirToYaw(p.x - spot.x, p.z - spot.z) }, 0.3);
  return c ? c.until(() => comp.mode === 'hold', 7000) : Promise.resolve();
}

function playerFace(x: number, z: number) {
  const p = runtime.player;
  p.yaw = dirToYaw(x - p.x, z - p.z);
}

/** Over-the-shoulder two-shot framing both characters. */
function twoShot(c: Cut, blend = 1.4) {
  const p = runtime.player;
  const comp = runtime.companion;
  const mx = (p.x + comp.x) / 2;
  const mz = (p.z + comp.z) / 2;
  const nx = -(comp.z - p.z);
  const nz = comp.x - p.x;
  const nl = Math.hypot(nx, nz) || 1;
  const fx = Math.sin(p.yaw);
  const fz = Math.cos(p.yaw);
  const sx = nx / nl;
  const sz = nz / nl;
  // Pick the side that is in front of her.
  const sign = sx * fx + sz * fz >= 0 ? 1 : -1;
  const y = p.y;
  c.shot([mx + sx * sign * 4.2, y + 2.1, mz + sz * sign * 4.2], [mx, y + 1.35, mz], blend);
}

// ============================================================================
// QUEST COMPLETION
// ============================================================================
let completing = false;

export async function completeQuest(id: QuestId, opts: { silentCard?: boolean } = {}) {
  if (!store().markQuestComplete(id)) return;
  const q = QUEST_BY_ID[id];
  q.rewards.forEach((r) => {
    if (!S().inventory[r]) store().addItem(r);
  });
  store().queueReaction(id);
  audio.sfx('quest');
  if (!opts.silentCard) await ui().openOverlay({ type: 'questComplete', questId: id });
  if (q.main && allMainQuestsComplete(S()) && !S().flags.hillAnnounced) {
    store().setFlag('hillAnnounced');
    whenIdle(() => void announceHill());
  }
  if (id === 'memories') {
    // nothing extra
  }
}

/** Safety net: complete any quest whose objectives are already satisfied. */
async function sweepPendingQuests() {
  if (completing || activeCutscene()) return;
  const u = ui();
  if (u.screen !== 'playing' || u.overlays.length || u.dialogue) return;
  const pending = pendingCompletions(S());
  if (!pending.length) return;
  completing = true;
  try {
    for (const id of pending) await completeQuest(id);
  } finally {
    completing = false;
  }
}

// ============================================================================
// CHAPTER 0 — OPENING
// ============================================================================
export function beginAdventure() {
  audio.unlock();
  audio.sfx('magic');
  const st = store();
  if (!S().flags.gameStarted) {
    st.setFlag('gameStarted');
    useGameStore.setState((s) => ({ stats: { ...s.stats, startedAt: s.stats.startedAt ?? Date.now() } }));
  }
  ui().setScreen('playing');
  runtime.camera.mode = 'follow';
  runtime.camera.blend = 2.2;
  if (!S().flags.crownAccepted) {
    window.setTimeout(() => ui().showBark(fill(ST.coronationLine), 'narrator', 5200), 1800);
  }
}

// ============================================================================
// CHAPTER 1 — CORONATION
// ============================================================================
async function coronation() {
  await runCutscene('coronation', { skippable: true }, async (c) => {
    const cp = LANDMARKS.crownPedestal;
    const p = runtime.player;
    playerFace(cp.x, cp.z);
    c.shot([cp.x + 3.2, 2.2, cp.z + 3.6], [cp.x, 1.2, cp.z], 1.4);
    await c.story([ST.coronationLine], 'gold');
    audio.sfx('crown');
    runtime.anim.crownFlightActive = true;
    emitSparkle(cp.x, 1.4, cp.z, '#ffe3a3', 40);
    // Camera follows the crown as it floats up, then settles onto her hijab.
    c.shot([cp.x + 4, 3.4, cp.z + 2], [cp.x, 2.6, cp.z], 1.6);
    await c.tween(1.8, (t) => (runtime.anim.crownFlight = t * 0.5));
    c.shot([p.x + Math.sin(p.yaw) * 2.6 + 1, p.y + 2.2, p.z + Math.cos(p.yaw) * 2.6], [p.x, p.y + 1.9, p.z], 1.6);
    await c.tween(2.2, (t) => (runtime.anim.crownFlight = 0.5 + t * 0.5));
    runtime.anim.crownFlightActive = false;
    runtime.anim.crownFlight = 1;
    store().setFlag('crownAccepted');
    if (!S().inventory.crown) store().addItem('crown');
    emitSparkle(p.x, p.y + 2, p.z, '#ffd27a', 50);
    setPlayerEmote('sparkle', 3);
    audio.sfx('bloom');
    await c.tween(2, (t) => (runtime.anim.coronationBloom = t));

    // The companion appears.
    const comp = runtime.companion;
    const deb = LANDMARKS.companionDebut;
    comp.area = 'overworld';
    comp.x = deb.x;
    comp.z = deb.z;
    comp.mode = 'follow';
    comp.visible = true;
    game.companionScripted = true;
    emitSparkle(deb.x, 1.2, deb.z, '#ffc2d4', 40);
    audio.sfx('magic');
    c.shot([p.x + 5, p.y + 3, p.z + 4], [(p.x + deb.x) / 2, 1.2, (p.z + deb.z) / 2], 1.5);
    await companionBeside(c, -1, 1.3);
    playerFace(comp.x, comp.z);
    twoShot(c);
    setCompanionEmote('heart', 3);
    await c.say(dialogueConfig.scenes.companionDebut);
    audio.sfx('chime');
    await c.overlay({ type: 'royalCard' });
    await c.say(dialogueConfig.scenes.afterRoyalCard);
  });
  // Ensure end state even if skipped.
  runtime.anim.crownFlight = 1;
  runtime.anim.crownFlightActive = false;
  runtime.anim.coronationBloom = 1;
  store().setFlag('crownAccepted');
  if (!S().inventory.crown) store().addItem('crown');
  ensureCompanionPresent();
  game.companionScripted = false;
  commandFollow(runtime.companion);
  await completeQuest('coronation');
}

function ensureCompanionPresent() {
  const comp = runtime.companion;
  if (comp.mode === 'absent' || !comp.visible || comp.area !== runtime.player.area) {
    comp.mode = 'follow';
    recover(comp, game.playerSnapshot(), { world: game.worlds[runtime.player.area], grid: game.grid(runtime.player.area) }, {}, 'story');
    comp.visible = true;
  }
}

// ============================================================================
// CHAPTER 2 — BOUQUET
// ============================================================================
async function receiveBouquet() {
  await runCutscene('bouquet', { skippable: true }, async (c) => {
    const b = LANDMARKS.bouquetDisplay;
    const p = runtime.player;
    playerFace(b.x, b.z);
    game.companionScripted = true;
    c.shot([b.x - 2.6, 2, b.z + 3.4], [b.x, 1.1, b.z], 1.4);
    await c.story([ST.bouquetLine], 'soft');
    audio.sfx('bloom');
    emitSparkle(b.x, 1.3, b.z, '#ffb7cb', 45);
    await c.tween(2.2, (t) => (runtime.anim.bouquetLift = t));
    store().setFlag('bouquetReceived');
    if (!S().inventory.bouquet) store().addItem('bouquet');
    emitSparkle(p.x, p.y + 1.3, p.z, '#ffd1dc', 40);
    setPlayerEmote('heart', 3);
    await companionBeside(c, -1, 1.2);
    twoShot(c);
    await c.say(dialogueConfig.scenes.bouquet);
  });
  runtime.anim.bouquetLift = 1;
  store().setFlag('bouquetReceived');
  if (!S().inventory.bouquet) store().addItem('bouquet');
  game.companionScripted = false;
  commandFollow(runtime.companion);
  await completeQuest('bouquet');
  await castleReveal();
}

// ============================================================================
// CHAPTER 3 — CASTLE REVEAL
// ============================================================================
async function castleReveal() {
  let enter = false;
  await runCutscene('castleReveal', { skippable: true }, async (c) => {
    const g = LANDMARKS.castleGate;
    game.companionScripted = true;
    c.shot([4, 3, 4], [g.x, 2.4, g.z], 1.8);
    await c.wait(900);
    audio.sfx('magic');
    await c.tween(2.4, (t) => (runtime.anim.archGlow = t));
    audio.sfx('gate');
    store().setFlag('castleRevealed'); // opens the gate collider; the doors swing open
    c.shot([0, 15, 2], [0, 7, -34], 3.2);
    await c.wait(3200);
    audio.sfx('chime');
    await c.overlay({ type: 'banner', title: ST.banners.palaceUnlocked.title, subtitle: ST.banners.palaceUnlocked.subtitle, tone: 'gold' });
    await companionBeside(c, 1, 1.2);
    twoShot(c);
    await c.say(dialogueConfig.scenes.castleReveal);
    const r = await c.overlay<string>({ type: 'banner', title: ST.banners.castleOwned.title, subtitle: ST.banners.castleOwned.subtitle, button: ST.banners.castleOwned.button, tone: 'rose' });
    enter = r === 'button';
  });
  runtime.anim.archGlow = 1;
  store().setFlag('castleRevealed');
  game.companionScripted = false;
  commandFollow(runtime.companion);
  if (enter) await enterCastle();
  else ui().toast(ST.toasts.castleWaiting, 'castle');
}

async function enterCastle() {
  audio.sfx('open');
  await game.transition(DOORS.enterCastle.to, DOORS.enterCastle.companionEntry);
  if (!S().flags.castleEntered) {
    store().setFlag('castleEntered');
    store().setFlag('bouquetPlaced');
    await runCutscene('castleWelcome', { skippable: true, letterbox: false }, async (c) => {
      await c.wait(1300);
      await c.say(dialogueConfig.scenes.castleFirstEnter);
    });
    await completeQuest('castle');
  }
}

async function exitCastle() {
  audio.sfx('close');
  await game.transition(DOORS.exitCastle.to, DOORS.exitCastle.companionEntry);
}

// ============================================================================
// CHAPTER 4 — LOVE LETTER
// ============================================================================
async function openLoveLetter() {
  audio.sfx('page');
  await ui().openOverlay({ type: 'letter', which: 'loveLetter' });
  if (S().flags.letterRead) return;
  store().setFlag('letterRead');
  if (!S().inventory.loveLetter) store().addItem('loveLetter');
  await runCutscene('afterLetter', { skippable: true, letterbox: false }, async (c) => {
    await companionBeside(c, 1, 1.2);
    setCompanionEmote('heart', 3);
    await c.say(dialogueConfig.scenes.afterLetter);
  });
  commandFollow(runtime.companion);
  await completeQuest('letter');
  audio.sfx('gate');
  await ui().openOverlay({ type: 'banner', title: ST.banners.kingdomAwaits.title, subtitle: ST.banners.kingdomAwaits.subtitle, tone: 'rose' });
  store().setFlag('kingdomAnnounced');
}

// ============================================================================
// GARDEN
// ============================================================================
const FLOWER_NAMES: Record<string, string> = ST.flowerNames;

async function pickFlower(id: string, type: string) {
  if (!store().collect(`flower:${id}`)) return;
  const sp = SPOT_BY_ID[id];
  audio.sfx('pickup');
  emitSparkle(sp.x, 0.8, sp.z, '#ffc4d6', 22);
  const n = countCollected(S(), 'flower:');
  ui().toast(fmt(ST.toasts.flowerPicked, { flower: FLOWER_NAMES[type] ?? ST.flowerFallback, count: Math.min(n, gameConfig.GARDEN.flowersRequired), total: gameConfig.GARDEN.flowersRequired }), 'flower');
  if (n >= gameConfig.GARDEN.flowersRequired && !S().flags.gardenMessageShown) {
    store().setFlag('gardenMessageShown');
    await runCutscene('gardenFlowers', { skippable: true, letterbox: false }, async (c) => {
      await c.story([gameConfig.GARDEN.completionMessage], 'soft');
      await c.say(dialogueConfig.scenes.gardenFlowersEnough);
    });
  } else if (n % 4 === 1 && n > 1) {
    ui().showBark(pick(dialogueConfig.barks.garden));
  }
  await checkGarden();
}

async function plotAction(plotId: string, index: number) {
  const planted = S().collected[`plant:${plotId}`] !== undefined;
  const bloomed = S().collected[`bloom:${plotId}`] !== undefined;
  const sp = SPOT_BY_ID[plotId];
  if (bloomed) return;
  if (!planted) {
    if ((S().inventory.seeds ?? 0) <= 0) {
      ui().toast(dialogueConfig.objects.plotNeedSeed, 'sprout');
      return;
    }
    store().removeItem('seeds');
    store().collect(`plant:${plotId}`);
    audio.sfx('soft');
    emitSparkle(sp.x, 0.4, sp.z, '#b9e6a5', 16);
    ui().toast(dialogueConfig.objects.plotPlanted, 'sprout');
    return;
  }
  if (!S().flags.hasWateringCan) {
    ui().toast(dialogueConfig.objects.plotNeedWater, 'droplets');
    return;
  }
  store().collect(`bloom:${plotId}`);
  audio.sfx('water');
  window.setTimeout(() => audio.sfx('bloom'), 450);
  emitSparkle(sp.x, 0.9, sp.z, '#ffd6e4', 36);
  await new Promise((r) => setTimeout(r, 900));
  await note(ST.noteTitles.bloom, gameConfig.GARDEN.bloomMessages[index] ?? gameConfig.GARDEN.bloomMessages[0], 'bloom');
  await checkGarden();
}

async function checkGarden() {
  if (questStatus(S(), 'garden') !== 'active') return;
  const s = S();
  if (countCollected(s, 'flower:') >= gameConfig.GARDEN.flowersRequired && countCollected(s, 'bloom:') >= PLANT_PLOTS.length) {
    await runCutscene('gardenComplete', { skippable: true, letterbox: false }, async (c) => {
      await companionBeside(c, 1, 1.2);
      setCompanionEmote('heart');
      await c.say(dialogueConfig.scenes.gardenComplete);
    });
    commandFollow(runtime.companion);
    await completeQuest('garden');
  }
}

// ============================================================================
// MIRROR
// ============================================================================
async function askMirror() {
  const first = !S().flags.mirrorAnswered;
  await runCutscene('mirror', { skippable: true, letterbox: false }, async (c) => {
    game.companionScripted = true;
    playerFace(34, -32);
    const p = runtime.player;
    commandGoto(runtime.companion, { x: p.x + 1.3, z: p.z + 1.1, yaw: Math.PI }, 0.35);
    c.shot([34, 2.4, -25.2], [34, 1.9, -31.4], 1.4);
    audio.sfx('magic');
    await c.tween(1.2, (t) => (runtime.anim.mirrorGlow = t));
    await c.overlay({ type: 'mirror' });
    setCompanionEmote('heart', 3);
    await c.say(dialogueConfig.scenes.mirrorAfter.map(([s, t], i) => (i === 0 ? ([s, gameConfig.MIRROR.companionLine] as const) : ([s, t] as const))));
  });
  runtime.anim.mirrorGlow = 0;
  game.companionScripted = false;
  commandFollow(runtime.companion);
  if (first) {
    store().setFlag('mirrorAnswered');
    await completeQuest('mirror');
  }
}

// ============================================================================
// LIBRARY
// ============================================================================
async function readBook(bookId: string) {
  audio.sfx('page');
  await ui().openOverlay({ type: 'book', bookId });
  store().collect(`book:${bookId}`);
  const read = countCollected(S(), 'book:');
  if (read < 4) {
    ui().toast(fmt(ST.toasts.bookRead, { count: read, total: 4 }), 'book');
    if (read === 2) ui().showBark(pick(dialogueConfig.barks.library));
    return;
  }
  if (!isQuestCompleted(S(), 'library')) {
    await runCutscene('libraryComplete', { skippable: true, letterbox: false }, async (c) => {
      await companionBeside(c, 1, 1.2);
      await c.say(dialogueConfig.scenes.libraryComplete);
    });
    commandFollow(runtime.companion);
    await completeQuest('library');
  }
}

// ============================================================================
// COURTROOM
// ============================================================================
let judgeIntroShown = false;

async function examineClue(clueId: keyof typeof dialogueConfig.courtroom.clues) {
  audio.sfx('page');
  await ui().openOverlay({ type: 'court', mode: 'clue', clueId });
  if (store().collect(`court:${clueId}`)) {
    const n = countCollected(S(), 'court:');
    ui().toast(fmt(ST.toasts.evidenceChecked, { count: n, total: 3 }), 'scale');
    if (n === 3) ui().showBark(ST.barks.allEvidence);
  }
}

async function verdict() {
  if (countCollected(S(), 'court:') < 3) {
    await say(dialogueConfig.courtroom.needClues);
    return;
  }
  const solved = await ui().openOverlay<boolean>({ type: 'court', mode: 'verdict' });
  if (!solved) return;
  const first = !S().flags.courtVerdict;
  store().setFlag('courtVerdict');
  await runCutscene('courtVerdict', { skippable: true }, async (c) => {
    game.companionScripted = true;
    audio.sfx('chime');
    await c.say(dialogueConfig.courtroom.verdictJudge);
    if (first) {
      c.shot([-34, 2.6, 8.5], [-40, 1.6, 6], 1.4);
      await c.story([...gameConfig.COURTROOM.completionLines], 'gold');
    }
    await companionBeside(c, 1, 1.2);
    twoShot(c);
    setCompanionEmote('heart', 3);
    await c.say(dialogueConfig.scenes.courtroomCongrats);
  });
  game.companionScripted = false;
  commandFollow(runtime.companion);
  if (first) await completeQuest('courtroom');
}

// ============================================================================
// CHILDREN'S WONDERLAND
// ============================================================================
async function talkMomo() {
  const f = S().flags;
  if (!f.momoTalked) {
    await say(dialogueConfig.children.momoIntro);
    store().setFlag('momoTalked');
    return;
  }
  if (f.toyFound && !f.toyReturned) {
    await runCutscene('momoReturn', { skippable: true, letterbox: false }, async (c) => {
      await c.say(dialogueConfig.children.momoReturn);
      store().setFlag('toyReturned');
      store().removeItem('momoToy');
      emitSparkle(31, 1, 35, '#ffd6f0', 50);
      audio.sfx('heart');
      await c.story([gameConfig.CHILDREN.completionMessage], 'soft');
      await companionBeside(c, 1, 1.2);
      await c.say(dialogueConfig.scenes.childrenComplete);
    });
    store().setFlag('toyReturned');
    if (S().inventory.momoToy) store().removeItem('momoToy');
    commandFollow(runtime.companion);
    await completeQuest('children');
    return;
  }
  if (f.toyReturned) return say(dialogueConfig.children.momoAfter);
  if (countCollected(S(), 'kids:') < 2) return say(dialogueConfig.children.momoNeedsClues);
  return say(dialogueConfig.children.momoWaiting);
}

async function kidsClue(id: 'clue_sandbox' | 'clue_swing' | 'clue_story') {
  audio.sfx('soft');
  await note(ST.noteTitles.clue, dialogueConfig.children[id], 'clue');
  if (store().collect(`kids:${id}`)) ui().toast(fmt(ST.toasts.clueFound, { count: Math.min(2, countCollected(S(), 'kids:')), total: 2 }), 'search');
}

async function searchTree() {
  if (countCollected(S(), 'kids:') < 2) {
    await note(ST.noteTitles.oldTree, dialogueConfig.children.tree_noClues, 'clue');
    return;
  }
  store().setFlag('toyFound');
  store().addItem('momoToy');
  audio.sfx('pickup');
  emitSparkle(24.2, 1.6, 42.8, '#fff1a8', 40);
  await note(ST.noteTitles.found, dialogueConfig.children.tree_found, 'clue');
  ui().showBark(ST.barks.toyFound);
}

// ============================================================================
// STORM — FINDING MY SHELTER
// ============================================================================
async function startStorm(firstTime: boolean) {
  if (game.stormSearching || S().flags.stormFound || questStatus(S(), 'storm') !== 'active') return;
  await runCutscene('stormStart', { skippable: true }, async (c) => {
    game.companionScripted = true;
    stormActive = true;
    const p = runtime.player;
    c.shot([p.x + 4, p.y + 3.4, p.z + 3], [p.x - 6, 3, p.z], 2.4);
    if (firstTime) {
      await c.wait(1800);
      await c.say(dialogueConfig.storm.brewing);
    }
    runtime.weather.fogTarget = 0.95;
    audio.sfx('thunder', 0.8);
    await c.wait(1500);
    const spot = LANDMARKS.stormCompanionSpot;
    commandGoto(runtime.companion, { x: spot.x, z: spot.z, yaw: dirToYaw(-31 - spot.x, 36 - spot.z) }, 0.4);
    await c.story(dialogueConfig.storm.separated.map(([, t]) => t), 'night');
    store().setFlag('stormStarted');
    await c.overlay({ type: 'banner', title: ST.banners.storm.title, subtitle: gameConfig.STORM.questPrompt, tone: 'night' });
  });
  store().setFlag('stormStarted');
  stormActive = true;
  runtime.weather.fogTarget = 0.45;
  game.stormSearching = true;
  game.companionScripted = true;
  const comp = runtime.companion;
  if (comp.mode !== 'goto' && comp.mode !== 'hold') {
    const spot = LANDMARKS.stormCompanionSpot;
    commandGoto(comp, { x: spot.x, z: spot.z, yaw: 0 }, 0.4);
  }
}

/** She left the forest before finding him — he hurries back to her. */
function abortStormSearch() {
  if (!game.stormSearching) return;
  game.stormSearching = false;
  game.companionScripted = false;
  stormActive = false;
  runtime.weather.fogTarget = 0;
  commandFollow(runtime.companion);
  ui().showBark(ST.barks.stormReunion);
}

async function stormClue(id: keyof typeof dialogueConfig.storm.clues) {
  audio.sfx('soft');
  await note(ST.noteTitles.clue, dialogueConfig.storm.clues[id], 'clue');
  store().collect(`storm:${id}`);
}

async function foundHim() {
  if (!game.stormSearching) return;
  game.stormSearching = false;
  await runCutscene('stormComfort', { skippable: true }, async (c) => {
    const comp = runtime.companion;
    playerFace(comp.x, comp.z);
    await companionBeside(c, 1, 0.95);
    playerFace(comp.x, comp.z);
    twoShot(c, 1.2);
    setCompanionEmote('heart', 4);
    await c.say(dialogueConfig.scenes.stormComfort);
    runtime.player.pose = 'hold';
    setPlayerEmote('heart', 4);
    audio.sfx('heart');
    // The storm calms gradually.
    stormActive = false;
    runtime.weather.fogTarget = 0;
    await c.wait(4200);
    runtime.weather.rainbowTarget = 1;
    audio.sfx('chime');
    const p = runtime.player;
    c.shot([p.x + 5, p.y + 2.2, p.z + 5], [p.x - 12, 9, p.z - 10], 2.5);
    await c.wait(2600);
    await c.story([gameConfig.STORM.finalMessage], 'soft');
    twoShot(c, 1.2);
    await c.say(dialogueConfig.scenes.stormAfter);
  });
  stormActive = false;
  runtime.player.pose = 'normal';
  runtime.weather.fogTarget = 0;
  store().setFlag('stormFound');
  game.companionScripted = false;
  commandFollow(runtime.companion);
  await completeQuest('storm');
}

let stormActive = false;

// ============================================================================
// FIREWORKS FINALE
// ============================================================================
async function announceHill() {
  await runCutscene('hillUnlock', { skippable: true, letterbox: false }, async (c) => {
    await c.wait(500);
    audio.sfx('gate');
    await c.say(dialogueConfig.scenes.hillUnlocked);
    await c.overlay({ type: 'banner', title: ST.banners.fireworksHill.title, subtitle: ST.banners.fireworksHill.subtitle, tone: 'night' });
  });
}

let fireworksSfxTimer: number | null = null;
function startFireworks(intensity = 1) {
  runtime.anim.fireworks = true;
  runtime.anim.fireworksIntensity = intensity;
  if (fireworksSfxTimer === null) {
    fireworksSfxTimer = window.setInterval(() => {
      if (runtime.anim.fireworks && Math.random() < 0.75) audio.sfx('firework', 0.6 + Math.random() * 0.4);
    }, 900);
  }
}
function stopFireworks() {
  runtime.anim.fireworks = false;
  if (fireworksSfxTimer !== null) {
    window.clearInterval(fireworksSfxTimer);
    fireworksSfxTimer = null;
  }
}

let finaleRunning = false;

async function finale() {
  if (finaleRunning || S().flags.finaleWatched || questStatus(S(), 'finale') !== 'active') return;
  finaleRunning = true;
  await runCutscene('finale', { skippable: true }, async (c) => {
    game.companionScripted = true;
    pinMusic('night');
    const top = LANDMARKS.hillTop;
    const p = runtime.player;
    p.yaw = Math.PI;
    commandGoto(runtime.companion, { x: p.x + 1.1, z: p.z + 0.2, yaw: Math.PI }, 0.3);
    runtime.weather.nightTarget = 1;
    const y = heightAt('overworld', top.x, top.z);
    c.shot([p.x + 3.5, y + 2.4, p.z + 4.5], [p.x, y + 1.4, p.z], 1.8);
    await c.until(() => runtime.companion.mode === 'hold', 6000);
    await c.say(dialogueConfig.scenes.finaleArrive);
    c.shot([p.x + 1.5, y + 3.6, p.z + 6.5], [0, 16, 36], 3.5);
    await c.story(gameConfig.FINAL_MESSAGE.intro.map(fill), 'night');
    startFireworks(1);
    c.shot([p.x - 2.5, y + 2.2, p.z + 3.4], [0, 22, 36], 4);
    await c.wait(6500);
    c.shot([p.x + 3.5, y + 1.8, p.z + 3], [0, 24, 34], 5);
    await c.wait(6000);
    c.shot([p.x + 0.5, y + 2.6, p.z + 2.8], [p.x - 1, y + 4, p.z - 20], 3);
    await c.overlay({ type: 'finalMessage' });
    store().setFlag('finaleWatched');
    store().setFlag('secretUnlocked');
    twoShot(c, 1.4);
    await c.say(dialogueConfig.scenes.finaleAfter);
    await c.say(dialogueConfig.scenes.secretUnlocked);
  });
  store().setFlag('finaleWatched');
  store().setFlag('secretUnlocked');
  runtime.anim.fireworksIntensity = 0.45;
  game.companionScripted = false;
  commandFollow(runtime.companion);
  pinMusic(null);
  finaleRunning = false;
  await completeQuest('finale');
}

async function replayFireworks() {
  ui().toast(ST.toasts.fireworksAgain, 'sparkles');
  startFireworks(1);
  runtime.weather.nightTarget = 1;
  window.setTimeout(() => {
    runtime.anim.fireworksIntensity = 0.45;
  }, 25000);
}

// ============================================================================
// SECRET ROOM
// ============================================================================
let secretRoomRunning = false;

async function enterSecretRoom() {
  if (secretRoomRunning) return;
  secretRoomRunning = true;
  try {
    if (!S().flags.secretEntered) {
      store().setFlag('secretEntered');
      await runCutscene('secretEnter', { skippable: true }, async (c) => {
        game.companionScripted = true;
        commandGoto(runtime.companion, { x: -13.4, z: -2.4, yaw: dirToYaw(runtime.player.x + 13.4, runtime.player.z + 2.4) }, 0.35);
        c.shot([-11.2, 2.6, 3.8], [-16, 1.2, -1], 1.8);
        await c.until(() => runtime.companion.mode === 'hold', 6000);
        await c.say(dialogueConfig.scenes.secretEnter);
      });
      game.companionScripted = false;
      commandFollow(runtime.companion);
    }
    // The birthday cake surprise (once; resumable after a reload via the cake itself).
    if (birthdayState(S()).revealPending) await revealCake();
  } finally {
    secretRoomRunning = false;
  }
}

// ============================================================================
// BIRTHDAY CAKE — reveal, wish, candles, celebration
// ============================================================================
const CAKE = { x: -18.3, z: 3.3 };
let birthdayFireworksUntil = -1;

async function revealCake() {
  if (!birthdayState(S()).revealPending) return;
  await runCutscene('cakeReveal', { skippable: true }, async (c) => {
    game.companionScripted = true;
    playerFace(CAKE.x, CAKE.z);
    commandGoto(runtime.companion, { x: -17.2, z: 4.35, yaw: dirToYaw(runtime.player.x + 17.2, runtime.player.z - 4.35) }, 0.35);
    c.shot([-14.3, 2.5, 0.8], [-18.2, 1.0, 3.3], 1.6);
    await c.until(() => runtime.companion.mode === 'hold', 6000);
    audio.sfx('magic');
    await c.tween(1.8, (t) => (runtime.anim.cakeReveal = t));
    store().setFlag('cakeRevealed');
    emitSparkle(CAKE.x, 1.6, CAKE.z, '#ffe3a3', 40, 'castle');
    setCompanionEmote('heart', 4);
    c.shot([-15.6, 1.9, 2.2], [-18.3, 1.25, 3.3], 1.4);
    await c.say(dialogueConfig.scenes.cakeReveal);
  });
  store().setFlag('cakeRevealed');
  runtime.anim.cakeReveal = 1;
  // He stays right beside her while she makes her wish.
  commandHold(runtime.companion, dirToYaw(runtime.player.x - runtime.companion.x, runtime.player.z - runtime.companion.z));
  await birthdayWish();
}

/** Opens the wish / candle overlay (accessible buttons on desktop and mobile). Never traps her. */
async function birthdayWish() {
  try {
    const st = birthdayState(S());
    if (st.revealPending) return revealCake();
    if (st.celebrated) {
      ui().showBark(pick(dialogueConfig.objects.cakeAfter));
      return;
    }
    game.companionScripted = true;
    const result = await ui().openOverlay<'wished' | 'blown' | undefined>({ type: 'birthday', startAt: st.canBlow ? 'blow' : 'message' });
    if (result === 'wished' || result === 'blown') makeBirthdayWish();
    if (result !== 'blown') {
      ui().toast(ST.toasts.cakeWaiting, 'cake');
      return;
    }
    if (blowOutCandles()) await celebrateCandles();
  } finally {
    game.companionScripted = false;
    commandFollow(runtime.companion);
  }
}

async function celebrateCandles() {
  audio.sfx('blow');
  birthdayFireworksUntil = runtime.time + 90;
  await runCutscene('candles', { skippable: true, letterbox: false }, async (c) => {
    game.companionScripted = true;
    c.shot([-15.6, 1.9, 2.2], [-18.3, 1.25, 3.3], 0.8);
    await c.wait(1400); // flames fade out (environmentFrame animates candlesOut)
    audio.sfx('quest');
    emitSparkle(CAKE.x, 1.8, CAKE.z, '#ffd27a', 50, 'castle');
    setPlayerEmote('sparkle', 3);
    setCompanionEmote('heart', 4);
    // Fireworks: seen through the Secret Room window now, and over the kingdom outside.
    startFireworks(1);
    c.shot([-16.2, 2.6, 2.4], [-20, 3.4, 0.5], 1.6);
    await c.wait(2600);
    twoShot(c, 1.2);
    await c.say(dialogueConfig.scenes.afterCandles);
  });
  game.companionScripted = false;
  ui().toast(fill(gameConfig.BIRTHDAY_CAKE.afterBlow), 'sparkles');
}

async function openFinalLetter() {
  audio.sfx('page');
  await ui().openOverlay({ type: 'letter', which: 'finalLetter' });
  if (S().flags.finalLetterRead) return;
  store().setFlag('finalLetterRead');
  if (!S().inventory.finalLetter) store().addItem('finalLetter');
  await completeQuest('secret');
  await runCutscene('ending', { skippable: true, letterbox: false }, async (c) => {
    await companionBeside(c, 1, 1.1);
    twoShot(c);
    setCompanionEmote('heart', 4);
    await c.say(dialogueConfig.scenes.afterFinalLetter);
  });
  commandFollow(runtime.companion);
  useGameStore.setState((s) => ({ stats: { ...s.stats, completedAt: s.stats.completedAt ?? Date.now() } }));
  store().setFlag('creditsSeen');
  await ui().openOverlay({ type: 'credits' });
}

// ============================================================================
// SARAH'S STRAWBERRY GARDEN (optional) & PICNIC
// ============================================================================
async function strawberryIntro() {
  const f = S().flags;
  if (f.strawberryIntro || !f.letterRead || activeCutscene()) return;
  store().setFlag('strawberryIntro');
  await runCutscene('strawberryIntro', { skippable: true, letterbox: false }, async (c) => {
    await companionBeside(c, 1, 1.2);
    await c.say(dialogueConfig.scenes.strawberryIntro);
  });
  commandFollow(runtime.companion);
  if (questStatus(S(), 'strawberries') === 'active') {
    ui().toast(fmt(ST.toasts.strawberryQuest, { total: STRAWBERRIES_REQUIRED, count: strawberriesPicked(S()) }), 'cherry');
  }
}

async function pickStrawberry(id: string) {
  const spot = STRAWBERRY_SPOTS.find((sp) => sp.id === id);
  const result = harvestStrawberry(id);
  if (result === 'duplicate') {
    ui().toast(ST.toasts.strawberryAlreadyPicked, 'cherry');
    return;
  }
  if (result !== 'collected' || !spot) return;
  audio.sfx('pickup');
  emitSparkle(spot.berry.x, 0.7, spot.berry.z, '#ff8a95', 18);
  const n = strawberriesPicked(S());
  ui().toast(fmt(ST.toasts.strawberryPicked, { count: Math.min(n, STRAWBERRIES_REQUIRED), total: STRAWBERRIES_REQUIRED }), 'cherry');
  if (n === 3) ui().showBark(pick(dialogueConfig.barks.strawberryGarden));
  if (n >= STRAWBERRIES_REQUIRED && !isQuestCompleted(S(), 'strawberries')) {
    await runCutscene('strawberryComplete', { skippable: true, letterbox: false }, async (c) => {
      await companionBeside(c, 1, 1.15);
      setCompanionEmote('heart', 3);
      await c.story([gameConfig.STRAWBERRY_GARDEN.completionMessage], 'soft');
      await c.say(dialogueConfig.scenes.strawberryComplete);
    });
    commandFollow(runtime.companion);
    await completeQuest('strawberries');
    ui().toast(fill(gameConfig.STRAWBERRY_GARDEN.picnicUnlockedToast), 'cherry');
  }
}

let picnicRunning = false;

async function picnic() {
  if (!picnicUnlocked(S())) {
    ui().toast(dialogueConfig.objects.picnicLocked, 'cherry');
    return;
  }
  if (picnicRunning) return;
  picnicRunning = true;
  const p = runtime.player;
  const comp = runtime.companion;
  const ps = STRAWBERRY_GARDEN.princessSeat;
  const bl = STRAWBERRY_GARDEN.blanket;
  pinMusic('letter');
  try {
    await runCutscene('picnic', { skippable: true, letterbox: false }, async (c) => {
      game.companionScripted = true;
      // She settles onto the blanket; he takes the cushion beside her.
      p.x = ps.x;
      p.z = ps.z;
      p.vx = p.vz = 0;
      p.yaw = dirToYaw(bl.x - ps.x, bl.z - ps.z);
      p.pose = 'sitGround';
      const seat = SEATS.find((st) => st.id === 'picnicHim');
      if (seat) commandSit(comp, seat);
      c.shot([47.6, 2.2, -14.2], [51.2, 0.6, -14.5], 1.6);
      await c.until(() => comp.sit > 0.8, 7000);
      setCompanionEmote('heart', 3);
      const lines = toDialogue(dialogueConfig.scenes.picnic);
      if (c.cancelled) return;
      const choice = await ui().showDialogue(lines, [
        { id: 'biggest', label: ST.picnicChoices.biggest },
        { id: 'share', label: ST.picnicChoices.share },
        { id: 'feed', label: ST.picnicChoices.feed },
      ]);
      if (choice === 'biggest') await c.say(dialogueConfig.scenes.picnicReplyBiggest);
      if (choice === 'share') await c.say(dialogueConfig.scenes.picnicReplyShare);
      if (choice === 'feed') await c.say(dialogueConfig.scenes.picnicReplyFeed);
      if (choice) setPlayerEmote('heart', 3);
      await c.say(dialogueConfig.scenes.picnicEnd);
    });
  } finally {
    // Never trap her: she stands up, he gets up and follows.
    p.pose = 'normal';
    game.companionScripted = false;
    commandFollow(comp);
    pinMusic(null);
    store().setFlag('picnicDone');
    picnicRunning = false;
  }
}

// ============================================================================
// TALK TO HIM
// ============================================================================
async function talkToHim() {
  const comp = runtime.companion;
  if (comp.mode === 'absent' || activeCutscene()) return;
  const wasSitting = comp.mode === 'sit';
  game.companionScripted = true;
  if (!wasSitting) commandHold(comp, dirToYaw(runtime.player.x - comp.x, runtime.player.z - comp.z));
  setCompanionEmote('heart', 1.5);
  const ctx = (): TalkContext => ({ location: ui().location as LocationId, save: S() });
  const t = dialogueConfig.talk;
  const choices = [
    { id: 'hint', label: t.choices.hint },
    { id: 'place', label: t.choices.place },
    { id: 'manja', label: t.choices.manja },
    { id: 'memory', label: t.choices.memory },
    { id: 'chat', label: t.choices.chat },
    { id: 'bye', label: t.choices.bye },
  ];
  try {
    const g = greeting(ctx());
    if (g.consumedReactions.length) store().consumeReactions();
    store().recordTalk('greeting');
    let lines = g.lines;
    for (let guard = 0; guard < 40; guard++) {
      lines.forEach((l) => store().recordLine(l.id));
      const choice = await ui().showDialogue(
        lines.map((l) => ({ speaker: 'him' as const, text: l.text, id: l.id })),
        choices,
      );
      if (!choice) return;
      store().recordTalk(choice);
      if (choice === 'bye') {
        const l = goodbyeLine(ctx());
        store().recordLine(l.id);
        await ui().showDialogue(him(l.text));
        return;
      }
      if (choice === 'chat') {
        ui().openPanel('chat');
        return;
      }
      if (choice === 'hint') lines = hintLines(ctx());
      else if (choice === 'place') lines = placeLines(ctx());
      else if (choice === 'manja') {
        lines = manjaLines(ctx());
        setCompanionEmote('heart', 2);
      } else if (choice === 'memory') {
        const m = memoryLines(ctx());
        if (m.advance) store().advanceMemoryCursor();
        lines = m.lines;
      }
    }
  } finally {
    game.companionScripted = false;
    if (!wasSitting) commandFollow(comp);
  }
}

// ============================================================================
// MAP / RESET
// ============================================================================
export async function fastTravel(id: keyof typeof TRAVEL_POINTS) {
  const to = TRAVEL_POINTS[id];
  if (!to) return;
  ui().closePanel();
  if (game.stormSearching) abortStormSearch();
  audio.sfx('magic');
  const entry = to.area === 'castle' ? DOORS.enterCastle.companionEntry : undefined;
  await game.transition(to, entry);
}

/** Stop everything a running story moment may have started. */
function haltStory() {
  skipCutscene();
  stopFireworks();
  pinMusic(null);
  stormActive = false;
  finaleRunning = false;
  birthdayFireworksUntil = -1;
  game.stormSearching = false;
  game.companionScripted = false;
}

/**
 * Replace the current progress with an imported / restored save. The current
 * progress is backed up first; the save is validated again; the Princess is
 * put back at its checkpoint with the companion beside her; and the game
 * returns to the title screen so she can continue cleanly.
 */
export function loadSaveIntoGame(data: SaveData, settings: unknown, reason: 'import' | 'restore') {
  haltStory();
  saveManager.backup(S(), `before-${reason}`);
  useGameStore.getState().hydrateFrom(data);
  if (settings) useSettings.getState().update(sanitizeSettings(settings));
  saveManager.flush();
  ui().closeAllOverlays();
  ui().endDialogue();
  ui().closePanel();
  game.restoreFromSave();
  runtime.camera.mode = 'showcase';
  ui().setScreen('title');
}

export function resetProgress() {
  haltStory();
  useGameStore.getState().resetProgress();
  saveManager.flush();
  game.resetRuntime({ area: 'overworld', x: LANDMARKS.spawn.x, z: LANDMARKS.spawn.z, yaw: LANDMARKS.spawn.yaw });
  ui().closeAllOverlays();
  ui().endDialogue();
  ui().closePanel();
  ui().setScreen('title');
}

// ============================================================================
// WORLD ENVIRONMENT (per frame): weather, time of day, animation targets
// ============================================================================
function environmentFrame(dt: number) {
  const s = S();
  const w = runtime.weather;
  const a = runtime.anim;
  const p = runtime.player;
  const loc = ui().location;
  const k = damp(1.6, dt);

  // Storm: only within the forest, fading with distance from its heart.
  if (stormActive && p.area === 'overworld') {
    const d = Math.hypot(p.x - LANDMARKS.stormCenter.x, p.z - LANDMARKS.stormCenter.z);
    w.stormTarget = Math.max(0, Math.min(1, (26 - d) / 10));
  } else {
    w.stormTarget = 0;
  }
  w.rainbowTarget = s.flags.stormFound ? (p.area === 'overworld' ? 0.85 : 0) : w.rainbowTarget > 0.5 ? 1 : 0;
  if (!finaleRunning) {
    w.nightTarget = s.flags.finaleWatched ? (loc === 'fireworks' ? 1 : p.area === 'overworld' ? 0.32 : 0.3) : 0;
    if (a.fireworks && runtime.time > birthdayFireworksUntil && loc !== 'fireworks' && p.area === 'overworld' && Math.hypot(p.x, p.z - 60) > 30) stopFireworks();
  }

  // Animation targets that persist across reloads.
  if (!a.crownFlightActive) a.crownFlight = s.flags.crownAccepted ? 1 : 0;
  if (!activeCutscene()) {
    a.coronationBloom += ((s.flags.crownAccepted ? 1 : 0) - a.coronationBloom) * k;
    a.bouquetLift += ((s.flags.bouquetReceived ? 1 : 0) - a.bouquetLift) * k;
    a.archGlow += ((s.flags.castleRevealed ? 1 : 0) - a.archGlow) * k;
    a.cakeReveal += ((s.flags.cakeRevealed ? 1 : 0) - a.cakeReveal) * k;
  }
  a.candlesOut += ((s.flags.candlesBlown ? 1 : 0) - a.candlesOut) * damp(1.6, dt);
  a.windowFireworks = runtime.time < birthdayFireworksUntil;
  a.castleGate += ((s.flags.castleRevealed ? 1 : 0) - a.castleGate) * damp(0.9, dt);
  a.secretDoor += ((s.flags.secretUnlocked ? 1 : 0) - a.secretDoor) * damp(1.2, dt);
  for (const plot of PLANT_PLOTS) {
    const st = (a.plots[plot.id] ??= { growth: 0, bloom: 0 });
    st.growth += ((s.collected[`plant:${plot.id}`] !== undefined ? 1 : 0) - st.growth) * damp(2, dt);
    st.bloom += ((s.collected[`bloom:${plot.id}`] !== undefined ? 1 : 0) - st.bloom) * damp(1.4, dt);
  }
  a.ballKick = Math.max(0, a.ballKick - dt * 0.6);

  sweepTimer -= dt;
  if (sweepTimer <= 0) {
    sweepTimer = 1;
    void sweepPendingQuests();
  }
}
let sweepTimer = 1;

// ============================================================================
// INTERACTION REGISTRATION
// ============================================================================
let registered = false;

export function initStory() {
  if (registered) return;
  registered = true;
  const reg = (id: string, def: InteractionDef) => registerInteraction(id, def);
  const f = () => S().flags;

  reg('crown', { label: () => A.crown, available: () => !f().crownAccepted && !!f().gameStarted, marker: () => 'quest', run: coronation });
  reg('bouquet', { label: () => A.bouquet, available: () => !!f().crownAccepted && !f().bouquetReceived, marker: () => 'quest', run: receiveBouquet });
  reg('castleDoor', {
    label: () => A.enterCastle,
    available: () => !!f().castleRevealed,
    marker: () => (!f().castleEntered ? 'quest' : null),
    run: enterCastle,
  });
  reg('castleExit', { label: () => A.exitCastle, available: () => true, run: exitCastle });
  reg('envelope', {
    label: () => (f().letterRead ? A.rereadLetter : A.openLetter),
    available: () => !!f().castleEntered,
    marker: () => (!f().letterRead ? 'quest' : null),
    run: openLoveLetter,
  });

  // Garden
  const gardenOpen = () => !!f().letterRead;
  for (const fl of FLOWER_SPOTS) {
    reg(fl.id, {
      label: () => fmt(A.pickFlower, { flower: FLOWER_NAMES[fl.type]?.toLowerCase() ?? ST.flowerFallback.toLowerCase() }),
      available: () => gardenOpen() && S().collected[`flower:${fl.id}`] === undefined,
      marker: () => 'collectible',
      run: () => pickFlower(fl.id, fl.type),
    });
  }
  reg('seedBasket', {
    label: () => (f().hasSeeds ? A.seedBasketEmpty : A.takeSeeds),
    available: gardenOpen,
    marker: () => (!f().hasSeeds ? 'item' : null),
    run: () => {
      if (f().hasSeeds) return ui().toast(dialogueConfig.objects.seedsAlready, 'sprout');
      store().setFlag('hasSeeds');
      store().addItem('seeds', 3);
      audio.sfx('pickup');
      ui().toast(dialogueConfig.objects.seedsGet, 'sprout');
    },
  });
  reg('wateringCan', {
    label: () => A.takeWateringCan,
    available: () => gardenOpen() && !f().hasWateringCan,
    marker: () => 'item',
    run: () => {
      store().setFlag('hasWateringCan');
      store().addItem('wateringCan');
      audio.sfx('water');
      ui().toast(dialogueConfig.objects.canGet, 'droplets');
    },
  });
  PLANT_PLOTS.forEach((plot, i) =>
    reg(plot.id, {
      label: () => (S().collected[`plant:${plot.id}`] === undefined ? A.plantSeed : A.waterSeed),
      available: () => gardenOpen() && S().collected[`bloom:${plot.id}`] === undefined,
      marker: () => (f().hasSeeds ? 'item' : null),
      run: () => plotAction(plot.id, i),
    }),
  );
  reg('wishFountain', {
    label: () => A.wishFountain,
    available: gardenOpen,
    run: () => {
      audio.sfx('chime');
      emitSparkle(36, 1.6, 6, '#cfe8ff', 30);
      ui().showBark(pick(dialogueConfig.objects.wishFountain));
    },
  });
  for (const n of gameConfig.GARDEN.hiddenNotes) {
    reg(n.id, {
      label: () => A.hiddenNote,
      available: () => gardenOpen() && S().collected[`note:${n.id}`] === undefined,
      marker: () => 'collectible',
      run: async () => {
        audio.sfx('page');
        store().collect(`note:${n.id}`);
        await note(n.title, n.text, 'note');
      },
    });
  }

  // Mirror room
  const worldOpen = () => !!f().letterRead;
  reg('mirror', { label: () => A.mirror, available: worldOpen, marker: () => (!f().mirrorAnswered ? 'quest' : null), run: askMirror });
  reg('vanity', {
    label: () => A.vanity,
    available: worldOpen,
    run: () => {
      audio.sfx('open');
      ui().openPanel('wardrobe');
    },
  });
  reg('lipstick', { label: () => A.lipstick, available: worldOpen, run: () => void say(him(pick(dialogueConfig.objects.lipstick))) });
  reg('perfume', { label: () => A.perfume, available: worldOpen, run: () => void say(him(pick(dialogueConfig.objects.perfume))) });

  // Library
  (['book1', 'book2', 'book3', 'book4'] as const).forEach((b) =>
    reg(b, {
      label: () => {
        const book = gameConfig.CUSTOM_BOOK_MESSAGES.find((x) => x.id === b)!;
        return fmt(A.readBook, { title: book.title });
      },
      available: worldOpen,
      marker: () => (S().collected[`book:${b}`] === undefined ? 'quest' : null),
      run: () => readBook(b),
    }),
  );

  // Courtroom
  (['clue_footprints', 'clue_witness', 'clue_log'] as const).forEach((id) =>
    reg(id, {
      label: () => fmt(A.inspectEvidence, { title: dialogueConfig.courtroom.clues[id].title }),
      available: worldOpen,
      marker: () => (S().collected[`court:${id}`] === undefined ? 'quest' : null),
      run: () => examineClue(id),
    }),
  );
  reg('verdict', {
    label: () => (f().courtVerdict ? A.retrial : A.verdict),
    available: worldOpen,
    marker: () => (!f().courtVerdict && countCollected(S(), 'court:') >= 3 ? 'quest' : null),
    run: verdict,
  });

  // Children's Wonderland
  reg('momo', {
    label: () => (f().toyFound && !f().toyReturned ? A.returnToy : A.talkMomo),
    available: worldOpen,
    marker: () => (!f().momoTalked || (f().toyFound && !f().toyReturned) ? 'quest' : null),
    run: talkMomo,
  });
  (['clue_sandbox', 'clue_swing', 'clue_story'] as const).forEach((id) =>
    reg(id, {
      label: () => (id === 'clue_sandbox' ? A.sandbox : id === 'clue_swing' ? A.swing : A.storyBunny),
      available: () => worldOpen() && !!f().momoTalked,
      marker: () => (S().collected[`kids:${id}`] === undefined && !f().toyFound ? 'quest' : null),
      run: () => kidsClue(id),
    }),
  );
  reg('toyTree', {
    label: () => A.oldTree,
    available: () => worldOpen() && !!f().momoTalked && !f().toyFound,
    marker: () => (countCollected(S(), 'kids:') >= 2 ? 'quest' : null),
    run: searchTree,
  });
  reg('ball', {
    label: () => A.ball,
    available: worldOpen,
    run: () => {
      runtime.anim.ballKick = 1;
      runtime.anim.ballDir = runtime.player.yaw;
      audio.sfx('soft');
      ui().toast(pick(dialogueConfig.children.ball), 'smile');
    },
  });
  reg('xylophone', {
    label: () => A.xylophone,
    available: worldOpen,
    run: () => {
      [0, 180, 360, 540].forEach((ms) => window.setTimeout(() => audio.sfx('note'), ms));
      setCompanionEmote('note', 2.5);
      ui().toast(pick(dialogueConfig.children.xylophone), 'music');
    },
  });

  // Storm clues
  (['storm_umbrella', 'storm_lantern', 'storm_shelter', 'storm_crystal'] as const).forEach((id) =>
    reg(id, {
      label: () => (id === 'storm_umbrella' ? A.umbrella : id === 'storm_lantern' ? A.lantern : id === 'storm_shelter' ? A.shelter : A.crystal),
      available: () => !!f().stormStarted && !f().stormFound && game.stormSearching,
      marker: () => (S().collected[`storm:${id}`] === undefined ? 'item' : null),
      run: () => stormClue(id),
    }),
  );

  // Hill lookout (after the finale)
  reg('lookout', { label: () => A.fireworksAgain, available: () => !!f().finaleWatched, run: replayFireworks });

  // Memory stars
  for (const star of MEMORY_STARS) {
    reg(star.id, {
      label: () => A.memoryStar,
      available: () => !!f().crownAccepted && S().collected[`star:${star.id}`] === undefined,
      marker: () => 'collectible',
      run: async () => {
        store().collect(`star:${star.id}`);
        audio.sfx('chime');
        emitSparkle(star.x, 1.4, star.z, '#fff2b0', 30);
        const mem = gameConfig.SHARED_MEMORIES.find((m) => m.id === star.memory);
        if (mem) await note(mem.title, mem.text, 'memory');
        ui().toast(fmt(ST.toasts.memoryStar, { count: countCollected(S(), 'star:'), total: MEMORY_STARS.length }), 'star');
      },
    });
  }

  // Castle interior extras
  reg('throne', {
    label: () => A.throne,
    available: () => true,
    run: () => {
      runtime.player.pose = 'sit';
      runtime.player.x = 0;
      runtime.player.z = -6.0;
      runtime.player.yaw = 0;
      setPlayerEmote('sparkle', 2);
      void say(him(pick(dialogueConfig.objects.throne))).then(() => {
        runtime.player.pose = 'normal';
        runtime.player.z = -5.4;
      });
    },
  });
  reg('musicBox', {
    label: () => A.musicBox,
    available: () => true,
    run: () => {
      [0, 300, 600, 900, 1200].forEach((ms) => window.setTimeout(() => audio.sfx('note'), ms));
      setCompanionEmote('note', 3);
      ui().showBark(pick(dialogueConfig.objects.musicBox));
    },
  });
  reg('vase', {
    label: () => A.vase,
    available: () => !!f().bouquetPlaced,
    run: () => ui().showBark(pick(dialogueConfig.objects.vase)),
  });
  reg('secretDoor', {
    label: () => A.secretDoor,
    available: () => !f().secretUnlocked,
    run: () => void note(ST.noteTitles.secretDoor, dialogueConfig.objects.secretDoorLocked, 'clue'),
  });
  reg('finalLetter', {
    label: () => (f().finalLetterRead ? A.rereadFinalLetter : A.openFinalLetter),
    // The letter waits until after the candles (saves that already read it keep it).
    available: () => birthdayState(S()).finalLetterAvailable,
    marker: () => (!f().finalLetterRead ? 'quest' : null),
    run: openFinalLetter,
  });
  reg('secretGift', {
    label: () => A.openGift,
    available: () => !!f().secretUnlocked,
    marker: () => (!f().giftOpened ? 'item' : null),
    run: async () => {
      audio.sfx('magic');
      emitSparkle(-18.6, 1.4, -3.8, '#ffd1e3', 40, 'castle');
      await ui().openOverlay({ type: 'gift' });
      store().setFlag('giftOpened');
    },
  });

  reg('cake', {
    label: () => {
      const b = birthdayState(S());
      if (b.revealPending) return A.cakeSurprise;
      if (b.celebrated) return A.cake;
      return b.canBlow ? fill(gameConfig.BIRTHDAY_CAKE.blowButton) : fill(gameConfig.BIRTHDAY_CAKE.wishButton);
    },
    available: () => birthdayState(S()).cakeVisible,
    marker: () => (!birthdayState(S()).celebrated ? 'quest' : null),
    run: async () => {
      if (birthdayState(S()).revealPending) {
        game.companionScripted = false;
        await revealCake();
      } else await birthdayWish();
    },
  });

  // Sarah's Strawberry Garden
  for (const sp of STRAWBERRY_SPOTS) {
    reg(sp.id, {
      label: () => A.pickStrawberry,
      available: () => !!f().letterRead && S().collected[`berry:${sp.id}`] === undefined,
      marker: () => 'item',
      run: () => pickStrawberry(sp.id),
    });
  }
  reg('picnic', {
    label: () => (picnicUnlocked(S()) ? (f().picnicDone ? A.picnicAgain : A.picnic) : A.gazebo),
    available: () => !!f().letterRead,
    marker: () => (picnicUnlocked(S()) && !f().picnicDone ? 'quest' : null),
    run: picnic,
  });

  registerTalkHandler(talkToHim);

  // Location / trigger reactions
  on('enterLocation', ({ id, firstVisit }) => {
    const flags = S().flags;
    if (game.stormSearching && id !== 'storm') abortStormSearch();
    if (id === 'secretRoom' && flags.secretUnlocked) void enterSecretRoom();
    if (id === 'strawberryGarden' && flags.letterRead && !flags.strawberryIntro) {
      void strawberryIntro();
      return;
    }
    if (id === 'courtroom' && flags.letterRead && !flags.courtVerdict && !judgeIntroShown) {
      judgeIntroShown = true;
      void say(dialogueConfig.courtroom.judgeIntro);
      return;
    }
    if (firstVisit && flags.crownAccepted) {
      const line = (dialogueConfig.arrivals as Partial<Record<LocationId, string>>)[id];
      if (line && id !== 'storm') window.setTimeout(() => ui().showBark(fill(line)), 700);
    }
  });
  on('areaChanged', () => {
    if (game.stormSearching) abortStormSearch();
  });
  on('trigger', ({ id }) => {
    if (id === 'storm') void startStorm(!S().flags.stormStarted);
    if (id === 'hilltop') void finale();
    if (id === 'stormCompanion') void foundHim();
  });

  game.onFrame(environmentFrame);
}

/** Debug / QA helpers exposed on window in development and e2e runs. */
export const storyDebug = {
  coronation,
  receiveBouquet,
  enterCastle,
  exitCastle,
  openLoveLetter,
  askMirror,
  readBook,
  verdict,
  foundHim,
  finale,
  openFinalLetter,
  completeQuest,
  strawberryIntro,
  pickStrawberry,
  picnic,
  revealCake,
  birthdayWish,
  items: ITEMS,
};
