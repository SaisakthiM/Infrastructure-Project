import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  base: '/bank/',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 100
    },
    hmr: {
      clientPort: 3000
    },
    proxy: {
      '/api': {
        target: 'http://bank-backend:8080',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
