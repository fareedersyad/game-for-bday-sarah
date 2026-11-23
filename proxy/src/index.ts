/**
 * Worker entry point. Only the default export is exposed: Cloudflare treats
 * named exports of a Worker module as special entrypoints, so helpers stay
 * internal (they are exported from worker.ts for the tests only).
 */
import worker from './worker';

export default worker;
