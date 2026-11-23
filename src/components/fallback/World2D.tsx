/**
 * STORYBOOK MODE — a lightweight top-down 2D renderer.
 *
 * Used automatically when WebGL is unavailable (or chosen in Settings). It
 * renders the very same world layout and drives the very same simulation as
 * the 3D world, so collision, the companion's pathfinding, every quest and
 * every story beat work identically.
 */
import { useEffect, useRef } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useWorld } from '../../stores/worldStore';
import { game } from '../../systems/GameLoop/game';
import { runtime } from '../../systems/runtime';
import { AREA_BOUNDS, GATE_INFO, LANDMARKS, PATHS, SPOT_BY_ID, STATIC_COLLIDERS, TREES } from '../../systems/WorldManager/worldLayout';
import type { AreaId, Collider } from '../../systems/WorldManager/worldTypes';
import { personalContent } from '../../config/personalContent';

const PPM = 10; // offscreen pixels per metre

const TAG_COLORS: Record<string, string> = {
  hedge: '#7fae73',
  castleWall: '#fff1e6',
  keep: '#f6c9d4',
  tower: '#f3b4c4',
  fountain: '#a9d4ea',
  flowerbed: '#c99a7a',
  wall: '#efe0d0',
  shelf: '#b98a62',
  table: '#d9b48f',
  pedestal: '#fff6ea',
  judgeBench: '#8a5f43',
  evidenceTable: '#c9a07a',
  witnessStand: '#8a5f43',
  documentDesk: '#c9a07a',
  bench: '#c9a07a',
  shed: '#f3e1cf',
  slide: '#a9d8f5',
  carousel: '#f7a9c0',
  seesaw: '#fbe38c',
  bigTree: '#7b5a44',
  oldTree: '#5f4636',
  shelterHut: '#9c85c8',
  crystal: '#bcd6ff',
  storyteller: '#fff6f6',
  momo: '#d6c1f5',
  storyShelf: '#b98a62',
  river: '#8fc8e6',
  vanity: '#fff6ea',
  sideTable: '#fff6ea',
  planter: '#e8dcd2',
  pedestalCrown: '#fbf1ee',
  bouquetDisplay: '#f3cdd6',
  pillar: '#fff6ea',
  throne: '#d9b25f',
  sofa: '#e8a4b8',
  bed: '#fdeff3',
  bedsideTable: '#e9d6c2',
  wardrobe: '#e9d6c2',
  chair: '#e8a4b8',
  secretTable: '#fff6ea',
  giftDisplay: '#fff6ea',
  flowerVase: '#f6c9d4',
  vaseTable: '#fff6ea',
  musicBoxTable: '#fff6ea',
  hillBench: '#c9a07a',
  strawberryBed: '#8a9b6e',
  gazeboPost: '#F8F6EF',
  gazeboRail: '#A3B18A',
  cakeTable: '#F8F6EF',
};

