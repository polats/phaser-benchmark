import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './react/App';

// React entry for the expanded `game` view. Mounts the HUD shell, which in turn
// mounts the Phaser game via the PhaserGame bridge component.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
