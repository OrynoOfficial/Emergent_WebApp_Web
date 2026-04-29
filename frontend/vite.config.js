import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Disable Vite's HMR / React-Refresh client at the module-graph level.
 *
 * On this preview environment, the HTTPS proxy in front of the dev server does
 * not reliably forward the WebSocket upgrade for HMR. Vite's HMR client then
 * sees its socket drop, prints `[vite] server connection lost. Polling for
 * restart...`, and ends up calling `location.reload()` — the user sees this as
 * "the page refreshes itself every minute".
 *
 * `server.hmr: false` is NOT enough on Vite 7.x: `@vitejs/plugin-react` injects
 * a `/@react-refresh` preamble into every JSX module, which itself imports
 * `/@vite/client`, so the client still ends up running. Stripping the HTML
 * `<script>` tags is also not enough for the same reason.
 *
 * This plugin replaces both virtual modules with inert stubs at the dev
 * middleware level, so any module that imports them gets a no-op object — no
 * socket is opened, no listeners are registered, no auto-reload ever happens.
 *
 * Code changes apply with `sudo supervisorctl restart frontend`.
 */
const VITE_CLIENT_STUB = `
// Stubbed by oryno-disable-vite-hmr-client (preview env).
// We only neutralise the WebSocket / hot-update plumbing.  CSS injection
// (updateStyle / removeStyle) MUST stay functional, otherwise Tailwind and
// every other dev CSS module gets imported but never applied to the DOM.
const noop = () => {};
const noopHot = () => ({
  accept: noop, acceptExports: noop, dispose: noop, prune: noop,
  decline: noop, invalidate: noop, on: noop, off: noop, send: noop,
  data: {},
});
export const injectQuery = (url) => url;
export const createHotContext = noopHot;

const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
  } else {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}

export const ErrorOverlay = class { constructor(){} close(){} };
export default {};
`;

const REACT_REFRESH_STUB = `
// Stubbed by oryno-disable-vite-hmr-client (preview env).
export const injectIntoGlobalHook = () => {};
export const performReactRefresh = () => {};
export const isLikelyComponentType = () => false;
export const getFamilyByType = () => undefined;
export const register = () => {};
export const setSignature = () => {};
export const getRefreshReg = () => () => {};
export const getRefreshSig = () => () => () => {};
export default {};
`;

const disableViteHmrClient = () => ({
  name: 'oryno-disable-vite-hmr-client',
  apply: 'serve',
  // Strip the HTML tags too (belt-and-suspenders — even if some browser
  // extension injects it, the module-level stubs still neutralize it).
  transformIndexHtml(html) {
    return html
      .replace(/<script\s+type="module"\s+src="\/@vite\/client"\s*><\/script>\s*/g, '')
      .replace(/<script\s+type="module"\s+src="\/@react-refresh"\s*><\/script>\s*/g, '');
  },
  // Intercept the dev-server requests for the two virtual modules and serve
  // an inert stub instead of the real HMR client / React Refresh runtime.
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url || '';
      if (url.startsWith('/@vite/client') || url === '/@vite/client') {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'no-cache');
        res.statusCode = 200;
        res.end(VITE_CLIENT_STUB);
        return;
      }
      if (url.startsWith('/@react-refresh') || url === '/@react-refresh') {
        res.setHeader('Content-Type', 'application/javascript');
        res.setHeader('Cache-Control', 'no-cache');
        res.statusCode = 200;
        res.end(REACT_REFRESH_STUB);
        return;
      }
      next();
    });
  },
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), disableViteHmrClient()],
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
