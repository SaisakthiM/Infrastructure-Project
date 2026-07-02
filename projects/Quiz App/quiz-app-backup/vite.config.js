import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  base: '/quiz/',
  plugins: [
    react(),
    // Only stub CSS during tests — never in production build
    mode === 'test' ? {
      name: 'css-stub',
      enforce: 'pre',
      resolveId(id) {
        if (id.endsWith('.css')) return id;
      },
      load(id) {
        if (id.endsWith('.css')) return 'export default {}';
      },
    } : null,
  ].filter(Boolean),
  server: {
    host: true,
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
    deps: {
        inline: ['react-router-dom']  // ← forces Vitest to inline instead of SSR transform
    }
  },
}));