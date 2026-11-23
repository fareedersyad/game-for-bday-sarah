import type { Appearance } from '../../stores/progressTypes';
import { personalContent } from '../../config/personalContent';

/** Elegant SVG portrait of the Princess in hijab and crown (used in UI & 2D mode). */
export function PrincessPortrait({ a, crowned = true, size = 120 }: { a: Appearance; crowned?: boolean; size?: number }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 100 125" aria-label={personalContent.ui.misc.portrait} role="img">
      <defs>
        <linearGradient id="pp-gown" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a.gownColor} />
          <stop offset="1" stopColor={shade(a.gownColor, -18)} />
        </linearGradient>
        <linearGradient id="pp-hijab" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={shade(a.hijabColor, 6)} />
          <stop offset="1" stopColor={shade(a.hijabColor, -10)} />
        </linearGradient>
        <linearGradient id="pp-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1c4" />
          <stop offset="1" stopColor="#c99a3f" />
        </linearGradient>
      </defs>
      {/* Gown */}
      <path d="M20 125 C22 92 32 76 50 74 C68 76 78 92 80 125 Z" fill="url(#pp-gown)" />
      <path d="M36 82 Q50 92 64 82" fill="none" stroke={a.gownAccent} strokeWidth="2.4" />
      <path d="M50 88 L50 125" stroke={a.gownAccent} strokeWidth="1.2" opacity="0.6" />
      {/* Hijab drape */}
      <path d="M26 66 C24 40 34 22 50 22 C66 22 76 40 74 66 C70 84 30 84 26 66 Z" fill="url(#pp-hijab)" />
      <path d="M28 70 C34 82 66 82 72 70" fill="none" stroke={a.hijabTrim} strokeWidth="1.6" />
      {/* Face */}
      <ellipse cx="50" cy="48" rx="15" ry="17" fill={a.skinTone} />
      <path d="M35 44 C36 30 64 30 65 44 C62 36 38 36 35 44 Z" fill={shade(a.hijabColor, -4)} />
      <ellipse cx="44" cy="49" rx="1.7" ry="2.2" fill="#4a2c45" />
      <ellipse cx="56" cy="49" rx="1.7" ry="2.2" fill="#4a2c45" />
      <path d="M41.5 45.5 Q44 44.3 46.5 45.5 M53.5 45.5 Q56 44.3 58.5 45.5" stroke="#6b4a55" strokeWidth="0.8" fill="none" />
      <ellipse cx="40.5" cy="55" rx="3.2" ry="1.8" fill="#f2a1b4" opacity="0.55" />
      <ellipse cx="59.5" cy="55" rx="3.2" ry="1.8" fill="#f2a1b4" opacity="0.55" />
      <path d="M46 57.5 Q50 60.5 54 57.5" stroke="#c76a83" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* Crown */}
      {crowned && (
        <g transform="translate(50 24)">
          <path d="M-14 4 L-12 -7 L-6 -1 L0 -10 L6 -1 L12 -7 L14 4 Z" fill="url(#pp-gold)" stroke="#a87c2a" strokeWidth="0.8" strokeLinejoin="round" />
          <rect x="-14" y="3" width="28" height="3.4" rx="1" fill="url(#pp-gold)" stroke="#a87c2a" strokeWidth="0.6" />
          <circle cx="0" cy="-2" r="2.1" fill={a.crownGem} />
          <circle cx="-8" cy="1" r="1.4" fill={a.crownGem} />
          <circle cx="8" cy="1" r="1.4" fill={a.crownGem} />
          <circle cx="0" cy="-10" r="1.2" fill="#fffaf0" />
          <circle cx="-12" cy="-7" r="1" fill="#fffaf0" />
          <circle cx="12" cy="-7" r="1" fill="#fffaf0" />
        </g>
      )}
    </svg>
  );
}

export function shade(hex: string, percent: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  if (Number.isNaN(n)) return hex;
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (percent / 100) * 255)));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
