/**
 * End-to-end playthrough test (real browser, real WebGL).
 *
 *   npm run build:pages   (builds with the GitHub Pages sub-path)
 *   npm run e2e
 *
 * Serves dist/ under /game-for-bday-sarah/ (exactly like GitHub Pages),
 * plays the entire story from the title screen to the secret room using the
 * QA hook (window.__awmjfh), verifies every milestone, checks persistence
 * after reload, mobile layout and the 2D fallback, and saves screenshots to
 * e2e-screenshots/.
 *
 * Uses an installed Chrome/Edge via playwright-core (no browser download).
 * Override with CHROME_PATH=/path/to/chrome.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = '/game-for-bday-sarah/';
const PORT = 4179;
const URL = `http://localhost:${PORT}${BASE}`;
const OUT = 'e2e-screenshots';
mkdirSync(OUT, { recursive: true });

const candidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));
if (!executablePath) throw new Error('No Chrome/Edge found. Set CHROME_PATH.');

const server = spawn(`npx vite preview --port ${PORT} --strictPort --base ${BASE}`, { stdio: ['ignore', 'pipe', 'pipe'], shell: true, env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('preview server timeout')), 30000);
  server.stdout.on('data', (d) => {
    if (String(d).includes(String(PORT))) {
      clearTimeout(t);
      resolve();
    }
  });
  server.stderr.on('data', (d) => process.stderr.write(d));
});

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  const failedRequests = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  page.on('requestfailed', (r) => failedRequests.push(r.url()));
  page.on('response', (r) => {
    if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
  });

  // Force a known graphics tier so screenshots are representative.
  await page.addInitScript(() => {
    try {
      if (!localStorage.getItem('awmjfh.settings.v1')) {
        localStorage.setItem('awmjfh.settings.v1', JSON.stringify({ state: { graphics: 'low', textSpeed: 'instant' }, version: 1 }));
      }
    } catch {}
  });

  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__awmjfh && window.__awmjfh.ui.getState().screen === 'title', null, { timeout: 60000 });
  check('loads under GitHub Pages sub-path and reaches title screen', true);
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/01-title.png` });

  const S = () => page.evaluate(() => {
    const A = window.__awmjfh;
    const s = A.store.getState();
    return { flags: s.flags, quests: Object.keys(s.completedQuests), area: A.runtime.player.area, ui: { screen: A.ui.getState().screen, prompt: A.ui.getState().prompt, overlays: A.ui.getState().overlays.map((o) => o.overlay.type), dialogue: !!A.ui.getState().dialogue, cutscene: A.ui.getState().cutscene }, player: { x: A.runtime.player.x, z: A.runtime.player.z }, companion: { x: A.runtime.companion.x, z: A.runtime.companion.z, mode: A.runtime.companion.mode, visible: A.runtime.companion.visible, area: A.runtime.companion.area, recoveries: A.runtime.companion.recoveries } };
  });

  /** Wait until the game simulation has advanced by `sec` simulated seconds. */
  const waitSim = async (sec, timeoutMs = 60000) => {
    const t0 = await page.evaluate(() => window.__awmjfh.runtime.time);
    await page.waitForFunction((target) => window.__awmjfh.runtime.time >= target, t0 + sec, { timeout: timeoutMs, polling: 50 });
  };

  /** Resolve dialogue and overlays until the game is idle for a while. */
  const settle = async (label, { maxMs = 90000, idleMs = 1600, shots = [] } = {}) => {
    const start = Date.now();
    let idleSince = null;
    const seen = [];
    while (Date.now() - start < maxMs) {
      const r = await page.evaluate(() => {
        const A = window.__awmjfh;
        const ui = A.ui.getState();
        if (ui.dialogue) {
          const d = ui.dialogue;
          if (d.choices && d.index === d.lines.length - 1) {
            ui.chooseDialogue(d.choices[d.choices.length - 1].id);
            return 'choice';
          }
          ui.advanceDialogue();
          return 'dialogue';
        }
        if (ui.overlays.length) {
          const o = ui.overlays[ui.overlays.length - 1].overlay;
          if (o.type === 'birthday') return 'stop:birthday';
          const result = o.type === 'banner' && o.button ? 'button' : o.type === 'court' && o.mode === 'verdict' ? true : o.type === 'confirm' ? true : undefined;
          ui.closeOverlay(result);
          return `overlay:${o.type}`;
        }
        if (ui.panel) {
          ui.closePanel();
          return 'panel';
        }
        return ui.cutscene?.active ? 'cutscene' : null;
      });
      if (r === 'stop:birthday') {
        seen.push(r);
        break;
      }
      if (r && r !== 'cutscene') {
        seen.push(r);
        if (shots.includes(r)) await page.screenshot({ path: `${OUT}/${label}-${r.replace(':', '-')}.png` });
        idleSince = null;
        await sleep(350);
        continue;
      }
      if (r === 'cutscene') {
        idleSince = null;
        await sleep(250);
        continue;
      }
      idleSince ??= Date.now();
      if (Date.now() - idleSince > idleMs) break;
      await sleep(150);
    }
    return seen;
  };

  const teleport = (x, z, yaw = Math.PI, area) =>
    page.evaluate(
      ({ x, z, yaw, area }) => {
        const A = window.__awmjfh;
        const p = A.runtime.player;
        if (area) p.area = area;
        p.x = x;
        p.z = z;
        p.yaw = yaw;
        p.vx = p.vz = 0;
        A.runtime.camera.yaw = yaw;
      },
      { x, z, yaw, area },
    ).then(() => waitSim(0.3));

  const interactAt = async (x, z, expectId, { yaw = Math.PI, area, label, shots } = {}) => {
    await teleport(x, z, yaw, area);
    const st = await S();
    const pid = st.ui.prompt?.id;
    if (expectId && pid !== expectId) {
      check(`prompt "${expectId}" available`, false, `got ${pid ?? 'none'} at (${x}, ${z})`);
      return false;
    }
    await page.evaluate(() => window.__awmjfh.game.interact());
    await sleep(400);
    return settle(label ?? expectId ?? 'interact', { shots });
  };

  // ---------------------------------------------------------- Chapter 0
  await page.getByRole('button', { name: /Mula/ }).first().click();
  await page.waitForFunction(() => window.__awmjfh.ui.getState().screen === 'opening');
  await sleep(6500);
  await page.screenshot({ path: `${OUT}/02-opening.png` });
  await page.getByRole('button', { name: /Enter Your Kingdom/ }).click();
  await page.waitForFunction(() => window.__awmjfh.ui.getState().screen === 'playing');
  check('Chapter 0: opening → Enter Your Kingdom', true);
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/03-courtyard.png` });

  // Movement with the keyboard.
  const before = await S();
  await page.keyboard.down('KeyW');
  await waitSim(1.0);
  await page.keyboard.up('KeyW');
  await waitSim(0.3);
  const after = await S();
  check('WASD moves the Princess', before.player.z - after.player.z > 2, `Δz=${(before.player.z - after.player.z).toFixed(2)}`);

  // ---------------------------------------------------------- Chapter 1
  await teleport(0, 8.4);
  await sleep(400);
  let st = await S();
  check('Crown prompt "Accept My Crown"', st.ui.prompt?.label === 'Accept My Crown', st.ui.prompt?.label);
  await page.keyboard.press('KeyE');
  await sleep(2600);
  await page.screenshot({ path: `${OUT}/04-coronation-flight.png` });
  await settle('05-coronation', { shots: ['overlay:royalCard'] });
  st = await S();
  check('Chapter 1: crown accepted & quest complete', !!st.flags.crownAccepted && st.quests.includes('coronation'));
  check('Companion appears and follows', st.companion.mode === 'follow' && st.companion.visible, JSON.stringify(st.companion));

  // Companion follows while walking.
  await page.keyboard.down('KeyD');
  await waitSim(1.6);
  await page.keyboard.up('KeyD');
  await waitSim(2.5);
  st = await S();
  const dComp = Math.hypot(st.companion.x - st.player.x, st.companion.z - st.player.z);
  check('Companion stays close while she walks', dComp < 3.2, `dist=${dComp.toFixed(2)}`);
  await page.screenshot({ path: `${OUT}/06-companion-follow.png` });

  // Talk to him.
  await teleport(st.companion.x + 1.2, st.companion.z + 0.5);
  st = await S();
  check('"Talk to him" prompt near the companion', st.ui.prompt?.kind === 'talk', st.ui.prompt?.label);
  await page.evaluate(() => window.__awmjfh.game.talk());
  await sleep(800);
  await page.screenshot({ path: `${OUT}/07-talk.png` });
  await page.evaluate(() => {
    const ui = window.__awmjfh.ui.getState();
    if (ui.dialogue?.choices) ui.chooseDialogue('hint');
  });
  await sleep(500);
  const hintText = await page.evaluate(() => window.__awmjfh.ui.getState().dialogue?.lines.map((l) => l.text).join(' '));
  check('Contextual hint dialogue mentions the bouquet', /bunga|Hadiah/i.test(hintText ?? ''), hintText);
  await settle('talk');

  // ---------------------------------------------------------- Chapter 2-3
  await interactAt(8, 6.6, 'bouquet', { label: '08-bouquet', shots: ['overlay:banner'] });
  st = await S();
  check('Chapter 2: bouquet received', !!st.flags.bouquetReceived && st.quests.includes('bouquet'));
  check('Chapter 3: castle revealed & entered via "Enter My Castle"', !!st.flags.castleRevealed && st.area === 'castle' && st.quests.includes('castle'), `area=${st.area}`);
  await sleep(1200);
  st = await S();
  check('Companion entered the castle with her', st.companion.area === 'castle' && st.companion.visible, JSON.stringify(st.companion));
  await page.screenshot({ path: `${OUT}/09-castle-hall.png` });

  // ---------------------------------------------------------- Chapter 4
  await teleport(16.1, -2.4, Math.PI, 'castle');
  st = await S();
  check('Envelope prompt on bedside table', st.ui.prompt?.id === 'envelope', st.ui.prompt?.id);
  await page.evaluate(() => window.__awmjfh.game.interact());
  await sleep(1200);
  await page.getByRole('button', { name: /Buka sampul/ }).click();
  await sleep(4200);
  await page.screenshot({ path: `${OUT}/10-love-letter.png` });
  await settle('11-after-letter', { shots: ['overlay:banner'] });
  st = await S();
  check('Chapter 4: love letter read, open world unlocked', !!st.flags.letterRead && st.quests.includes('letter'));

  // Exit the castle by the door.
  await interactAt(0, 6.6, 'castleExit', { area: 'castle', yaw: 0 });
  await sleep(1400);
  st = await S();
  check('Exit castle → overworld, companion follows outside', st.area === 'overworld' && st.companion.area === 'overworld');

  // ---------------------------------------------------------- Garden
  await interactAt(48.8, 0.6, 'seedBasket', { yaw: Math.PI });
  await interactAt(39.6, 10.2, 'wateringCan', { yaw: Math.PI });
  const flowers = await page.evaluate(() => Object.keys(window.__awmjfh.story.items).length && null);
  void flowers;
  const flowerSpots = [
    ['flower_01', 28.5, 4], ['flower_02', 30.5, 12.5], ['flower_03', 33, -3.5], ['flower_04', 40.5, -3.5], ['flower_05', 45, 7.5], ['flower_06', 47, 13.5],
    ['flower_07', 38.5, 16.5], ['flower_08', 33.5, 18.5], ['flower_09', 51, 5], ['flower_10', 41.5, 11.5], ['flower_11', 34.5, 13.2], ['flower_12', 25.5, -4.5],
  ];
  for (const [id, x, z] of flowerSpots) {
    await teleport(x, z + 0.9);
    const p = (await S()).ui.prompt;
    if (p?.id !== id) {
      check(`flower ${id} reachable`, false, `prompt=${p?.id}`);
      continue;
    }
    await page.evaluate(() => window.__awmjfh.game.interact());
    await sleep(250);
    await settle('flower', { idleMs: 500 });
  }
  await page.screenshot({ path: `${OUT}/12-garden.png` });
  for (const [id, x] of [['plot_1', 40], ['plot_2', 42.6], ['plot_3', 45.2]]) {
    await interactAt(x, 1.6, id, { yaw: Math.PI }); // plant
    await interactAt(x, 1.6, id, { yaw: Math.PI }); // water → bloom
  }
  await interactAt(42, 12.6, 'note_bench', { yaw: 0 });
  await sleep(1500);
  st = await S();
  check('Garden quest complete (flowers, planting, watering)', st.quests.includes('garden'), st.quests.join(','));
  await page.screenshot({ path: `${OUT}/13-garden-bloom.png` });

  // ---------------------------------------------------------- Mirror
  await teleport(34, -24, Math.PI);
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/14-mirror-room.png` });
  await teleport(34, -28.6, Math.PI);
  await page.evaluate(() => window.__awmjfh.game.interact());
  await sleep(4800);
  await page.screenshot({ path: `${OUT}/15-mirror-reveal.png` });
  await settle('mirror');
  st = await S();
  check('Mirror interaction completes', st.quests.includes('mirror'));

  // ---------------------------------------------------------- Library
  for (const [id, x, z] of [['book1', -38.5, -28], ['book2', -34, -29.6], ['book3', -29.5, -28], ['book4', -38.4, -21.8]]) {
    await teleport(x, z, Math.PI);
    const p = (await S()).ui.prompt;
    if (p?.id !== id) {
      check(`${id} prompt`, false, `prompt=${p?.id}`);
      continue;
    }
    await page.evaluate(() => window.__awmjfh.game.interact());
    await sleep(900);
    if (id === 'book1') {
      await page.getByRole('button', { name: /Buka buku/ }).click();
      await sleep(900);
      await page.screenshot({ path: `${OUT}/16-library-book.png` });
    }
    await settle(id);
  }
  st = await S();
  check('Library: all four books read', st.quests.includes('library'));
  await page.screenshot({ path: `${OUT}/17-library.png` });

  // ---------------------------------------------------------- Courtroom
  await teleport(-30, 7, -Math.PI / 2);
  await sleep(900);
  await settle('judge-intro');
  for (const [id, x, z] of [['clue_footprints', -36, 4.6], ['clue_witness', -40, 10.2], ['clue_log', -33, 10.2]]) {
    await interactAt(x, z, id, { yaw: Math.PI });
  }
  await teleport(-40.8, 6, -Math.PI / 2);
  await page.evaluate(() => window.__awmjfh.game.interact());
  await sleep(800);
  await page.screenshot({ path: `${OUT}/18-court-verdict.png` });
  // Answer wrong once, then correctly — verifies feedback & retry.
  await page.getByRole('button', { name: /Encik Arnab — dia orang terakhir/ }).click();
  await sleep(500);
  const fb = await page.getByRole('status').allInnerTexts();
  check('Courtroom gives feedback on a wrong answer', fb.some((t) => /saksi|Cuba/.test(t)), fb.join(' | '));
  await page.getByRole('button', { name: /Kambing Comel — masuk/ }).click();
  await sleep(2900);
  await page.getByRole('button', { name: /Bebaskan Encik Arnab/ }).click();
  await sleep(2900);
  await page.getByRole('button', { name: /Umumkan keputusan/ }).click();
  await sleep(600);
  await settle('19-court', { shots: ['overlay:story'] });
  st = await S();
  check('Courtroom mini-game complete', st.quests.includes('courtroom'));

  // ---------------------------------------------------------- Children
  await interactAt(31, 36.8, 'momo', { yaw: Math.PI });
  await interactAt(42, 39.2, 'clue_sandbox', { yaw: Math.PI });
  await interactAt(28, 32.4, 'clue_swing', { yaw: Math.PI });
  await interactAt(24.6, 41.4, 'toyTree', { yaw: 0 });
  await page.screenshot({ path: `${OUT}/20-wonderland.png` });
  await interactAt(31, 36.8, 'momo', { yaw: Math.PI });
  st = await S();
  check("Children's Wonderland: Momo's toy returned", st.quests.includes('children'));

  // ---------------------------------------------------------- Strawberry Garden (optional)
  await teleport(37.5, -7.4, Math.PI / 2);
  await teleport(41.6, -9.4, Math.PI / 2);
  await sleep(600);
  const introSeen = await settle('strawberry-intro');
  st = await S();
  check("Strawberry Garden: Fareed's intro plays on arrival", !!st.flags.strawberryIntro && introSeen.includes('dialogue'), introSeen.join(','));
  const trackerText = await page.getByText('Find 5 ripe strawberries').count();
  check('Strawberry quest objective shown in the tracker', trackerText >= 1);
  const berrySpots = [
    ['straw_1', 42.6, -17.6],
    ['straw_2', 45.4, -14.6],
    ['straw_3', 43.4, -11.7],
    ['straw_4', 50.2, -18.4],
    ['straw_5', 53.0, -18.4],
  ];
  const counts = [];
  let indicatorSeen = '';
  for (const [id, x, z] of berrySpots) {
    if (id === 'straw_1') {
      // Pick the first strawberry by hand and watch the save indicator react.
      await teleport(x, z, Math.PI);
      await page.evaluate(() => window.__awmjfh.game.interact());
      const el = await page.waitForSelector('[data-save-state]', { timeout: 5000 }).catch(() => null);
      const first = el ? await el.getAttribute('data-save-state') : 'none';
      const saved = await page.waitForSelector('[data-save-state="saved"]', { timeout: 8000 }).then(() => 'saved').catch(() => 'no-saved');
      const persisted = await page.evaluate(() => (localStorage.getItem('awmjfh.progress.v1') ?? '').includes('berry:straw_1'));
      indicatorSeen = `${first}→${saved}, persisted=${persisted}`;
      await settle('berry');
    } else {
      await interactAt(x, z, id, { yaw: Math.PI, label: 'berry' });
    }
    counts.push(await page.evaluate(() => window.__awmjfh.store.getState().inventory.strawberry ?? 0));
    if (id === 'straw_2') await page.screenshot({ path: `${OUT}/20a-strawberry-picking.png` });
  }
  check('Collect 5 strawberries: counter goes 1→5 and inventory updates', JSON.stringify(counts) === '[1,2,3,4,5]', JSON.stringify(counts));
  check('Autosave: strawberry pick shows "Saving…" → "Progress saved" and is written to localStorage', /^(saving|saved)→saved, persisted=true$/.test(indicatorSeen), indicatorSeen);
  st = await S();
  check('Strawberry quest completes (optional, saved)', st.quests.includes('strawberries'));
  // Duplicate protection: the spot is gone, and a forced repeat changes nothing.
  await teleport(42.6, -17.6, Math.PI);
  const dupPrompt = (await S()).ui.prompt?.id;
  await page.evaluate(() => window.__awmjfh.story.pickStrawberry('straw_1'));
  await settle('dup');
  const inv = await page.evaluate(() => window.__awmjfh.store.getState().inventory);
  check('Same strawberry cannot be collected twice; reward granted once', dupPrompt !== 'straw_1' && inv.strawberry === 5 && inv.strawberryBasket === 1, `prompt=${dupPrompt} inv=${JSON.stringify(inv)}`);
  // Picnic in the gazebo.
  await teleport(49.5, -14.5, Math.PI / 2);
  const picnicPrompt = (await S()).ui.prompt;
  check('Picnic unlocked after harvesting', picnicPrompt?.id === 'picnic', picnicPrompt?.label);
  await page.evaluate(() => window.__awmjfh.game.interact());
  await waitSim(4);
  await page.screenshot({ path: `${OUT}/20b-picnic.png` });
  const sitting = await page.evaluate(() => ({ pose: window.__awmjfh.runtime.player.pose, sit: window.__awmjfh.runtime.companion.sit }));
  await settle('picnic');
  st = await S();
  const pose = await page.evaluate(() => window.__awmjfh.runtime.player.pose);
  const dPic = Math.hypot(st.companion.x - st.player.x, st.companion.z - st.player.z);
  check('Picnic: both sit together, then she stands and he stays close', sitting.pose === 'sitGround' && sitting.sit > 0.5 && pose === 'normal' && !!st.flags.picnicDone && dPic < 3.5 && st.companion.mode !== 'absent', `during=${JSON.stringify(sitting)} after=${pose} d=${dPic.toFixed(2)}`);
  const zBefore = st.player.z;
  await page.keyboard.down('KeyW');
  await waitSim(0.6);
  await page.keyboard.up('KeyW');
  st = await S();
  check('Not trapped after the picnic (she can walk away)', Math.abs(st.player.z - zBefore) > 0.5 || Math.abs(st.player.x - 49.5) > 0.5);

  // ---------------------------------------------------------- Storm
  await teleport(-14, 34, -Math.PI / 2);
  await sleep(800);
  await teleport(-20, 34.5, -Math.PI / 2);
  await sleep(3500);
  await page.screenshot({ path: `${OUT}/21-storm-start.png` });
  await settle('storm-start');
  st = await S();
  check('Storm quest started; he is separated in the fog', !!st.flags.stormStarted && (st.companion.mode === 'goto' || st.companion.mode === 'hold'), st.companion.mode);
  await interactAt(-22, 35.4, 'storm_umbrella', { yaw: Math.PI });
  await page.evaluate(() => {
    const w = window.__awmjfh.runtime.weather;
    w.storm = 1;
  });
  await teleport(-30, 33, -Math.PI / 2);
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/22-storm-rain.png` });
  await page.waitForFunction(() => window.__awmjfh.runtime.companion.mode === 'hold', null, { timeout: 120000 });
  await teleport(-40.5, 33.4, -Math.PI / 2);
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/23-storm-comfort.png` });
  await settle('24-storm', { shots: ['overlay:story'] });
  st = await S();
  check('Storm: finding him triggers the comfort scene and completes', !!st.flags.stormFound && st.quests.includes('storm'));
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/25-rainbow.png` });
  await settle('hill-announce');
  st = await S();
  check('All main quests → Fireworks Hill unlocked', !!st.flags.hillAnnounced);

  // ---------------------------------------------------------- Finale
  await teleport(0, 58, 0);
  await sleep(800);
  await teleport(0, 65.2, 0);
  await sleep(1200);
  // Let the fireworks play before closing the final message.
  const t0 = Date.now();
  let shotTaken = false;
  while (Date.now() - t0 < 60000) {
    const top = await page.evaluate(() => {
      const ui = window.__awmjfh.ui.getState();
      return ui.overlays.length ? ui.overlays[ui.overlays.length - 1].overlay.type : ui.dialogue ? 'dialogue' : null;
    });
    if (top === 'finalMessage') {
      await sleep(1500);
      await page.screenshot({ path: `${OUT}/27-final-message.png` });
      break;
    }
    if (top === 'dialogue' || top === 'story') {
      await page.evaluate(() => {
        const ui = window.__awmjfh.ui.getState();
        if (ui.dialogue) ui.advanceDialogue();
        else ui.closeOverlay();
      });
    }
    if (!shotTaken && (await page.evaluate(() => window.__awmjfh.runtime.anim.fireworks))) {
      await sleep(4000);
      await page.screenshot({ path: `${OUT}/26-fireworks.png` });
      shotTaken = true;
    }
    await sleep(300);
  }
  await settle('finale');
  st = await S();
  check('Fireworks finale watched → secret room unlocked', !!st.flags.finaleWatched && !!st.flags.secretUnlocked && st.quests.includes('finale'));

  // ---------------------------------------------------------- Secret room
  await page.evaluate(() => window.__awmjfh.ui.getState().openPanel('map'));
  await sleep(700);
  await page.screenshot({ path: `${OUT}/28-map.png` });
  await page.evaluate(() => window.__awmjfh.ui.getState().closePanel());
  await teleport(-8, 0, -Math.PI / 2, 'castle');
  await page.evaluate(() => {
    const A = window.__awmjfh;
    A.runtime.areaEpoch++;
    A.world.getState().setArea('castle');
  });
  await sleep(1500);
  await teleport(-12.6, 1.5, -Math.PI / 2, 'castle');
  await sleep(1200);
  await settle('secret-enter');
  st = await S();
  check('Secret room entered', !!st.flags.secretEntered);
  await page.screenshot({ path: `${OUT}/29-secret-room.png` });

  // Birthday cake: Fareed reveals it, then the wish overlay opens.
  st = await S();
  check('Birthday cake revealed by Fareed, wish overlay opens', !!st.flags.cakeRevealed && st.ui.overlays.includes('birthday'), JSON.stringify(st.ui.overlays));
  await page.screenshot({ path: `${OUT}/29a-birthday-message.png` });
  await page.getByRole('button', { name: /Make a Birthday Wish/ }).click();
  await sleep(600);
  await page.getByRole('button', { name: /Saya dah buat hajat/ }).click({ timeout: 15000 });
  await sleep(500);
  await page.getByRole('button', { name: /Blow the Candles/ }).click();
  await waitSim(2.5);
  const anim = await page.evaluate(() => ({ out: window.__awmjfh.runtime.anim.candlesOut, win: window.__awmjfh.runtime.anim.windowFireworks, fw: window.__awmjfh.runtime.anim.fireworks }));
  await page.screenshot({ path: `${OUT}/29b-candles-out.png` });
  await settle('candles');
  st = await S();
  check('Wish made & candles blown: flames out, fireworks begin', !!st.flags.wishMade && !!st.flags.candlesBlown && anim.out > 0.6 && anim.win && anim.fw, JSON.stringify(anim));
  await teleport(-16.6, 2.5, Math.PI, 'castle');
  await waitSim(2);
  await page.screenshot({ path: `${OUT}/29c-cake.png` });
  // Interacting again must not replay the celebration.
  await page.evaluate(() => window.__awmjfh.game.interact());
  await waitSim(0.6);
  st = await S();
  check('Cake stays after the celebration; no repeat trigger', st.ui.overlays.length === 0 && !st.ui.cutscene && !!st.flags.candlesBlown);
  await interactAt(-17.2, -1.4, 'secretGift', { area: 'castle', yaw: Math.PI });
  await interactAt(-13.6, 0.6, 'finalLetter', { area: 'castle', yaw: -Math.PI / 2, label: '30-final', shots: ['overlay:credits'] });
  st = await S();
  check('Final letter read → game complete with credits', !!st.flags.finalLetterRead && st.quests.includes('secret') && !!st.flags.creditsSeen);

  // Re-entering the Secret Room must not replay the ending.
  await teleport(-6, 0, -Math.PI / 2, 'castle');
  await waitSim(1);
  await teleport(-12.6, 1.5, -Math.PI / 2, 'castle');
  await waitSim(1.5);
  st = await S();
  check('Re-entering the Secret Room does not replay the cake or ending', !st.ui.cutscene && st.ui.overlays.length === 0 && !st.ui.dialogue, JSON.stringify(st.ui));

  // ---------------------------------------------------------- Persistence
  await sleep(1000);
  await waitSim(4.5); // let the throttled position autosave run
  const savedCheckpoint = await page.evaluate(() => window.__awmjfh.store.getState().player);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__awmjfh && window.__awmjfh.ui.getState().screen === 'title', null, { timeout: 60000 });
  st = await S();
  check('Progress persists after reload (localStorage)', !!st.flags.finalLetterRead && st.quests.length >= 12, `${st.quests.length} quests`);
  check('New progress persists (strawberries, picnic, candles)', st.quests.includes('strawberries') && !!st.flags.picnicDone && !!st.flags.candlesBlown);
  const continueBtn = await page.getByRole('button', { name: /Sambung pengembaraan/ }).count();
  check('Title offers "Sambung pengembaraan" (continue)', continueBtn === 1);

  // ---------------------------------------------------------- Resume
  await page.getByRole('button', { name: /Sambung pengembaraan/ }).click();
  await page.waitForFunction(() => window.__awmjfh.ui.getState().screen === 'playing');
  await waitSim(2);
  st = await S();
  const dCk = Math.hypot(st.player.x - savedCheckpoint.x, st.player.z - savedCheckpoint.z);
  const dHim = Math.hypot(st.companion.x - st.player.x, st.companion.z - st.player.z);
  check('Resume: back at the saved checkpoint, Fareed beside her, no cinematic replayed', st.area === savedCheckpoint.area && dCk < 1.2 && st.companion.visible && st.companion.area === st.area && dHim < 3.5 && !st.ui.cutscene && !st.ui.dialogue && st.ui.overlays.length === 0, `area=${st.area} dCheckpoint=${dCk.toFixed(2)} dHim=${dHim.toFixed(2)} cut=${JSON.stringify(st.ui.cutscene)}`);
  await page.screenshot({ path: `${OUT}/35-resume.png` });

  // ---------------------------------------------------------- Export / import
  await page.evaluate(() => window.__awmjfh.ui.getState().openPanel('settings'));
  await sleep(600);
  await page.getByRole('button', { name: /Eksport simpanan/ }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/36-save-management.png` });
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Eksport simpanan/ }).click()]);
  const exportText = readFileSync(await download.path(), 'utf8');
  const exported = JSON.parse(exportText);
  (await import('node:fs')).writeFileSync(`${OUT}/.last-export.json`, exportText);
  const exportKeys = Object.keys(exported).sort().join(',');
  check(
    'Export Save downloads a valid JSON backup (progress + settings only)',
    exportKeys === 'app,exportedAt,kind,progress,schemaVersion,settings' && exported.app === 'a-world-made-just-for-her' && exported.progress.flags.candlesBlown === true && !/userAgent|cookie|localStorage|@/.test(exportText),
    `${download.suggestedFilename()} keys=${exportKeys}`,
  );
  const flagsBefore = JSON.stringify((await S()).flags);
  await page.getByTestId('save-import-input').setInputFiles({ name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"a-world-made-just-for-her","progress":') });
  const alertText = await page.getByRole('alert').innerText({ timeout: 5000 }).catch(() => '');
  check('Import rejects an invalid file with a clear message; progress untouched', /Import ditolak/.test(alertText) && JSON.stringify((await S()).flags) === flagsBefore, alertText);
  const modified = { ...exported, progress: { ...exported.progress, stats: { ...exported.progress.stats, playSeconds: 4242 } } };
  await page.getByTestId('save-import-input').setInputFiles({ name: 'save.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(modified)) });
  await page.getByRole('alertdialog').waitFor({ timeout: 5000 });
  await page.screenshot({ path: `${OUT}/37-import-confirm.png` });
  await page.getByRole('button', { name: /Ya, import fail simpanan/ }).click();
  await page.waitForFunction(() => window.__awmjfh.ui.getState().screen === 'title', null, { timeout: 10000 });
  const afterImport = await page.evaluate(() => ({ s: window.__awmjfh.store.getState().stats.playSeconds, f: window.__awmjfh.store.getState().flags, backup: window.__awmjfh.save.readBackup()?.info.reason }));
  check('Import Save (after confirmation) restores progress and backs up the old save first', afterImport.s === 4242 && afterImport.f.candlesBlown === true && afterImport.backup === 'before-import', JSON.stringify({ s: afterImport.s, backup: afterImport.backup }));

  check('No uncaught page errors', errors.length === 0, errors.slice(0, 5).join(' | '));
  check('No failed asset requests (base path correct)', failedRequests.length === 0, failedRequests.slice(0, 5).join(' | '));

  // Close the tab completely, open a new one later: progress must still be there.
  await page.close();
  const page2 = await ctx.newPage();
  const p2Errors = [];
  page2.on('pageerror', (e) => p2Errors.push(e.message));
  await page2.goto(URL, { waitUntil: 'load' });
  await page2.waitForFunction(() => window.__awmjfh && window.__awmjfh.ui.getState().screen === 'title', null, { timeout: 60000 });
  const reopened = await page2.evaluate(() => {
    const s = window.__awmjfh.store.getState();
    return { quests: Object.keys(s.completedQuests).length, berries: Object.keys(s.collected).filter((k) => k.startsWith('berry:')).length, candles: !!s.flags.candlesBlown, play: s.stats.playSeconds, inv: s.inventory.strawberry };
  });
  check('Close tab & reopen: quests, strawberries, inventory and cake state restored', reopened.quests >= 13 && reopened.berries === 5 && reopened.candles && reopened.inv === 5 && reopened.play >= 4242 && p2Errors.length === 0, JSON.stringify(reopened));
  await ctx.close();

  // ---------------------------------------------------------- Mobile
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
  const mp = await mobile.newPage();
  const mErrors = [];
  mp.on('pageerror', (e) => mErrors.push(e.message));
  await mp.goto(URL, { waitUntil: 'load' });
  await mp.waitForFunction(() => window.__awmjfh && window.__awmjfh.ui.getState().screen === 'title', null, { timeout: 60000 });
  await sleep(1200);
  await mp.screenshot({ path: `${OUT}/31-mobile-title.png` });
  await mp.getByRole('button', { name: /^Mula$/ }).tap();
  await sleep(6500);
  await mp.getByRole('button', { name: /Enter Your Kingdom/ }).tap();
  await sleep(2500);
  const joystick = await mp.getByRole('application', { name: /Kayu bedik/ }).count();
  const interactBtn = await mp.getByRole('button', { name: /Interaksi|Accept My Crown/ }).count();
  check('Mobile: joystick and interact button visible', joystick === 1 && interactBtn >= 1, `joystick=${joystick} interact=${interactBtn}`);
  // Drive the joystick with touch.
  const box = await mp.getByRole('application', { name: /Kayu bedik/ }).boundingBox();
  const z0 = await mp.evaluate(() => window.__awmjfh.runtime.player.z);
  const cdp = await mobile.newCDPSession(mp);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx, y: cy - 55 }] });
  {
    const t0 = await mp.evaluate(() => window.__awmjfh.runtime.time);
    await mp.waitForFunction((t) => window.__awmjfh.runtime.time >= t, t0 + 1.2, { timeout: 60000, polling: 50 });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await sleep(300);
  const z1 = await mp.evaluate(() => window.__awmjfh.runtime.player.z);
  check('Mobile: touch joystick moves the Princess', z0 - z1 > 1, `Δz=${(z0 - z1).toFixed(2)}`);
  await mp.screenshot({ path: `${OUT}/32-mobile-play.png` });
  await mp.evaluate(() => window.__awmjfh.store.getState().setFlag('kingdomAnnounced'));
  const ind = await mp.waitForSelector('[data-save-state]', { timeout: 5000 }).then((h) => h.boundingBox()).catch(() => null);
  const boxesToAvoid = await Promise.all([
    mp.getByRole('application', { name: /Kayu bedik/ }).boundingBox(),
    mp.getByRole('button', { name: /Interaksi|Accept My Crown|Interact/ }).first().boundingBox(),
    mp.getByRole('button', { name: /Misi semasa/ }).boundingBox(),
  ]);
  const overlaps = (a, b) => !!a && !!b && a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
  check('Mobile: save indicator visible without covering joystick, interact button or quest tracker', !!ind && !boxesToAvoid.some((b) => overlaps(ind, b)), JSON.stringify(ind));
  await mp.screenshot({ path: `${OUT}/32a-mobile-save-indicator.png` });
  await mp.evaluate(() => window.__awmjfh.ui.getState().openPanel('journal'));
  await sleep(700);
  await mp.screenshot({ path: `${OUT}/33-mobile-journal.png` });
  await mp.evaluate(() => {
    const ui = window.__awmjfh.ui.getState();
    ui.closePanel();
    void ui.openOverlay({ type: 'birthday', startAt: 'message' });
  });
  await sleep(800);
  await mp.getByRole('button', { name: /Make a Birthday Wish/ }).tap();
  await sleep(3400);
  await mp.getByRole('button', { name: /Saya dah buat hajat/ }).tap();
  await sleep(500);
  const blowBox = await mp.getByRole('button', { name: /Blow the Candles/ }).boundingBox();
  await mp.screenshot({ path: `${OUT}/33a-mobile-candles.png` });
  check('Mobile: birthday wish & candle buttons are tappable and on-screen', !!blowBox && blowBox.height >= 44 && blowBox.y + blowBox.height <= 844 && blowBox.x >= 0 && blowBox.x + blowBox.width <= 390, JSON.stringify(blowBox));
  await mp.evaluate(() => window.__awmjfh.ui.getState().closeAllOverlays());
  check('Mobile: no page errors', mErrors.length === 0, mErrors.join(' | '));
  await mobile.close();

  // ---------------------------------------------------------- Save safety (fresh browser profiles)
  const savedProgress = JSON.parse(readFileSync(`${OUT}/.last-export.json`, 'utf8')).progress;
  const freshProfile = async (seed, arg) => {
    const c = await browser.newContext({ viewport: { width: 1024, height: 700 } });
    const pg = await c.newPage();
    const errs = [];
    pg.on('pageerror', (e) => errs.push(e.message));
    await pg.addInitScript(seed, arg);
    await pg.goto(URL, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__awmjfh && window.__awmjfh.ui.getState().screen === 'title', null, { timeout: 60000 });
    return { c, pg, errs };
  };
  {
    const { c, pg, errs } = await freshProfile((progress) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('awmjfh.progress.v1', '{"state":{"flags":{"crownAccep'); // truncated / corrupted
      localStorage.setItem('awmjfh.progress.backup', JSON.stringify({ savedAt: Date.now() - 60000, reason: 'session-start', version: 2, state: progress }));
    }, savedProgress);
    const r = await pg.evaluate(() => ({ candles: !!window.__awmjfh.store.getState().flags.candlesBlown, corrupt: localStorage.getItem('awmjfh.progress.corrupt'), notice: document.body.innerText.includes('dipulihkan daripada salinan sandaran') }));
    await pg.screenshot({ path: `${OUT}/38-recovered-from-backup.png` });
    check('Corrupted save: recovered from the backup, damaged data kept aside, player informed', r.candles && !!r.corrupt && r.notice && errs.length === 0, JSON.stringify({ ...r, corrupt: r.corrupt?.slice(0, 20) }));
    await c.close();
  }
  {
    const { c, pg, errs } = await freshProfile(() => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('awmjfh.progress.v1', 'this is not json');
    });
    const r = await pg.evaluate(() => ({ started: !!window.__awmjfh.store.getState().flags.gameStarted, corrupt: localStorage.getItem('awmjfh.progress.corrupt'), begin: !!Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Mula') }));
    check('Corrupted save without backup: no crash, fresh start offered, raw data preserved', !r.started && r.corrupt === 'this is not json' && r.begin && errs.length === 0, JSON.stringify(r));
    await c.close();
  }
  {
    const { c, pg, errs } = await freshProfile((progress) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      // Exactly how the original (v1) release stored progress.
      localStorage.setItem('awmjfh.progress.v1', JSON.stringify({ state: { ...progress, version: 1 }, version: 1 }));
    }, savedProgress);
    await pg.getByRole('button', { name: /Sambung pengembaraan/ }).click();
    await pg.waitForFunction(() => window.__awmjfh.ui.getState().screen === 'playing');
    const t0 = await pg.evaluate(() => window.__awmjfh.runtime.time);
    await pg.waitForFunction((t) => window.__awmjfh.runtime.time >= t, t0 + 1.5, { timeout: 60000, polling: 50 });
    const r = await pg.evaluate(() => {
      const s = window.__awmjfh.store.getState();
      const c = window.__awmjfh.runtime.companion;
      return { v: s.version, quests: Object.keys(s.completedQuests).length, berries: Object.keys(s.collected).filter((k) => k.startsWith('berry:')).length, companion: c.visible && c.mode !== 'absent' };
    });
    check('Schema migration: a v1 save loads into the current schema with progress intact', r.v === 2 && r.quests >= 13 && r.berries === 5 && r.companion && errs.length === 0, JSON.stringify(r));
    await c.close();
  }

  // ---------------------------------------------------------- Free chat with Fareed (Gemini proxy MOCKED — no real network call)
  {
    const { c, pg, errs } = await freshProfile((progress) => {
      if (sessionStorage.getItem('seeded')) return;
      sessionStorage.setItem('seeded', '1');
      localStorage.setItem('awmjfh.progress.v1', JSON.stringify({ state: progress, version: 2 }));
    }, savedProgress);
    const posted = [];
    let mode = 'down';
    await pg.route('**/chat', async (route) => {
      const req = route.request();
      const cors = { 'Access-Control-Allow-Origin': new globalThis.URL(URL).origin, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
      if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
      posted.push(JSON.parse(req.postData() || '{}'));
      if (mode === 'down') return route.abort('connectionrefused');
      return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify({ reply: 'Tengah teman awak, sayang. (mock Gemini)', model: 'mock' }) });
    });
    await pg.getByRole('button', { name: /Sambung pengembaraan/ }).click();
    await pg.waitForFunction(() => window.__awmjfh.ui.getState().screen === 'playing');
    const openChat = async () => {
      await pg.evaluate(() => window.__awmjfh.ui.getState().openPanel('chat'));
      await pg.getByLabel('Mesej').waitFor({ timeout: 20000 });
    };
    const logText = () => pg.evaluate(() => document.querySelector('[data-testid="chat-log"]')?.innerText ?? '');
    const sendMsg = async (m, expect) => {
      await pg.getByLabel('Mesej').fill(m);
      await pg.getByLabel('Mesej').press('Enter');
      await pg.waitForFunction((e) => (document.querySelector('[data-testid="chat-log"]')?.innerText ?? '').includes(e), expect, { timeout: 40000 });
    };
    await openChat();
    const privacy = await pg.locator('[data-testid="chat-privacy-note"]').count();
    check('Chat: Gemini mode shows the privacy note to Sarah', privacy === 1, `privacyNote=${privacy}`);

    // 1) Gemini unreachable → relevant offline reply + notice, game keeps working.
    await sendMsg('Sayang, saya lapar', 'Sambungan AI tak dapat dicapai');
    let log = await logText();
    await pg.screenshot({ path: `${OUT}/40-chat-gemini-unreachable.png` });
    check('Chat: when Gemini is unreachable, Fareed answers offline about food + shows a notice', /makan/i.test(log) && log.includes('Sambungan AI tak dapat dicapai') && errs.length === 0, log.split('\n').slice(-3).join(' | '));

    // 2) Gemini OK → reply shown; memory sent in order, without the notice.
    mode = 'up';
    await sendMsg('Awak tengah buat apa?', '(mock Gemini)');
    const last = posted[posted.length - 1];
    const roles = last.messages.map((m) => m.role).join(',');
    check(
      'Chat: conversation memory sent oldest → newest, ending with her message, notice excluded',
      roles === 'user,assistant,user' && last.messages[0].content === 'Sayang, saya lapar' && last.messages[2].content === 'Awak tengah buat apa?' && !JSON.stringify(last).includes('tak dapat dicapai') && typeof last.context === 'string',
      roles,
    );

    // 3) Refresh → the conversation is still there (same browser).
    await pg.reload({ waitUntil: 'load' });
    await pg.waitForFunction(() => window.__awmjfh && window.__awmjfh.ui.getState().screen === 'title', null, { timeout: 60000 });
    await pg.getByRole('button', { name: /Sambung pengembaraan/ }).click();
    await pg.waitForFunction(() => window.__awmjfh.ui.getState().screen === 'playing');
    await openChat();
    log = await logText();
    check('Chat: history survives a page refresh', log.includes('Sayang, saya lapar') && log.includes('(mock Gemini)'), `${log.length} chars`);

    // 4) Sarah can clear it; game progress untouched.
    await pg.getByRole('button', { name: /Padam perbualan/ }).click();
    await pg.getByRole('button', { name: /Ya, padam perbualan/ }).click();
    await pg.waitForFunction(() => !localStorage.getItem('awmjfh.chat.v1'), null, { timeout: 10000 });
    const after = await pg.evaluate(() => ({ log: document.querySelector('[data-testid="chat-log"]')?.innerText ?? '', candles: !!window.__awmjfh.store.getState().flags.candlesBlown }));
    check('Chat: "Padam perbualan" clears the chat only (progress kept)', !after.log.includes('Sayang, saya lapar') && after.candles && errs.length === 0, JSON.stringify({ candles: after.candles }));
    await c.close();
  }

  // ---------------------------------------------------------- 2D fallback
  const fb2 = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const fp = await fb2.newPage();
  const fErrors = [];
  fp.on('pageerror', (e) => fErrors.push(e.message));
  await fp.addInitScript(() => {
    localStorage.setItem('awmjfh.settings.v1', JSON.stringify({ state: { renderMode: '2d', textSpeed: 'instant' }, version: 1 }));
  });
  await fp.goto(URL, { waitUntil: 'load' });
  await fp.waitForFunction(() => window.__awmjfh && window.__awmjfh.ui.getState().screen === 'title', null, { timeout: 60000 });
  await fp.getByRole('button', { name: /^Mula$/ }).click();
  await sleep(6500);
  await fp.getByRole('button', { name: /Enter Your Kingdom/ }).click();
  await sleep(1500);
  await fp.keyboard.down('KeyW');
  {
    const t0 = await fp.evaluate(() => window.__awmjfh.runtime.time);
    await fp.waitForFunction((t) => window.__awmjfh.runtime.time >= t, t0 + 1, { timeout: 60000, polling: 50 });
  }
  await fp.keyboard.up('KeyW');
  await fp.screenshot({ path: `${OUT}/34-storybook-2d.png` });
  const z2 = await fp.evaluate(() => window.__awmjfh.runtime.player.z);
  check('2D Storybook fallback renders and is playable', z2 < 15.5 && fErrors.length === 0, `z=${z2.toFixed(2)} ${fErrors.join(' | ')}`);
  await fb2.close();
} catch (e) {
  check('e2e run completed without exceptions', false, e.stack ?? String(e));
} finally {
  await browser.close();
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']);
  else server.kill();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
