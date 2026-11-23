/**
 * Accept your text changes as the new "approved" content.
 *
 * The content-integrity tests compare the game's text with a saved snapshot
 * (src/test/fixtures/) so that no sentence can disappear by accident. After
 * you INTENTIONALLY edit src/config/personalContent.ts, run:
 *
 *   npm run content:accept
 *
 * It replaces the snapshot with your current text, then runs all the tests.
 * Review what changed with Git before committing (the snapshot diff shows
 * exactly which sentences you edited).
 */
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = join(root, 'src', 'test', 'fixtures');
rmSync(join(fixtures, 'config-baseline.json'), { force: true });
rmSync(join(fixtures, 'text-baseline.json'), { force: true });

const run = (args, env = {}) =>
  spawnSync('npx', ['vitest', 'run', ...args], { cwd: root, stdio: 'inherit', shell: true, env: { ...process.env, ...env } }).status ?? 1;

if (run(['src/test/content-integrity.test.ts'], { GEN_CONTENT_BASELINE: '1' }) !== 0) {
  console.error('\nCould not save the new snapshot.');
  process.exit(1);
}
console.log('\nSnapshot updated. Running all tests…\n');
process.exit(run([]));
