import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/runtime/viewer-worker.js'),
      formats: ['es'],
      fileName: () => 'worker.js',
    },
    rollupOptions: {
      output: {
        codeSplitting: false,
      },
    },
  },
});
