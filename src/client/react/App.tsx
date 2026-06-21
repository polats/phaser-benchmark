import { useCallback, useEffect, useRef, useState } from 'react';
import type { Scene } from 'phaser';
import { PhaserGame, type PhaserGameHandle } from './PhaserGame';
import { PerfHud } from './components/PerfHud';
import { BenchMenu } from './components/BenchMenu';
import { Leaderboard } from './components/Leaderboard';
import { EventBus } from '../game/EventBus';
import {
  GameEvents,
  type BenchDonePayload,
  type BenchPerfPayload,
  type ScorePayload,
} from '../game/events';
import { bridge } from '../game/devvit-bridge';
import { HOME_SCENE_KEY } from '../game/main';
import { BENCHES } from '../game/benches/registry';
import type { LeaderboardEntry } from '../../shared/api';

const BENCH_KEYS = new Set(BENCHES.map((b) => b.sceneKey));

// Top-level HUD shell. Mounts Phaser, relays React<->scene control, and renders
// the perf HUD, bench bar, and leaderboard over the canvas.
export function App() {
  const phaserRef = useRef<PhaserGameHandle>(null);
  const [activeSceneKey, setActiveSceneKey] = useState<string | null>(null);
  const [perf, setPerf] = useState<BenchPerfPayload | null>(null);
  const [done, setDone] = useState<{ capacity: number } | null>(null);

  const [username, setUsername] = useState<string | null>(null);
  const [bestScore, setBestScore] = useState(0);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  const refreshLeaderboard = useCallback(async () => {
    try {
      const lb = await bridge.leaderboard();
      setEntries(lb.entries);
    } catch (err) {
      console.error('leaderboard failed', err);
    }
  }, []);

  // Initial server handshake.
  useEffect(() => {
    void (async () => {
      try {
        const init = await bridge.init();
        setUsername(init.username);
        setBestScore(init.bestScore);
      } catch (err) {
        console.error('init failed', err);
      }
      await refreshLeaderboard();
    })();
  }, [refreshLeaderboard]);

  // Scene + bench event wiring.
  useEffect(() => {
    const onPerf = (p: BenchPerfPayload) => {
      setPerf(p);
      setDone(null);
    };
    const onDone = (d: BenchDonePayload) => {
      setDone({ capacity: d.capacity });
      void bridge
        .reportBench({
          bench: d.bench,
          capacity: d.capacity,
          fps: d.fps,
          device: {
            dpr: window.devicePixelRatio,
            width: window.innerWidth,
            height: window.innerHeight,
          },
        })
        .catch((err) => console.error('reportBench failed', err));
    };
    const onScore = (s: ScorePayload) => {
      void (async () => {
        try {
          const res = await bridge.submitScore(s.score);
          setBestScore(res.bestScore);
          await refreshLeaderboard();
        } catch (err) {
          console.error('submitScore failed', err);
        }
      })();
    };

    EventBus.on(GameEvents.BenchPerf, onPerf);
    EventBus.on(GameEvents.BenchDone, onDone);
    EventBus.on(GameEvents.Score, onScore);
    return () => {
      EventBus.off(GameEvents.BenchPerf, onPerf);
      EventBus.off(GameEvents.BenchDone, onDone);
      EventBus.off(GameEvents.Score, onScore);
    };
  }, [refreshLeaderboard]);

  const onSceneReady = useCallback((scene: Scene) => {
    setActiveSceneKey(scene.scene.key);
  }, []);

  const switchScene = useCallback((target: string) => {
    const game = phaserRef.current?.game;
    if (!game) return;
    const current = phaserRef.current?.scene?.scene.key;
    if (current && current !== target) game.scene.stop(current);
    setPerf(null);
    setDone(null);
    game.scene.start(target);
  }, []);

  const isBench = activeSceneKey !== null && BENCH_KEYS.has(activeSceneKey);

  return (
    <>
      <PhaserGame ref={phaserRef} onSceneReady={onSceneReady} />
      <div className="hud">
        <BenchMenu
          activeKey={activeSceneKey}
          onSelect={switchScene}
          onHome={() => switchScene(HOME_SCENE_KEY)}
        />
        {isBench ? <PerfHud perf={perf} done={done} /> : null}
        {!isBench ? (
          <Leaderboard entries={entries} username={username} bestScore={bestScore} />
        ) : null}
      </div>
    </>
  );
}
