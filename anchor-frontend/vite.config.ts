import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
    }),
    react(),
  ],
  resolve: {
    dedupe: ['@noble/curves', '@noble/hashes', '@scure/base', 'buffer', 'react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['buffer'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          opnet: ['opnet'],
          'btc-vision': ['@btc-vision/bitcoin', '@btc-vision/transaction'],
        },
      },
    },
  },
});
