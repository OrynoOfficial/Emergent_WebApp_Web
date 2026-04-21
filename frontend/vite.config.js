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
    // HMR client connects over the public preview URL (HTTPS → WSS on 443)
    // so the browser console stays clean (no ERR_UNSAFE_PORT).  `overlay: false`
    // prevents the red dev error overlay from hijacking the user's view.
    hmr: {
      clientPort: 443,
      protocol: 'wss',
      overlay: false,
    },
    // File-system watching is INTENTIONALLY DISABLED.  On this shared preview
    // environment any incidental file touch (editor save, code-gen, git
    // checkout, testing agent) would otherwise fire HMR → full page reload,
    // which surfaced as "the page refreshes on its own every few minutes".
    // Supervisor restarts still apply source changes on demand.
    watch: null,
  },
})
