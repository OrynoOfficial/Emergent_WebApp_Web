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
    // HMR over the public preview URL (HTTPS → WSS on 443).
    // The preview is fronted by TLS, so the browser must connect over wss
    // on port 443; without this config the HMR client tries port 3000 (not
    // publicly exposed) and fails silently, requiring a manual frontend
    // restart after every JSX edit.
    hmr: {
      clientPort: 443,
      protocol: 'wss',
      overlay: false,
    },
  },
})
