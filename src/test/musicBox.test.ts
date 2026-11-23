/// <reference types="node" />
/**
 * Music Box song ("Jatuh Suka"): play / pause / resume, plays only in the
 * Grand Hall, ducks the castle theme only while playing, and the file is a
 * real MP3 (works on iPhone, Android and desktop).
 */
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gameConfig } from '../config/gameConfig';
import { personalContent } from '../config/personalContent';
import { createMusicBox, type MediaLike, type MusicBoxContext } from '../systems/AudioManager/musicBoxPlayer';
import { getInteraction } from '../systems/Interaction/registry';
import { SPOT_BY_ID } from '../systems/WorldManager/worldLayout';

class FakeAudio implements MediaLike {
  src = '';
  preload = '';
  currentTime = 0;
  plays = 0;
  pauses = 0;
  playResult: 'ok' | 'notAllowed' | 'fail' = 'ok';
  private handlers = new Map<string, Array<() => void>>();
  addEventListener(type: string, fn: () => void) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), fn]);
  }
  emit(type: string) {
    this.handlers.get(type)?.forEach((h) => h());
  }
  play() {
    this.plays++;
    if (this.playResult === 'notAllowed') return Promise.reject(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
    if (this.playResult === 'fail') return Promise.reject(Object.assign(new Error('decode'), { name: 'NotSupportedError' }));
    queueMicrotask(() => this.emit('playing'));
    return Promise.resolve();
  }
  pause() {
    this.pauses++;
    this.emit('pause');
  }
}

function setup() {
  const el = new FakeAudio();
  const ducks: boolean[] = [];
  let created = 0;
  let attached = 0;
  const box = createMusicBox({
    src: '/game-for-bday-sarah/audio/jatuh-suka.mp3',
    createElement: () => (created++, el),
    attach: () => (attached++, true),
    duck: (on) => ducks.push(on),
  });
  return { el, box, ducks, counts: () => ({ created, attached }) };
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const hall: MusicBoxContext = { screen: 'playing', location: 'castleHall', area: 'castle', hidden: false };

describe('Music Box song', () => {
  it('downloads nothing until Sarah uses the Music Box', () => {
    const { box, counts } = setup();
    expect(box.getState()).toBe('idle');
    expect(counts()).toEqual({ created: 0, attached: 0 });
  });

  it('plays on interaction, pauses on the next one, and resumes from the same position', async () => {
    const { el, box } = setup();
    box.toggle();
    expect(el.src).toBe('/game-for-bday-sarah/audio/jatuh-suka.mp3');
    expect(el.plays).toBe(1);
    await tick();
    expect(box.getState()).toBe('playing');

    el.currentTime = 42;
    box.toggle();
    expect(box.getState()).toBe('paused');
    expect(el.pauses).toBe(1);

    box.toggle();
    await tick();
    expect(box.getState()).toBe('playing');
    expect(el.currentTime).toBe(42); // resumed, not restarted
  });

  it('routes through the game music volume once, and lowers the castle theme only while playing', async () => {
    const { box, ducks, counts } = setup();
    box.toggle();
    await tick();
    box.toggle();
    box.toggle();
    await tick();
    expect(counts()).toEqual({ created: 1, attached: 1 });
    expect(ducks).toEqual([true, false, true]);
  });

  it('returns to the start when the song ends', async () => {
    const { el, box, ducks } = setup();
    box.toggle();
    await tick();
    el.currentTime = 237;
    el.emit('ended');
    expect(box.getState()).toBe('idle');
    expect(el.currentTime).toBe(0);
    expect(ducks[ducks.length - 1]).toBe(false);
  });

  it('pauses automatically outside the Grand Hall, off the game screen or in a hidden tab', async () => {
    for (const leave of [
      { ...hall, location: 'bedroom' },
      { ...hall, location: 'secretRoom' },
      { ...hall, area: 'overworld', location: 'castleGrounds' },
      { ...hall, screen: 'title' },
      { ...hall, hidden: true },
    ]) {
      const { box } = setup();
      box.toggle();
      await tick();
      box.enforce(hall);
      expect(box.getState()).toBe('playing');
      box.enforce(leave);
      expect(box.getState()).toBe('paused');
    }
  });

  it('never starts by itself (only the Music Box starts it)', async () => {
    const { box, el } = setup();
    box.enforce(hall);
    box.enforce({ ...hall, location: 'garden', area: 'overworld' });
    await tick();
    expect(el.plays).toBe(0);
    expect(box.getState()).toBe('idle');
  });

  it('handles a blocked or failed play, and retries on the next press', async () => {
    const blocked = setup();
    blocked.el.playResult = 'notAllowed';
    blocked.box.toggle();
    await tick();
    expect(blocked.box.getState()).toBe('paused');

    const failed = setup();
    failed.el.playResult = 'fail';
    failed.box.toggle();
    await tick();
    expect(failed.box.getState()).toBe('error');
    expect(failed.ducks[failed.ducks.length - 1]).toBe(false);
    failed.el.playResult = 'ok';
    failed.el.src = '';
    failed.box.toggle();
    await tick();
    expect(failed.el.src).toBe('/game-for-bday-sarah/audio/jatuh-suka.mp3');
    expect(failed.box.getState()).toBe('playing');
  });
});

describe('Music Box in the game', () => {
  it('the Music Box is in the castle Grand Hall, next to the throne', () => {
    const spot = SPOT_BY_ID.musicBox;
    expect(spot.area).toBe('castle');
    expect(Math.abs(spot.x) <= 10.2 && Math.abs(spot.z) <= 8.5).toBe(true); // castleHall zone
  });

  it('its prompt reads play → pause → resume', async () => {
    const { initStory } = await import('../systems/Story/story');
    initStory();
    const def = getInteraction('musicBox')!;
    expect(def).toBeDefined();
    expect(def.label({} as never)).toBe(personalContent.story.actions.musicBox);
    expect(personalContent.story.actions.musicBoxPause).toBe('Jeda lagu');
    expect(personalContent.story.actions.musicBoxResume).toBe('Sambung lagu');
  });

  it('the song file is a real MP3 that phones can play', () => {
    const file = join(__dirname, '..', '..', 'public', gameConfig.MUSIC_BOX.file);
    expect(gameConfig.MUSIC_BOX.file).toBe('audio/jatuh-suka.mp3');
    const head = readFileSync(file).subarray(0, 4);
    const isId3 = head.subarray(0, 3).toString('latin1') === 'ID3';
    const isFrameSync = head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
    expect(isId3 || isFrameSync).toBe(true);
    expect(head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))).toBe(false); // not WebM/Matroska
    expect(statSync(file).size).toBeLessThan(6_000_000);
  });
});
