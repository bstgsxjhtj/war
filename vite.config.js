import { defineConfig } from 'vite';

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
    sourcemap: false
  },
  optimizeDeps: {
    exclude: ['three/examples/jsm/postprocessing/SSAOPass.js'],
    esbuildOptions: {
      sourcemap: false
    }
  }
});
