import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// The app is served at sprouttoken.netlify.app/app/ and built into the
// landing site's folder, so Netlify publishes both together.
// APP_BASE / APP_OUT let the private mainnet test build go to /mainnet-test/ instead.
const base = process.env.APP_BASE || '/app/';
const outDir = process.env.APP_OUT || '../site/app';

export default defineConfig({
  base,
  plugins: [react(), nodePolyfills({ include: ['buffer', 'crypto', 'stream', 'util', 'events', 'process'], globals: { Buffer: true } })],
  build: {
    outDir,
    emptyOutDir: true,
    chunkSizeWarningLimit: 2500,
  },
});
