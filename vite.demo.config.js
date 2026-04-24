import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: resolve(__dirname, 'examples'),
  publicDir: resolve(__dirname, 'public'),
  base: process.env.CUBESCOPE_DEMO_BASE ?? './',
  build: {
    outDir: resolve(__dirname, 'demo-dist'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
