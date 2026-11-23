/// <reference types="node" />
/**
 * Helpers for the content-integrity safety net (see content-integrity.test.ts).
 *
 * 1. configSnapshot() — every player-visible text value exposed by the game's
 *    configuration (names, letters, dialogue, quests, items, locations), as
 *    the game actually resolves it.
 * 2. extractSourceTexts() — every human-readable string literal / JSX text in
 *    the source tree, found with the TypeScript compiler (not regexes).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { dialogueConfig } from '../config/dialogueConfig';
import { gameConfig } from '../config/gameConfig';
import { ITEMS, QUESTS } from '../config/questConfig';
import { LOCATION_INFO } from '../systems/WorldManager/locations';

export function configSnapshot() {
  return JSON.parse(
    JSON.stringify({
      gameConfig,
      dialogueConfig,
      quests: QUESTS.map((q) => ({
        id: q.id,
        chapter: q.chapter,
        name: q.name,
        description: q.description,
        hint: q.hint,
        objectives: q.objectives.map((o) => ({ id: o.id, text: o.text, target: o.target })),
        rewards: q.rewards,
      })),
      items: ITEMS,
      locations: Object.fromEntries(Object.entries(LOCATION_INFO).map(([k, v]) => [k, { name: v.name, english: v.english, description: v.description }])),
    }),
  );
}

const SRC = join(__dirname, '..');

function walk(dir: string, out: string[] = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'test') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Does this look like text a player could read (vs. ids, CSS classes, paths)? */
export function isHumanText(s: string) {
  const t = s.trim();
  if (t.length < 2 || !/\p{L}/u.test(t)) return false;
  if (/^[a-z0-9_.:/#\-[\]()%!,+*=<>@$&|^~?{}']+$/.test(t) && !/\s/.test(t)) return false; // identifiers, paths, colours
  if (/^(\.{0,2}\/|@|https?:)/.test(t)) return false;
  // Tailwind / CSS class lists: every token is class-like and at least one has a dash or colon.
  const tokens = t.split(/\s+/);
  if (tokens.every((w) => /^[!a-z0-9:\-[\]/.%()#_,+]+$/.test(w)) && tokens.some((w) => /[-:[]/.test(w))) return false;
  // GLSL / CSS snippets
  if (/(gl_|vec[234]|uniform |varying |rgba\(|translate\(|\bpx\b.*;)/.test(t)) return false;
  return /\s/.test(t) || /\p{Lu}/u.test(t) || /[^\x00-\x7F]/.test(t);
}

/** All human-readable texts per file, extracted with the TypeScript AST. */
export function extractSourceTexts(): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const file of walk(SRC)) {
    const code = readFileSync(file, 'utf8');
    const sf = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const found = new Set<string>();
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
      // Skip className="..." and other purely presentational attributes.
      if (ts.isJsxAttribute(node) && ['className', 'd', 'viewBox', 'href', 'src'].includes(node.name.getText(sf))) return;
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (isHumanText(node.text)) found.add(node.text);
      } else if (ts.isTemplateExpression(node)) {
        for (const piece of [node.head.text, ...node.templateSpans.map((s) => s.literal.text)]) if (isHumanText(piece)) found.add(piece);
      } else if (ts.isJsxText(node)) {
        const text = node.text.replace(/\s+/g, ' ').trim();
        if (isHumanText(text)) found.add(text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    if (found.size) result[relative(SRC, file).replace(/\\/g, '/')] = [...found].sort();
  }
  return result;
}

/** Concatenated source of every non-test file (to check a text still exists somewhere). */
export function allSourceCode() {
  return walk(SRC)
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
}
