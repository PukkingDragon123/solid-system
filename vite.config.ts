import { defineConfig } from 'vite';

const SERVER = process.env.LOO_SERVER ?? 'http://localhost:8787';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/ws': { target: SERVER.replace(/^http/, 'ws'), ws: true },
      '/api': { target: SERVER },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
} as any);
