/// <reference types="node" />
/**
 * Official logo: the original file is untouched, every derived icon exists at
 * the exact size browsers / iPhone / Android expect, and every path works
 * under the GitHub Pages base path.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRANDING } from '../config/branding';

const ROOT = join(__dirname, '..', '..');
const PUBLIC = join(ROOT, 'public');
const read = (rel: string) => readFileSync(join(PUBLIC, rel));

/** Label under the Home Screen icon (iPhone + Android), chosen by the owner. */
const HOME_SCREEN_NAME = "Sarah's World";
/** SHA-256 of the logo as supplied by the owner (recorded before any work). */
const ORIGINAL_SHA256 = '426570101ab53f4277b6439705cc9147b5400bfbd3b62d0be565cf0c8d7b072d';

function pngSize(buf: Buffer) {
  expect(buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
  expect(buf.subarray(12, 16).toString('latin1')).toBe('IHDR');
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

describe('Official logo files', () => {
  it('the original logo is unchanged', () => {
    const sha = createHash('sha256').update(read(BRANDING.original)).digest('hex');
    expect(sha).toBe(ORIGINAL_SHA256);
    expect(pngSize(read(BRANDING.original))).toEqual({ w: 1254, h: 1254 });
  });

  it('the title screen does not show the logo (icons only, by the owner’s choice)', () => {
    const screens = readFileSync(join(ROOT, 'src', 'components', 'menus', 'Screens.tsx'), 'utf8');
    expect(screens).not.toMatch(/princess-sarah-logo|branding|<picture|<img/);
  });

  it('favicons are square PNGs at 16, 32 and 48 px', () => {
    expect(BRANDING.favicons.map((f) => pngSize(read(f)))).toEqual([
      { w: 16, h: 16 },
      { w: 32, h: 32 },
      { w: 48, h: 48 },
    ]);
  });

  it('iPhone Home Screen icon is a 180 px PNG', () => {
    expect(pngSize(read(BRANDING.appleTouchIcon))).toEqual({ w: 180, h: 180 });
  });
});

describe('Android Web App Manifest', () => {
  const manifest = JSON.parse(read(BRANDING.manifest).toString('utf8'));

  it('has the Home Screen name and relative start/scope (works under any base path)', () => {
    expect(manifest.short_name).toBe(HOME_SCREEN_NAME);
    expect(manifest.short_name).toBe("Sarah's World");
    expect(manifest.name).toBe('A World Made Just For Her');
    expect(manifest.start_url).toBe('./');
    expect(manifest.scope).toBe('./');
    expect(manifest.display).toBe('standalone');
  });

  it('lists 192, 512 and a maskable 512 icon, each existing at its declared size', () => {
    const icons = manifest.icons as Array<{ src: string; sizes: string; purpose: string; type: string }>;
    expect(icons.map((i) => `${i.sizes}:${i.purpose}`).sort()).toEqual(['192x192:any', '512x512:any', '512x512:maskable']);
    for (const icon of icons) {
      expect(icon.src.startsWith('/')).toBe(false); // relative to the manifest, so it follows the base path
      expect(icon.type).toBe('image/png');
      const [w, h] = icon.sizes.split('x').map(Number);
      expect(pngSize(read(icon.src))).toEqual({ w, h });
    }
  });
});

describe('index.html', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const hrefs = [...html.matchAll(/<link\s+rel="(icon|apple-touch-icon|manifest)"[^>]*href="([^"]+)"/g)].map((m) => ({ rel: m[1], href: m[2] }));

  it('links the favicons, the iPhone icon and the manifest', () => {
    expect(hrefs.filter((h) => h.rel === 'icon').map((h) => h.href)).toEqual(BRANDING.favicons.map((f) => `/${f}`));
    expect(hrefs.find((h) => h.rel === 'apple-touch-icon')?.href).toBe(`/${BRANDING.appleTouchIcon}`);
    expect(hrefs.find((h) => h.rel === 'manifest')?.href).toBe(`/${BRANDING.manifest}`);
  });

  it('every linked file exists and uses a root path that Vite prefixes with the base path', () => {
    for (const { href } of hrefs) {
      expect(href.startsWith('/')).toBe(true);
      expect(existsSync(join(PUBLIC, href.slice(1)))).toBe(true);
    }
  });

  it('names the iPhone Home Screen icon "Sarah\'s World"', () => {
    expect(html).toContain(`<meta name="apple-mobile-web-app-title" content="${HOME_SCREEN_NAME}" />`);
  });
});
