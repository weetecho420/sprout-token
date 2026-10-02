import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// The app is served at sprouttoken.netlify.app/app/ and built into the
// landing site's folder, so Netlify publishes both together.
export default defineConfig({
  base: '/app/',
  plugins: [react(), nodePolyfills({ include: ['buffer', 'crypto', 'stream', 'util', 'events', 'process'], globals: { Buffer: true } })],
  build: {
    outDir: '../site/app',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2500,
  },
});
