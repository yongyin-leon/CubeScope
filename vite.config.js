import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/cube-viewer.js'),
      formats: ['es'],
      fileName: () => 'cubescope.es.js',
    },
  },
});
