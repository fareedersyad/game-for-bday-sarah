/**
 * PROCEDURAL AUDIO ENGINE
 *
 * All music, ambience and sound effects are synthesised live with the Web
 * Audio API — 100% original, no licensing concerns, no files to download, and
 * no broken asset paths on GitHub Pages.
 *
 * Browser autoplay rules: nothing is created until `unlock()` is called from
 * a user gesture (the "Enter Your Kingdom" button or the first tap).
 *
 * Bus graph:
 *   themes ─> themeBus (ducked while the Music Box song plays) ─┐
 *   Music Box song (<audio>) ──────────────────────────────────> music ─┐
 *   sfx ───┼─> master ─> destination
 *   ambience ─> sfx
 *   thunder ──> sfx
 *   (reverb send from music + sfx)
 */

export type MusicTheme = 'none' | 'title' | 'kingdom' | 'castle' | 'storm' | 'night' | 'letter' | 'secret';
export type SfxName =
  | 'ui'
  | 'open'
  | 'close'
  | 'magic'
  | 'chime'
  | 'pickup'
  | 'crown'
  | 'bloom'
  | 'gate'
  | 'page'
  | 'thunder'
  | 'firework'
  | 'quest'
  | 'water'
  | 'heart'
  | 'soft'
  | 'note'
  | 'blow';

export interface AudioLevels {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  thunderEnabled: boolean;
  thunderVolume: number;
}

export interface AmbienceLevels {
  birds: number;
  wind: number;
  fountain: number;
  rain: number;
}

interface ThemeDef {
  bpm: number;
  /** MIDI note chords, one per bar. */
  chords: number[][];
  bass: boolean;
  arp: 'eighths' | 'sparse' | 'none' | 'waltz';
  melody: number; // probability of a melody note per beat
  padGain: number;
  boxGain: number;
  padCutoff: number;
}

