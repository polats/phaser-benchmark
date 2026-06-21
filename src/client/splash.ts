import { navigateTo, context, requestExpandedMode } from '@devvit/web/client';

// The splash is the lightweight inline view shown in the Reddit feed. Keep it
// fast and dependency-free — the heavy Phaser game lives in game.html and is
// only loaded once the user expands into it.
const title = document.getElementById('title') as HTMLHeadingElement;
const startButton = document.getElementById('start-button') as HTMLButtonElement;
const docsLink = document.getElementById('docs-link') as HTMLSpanElement;
const phaserLink = document.getElementById('phaser-link') as HTMLSpanElement;

startButton.addEventListener('click', (e) => {
  // Expand into the 'game' entrypoint declared in devvit.json.
  requestExpandedMode(e, 'game');
});

docsLink.addEventListener('click', () => navigateTo('https://developers.reddit.com/docs'));
phaserLink.addEventListener('click', () => navigateTo('https://phaser.io'));

title.textContent = `Hey ${context.username ?? 'there'} 👋`;
