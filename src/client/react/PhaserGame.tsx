import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import type { Game, Scene } from 'phaser';
import { StartGame } from '../game/main';
import { EventBus } from '../game/EventBus';
import { GameEvents, type SceneReadyPayload } from '../game/events';

export type PhaserGameHandle = {
  game: Game | null;
  scene: Scene | null;
};

type Props = {
  onSceneReady?: (scene: Scene) => void;
};

// Bridge component: owns the Phaser.Game lifecycle and exposes the live game +
// active scene to React via a ref. Pattern adapted from phaserjs/template-react-ts,
// hardened with useImperativeHandle so callers get a stable handle.
export const PhaserGame = forwardRef<PhaserGameHandle, Props>(function PhaserGame(
  { onSceneReady },
  ref
) {
  const gameRef = useRef<Game | null>(null);
  const sceneRef = useRef<Scene | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      get game() {
        return gameRef.current;
      },
      get scene() {
        return sceneRef.current;
      },
    }),
    []
  );

  useLayoutEffect(() => {
    if (gameRef.current === null) {
      gameRef.current = StartGame('game-container');
      if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
        (window as Window & { __game?: unknown }).__game = gameRef.current;
      }
    }
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handler = (scene: SceneReadyPayload) => {
      sceneRef.current = scene;
      onSceneReady?.(scene);
    };
    EventBus.on(GameEvents.SceneReady, handler);
    return () => {
      EventBus.off(GameEvents.SceneReady, handler);
    };
  }, [onSceneReady]);

  return <div id="game-container"></div>;
});
