import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/EnviViewer.js'),
      formats: ['es'],
      fileName: () => 'cubescope.es.js',
    },
  },
});
