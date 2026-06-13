import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './styles/global.css';
import { bootstrapStorage } from './utils/storageBootstrap';

// Hydrate persisted credentials from Capacitor Preferences into localStorage
// before mounting the React tree. On the web this resolves immediately (no-op).
// On native it ensures the app launches signed-in instead of flashing the
// login screen after iOS Safari evicted the WebView cache.
bootstrapStorage().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