function drawCollider(g: CanvasRenderingContext2D, c: Collider, ox: number, oz: number) {
  g.fillStyle = TAG_COLORS[c.tag ?? ''] ?? '#e8dcd2';
  if (c.kind === 'circle') {
    g.beginPath();
    g.arc((c.x - ox) * PPM, (c.z - oz) * PPM, c.r * PPM, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillRect((c.minX - ox) * PPM, (c.minZ - oz) * PPM, (c.maxX - c.minX) * PPM, (c.maxZ - c.minZ) * PPM);
  }
}

function buildStaticLayer(area: AreaId): HTMLCanvasElement {
  const b = AREA_BOUNDS[area];
  const cv = document.createElement('canvas');
  cv.width = Math.ceil((b.maxX - b.minX) * PPM);
  cv.height = Math.ceil((b.maxZ - b.minZ) * PPM);
  const g = cv.getContext('2d')!;
  if (area === 'overworld') {
    const grd = g.createLinearGradient(0, 0, 0, cv.height);
    grd.addColorStop(0, '#c9e2b0');
    grd.addColorStop(1, '#b4d494');
    g.fillStyle = grd;
    g.fillRect(0, 0, cv.width, cv.height);
    // Forest & hill tints
    const tint = (x: number, z: number, r: number, color: string) => {
      const rg = g.createRadialGradient((x - b.minX) * PPM, (z - b.minZ) * PPM, 0, (x - b.minX) * PPM, (z - b.minZ) * PPM, r * PPM);
      rg.addColorStop(0, color);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, cv.width, cv.height);
    };
    tint(LANDMARKS.stormCenter.x, LANDMARKS.stormCenter.z, 20, 'rgba(70,100,80,0.55)');
    tint(LANDMARKS.hillCenter.x, LANDMARKS.hillCenter.z, 17, 'rgba(200,190,235,0.75)');
    // Plaza
    g.fillStyle = '#f6ece4';
    g.beginPath();
    g.arc((0 - b.minX) * PPM, (10 - b.minZ) * PPM, 10.5 * PPM, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#e7c98f';
    g.lineWidth = 0.3 * PPM;
    g.beginPath();
    g.arc((0 - b.minX) * PPM, (10 - b.minZ) * PPM, 6 * PPM, 0, Math.PI * 2);
    g.stroke();
    // Paths
    g.strokeStyle = '#efdcb8';
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const p of PATHS) {
      g.lineWidth = p.width * PPM;
      g.beginPath();
      p.points.forEach(([x, z], i) => (i === 0 ? g.moveTo((x - b.minX) * PPM, (z - b.minZ) * PPM) : g.lineTo((x - b.minX) * PPM, (z - b.minZ) * PPM)));
      g.stroke();
    }
    // Building floors
    g.fillStyle = '#fff6f2';
    g.fillRect((28 - b.minX) * PPM, (-32 - b.minZ) * PPM, 12 * PPM, 12 * PPM);
    g.fillStyle = '#e9d6bf';
    g.fillRect((-42 - b.minX) * PPM, (-34 - b.minZ) * PPM, 16 * PPM, 14 * PPM);
    g.fillStyle = '#d9c3a5';
    g.fillRect((-46 - b.minX) * PPM, (-2 - b.minZ) * PPM, 18 * PPM, 16 * PPM);
    g.fillStyle = '#f6e4ec';
    g.beginPath();
    g.arc((33 - b.minX) * PPM, (36 - b.minZ) * PPM, 12.5 * PPM, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = '#2e1a2c';
    g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#fbefef';
    g.fillRect((-10 - b.minX) * PPM, (-8 - b.minZ) * PPM, 20 * PPM, 16 * PPM);
    g.fillRect((10 - b.minX) * PPM, (-6 - b.minZ) * PPM, 12 * PPM, 12 * PPM);
    g.fillStyle = '#f3e6f0';
    g.fillRect((-20 - b.minX) * PPM, (-5 - b.minZ) * PPM, 10 * PPM, 10 * PPM);
    g.fillStyle = '#c96d86';
    g.fillRect((-1.3 - b.minX) * PPM, (-7.2 - b.minZ) * PPM, 2.6 * PPM, 14.6 * PPM);
  }
  for (const c of STATIC_COLLIDERS[area]) {
    if (c.tag === 'tree') continue;
    drawCollider(g, c, b.minX, b.minZ);
  }
  if (area === 'overworld') {
    // Bridge deck over the river
    g.fillStyle = '#c9a07a';
    g.fillRect((LANDMARKS.bridge.minX - b.minX) * PPM, (LANDMARKS.river.minZ - 1 - b.minZ) * PPM, (LANDMARKS.bridge.maxX - LANDMARKS.bridge.minX) * PPM, (LANDMARKS.river.maxZ - LANDMARKS.river.minZ + 2) * PPM);
    for (const t of TREES) {
      const x = (t.x - b.minX) * PPM;
      const z = (t.z - b.minZ) * PPM;
      g.fillStyle = 'rgba(60,40,40,0.18)';
      g.beginPath();
      g.arc(x + 4, z + 4, 1.4 * t.scale * PPM, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = t.kind === 'blossom' ? '#f6bccd' : t.kind === 'dark' ? '#47685d' : t.kind === 'pine' ? '#5f9a6a' : '#86b96e';
      g.beginPath();
      g.arc(x, z, 1.35 * t.scale * PPM, 0, Math.PI * 2);
      g.fill();
    }
  }
  return cv;
}

export function World2D() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appearance = useGameStore((s) => s.appearance);
  const appearanceRef = useRef(appearance);
  appearanceRef.current = appearance;

  useEffect(() => {
    game.topDown = true;
    const layers: Partial<Record<AreaId, HTMLCanvasElement>> = {};
    const cv = canvasRef.current!;
    const g = cv.getContext('2d')!;
    let raf = 0;
    let last = performance.now();
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(cv.clientWidth * dpr);
      cv.height = Math.round(cv.clientHeight * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      game.step(dt);
      const p = runtime.player;
      const area = p.area;
      const layer = (layers[area] ??= buildStaticLayer(area));
      const b = AREA_BOUNDS[area];
      const W = cv.width;
      const H = cv.height;
      // Zoom: ~ 26 m visible across the short side.
      const scale = Math.min(W, H) / 26 / PPM;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = area === 'castle' ? '#2e1a2c' : '#a6c98a';
      g.fillRect(0, 0, W, H);
      const focusX = runtime.camera.mode === 'cinematic' ? runtime.camera.look[0] : p.x;
      const focusZ = runtime.camera.mode === 'cinematic' ? runtime.camera.look[2] : p.z;
      g.setTransform(scale, 0, 0, scale, W / 2 - (focusX - b.minX) * PPM * scale, H / 2 - (focusZ - b.minZ) * PPM * scale);
      g.drawImage(layer, 0, 0);
      const toPx = (x: number, z: number): [number, number] => [(x - b.minX) * PPM, (z - b.minZ) * PPM];
      const t = runtime.time;

      // Gates
      const gates = useWorld.getState().gates;
      for (const [id, info] of Object.entries(GATE_INFO)) {
        if (info.area !== area || gates[id as keyof typeof gates]) continue;
        const [x, z] = toPx(info.x, info.z);
        g.save();
        g.translate(x, z);
        g.rotate(-info.rotY);
        g.fillStyle = id === 'hillBridge' ? 'rgba(143,120,184,0.75)' : 'rgba(232,137,158,0.75)';
        g.fillRect((-info.width / 2) * PPM, -0.5 * PPM, info.width * PPM, PPM);
        g.restore();
      }

      // Interactables & markers
      for (const s of useWorld.getState().activeSpots) {
        const spot = SPOT_BY_ID[s.id];
        if (!spot || spot.area !== area) continue;
        const [x, z] = toPx(spot.x, spot.z);
        const pulse = 1 + Math.sin(t * 3 + spot.x) * 0.15;
        g.fillStyle = s.marker === 'quest' ? '#f3c96b' : s.marker === 'item' ? '#f19bb4' : s.marker === 'collectible' ? '#fff1a8' : 'rgba(255,255,255,0.55)';
        g.beginPath();
        g.arc(x, z, (s.marker === 'quest' ? 0.55 : 0.35) * PPM * pulse, 0, Math.PI * 2);
        g.fill();
        if (s.marker === 'quest') {
          g.strokeStyle = 'rgba(255,227,163,0.8)';
          g.lineWidth = 0.12 * PPM;
          g.beginPath();
          g.arc(x, z, 0.95 * PPM * pulse, 0, Math.PI * 2);
          g.stroke();
        }
      }

      // Companion
      const c = runtime.companion;
      if (c.visible && c.mode !== 'absent' && c.area === area) {
        const [x, z] = toPx(c.x, c.z);
        g.fillStyle = 'rgba(60,30,50,0.25)';
        g.beginPath();
        g.ellipse(x + 2, z + 3, 0.5 * PPM, 0.4 * PPM, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#f3e6cf';
        g.beginPath();
        g.arc(x, z, 0.45 * PPM, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#c96d86';
        g.beginPath();
        g.arc(x, z, 0.32 * PPM, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#26202e';
        g.beginPath();
        g.arc(x, z, 0.18 * PPM, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#e2b48f';
        g.beginPath();
        g.arc(x + Math.sin(c.yaw) * 0.22 * PPM, z + Math.cos(c.yaw) * 0.22 * PPM, 0.11 * PPM, 0, Math.PI * 2);
        g.fill();
      }
      // Princess
      {
        const a = appearanceRef.current;
        const [x, z] = toPx(p.x, p.z);
        g.fillStyle = 'rgba(60,30,50,0.25)';
        g.beginPath();
        g.ellipse(x + 2, z + 3, 0.55 * PPM, 0.45 * PPM, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = a.gownColor;
        g.beginPath();
        g.arc(x, z, 0.5 * PPM, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = a.hijabColor;
        g.beginPath();
        g.arc(x, z, 0.3 * PPM, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = a.skinTone;
        g.beginPath();
        g.arc(x + Math.sin(p.yaw) * 0.16 * PPM, z + Math.cos(p.yaw) * 0.16 * PPM, 0.13 * PPM, 0, Math.PI * 2);
        g.fill();
        if (useGameStore.getState().flags.crownAccepted) {
          g.strokeStyle = '#d9b25f';
          g.lineWidth = 0.08 * PPM;
          g.beginPath();
          g.arc(x, z, 0.22 * PPM, 0, Math.PI * 2);
          g.stroke();
          g.fillStyle = a.crownGem;
          g.beginPath();
          g.arc(x, z - 0.22 * PPM, 0.07 * PPM, 0, Math.PI * 2);
          g.fill();
        }
      }
      // Sparkles
      for (const s of runtime.sparkles) {
        const age = t - s.born;
        if (age > 1.5 || s.area !== area) continue;
        const [x, z] = toPx(s.x, s.z);
        g.fillStyle = s.color;
        g.globalAlpha = 1 - age / 1.5;
        for (let k = 0; k < 10; k++) {
          const ang = (k / 10) * Math.PI * 2 + s.id;
          const r = age * 1.6 * PPM;
          g.beginPath();
          g.arc(x + Math.cos(ang) * r, z + Math.sin(ang) * r, 0.12 * PPM, 0, Math.PI * 2);
          g.fill();
        }
        g.globalAlpha = 1;
      }
      // Fireworks (simple bursts in 2D)
      g.setTransform(1, 0, 0, 1, 0, 0);
      const w = runtime.weather;
      if (area === 'overworld') {
        if (w.night > 0.02) {
          g.fillStyle = `rgba(20,16,60,${w.night * 0.5})`;
          g.fillRect(0, 0, W, H);
        }
        if (w.storm > 0.02) {
          g.fillStyle = `rgba(50,60,80,${w.storm * 0.45})`;
          g.fillRect(0, 0, W, H);
          g.strokeStyle = `rgba(210,225,245,${w.storm * 0.5})`;
          g.lineWidth = 1.5;
          for (let i = 0; i < 80 * w.storm; i++) {
            const rx = (i * 97 + t * 400) % W;
            const ry = (i * 61 + t * 900) % H;
            g.beginPath();
            g.moveTo(rx, ry);
            g.lineTo(rx - 4, ry + 14);
            g.stroke();
          }
        }
        if (w.flash > 0.01) {
          g.fillStyle = `rgba(255,255,255,${w.flash * 0.35})`;
          g.fillRect(0, 0, W, H);
        }
        if (w.rainbow > 0.05 && w.storm < 0.3) {
          const grd = g.createLinearGradient(0, 0, W, 0);
          ['#ff8fa8', '#ffc58a', '#ffef8a', '#9fe6a0', '#8fc1ff', '#c3a0ff'].forEach((col, i, arr) => grd.addColorStop(i / (arr.length - 1), col));
          g.globalAlpha = w.rainbow * 0.25;
          g.fillStyle = grd;
          g.fillRect(0, 0, W, 10);
          g.globalAlpha = 1;
        }
        if (runtime.anim.fireworks) {
          for (let i = 0; i < 6; i++) {
            const seed = Math.floor(t * 0.8) + i * 13;
            const life = (t * 0.8 + i * 0.17) % 1;
            const fx = ((seed * 7919) % 1000) / 1000;
            const fy = ((seed * 104729) % 1000) / 1000;
            const cx = W * (0.15 + fx * 0.7);
            const cy = H * (0.1 + fy * 0.35);
            const colors = ['#ff8fb4', '#ffd27a', '#b18cff', '#7fb6ff'];
            g.fillStyle = colors[i % 4];
            g.globalAlpha = 1 - life;
            for (let k = 0; k < 18; k++) {
              const ang = (k / 18) * Math.PI * 2;
              g.beginPath();
              g.arc(cx + Math.cos(ang) * life * 70, cy + Math.sin(ang) * life * 70 + life * life * 20, 2.5, 0, Math.PI * 2);
              g.fill();
            }
            g.globalAlpha = 1;
          }
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      game.topDown = false;
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} className="h-full w-full" aria-label={personalContent.ui.misc.storybookMap} />
      <div className="pointer-events-none absolute bottom-[calc(var(--safe-bottom)+6px)] left-1/2 -translate-x-1/2 rounded-full bg-white/60 px-3 py-0.5 text-[10px] font-semibold text-plum/70">
        {personalContent.ui.misc.storybookMode}
      </div>
    </div>
  );
}
