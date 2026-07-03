import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // listens on all network interfaces
    port: 5173,
    strictPort: true,
    hmr: {
      host: 'localhost',  // HMR client points back to your host
      port: 5173,
    },
    watch: {
      usePolling: true,   // ✅ enables HMR for Docker + Windows
      interval: 100,      // optional, checks every 100ms
    },
  },
})
