import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './styles/global.css';

// Block Vite dev server full-page reloads via WebSocket interception
if (typeof window !== 'undefined') {
  const OrigWS = window.WebSocket;
  window.WebSocket = function(...args) {
    const ws = new OrigWS(...args);
    // Intercept onmessage property
    let _onmessage = null;
    Object.defineProperty(ws, 'onmessage', {
      get: () => _onmessage,
      set: (fn) => {
        _onmessage = function(event) {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'full-reload') { console.log('[Oryno] Blocked Vite full-reload'); return; }
          } catch {}
          return fn.call(this, event);
        };
      }
    });
    // Intercept addEventListener
    const origAdd = ws.addEventListener.bind(ws);
    ws.addEventListener = function(type, listener, ...rest) {
      if (type === 'message') {
        const wrapped = function(event) {
          try {
            const d = JSON.parse(event.data);
            if (d.type === 'full-reload') { console.log('[Oryno] Blocked Vite full-reload'); return; }
          } catch {}
          return listener.call(this, event);
        };
        return origAdd(type, wrapped, ...rest);
      }
      return origAdd(type, listener, ...rest);
    };
    return ws;
  };
  window.WebSocket.CONNECTING = OrigWS.CONNECTING;
  window.WebSocket.OPEN = OrigWS.OPEN;
  window.WebSocket.CLOSING = OrigWS.CLOSING;
  window.WebSocket.CLOSED = OrigWS.CLOSED;
  window.WebSocket.prototype = OrigWS.prototype;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
