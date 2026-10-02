import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: false,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        tutorial: resolve(__dirname, 'tutorial.html'),
      },
    },
  },
  optimizeDeps: {
    exclude: ['three/examples/jsm/postprocessing/SSAOPass.js'],
    esbuildOptions: {
      sourcemap: false
    }
  }
});
