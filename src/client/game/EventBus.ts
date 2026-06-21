import { Events } from 'phaser';

// Single shared emitter used to pass messages between React (the HUD shell) and
// Phaser scenes. Scenes emit; React listens (and vice-versa). Keep the event
// names and payloads in `./events.ts` so both sides stay in sync.
export const EventBus = new Events.EventEmitter();
