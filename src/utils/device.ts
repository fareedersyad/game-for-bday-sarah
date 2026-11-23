/** Device / capability detection. All functions are safe to call during SSR or tests. */

const hasWindow = typeof window !== 'undefined';
const nav: Navigator | undefined = typeof navigator !== 'undefined' ? navigator : undefined;

export function prefersReducedMotion(): boolean {
  try {
    return hasWindow && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function isTouchDevice(): boolean {
  if (!hasWindow) return false;
  try {
    return 'ontouchstart' in window || (nav?.maxTouchPoints ?? 0) > 0 || window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export function isIOS(): boolean {
  if (!nav) return false;
  const ua = nav.userAgent || '';
  // iPadOS 13+ reports itself as Mac; detect via touch points.
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && (nav.maxTouchPoints ?? 0) > 1);
}

export function isMobileLike(): boolean {
  if (!hasWindow) return false;
  const small = Math.min(window.innerWidth, window.innerHeight) < 820;
  return isTouchDevice() && small;
}

export interface WebGLSupport {
  supported: boolean;
  webgl2: boolean;
  maxTextureSize: number;
  renderer: string;
  /** Heuristic: software renderers and very old GPUs. */
  weak: boolean;
}

let cachedGL: WebGLSupport | null = null;

export function detectWebGL(): WebGLSupport {
  if (cachedGL) return cachedGL;
  const result: WebGLSupport = { supported: false, webgl2: false, maxTextureSize: 0, renderer: 'none', weak: true };
  if (!hasWindow || typeof document === 'undefined') return (cachedGL = result);
  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2') as WebGL2RenderingContext | null;
    const gl = (gl2 ?? canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    if (gl) {
      result.supported = true;
      result.webgl2 = !!gl2;
      result.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      result.renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown';
      const r = result.renderer.toLowerCase();
      // SwiftShader / llvmpipe are software rasterisers: playable but slow.
      result.weak = r.includes('swiftshader') || r.includes('llvmpipe') || r.includes('software') || result.maxTextureSize < 4096;
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    result.supported = false;
  }
  return (cachedGL = result);
}

export type QualityTier = 'low' | 'medium' | 'high';

/** Pick a sensible default graphics tier for this device. */
export function autoQuality(): QualityTier {
  const gl = detectWebGL();
  if (!gl.supported || gl.weak) return 'low';
  const mem = (nav as Navigator & { deviceMemory?: number } | undefined)?.deviceMemory;
  const cores = nav?.hardwareConcurrency ?? 4;
  if (isMobileLike()) return mem !== undefined && mem >= 6 && cores >= 6 ? 'medium' : 'low';
  if (isTouchDevice()) return 'medium'; // tablets
  if ((mem !== undefined && mem < 4) || cores <= 2) return 'medium';
  return 'high';
}
