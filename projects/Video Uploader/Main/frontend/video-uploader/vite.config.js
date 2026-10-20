import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/video/',
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
    include: ['src/**/*.test.{js,jsx}'],
  },
  build: {
    rollupOptions: {
      external: [
        '/city-core/city-core.js',
        '/city-core/city-3d.js',
      ],
    },
  },
})
