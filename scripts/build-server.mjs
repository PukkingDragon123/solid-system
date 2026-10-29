// Bundles the Node game server (and the server-only content database) into dist/server.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/server/main.ts'],
  outfile: 'dist/server/main.mjs',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
});
