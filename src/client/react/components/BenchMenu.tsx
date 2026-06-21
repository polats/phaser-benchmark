import { BENCHES } from '../../game/benches/registry';

type Props = {
  activeKey: string | null;
  onSelect: (sceneKey: string) => void;
  onHome: () => void;
};

// The top-right bar of buttons: one per bench, plus a Home button that returns
// to the playable demo scene.
export function BenchMenu({ activeKey, onSelect, onHome }: Props) {
  return (
    <div className="bench-bar panel">
      <button className="secondary" onClick={onHome}>
        ⌂ Home
      </button>
      {BENCHES.map((b) => (
        <button
          key={b.sceneKey}
          title={b.description}
          style={activeKey === b.sceneKey ? { outline: '2px solid #fff' } : undefined}
          onClick={() => onSelect(b.sceneKey)}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
