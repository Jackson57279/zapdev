import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

/**
 * @inngest/agent-kit 0.13.1 uses `asyncCtx.ctx.step` without guarding that
 * `ctx` exists, which can throw "Cannot read properties of undefined
 * (reading 'step')" when the async context is missing (eg. when the agent
 * code runs outside an Inngest execution).
 *
 * This script patches the compiled bundle to use optional chaining so that
 * we gracefully return `undefined` instead of crashing.
 */
const target = join(
  process.cwd(),
  'node_modules',
  '@inngest',
  'agent-kit',
  'dist',
  'chunk-66H2UYBW.js',
);

const needle = 'return asyncCtx == null ? void 0 : asyncCtx.ctx.step;';
const replacement = 'return asyncCtx == null ? void 0 : asyncCtx.ctx?.step;';

if (!existsSync(target)) {
  console.warn(`[patch-agent-kit] Skipped: ${target} not found (dependency not installed yet).`);
  process.exit(0);
}

const contents = readFileSync(target, 'utf8');

if (contents.includes(replacement)) {
  console.info('[patch-agent-kit] Already patched.');
  process.exit(0);
}

if (!contents.includes(needle)) {
  console.warn('[patch-agent-kit] Patch target not found; the library version may have changed.');
  process.exit(1);
}

writeFileSync(target, contents.replace(needle, replacement), 'utf8');
console.info('[patch-agent-kit] Patched @inngest/agent-kit getStepTools to guard missing ctx.');
