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
    // HMR is fully DISABLED on this preview environment. The HTTPS proxy in
    // front of the dev server does not reliably forward the WSS handshake;
    // when the HMR client loses its socket, Vite's recovery path triggers
    // `location.reload()` — which is what users were seeing as "the system
    // refreshes at intervals". With hmr:false the client never opens a
    // socket and never auto-reloads. Code changes apply on the next
    // `sudo supervisorctl restart frontend`.
    hmr: false,
    watch: null,
  },
})
