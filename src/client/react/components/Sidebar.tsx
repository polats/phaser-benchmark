import { BENCHES, type BenchGroup } from '../../game/benches/registry';
import type { BenchPerfPayload } from '../../game/events';

const GROUP_LABELS: Record<BenchGroup, string> = {
  render: 'Rendering',
  physics: 'Physics',
  game: 'Game',
  demo: 'Showcase Demos',
};
const GROUP_ORDER: BenchGroup[] = ['render', 'physics', 'game', 'demo'];

type Props = {
  activeKey: string | null;
  isBench: boolean;
  perf: BenchPerfPayload | null;
  done: { capacity: number } | null;
  onSelect: (sceneKey: string) => void;
  onHome: () => void;
  onRestart: () => void;
  onToggle: () => void;
};

// Dismissable left sidebar (woid-style): grouped, scrollable scene selection +
// live run status. Mobile-first — collapses to a drawer, big tap targets.
export function Sidebar({ activeKey, isBench, perf, done, onSelect, onHome, onRestart, onToggle }: Props) {
  const groups = GROUP_ORDER.map((g) => ({
    g,
    items: BENCHES.filter((b) => b.group === g),
  })).filter((x) => x.items.length > 0);
  const active = BENCHES.find((b) => b.sceneKey === activeKey);

  return (
    <aside className="sidebar panel">
      <div className="sidebar-title">
        <div className="sidebar-title-row">
          <strong>phaser bench</strong>
          <button
            type="button"
            className="sidebar-collapse"
            onClick={onToggle}
            title="Hide sidebar"
            aria-label="Hide sidebar"
          >
            ‹
          </button>
        </div>
        <p>Phaser 4 stress tests — ramp until FPS drops</p>
      </div>

      <nav className="sidebar-nav">
        <button
          type="button"
          className={!isBench ? 'sidebar-link active' : 'sidebar-link'}
          onClick={onHome}
        >
          ⌂ Home
        </button>
        {groups.map(({ g, items }) => (
          <section key={g} className="sidebar-section">
            <h2>{GROUP_LABELS[g]}</h2>
            <ul>
              {items.map((b) => (
                <li key={b.sceneKey}>
                  <button
                    type="button"
                    className={b.sceneKey === activeKey ? 'sidebar-link active' : 'sidebar-link'}
                    onClick={() => onSelect(b.sceneKey)}
                    title={b.description}
                  >
                    {b.label}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      {isBench ? (
        <div className="sidebar-status">
          <div className="status-head">{active?.label ?? 'Bench'}</div>
          <div className="status-row">
            <span className="status-fps">{perf ? perf.fps.toFixed(0) : '—'}</span> fps
          </div>
          <div className="status-row">{perf ? perf.count.toLocaleString() : '—'} objects</div>
          <div className={done ? 'status-row done' : 'status-row ramp'}>
            {done ? `capacity ${done.capacity.toLocaleString()}` : 'ramping…'}
          </div>
          <button type="button" className="sidebar-action" onClick={onRestart}>
            ↻ restart run
          </button>
        </div>
      ) : null}
    </aside>
  );
}
