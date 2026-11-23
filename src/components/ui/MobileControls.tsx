import { Hand, Heart } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useUI } from '../../stores/uiStore';
import { game } from '../../systems/GameLoop/game';
import { input } from '../../systems/input';
import { personalContent } from '../../config/personalContent';

const MC = personalContent.ui.mobile;

const RADIUS = 58;

/**
 * Virtual joystick (bottom-left) + interact / talk buttons (bottom-right).
 * Uses Pointer Events with pointer capture, so it works with touch, pen and
 * mouse and supports multi-touch (move with one thumb, look with the other).
 */
export function MobileControls() {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, active: false });
  const pointerId = useRef<number | null>(null);
  const prompt = useUI((s) => s.prompt);
  const companionNear = useUI((s) => s.companionNear);
  const blocked = useUI((s) => s.panel !== null || s.overlays.length > 0 || !!s.cutscene?.active);
  const dialogue = useUI((s) => s.dialogue !== null);

  const update = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let dx = clientX - (r.left + r.width / 2);
    let dy = clientY - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      dx = (dx / d) * RADIUS;
      dy = (dy / d) * RADIUS;
    }
    const nx = dx / RADIUS;
    const ny = -dy / RADIUS;
    const mag = Math.hypot(nx, ny);
    // Small dead zone, then rescale so gentle pushes still move slowly.
    const dead = 0.12;
    const scale = mag < dead ? 0 : (mag - dead) / (1 - dead) / (mag || 1);
    input.stick.x = nx * scale;
    input.stick.y = ny * scale;
    input.stick.active = true;
    input.sprint = mag > 0.97;
    setKnob({ x: dx, y: dy, active: true });
  };

  const release = () => {
    pointerId.current = null;
    input.stick.x = input.stick.y = 0;
    input.stick.active = false;
    input.sprint = false;
    setKnob({ x: 0, y: 0, active: false });
  };

  useEffect(() => release, []);
  useEffect(() => {
    if (blocked) release();
  }, [blocked]);

  return (
    <div className="pointer-events-none absolute inset-0 z-[18]">
      {!blocked && !dialogue && (
        <div
          ref={baseRef}
          className="pointer-events-auto absolute flex items-center justify-center rounded-full"
          style={{
            left: 'max(22px, calc(var(--safe-left) + 14px))',
            bottom: 'max(26px, calc(var(--safe-bottom) + 16px))',
            width: RADIUS * 2 + 24,
            height: RADIUS * 2 + 24,
            background: 'radial-gradient(circle, rgba(255,250,244,0.35) 0%, rgba(255,250,244,0.18) 60%, rgba(212,168,79,0.15) 100%)',
            border: '1.5px solid rgba(243, 220, 164, 0.75)',
            boxShadow: '0 8px 26px -12px rgba(74,28,60,0.6)',
            touchAction: 'none',
          }}
          onPointerDown={(e) => {
            if (pointerId.current !== null) return;
            pointerId.current = e.pointerId;
            e.currentTarget.setPointerCapture(e.pointerId);
            update(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (e.pointerId === pointerId.current) update(e.clientX, e.clientY);
          }}
          onPointerUp={(e) => e.pointerId === pointerId.current && release()}
          onPointerCancel={(e) => e.pointerId === pointerId.current && release()}
          onLostPointerCapture={(e) => e.pointerId === pointerId.current && release()}
          aria-label={MC.joystick}
          role="application"
        >
          <div
            className="rounded-full"
            style={{
              width: 58,
              height: 58,
              transform: `translate(${knob.x}px, ${knob.y}px)`,
              transition: knob.active ? 'none' : 'transform 0.18s ease-out',
              background: 'linear-gradient(180deg, #fff6e0, #e8c27a)',
              border: '1.5px solid rgba(168,124,42,0.8)',
              boxShadow: '0 6px 16px -6px rgba(120,70,30,0.8), inset 0 1px 0 rgba(255,255,255,0.8)',
            }}
          />
        </div>
      )}

      {!blocked && (
        <div
          className="pointer-events-auto absolute flex flex-col items-center gap-3"
          style={{ right: 'max(22px, calc(var(--safe-right) + 14px))', bottom: 'max(30px, calc(var(--safe-bottom) + 18px))' }}
        >
          {companionNear && !dialogue && (
            <button
              className="flex h-14 w-14 items-center justify-center rounded-full rose-btn !p-0"
              onClick={() => game.talk()}
              aria-label={MC.talk}
            >
              <Heart size={24} className="fill-current" />
            </button>
          )}
          <button
            className={`flex h-[74px] w-[74px] flex-col items-center justify-center rounded-full royal-btn !p-0 ${prompt || dialogue ? 'pulse-ring' : 'opacity-70'}`}
            onClick={() => game.interact()}
            aria-label={dialogue ? MC.next : prompt?.label ?? MC.interact}
          >
            <Hand size={26} />
            <span className="text-[10px] font-black uppercase tracking-wider">{dialogue ? MC.nextShort : MC.interactShort}</span>
          </button>
        </div>
      )}
    </div>
  );
}
