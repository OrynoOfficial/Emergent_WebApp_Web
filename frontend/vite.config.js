import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: {
      // Point the client to an unreachable port so it can never connect
      // This prevents ALL Vite-triggered page reloads
      clientPort: 1,
      host: '127.0.0.1',
      overlay: false,
    },
    watch: null,
  },
})
