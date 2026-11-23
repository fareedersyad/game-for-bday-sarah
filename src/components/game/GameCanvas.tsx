import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { useSettings } from '../../stores/settingsStore';
import { useWorld } from '../../stores/worldStore';
import { game } from '../../systems/GameLoop/game';
import { input } from '../../systems/input';
import { autoQuality } from '../../utils/device';
import { CameraRig } from './CameraRig';
import { Characters } from './Characters';
import { Effects } from './Effects';
import { Environment } from './Environment';
import { Markers } from './Markers';
import { QUALITY, QualityContext } from './quality';
import { Overworld } from '../../scenes/Overworld';
import { CastleInterior } from '../../scenes/CastleScene/CastleInterior';

interface Props {
  onReady: () => void;
  onProgress: (p: number) => void;
  onContextLost: () => void;
}

/** Drives the renderer-agnostic simulation from the R3F frame loop. */
function SimDriver() {
  useFrame((_, dt) => game.step(dt), -10);
  return null;
}

function ReadySignal({ onReady }: { onReady: () => void }) {
  const frames = useRef(0);
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    if (++frames.current > 3) {
      done.current = true;
      onReady();
    }
  });
  return null;
}

function ContextWatcher({ onLost }: { onLost: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      onLost();
    };
    el.addEventListener('webglcontextlost', lost);
    return () => el.removeEventListener('webglcontextlost', lost);
  }, [gl, onLost]);
  return null;
}

function AreaContent() {
  const area = useWorld((s) => s.area);
  return area === 'castle' ? <CastleInterior /> : <Overworld />;
}

export default function GameCanvas({ onReady, onProgress, onContextLost }: Props) {
  const graphics = useSettings((s) => s.graphics);
  const tier = graphics === 'auto' ? autoQuality() : graphics;
  const quality = QUALITY[tier];
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => onProgress(0.7), [onProgress]);

  // Camera drag (mouse / touch) and pinch / wheel zoom on the canvas surface.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef<number | null>(null);
  const handlers = useMemo(
    () => ({
      onPointerDown: (e: React.PointerEvent) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      },
      onPointerMove: (e: React.PointerEvent) => {
        const prev = pointers.current.get(e.pointerId);
        if (!prev) return;
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size >= 2) {
          const pts = [...pointers.current.values()];
          const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          if (pinchDist.current !== null) input.zoomDelta += (pinchDist.current - d) * 2.2;
          pinchDist.current = d;
          return;
        }
        const scale = e.pointerType === 'touch' ? 1.25 : 1;
        input.camDX += (e.clientX - prev.x) * scale;
        input.camDY += (e.clientY - prev.y) * scale;
      },
      onPointerUp: (e: React.PointerEvent) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinchDist.current = null;
      },
      onPointerCancel: (e: React.PointerEvent) => {
        pointers.current.delete(e.pointerId);
        pinchDist.current = null;
      },
      onWheel: (e: React.WheelEvent) => {
        input.zoomDelta += e.deltaY;
      },
    }),
    [],
  );

  return (
    <div ref={wrapRef} className="absolute inset-0" {...handlers} onContextMenu={(e) => e.preventDefault()}>
      <QualityContext.Provider value={quality}>
        <Canvas
          key={tier}
          dpr={quality.dpr}
          shadows={quality.shadows ? 'soft' : false}
          gl={{ antialias: quality.antialias, powerPreference: 'high-performance', alpha: false, stencil: false, preserveDrawingBuffer: false }}
          camera={{ fov: 52, near: 0.1, far: 420, position: [0, 8, 32] }}
          onCreated={({ gl, scene }) => {
            gl.toneMapping = THREE.ACESFilmicToneMapping;
            gl.toneMappingExposure = 0.98;
            gl.outputColorSpace = THREE.SRGBColorSpace;
            scene.background = new THREE.Color('#f6d3dc');
            // Soft studio reflections so gold & rose-gold read as polished metal.
            const pmrem = new THREE.PMREMGenerator(gl);
            const env = new RoomEnvironment();
            scene.environment = pmrem.fromScene(env, 0.04).texture;
            scene.environmentIntensity = 0.35;
            env.dispose();
            pmrem.dispose();
            // Renderer stats for diagnostics / the automated performance check.
            (window as unknown as Record<string, unknown>).__awmjfhRenderer = gl;
            onProgress(0.9);
          }}
        >
          <QualityContext.Provider value={quality}>
            <SimDriver />
            <ContextWatcher onLost={onContextLost} />
            <CameraRig />
            <Environment />
            <AreaContent />
            <Characters />
            <Markers />
            <Effects />
            <ReadySignal onReady={onReady} />
          </QualityContext.Provider>
        </Canvas>
      </QualityContext.Provider>
    </div>
  );
}