const THEMES: Record<Exclude<MusicTheme, 'none'>, ThemeDef> = {
  title: { bpm: 64, chords: [[65, 69, 72, 76], [62, 65, 69, 72], [58, 62, 65, 69], [60, 64, 67, 72]], bass: true, arp: 'sparse', melody: 0.25, padGain: 0.1, boxGain: 0.09, padCutoff: 1100 },
  kingdom: { bpm: 78, chords: [[65, 69, 72, 76], [62, 65, 69, 72], [58, 62, 65, 69], [60, 64, 67, 70]], bass: true, arp: 'eighths', melody: 0.35, padGain: 0.075, boxGain: 0.07, padCutoff: 1300 },
  castle: { bpm: 68, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 67]], bass: true, arp: 'waltz', melody: 0.3, padGain: 0.08, boxGain: 0.08, padCutoff: 1200 },
  storm: { bpm: 56, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55, 60], [52, 55, 59]], bass: true, arp: 'none', melody: 0.12, padGain: 0.1, boxGain: 0.05, padCutoff: 700 },
  night: { bpm: 70, chords: [[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 69]], bass: true, arp: 'eighths', melody: 0.45, padGain: 0.085, boxGain: 0.08, padCutoff: 1500 },
  letter: { bpm: 60, chords: [[55, 59, 62, 66], [52, 55, 59, 62], [48, 52, 55, 59], [50, 54, 57, 62]], bass: false, arp: 'sparse', melody: 0.2, padGain: 0.08, boxGain: 0.085, padCutoff: 1000 },
  secret: { bpm: 58, chords: [[64, 68, 71, 75], [61, 64, 68, 71], [57, 61, 64, 68], [59, 63, 66, 71]], bass: true, arp: 'sparse', melody: 0.3, padGain: 0.085, boxGain: 0.08, padCutoff: 1100 },
};

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  /** All procedural themes pass through here, so they can be lowered while the Music Box song plays. */
  private themeBus!: GainNode;
  private mediaSources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
  private sfxBus!: GainNode;
  private ambienceBus!: GainNode;
  private thunderBus!: GainNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private noise!: AudioBuffer;
  private levels: AudioLevels = { masterVolume: 0.8, musicVolume: 0.6, sfxVolume: 0.8, muted: false, thunderEnabled: true, thunderVolume: 0.5 };
  private amb: Record<keyof AmbienceLevels, { gain: GainNode; level: number }> | null = null;
  private birdTimer: number | null = null;
  private schedulerTimer: number | null = null;
  private theme: MusicTheme = 'none';
  private themeGain: GainNode | null = null;
  private nextBarTime = 0;
  private barIndex = 0;
  private suspendedByVisibility = false;
  unlocked = false;

  /** Must be called from a user gesture (click / tap / key). Safe to call repeatedly. */
  unlock() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.ctx) {
        const Ctor: typeof AudioContext | undefined =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor({ latencyHint: 'interactive' });
        this.build();
        document.addEventListener('visibilitychange', this.onVisibility);
        // Start whatever theme was requested before audio was unlocked.
        const pending = this.theme;
        this.theme = 'none';
        this.setMusic(pending);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      // iOS: play a silent buffer inside the gesture to fully unlock output.
      const b = this.ctx.createBuffer(1, 1, 22050);
      const s = this.ctx.createBufferSource();
      s.buffer = b;
      s.connect(this.ctx.destination);
      s.start(0);
      this.unlocked = true;
    } catch {
      this.unlocked = false;
    }
  }

  private onVisibility = () => {
    if (!this.ctx) return;
    if (document.hidden) {
      if (this.ctx.state === 'running') {
        void this.ctx.suspend();
        this.suspendedByVisibility = true;
      }
    } else if (this.suspendedByVisibility) {
      void this.ctx.resume();
      this.suspendedByVisibility = false;
    }
  };

  private build() {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.ambienceBus = ctx.createGain();
    this.thunderBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.themeBus = ctx.createGain();
    this.themeBus.connect(this.musicBus);
    const themeSend = ctx.createGain();
    themeSend.gain.value = 0.6;
    this.themeBus.connect(themeSend);
    this.sfxBus.connect(this.master);
    this.ambienceBus.connect(this.sfxBus);
    this.thunderBus.connect(this.sfxBus);

    // Reverb: synthetic decaying-noise impulse response.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(3.2, 2.6);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.55;
    this.reverbSend.connect(this.reverb);
    themeSend.connect(this.reverbSend);
    this.reverb.connect(this.master);

    // Shared white-noise buffer (2 s, looped).
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.buildAmbience();
    this.applyLevels(this.levels);
  }

  private makeImpulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private noiseSource() {
    const s = this.ctx!.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    return s;
  }

  private buildAmbience() {
    const ctx = this.ctx!;
    const mk = (configure: (src: AudioBufferSourceNode, out: GainNode) => void) => {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(this.ambienceBus);
      const src = this.noiseSource();
      configure(src, gain);
      src.start();
      return { gain, level: 0 };
    };
    const rain = mk((src, out) => {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 900;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 7000;
      src.connect(hp).connect(lp).connect(out);
    });
    const wind = mk((src, out) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 420;
      bp.Q.value = 0.8;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.09;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain).connect(bp.frequency);
      lfo.start();
      src.connect(bp).connect(out);
    });
    const fountain = mk((src, out) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2100;
      bp.Q.value = 0.9;
      const trem = ctx.createGain();
      trem.gain.value = 0.75;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.3;
      const lfoG = ctx.createGain();
      lfoG.gain.value = 0.22;
      lfo.connect(lfoG).connect(trem.gain);
      lfo.start();
      src.connect(bp).connect(trem).connect(out);
    });
    const birds = { gain: ctx.createGain(), level: 0 };
    birds.gain.gain.value = 1;
    birds.gain.connect(this.ambienceBus);
    this.amb = { rain, wind, fountain, birds };
    if (this.birdTimer === null) this.birdTimer = window.setInterval(() => this.maybeChirp(), 900);
  }

  private maybeChirp() {
    if (!this.ctx || !this.amb || this.ctx.state !== 'running') return;
    const level = this.amb.birds.level;
    if (level < 0.05 || Math.random() > 0.45 * level + 0.1) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + Math.random() * 0.4;
    const n = 2 + Math.floor(Math.random() * 4);
    const base = 2600 + Math.random() * 1800;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) {
      pan.pan.value = Math.random() * 1.6 - 0.8;
      pan.connect(this.amb.birds.gain);
    }
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.09 + Math.random() * 0.05);
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.4), t + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * 0.9, t + 0.08);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05 * level, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
      o.connect(g).connect(pan ?? this.amb.birds.gain);
      o.start(t);
      o.stop(t + 0.1);
    }
  }

  applyLevels(l: AudioLevels) {
    this.levels = l;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(l.muted ? 0 : l.masterVolume, t, 0.05);
    this.musicBus.gain.setTargetAtTime(l.musicVolume * 0.9, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(l.sfxVolume, t, 0.05);
    this.thunderBus.gain.setTargetAtTime(l.thunderEnabled ? l.thunderVolume : 0, t, 0.05);
  }

  setAmbience(levels: Partial<AmbienceLevels>) {
    if (!this.ctx || !this.amb) return;
    const t = this.ctx.currentTime;
    const scale: Record<keyof AmbienceLevels, number> = { rain: 0.32, wind: 0.22, fountain: 0.08, birds: 1 };
    (Object.keys(levels) as (keyof AmbienceLevels)[]).forEach((k) => {
      const v = Math.max(0, Math.min(1, levels[k] ?? 0));
      const ch = this.amb![k];
      if (Math.abs(ch.level - v) < 0.01) return;
      ch.level = v;
      if (k !== 'birds') ch.gain.gain.setTargetAtTime(v * scale[k], t, 0.6);
    });
  }

  // ------------------------------------------------------------------ music
  setMusic(theme: MusicTheme) {
    if (theme === this.theme) return;
    this.theme = theme;
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    if (this.themeGain) {
      const old = this.themeGain;
      old.gain.cancelScheduledValues(t);
      old.gain.setValueAtTime(old.gain.value, t);
      old.gain.linearRampToValueAtTime(0, t + 2.2);
      window.setTimeout(() => old.disconnect(), 2600);
      this.themeGain = null;
    }
    if (this.schedulerTimer !== null) {
      window.clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (theme === 'none') return;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 2.5);
    // themeBus → music bus, plus a 0.6 reverb send (same mix as before).
    g.connect(this.themeBus);
    this.themeGain = g;
    this.nextBarTime = t + 0.15;
    this.barIndex = 0;
    this.schedulerTimer = window.setInterval(() => this.schedule(), 80);
    this.schedule();
  }

  private schedule() {
    if (!this.ctx || !this.themeGain || this.theme === 'none') return;
    const def = THEMES[this.theme as Exclude<MusicTheme, 'none'>];
    const beat = 60 / def.bpm;
    const bar = beat * 4;
    while (this.nextBarTime < this.ctx.currentTime + 0.6) {
      this.scheduleBar(def, this.nextBarTime, beat, bar, this.themeGain);
      this.nextBarTime += bar;
      this.barIndex++;
    }
  }

  private scheduleBar(def: ThemeDef, t: number, beat: number, bar: number, out: GainNode) {
    const chord = def.chords[this.barIndex % def.chords.length];
    // Pad
    chord.forEach((n) => this.pad(mtof(n - 12), t, bar * 1.05, def.padGain / chord.length, def.padCutoff, out));
    if (def.bass) this.bass(mtof(chord[0] - 24), t, bar, out);
    // Arpeggio / music box
    const pattern: number[] =
      def.arp === 'eighths' ? [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5] : def.arp === 'waltz' ? [0, 1, 2, 3] : def.arp === 'sparse' ? [0, 1.5, 3] : [];
    pattern.forEach((b, i) => {
      const n = chord[i % chord.length] + (i >= chord.length ? 12 : 0);
      this.musicBox(mtof(n), t + b * beat, def.boxGain * (i === 0 ? 1 : 0.75), out);
    });
    // Gentle generative melody
    for (let b = 0; b < 4; b++) {
      if (Math.random() < def.melody) {
        const n = chord[Math.floor(Math.random() * chord.length)] + 12;
        this.bell(mtof(n), t + b * beat + (Math.random() < 0.3 ? beat / 2 : 0), def.boxGain * 0.8, out);
      }
    }
  }

  private pad(freq: number, t: number, dur: number, gain: number, cutoff: number, out: AudioNode) {
    const ctx = this.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(gain * 0.8, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    lp.connect(g).connect(out);
    [-6, 6].forEach((det) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }

  private bass(freq: number, t: number, dur: number, out: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.95);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur);
  }

  private musicBox(freq: number, t: number, gain: number, out: AudioNode) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    g.connect(out);
    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = freq;
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 3.01;
    const g2 = ctx.createGain();
    g2.gain.value = 0.18;
    o1.connect(g);
    o2.connect(g2).connect(g);
    o1.start(t);
    o2.start(t);
    o1.stop(t + 1.5);
    o2.stop(t + 1.5);
  }

  private bell(freq: number, t: number, gain: number, out: AudioNode) {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    g.connect(out);
    [1, 2.76, 5.4].forEach((ratio, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq * ratio;
      const pg = ctx.createGain();
      pg.gain.value = [1, 0.25, 0.08][i];
      o.connect(pg).connect(g);
      o.start(t);
      o.stop(t + 2.5);
    });
  }

  // ------------------------------------------------------------------ sfx
  sfx(name: SfxName, intensity = 1) {
    if (!this.ctx || this.ctx.state === 'closed') return;
    const ctx = this.ctx;
    const t = ctx.currentTime + 0.01;
    const out = this.sfxBus;
    const verb = this.reverbSend;
    const tone = (freq: number, start: number, dur: number, gain: number, type: OscillatorType = 'sine', toFreq?: number, dest: AudioNode = out) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, start);
      if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, start + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.02, dur / 4));
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(g);
      g.connect(dest);
      if (dest === out) g.connect(verb);
      o.start(start);
      o.stop(start + dur + 0.05);
    };
    const noiseBurst = (start: number, dur: number, gain: number, filter: BiquadFilterType, freq: number, dest: AudioNode = out, q = 0.7) => {
      const src = this.noiseSource();
      const f = ctx.createBiquadFilter();
      f.type = filter;
      f.frequency.value = freq;
      f.Q.value = q;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(gain, start + Math.min(0.03, dur / 5));
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      src.connect(f).connect(g).connect(dest);
      src.start(start, Math.random());
      src.stop(start + dur + 0.05);
      return f;
    };
    const arp = (notes: number[], step: number, gain: number, dur = 1.2) =>
      notes.forEach((n, i) => tone(mtof(n), t + i * step, dur, gain, 'sine'));

    switch (name) {
      case 'ui':
        tone(1320, t, 0.08, 0.05, 'triangle');
        break;
      case 'soft':
        tone(880, t, 0.15, 0.035, 'sine');
        break;
      case 'open':
        tone(520, t, 0.25, 0.05, 'sine', 990);
        break;
      case 'close':
        tone(780, t, 0.2, 0.04, 'sine', 420);
        break;
      case 'magic':
        arp([79, 83, 86, 91, 95], 0.06, 0.05, 1.1);
        noiseBurst(t, 0.6, 0.015, 'highpass', 6000);
        break;
      case 'chime':
        arp([84, 88, 91], 0.09, 0.06, 1.6);
        break;
      case 'pickup':
        tone(mtof(81), t, 0.35, 0.07, 'sine');
        tone(mtof(88), t + 0.08, 0.5, 0.07, 'sine');
        break;
      case 'heart':
        tone(mtof(76), t, 0.4, 0.05, 'sine');
        tone(mtof(83), t + 0.12, 0.6, 0.05, 'sine');
        break;
      case 'blow':
        // A soft breath, then a little twinkle as the flames go out.
        noiseBurst(t, 0.7, 0.07, 'bandpass', 900, out, 0.5);
        arp([84, 88, 91, 96], 0.07, 0.04, 1.4);
        break;
      case 'note':
        tone(mtof(72 + Math.floor(Math.random() * 12)), t, 0.6, 0.07, 'triangle');
        break;
      case 'crown':
        arp([72, 76, 79, 84, 88, 91, 96], 0.09, 0.06, 2.2);
        noiseBurst(t, 2.2, 0.02, 'highpass', 7000);
        tone(mtof(48), t, 2.5, 0.06, 'triangle');
        break;
      case 'bloom':
        arp([77, 81, 84, 89], 0.07, 0.05, 1.3);
        noiseBurst(t, 0.5, 0.012, 'bandpass', 3000);
        break;
      case 'gate':
        noiseBurst(t, 2.6, 0.06, 'lowpass', 180);
        tone(mtof(36), t, 2.8, 0.08, 'triangle');
        arp([67, 72, 76, 79, 84], 0.25, 0.05, 2.4);
        break;
      case 'page':
        noiseBurst(t, 0.28, 0.05 * intensity, 'bandpass', 2600, out, 0.6);
        break;
      case 'water':
        noiseBurst(t, 0.5, 0.05, 'bandpass', 1400, out, 1.2);
        tone(900, t, 0.15, 0.03, 'sine', 1600);
        break;
      case 'quest':
        arp([72, 76, 79], 0.12, 0.07, 1.2);
        window.setTimeout(() => this.ctx && arp([84, 88, 91, 96].map((n) => n), 0.08, 0.06, 1.8), 380);
        break;
      case 'thunder': {
        const g = Math.min(1, 0.6 + intensity * 0.4);
        noiseBurst(t, 3.6, 0.35 * g, 'lowpass', 140, this.thunderBus, 0.5);
        noiseBurst(t + 0.05, 1.2, 0.12 * g, 'lowpass', 600, this.thunderBus, 0.5);
        noiseBurst(t + 0.6, 2.8, 0.18 * g, 'lowpass', 90, this.thunderBus, 0.5);
        break;
      }
      case 'firework': {
        const d = 0.9 + Math.random() * 0.5;
        tone(500 + Math.random() * 300, t, d, 0.025, 'sine', 1800);
        noiseBurst(t + d, 1.4, 0.16 * intensity, 'lowpass', 400);
        for (let i = 0; i < 9; i++) noiseBurst(t + d + 0.15 + Math.random() * 0.9, 0.05, 0.03, 'highpass', 5000);
        break;
      }
    }
  }

  /**
   * Lower (or restore) the procedural background themes, e.g. while the
   * Music Box song plays. Sound effects and the song itself are unaffected.
   */
  duckThemes(on: boolean) {
    if (!this.ctx) return;
    this.themeBus.gain.setTargetAtTime(on ? 0.12 : 1, this.ctx.currentTime, 0.35);
  }

  /**
   * Route an <audio> element through the music bus, so the "Muzik" and master
   * volume sliders and "Senyapkan semua" apply to it (iOS ignores
   * element.volume). Returns false when Web Audio is unavailable — the element
   * then simply plays on its own.
   */
  attachMediaElement(el: HTMLMediaElement): boolean {
    if (!this.ctx) return false;
    if (this.mediaSources.has(el)) return true;
    try {
      const src = this.ctx.createMediaElementSource(el);
      src.connect(this.musicBus);
      this.mediaSources.set(el, src);
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return true;
    } catch {
      return false;
    }
  }

  /** Brief preview tone for volume sliders. */
  preview(bus: 'music' | 'sfx') {
    if (bus === 'sfx') this.sfx('chime');
    else if (this.ctx && this.themeGain === null) this.sfx('soft');
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }
}

export const audio = new AudioEngine();
