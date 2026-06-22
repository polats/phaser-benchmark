import { useCallback, useEffect, useRef, useState } from 'react';
import type { Scene } from 'phaser';
import { PhaserGame, type PhaserGameHandle } from './PhaserGame';
import { Sidebar } from './components/Sidebar';
import { BenchControls } from './components/BenchControls';
import { Leaderboard } from './components/Leaderboard';
import { EventBus } from '../game/EventBus';
import {
  GameEvents,
  type BenchDonePayload,
  type BenchPerfPayload,
  type ScorePayload,
} from '../game/events';
import { bridge } from '../game/devvit-bridge';
import { APP_VERSION, BUILD_TIME } from '../build-info';
import { HOME_SCENE_KEY } from '../game/main';
import { BENCHES } from '../game/benches/registry';
import type { LeaderboardEntry } from '../../shared/api';

const BENCH_KEYS = new Set(BENCHES.map((b) => b.sceneKey));
const ID_TO_KEY = new Map(BENCHES.map((b) => [b.benchId, b.sceneKey] as const));
const KEY_TO_ID = new Map(BENCHES.map((b) => [b.sceneKey, b.benchId] as const));

// Shareable deep links: ?scene=<benchId> opens that scene on load, and the URL is
// kept in sync as you switch scenes so the current URL is always shareable.
function readSceneParam(): string | null {
  return new URLSearchParams(window.location.search).get('scene');
}
function paramToSceneKey(param: string | null): string | null {
  if (!param) return null;
  if (ID_TO_KEY.has(param)) return ID_TO_KEY.get(param)!;
  return BENCH_KEYS.has(param) ? param : null; // also accept a raw sceneKey
}
function syncSceneUrl(sceneKey: string) {
  const id = KEY_TO_ID.get(sceneKey);
  const params = new URLSearchParams(window.location.search);
  if (id) params.set('scene', id);
  else params.delete('scene');
  const qs = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`);
}

// Top-level HUD shell. Mounts Phaser, relays React<->scene control, and renders
// the perf HUD, bench bar, and leaderboard over the canvas.
export function App() {
  const phaserRef = useRef<PhaserGameHandle>(null);
  const [activeSceneKey, setActiveSceneKey] = useState<string | null>(null);
  const [perf, setPerf] = useState<BenchPerfPayload | null>(null);
  const [done, setDone] = useState<{ capacity: number } | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const deepLinkTarget = useRef<string | null>(paramToSceneKey(readSceneParam()));
  const deepLinkApplied = useRef(false);

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

  const switchScene = useCallback((target: string) => {
    const game = phaserRef.current?.game;
    if (!game) return;
    // stop every running user-facing scene except the target (robust even when the
    // active-scene ref hasn't caught up yet, e.g. during a deep-link switch at boot)
    for (const s of game.scene.getScenes(true)) {
      if (s.scene.key !== target) game.scene.stop(s.scene.key);
    }
    setPerf(null);
    setDone(null);
    game.scene.start(target);
  }, []);

  const onSceneReady = useCallback(
    (scene: Scene) => {
      const key = scene.scene.key;
      setActiveSceneKey(key);
      // Apply the ?scene= deep link once the home scene is ready (boot + loader fully
      // settled), so a deep-linked switch behaves exactly like a sidebar selection.
      if (!deepLinkApplied.current && key === HOME_SCENE_KEY) {
        deepLinkApplied.current = true;
        const target = deepLinkTarget.current;
        if (target && target !== key) {
          // defer one tick so the home scene finishes create() and is fully running
          // before we stop it — otherwise the stop races create() and it lingers
          setTimeout(() => switchScene(target), 0);
          return; // the resulting scene's onSceneReady will sync the URL
        }
      }
      syncSceneUrl(key);
    },
    [switchScene]
  );

  const isBench = activeSceneKey !== null && BENCH_KEYS.has(activeSceneKey);

  const onRestart = useCallback(() => {
    if (activeSceneKey) switchScene(activeSceneKey);
  }, [activeSceneKey, switchScene]);

  return (
    <>
      <PhaserGame ref={phaserRef} onSceneReady={onSceneReady} />
      <div className={collapsed ? 'hud sidebar-collapsed' : 'hud'}>
        <Sidebar
          activeKey={activeSceneKey}
          isBench={isBench}
          perf={perf}
          done={done}
          onSelect={switchScene}
          onHome={() => switchScene(HOME_SCENE_KEY)}
          onRestart={onRestart}
          onToggle={() => setCollapsed(true)}
        />
        {collapsed ? (
          <button type="button" className="sidebar-open panel" onClick={() => setCollapsed(false)}>
            ☰{' '}
            {isBench && perf ? (
              <span className="sidebar-open-fps">{perf.fps.toFixed(0)} fps</span>
            ) : (
              'benches'
            )}
          </button>
        ) : null}
        <BenchControls activeKey={activeSceneKey} />
        {!isBench ? (
          <Leaderboard entries={entries} username={username} bestScore={bestScore} />
        ) : null}
        <span className="build-badge" title={BUILD_TIME ? `Built ${BUILD_TIME}` : undefined}>
          build {APP_VERSION}
        </span>
      </div>
    </>
  );
}
