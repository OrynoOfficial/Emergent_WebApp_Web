import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Strip Vite's auto-injected `/@vite/client` script in dev.
 *
 * On this preview environment, the HTTPS proxy in front of the dev server does
 * not reliably forward the WebSocket upgrade for HMR. Vite's HMR client then
 * sees its socket drop, prints `[vite] server connection lost. Polling for
 * restart...`, and ends up calling `location.reload()` — which surfaces to the
 * user as "the page refreshes itself every minute".
 *
 * `server.hmr: false` is NOT enough on Vite 7.x: the client script is still
 * injected into the HTML and still opens a socket against the page origin.
 * This tiny plugin removes the script tag from index.html during `serve`, so
 * no client ever loads → no socket → no auto-reload.
 *
 * Code changes apply with `sudo supervisorctl restart frontend`.
 */
const stripViteHmrClient = () => ({
  name: 'oryno-strip-vite-hmr-client',
  apply: 'serve',
  transformIndexHtml(html) {
    return html
      .replace(/<script\s+type="module"\s+src="\/@vite\/client"\s*><\/script>\s*/g, '')
      .replace(/<script\s+type="module"\s+src="\/@react-refresh"\s*><\/script>\s*/g, '');
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), stripViteHmrClient()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    hmr: false,
    watch: null,
  },
})
