import { gameConfig } from '../config/gameConfig';

const TOKENS: Record<string, () => string> = {
  HER_NAME: () => gameConfig.HER_NAME,
  HER_NICKNAME: () => gameConfig.HER_NICKNAME,
  YOUR_NAME: () => gameConfig.YOUR_NAME,
  YOUR_NICKNAME: () => gameConfig.YOUR_NICKNAME,
};

/** Replace {HER_NAME}-style tokens with values from gameConfig. Unknown tokens are left as-is. */
export function fill(text: string): string {
  return text.replace(/\{([A-Z_]+)\}/g, (m, key: string) => (TOKENS[key] ? TOKENS[key]() : m));
}

export function paragraphs(text: string): string[] {
  return fill(text)
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function formatBirthday(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  const months = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Fill a text from personalContent.ts: {HER_NAME}-style tokens (see fill) plus
 * lower-case placeholders such as {count} or {title} supplied by the game.
 * Unknown placeholders are left untouched so a typo is visible, never fatal.
 */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return fill(template).replace(/\{([a-z][a-zA-Z]*)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
}
