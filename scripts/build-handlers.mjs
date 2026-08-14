#!/usr/bin/env node
// scripts/build-handlers.mjs
//
// Bundles TypeScript Lambda handlers into plain, pre-compiled JS so they can
// be deployed via SharedLambda's `code` prop (lambda.Code.fromAsset()).
// SharedLambda refuses to run a `.ts` entry directly -- the nodejs20.x
// runtime can't execute TypeScript, and SharedLambda enforces that at synth
// time (see lib/foundation/constructs/shared-lambda.ts).
//
// Run via `npm run build` (chained after `tsc`) or standalone:
//   node scripts/build-handlers.mjs
//
// Add new handlers to the HANDLERS list below as they're needed -- each one
// becomes its own self-contained bundle under dist/, matching the directory
// that the corresponding SharedLambda `code: lambda.Code.fromAsset(...)`
// prop should point at.

import { build } from 'esbuild';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const HANDLERS = [
  {
    name: 'auth-authorizer',
    entry: path.join(root, 'src/auth/authorizer/index.ts'),
    outdir: path.join(root, 'dist/auth/authorizer'),
  },
  {
    name: 'storage-upload-url',
    entry: path.join(root, 'src/storage/upload-url/index.ts'),
    outdir: path.join(root, 'dist/storage/upload-url'),
  },
  {
    name: 'storage-download-url',
    entry: path.join(root, 'src/storage/download-url/index.ts'),
    outdir: path.join(root, 'dist/storage/download-url'),
  },
];

async function main() {
  for (const h of HANDLERS) {
    await build({
      entryPoints: [h.entry],
      outdir: h.outdir,
      bundle: true,
      platform: 'node',
      target: 'node20',
      format: 'cjs',
      sourcemap: false,
      external: ['aws-sdk'],
    });
    console.log(
      `[build-handlers] ${h.name}: ${path.relative(root, h.entry)} -> ${path.relative(root, h.outdir)}/index.js`,
    );
  }
}

main().catch((err) => {
  console.error('[build-handlers] failed:', err);
  process.exit(1);
});