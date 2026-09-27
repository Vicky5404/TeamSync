#!/usr/bin/env node
/**
 * Development runner: incremental `tsc --watch` + `node --watch` on the output.
 * (tsc is used instead of esbuild-based runners because NestJS dependency
 * injection needs `emitDecoratorMetadata`.)
 *
 *   node scripts/dev.mjs [main|worker]
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const entry = process.argv[2] ?? 'main';
if (!['main', 'worker'].includes(entry)) {
  console.error(`Unknown entry "${entry}" (expected "main" or "worker")`);
  process.exit(1);
}
if (!existsSync('.env')) console.warn('[dev] No .env file found — copy .env.example to .env');

const require = createRequire(import.meta.url);
const tscBin = require.resolve('typescript/bin/tsc');
const children = new Set();
let app;

const tsc = spawn(
  process.execPath,
  [tscBin, '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'],
  {
    stdio: ['ignore', 'pipe', 'inherit'],
  },
);
children.add(tsc);

tsc.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text.replace(/^/gm, '[tsc] '));
  if (!app && /Found 0 errors/.test(text)) {
    app = spawn(process.execPath, ['--watch', '--enable-source-maps', `dist/${entry}.js`], {
      stdio: 'inherit',
    });
    children.add(app);
    app.on('exit', (code) => {
      if (code !== null && code !== 0) console.error(`[dev] ${entry} exited with code ${code}`);
    });
  }
});

const shutdown = () => {
  for (const child of children) child.kill();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
