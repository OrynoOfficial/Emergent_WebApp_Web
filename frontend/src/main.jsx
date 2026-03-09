import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './styles/global.css';

// Block any Vite dev server full-page reloads
if (typeof window !== 'undefined') {
  // Intercept the Vite client's reload mechanism
  const originalLocationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
  
  // Listen for vite websocket messages that trigger reloads
  const origWebSocket = window.WebSocket;
  window.WebSocket = function(...args) {
    const ws = new origWebSocket(...args);
    const origOnMessage = null;
    
    // Only intercept Vite's websocket (connects to same host)
    const url = args[0] || '';
    if (typeof url === 'string' && (url.includes('vite') || url.includes('ws') && !url.includes('support'))) {
      const origAddEventListener = ws.addEventListener.bind(ws);
      ws.addEventListener = function(type, listener, ...rest) {
        if (type === 'message') {
          const wrappedListener = function(event) {
            try {
              const data = JSON.parse(event.data);
              if (data.type === 'full-reload') {
                console.log('[Oryno] Vite full-reload signal blocked');
                return; // Block the reload
              }
            } catch {}
            return listener.call(this, event);
          };
          return origAddEventListener(type, wrappedListener, ...rest);
        }
        return origAddEventListener(type, listener, ...rest);
      };
    }
    return ws;
  };
  // Preserve WebSocket properties
  window.WebSocket.CONNECTING = origWebSocket.CONNECTING;
  window.WebSocket.OPEN = origWebSocket.OPEN;
  window.WebSocket.CLOSING = origWebSocket.CLOSING;
  window.WebSocket.CLOSED = origWebSocket.CLOSED;
  window.WebSocket.prototype = origWebSocket.prototype;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);